"""
Performance Monitoring Middleware
Tracks slow requests and database operations
"""

import logging
import time

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class PerformanceMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()

        # Track request
        method = request.method
        url = str(request.url)

        response = await call_next(request)

        process_time = time.time() - start_time

        # Log slow requests (>1 second)
        if process_time > 1.0:
            logger.warning(f"SLOW REQUEST: {method} {url} took {process_time:.2f}s")

        # Add performance headers
        response.headers["X-Process-Time"] = f"{process_time:.3f}"

        # Log all requests in debug mode
        logger.debug(f"{method} {url} - {response.status_code} - {process_time:.3f}s")

        return response
