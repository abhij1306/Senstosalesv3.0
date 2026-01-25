"""
Delivery Challan Service Layer
Centralizes all DC business logic and validation
HTTP-agnostic - can be called from routers or AI agents
"""

import logging
import sqlite3
import uuid

from backend.core.exceptions import (
    BusinessRuleViolation,
    ConflictError,
    ErrorCode,
    ResourceNotFoundError,
    ValidationError,
)
from backend.core.number_utils import to_qty
from backend.core.result import ServiceResult
from backend.db.models import DCCreate
from backend.services.validation_service import ValidationService

logger = logging.getLogger(__name__)


def validate_dc_header(dc: DCCreate, db: sqlite3.Connection) -> None:
    """
    Validate DC header fields
    """
    ValidationService.validate_dc_header(db, dc.dc_number, dc.dc_date)


def validate_dc_items(items: list[dict], db: sqlite3.Connection, exclude_dc: str | None = None) -> None:
    """
    Validate DC items for dispatch quantity constraints
    """
    ValidationService.validate_dc_items(db, items, exclude_dc)

    pass  # Validation delegated to ValidationService


def check_dc_has_invoice(dc_number: str, db: sqlite3.Connection) -> str | None:
    """
    Check if DC is linked to an invoice
    """
    return ValidationService.check_document_linked(db, dc_number)


def create_dc(dc: DCCreate, items: list[dict], db: sqlite3.Connection) -> ServiceResult[dict]:
    """
    Create new Delivery Challan
    """
    try:
        from backend.core.utils import get_financial_year
        # from core.number_utils import to_float, to_int, to_qty

        fy = get_financial_year(dc.dc_date)

        # Financial year boundaries
        year_start = fy.split("-")[0]
        full_year_start = f"{year_start}-04-01"
        year_end = f"20{fy.split('-')[1]}"
        full_year_end = f"{year_end}-03-31"

        logger.debug(f"Service create_dc checking duplicate for {dc.dc_number} in {fy}")
        # Check for duplicate DC number within the FY
        existing = db.execute(
            """
            SELECT 1 FROM delivery_challans 
            WHERE dc_number = ? 
            AND dc_date >= ? AND dc_date <= ?
        """,
            (dc.dc_number, full_year_start, full_year_end),
        ).fetchone()

        if existing:
            logger.debug(f"Duplicate DC number found: {dc.dc_number} in FY {fy}")
            raise ConflictError(
                f"DC number {dc.dc_number} already exists in Financial Year {fy}.",
                details={"dc_number": dc.dc_number, "financial_year": fy},
            )

        final_dc_number = dc.dc_number

        # 0. GC Number/Date Defaults & Validation
        if not dc.gc_number or dc.gc_number.strip() == "":
            dc.gc_number = final_dc_number
        
        if not dc.gc_date or dc.gc_date.strip() == "":
            dc.gc_date = dc.dc_date  # Default GC date to DC date

        # Check for duplicate GC number within the FY
        # Note: GC number is independent of DC number sequence
        existing_gc = db.execute(
            """
            SELECT 1 FROM delivery_challans 
            WHERE gc_number = ? 
            AND dc_date >= ? AND dc_date <= ?
        """,
            (dc.gc_number, full_year_start, full_year_end),
        ).fetchone()

        if existing_gc:
             raise ConflictError(
                f"GC number {dc.gc_number} already exists in Financial Year {fy}.",
                details={"gc_number": dc.gc_number, "financial_year": fy},
            )

        # Normalize item keys: frontend sends 'dispatch_qty', internal uses 'dsp_qty'
        for item in items:
            if "dispatch_qty" in item and "dsp_qty" not in item:
                item["dsp_qty"] = item.pop("dispatch_qty")

        # Validate
        logger.debug("Validating DC header and items")
        validate_dc_header(dc, db)
        validate_dc_items(items, db, exclude_dc=None)

        logger.debug(f"Creating DC {final_dc_number} with {len(items)} items")
        logger.debug("Inserting DC header")

        # Insert DC header with finalized number
        db.execute(
            """
            INSERT INTO delivery_challans
            (dc_number, dc_date, po_number, department_no, financial_year,
             consignee_name, consignee_gstin, consignee_address, 
             inspection_company, eway_bill_no, vehicle_no, lr_no, 
             transporter, mode_of_transport, remarks, our_ref, gc_number, gc_date,
             supplier_name, supplier_address, supplier_gstin, supplier_contact)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (
                final_dc_number,
                dc.dc_date,
                dc.po_number,
                dc.department_no,
                fy,
                dc.consignee_name,
                dc.consignee_gstin,
                dc.consignee_address,
                dc.inspection_company,
                dc.eway_bill_no,
                dc.vehicle_no,
                dc.lr_no,
                dc.transporter,
                dc.mode_of_transport,
                dc.remarks,
                dc.our_ref,
                dc.gc_number,
                dc.gc_date,
                dc.supplier_name,
                dc.supplier_address,
                dc.supplier_gstin,
                dc.supplier_contact,
            ),
        )

        # Insert DC items with ATOMIC INVENTORY CHECK (R-01) - AT ITEM LEVEL
        for item in items:
            po_item_id = item["po_item_id"]
            total_dsp_qty = to_qty(item["dsp_qty"])
            
            # AT ITEM LEVEL: We don't care about specific target_lot anymore
            # Record against a single entry (lot_no=1) for consistency with schema if needed
            item_id = str(uuid.uuid4())

            # We use a single INSERT ... SELECT statement to ensure atomicity at ITEM level.
            cursor = db.execute(
                """
                INSERT INTO delivery_challan_items
                (id, dc_number, po_item_id, lot_no, dsp_qty, hsn_code, hsn_rate)
                SELECT ?, ?, ?, 1, ?, ?, ?
                WHERE EXISTS (
                    -- R-01: Atomic Inventory Check at ITEM Level
                    SELECT 1
                    FROM purchase_order_items poi
                    WHERE poi.id = ?
                    AND (
                        poi.ord_qty - (
                            SELECT COALESCE(SUM(dsp_qty), 0)
                            FROM delivery_challan_items
                            WHERE po_item_id = poi.id
                        )
                    ) >= ? - 0.001
                )
                """,
                (
                    item_id,
                    final_dc_number,
                    po_item_id,
                    total_dsp_qty,
                    item.get("hsn_code"),
                    item.get("hsn_rate"),
                    # Subquery params
                    po_item_id,
                    total_dsp_qty,
                ),
            )

            if cursor.rowcount == 0:
                raise BusinessRuleViolation(
                    f"Inventory check failed for Item {po_item_id}. Attempted to dispatch {total_dsp_qty}, but insufficient remaining quantity.",
                    details={
                        "item_id": po_item_id,
                        "attempted_qty": total_dsp_qty,
                        "invariant": "R-01 (Atomic Item-Level Check)",
                    },
                )

        # SYNC: Update PO's our_ref if DC provides one
        if dc.our_ref and dc.po_number:
            db.execute(
                "UPDATE purchase_orders SET our_ref = ? WHERE po_number = ? AND (our_ref IS NULL OR our_ref = '')",
                (dc.our_ref, dc.po_number)
            )

        # ATOMIC SYNC: Update PO status after DC creation
        from backend.services.reconciliation_v2 import ReconciliationService

        ReconciliationService.reconcile_dc(db, final_dc_number)

        logger.info(f"Successfully created DC {final_dc_number} with {len(items)} items")

        return ServiceResult.ok({"success": True, "dc_number": final_dc_number})

    except (ValidationError, ResourceNotFoundError, BusinessRuleViolation):
        # Domain errors - let them propagate
        raise
    except Exception as e:
        # Unexpected errors
        logger.error(f"Failed to create DC: {e}", exc_info=True)
        return ServiceResult.fail(
            error_code=ErrorCode.INTERNAL_ERROR,
            message=f"Failed to create DC: {e!s}",
        )


def update_dc(dc_number: str, dc: DCCreate, items: list[dict], db: sqlite3.Connection) -> ServiceResult[dict]:
    """
    Update existing Delivery Challan
    HTTP-agnostic - returns ServiceResult instead of raising HTTPException

    Args:
        dc_number: DC number to update
        dc: Updated DC header data
        items: Updated list of DC items
        db: Database connection (must be in transaction)

    Returns:
        ServiceResult with success status and dc_number
    """
    try:
        # INVARIANT: DC-2 - DC cannot be edited if it has an invoice
        invoice_number = check_dc_has_invoice(dc_number, db)
        if invoice_number:
            raise ConflictError(
                f"Cannot edit DC {dc_number} - already linked to invoice {invoice_number}",
                details={
                    "dc_number": dc_number,
                    "invoice_number": invoice_number,
                    "invariant": "DC-2",
                },
            )

        # Ensure DC number matches
        if dc.dc_number != dc_number:
            raise ValidationError("DC number in body must match URL")

        # Validate
        # Validate
        validate_dc_header(dc, db)
        validate_dc_items(items, db, exclude_dc=dc_number)
        
        # 0. GC Number/Date Defaults & Validation
        if not dc.gc_number or dc.gc_number.strip() == "":
            dc.gc_number = dc_number # Default to DC number
        
        if not dc.gc_date or dc.gc_date.strip() == "":
             from datetime import date
             dc.gc_date = date.today().strftime("%d-%m-%Y")

        # Check for duplicate GC number (excluding current DC)
        # We need to know FY to check duplicates, fetch current record for date or use new date
        # Assuming duplicate check relies on dc_date range of the updated record
        from backend.core.utils import get_financial_year
        fy = get_financial_year(dc.dc_date)
        year_start = fy.split("-")[0]
        full_year_start = f"{year_start}-04-01"
        year_end = f"20{fy.split('-')[1]}"
        full_year_end = f"{year_end}-03-31"

        existing_gc = db.execute(
            """
            SELECT 1 FROM delivery_challans 
            WHERE gc_number = ? 
            AND dc_date >= ? AND dc_date <= ?
            AND dc_number != ?
        """,
            (dc.gc_number, full_year_start, full_year_end, dc_number),
        ).fetchone()

        if existing_gc:
             raise ConflictError(
                f"GC number {dc.gc_number} already exists in Financial Year {fy}.",
                details={"gc_number": dc.gc_number, "financial_year": fy},
            )

        logger.debug(f"Updating DC {dc_number} with {len(items)} items")

        # Update Header
        db.execute(
            """
            UPDATE delivery_challans SET
            dc_date = ?, po_number = ?, department_no = ?, 
            consignee_name = ?, consignee_gstin = ?, consignee_address = ?, 
            inspection_company = ?, eway_bill_no = ?, vehicle_no = ?, 
            lr_no = ?, transporter = ?, mode_of_transport = ?, remarks = ?, our_ref = ?,
            gc_number = ?, gc_date = ?,
            supplier_name = ?, supplier_address = ?, supplier_gstin = ?, supplier_contact = ?
            WHERE dc_number = ?
        """,
            (
                dc.dc_date,
                dc.po_number,
                dc.department_no,
                dc.consignee_name,
                dc.consignee_gstin,
                dc.consignee_address,
                dc.inspection_company,
                dc.eway_bill_no,
                dc.vehicle_no,
                dc.lr_no,
                dc.transporter,
                dc.mode_of_transport,
                dc.remarks,
                dc.our_ref,
                dc.gc_number,
                dc.gc_date,
                dc.supplier_name,
                dc.supplier_address,
                dc.supplier_gstin,
                dc.supplier_contact,
                dc_number,
            ),
        )

        # Note: No reversion needed - we'll re-reconcile after updating items
        from backend.services.reconciliation_v2 import ReconciliationService

        # Delete old items
        db.execute("DELETE FROM delivery_challan_items WHERE dc_number = ?", (dc_number,))

        # Insert new items with ATOMIC INVENTORY CHECK (R-01) - AT ITEM LEVEL
        # OPTIMIZED: Batch insert to prevent N+1 queries

        # 1. Normalize keys and prepare IDs
        po_item_ids = []
        for item in items:
            if "dispatch_qty" in item and "dsp_qty" not in item:
                item["dsp_qty"] = item.pop("dispatch_qty")
            po_item_ids.append(item["po_item_id"])

        # 2. Batch fetch PO item states (for validation)
        # Use LEFT JOIN to calculate current dispatched quantity directly from source (delivery_challan_items)
        # instead of relying on purchase_order_items.dsp_qty (trigger-maintained).
        # This is more robust. Since we deleted this DC's items, dci only contains other DCs.
        po_map = {}
        if po_item_ids:
            placeholders = ",".join("?" for _ in po_item_ids)
            po_rows = db.execute(
                f"""
                SELECT poi.id, poi.ord_qty, COALESCE(SUM(dci.dsp_qty), 0) as used_qty
                FROM purchase_order_items poi
                LEFT JOIN delivery_challan_items dci ON dci.po_item_id = poi.id
                WHERE poi.id IN ({placeholders})
                GROUP BY poi.id
                """,
                po_item_ids
            ).fetchall()

            for row in po_rows:
                # Handle both sqlite3.Row (dict-like) and tuple
                try:
                     rid = row["id"]
                     ord_qty = row["ord_qty"]
                     used_qty = row["used_qty"]
                except (TypeError, IndexError):
                     rid = row[0]
                     ord_qty = row[1]
                     used_qty = row[2]
                po_map[rid] = {"ord_qty": ord_qty, "dsp_qty": used_qty}

        insert_data = []

        for item in items:
            po_item_id = item["po_item_id"]
            total_dsp_qty = to_qty(item["dsp_qty"])
            item_id = str(uuid.uuid4())

            # Validation
            po_state = po_map.get(po_item_id)
            if not po_state:
                 # This might happen if po_item_id is invalid.
                 # However, foreign key constraint on insert would catch it too,
                 # but we want to catch it here for clean error or pass through to insert failure.
                 # Let's let it fail at insert or raise error here.
                 raise ResourceNotFoundError("PO Item", po_item_id)

            # Check availability
            # R-01: Atomic Inventory Check
            available_qty = (po_state["ord_qty"] or 0) - (po_state["dsp_qty"] or 0)

            if total_dsp_qty > available_qty + 0.001:
                raise BusinessRuleViolation(
                    f"Inventory check failed for Item {po_item_id}. Attempted to dispatch {total_dsp_qty}, but insufficient remaining quantity.",
                    details={
                        "item_id": po_item_id,
                        "attempted_qty": total_dsp_qty,
                        "remaining": available_qty,
                        "invariant": "R-01 (Atomic Item-Level Check)",
                    },
                )

            # Update local state to account for this dispatch in subsequent checks within the same batch
            po_state["dsp_qty"] = (po_state["dsp_qty"] or 0) + total_dsp_qty

            # Prepare tuple for bulk insert
            insert_data.append((
                item_id,
                dc_number,
                po_item_id,
                1, # lot_no hardcoded to 1
                total_dsp_qty,
                item.get("hsn_code"),
                item.get("hsn_rate")
            ))

        # 3. Batch Insert
        if insert_data:
            db.executemany(
                """
                INSERT INTO delivery_challan_items
                (id, dc_number, po_item_id, lot_no, dsp_qty, hsn_code, hsn_rate)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                insert_data
            )

        # ATOMIC SYNC: Re-reconcile PO after DC update
        ReconciliationService.reconcile_dc(db, dc_number)

        logger.info(f"Successfully updated DC {dc_number}")
        return ServiceResult.ok({"success": True, "dc_number": dc_number})

    except (
        ValidationError,
        ResourceNotFoundError,
        ConflictError,
        BusinessRuleViolation,
    ):
        # Domain errors - let them propagate
        raise
    except Exception as e:
        # Unexpected errors
        logger.error(f"Failed to update DC: {e}", exc_info=True)
        return ServiceResult.fail(
            error_code=ErrorCode.INTERNAL_ERROR,
            message=f"Failed to update DC: {e!s}",
        )


def delete_dc(dc_number: str, db: sqlite3.Connection) -> ServiceResult[dict]:
    """
    Delete a Delivery Challan
    Rolls back quantity reconciliation by removing the records
    
    INVARIANTS:
    - DC cannot be deleted if linked to an Invoice
    - DC cannot be deleted if SRV items reference it (received goods)
    """
    try:
        # INVARIANT: DC-2 - DC cannot be deleted if it has an invoice
        invoice_number = check_dc_has_invoice(dc_number, db)
        if invoice_number:
            raise ConflictError(
                f"Cannot delete DC {dc_number} - linked to invoice {invoice_number}",
                details={
                    "dc_number": dc_number,
                    "invoice_number": invoice_number,
                    "invariant": "DC-2",
                },
            )
        
        # INVARIANT: DC-3 - DC cannot be deleted if SRV items reference it
        srv_row = db.execute("""
            SELECT srv_number FROM srv_items 
            WHERE challan_no = ? 
            LIMIT 1
        """, (dc_number,)).fetchone()
        
        if srv_row:
            raise ConflictError(
                f"Cannot delete DC {dc_number} - has received goods in SRV {srv_row['srv_number']}",
                details={
                    "dc_number": dc_number,
                    "srv_number": srv_row["srv_number"],
                    "invariant": "DC-3",
                },
            )

        # Check if DC exists
        dc_row = db.execute("SELECT 1 FROM delivery_challans WHERE dc_number = ?", (dc_number,)).fetchone()
        if not dc_row:
            raise ResourceNotFoundError("DC", dc_number)

        # Get PO number before deletion for reconciliation
        po_row = db.execute("SELECT po_number FROM delivery_challans WHERE dc_number = ?", (dc_number,)).fetchone()
        po_number = po_row[0] if po_row else None
        
        from backend.services.reconciliation_v2 import ReconciliationService

        # Delete DC Header (Items will be deleted via ON DELETE CASCADE or manually if not supported)
        db.execute("DELETE FROM delivery_challan_items WHERE dc_number = ?", (dc_number,))
        db.execute("DELETE FROM delivery_challans WHERE dc_number = ?", (dc_number,))

        # Reconcile the PO after deletion to update its status
        if po_number:
            ReconciliationService.reconcile_po(db, po_number)

        logger.info(f"Successfully deleted DC {dc_number}")
        return ServiceResult.ok({"success": True, "message": f"DC {dc_number} deleted"})

    except (ResourceNotFoundError, ConflictError):
        raise
    except Exception as e:
        logger.error(f"Failed to delete DC: {e}", exc_info=True)
        return ServiceResult.fail(
            error_code=ErrorCode.INTERNAL_ERROR,
            message=f"Failed to delete DC: {e!s}",
        )
