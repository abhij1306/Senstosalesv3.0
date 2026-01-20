"""
FastAPI Main Application
Production Configuration
"""

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Import Routers
from backend.api import (
    buyers,
    common,
    dashboard,
    dc,
    deviations,
    health,
    invoice,
    po,
    reports,
    search,
    settings,
    srv,
    system,
)
from backend.core.config import settings as app_settings
from backend.core.exceptions import AppException, ResourceNotFoundException

# Setup structured logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Bootstrap Database on Import/Startup
try:
    from backend.db.bootstrap import bootstrap_db
    bootstrap_db()
except Exception as e:
    logger.error(f"Failed to bootstrap database: {e}")

app = FastAPI(title=app_settings.PROJECT_NAME, description="SenstoSales ERP API", version="3.4.0")

# CORS Configuration - Environment-aware security
# Production: Only explicit origins allowed (security)
# Development: Can allow all origins if configured
origins_list = []
if app_settings.CORS_ALLOW_ALL_ORIGINS and app_settings.ENV_MODE == "dev":
    # Development mode: Allow all origins (only in dev)
    origins_list = ["*"]
else:
    # Production or restricted dev: Use explicit origins
    if app_settings.CORS_ALLOW_ORIGINS:
        origins_list = [origin.strip() for origin in app_settings.CORS_ALLOW_ORIGINS.split(",") if origin.strip()]
    else:
        # Default to localhost for development
        origins_list = ["http://localhost:3000", "http://127.0.0.1:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins_list,
    allow_credentials=False,  # Always False for security (can't use with wildcard anyway)
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    """
    Global handler for application-specific exceptions.
    Returns standardized response based on exception properties.
    """
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.message,
            "error_code": exc.error_code,
            "details": exc.details,
        },
    )





@app.exception_handler(ResourceNotFoundException)
async def resource_not_found_handler(request: Request, exc: ResourceNotFoundException):
    return JSONResponse(
        status_code=404,
        content={
            "success": False,
            "message": exc.message,
            "error_code": exc.error_code,
            "details": exc.details,
        },
    )


# Include Routers
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(common.router, tags=["Common"])  # No prefix - already has /api/common
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(po.router, prefix="/api/po", tags=["Purchase Orders"])
app.include_router(dc.router, prefix="/api/dc", tags=["Delivery Challans"])
app.include_router(invoice.router, prefix="/api/invoice", tags=["Invoices"])
app.include_router(srv.router, prefix="/api/srv", tags=["SRVs"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(settings.router, prefix="/api/settings", tags=["Settings"])
app.include_router(buyers.router, prefix="/api/buyers", tags=["Buyers"])
app.include_router(search.router, prefix="/api/search", tags=["Search"])
app.include_router(deviations.router, prefix="/api/deviations", tags=["Deviations"])
app.include_router(system.router, prefix="/api/system", tags=["System"]) # Included system router



@app.get("/")
def root():
    return {"status": "active", "version": "3.4.0"}


if __name__ == "__main__":
    import sys

    import uvicorn
    is_frozen = getattr(sys, 'frozen', False)
    
    if is_frozen:
        # Pass the app object directly to avoid import issues
        uvicorn.run(app, host="0.0.0.0", port=8000)
    else:
        # Use string for reload support
        uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
