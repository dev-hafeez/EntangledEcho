import os
from pathlib import Path
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
ENV_FILE = REPO_ROOT / ".env"
if ENV_FILE.exists():
    load_dotenv(ENV_FILE, override=True)
load_dotenv(".env", override=True)


class Settings(BaseSettings):
    app_name: str = "Entangled Echo AI Service"
    version: str = "0.1.0"
    debug: bool = False
    ai_service_secret: str = os.getenv("AI_SERVICE_SECRET", "dev-ai-service-shared-secret")
    llm_provider: str = os.getenv("LLM_PROVIDER", "mock")  # mock | anthropic | gemini
    llm_api_key: str = os.getenv("LLM_API_KEY", "")
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    port: int = int(os.getenv("PORT", "8000"))

    # Scoring weights defaults (FR-16)
    weight_likes: float = 1.0
    weight_comments: float = 3.0
    weight_shares: float = 5.0
    weight_saves: float = 4.0

    model_config = SettingsConfigDict(env_file=str(ENV_FILE), extra="ignore")


settings = Settings()

