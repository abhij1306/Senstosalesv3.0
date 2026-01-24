"""
SRV API Router
Handles SRV upload, listing, and detail retrieval.
"""

import re
import sqlite3

from fastapi import APIRouter, Depends, File, UploadFile

from backend.core.exceptions import ResourceNotFoundError, ValidationError
from backend.db.models import (
    PaginatedMetadata,
    PaginatedResponse,
    SRVDetail,
    SRVHeader,
    SRVItem,
    SRVListItemOptimized,
    SRVStats,
)
from backend.db.session import get_db, transactional

router = APIRouter()


@router.post("/upload/batch")
async def upload_batch_srvs(files: list[UploadFile] = File(...), db: sqlite3.Connection = Depends(get_db)):
    """
    Upload multiple SRV HTML files with transaction safety per file.
    """
    results = []
    from backend.services.srv_ingestion_optimized import process_srv_file_async

    successful_count = 0
    failed_count = 0

    for file in files:
        try:
            if not file.filename.endswith(".html"):
                results.append({"filename": file.filename, "success": False, "message": "Invalid file type"})
                failed_count += 1
                continue

            # Extract PO number from filename
            po_match = (
                re.search(r"PO_?(\d+)", file.filename, re.IGNORECASE)
                or re.search(r"SRV_(\d+)", file.filename, re.IGNORECASE)
                or re.search(r"^(\d+)", file.filename)
            )

            po_from_filename = po_match.group(1) if po_match else None
            content = await file.read()

            # The service handles its own transactions internally (optimized)
            success, detailed_results, s_count, f_count = await process_srv_file_async(content, file.filename, db, po_from_filename)

            # Extract messages and status from detailed results
            msg_list = [res.get("message", "") for res in detailed_results]
            status_type = detailed_results[0].get("status_type") if detailed_results else None

            results.append(
                {
                    "filename": file.filename,
                    "success": success,
                    "message": "; ".join(msg_list),
                    "successful": s_count,
                    "failed": f_count,
                    "status_type": status_type,
                }
            )
            successful_count += s_count
            failed_count += f_count

        except Exception as e:
            results.append({"filename": file.filename, "success": False, "message": str(e)})
            failed_count += 1

    return {
        "total": len(files),
        "successful": successful_count,
        "failed": failed_count,
        "results": results,
    }


@router.get("/", response_model=PaginatedResponse[SRVListItemOptimized])
def get_srv_list(
    po_number: str = None,
    sort_by: str = "srv_date",
    order: str = "desc",
    offset: int = 0,
    limit: int = 100,
    search: str | None = None,
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Get list of SRVs with optimized joining for PO info.
    Supports server-side sorting for rejections and other fields.
    """
    # Map frontend keys to DB columns
    sort_map = {
        "srv_date": "s.srv_date",
        "srv_number": "s.srv_number",
        "po_number": "s.po_number",
        "total_rcd_qty": "total_received_qty",
        "total_rej_qty": "total_rejected_qty",
        "total_accepted_qty": "total_accepted_qty",
        "created_at": "s.created_at",
    }

    db_sort_col = sort_map.get(sort_by, "s.srv_date")
    db_order = "DESC" if order.lower() == "desc" else "ASC"

    # Base query components
    base_query = """
        FROM srvs s
        LEFT JOIN srv_items si ON s.srv_number = si.srv_number
        LEFT JOIN purchase_orders po ON s.po_number = po.po_number
    """

    where_clauses = ["1=1"]
    params = []

    if po_number:
        where_clauses.append("s.po_number = ?")
        params.append(po_number)

    if search:
        where_clauses.append("(s.srv_number LIKE ? OR s.po_number LIKE ? OR s.invoice_number LIKE ?)")
        params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])

    where_stmt = " WHERE " + " AND ".join(where_clauses)

    # Get total count
    count_query = f"SELECT COUNT(DISTINCT s.srv_number) {base_query} {where_stmt}"
    total_count = db.execute(count_query, params).fetchone()[0]

    # Main data query
    query = f"""
        SELECT 
            s.srv_number,
            s.srv_date,
            s.po_number,
            CASE WHEN po.po_number IS NOT NULL THEN 1 ELSE 0 END as po_found,
            COALESCE(SUM(si.rcd_qty), 0) as total_received_qty,
            COALESCE(SUM(si.rej_qty), 0) as total_rejected_qty,
            COALESCE(SUM(si.accepted_qty), 0) as total_accepted_qty,
            COALESCE(SUM(si.ord_qty), 0) as total_ord_qty,
            COALESCE(SUM(si.challan_qty), 0) as total_challan_qty,
            s.created_at
        {base_query}
        {where_stmt}
        GROUP BY s.srv_number
        ORDER BY {db_sort_col} {db_order}
        LIMIT ? OFFSET ?
    """

    rows = db.execute(query, params + [limit, offset]).fetchall()

    results = [
        {
            "srv_number": row["srv_number"],
            "srv_date": row["srv_date"],
            "po_number": row["po_number"],
            "total_rcd_qty": float(row["total_received_qty"]),
            "total_rej_qty": float(row["total_rejected_qty"]),
            "total_accepted_qty": float(row["total_accepted_qty"]),
            "total_ord_qty": float(row["total_ord_qty"]),
            "total_challan_qty": float(row["total_challan_qty"]),
            "po_found": bool(row["po_found"]),
            "warning_message": None if bool(row["po_found"]) else f"PO {row['po_number']} not found",
            "created_at": row["created_at"],
        }
        for row in rows
    ]

    return PaginatedResponse(items=results, metadata=PaginatedMetadata(total_count=total_count, page=(offset // limit) + 1, limit=limit))


@router.get("/po/{po_number}/srvs")
def get_srvs_by_po(po_number: str, db: sqlite3.Connection = Depends(get_db)):
    """Get list of SRVs for a specific PO. Used by PO detail page."""
    result = db.execute(
        """
        SELECT srv_number, srv_date, po_number, created_at
        FROM srvs 
        WHERE po_number = ?
        ORDER BY srv_date DESC
        """,
        (po_number,),
    ).fetchall()

    return [
        {
            "srv_number": row["srv_number"],
            "srv_date": row["srv_date"],
            "po_number": row["po_number"],
            "created_at": row["created_at"],
        }
        for row in result
    ]


@router.get("/stats", response_model=SRVStats)
def get_srv_stats(db: sqlite3.Connection = Depends(get_db)):
    """Get SRV Statistics"""
    result = db.execute("""
        SELECT 
            COUNT(DISTINCT s.srv_number) as total_srvs,
            COALESCE(SUM(si.rcd_qty), 0) as total_received,
            COALESCE(SUM(si.rej_qty), 0) as total_rejected,
            SUM(CASE WHEN po.po_number IS NULL THEN 1 ELSE 0 END) as missing_po_count
        FROM srvs s
        LEFT JOIN srv_items si ON s.srv_number = si.srv_number
        LEFT JOIN purchase_orders po ON s.po_number = po.po_number
    """).fetchone()

    total_received = float(result["total_received"] or 0)
    total_rejected = float(result["total_rejected"] or 0)
    total_qty = total_received + total_rejected
    rejection_rate = (total_rejected / total_qty * 100) if total_qty > 0 else 0.0

    return {
        "total_srvs": result["total_srvs"] or 0,
        "total_rcd_qty": total_received,
        "total_rej_qty": total_rejected,
        "rejection_rate": round(rejection_rate, 2),
        "missing_po_count": int(result["missing_po_count"] or 0),
    }


@router.get("/{srv_number}", response_model=SRVDetail)
def get_srv_detail(srv_number: str, db: sqlite3.Connection = Depends(get_db)):
    """Get SRV Details"""
    header_result = db.execute(
        """
        SELECT 
            srv_number, srv_date, po_number, invoice_number,
            srv_status, po_found, warning_message, is_active,
            created_at, updated_at
        FROM srvs 
        WHERE srv_number = ?
        """,
        (srv_number,),
    ).fetchone()
    if not header_result:
        raise ResourceNotFoundError("SRV", srv_number)

    items_result = db.execute(
        """
        SELECT si.*, poi.material_description, poi.material_code, poi.mtrl_cat, poi.drg_no
        FROM srv_items si
        LEFT JOIN purchase_order_items poi ON si.po_number = poi.po_number AND si.po_item_no = poi.po_item_no
        WHERE si.srv_number = ? 
        ORDER BY si.po_item_no, si.lot_no
        """,
        (srv_number,),
    ).fetchall()

    return SRVDetail(header=SRVHeader(**dict(header_result)), items=[SRVItem(**dict(row)) for row in items_result])


@router.delete("/{srv_number}")
@transactional
def delete_srv_endpoint(srv_number: str, db: sqlite3.Connection = Depends(get_db)):
    """Delete an SRV with transaction safety and reconciliation"""
    # Fetch PO number before deletion for reconciliation
    po_row = db.execute("SELECT po_number FROM srvs WHERE srv_number = ?", (srv_number,)).fetchone()

    from backend.services.srv_ingestion_optimized import delete_srv_fast as delete_srv

    success, message = delete_srv(srv_number, db)

    if not success:
        raise ValidationError(message)

    # Reconcile the PO if it was found
    if po_row:
        from backend.services.srv_ingestion_optimized import reconcile_po_fast

        reconcile_po_fast(db, po_row["po_number"])

    return {"message": f"{message} & PO Reconciled"}
