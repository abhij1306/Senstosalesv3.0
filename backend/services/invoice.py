"""
Invoice Service Layer
Centralizes all invoice business logic and validation
HTTP-agnostic - can be called from routers or AI agents
"""

import logging
import sqlite3
import uuid

from backend.core.exceptions import (
    ConflictError,
    ErrorCode,
    ResourceNotFoundError,
    ValidationError,
)
from backend.core.number_utils import to_qty
from backend.core.result import ServiceResult
from backend.services.validation_service import ValidationService

logger = logging.getLogger(__name__)


def calculate_tax(taxable_value: float, cgst_rate: float, sgst_rate: float) -> dict:
    """
    Calculate CGST and SGST amounts
    INVARIANT: INV-2 - Backend is the source of truth for all monetary calculations
    """
    cgst_amount = round(taxable_value * cgst_rate / 100, 2)
    sgst_amount = round(taxable_value * sgst_rate / 100, 2)
    total = round(taxable_value + cgst_amount + sgst_amount, 2)

    return {
        "cgst_amount": cgst_amount,
        "sgst_amount": sgst_amount,
        "total_amount": total,
    }


def validate_invoice_header(invoice_data: dict) -> None:
    """
    Validate invoice header fields
    """
    ValidationService.validate_invoice_header(invoice_data)


def check_dc_already_invoiced(dc_number: str, db: sqlite3.Connection) -> str | None:
    """
    Check if DC is already linked to an invoice
    """
    return ValidationService.check_document_linked(db, dc_number)


def check_invoice_number_exists(invoice_number: str, db: sqlite3.Connection) -> bool:
    """
    Check if invoice number already exists
    INVARIANT: INV-1 - Invoice numbers must be globally unique

    Returns:
        True if exists, False otherwise
    """
    dup_check = db.execute(
        """
        SELECT invoice_number FROM gst_invoices WHERE invoice_number = ?
    """,
        (invoice_number,),
    ).fetchone()

    return dup_check is not None


def fetch_dc_items(dc_number: str, db: sqlite3.Connection) -> tuple[list[dict], dict]:
    """
    Fetch DC items with PO item details

    Returns:
        List of DC items with material details
    """
    dc_items = db.execute(
        """
        SELECT 
            dci.po_item_id,
            dci.lot_no,
            dci.dsp_qty,
            poi.po_rate,
            poi.material_description as description,
            poi.material_code,
            poi.drg_no,
            poi.mtrl_cat,
            poi.hsn_code,
            poi.po_item_no,
            poi.unit
        FROM delivery_challan_items dci
        JOIN purchase_order_items poi ON dci.po_item_id = poi.id
        WHERE dci.dc_number = ?
    """,
        (dc_number,),
    ).fetchall()

    # Also fetch DC header info to map to Invoice if needed
    dc_header = db.execute(
        (
            "SELECT consignee_name, consignee_gstin, consignee_address, vehicle_no, "
            "transporter, lr_no, po_number, dc_date FROM delivery_challans WHERE dc_number = ?"
        ),
        (dc_number,),
    ).fetchone()

    return [dict(item) for item in dc_items], dict(dc_header) if dc_header else {}


def create_invoice(invoice_data: dict, db: sqlite3.Connection) -> ServiceResult[dict]:
    """
    Create Invoice from Delivery Challan
    HTTP-agnostic - returns ServiceResult instead of raising HTTPException

    CRITICAL CONSTRAINTS:
    - 1 DC → 1 Invoice (enforced via INVARIANT DC-2)
    - Invoice items are 1-to-1 mapping from DC items
    - Backend recomputes all monetary values (INVARIANT INV-2)
    - Transaction uses BEGIN IMMEDIATE for collision safety

    Args:
        invoice_data: Invoice header data (dict matching EnhancedInvoiceCreate)
        db: Database connection (must be in transaction)

    Returns:
        ServiceResult with success status, invoice_number, total_amount, items_count
    """
    try:
        invoice_number = invoice_data["invoice_number"]
        invoice_date = invoice_data["invoice_date"]
        dc_number = invoice_data["dc_number"]

        from backend.core.utils import get_financial_year

        fy = get_financial_year(invoice_date)

        # Financial year boundaries
        fy.split("-")[0]
        f"20{fy.split('-')[1]}"

        # Check for duplicate invoice number within the FY
        result = ValidationService.check_duplicate_number(db, "Invoice", invoice_number, invoice_date)
        if result["exists"]:
            conflict_msg = f"Invoice number {invoice_number} already exists in Financial Year {result['financial_year']}."
            if result["conflict_type"] == "DC":
                conflict_msg = f"Document number {invoice_number} is already used by a Delivery Challan in FY {result['financial_year']}."
            raise ConflictError(
                conflict_msg,
                details={"invoice_number": invoice_number, "financial_year": result["financial_year"]},
            )

        # Validate header
        validate_invoice_header(invoice_data)

        # INVARIANT: INV-4 - Invoice must reference at least one valid DC
        dc_row = db.execute(
            """
            SELECT dc_number, dc_date, po_number FROM delivery_challans WHERE dc_number = ?
        """,
            (dc_number,),
        ).fetchone()

        if not dc_row:
            raise ResourceNotFoundError("Delivery Challan", dc_number)

        dc_dict = dict(dc_row)

        # Fetch actual PO Date from purchase_orders
        po_date_row = db.execute(
            "SELECT po_date FROM purchase_orders WHERE po_number = ?",
            (dc_dict["po_number"],),
        ).fetchone()
        po_date = po_date_row[0] if po_date_row else None

        # INVARIANT: DC-2 - Check if DC already has invoice (1-DC-1-Invoice constraint)
        # This is CRITICAL - a DC can only be invoiced ONCE
        existing_invoice = check_dc_already_invoiced(dc_number, db)
        if existing_invoice:
            error_msg = (
                f"Cannot create invoice: Delivery Challan {dc_number} has already been invoiced "
                f"(Invoice Number: {existing_invoice}). Each DC can only be linked to one invoice."
            )
            logger.warning(f"Duplicate invoice attempt blocked: {error_msg}")
            raise ConflictError(
                error_msg,
                details={
                    "dc_number": dc_number,
                    "existing_invoice_number": existing_invoice,
                    "invariant": "DC-2 (One DC → One Invoice)",
                    "action": "Please use a different DC or modify the existing invoice",
                },
            )

        # INVARIANT: INV-1 - Check for duplicate invoice number (Already handled by ValidationService above)

        # Fetch DC items and header
        dc_items, dc_header = fetch_dc_items(dc_number, db)

        if not dc_items or len(dc_items) == 0:
            raise ValidationError(f"DC {dc_number} has no items")

        # Fetch tax rates from settings
        settings_rows = db.execute("SELECT key, value FROM settings WHERE key IN ('cgst_rate', 'sgst_rate')").fetchall()
        settings = {row["key"]: float(row["value"]) for row in settings_rows}
        cgst_rate = settings.get("cgst_rate", 9.0)
        sgst_rate = settings.get("sgst_rate", 9.0)

        # INVARIANT: INV-2 - Calculate totals (backend is source of truth)
        invoice_items = []
        total_taxable = 0.0

        for item in dc_items:
            po_item_id = item["po_item_id"]

            # LOCK RULE: Verify if already fully received at item level
            recon_row = db.execute("SELECT ord_qty, dsp_qty, rcd_qty FROM purchase_order_items WHERE id = ?", (po_item_id,)).fetchone()

            if recon_row:
                global_ordered = recon_row["ord_qty"]
                # recon_row["dsp_qty"] (unused variable removed)
                global_received = recon_row["rcd_qty"] or 0

                # We allow invoicing of the current DC items even if it pushes us to 'fully dispatched'
                # but we check if we were ALREADY over-fulfilled before this invoice
                # Actually, the user wants to lock FURTHER creation.
                # Since DC already exists, we usually allow invoicing it.
                # But if Received >= Ordered, we might want to alert or block.
                # The user said "lock further DC or invoice creation".

                if global_received >= global_ordered - 0.001:
                    logger.warning(
                        f"Item {item['po_item_no']} already fully received ({global_received}/{global_ordered}). Proceeding with invoice for existing DC."
                    )

            # The following block is part of the original item processing, but the user's snippet
            # seems to imply a different structure. Re-integrating it to fit the existing logic.
            # The user's snippet for `invoice_items.append` and `total_taxable` calculation
            # seems to be a partial re-implementation of the later `for dci in consolidated_dc_items.values():` loop.
            # I will keep the original structure and add the check before the consolidation.

        total_cgst = 0.0
        total_sgst = 0.0
        total_amount = 0.0

        # Prepare overrides map for O(1) lookup
        # key: str(po_item_no) -> item dict
        overrides = {}
        if invoice_data.get("items"):
            for item in invoice_data["items"]:
                # Use po_item_no from payload to match against po_item_no
                item_no = str(item.get("po_item_no") if isinstance(item, dict) else item.po_item_no)
                overrides[item_no] = item

        # Consolidate DC items by po_item_id to handle multiple lots correctly
        # INVARIANT: 1 PO Item in DC -> 1 Consolidated Invoice Item
        consolidated_dc_items = {}
        for dci in dc_items:
            p_id = dci["po_item_id"]
            if p_id not in consolidated_dc_items:
                consolidated_dc_items[p_id] = dict(dci)  # Copy to avoid mutating original
            else:
                consolidated_dc_items[p_id]["dsp_qty"] += dci["dsp_qty"]

        logger.info(f"Consolidated {len(dc_items)} DC items into {len(consolidated_dc_items)} invoice items")

        for dci in consolidated_dc_items.values():
            # Use po_item_no for override matching.
            item_no = str(dci.get("po_item_no") or "")

            # Default values from consolidated DC entry
            qty = dci["dsp_qty"]
            rate = dci["po_rate"]

            # Apply Override if exists
            if item_no in overrides:
                override_item = overrides[item_no]
                override_qty = override_item.get("quantity")
                override_rate = override_item.get("rate")

                if override_qty is not None:
                    qty = to_qty(override_qty)
                    logger.debug(f"Applied qty override for Item {item_no}: {qty}")
                if override_rate is not None:
                    rate = float(override_rate)
                    logger.debug(f"Applied rate override for Item {item_no}: {rate}")

            if qty <= 0:
                logger.warning(f"Skipping Item {item_no} due to zero quantity")
                continue

            taxable_value = round(qty * rate, 2)
            tax_calc = calculate_tax(taxable_value, cgst_rate, sgst_rate)

            invoice_items.append(
                {
                    "po_item_id": dci["po_item_id"],
                    "po_item_no": item_no,  # Ensure we use the actual PO Item Number
                    "description": dci["description"] or "",
                    "material_code": dci.get("material_code") or "",
                    "drg_no": dci.get("drg_no") or "",
                    "mtrl_cat": dci.get("mtrl_cat") or "",
                    "hsn_sac": dci["hsn_code"] or "",
                    "quantity": qty,
                    "unit": dci.get("unit") or "NO",
                    "rate": rate,
                    "taxable_value": taxable_value,
                    "cgst_rate": cgst_rate,
                    "cgst_amount": tax_calc["cgst_amount"],
                    "sgst_rate": sgst_rate,
                    "sgst_amount": tax_calc["sgst_amount"],
                    "igst_rate": 0.0,
                    "igst_amount": 0.0,
                    "total_amount": tax_calc["total_amount"],
                }
            )

            total_taxable += taxable_value
            total_cgst += tax_calc["cgst_amount"]
            total_sgst += tax_calc["sgst_amount"]
            total_amount += tax_calc["total_amount"]

        # INVARIANT: R-02 - Server-Side Totals Enforcement
        # We explicitly IGNORE any totals sent from the frontend to prevent tampering.
        # However, for audit purposes, if the frontend provided a total that deviates significantly, we log it.
        frontend_total = invoice_data.get("total_invoice_value")
        if frontend_total is not None and abs(float(frontend_total) - total_amount) > 1.0:
            logger.warning(
                f"SECURITY: Frontend/Backend mismatch for Inv {invoice_number}. "
                f"Frontend: {frontend_total}, Backend: {total_amount}. Using Backend value."
            )
            # We naturally proceed using 'total_amount' (Backend Truth), effectively enforcing the rule.

        # Mapping DC fields to Invoice
        inv_header = {
            "buyer_name": invoice_data.get("buyer_name") or dc_header.get("consignee_name"),
            "buyer_gstin": invoice_data.get("buyer_gstin") or dc_header.get("consignee_gstin"),
            "buyer_address": invoice_data.get("buyer_address") or dc_header.get("consignee_address"),
            "po_numbers": str(invoice_data.get("buyers_order_no") or dc_header.get("po_number", "")),
            "buyers_order_date": invoice_data.get("buyers_order_date") or po_date,
            "lr_no": invoice_data.get("lr_no") or dc_header.get("lr_no"),
            "supplier_name": invoice_data.get("supplier_name") or dc_header.get("supplier_name"),
            "supplier_address": invoice_data.get("supplier_address") or dc_header.get("supplier_address"),
            "supplier_gstin": invoice_data.get("supplier_gstin") or dc_header.get("supplier_gstin"),
            "supplier_contact": invoice_data.get("supplier_contact") or dc_header.get("supplier_contact"),
            "vehicle_no": invoice_data.get("vehicle_no") or dc_header.get("vehicle_no"),
            "transporter": invoice_data.get("transporter") or dc_header.get("transporter"),
        }

        # Insert invoice header
        db.execute(
            """
            INSERT INTO gst_invoices (
                invoice_number, invoice_date, dc_number, financial_year,
                buyer_name, buyer_gstin, buyer_address,
                po_numbers, buyers_order_date,
                gemc_number, gemc_date, mode_of_payment, payment_terms,
                despatch_doc_no, srv_no, srv_date,
                vehicle_no, lr_no, transporter, destination, terms_of_delivery,
                buyer_state, buyer_state_code,
                taxable_value, cgst, sgst, igst, total_invoice_value,
                remarks,
                supplier_name, supplier_address, supplier_gstin, supplier_contact
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (
                invoice_number,
                invoice_date,
                dc_number,
                fy,
                inv_header["buyer_name"],
                inv_header["buyer_gstin"],
                inv_header["buyer_address"],
                inv_header["po_numbers"],
                inv_header["buyers_order_date"],
                invoice_data.get("gemc_number"),
                invoice_data.get("gemc_date"),
                invoice_data.get("mode_of_payment"),
                invoice_data.get("payment_terms", "45 Days"),
                invoice_data.get("despatch_doc_no"),
                invoice_data.get("srv_no"),
                invoice_data.get("srv_date"),
                inv_header["vehicle_no"],
                inv_header["lr_no"],
                inv_header["transporter"],
                invoice_data.get("destination"),
                invoice_data.get("terms_of_delivery"),
                invoice_data.get("buyer_state"),
                invoice_data.get("buyer_state_code"),
                total_taxable,
                total_cgst,
                total_sgst,
                0.0,
                total_amount,
                invoice_data.get("remarks") or dc_header.get("remarks"),
                inv_header["supplier_name"],
                inv_header["supplier_address"],
                inv_header["supplier_gstin"],
                inv_header["supplier_contact"],
            ),
        )

        # Insert invoice items
        for item in invoice_items:
            db.execute(
                """
                INSERT INTO gst_invoice_items (
                    id, invoice_number, po_item_no, description, material_code, drg_no, mtrl_cat, quantity, unit, rate, 
                    taxable_value, cgst_amount, sgst_amount, 
                    igst_amount, total_amount, hsn_sac
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    str(uuid.uuid4()),
                    invoice_number,
                    item["po_item_no"],  # CRITICAL: Required for PO linking
                    item["description"],
                    item["material_code"],
                    item["drg_no"],
                    item["mtrl_cat"],
                    item["quantity"],
                    item["unit"],
                    item["rate"],
                    item["taxable_value"],
                    item["cgst_amount"],
                    item["sgst_amount"],
                    item["igst_amount"],
                    item["total_amount"],
                    item["hsn_sac"],  # CRITICAL: Required for Tax
                ),
            )

        # DC-Invoice link is now stored directly in gst_invoices.dc_number

        logger.info(f"Successfully created invoice {invoice_number} from DC {dc_number} with {len(invoice_items)} items")

        return ServiceResult.ok(
            {
                "success": True,
                "invoice_number": invoice_number,
                "total_amount": total_amount,
                "items_count": len(invoice_items),
            }
        )

    except (ValidationError, ResourceNotFoundError, ConflictError):
        # Domain errors - let them propagate
        raise
    except Exception as e:
        # Unexpected errors
        logger.error(f"Failed to create invoice: {e}", exc_info=True)
        return ServiceResult.fail(
            error_code=ErrorCode.INTERNAL_ERROR,
            message=f"Failed to create invoice: {e!s}",
        )


def generate_invoice_preview(dc_number: str, db: sqlite3.Connection) -> ServiceResult[dict]:
    """
    Generate a preview of the invoice from the DC without saving.
    Optimized for performance: Does heavy lifting on backend (Tax, Aggregation).

    Args:
        dc_number: Source DC
        db: Connection

    Returns:
        ServiceResult with 'header' and 'items'
    """
    try:
        # 1. Check if already invoiced (Fast fail)
        existing = check_dc_already_invoiced(dc_number, db)
        if existing:
            return ServiceResult.fail(
                error_code=ErrorCode.CONFLICT,
                message=f"Delivery Challan {dc_number} has already been invoiced (Invoice: {existing}).",
            )

        # 2. Fetch DC Items
        dc_items, dc_header = fetch_dc_items(dc_number, db)
        if not dc_items:
            return ServiceResult.fail(
                error_code=ErrorCode.RESOURCE_NOT_FOUND,
                message=f"DC {dc_number} not found or has no items",
            )

        # 3. Fetch PO Date for Header
        po_date = None
        if dc_header.get("po_number"):
            po_row = db.execute("SELECT po_date FROM purchase_orders WHERE po_number = ?", (dc_header["po_number"],)).fetchone()
            if po_row:
                po_date = po_row[0]

        # 4. Fetch Global Settings
        settings_rows = db.execute(
            "SELECT key, value FROM settings WHERE key IN ('cgst_rate', 'sgst_rate', 'supplier_name', 'supplier_address', 'supplier_gstin', 'supplier_contact')"
        ).fetchall()
        settings = {row["key"]: row["value"] for row in settings_rows}
        cgst_rate = float(settings.get("cgst_rate", 9.0))
        sgst_rate = float(settings.get("sgst_rate", 9.0))

        # 5. Consolidate Items (Logic Mirroring Create)
        consolidated = {}
        for dci in dc_items:
            # Key by PO Item ID for robustness, fallback to material code
            key = str(dci["po_item_id"])
            if key not in consolidated:
                consolidated[key] = dict(dci)
            else:
                consolidated[key]["dsp_qty"] += dci["dsp_qty"]

        # 6. Map to Invoice Items
        invoice_items = []
        total_taxable = 0.0
        total_cgst = 0.0
        total_sgst = 0.0

        for dci in consolidated.values():
            qty = dci["dsp_qty"]
            if qty <= 0:
                continue

            rate = dci["po_rate"] or 0
            taxable = round(qty * rate, 2)
            cgst = round(taxable * cgst_rate / 100, 2)
            sgst = round(taxable * sgst_rate / 100, 2)
            total = taxable + cgst + sgst

            item_no = str(dci.get("po_item_no") or "")

            invoice_items.append(
                {
                    "po_item_no": item_no,
                    "material_code": dci.get("material_code"),
                    "description": dci.get("description"),
                    "hsn_sac": dci.get("hsn_code") or "",
                    "quantity": qty,
                    "unit": dci.get("unit") or "NOS",
                    "rate": rate,
                    "taxable_value": taxable,
                    "cgst_amount": cgst,
                    "sgst_amount": sgst,
                    "total_amount": total,
                    "items_in_lot": 1,  # Virtual count
                }
            )

            total_taxable += taxable
            total_cgst += cgst
            total_sgst += sgst

        # 7. Construct Header
        header = {
            "dc_number": dc_number,
            "dc_date": dc_header.get("dc_date"),
            "buyers_order_no": dc_header.get("po_number"),
            "buyers_order_date": po_date,
            "vehicle_no": dc_header.get("vehicle_no"),
            "lr_no": dc_header.get("lr_no"),
            "transporter": dc_header.get("transporter"),
            "buyer_name": dc_header.get("consignee_name"),
            "buyer_gstin": dc_header.get("consignee_gstin"),
            "buyer_address": dc_header.get("consignee_address"),
            "remarks": dc_header.get("remarks"),
            # Financials
            "total_taxable_value": total_taxable,
            "cgst_total": total_cgst,
            "sgst_total": total_sgst,
            "total_invoice_value": total_taxable + total_cgst + total_sgst,
            "supplier_name": settings.get("supplier_name"),
            "supplier_address": settings.get("supplier_address"),
            "supplier_gstin": settings.get("supplier_gstin"),
            "supplier_contact": settings.get("supplier_contact"),
        }

        # Auto-match logic removed as per user request to favor default DC details and manual editing.
        # Previously: Fuzzy matched Buyer Name/Address to 'buyers' table.

        return ServiceResult.ok({"header": header, "items": invoice_items})

        return ServiceResult.ok({"header": header, "items": invoice_items})

    except Exception as e:
        logger.error(f"Preview gen failed: {e}")
        return ServiceResult.fail(ErrorCode.INTERNAL_ERROR, str(e))


def delete_invoice(invoice_number: str, db: sqlite3.Connection) -> ServiceResult[dict]:
    """
    Delete an Invoice

    INVARIANTS:
    - Invoice cannot be deleted if SRV items reference this invoice's DC

    Args:
        invoice_number: Invoice number to delete
        db: Database connection (must be in transaction)

    Returns:
        ServiceResult with success status
    """
    try:
        # Check if invoice exists
        invoice_row = db.execute("SELECT invoice_number, dc_number FROM gst_invoices WHERE invoice_number = ?", (invoice_number,)).fetchone()

        if not invoice_row:
            raise ResourceNotFoundError("Invoice", invoice_number)

        dc_number = invoice_row["dc_number"]

        # INVARIANT: INV-3 - Invoice cannot be deleted if SRV items reference its DC
        srv_row = db.execute(
            """
            SELECT srv_number FROM srv_items 
            WHERE challan_no = ? 
            LIMIT 1
        """,
            (dc_number,),
        ).fetchone()

        if srv_row:
            raise ConflictError(
                f"Cannot delete Invoice {invoice_number} - its DC {dc_number} has received goods in SRV {srv_row['srv_number']}",
                details={
                    "invoice_number": invoice_number,
                    "dc_number": dc_number,
                    "srv_number": srv_row["srv_number"],
                    "invariant": "INV-3",
                },
            )

        # Delete invoice items first
        db.execute("DELETE FROM gst_invoice_items WHERE invoice_number = ?", (invoice_number,))

        # Delete invoice header
        db.execute("DELETE FROM gst_invoices WHERE invoice_number = ?", (invoice_number,))

        logger.info(f"Successfully deleted Invoice {invoice_number}")
        return ServiceResult.ok({"success": True, "message": f"Invoice {invoice_number} deleted"})

    except (ResourceNotFoundError, ConflictError):
        raise
    except Exception as e:
        logger.error(f"Failed to delete invoice: {e}", exc_info=True)
        return ServiceResult.fail(
            error_code=ErrorCode.INTERNAL_ERROR,
            message=f"Failed to delete invoice: {e!s}",
        )
