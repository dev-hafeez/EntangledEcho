from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from app.playwright_scraper import scrape_instagram_profile_and_posts
from app.ml.engine import ml_engine

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
            "dual_ml_engine"
        ],
        "model_loaded": ml_engine.global_model is not None
    }


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

