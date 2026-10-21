from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from app.playwright_scraper import scrape_instagram_profile_and_posts
from app.ml.engine import ml_engine
from app.trending import fetch_live_google_trends, tailor_trend_to_niche
from app.niche_detector import detect_creator_niche
from app.chatbot import chat_with_gemini
from app.db import (
    get_cached_profile_and_posts,
    save_profile_and_posts,
    list_all_cached_profiles,
    delete_cached_profile
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
    Checks database cache first. If found, returns immediately.
    Otherwise crawls via Playwright, detects niche, and stores to database.
    """
    if not req.username:
        raise HTTPException(status_code=400, detail="Username is required")

    clean_handle = req.username.strip().lstrip("@")

    # 1. Check database cache first if not forced
    if not req.force_refresh:
        cached = get_cached_profile_and_posts(clean_handle)
        if cached:
            return cached

    # 2. Live crawling via Playwright
    try:
        data = await scrape_instagram_profile_and_posts(
            username=clean_handle,
            max_posts=req.max_posts or 12,
            headless=True
        )

        # 3. Detect Niche & Save to Database
        if data.get("status") == "success" and data.get("account"):
            niche_res = await detect_creator_niche(data["account"], data.get("posts", []))
            data["account"]["niche"] = niche_res.get("primary_niche")
            data["account"]["niche_info"] = niche_res
            save_profile_and_posts(clean_handle, data["account"], data.get("posts", []), niche_res)
            data["source"] = "live_crawler"

        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_v1_router.get("/profiles/cached")
async def list_cached_profiles_endpoint():
    """Admin endpoint: lists all stored profiles in database."""
    return {
        "status": "success",
        "profiles": list_all_cached_profiles()
    }


@api_v1_router.delete("/profiles/{handle}")
async def delete_cached_profile_endpoint(handle: str):
    """Admin endpoint: deletes a cached profile from database."""
    deleted = delete_cached_profile(handle)
    return {
        "status": "success",
        "deleted": deleted,
        "handle": handle
    }



