"""
Validation Service
Centralizes high-value business rules and cross-document validation.
"""

import logging
import sqlite3
from typing import Any, Dict, Literal, Optional

from backend.core.exceptions import (
    BusinessRuleViolation,
    ConflictError,
    ResourceNotFoundError,
    ValidationError,
)
from backend.core.number_utils import to_qty
from backend.core.utils import get_financial_year

logger = logging.getLogger(__name__)


class ValidationService:
    @staticmethod
    def check_duplicate_number(db: sqlite3.Connection, doc_type: Literal["DC", "Invoice"], number: str, date: str) -> Dict[str, Any]:
        """
        Check if a DC or Invoice number already exists within the same financial year.
        Ensures cross-document uniqueness (DC vs Invoice).
        """
        try:
            fy = get_financial_year(date)
            # Calculate FY boundaries
            year_start = fy.split("-")[0]
            full_year_start = f"{year_start}-04-01"
            year_end = f"20{fy.split('-')[1]}"
            full_year_end = f"{year_end}-03-31"

            exists = False
            conflict_type = None

            # 1. Check same-type conflict
            table = "delivery_challans" if doc_type == "DC" else "gst_invoices"
            col = "dc_number" if doc_type == "DC" else "invoice_number"
            date_col = "dc_date" if doc_type == "DC" else "invoice_date"

            query = f"SELECT 1 FROM {table} WHERE {col} = ? AND {date_col} >= ? AND {date_col} <= ? LIMIT 1"
            if db.execute(query, (number, full_year_start, full_year_end)).fetchone():
                exists = True
                conflict_type = doc_type

            # NOTE: Cross-entity check REMOVED - DC and Invoice are independent entities
            # DC 344 and Invoice 344 can coexist in the same FY
            # Same-entity FY duplicate check (above) remains active

            return {"exists": exists, "financial_year": fy, "conflict_type": conflict_type}

        except Exception as e:
            logger.error(f"Error in check_duplicate_number for {doc_type} #{number}: {e}", exc_info=True)
            raise

    @staticmethod
    def validate_dc_header(db: sqlite3.Connection, dc_number: str, dc_date: str) -> None:
        """
        Validate DC header fields
        """
        if not dc_number or dc_number.strip() == "":
            raise ValidationError("DC number is required")

        if not dc_date or dc_date.strip() == "":
            raise ValidationError("DC date is required")

        # Check for duplicate DC number within same FY
        result = ValidationService.check_duplicate_number(db, "DC", dc_number, dc_date)
        if result["exists"]:
            raise ConflictError(f"Delivery Challan {dc_number} already exists in FY {result['financial_year']}")

    @staticmethod
    def validate_dc_items(db: sqlite3.Connection, items: list[dict], exclude_dc: str | None = None) -> None:
        """
        Validate DC items for dispatch quantity constraints
        """
        if not items or len(items) == 0:
            raise ValidationError("At least one item is required")

        for idx, item in enumerate(items):
            if "po_item_id" not in item or not item["po_item_id"]:
                raise ValidationError(f"Item {idx + 1}: PO item ID is required", details={"item_index": idx})

            dsp_qty_val = item.get("dsp_qty") or item.get("dispatch_qty")
            if dsp_qty_val is None:
                raise ValidationError(f"Item {idx + 1}: Dispatch quantity is required", details={"item_index": idx})

            dsp_qty = to_qty(dsp_qty_val)
            if dsp_qty is None:
                raise ValidationError(f"Item {idx + 1}: Invalid dispatch quantity format", details={"item_index": idx, "value": dsp_qty_val})

            if dsp_qty <= 0:
                raise ValidationError(f"Item {idx + 1}: Dispatch quantity must be positive", details={"item_index": idx, "dsp_qty": dsp_qty})

            po_item_id = item["po_item_id"]

            # Global Limit Check
            recon_row = db.execute(
                """
                SELECT poi.ord_qty, 
                       COALESCE((SELECT SUM(dsp_qty) FROM delivery_challan_items dci WHERE dci.po_item_id = poi.id), 0) as physical_dispatched
                FROM purchase_order_items poi
                WHERE poi.id = ?
                """,
                (po_item_id,),
            ).fetchone()

            if recon_row:
                global_ordered = recon_row[0]
                global_dispatched = recon_row[1]

                if exclude_dc:
                    current_dc_contribution = db.execute(
                        "SELECT COALESCE(SUM(dsp_qty), 0) FROM delivery_challan_items WHERE dc_number = ? AND po_item_id = ?",
                        (exclude_dc, po_item_id),
                    ).fetchone()[0]
                    global_dispatched -= current_dc_contribution

                remaining_global = global_ordered - global_dispatched
                if dsp_qty > remaining_global + 0.001:
                    raise BusinessRuleViolation(
                        f"Item {idx + 1}: Over-dispatch error (Physical Limit). Remaining: {remaining_global}.",
                        details={"item_index": idx, "dsp_qty": dsp_qty, "remaining": remaining_global},
                    )

    @staticmethod
    def check_document_linked(db: sqlite3.Connection, dc_number: str) -> Optional[str]:
        """
        Check if DC is linked to an invoice. Used to block edits/deletions.
        """
        invoice_row = db.execute(
            "SELECT invoice_number FROM gst_invoices WHERE dc_number = ? LIMIT 1",
            (dc_number,),
        ).fetchone()
        return invoice_row["invoice_number"] if invoice_row else None

    @staticmethod
    def validate_invoice_header(invoice_data: dict) -> None:
        """
        Validate invoice header fields
        """
        if not invoice_data.get("invoice_number") or invoice_data["invoice_number"].strip() == "":
            raise ValidationError("Invoice number is required")
        if not invoice_data.get("dc_number") or invoice_data["dc_number"].strip() == "":
            raise ValidationError("DC number is required")
        if not invoice_data.get("invoice_date") or invoice_data["invoice_date"].strip() == "":
            raise ValidationError("Invoice date is required")
        if not invoice_data.get("buyer_name") or invoice_data["buyer_name"].strip() == "":
            raise ValidationError("Buyer name is required")

    @staticmethod
    def validate_dispatch_qty(db: sqlite3.Connection, po_item_id: str, lot_no: int, dispatch_qty: float):
        """
        Validate that dispatch_qty <= pending_qty
        """
        item = db.execute("SELECT ord_qty, dsp_qty FROM purchase_order_items WHERE id = ?", (po_item_id,)).fetchone()

        if not item:
            raise ResourceNotFoundError("PO Item", po_item_id)

        pending = (item["ord_qty"] or 0) - (item["dsp_qty"] or 0)

        if dispatch_qty > (pending + 0.001):
            raise BusinessRuleViolation(f"Dispatch quantity ({dispatch_qty}) exceeds pending quantity ({pending})")
        return True

    @staticmethod
    def validate_po_exists(db: sqlite3.Connection, po_number: str) -> bool:
        """
        Check if PO exists in the system.
        """
        row = db.execute("SELECT 1 FROM purchase_orders WHERE po_number = ?", (po_number,)).fetchone()
        if not row:
            raise ResourceNotFoundError("PO", po_number)
        return True
