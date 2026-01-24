"""
Delivery Challan Router
"""

import logging
import sqlite3

from fastapi import APIRouter, Depends

from backend.core.errors import internal_error, not_found
from backend.core.exceptions import (
    ValidationError,
)
from backend.db.models import (
    DCCreate,
    DCListItem,
    DCStats,
    PaginatedMetadata,
    PaginatedResponse,
)
from backend.db.session import get_db, transactional
from backend.services.dc import (
    check_dc_has_invoice,
)
from backend.services.dc import (
    create_dc as service_create_dc,
)
from backend.services.dc import (
    update_dc as service_update_dc,
)
from backend.services.status_service import calculate_entity_status

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/po/{po_number}/dispatchable-items")
def get_dispatchable_items(po_number: str, db: sqlite3.Connection = Depends(get_db)):
    """
    P1 PERFORMANCE FIX: Lean endpoint for DC Generation page.
    Returns ONLY dispatchable items with pre-computed balances.
    Single optimized SQL query - no N+1 problem.
    """
    try:
        query = """
            SELECT 
                poi.id as po_item_id,
                poi.po_item_no,
                poi.material_code,
                poi.material_description as description,
                poi.drg_no,
                poi.mtrl_cat,
                poi.unit,
                poi.po_rate,
                -- Use item-level quantities directly (no lot aggregation)
                poi.ord_qty,
                poi.dsp_qty,
                poi.rcd_qty
            FROM purchase_order_items poi
            WHERE poi.po_number = ?
            ORDER BY poi.po_item_no
        """

        rows = db.execute(query, (po_number,)).fetchall()

        # Filter to only items with remaining balance (computed in Python)
        items = []
        for row in rows:
            ordered = row["ord_qty"] or 0
            dispatched = row["dsp_qty"] or 0
            received = row["rcd_qty"] or 0

            # Balance for DC creation: how much is left to ship?
            balance = max(0, ordered - dispatched)

            if balance > 0:
                items.append(
                    {
                        "id": str(row["po_item_id"]),  # Use PO Item ID as unique key
                        "po_item_id": row["po_item_id"],
                        "po_item_no": row["po_item_no"],
                        "lot_no": None,  # Consolidated View
                        "material_code": row["material_code"] or "",
                        "description": row["description"] or "",
                        "drg_no": row["drg_no"] or "",
                        "mtrl_cat": row["mtrl_cat"],
                        "unit": row["unit"] or "NOS",
                        "po_rate": row["po_rate"] or 0,
                        "ord_qty": ordered,
                        "dsp_qty": dispatched,
                        "rcd_qty": received,
                        "balance_quantity": balance,
                    }
                )

        # Fetch PO header for context (including DVN = department_no and our_ref)
        header = db.execute(
            """
            SELECT po_number, po_date, amend_no, department_no, our_ref, supplier_name, supplier_gstin, supplier_phone
            FROM purchase_orders WHERE po_number = ?
        """,
            (po_number,),
        ).fetchone()

        header_dict = dict(header) if header else None
        # Add empty consignee fields as defaults
        if header_dict:
            # P1 FIX: Fetch Default Consignee from Settings (or Fallback)
            try:
                setting_row = db.execute("SELECT value FROM settings WHERE key = 'default_consignee_name'").fetchone()
                default_consignee = setting_row["value"] if setting_row else "The Purchase Manager"
                header_dict["consignee_name"] = default_consignee
            except Exception:
                header_dict["consignee_name"] = "The Purchase Manager"

            # Default Address if empty
            if not header_dict.get("consignee_address"):
                header_dict["consignee_address"] = "Partner Engineering PSU\nLOCATION"

        return {"po_number": po_number, "header": header_dict, "items": items, "total_items": len(items)}
    except Exception as e:
        logger.error(f"dispatchable-items error: {e}", exc_info=True)
        raise


@router.get("/stats", response_model=DCStats)
def get_dc_stats(db: sqlite3.Connection = Depends(get_db)):
    """Get DC Page Statistics"""
    try:
        # Total Challans
        total_challans = db.execute("SELECT COUNT(*) FROM delivery_challans").fetchone()[0]

        # Completed (Linked to Invoice)
        completed = db.execute("""
            SELECT COUNT(DISTINCT dc_number) FROM gst_invoices WHERE dc_number IS NOT NULL
        """).fetchone()[0]

        # Total Value
        total_value = db.execute("""
            SELECT COALESCE(SUM(dci.dsp_qty * poi.po_rate), 0)
            FROM delivery_challan_items dci
            JOIN purchase_order_items poi ON dci.po_item_id = poi.id
        """).fetchone()[0]

        # Pending Calculation
        pending = max(0, total_challans - completed)

        return {
            "total_challans": total_challans,
            "total_challans_change": 0.0,
            "pending_delivery": pending,
            "completed_delivery": completed,
            "completed_change": 0.0,
            "total_value": total_value,
        }
    except Exception as e:
        logger.error(f"Failed to fetch DC stats: {e}", exc_info=e)
        raise internal_error("Failed to fetch DC statistics", e) from e


@router.get("/", response_model=PaginatedResponse[DCListItem])
def list_dcs(
    po: str | None = None,
    limit: int = 100,
    offset: int = 0,
    sort_by: str = "created_at",
    order: str = "desc",
    search: str | None = None,
    db: sqlite3.Connection = Depends(get_db),
):
    """List all Delivery Challans (Paginated)"""

    # Map frontend keys to DB columns
    sort_map = {
        "dc_number": "dc.dc_number",
        "dc_date": "dc.dc_date",
        "po_number": "dc.po_number",
        "consignee_name": "dc.consignee_name",
        "created_at": "dc.created_at",
        "total_value": "total_value",
    }

    db_sort_col = sort_map.get(sort_by, "dc.created_at")
    db_order = "DESC" if order.lower() == "desc" else "ASC"

    # Base query components
    base_query = """
        FROM delivery_challans dc
        LEFT JOIN delivery_challan_items dci ON dc.dc_number = dci.dc_number
        LEFT JOIN purchase_order_items poi ON dci.po_item_id = poi.id
        LEFT JOIN purchase_order_deliveries pod ON dci.po_item_id = pod.po_item_id AND dci.lot_no = pod.lot_no
        LEFT JOIN gst_invoices i ON dc.dc_number = i.dc_number
    """

    where_clauses = []
    params = []

    if po:
        where_clauses.append("dc.po_number = ?")
        params.append(po)

    if search:
        where_clauses.append("(dc.dc_number LIKE ? OR dc.po_number LIKE ? OR dc.consignee_name LIKE ?)")
        params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])

    where_stmt = " WHERE " + " AND ".join(where_clauses) if where_clauses else ""

    # Get total count
    count_query = f"SELECT COUNT(DISTINCT dc.dc_number) {base_query} {where_stmt}"
    total_count = db.execute(count_query, params).fetchone()[0]

    # Optimized aggregate query to prevent duplication
    query = f"""
        SELECT 
            dc.dc_number, 
            dc.dc_date, 
            dc.po_number, 
            dc.consignee_name, 
            dc.created_at,
            (SELECT i.invoice_number FROM gst_invoices i WHERE i.dc_number = dc.dc_number LIMIT 1) as invoice_number,
            COALESCE((
                SELECT SUM(dci.dsp_qty * poi.po_rate)
                FROM delivery_challan_items dci
                JOIN purchase_order_items poi ON dci.po_item_id = poi.id
                WHERE dci.dc_number = dc.dc_number
            ), 0) as total_value,
            COALESCE((
                SELECT SUM(poi.ord_qty)
                FROM delivery_challan_items dci
                JOIN purchase_order_items poi ON dci.po_item_id = poi.id
                WHERE dci.dc_number = dc.dc_number
            ), 0) as total_ord_qty,
            COALESCE((
                SELECT SUM(dci.dsp_qty)
                FROM delivery_challan_items dci
                WHERE dci.dc_number = dc.dc_number
            ), 0) as total_dsp_qty,
            (
                SELECT COALESCE(SUM(si.rcd_qty), 0)
                FROM srv_items si
                WHERE si.challan_no = dc.dc_number
            ) as total_rcd_qty,
            (
                SELECT COALESCE(SUM(all_dci.dsp_qty), 0)
                FROM delivery_challan_items all_dci
                JOIN delivery_challan_items sub_dci ON all_dci.po_item_id = sub_dci.po_item_id
                WHERE sub_dci.dc_number = dc.dc_number
            ) as global_dsp_qty
        FROM delivery_challans dc
        {where_stmt}
        ORDER BY {db_sort_col} {db_order}
        LIMIT ? OFFSET ?
    """

    rows = db.execute(query, params + [limit, offset]).fetchall()

    results = []
    for row in rows:
        total_ordered = row["total_ord_qty"] or 0
        total_dispatched_this_dc = row["total_dsp_qty"] or 0
        total_received_this_dc = row["total_rcd_qty"] or 0
        global_dispatched = row["global_dsp_qty"] or 0

        total_pending = max(0, total_ordered - global_dispatched)
        status = calculate_entity_status(total_dispatched_this_dc, total_dispatched_this_dc, total_received_this_dc)

        results.append(
            DCListItem(
                dc_number=row["dc_number"],
                dc_date=row["dc_date"],
                po_number=row["po_number"],
                consignee_name=row["consignee_name"],
                status=status,
                total_value=row["total_value"],
                created_at=row["created_at"],
                total_ord_qty=total_ordered,
                total_dsp_qty=total_dispatched_this_dc,
                total_pending_qty=total_pending,
                total_rcd_qty=total_received_this_dc,
                invoice_number=row["invoice_number"],
            )
        )

    return PaginatedResponse(items=results, metadata=PaginatedMetadata(total_count=total_count, page=(offset // limit) + 1, limit=limit))


@router.get("/export-list")
def export_dcs_list(po: str | None = None, db: sqlite3.Connection = Depends(get_db)):
    """Export DC List as simple CSV (Matches UI List View)"""
    import csv
    import io

    # Reuse list logic to get data
    data = list_dcs(po, db)

    # Define CSV columns matching UI:
    # Record (DC#), Date, Contract (PO#), Consignee, Status, Value, Ord, Delivered, Pending, Received

    headers = ["Record", "Date", "Contract", "Consignee", "Status", "Value", "Ord Qty", "Delivered Qty", "Pending Qty", "Received Qty"]

    # Generate CSV in memory for saving/streaming
    output = io.StringIO()
    writer = csv.writer(output)

    # Write BOM for Excel compatibility
    output.write("\ufeff")

    writer.writerow(headers)

    for dc in data:
        row = [
            dc.dc_number,
            dc.dc_date,
            dc.po_number,
            dc.consignee_name,
            dc.status,
            dc.total_value,
            dc.total_ord_qty,
            dc.total_dsp_qty,
            dc.total_pending_qty,
            dc.total_rcd_qty,
        ]
        writer.writerow(row)

    # Convert to bytes for ExcelService
    csv_bytes = io.BytesIO(output.getvalue().encode("utf-8"))

    filename = f"DC_List_Export_{po or 'All'}.csv"

    # Check User Preference
    save_path = None
    try:
        from backend.api.reports import get_save_path

        save_path = get_save_path(db, "challan_summary")
    except ImportError:
        # Fallback if circular import or other issue, though models are separate
        row_pref = db.execute("SELECT challan_summary FROM user_download_prefs ORDER BY id DESC LIMIT 1").fetchone()
        if row_pref and row_pref["challan_summary"]:
            save_path = row_pref["challan_summary"]
    except Exception as e:
        logger.warning(f"Failed to fetch download prefs: {e}")

    from backend.services.excel_service import ExcelService

    return ExcelService._save_or_stream(csv_bytes, filename, save_path)


@router.get("/{dc_number}/invoice")
def check_dc_has_invoice_endpoint(dc_number: str, db: sqlite3.Connection = Depends(get_db)):
    """Check if DC has an associated GST Invoice"""
    invoice_number = check_dc_has_invoice(dc_number, db)

    if invoice_number:
        return {"has_invoice": True, "invoice_number": invoice_number}
    else:
        return {"has_invoice": False}


@router.get("/{dc_number}/download-gc")
def download_gc_excel(dc_number: str, db: sqlite3.Connection = Depends(get_db)):
    """Download Guarantee Certificate (GC) as Excel"""
    try:
        logger.info(f"Downloading GC Excel: {dc_number}")
        # Get full detail logic
        dc_data = get_dc_detail(dc_number, db)

        from backend.services.excel_service import ExcelService

        # User Preference for GC: 'gc' column
        save_path = None
        try:
            row = db.execute("SELECT gc FROM user_download_prefs ORDER BY id DESC LIMIT 1").fetchone()
            if row and row["gc"]:
                save_path = row["gc"]
        except Exception as e:
            logger.warning(f"Failed to fetch GC download prefs: {e}")

        # Use GC generator
        logger.info(f"Downloading GC Excel: {dc_number}")
        return ExcelService.generate_gc_excel(dc_data["header"], dc_data["items"], db, save_path=save_path)

    except Exception as e:
        raise internal_error(f"Failed to generate GC Excel: {e!s}", e) from e


@router.get("/{dc_number}/download")
def download_dc_excel(dc_number: str, db: sqlite3.Connection = Depends(get_db)):
    """Download DC as Excel"""
    try:
        logger.info(f"Downloading DC Excel: {dc_number}")
        # Get full detail logic
        dc_data = get_dc_detail(dc_number, db)
        logger.info(f"DC data fetched successfully for {dc_number}")

        from backend.services.excel_service import ExcelService

        # Custom Logic: Check for User Preference Path
        save_path = None
        try:
            row = db.execute("SELECT challan FROM user_download_prefs ORDER BY id DESC LIMIT 1").fetchone()
            if row and row["challan"]:
                save_path = row["challan"]
                logger.info(f"Using configured download path for DC: {save_path}")
        except Exception as e:
            logger.warning(f"Failed to fetch download prefs: {e}")

        # Use exact generator with optional save path
        return ExcelService.generate_exact_dc_excel(dc_data["header"], dc_data["items"], db, save_path=save_path)

    except Exception as e:
        raise internal_error(f"Failed to generate Excel: {e!s}", e) from e


@router.get("/{dc_number}")
def get_dc_detail(dc_number: str, db: sqlite3.Connection = Depends(get_db)):
    """Get Delivery Challan detail with items"""

    # Get DC header with PO Date
    dc_row = db.execute(
        """
        SELECT dc.*, po.po_date, po.department_no
        FROM delivery_challans dc
        LEFT JOIN purchase_orders po ON dc.po_number = po.po_number
        WHERE dc.dc_number = ?
    """,
        (dc_number,),
    ).fetchone()

    if not dc_row:
        raise not_found(f"Delivery Challan {dc_number} not found", "DC")

    header_dict = dict(dc_row)

    # POPULATE DEFAULTS FROM SETTINGS IF EMPTY
    try:
        settings_rows = db.execute("SELECT key, value FROM settings").fetchall()
        settings = {row["key"]: row["value"] for row in settings_rows}

        if not header_dict.get("consignee_name"):
            # Try Default Buyer first, then Settings
            header_dict["consignee_name"] = settings.get("default_consignee_name") or "The Purchase Manager"

        if not header_dict.get("consignee_address"):
            # Try Default Buyer first, then Settings
            default_buyer_addr = db.execute("SELECT address FROM buyers WHERE is_default = 1").fetchone()
            header_dict["consignee_address"] = default_buyer_addr["address"] if default_buyer_addr else "Partner Engineering PSU\nLOCATION"

        # Also populate Supplier details
        if not header_dict.get("supplier_name"):
            header_dict["supplier_name"] = settings.get("supplier_name", "")
        if not header_dict.get("supplier_phone"):
            header_dict["supplier_phone"] = settings.get("supplier_contact", "")
        if not header_dict.get("supplier_gstin"):
            header_dict["supplier_gstin"] = settings.get("supplier_gstin", "")

        # Check for existing invoice
        from backend.services.invoice import check_dc_already_invoiced

        header_dict["invoice_number"] = check_dc_already_invoiced(dc_number, db)

    except Exception as e:
        logger.warning(f"Failed to populate DC defaults from settings: {e}")

    # Calculate status per DC
    agg = db.execute(
        """
        SELECT 
            (SELECT SUM(poi.ord_qty) FROM delivery_challan_items dci JOIN purchase_order_items poi ON dci.po_item_id = poi.id WHERE dci.dc_number = ?) as total_ord,
            (SELECT SUM(dsp_qty) FROM delivery_challan_items WHERE dc_number = ?) as total_del,
            (
                SELECT COALESCE(SUM(si.rcd_qty), 0)
                FROM srv_items si
                JOIN srvs s ON si.srv_number = s.srv_number
                WHERE s.is_active = 1 
                  AND si.challan_no = ?
            ) as total_recd
    """,
        (dc_number, dc_number, dc_number),
    ).fetchone()

    if agg:
        t_ord = agg["total_ord"] or 0
        t_del = agg["total_del"] or 0
        t_recd = agg["total_recd"] or 0
        header_dict["status"] = calculate_entity_status(t_ord, t_del, t_recd)
    else:
        header_dict["status"] = "Pending"

    try:
        # Get DC items with PO item details
        items = db.execute(
            """
            SELECT 
                dci.id,
                dci.dsp_qty as dsp_qty,
                dci.hsn_code,
                dci.hsn_rate,
                dci.lot_no,
                dci.po_item_id,
                poi.po_item_no,
                poi.material_code,
                poi.material_description,
                poi.drg_no,
                poi.unit,
                poi.po_rate,
                poi.ord_qty,
                COALESCE(pod.ord_qty, poi.ord_qty) as lot_ordered_qty,
                COALESCE(pod.dsp_qty, 0) as lot_delivered_qty,
                COALESCE(pod.rcd_qty, 0) as rcd_qty,
                poi.dsp_qty as item_total_dispatched
            FROM delivery_challan_items dci
            JOIN purchase_order_items poi ON dci.po_item_id = poi.id
            LEFT JOIN purchase_order_deliveries pod ON dci.po_item_id = pod.po_item_id AND dci.lot_no = pod.lot_no
            WHERE dci.dc_number = ?
            ORDER BY poi.po_item_no ASC
            """,
            (dc_number,),
        ).fetchall()

        result_items = []
        for item in items:
            item_dict = dict(item)
            # Use Item Level Quantities for display
            item_ord_qty = item_dict["ord_qty"] or 0
            item_total_dispatched = item_dict["item_total_dispatched"] or 0

            # Lot level (kept for reference or deep introspection if needed)
            lot_ordered = item_dict["lot_ordered_qty"] or 0
            lot_delivered = item_dict["lot_delivered_qty"] or 0
            current_dispatch = item_dict["dsp_qty"] or 0

            # OVERRIDE: Show Item Level Ordered Quantity
            item_dict["ord_qty"] = item_ord_qty

            # Calculate Item Level Pending
            item_dict["pending_qty"] = max(0, item_ord_qty - item_total_dispatched)

            item_dict["dsp_qty"] = current_dispatch
            item_dict["rcd_qty"] = item_dict.get("rcd_qty", 0)
            item_dict["remaining_post_dc"] = max(0, lot_ordered - lot_delivered)

            result_items.append(item_dict)

        return {"header": header_dict, "items": result_items}

    except Exception as e:
        logger.error(f"Error fetching DC Detail for {dc_number}: {e!s}", exc_info=True)
        raise internal_error(f"Failed to fetch DC details: {e!s}", e) from e


@router.post("/")
@transactional
def create_dc(dc: DCCreate, items: list[dict], db: sqlite3.Connection = Depends(get_db)):
    """Create new Delivery Challan with items"""
    if not items:
        raise ValidationError("At least one item is required")
    if len(items) > 500:
        raise ValidationError("Too many items in a single DC (max 500)")

    result = service_create_dc(dc, items, db)
    if result.success:
        return result.data
    else:
        raise internal_error(result.message)


@router.put("/{dc_number}")
@transactional
def update_dc(
    dc_number: str,
    dc: DCCreate,
    items: list[dict],
    db: sqlite3.Connection = Depends(get_db),
):
    """Update existing Delivery Challan"""
    if not items:
        raise ValidationError("At least one item is required")
    if len(items) > 500:
        raise ValidationError("Too many items in a single DC (max 500)")

    result = service_update_dc(dc_number, dc, items, db)
    if result.success:
        return result.data
    else:
        raise internal_error(result.message)


@router.delete("/{dc_number}")
@transactional
def delete_dc(dc_number: str, db: sqlite3.Connection = Depends(get_db)):
    """Delete a Delivery Challan"""
    from backend.services.dc import delete_dc as service_delete_dc

    result = service_delete_dc(dc_number, db)
    if result.success:
        return result.data
    else:
        raise internal_error(result.message)
