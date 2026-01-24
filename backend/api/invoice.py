"""
Production-Grade Invoice Router
Implements strict accounting rules with audit-safe transaction handling
"""

import logging
import sqlite3

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.core.date_utils import get_financial_year
from backend.core.errors import internal_error, not_found
from backend.core.exceptions import ValidationError
from backend.db.models import (
    InvoiceListItem,
    InvoiceStats,
    PaginatedMetadata,
    PaginatedResponse,
)
from backend.db.session import get_db, transactional
from backend.services.invoice import create_invoice as service_create_invoice
from backend.services.status_service import calculate_entity_status, calculate_pending_quantity
from backend.validation.validation import validate_unique_number

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================


class InvoiceItemCreate(BaseModel):
    po_item_no: str  # actual PO item number from the purchase order
    description: str
    quantity: float
    unit: str = "NO"
    rate: float
    hsn_sac: str | None = None
    no_of_packets: int | None = None


class EnhancedInvoiceCreate(BaseModel):
    invoice_number: str
    invoice_date: str

    # DC reference (required)
    dc_number: str

    # Supplier Details (Overrides)
    supplier_name: str | None = None
    supplier_address: str | None = None
    supplier_gstin: str | None = None
    supplier_contact: str | None = None

    # Buyer details (editable)
    buyer_name: str
    buyer_address: str | None = None
    buyer_gstin: str | None = None
    buyer_state: str | None = None
    buyer_state_code: str | None = None
    place_of_supply: str | None = None

    # Order details (from DC/PO, read-only on frontend)
    buyers_order_no: str | None = None
    buyers_order_date: str | None = None

    # Transport details
    vehicle_no: str | None = None
    lr_no: str | None = None
    transporter: str | None = None
    destination: str | None = None
    terms_of_delivery: str | None = None

    # Optional fields
    gemc_number: str | None = None
    gemc_date: str | None = None
    mode_of_payment: str | None = None
    payment_terms: str = "45 Days"
    despatch_doc_no: str | None = None
    srv_no: str | None = None
    srv_date: str | None = None
    remarks: str | None = None

    # Items with overrides
    items: list[InvoiceItemCreate] | None = None


# ============================================================================
# ENDPOINTS
# ============================================================================


@router.get("/stats", response_model=InvoiceStats)
def get_invoice_stats(db: sqlite3.Connection = Depends(get_db)):
    """Get Invoice Page Statistics"""
    try:
        total_row = db.execute("SELECT SUM(total_invoice_value) FROM gst_invoices").fetchone()
        total_invoiced = total_row[0] if total_row and total_row[0] else 0.0

        gst_row = db.execute("SELECT SUM(cgst + sgst + igst) FROM gst_invoices").fetchone()
        gst_collected = gst_row[0] if gst_row and gst_row[0] else 0.0

        return {
            "total_invoiced": total_invoiced,
            "pending_payments": 0.0,
            "gst_collected": gst_collected,
            "total_invoiced_change": 0.0,
            "gst_collected_change": 0.0,
            "pending_payments_count": 0,
        }
    except Exception as e:
        logger.error(f"Error fetching stats: {e}")
        return {
            "total_invoiced": 0,
            "pending_payments": 0,
            "gst_collected": 0,
            "total_invoiced_change": 0,
            "pending_payments_count": 0,
            "gst_collected_change": 0,
        }


@router.get("/", response_model=PaginatedResponse[InvoiceListItem])
def list_invoices(
    po: str | None = None,
    dc: str | None = None,
    limit: int = 100,
    offset: int = 0,
    sort_by: str = "created_at",
    order: str = "desc",
    search: str | None = None,
    db: sqlite3.Connection = Depends(get_db),
):
    """List all Invoices (Paginated)"""

    # Map frontend keys to DB columns
    sort_map = {
        "invoice_number": "inv.invoice_number",
        "invoice_date": "inv.invoice_date",
        "po_numbers": "inv.po_numbers",
        "dc_number": "inv.dc_number",
        "total_invoice_value": "inv.total_invoice_value",
        "created_at": "inv.created_at",
    }

    db_sort_col = sort_map.get(sort_by, "inv.created_at")
    db_order = "DESC" if order.lower() == "desc" else "ASC"

    # Base query components
    base_query = """
        FROM gst_invoices inv
        LEFT JOIN (
            SELECT dc_number, SUM(dsp_qty) as total_dsp_qty
            FROM delivery_challan_items
            GROUP BY dc_number
        ) dci_agg ON inv.dc_number = dci_agg.dc_number
        LEFT JOIN (
            SELECT challan_no, SUM(rcd_qty) as total_rcd_qty
            FROM srv_items
            GROUP BY challan_no
        ) srv_agg ON inv.dc_number = srv_agg.challan_no
    """

    where_clauses = ["1=1"]
    params = []

    if po:
        where_clauses.append("inv.po_numbers LIKE ?")
        params.append(f"%{po}%")

    if dc:
        where_clauses.append("inv.dc_number = ?")
        params.append(dc)

    if search:
        where_clauses.append("(inv.invoice_number LIKE ? OR inv.po_numbers LIKE ? OR inv.dc_number LIKE ? OR inv.buyer_name LIKE ?)")
        params.extend([f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%"])

    where_stmt = " WHERE " + " AND ".join(where_clauses)

    # Get total count
    count_query = f"SELECT COUNT(DISTINCT inv.invoice_number) {base_query} {where_stmt}"
    total_count = db.execute(count_query, params).fetchone()[0]

    # Main data query
    query = f"""
        SELECT 
            inv.invoice_number, inv.invoice_date, inv.po_numbers, inv.dc_number,
            inv.buyer_gstin as customer_gstin, inv.taxable_value, inv.total_invoice_value, inv.created_at,
            (SELECT COUNT(*) FROM gst_invoice_items WHERE invoice_number = inv.invoice_number) as total_items,
            (SELECT COALESCE(SUM(quantity), 0) FROM gst_invoice_items WHERE invoice_number = inv.invoice_number) as total_ord_qty,
            COALESCE(dci_agg.total_dsp_qty, 0) as total_dsp_qty,
            COALESCE(srv_agg.total_rcd_qty, 0) as total_rcd_qty
        {base_query}
        {where_stmt}
        GROUP BY inv.invoice_number
        ORDER BY {db_sort_col} {db_order}
        LIMIT ? OFFSET ?
    """

    rows = db.execute(query, params + [limit, offset]).fetchall()

    results = []
    for row in rows:
        row_dict = dict(row)
        total_ord_qty = row_dict["total_ord_qty"]
        total_rcd_qty = row_dict["total_rcd_qty"]
        total_dsp_qty = row_dict["total_dsp_qty"]

        row_dict["total_pending_qty"] = calculate_pending_quantity(total_ord_qty, total_rcd_qty)
        row_dict["status"] = calculate_entity_status(total_ord_qty, total_dsp_qty, total_rcd_qty)

        results.append(InvoiceListItem(**row_dict))

    return PaginatedResponse(items=results, metadata=PaginatedMetadata(total_count=total_count, page=(offset // limit) + 1, limit=limit))


@router.get("/export-list")
def export_invoices_list(
    po: int | None = None,
    dc: str | None = None,
    db: sqlite3.Connection = Depends(get_db),
):
    """Export Invoice List as simple CSV (Matches UI List View)"""
    import csv
    import io

    from starlette.responses import StreamingResponse

    # Reuse list logic
    data = list_invoices(po, dc, db)

    # UI Columns: Invoice#, Date, Linked DCs, Linked POs, Items, Delivered, Value, Status
    headers = ["Invoice #", "Date", "Linked DCs", "Linked POs", "Items Count", "Delivered Qty", "Value", "Status", "Pending Qty"]

    def iter_csv():
        output = io.StringIO()
        writer = csv.writer(output)
        output.write("\ufeff")
        writer.writerow(headers)
        output.seek(0)
        yield output.read()
        output.truncate(0)
        output.seek(0)

        for inv in data:
            row = [
                inv.invoice_number,
                inv.invoice_date,
                inv.dc_number,
                inv.po_numbers,
                inv.total_items,
                inv.total_dsp_qty,
                inv.total_invoice_value,
                inv.status,
                inv.total_pending_qty,
            ]
            writer.writerow(row)
            output.seek(0)
            yield output.read()
            output.truncate(0)
            output.seek(0)

    filename = "Invoice_List_Export.csv"
    return StreamingResponse(iter_csv(), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={filename}"})


@router.get("/{invoice_number:path}/download")
def download_invoice_excel(invoice_number: str, db: sqlite3.Connection = Depends(get_db)):
    """Download Invoice as Excel"""
    try:
        data = get_invoice_detail(invoice_number, db)
        from backend.services.excel_service import ExcelService

        # Custom Logic: Check for User Preference Path
        save_path = None
        try:
            row = db.execute("SELECT invoice FROM user_download_prefs ORDER BY id DESC LIMIT 1").fetchone()
            if row and row["invoice"]:
                save_path = row["invoice"]
        except Exception as e:
            logger.warning(f"Failed to fetch download prefs: {e}")

        return ExcelService.generate_exact_invoice_excel(data["header"], data["items"], db, save_path=save_path)
    except Exception as e:
        raise internal_error(f"Failed to generate Excel: {e!s}", e) from e


@router.get("/preview/{dc_number}")
def preview_invoice(dc_number: str, db: sqlite3.Connection = Depends(get_db)):
    """
    Generate Invoice Preview from DC (Lean Endpoint)
    Replaces heavy client-side aggregation.
    """
    from backend.services.invoice import generate_invoice_preview

    result = generate_invoice_preview(dc_number, db)
    if result.success:
        return result.data
    else:
        # Map service errors to HTTP exceptions
        # Assuming result.message contains user-friendly error
        # Ideally we map ErrorCode to HTTP status (404, 409 etc)
        # For now, strict 500/400 separation:
        raise internal_error(result.message)


@router.get("/{invoice_number:path}")
def get_invoice_detail(invoice_number: str, db: sqlite3.Connection = Depends(get_db)):
    """Get Invoice detail with optimized data retrieval"""

    invoice_row = db.execute(
        """
        SELECT 
            invoice_number, invoice_date, financial_year, dc_number,
            po_numbers, buyer_name, buyer_gstin, buyer_address,
            buyer_state, buyer_state_code, place_of_supply,
            buyers_order_date, taxable_value, cgst, sgst, igst,
            total_invoice_value, gemc_number, gemc_date,
            mode_of_payment, payment_terms, despatch_doc_no,
            srv_no, srv_date, vehicle_no, lr_no, transporter,
            destination, terms_of_delivery, remarks,
            created_at, updated_at
        FROM gst_invoices 
        WHERE invoice_number = ?
        """,
        (invoice_number,),
    ).fetchone()

    if not invoice_row:
        raise not_found(f"Invoice {invoice_number} not found", "Invoice")

    header_dict = dict(invoice_row)
    header_dict["buyers_order_no"] = header_dict.get("po_numbers")

    if not header_dict.get("buyers_order_date"):
        header_dict["buyers_order_date"] = header_dict.get("po_date")

    # Fetch DC date
    if header_dict.get("dc_number"):
        dc_row = db.execute(
            "SELECT dc_date FROM delivery_challans WHERE dc_number = ?",
            (header_dict["dc_number"],),
        ).fetchone()
        if dc_row:
            header_dict["dc_date"] = dc_row["dc_date"]

    # Optimized aggregate for status
    agg = db.execute(
        """
        SELECT 
            COALESCE(SUM(inv_item.quantity), 0) as total_ord,
            (SELECT COALESCE(SUM(dsp_qty), 0) FROM delivery_challan_items WHERE dc_number = i.dc_number) as total_del,
            (
                SELECT COALESCE(SUM(si.rcd_qty), 0)
                FROM srv_items si
                WHERE si.challan_no = i.dc_number
            ) as total_recd
        FROM gst_invoices i
        LEFT JOIN gst_invoice_items inv_item ON i.invoice_number = inv_item.invoice_number
        WHERE i.invoice_number = ?
        GROUP BY i.invoice_number
    """,
        (invoice_number,),
    ).fetchone()

    if agg:
        header_dict["status"] = calculate_entity_status(agg["total_ord"], agg["total_del"], agg["total_recd"])
    else:
        header_dict["status"] = "Pending"

    # Default buyer details from settings
    settings_rows = db.execute("SELECT key, value FROM settings").fetchall()
    settings = {row["key"]: row["value"] for row in settings_rows}

    for field, key in [
        ("buyer_name", "buyer_name"),
        ("buyer_address", "buyer_address"),
        ("buyer_gstin", "buyer_gstin"),
        ("buyer_state", "buyer_state"),
        ("place_of_supply", "buyer_place_of_supply"),
    ]:
        if not header_dict.get(field):
            header_dict[field] = settings.get(key, "")

    # Fetch items - use stored description directly (already populated during invoice creation)
    items_rows = db.execute(
        """
        SELECT 
            inv_item.po_item_no,
            COALESCE(NULLIF(inv_item.description, ''), 'No Description') as description,
            inv_item.material_code,
            inv_item.drg_no,
            inv_item.mtrl_cat,
            inv_item.hsn_sac,
            inv_item.unit,
            inv_item.rate,
            inv_item.quantity,
            inv_item.taxable_value,
            inv_item.cgst_amount,
            inv_item.sgst_amount,
            inv_item.igst_amount,
            inv_item.total_amount,
            inv_item.total_amount as amount
        FROM gst_invoice_items inv_item
        WHERE inv_item.invoice_number = ?
        ORDER BY inv_item.id
    """,
        (invoice_number,),
    ).fetchall()

    items = [dict(item) for item in items_rows]

    # Fetch linked DCs
    dc_links = []
    if header_dict.get("dc_number"):
        dc_rows = db.execute(
            """
            SELECT 
                dc_number, dc_date, po_number, department_no,
                financial_year, consignee_name, consignee_gstin,
                consignee_address, inspection_company, eway_bill_no,
                vehicle_no, lr_no, transporter, mode_of_transport,
                remarks, our_ref, gc_number, gc_date, created_at
            FROM delivery_challans 
            WHERE dc_number = ?
            """,
            (header_dict["dc_number"],),
        ).fetchall()
        dc_links = [dict(dc) for dc in dc_rows]

    return {"header": header_dict, "items": items, "linked_dcs": dc_links}


@router.post("/")
@transactional
def create_invoice(request: EnhancedInvoiceCreate, db: sqlite3.Connection = Depends(get_db)):
    """Create Invoice from Delivery Challan with transaction safety"""

    # Input Validation
    if not request.items:
        raise ValidationError("At least one item is required")

    invoice_data = request.dict()

    # Validate FY Uniqueness
    fy = get_financial_year(request.invoice_date)
    validate_unique_number(db, "gst_invoices", "invoice_number", "financial_year", request.invoice_number, fy)

    result = service_create_invoice(invoice_data, db)
    if result.success:
        return result.data
    else:
        raise internal_error(result.message)


@router.delete("/{invoice_number}")
@transactional
def delete_invoice(invoice_number: str, db: sqlite3.Connection = Depends(get_db)):
    """Delete an Invoice"""
    from backend.services.invoice import delete_invoice as service_delete_invoice

    result = service_delete_invoice(invoice_number, db)
    if result.success:
        return result.data
    else:
        raise internal_error(result.message)
