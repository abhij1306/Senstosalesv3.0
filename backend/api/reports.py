"""
Reports Router - Unified Deterministic Reporting
Routes requests to report_service and handles file exports.
"""

import logging
import sqlite3

from fastapi import APIRouter, Depends
from pydantic import BaseModel

import backend.services.report_service as report_service
from backend.core.errors import internal_error
from backend.db.models import PaginatedMetadata, PaginatedResponse
from backend.db.session import get_db
from backend.services.excel_service import ExcelService

logger = logging.getLogger(__name__)

router = APIRouter()


def get_save_path(db: sqlite3.Connection, key: str = "summary") -> str | None:
    """Fetch preferred download path"""
    try:
        row = db.execute(f"SELECT {key} FROM user_download_prefs ORDER BY id DESC LIMIT 1").fetchone()
        if row and row[key]:
            return row[key]
    except Exception as e:
        logger.warning(f"Failed to fetch download prefs for {key}: {e}")
    return None


@router.get("/reconciliation")
def get_reconciliation_report(
    start_date: str | None = None,
    end_date: str | None = None,
    po: str | None = None,
    export: bool = False,
    db: sqlite3.Connection = Depends(get_db),
):
    """PO vs Delivered vs Received vs Rejected"""
    if po:
        # If specific PO requested, get its lots reconciliation
        data = report_service.get_reconciliation_lots(po, db)
        if export:
            save_path = get_save_path(db, "items_summary")
            return ExcelService.generate_from_list(data, f"PO_Reconciliation_{po}.xlsx", save_path)
        return data

    # Default to last 30 days if not provided
    if not start_date or not end_date:
        from datetime import datetime, timedelta

        end = datetime.now()
        start = end - timedelta(days=30)
        start_date = start.strftime("%Y-%m-%d")
        end_date = end.strftime("%Y-%m-%d")

    data = report_service.get_po_reconciliation_by_date(start_date, end_date, db)
    if export:
        save_path = get_save_path(db, "items_summary")
        return ExcelService.generate_from_list(data, f"PO_Reconciliation_{start_date}_{end_date}.xlsx", save_path)
    return data


@router.get("/register/dc", response_model=PaginatedResponse)
def get_dc_register(
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = 100,
    offset: int = 0,
    sort_by: str = "dc_date",
    order: str = "desc",
    export: bool = False,
    db: sqlite3.Connection = Depends(get_db),
):
    """DC Register"""
    if not start_date or not end_date:
        from datetime import datetime, timedelta
        end = datetime.now()
        start = end - timedelta(days=30)
        start_date = start.strftime("%Y-%m-%d")
        end_date = end.strftime("%Y-%m-%d")

    if export:
        data, _ = report_service.get_dc_register(start_date, end_date, db, limit=5000)
        save_path = get_save_path(db, "challan_summary")
        return ExcelService.generate_from_list(data, f"DC_Register_{start_date}_{end_date}.xlsx", save_path)
    
    data, total_count = report_service.get_dc_register(start_date, end_date, db, limit, offset, sort_by, order)
    # Filter empty DC numbers if any (simulating df.dropna)
    data = [d for d in data if d.get("dc_number")]
    
    # Fill N/A (simulating df.fillna) -- Optional, but let's be safe
    for d in data:
        for k, v in d.items():
            if v is None:
                d[k] = ""

    return PaginatedResponse(
        items=data,
        metadata=PaginatedMetadata(
            total_count=total_count,
            page=(offset // limit) + 1,
            limit=limit
        )
    )


@router.get("/register/invoice", response_model=PaginatedResponse)
def get_invoice_register(
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = 100,
    offset: int = 0,
    sort_by: str = "invoice_date",
    order: str = "desc",
    export: bool = False,
    db: sqlite3.Connection = Depends(get_db),
):
    """Invoice Register"""
    if not start_date or not end_date:
        from datetime import datetime, timedelta
        end = datetime.now()
        start = end - timedelta(days=30)
        start_date = start.strftime("%Y-%m-%d")
        end_date = end.strftime("%Y-%m-%d")

    if export:
        data, _ = report_service.get_invoice_register(start_date, end_date, db, limit=5000)
        save_path = get_save_path(db, "invoice_summary")
        return ExcelService.generate_from_list(data, f"Invoice_Register_{start_date}_{end_date}.xlsx", save_path)
    
    data, total_count = report_service.get_invoice_register(start_date, end_date, db, limit, offset, sort_by, order)
    data = [d for d in data if d.get("invoice_number")]
    
    for d in data:
        for k, v in d.items():
            if v is None:
                d[k] = ""
    
    return PaginatedResponse(
        items=data,
        metadata=PaginatedMetadata(
            total_count=total_count,
            page=(offset // limit) + 1,
            limit=limit
        )
    )


@router.get("/register/po")
def download_po_summary(
    start_date: str | None = None,
    end_date: str | None = None,
    db: sqlite3.Connection = Depends(get_db),
):
    """Download PO Register as Excel"""
    try:
        # Default to last 30 days if not provided
        if not start_date or not end_date:
            from datetime import datetime, timedelta

            end = datetime.now()
            start = end - timedelta(days=30)
            start_date = start.strftime("%Y-%m-%d")
            end_date = end.strftime("%Y-%m-%d")

        data = report_service.get_po_register(start_date, end_date, db)

        date_str = f"{start_date or 'ALL'}_to_{end_date or 'ALL'}"
        
        save_path = get_save_path(db, "items_summary")
        # Ensure data is list of dicts (it is)
        return ExcelService.generate_dispatch_summary(
            date_str, data, db, save_path
        )
    except Exception as e:
        logger.error(f"Failed to generate PO Register: {e}")
        raise internal_error(str(e), e) from e


@router.get("/pending", response_model=PaginatedResponse)
def get_pending_items(
    limit: int = 100,
    offset: int = 0,
    sort_by: str = "po_number",
    order: str = "asc",
    export: bool = False, 
    db: sqlite3.Connection = Depends(get_db)
):
    """Pending PO Items (Shortages)"""
    if export:
        data, _ = report_service.get_pending_po_items(db, limit=5000)
        try:
            # Use Technical Summary format for consistency
            save_path = get_save_path(db, "items_summary")
            return ExcelService.generate_technical_summary(data, db, save_path)
        except Exception as e:
            logger.error(f"Failed to generate Pending PO Items report: {e}")
            raise internal_error(str(e), e) from e
            
    data, total_count = report_service.get_pending_po_items(db, limit, offset, sort_by, order)
    data = [d for d in data if d.get("po_number") and d.get("description")]
    
    for d in data:
        for k, v in d.items():
            if v is None:
                d[k] = ""
    
    return PaginatedResponse(
        items=data,
        metadata=PaginatedMetadata(
            total_count=total_count,
            page=(offset // limit) + 1,
            limit=limit
        )
    )


class ExportRequest(BaseModel):
    item_ids: list[str]
    report_type: str | None = "items"


@router.post("/export-selected")
def export_selected_items(
    request: ExportRequest,
    db: sqlite3.Connection = Depends(get_db)
):
    """
    Export specific selected items to Excel (Technical Summary Format).
    Supports:
    - Raw PO Item IDs
    - dc-{dc_number}
    - invoice-{invoice_number}
    - pending-{index}-{item_id}
    """
    try:
        clean_ids = []
        dc_ids = []
        invoice_ids = []

        for uid in request.item_ids:
            uid_str = str(uid)
            if uid_str.startswith("dc-"):
                dc_ids.append(uid_str.replace("dc-", ""))
            elif uid_str.startswith("invoice-"):
                invoice_ids.append(uid_str.replace("invoice-", ""))
            elif "-" in uid_str:
                # Composite ID or UUID
                parts = uid_str.split("-")
                if len(parts) >= 3 and (uid_str.startswith("pending-") or uid_str.startswith("sales-") or uid_str.startswith("reconciliation-")):
                     # Extract original ID from composite
                     clean_ids.append(uid_str.split("-", 2)[-1])
                else:
                     clean_ids.append(uid_str) # Likely a plain UUID
            else:
                clean_ids.append(uid)

        # If DC IDs provided, find all PO Item IDs associated with them
        if dc_ids:
            placeholders = ",".join(["?"] * len(dc_ids))
            query = f"SELECT DISTINCT po_item_id FROM delivery_challan_items WHERE dc_number IN ({placeholders})"
            rows = db.execute(query, dc_ids).fetchall()
            clean_ids.extend([str(r[0]) for r in rows if r[0]])

        # If Invoice IDs provided, find all PO Item IDs associated with them
        if invoice_ids:
            placeholders = ",".join(["?"] * len(invoice_ids))
            # Invoices are linked to DCs, which are linked to items
            query = f"""
                SELECT DISTINCT dci.po_item_id 
                FROM delivery_challan_items dci
                JOIN gst_invoices inv ON dci.dc_number = inv.dc_number
                WHERE inv.invoice_number IN ({placeholders})
            """
            rows = db.execute(query, invoice_ids).fetchall()
            clean_ids.extend([str(r[0]) for r in rows if r[0]])

        if not clean_ids:
             # Fallback: if we just have DC/Invoice headers but no items, maybe we just want the header summary?
             # For now, let's stick to the Technical Summary (Item level)
             from backend.core.errors import bad_request
             raise bad_request("No valid items found for selection")

        # Deduplicate
        clean_ids = list(set(clean_ids))

        items = report_service.get_selected_items_details(clean_ids, db)
        
        # Determine save path based on report type
        key = "items_summary"
        if request.report_type == "dc_register":
            key = "challan_summary"
        elif request.report_type == "invoice_register":
            key = "invoice_summary"

        save_path = get_save_path(db, key)
        return ExcelService.generate_technical_summary(items, db, save_path)
    except Exception as e:
        logger.error(f"Failed to export selected: {e}")
        raise internal_error("Export failed", e) from e


@router.get("/kpis")
def get_dashboard_kpis(db: sqlite3.Connection = Depends(get_db)):
    """Quick KPIs for dashboard (Legacy support)"""
    # Simple deterministic KPIs
    try:
        pending_count = db.execute("SELECT COUNT(*) FROM purchase_order_items WHERE pending_qty > 0").fetchone()[0]
        uninvoiced_dc = db.execute("""
            SELECT COUNT(*) FROM delivery_challans dc
            LEFT JOIN gst_invoices l ON dc.dc_number = l.dc_number
            WHERE l.dc_number IS NULL
        """).fetchone()[0]

        return {
            "pending_items": pending_count,
            "uninvoiced_dcs": uninvoiced_dc,
            "system_status": "Healthy",
        }
    except Exception as e:
        return {"error": str(e)}


@router.get("/daily-dispatch")
def get_daily_dispatch_report(
    date: str | None = None,
    export: bool = False,
    db: sqlite3.Connection = Depends(get_db),
):
    """Daily Dispatch Summary matching strict template"""
    if not date:
        from datetime import datetime

        date = datetime.now().strftime("%Y-%m-%d")

    # Fetch data - logically this is similar to DC items for a date
    # Joining DCs and Items
    query = """
        SELECT
            COALESCE(poi.material_description, '') as description,
            dci.dsp_qty as quantity,
            poi.unit,
            dci.no_of_packets as packets,
            dc.po_number,
            dc.dc_number,
            COALESCE(i.invoice_number, '') as invoice_number,
            dc.consignee_name as destination,
            COALESCE(i.gemc_number, '') as gemc_number
        FROM delivery_challans dc
        JOIN delivery_challan_items dci ON dc.dc_number = dci.dc_number
        JOIN purchase_order_items poi ON dci.po_item_id = poi.id
        LEFT JOIN gst_invoices i ON dc.dc_number = i.dc_number
        WHERE date(dc.dc_date) = date(?)
        ORDER BY dc.created_at
    """
    rows = db.execute(query, (date,)).fetchall()
    results = [dict(row) for row in rows]

    # Map description manually if alias failed or for backwards compatibility
    for r in results:
        if "material_description" in r and "description" not in r:
            r["description"] = r["material_description"]

    if export:
        try:
            save_path = get_save_path(db, "challan_summary")
            return ExcelService.generate_dispatch_summary(date, results, db, save_path)
        except Exception as e:
            raise internal_error(f"Export failed: {e!s}", e)

    return results


@router.get("/guarantee-certificate")
def get_guarantee_certificate(dc_number: str, db: sqlite3.Connection = Depends(get_db)):
    """Generate Guarantee Certificate for a specific DC"""
    # Fetch DC header
    dc_row = db.execute(
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
        (dc_number,),
    ).fetchone()
    if not dc_row:
        from backend.core.errors import not_found
        raise not_found(f"DC {dc_number} not found", "DC")
    header = dict(dc_row)

    # Fetch DC items
    items_rows = db.execute(
        """
        SELECT 
            poi.po_item_no,
            poi.material_description as description,
            dci.dsp_qty as quantity,
            poi.unit
        FROM delivery_challan_items dci
        JOIN purchase_order_items poi ON dci.po_item_id = poi.id
        WHERE dci.dc_number = ?
    """,
        (dc_number,),
    ).fetchall()
    items = [dict(row) for row in items_rows]

    # Fetch PO details
    po_row = db.execute(
        "SELECT po_date FROM purchase_orders WHERE po_number = ?",
        (header["po_number"],),
    ).fetchone()
    if po_row:
        header["po_date"] = po_row[0]

    save_path = get_save_path(db, "challan") # GC goes to Challan folder
    return ExcelService.generate_gc_excel(header, items, db, save_path)
