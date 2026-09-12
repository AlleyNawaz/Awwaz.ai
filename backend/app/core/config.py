import os
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv

# Load .env file from project root or current working dir
env_path = Path(__file__).resolve().parent.parent.parent.parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()


project_root = Path(__file__).resolve().parent.parent.parent.parent
default_db_path = str((project_root / "awwaz.db").resolve())
resolved_db_url = os.getenv("DATABASE_URL") or f"sqlite+aiosqlite:///{default_db_path}"
if "sqlite" in resolved_db_url and ("///." in resolved_db_url or (resolved_db_url.startswith("sqlite:///") and not resolved_db_url.startswith("sqlite:////"))):
    resolved_db_url = f"sqlite+aiosqlite:///{default_db_path}"


class Settings(BaseModel):
    APP_NAME: str = os.getenv("APP_NAME", "Awwaz")
    APP_ENV: str = os.getenv("APP_ENV", "development")
    APP_DEBUG: bool = os.getenv("APP_DEBUG", "true").lower() in ("true", "1", "yes")
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")

    # Database
    DATABASE_URL: str = resolved_db_url
    DATABASE_SYNC_URL: str = resolved_db_url.replace("+aiosqlite", "")

    # Auth & Security
    AUTH_SECRET: str = os.getenv("AUTH_SECRET", "awwaz_hackathon_demo_secret_key_32bytes_min_length_value")
    SESSION_COOKIE_NAME: str = os.getenv("SESSION_COOKIE_NAME", "awwaz_session")
    SESSION_MAX_AGE_SECONDS: int = int(os.getenv("SESSION_MAX_AGE_SECONDS", "86400"))

    # AI Provider: "fixture", "gemini", "openai", "openrouter"
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "fixture")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_MODEL: str = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
    OPENROUTER_BASE_URL: str = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

    # Neural Search & Knowledge Retrieval (Exa AI)
    EXA_API_KEY: str = os.getenv("EXA_API_KEY", "")
    EXA_BASE_URL: str = os.getenv("EXA_BASE_URL", "https://api.exa.ai")

    # Identity & Access Management (Auth0)
    AUTH0_DOMAIN: str = os.getenv("AUTH0_DOMAIN", "")
    AUTH0_CLIENT_ID: str = os.getenv("AUTH0_CLIENT_ID", "")
    AUTH0_CLIENT_SECRET: str = os.getenv("AUTH0_CLIENT_SECRET", "")
    AUTH0_AUDIENCE: str = os.getenv("AUTH0_AUDIENCE", "")

    # Durable Cloud Background Jobs (Trigger.dev)
    TRIGGER_API_KEY: str = os.getenv("TRIGGER_API_KEY", "")
    TRIGGER_PROJECT_ID: str = os.getenv("TRIGGER_PROJECT_ID", "")
    TRIGGER_API_URL: str = os.getenv("TRIGGER_API_URL", "https://api.trigger.dev")

    # Cloud Runtime & AI Platform (Google Cloud)
    GOOGLE_CLOUD_PROJECT: str = os.getenv("GOOGLE_CLOUD_PROJECT", "")

    # Operator Assistant & Copilot Framework (CopilotKit)
    COPILOTKIT_PUBLIC_KEY: str = os.getenv("COPILOTKIT_PUBLIC_KEY", "")

    # Open Source AI Safety & Alignment (Mozilla AI)
    MOZILLA_AI_SAFETY_ENABLED: bool = os.getenv("MOZILLA_AI_SAFETY_ENABLED", "true").lower() in ("true", "1", "yes")

    # Civic Intake Disambiguation (Ambiguous AI)
    AMBIGUOUS_AI_CONFIDENCE_THRESHOLD: float = float(os.getenv("AMBIGUOUS_AI_CONFIDENCE_THRESHOLD", "0.75"))

    # Civic Service Adapter: "mock", "live"
    CIVIC_ADAPTER_TYPE: str = os.getenv("CIVIC_ADAPTER_TYPE", "mock")
    CIVIC_SERVICE_BASE_URL: str = os.getenv("CIVIC_SERVICE_BASE_URL", "https://mock.civic.local/api/v1")
    CIVIC_ADAPTER_TIMEOUT_SECONDS: int = int(os.getenv("CIVIC_ADAPTER_TIMEOUT_SECONDS", "10"))

    # Storage
    STORAGE_TYPE: str = os.getenv("STORAGE_TYPE", "local")
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")
    MAX_FILE_SIZE_BYTES: int = int(os.getenv("MAX_FILE_SIZE_BYTES", "10485760"))  # 10MB

    # SLA and Workers
    STALL_THRESHOLD_HOURS: int = int(os.getenv("STALL_THRESHOLD_HOURS", "72"))
    COMMITMENT_CHECK_INTERVAL_SECONDS: int = int(os.getenv("COMMITMENT_CHECK_INTERVAL_SECONDS", "60"))


settings = Settings()
