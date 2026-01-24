import os
import sqlite3

# Adjust path to import from backend
import sys
import tempfile
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).parent.parent.parent))

from backend.db.bootstrap import bootstrap_db
from backend.db.session import get_db
from backend.main import app


@pytest.fixture(scope="session")
def test_db_path():
    """Create a temporary database file for the test session."""
    # Create a temporary file
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)

    # Bootstrap the database (apply schema)
    db_url = f"sqlite:///{path}"
    # Quiet the logger during tests if needed, or let it log
    bootstrap_db(db_url)

    yield path

    # Cleanup
    if os.path.exists(path):
        os.remove(path)


@pytest.fixture(scope="function")
def test_db(test_db_path) -> Generator[sqlite3.Connection, None, None]:
    """Provide a database connection for each test function."""
    conn = sqlite3.connect(test_db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    # Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON")

    yield conn

    conn.close()


@pytest.fixture(scope="function")
def client(test_db_path) -> Generator[TestClient, None, None]:
    """Provide a TestClient with overridden database dependency."""

    def override_get_db():
        conn = sqlite3.connect(test_db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        try:
            yield conn
        finally:
            conn.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()
