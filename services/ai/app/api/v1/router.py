import re
import uuid
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from app.playwright_scraper import scrape_instagram_profile_and_posts
from app.ml.engine import ml_engine
from app.trending import fetch_live_google_trends, tailor_trend_to_niche
from app.niche_detector import detect_creator_niche
from app.chatbot import chat_with_gemini
from app.optimizer import (
    run_qubo_optimization,
    run_classical_simulated_annealing,
    compare_optimizers
)
from app.recommender import (
    run_ai_recommendation_engine,
    update_creator_feedback,
    get_creator_preferences
)
from app.decomposer import decompose_campaign_goal
from app.analysis import run_full_content_analysis
from app.db import (
    get_cached_profile_and_posts,
    save_profile_and_posts,
    list_all_cached_profiles,
    delete_cached_profile,
    save_optimization_job,
    get_latest_optimization_job,
    list_scheduled_posts,
    add_scheduled_post,
    delete_scheduled_post
)

api_v1_router = APIRouter(prefix="/api/v1")


class ScrapeInstagramRequest(BaseModel):
    username: str
    max_posts: Optional[int] = 12
    force_refresh: Optional[bool] = False


class PredictEngagementRequest(BaseModel):
    draft_media_type: str = "image"
    draft_caption: str = ""
    scheduled_time: Optional[str] = None
    draft_hashtags: Optional[List[str]] = None
    user_account: Dict[str, Any] = {}
    user_posts: List[Dict[str, Any]] = []


class RecommendContentRequest(BaseModel):
    user_account: Dict[str, Any] = {}
    user_posts: List[Dict[str, Any]] = []


class DetectNicheRequest(BaseModel):
    account: Dict[str, Any] = {}
    posts: List[Dict[str, Any]] = []


class ChatCreatorRequest(BaseModel):
    messages: List[Dict[str, str]]
    account: Dict[str, Any]
    niche_info: Optional[Dict[str, Any]] = None


class OptimizeScheduleRequest(BaseModel):
    account: Dict[str, Any] = {}
    posts: List[Dict[str, Any]] = []
    target_posts_per_week: int = 5
    min_gap_hours: int = 4
    blackout_slots: Optional[List[Dict[str, Any]]] = None
    algorithm: str = "qubo"  # "qubo" | "classical_sa" | "compare"
    horizon_days: int = 7


class RecommendationRequest(BaseModel):
    account: Dict[str, Any] = {}
    posts: List[Dict[str, Any]] = []
    recommendation_type: str = "caption"  # "caption" | "schedule" | "content_type"
    user_prompt: Optional[str] = None


class FeedbackRequest(BaseModel):
    recommendation_id: str
    handle: str
    accepted: bool
    feedback_text: Optional[str] = None


class DecomposeGoalRequest(BaseModel):
    account: Dict[str, Any] = {}
    goal: str
    platform: str = "instagram"
    horizon_days: int = 14
    target_posts: int = 4


class ScheduledPostRequest(BaseModel):
    handle: str
    title: str = "Scheduled Post"
    caption: str = ""
    hashtags: Optional[List[str]] = []
    media_type: str = "image"
    media_url: Optional[str] = None
    day_of_week: Optional[str] = None
    time_slot: Optional[str] = None
    scheduled_time: Optional[str] = None
    status: str = "SCHEDULED"


@api_v1_router.get("/status")
async def get_v1_status():
    return {
        "status": "healthy",
        "api_version": "v1",
        "modules": [
            "analysis",
            "optimizer",
            "recommender",
            "decomposer",
            "playwright_scraper",
            "dual_ml_engine",
            "qubo_quantum_annealer",
            "classical_simulated_annealing",
            "google_trends_harvester",
            "gemini_niche_detector",
            "gemini_creator_chatbot"
        ],
        "model_loaded": ml_engine.global_model is not None,
        "quantum_solver": "dimod + dwave.samplers.SimulatedAnnealingSampler"
    }


# -------------------------------------------------------------
# Quantum-Inspired Optimizer Endpoints (FR-17..20, UC06)
# -------------------------------------------------------------

@api_v1_router.post("/optimize")
async def optimize_schedule_endpoint(req: OptimizeScheduleRequest):
    """
    Quantum-Inspired Schedule Optimizer (Algorithm 1 / QUBO).
    Formulates 168 time-slots into a Quadratic Unconstrained Binary Optimization problem
    solved via Simulated Annealing (dwave-samplers), returning primary schedule, 3 alternatives,
    and bootstrap stability confidence metrics.
    """
    try:
        # Load posts from DB if not provided in payload
        handle = req.account.get("handle") or "user"
        clean_handle = handle.strip().lstrip("@").lower()
        posts = req.posts
        if not posts:
            cached = get_cached_profile_and_posts(clean_handle)
            if cached and cached.get("posts"):
                posts = cached["posts"]

        if req.algorithm == "classical_sa":
            result = run_classical_simulated_annealing(
                account=req.account,
                posts=posts,
                target_posts_per_week=req.target_posts_per_week,
                min_gap_hours=req.min_gap_hours,
                blackout_slots=req.blackout_slots
            )
        elif req.algorithm == "compare":
            result = compare_optimizers(
                account=req.account,
                posts=posts,
                target_posts_per_week=req.target_posts_per_week,
                min_gap_hours=req.min_gap_hours
            )
        else:
            result = run_qubo_optimization(
                account=req.account,
                posts=posts,
                target_posts_per_week=req.target_posts_per_week,
                min_gap_hours=req.min_gap_hours,
                blackout_slots=req.blackout_slots,
                num_reads=250
            )

        # Persist to optimization_jobs table
        job_id = f"opt_{clean_handle}_{uuid.uuid4().hex[:8]}"
        constraints = {
            "target_posts_per_week": req.target_posts_per_week,
            "min_gap_hours": req.min_gap_hours,
            "blackout_slots": req.blackout_slots or [],
            "horizon_days": req.horizon_days,
            "algorithm": req.algorithm
        }
        if "primary_schedule" in result:
            save_optimization_job(
                job_id=job_id,
                handle=clean_handle,
                constraints=constraints,
                primary_schedule=result["primary_schedule"],
                alternatives=result.get("alternatives", []),
                schedule_confidence=result.get("schedule_confidence", 75.0),
                qubo_stats=result.get("qubo_stats", {})
            )
        result["job_id"] = job_id
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_v1_router.get("/optimize/latest")
async def get_latest_optimization_endpoint(handle: str = Query(..., description="Creator handle")):
    """Returns the most recent optimization result for creator."""
    clean_handle = handle.strip().lstrip("@").lower()
    job = get_latest_optimization_job(clean_handle)
    if not job:
        raise HTTPException(status_code=404, detail="No optimization job found for this creator")
    return {"status": "success", "job": job}


# -------------------------------------------------------------
# AI Recommendations & Task Decomposition (FR-21..24, UC04)
# -------------------------------------------------------------

@api_v1_router.post("/recommend")
async def ai_recommendation_endpoint(req: RecommendationRequest):
    """
    Executes Algorithm 2 (SRDS 5.6.2):
    - caption: 3 editable caption drafts with hashtag clusters & topic extraction.
    - schedule: optimal slot recommendations from quantum optimizer.
    - content_type: format ranking by mean performance with bootstrap confidence intervals.
    """
    try:
        handle = req.account.get("handle") or "user"
        clean_handle = handle.strip().lstrip("@").lower()
        posts = req.posts
        if not posts:
            cached = get_cached_profile_and_posts(clean_handle)
            if cached and cached.get("posts"):
                posts = cached["posts"]

        result = await run_ai_recommendation_engine(
            account=req.account,
            posts=posts,
            recommendation_type=req.recommendation_type,
            user_prompt=req.user_prompt
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_v1_router.post("/recommend/feedback")
async def recommendation_feedback_endpoint(req: FeedbackRequest):
    """
    Feedback loop (FR-24):
    Accepts/rejects recommendations and updates creator preference weights.
    """
    try:
        res = update_creator_feedback(
            recommendation_id=req.recommendation_id,
            handle=req.handle,
            accepted=req.accepted,
            feedback_text=req.feedback_text
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_v1_router.get("/recommend/preferences")
async def get_preferences_endpoint(handle: str = Query(...)):
    """Returns learned creator preferences."""
    clean_handle = handle.strip().lstrip("@").lower()
    return {
        "status": "success",
        "handle": clean_handle,
        "preferences": get_creator_preferences(clean_handle)
    }


@api_v1_router.post("/decompose")
async def decompose_goal_endpoint(req: DecomposeGoalRequest):
    """
    Decomposes high-level creator marketing goal into structured actionable tasks (FR-22, UC07).
    """
    try:
        result = await decompose_campaign_goal(
            account=req.account,
            goal=req.goal,
            platform=req.platform,
            horizon_days=req.horizon_days,
            target_posts=req.target_posts
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------------------------------------
# Content Analysis (FR-13..16)
# -------------------------------------------------------------

@api_v1_router.post("/analysis/full")
async def full_content_analysis_endpoint(req: DetectNicheRequest):
    """
    Executes NLP content analysis: TF-IDF topics, VADER sentiments, hashtag clusters, and format stats.
    """
    try:
        handle = req.account.get("handle") or "user"
        clean_handle = handle.strip().lstrip("@").lower()
        posts = req.posts
        if not posts:
            cached = get_cached_profile_and_posts(clean_handle)
            if cached and cached.get("posts"):
                posts = cached["posts"]

        result = run_full_content_analysis(req.account, posts)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------------------------------------
# Content Calendar & Scheduled Posts (FR-25..28)
# -------------------------------------------------------------

@api_v1_router.get("/calendar/posts")
def get_scheduled_posts_endpoint(handle: str = Query(...)):
    """Lists all scheduled posts for creator."""
    clean_handle = handle.strip().lstrip("@").lower()
    posts = list_scheduled_posts(clean_handle)
    return {
        "status": "success",
        "handle": clean_handle,
        "count": len(posts),
        "scheduled_posts": posts
    }


@api_v1_router.post("/calendar/posts")
def create_scheduled_post_endpoint(req: ScheduledPostRequest):
    """Schedules a new post."""
    try:
        res = add_scheduled_post(req.dict())
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_v1_router.delete("/calendar/posts/{post_id}")
def delete_scheduled_post_endpoint(post_id: str):
    """Deletes a scheduled post."""
    deleted = delete_scheduled_post(post_id)
    return {"status": "success", "deleted": deleted, "id": post_id}


# -------------------------------------------------------------
# Google Trends & Niche Detection
# -------------------------------------------------------------

@api_v1_router.get("/trends/google")
async def get_google_trends_endpoint(
    geo: str = Query("US", description="Two-letter country code or US"),
    limit: int = Query(12, description="Max trends to return"),
    niche: Optional[str] = Query(None, description="Creator niche to tailor angles for")
):
    """Returns live Google Trends search spikes with optional niche-tailored post hooks."""
    try:
        raw_trends = fetch_live_google_trends(geo=geo, limit=limit)
        if niche:
            for item in raw_trends:
                item["niche_angle"] = tailor_trend_to_niche(item, niche)
        return {
            "status": "success",
            "geo": geo,
            "target_niche": niche,
            "trends": raw_trends
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_v1_router.post("/niche/detect")
async def detect_niche_endpoint(req: DetectNicheRequest):
    """Detects creator niche from scraped posts using Gemini AI."""
    try:
        result = await detect_creator_niche(req.account, req.posts)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_v1_router.post("/chat/creator")
async def chat_creator_endpoint(req: ChatCreatorRequest):
    """Gemini-powered Creator Strategist Chatbot."""
    try:
        result = await chat_with_gemini(req.messages, req.account, req.niche_info)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_v1_router.get("/model/metadata")
async def get_model_metadata():
    """Returns training metrics, R2 score, and feature importances of Model 1."""
    return {
        "status": "success",
        "metadata": ml_engine.metadata
    }


@api_v1_router.post("/predict/engagement")
async def predict_engagement_endpoint(req: PredictEngagementRequest):
    """
    Dual-Model Engagement Rate Predictor:
    Combines Model 1 (Global Regressor) with Model 2 (Personal Profile Bayesian Model).
    """
    try:
        result = ml_engine.predict_engagement(
            draft_media_type=req.draft_media_type,
            draft_caption=req.draft_caption,
            scheduled_time=req.scheduled_time,
            draft_hashtags=req.draft_hashtags,
            user_account=req.user_account,
            user_posts=req.user_posts
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_v1_router.post("/recommend/content")
async def recommend_content_legacy_endpoint(req: RecommendContentRequest):
    """Legacy endpoint for fast dashboard recommendation preview."""
    try:
        result = ml_engine.recommend_content_strategy(
            user_account=req.user_account,
            user_posts=req.user_posts
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_v1_router.post("/scrape/instagram")
async def scrape_instagram_endpoint(req: ScrapeInstagramRequest):
    """Checks database cache first. If found, returns immediately. Otherwise crawls via Playwright."""
    if not req.username:
        raise HTTPException(status_code=400, detail="Username is required")

    raw_name = req.username.strip().lstrip("@")
    clean_handle = re.sub(r'^(?:https?:\/\/)?(?:www\.)?instagram\.com\/', '', raw_name, flags=re.I)
    clean_handle = clean_handle.split('?')[0].split('#')[0].strip('/')

    if not req.force_refresh:
        cached = get_cached_profile_and_posts(clean_handle)
        # Only return cached record if it contains verified posts
        if cached and cached.get("posts") and len(cached["posts"]) > 0:
            return cached

    try:
        data = await scrape_instagram_profile_and_posts(
            username=clean_handle,
            max_posts=req.max_posts or 12,
            headless=True
        )

        if data.get("status") == "error":
            raise HTTPException(status_code=404, detail=data.get("message", f"Could not scrape @{clean_handle}. Please verify account is public."))

        if data.get("status") == "success" and data.get("account"):
            acc = data["account"]
            posts = data.get("posts", [])
            # Only save to DB pool if account is valid and has followers or posts
            if acc.get("followers", 0) > 0 or len(posts) > 0:
                niche_res = await detect_creator_niche(acc, posts)
                data["account"]["niche"] = niche_res.get("primary_niche")
                data["account"]["niche_info"] = niche_res
                save_profile_and_posts(clean_handle, acc, posts, niche_res)
                data["source"] = "live_crawler"

        return data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error scraping @{clean_handle}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@api_v1_router.get("/profiles/cached")
def list_cached_profiles_endpoint():
    """Admin endpoint: lists all stored profiles in database."""
    return {
        "status": "success",
        "profiles": list_all_cached_profiles()
    }


@api_v1_router.delete("/profiles/{handle}")
def delete_cached_profile_endpoint(handle: str):
    """Admin endpoint: deletes a cached profile from database."""
    deleted = delete_cached_profile(handle)
    return {
        "status": "success",
        "deleted": deleted,
        "handle": handle
    }
