from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from app.playwright_scraper import scrape_instagram_profile_and_posts
from app.ml.engine import ml_engine
from app.trending import fetch_live_google_trends, tailor_trend_to_niche
from app.niche_detector import detect_creator_niche
from app.chatbot import chat_with_gemini

api_v1_router = APIRouter(prefix="/api/v1")


class ScrapeInstagramRequest(BaseModel):
    username: str
    max_posts: Optional[int] = 12


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
            "google_trends_harvester",
            "gemini_niche_detector",
            "gemini_creator_chatbot"
        ],
        "model_loaded": ml_engine.global_model is not None
    }


@api_v1_router.get("/trends/google")
async def get_google_trends_endpoint(
    geo: str = Query("US", description="Two-letter country code or US"),
    limit: int = Query(12, description="Max trends to return"),
    niche: Optional[str] = Query(None, description="Creator niche to tailor angles for")
):
    """
    Returns live Google Trends search spikes with optional niche-tailored post hooks.
    """
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
    """
    Detects creator niche from scraped posts using Gemini AI.
    Routes 0-post creators to onboarding chat.
    """
    try:
        result = await detect_creator_niche(req.account, req.posts)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_v1_router.post("/chat/creator")
async def chat_creator_endpoint(req: ChatCreatorRequest):
    """
    Gemini-powered Creator Strategist Chatbot.
    Assists with onboarding niche discovery or ongoing content ideation.
    """
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
async def recommend_content_endpoint(req: RecommendContentRequest):
    """
    Recommends optimal format, optimal slot, and keyword hooks for creator.
    """
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
    """
    Server-side Playwright crawler:
    Scrapes real profile metadata, follower counts, and real post captions & images.
    """
    if not req.username:
        raise HTTPException(status_code=400, detail="Username is required")

    try:
        data = await scrape_instagram_profile_and_posts(
            username=req.username,
            max_posts=req.max_posts or 12,
            headless=True
        )
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


