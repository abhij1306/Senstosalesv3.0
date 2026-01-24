"""
Common/Utility routes
Provides shared functionality across modules
"""

import logging
import sqlite3
from typing import Literal

from fastapi import APIRouter, Depends, Query

from backend.db.session import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/common", tags=["Common"])


@router.get("/check-duplicate")
def check_duplicate_number(
    type: Literal["DC", "Invoice"] = Query(..., description="Type of document to check"),
    number: str = Query(..., description="Document number to check for duplicates"),
    date: str = Query(..., description="Document date (ISO format YYYY-MM-DD)"),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Check if a DC or Invoice number already exists within the same financial year.
    Uses ValidationService for centralized logic.
    """

    from backend.services.validation_service import ValidationService

    try:
        result = ValidationService.check_duplicate_number(db, type, number, date)
        logger.debug(
            f"Duplicate check for {type} #{number} in FY {result['financial_year']}: "
            f"{'CONFLICT with ' + result['conflict_type'] if result['exists'] else 'OK'}"
        )
        return result

    except Exception as e:
        logger.error(f"Error checking duplicate for {type}: {e}", exc_info=True)
        from backend.core.errors import internal_error

        raise internal_error("System error during duplicate validation. Document creation paused for safety.", e)
