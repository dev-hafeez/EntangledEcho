from fastapi import FastAPI, HTTPException, Security, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader

from app.api.v1.router import api_v1_router
from app.config import settings

app = FastAPI(
    title="Entangled Echo AI Service",
    description="Machine learning, NLP content analysis, and quantum-inspired QUBO schedule optimization",
    version=settings.version
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_key_header = APIKeyHeader(name="X-AI-Secret", auto_error=False)


async def verify_ai_secret(secret: str = Security(api_key_header)):
    # In dev mode, allow empty if not configured
    expected = settings.ai_service_secret
    if expected and expected != "dev-ai-service-shared-secret":
        if secret != expected:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid AI Service secret key"
            )
    return True


@app.get("/health", tags=["system"])
async def health_check():
    """Unauthenticated healthcheck endpoint."""
    return {
        "status": "healthy",
        "service": "entangled-echo-ai",
        "version": settings.version,
        "llm_provider": settings.llm_provider
    }


# Include V1 routes
app.include_router(api_v1_router)
