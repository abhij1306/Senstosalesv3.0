"""
Database validation utilities
Ensures data integrity and uniqueness constraints
"""

import logging
import sqlite3

from fastapi import HTTPException

logger = logging.getLogger(__name__)


def validate_unique_number(
    db: sqlite3.Connection,
    table: str,
    number_column: str,
    fy_column: str,
    number: str,
    fy: str,
    exclude_id: int = None,
) -> None:
    """
    Validate that a document number is unique for a given financial year.

    Args:
        db: Database connection
        table: Table name (e.g., 'purchase_orders')
        number_column: Column name for document number
        fy_column: Column name for FY
        number: Document number to validate
        fy: Financial year (e.g., '2024-25')
        exclude_id: Optional ID to exclude (for updates)

    Raises:
        HTTPException: If duplicate found
    """
    query = f"""
        SELECT 1 FROM {table} 
        WHERE {number_column} = ? AND {fy_column} = ?
    """
    params = [number, fy]

    if exclude_id:
        query += " AND id != ?"
        params.append(exclude_id)

    existing = db.execute(query, params).fetchone()

    if existing:
        doc_type = table.replace("_", " ").title().rstrip("s")
        raise HTTPException(
            status_code=400,
            detail=f"{doc_type} number '{number}' already exists for FY {fy}",
        )


def validate_po_exists(db: sqlite3.Connection, po_number: str, fy: str) -> bool:
    """
    Check if a PO exists for given number and FY.
    Used for SRV upload validation.
    """
    result = db.execute(
        """
        SELECT 1 FROM purchase_orders 
        WHERE po_number = ? AND financial_year = ?
    """,
        (po_number, fy),
    ).fetchone()

    return result is not None


def cast_decimal(value: any, precision: int = 2) -> float:
    """
    Ensure numeric value is cast to proper decimal precision.

    Args:
        value: Input value (str, int, float)
        precision: Decimal places (default 2)

    Returns:
        Float rounded to specified precision
    """
    try:
        return round(float(value), precision)
    except (ValueError, TypeError):
        return 0.0


def cast_integer(value: any) -> int:
    """Cast value to integer, return 0 if invalid"""
    try:
        return int(value)
    except (ValueError, TypeError):
        return 0


# Note: get_financial_year() has been removed - use backend.core.utils.get_financial_year instead
# This function was duplicated and is now centralized in core/utils.py
