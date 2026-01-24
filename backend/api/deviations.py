"""
Deviations API Router
Handles listing and resolving deviations.
"""

import sqlite3
from typing import Optional

from fastapi import APIRouter, Depends

from backend.db.models import PaginatedMetadata, PaginatedResponse
from backend.db.session import get_db
from backend.services.deviation_service import DeviationService

router = APIRouter()


@router.get("/")
def get_deviations(
    include_resolved: bool = False, limit: int = 50, offset: int = 0, po_number: Optional[str] = None, db: sqlite3.Connection = Depends(get_db)
):
    """List detected deviations."""
    # If po_number is provided, we filter by it
    if po_number:
        where_clause = "WHERE po_number = ?"
        params = [po_number]
        if not include_resolved:
            where_clause += " AND is_resolved = 0"
    else:
        where_clause = "" if include_resolved else "WHERE is_resolved = 0"
        params = []

    # Get total count
    count_query = f"SELECT COUNT(*) FROM deviations {where_clause}"
    total_count = db.execute(count_query, params).fetchone()[0]

    # Get data
    query = f"""
        SELECT 
            id, deviation_type, entity_type, entity_id, po_number,
            field_name, expected_value, actual_value, details,
            is_resolved, resolved_at, resolved_by, created_at
        FROM deviations
        {where_clause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    """
    rows = db.execute(query, params + [limit, offset]).fetchall()

    items = [dict(row) for row in rows]

    return PaginatedResponse(items=items, metadata=PaginatedMetadata(total_count=total_count, page=(offset // limit) + 1, limit=limit))


@router.post("/{deviation_id}/resolve")
def resolve_deviation(deviation_id: int, db: sqlite3.Connection = Depends(get_db)):
    """Mark a deviation as resolved."""
    success = DeviationService.resolve_deviation(db, deviation_id)
    return {"success": success}


@router.get("/stats")
def get_deviation_stats(db: sqlite3.Connection = Depends(get_db)):
    """Get count of unresolved deviations."""
    count = DeviationService.get_unresolved_count(db)
    return {"unresolved_count": count}
