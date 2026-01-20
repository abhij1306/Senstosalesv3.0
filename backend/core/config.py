import os
import shutil
import sys
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATABASE_DIR = PROJECT_ROOT / "db"

# -----------------------------------------------------------------------------
# PERSISTENCE LOGIC FOR FROZEN (EXE) BUILDS
# -----------------------------------------------------------------------------

is_frozen = getattr(sys, 'frozen', False)

if is_frozen and hasattr(sys, '_MEIPASS'):
    # We are running inside the EXE (PyInstaller)
    # The 'bundled' files (including seed DB) are in sys._MEIPASS
    internal_bundle_dir = Path(sys._MEIPASS)
    
    # We want the DB to live next to the EXE file so it persists
    exe_dir = Path(sys.executable).parent
    persistent_db_dir = exe_dir / "db"
    persistent_db_path = persistent_db_dir / "business.db"
    
    # Ensure external db folder exists
    persistent_db_dir.mkdir(exist_ok=True)
    
    # If external DB doesn't exist yet, copy the SEED DB from inside the bundle
    if not persistent_db_path.exists():
        internal_seed_db = internal_bundle_dir / "db" / "business.db"
        if internal_seed_db.exists():
            # Use print for boot messages as logging may not be configured yet
            print(f"[BOOT] Initializing persistent database at: {persistent_db_path}", file=sys.stderr)
            shutil.copy2(internal_seed_db, persistent_db_path)
            # IMPORTANT: Ensure the copied file is writable! 
            # PyInstaller often extracts files as Read-Only.
            os.chmod(persistent_db_path, 0o666)
        else:
            print("[BOOT] WARNING: No internal seed DB found to copy!", file=sys.stderr)
            
    DATABASE_PATH = Path(os.environ.get("DATABASE_PATH", persistent_db_path))

else:
    # Development Mode
    DATABASE_PATH = Path(os.environ.get("DATABASE_PATH", DATABASE_DIR / "business.db"))

# -----------------------------------------------------------------------------
# AUTOMATED STARTUP BACKUP
# -----------------------------------------------------------------------------
# Backup logic removed by user request


MIGRATIONS_DIR = PROJECT_ROOT / "migrations"


class Settings(BaseSettings):
    # App Info
    PROJECT_NAME: str = "SenstoSales"
    API_V1_STR: str = "/api"
    ENV_MODE: str = "dev"  # dev, prod, test

    # Security & API Keys
    GROQ_API_KEY: SecretStr | None = None
    OPENAI_API_KEY: SecretStr | None = None
    OPENROUTER_API_KEY: SecretStr | None = None
    # Sentry Removed

    # Database - use DATABASE_PATH constant above, not this URL
    DATABASE_URL: str = os.environ.get("DATABASE_URL", f"sqlite:///{DATABASE_PATH}")

    # CORS Configuration
    CORS_ALLOW_ORIGINS: str = os.environ.get(
        "CORS_ALLOW_ORIGINS",
        "*"
    )
    CORS_ALLOW_ALL_ORIGINS: bool = os.environ.get("CORS_ALLOW_ALL_ORIGINS", "true").lower() == "true"

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
