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

    # AI Provider: "fixture", "gemini", "openai"
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "fixture")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

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
