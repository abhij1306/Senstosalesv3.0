import logging
import sqlite3
import sys
from pathlib import Path

from backend.core.config import settings

logger = logging.getLogger(__name__)

def get_base_path():
    """Get the base path of the application, handling PyInstaller's temp dir."""
    if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent.parent.parent

def bootstrap_db():
    """
    Ensures the database is fully initialized with the correct schema.
    Runs the consolidated schema SQL script idempotently.
    """
    try:
        logger.info("Starting Database Bootstrap...")
        
        # Determine paths
        base_path = get_base_path()
        schema_path = base_path / "migrations" / "v2_consolidated_schema.sql"
        
        # Use database path from settings, but handle relative paths correctly
        db_url = settings.DATABASE_URL.replace("sqlite:///", "")
        
        # If running in EXE, the db might be in user data or adjacent to exe
        # But settings.DATABASE_URL usually points to where we want it.
        # Ensure directory exists
        db_file = Path(db_url)
        db_file.parent.mkdir(parents=True, exist_ok=True)
        
        if not schema_path.exists():
            logger.error(f"SCHEMA ERROR: Migration file not found at {schema_path}")
            # If critical, maybe we should crash? But for now log error.
            return

        logger.info(f"Applying schema from: {schema_path}")
        logger.info(f"Target Database: {db_file}")

        conn = sqlite3.connect(str(db_file))
        cursor = conn.cursor()
        
        with open(schema_path, "r", encoding="utf-8") as f:
            schema_sql = f.read()
            
        # Execute script
        cursor.executescript(schema_sql)
        logger.info("Schema applied successfully.")

        # Apply Seed Data
        seed_path = base_path / "migrations" / "v3_seed_data.sql"
        if seed_path.exists():
            with open(seed_path, "r", encoding="utf-8") as f:
                seed_sql = f.read()
            cursor.executescript(seed_sql)
            logger.info("Seed data applied successfully.")
        else:
            logger.warning(f"Seed data file NOT found at {seed_path}")

        conn.commit()
        
        # Verification: Check if critical tables exist and have data
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('buyers', 'settings')")
        found_tables = [r[0] for r in cursor.fetchall()]
        
        if 'buyers' in found_tables and 'settings' in found_tables:
            # Check for seed data
            cursor.execute("SELECT COUNT(*) FROM settings")
            settings_count = cursor.fetchone()[0]
            logger.info(f"Database Bootstrap Complete: {settings_count} settings found.")
        elif 'buyers' in found_tables:
            logger.warning("Database Bootstrap Partial: 'buyers' table confirmed, but 'deviations' table is MISSING.")
        else:
            logger.error("Database Bootstrap Failed: Critical tables NOT found after schema execution.")
            
        conn.close()
        
    except Exception as e:
        logger.exception(f"CRITICAL: Database bootstrap failed: {e}")
        # We generally don't want to kill the app, but this is bad.
