import os

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Entangled Echo AI Service"
    version: str = "0.1.0"
    debug: bool = False
    ai_service_secret: str = os.getenv("AI_SERVICE_SECRET", "dev-ai-service-shared-secret")
    llm_provider: str = os.getenv("LLM_PROVIDER", "mock")  # mock | anthropic | gemini
    llm_api_key: str = os.getenv("LLM_API_KEY", "")
    port: int = int(os.getenv("PORT", "8000"))

    # Scoring weights defaults (FR-16)
    weight_likes: float = 1.0
    weight_comments: float = 3.0
    weight_shares: float = 5.0
    weight_saves: float = 4.0

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
