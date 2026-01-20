"""
Database Session Management - Simplified
"""
import logging
import sqlite3
from collections.abc import Generator
from contextlib import contextmanager

from backend.core.config import settings

logger = logging.getLogger(__name__)


def get_connection() -> sqlite3.Connection:
    """Get a SQLite connection with standard settings."""
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    
    # Performance settings (run once per connection)
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 5000")
    
    return conn


def get_db() -> Generator[sqlite3.Connection, None, None]:
    """FastAPI dependency - yields a connection and closes after request."""
    conn = get_connection()
    try:
        yield conn
    except Exception as e:
        logger.error(f"Database error: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


@contextmanager
def db_transaction(conn: sqlite3.Connection):
    """Context manager for explicit transactions."""
    try:
        conn.execute("BEGIN IMMEDIATE")
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Transaction rolled back: {e}")
        raise


def transactional(func):
    """Decorator for endpoints that need transaction wrapping."""
    import inspect
    from functools import wraps
    
    if inspect.iscoroutinefunction(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            db = kwargs.get('db')
            if db is None:
                raise ValueError("transactional requires 'db' parameter")
            with db_transaction(db):
                return await func(*args, **kwargs)
        return async_wrapper
    else:
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            db = kwargs.get('db')
            if db is None:
                raise ValueError("transactional requires 'db' parameter")
            with db_transaction(db):
                return func(*args, **kwargs)
        return sync_wrapper
