from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.playwright_scraper import scrape_instagram_profile_and_posts

api_v1_router = APIRouter(prefix="/api/v1")


class ScrapeInstagramRequest(BaseModel):
    username: str
    max_posts: Optional[int] = 12


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
            "playwright_scraper"
        ]
    }


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
