"""
Validation Helpers for Delivery Challan Operations
Provides centralized validation logic with structured error codes
"""

import logging
import sqlite3

from backend.core.errors import bad_request

logger = logging.getLogger(__name__)


class ValidationError(Exception):
    """Custom validation error with structured error code"""

    def __init__(self, message: str, code: str, item_index: int | None = None):
        self.message = message
        self.code = code
        self.item_index = item_index
        super().__init__(message)


def validate_dc_items(items: list[dict], db: sqlite3.Connection, exclude_dc: str | None = None) -> None:
    """
    Validate DC items and check remaining quantities.

    Args:
        items: List of DC items to validate
        db: Database connection
        exclude_dc: DC number to exclude from dispatch calculations (for updates)

    Raises:
        HTTPException: If validation fails with structured error details
    """
    if not items or len(items) == 0:
        raise bad_request("At least one item is required")

    logger.debug(f"Validating {len(items)} DC items (exclude_dc={exclude_dc})")

    for idx, item in enumerate(items):
        try:
            validate_single_dc_item(item, idx, db, exclude_dc)
        except ValidationError as ve:
            # Convert ValidationError to HTTPException with structured detail
            error_detail = {
                "code": ve.code,
                "message": ve.message,
                "item_index": ve.item_index,
            }
            logger.warning(f"Validation failed: {error_detail}")
            raise bad_request(ve.message) from ve


def validate_single_dc_item(item: dict, idx: int, db: sqlite3.Connection, exclude_dc: str | None = None) -> None:
    """
    Validate a single DC item with strict business rules.

    Args:
        item: DC item dictionary
        idx: Item index (0-based)
        db: Database connection
        exclude_dc: DC number to exclude from calculations

    Raises:
        ValidationError: If validation fails
    """
    item_num = idx + 1  # 1-based for user-facing messages

    # 1. Validate required fields
    if "po_item_id" not in item or not item["po_item_id"]:
        raise ValidationError(
            f"Item {item_num}: po_item_id is required",
            code="MISSING_PO_ITEM_ID",
            item_index=idx,
        )

    if "dsp_qty" not in item or item["dsp_qty"] is None:
        raise ValidationError(
            f"Item {item_num}: dsp_qty is required",
            code="MISSING_DSP_QTY",
            item_index=idx,
        )

    # 2. Validate dispatch quantity is positive
    dsp_qty = item["dsp_qty"]
    if dsp_qty <= 0:
        raise ValidationError(
            f"Item {item_num}: dsp_qty must be greater than 0 (got {dsp_qty})",
            code="INVALID_DSP_QTY",
            item_index=idx,
        )

    # 3. Check remaining quantity (prevent over-dispatch)
    po_item_id = item["po_item_id"]
    lot_no = item.get("lot_no")

    # Get ordered quantity and already dispatched quantity
    if lot_no:
        # Lot-wise validation
        ordered_qty, already_dispatched = _get_lot_quantities(db, po_item_id, lot_no, exclude_dc)

        if ordered_qty is None:
            raise ValidationError(
                f"Item {item_num}: Lot {lot_no} not found for this PO item",
                code="LOT_NOT_FOUND",
                item_index=idx,
            )
    else:
        # Item-level validation (no lot)
        ordered_qty, already_dispatched = _get_item_quantities(db, po_item_id, exclude_dc)

        if ordered_qty is None:
            raise ValidationError(
                f"Item {item_num}: PO item not found",
                code="PO_ITEM_NOT_FOUND",
                item_index=idx,
            )

    # 4. Calculate remaining quantity and validate
    remaining_qty = ordered_qty - already_dispatched

    logger.debug(f"Item {item_num}: Ordered={ordered_qty}, Dispatched={already_dispatched}, Remaining={remaining_qty}, Requested={dsp_qty}")

    # CRITICAL BUSINESS RULE: dsp_qty > (ordered_qty - delivered_qty)
    if dsp_qty > remaining_qty:
        raise ValidationError(
            f"Item {item_num}: Dispatch quantity ({dsp_qty}) exceeds "
            f"remaining quantity ({remaining_qty}). "
            f"Ordered: {ordered_qty}, Already dispatched: {already_dispatched}",
            code="OVER_DISPATCH",
            item_index=idx,
        )


def _get_lot_quantities(
    db: sqlite3.Connection,
    po_item_id: str,
    lot_no: int,
    exclude_dc: str | None = None,
) -> tuple[float | None, float]:
    """
    Get ordered and dispatched quantities for a specific lot.

    Returns:
        (ordered_qty, already_dispatched) or (None, 0) if lot not found
    """
    # Get ordered quantity for this lot
    lot_row = db.execute(
        """
        SELECT ord_qty 
        FROM purchase_order_deliveries 
        WHERE po_item_id = ? AND lot_no = ?
    """,
        (po_item_id, lot_no),
    ).fetchone()

    if not lot_row:
        return (None, 0.0)

    ordered_qty = lot_row["ord_qty"]

    # Get already dispatched for this lot (excluding current DC if updating)
    if exclude_dc:
        already_dispatched = db.execute(
            """
            SELECT COALESCE(SUM(dsp_qty), 0) as total
            FROM delivery_challan_items
            WHERE po_item_id = ? AND lot_no = ? AND dc_number != ?
        """,
            (po_item_id, lot_no, exclude_dc),
        ).fetchone()["total"]
    else:
        already_dispatched = db.execute(
            """
            SELECT COALESCE(SUM(dsp_qty), 0) as total
            FROM delivery_challan_items
            WHERE po_item_id = ? AND lot_no = ?
        """,
            (po_item_id, lot_no),
        ).fetchone()["total"]

    return (ordered_qty, already_dispatched)


def _get_item_quantities(db: sqlite3.Connection, po_item_id: str, exclude_dc: str | None = None) -> tuple[float | None, float]:
    """
    Get ordered and dispatched quantities for an item (no lot).

    Returns:
        (ordered_qty, already_dispatched) or (None, 0) if item not found
    """
    # Get ordered quantity for this item
    item_row = db.execute(
        """
        SELECT ord_qty 
        FROM purchase_order_items 
        WHERE id = ?
    """,
        (po_item_id,),
    ).fetchone()

    if not item_row:
        return (None, 0.0)

    ordered_qty = item_row["ord_qty"]

    # Get already dispatched for this item (excluding current DC if updating)
    if exclude_dc:
        already_dispatched = db.execute(
            """
            SELECT COALESCE(SUM(dsp_qty), 0) as total
            FROM delivery_challan_items
            WHERE po_item_id = ? AND dc_number != ?
        """,
            (po_item_id, exclude_dc),
        ).fetchone()["total"]
    else:
        already_dispatched = db.execute(
            """
            SELECT COALESCE(SUM(dsp_qty), 0) as total
            FROM delivery_challan_items
            WHERE po_item_id = ?
        """,
            (po_item_id,),
        ).fetchone()["total"]

    return (ordered_qty, already_dispatched)
