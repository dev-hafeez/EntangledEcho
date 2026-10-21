from fastapi import APIRouter

api_v1_router = APIRouter(prefix="/api/v1")


@api_v1_router.get("/status")
async def get_v1_status():
    return {
        "status": "healthy",
        "api_version": "v1",
        "modules": [
            "analysis",
            "optimizer",
            "recommender",
            "decomposer"
        ]
    }
