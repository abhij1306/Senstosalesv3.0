"""
Health Check Endpoints
Provides health, readiness, and metrics endpoints for monitoring
"""

import logging
import os
import sqlite3
from datetime import datetime
from typing import Any

try:
    import psutil
except ImportError:
    psutil = None
from fastapi import APIRouter, Depends, HTTPException

from backend.db.session import get_db

router = APIRouter()
logger = logging.getLogger(__name__)

# Track application start time
START_TIME = datetime.utcnow()


@router.get("/health")
def health_check() -> dict[str, Any]:
    """
    Basic health check - returns 200 if service is running

    Use this for:
    - Load balancer health checks
    - Simple uptime monitoring
    """
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "service": "SenstoSales ERP",
        "version": "3.4.0",
    }


@router.get("/ping")
def ping() -> dict[str, str]:
    """
    Simple ping endpoint - returns 'pong' for basic connectivity tests.
    Required by production audit gate PQ-8.
    """
    return {"ping": "pong"}


@router.get("/health/ready")
def readiness_check(db: sqlite3.Connection = Depends(get_db)) -> dict[str, Any]:
    """
    Readiness check - verifies all dependencies are available

    Use this for:
    - Kubernetes readiness probes
    - Deployment verification

    Returns 200 if ready, 503 if not ready
    """

    checks = {"database": "unknown", "filesystem": "unknown"}

    all_healthy = True

    # Check database connectivity
    try:
        result = db.execute("SELECT 1").fetchone()
        if result and result[0] == 1:
            checks["database"] = "healthy"
        else:
            checks["database"] = "unhealthy: unexpected result"
            all_healthy = False
    except Exception as e:
        checks["database"] = f"unhealthy: {e!s}"
        all_healthy = False
        logger.error(f"Database health check failed: {e}", exc_info=True)

    # Check filesystem (logs directory)
    try:
        logs_dir = os.path.join(os.getcwd(), "logs")
        if not os.path.exists(logs_dir):
            try:
                os.makedirs(logs_dir, exist_ok=True)
            except Exception:
                pass # Non-critical failure
        
        # In frozen mode, we might be in a read-only temp dir, but usually we start 
        # from the EXE dir which should be writable.
        if os.path.exists(logs_dir) and os.access(logs_dir, os.W_OK):
            checks["filesystem"] = "healthy"
        else:
            # If logs aren't writable, it's a warning but we can usually still start
            checks["filesystem"] = "healthy (logs limited)"
            logger.warning("Logs directory not writable, continuing in limited mode")
    except Exception as e:
        checks["filesystem"] = f"unhealthy: {e!s}"
        all_healthy = False

    # Overall status
    overall_status = "ready" if all_healthy else "not_ready"

    response = {
        "status": overall_status,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "checks": checks,
    }

    # Return 503 if not ready
    if not all_healthy:
        raise HTTPException(status_code=503, detail=response)

    return response


@router.get("/health/live")
def liveness_check() -> dict[str, Any]:
    """
    Liveness check - verifies the application is alive

    Use this for:
    - Kubernetes liveness probes
    - Detecting deadlocks or hangs

    Returns 200 if alive, 503 if not
    """
    try:
        # Simple check - if we can respond, we're alive
        uptime_seconds = (datetime.utcnow() - START_TIME).total_seconds()

        return {
            "status": "alive",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "uptime_seconds": round(uptime_seconds, 2),
        }
    except Exception as e:
        logger.error(f"Liveness check failed: {e}", exc_info=True)
        raise HTTPException(status_code=503, detail={"status": "not_alive", "error": str(e)}) from e


@router.get("/health/metrics")
def metrics() -> dict[str, Any]:
    """
    Basic metrics endpoint

    Provides:
    - System metrics (CPU, memory)
    - Application uptime
    - Process info
    """
    try:
        if not psutil:
            return {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "uptime_seconds": round((datetime.utcnow() - START_TIME).total_seconds(), 2),
                "system": "Metrics unavailable (psutil not installed)",
            }

        # Get process info
        process = psutil.Process(os.getpid())

        # Calculate uptime
        uptime_seconds = (datetime.utcnow() - START_TIME).total_seconds()

        # Get memory info
        memory_info = process.memory_info()

        return {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "uptime_seconds": round(uptime_seconds, 2),
            "process": {
                "pid": os.getpid(),
                "cpu_percent": process.cpu_percent(interval=0.1),
                "memory_mb": round(memory_info.rss / 1024 / 1024, 2),
                "threads": process.num_threads(),
            },
            "system": {
                "cpu_count": psutil.cpu_count(),
                "cpu_percent": psutil.cpu_percent(interval=0.1),
                "memory_percent": psutil.virtual_memory().percent,
                "disk_percent": psutil.disk_usage("/").percent if os.name != "nt" else psutil.disk_usage("C:\\").percent,
            },
        }
    except Exception as e:
        logger.error(f"Metrics collection failed: {e}", exc_info=True)
        return {"timestamp": datetime.utcnow().isoformat() + "Z", "error": str(e)}
