"""
Deviation Service
Handles logging and resolution of data deviations (qty mismatch, doc conflicts)
"""

import json
import sqlite3
from datetime import datetime
from typing import Any


class DeviationService:
    """Service for managing deviations (qty mismatches, document conflicts)"""

    @staticmethod
    def log_deviation(
        db: sqlite3.Connection,
        deviation_type: str,
        entity_type: str,
        entity_id: str,
        po_number: str | None = None,
        field_name: str | None = None,
        expected_value: Any = None,
        actual_value: Any = None,
        details: dict | None = None,
    ) -> int:
        """
        Log a deviation without blocking ingestion.

        Args:
            deviation_type: 'QTY_MISMATCH', 'DOC_NUMBER_CONFLICT', 'FY_COLLISION'
            entity_type: 'srv_item', 'srv', 'dc_item'
            entity_id: The ID of the entity (srv_item.id, srv.srv_number, etc.)
            po_number: Related PO number
            field_name: Name of the field that deviated (e.g., 'ord_qty')
            expected_value: What system expected
            actual_value: What document contained
            details: Additional JSON context

        Returns:
            The ID of the created deviation record
        """
        cursor = db.execute(
            """
            INSERT INTO deviations 
                (deviation_type, entity_type, entity_id, po_number, 
                 field_name, expected_value, actual_value, details)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                deviation_type,
                entity_type,
                entity_id,
                po_number,
                field_name,
                str(expected_value) if expected_value is not None else None,
                str(actual_value) if actual_value is not None else None,
                json.dumps(details) if details else None,
            ),
        )
        return cursor.lastrowid

    @staticmethod
    def check_qty_mismatch(db: sqlite3.Connection, srv_item_id: str, po_number: str, po_item_no: int, srv_ord_qty: float) -> bool:
        """
        Check if SRV ord_qty differs from PO ord_qty and log deviation if so.

        Returns True if there was a mismatch.
        """
        po_item = db.execute("SELECT ord_qty FROM purchase_order_items WHERE po_number = ? AND po_item_no = ?", (po_number, po_item_no)).fetchone()

        if not po_item:
            return False  # PO item not found, not a deviation

        po_ord_qty = float(po_item["ord_qty"] or 0)

        # Use tolerance for float comparison
        if abs(srv_ord_qty - po_ord_qty) > 0.001:
            DeviationService.log_deviation(
                db=db,
                deviation_type="QTY_MISMATCH",
                entity_type="srv_item",
                entity_id=srv_item_id,
                po_number=po_number,
                field_name="ord_qty",
                expected_value=po_ord_qty,
                actual_value=srv_ord_qty,
                details={"po_item_no": po_item_no},
            )
            return True
        return False

    @staticmethod
    def get_deviations_for_entity(db: sqlite3.Connection, entity_type: str, entity_id: str) -> list[dict]:
        """Get all deviations for a specific entity."""
        rows = db.execute(
            """
            SELECT id, deviation_type, field_name, expected_value, actual_value,
                   is_resolved, created_at
            FROM deviations
            WHERE entity_type = ? AND entity_id = ?
            ORDER BY created_at DESC
            """,
            (entity_type, entity_id),
        ).fetchall()

        return [dict(row) for row in rows]

    @staticmethod
    def get_unresolved_count(db: sqlite3.Connection) -> int:
        """Get count of unresolved deviations."""
        result = db.execute("SELECT COUNT(*) FROM deviations WHERE is_resolved = 0").fetchone()
        return result[0] if result else 0

    @staticmethod
    def resolve_deviation(db: sqlite3.Connection, deviation_id: int, resolved_by: str = "system") -> bool:
        """Mark a deviation as resolved."""
        db.execute(
            """
            UPDATE deviations 
            SET is_resolved = 1, resolved_at = ?, resolved_by = ?
            WHERE id = ?
            """,
            (datetime.now().isoformat(), resolved_by, deviation_id),
        )
        return True

    @staticmethod
    def list_deviations(db: sqlite3.Connection, include_resolved: bool = False, limit: int = 100, offset: int = 0) -> list[dict]:
        """List deviations with pagination."""
        where_clause = "" if include_resolved else "WHERE is_resolved = 0"

        rows = db.execute(
            f"""
            SELECT id, deviation_type, entity_type, entity_id, po_number,
                   field_name, expected_value, actual_value, is_resolved, created_at
            FROM deviations
            {where_clause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        ).fetchall()

        return [dict(row) for row in rows]
