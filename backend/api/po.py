"""
Purchase Order Router
CRUD operations and HTML upload/scraping
"""

import asyncio
import logging
import sqlite3

from bs4 import BeautifulSoup
from fastapi import APIRouter, Depends, File, UploadFile

from backend.core.errors import internal_error
from backend.core.exceptions import ResourceNotFoundError, ValidationError
from backend.core.parsers.po_parser import extract_po_header
from backend.core.parsers.po_parser import extract_po_items as extract_items
from backend.db.models import (
    PaginatedMetadata,
    PaginatedResponse,
    PODetail,
    POListItem,
    POStats,
)
from backend.db.session import db_transaction, get_db, transactional
from backend.services.ingest_po import POIngestionService
from backend.services.po_service import po_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/stats", response_model=POStats)
def get_po_stats(db: sqlite3.Connection = Depends(get_db)):
    """Get aggregated PO statistics"""
    try:
        return po_service.get_stats(db)
    except Exception as e:
        logger.error(f"Failed to get PO stats: {e}")
        return POStats(
            open_orders_count=0,
            pending_approval_count=0,
            total_value_ytd=0.0,
            total_value_change=0.0,
            total_shipped_qty=0.0,
            total_rejected_qty=0.0,
        )


@router.get("/", response_model=PaginatedResponse[POListItem])
def list_pos(
    limit: int = 100,
    offset: int = 0,
    sort_by: str = "created_at",
    order: str = "desc",
    search: str | None = None,
    db: sqlite3.Connection = Depends(get_db)
):
    """List all Purchase Orders with quantity details (Paginated)"""
    items, total_count = po_service.list_pos(
        db, limit=limit, offset=offset, sort_by=sort_by, order=order, search=search
    )
    
    # Calculate current page for metadata
    page = (offset // limit) + 1
    
    return PaginatedResponse(
        items=items,
        metadata=PaginatedMetadata(
            total_count=total_count,
            page=page,
            limit=limit
        )
    )


@router.get("/{po_number}", response_model=PODetail)
def get_po_detail(po_number: str, db: sqlite3.Connection = Depends(get_db)):
    """Get Purchase Order detail with items and deliveries"""
    return po_service.get_po_detail(db, po_number)


@router.get("/{po_number}/context")
def get_po_context(po_number: str, db: sqlite3.Connection = Depends(get_db)):
    """Fetch PO context (Supplier/Buyer info) for DC/Invoice auto-fill"""
    po = db.execute(
        """
        SELECT po.po_number, po.po_date, po.supplier_name, po.supplier_gstin,
               b.name as buyer_name, b.gstin as buyer_gstin, b.address as buyer_address
        FROM purchase_orders po
        LEFT JOIN buyers b ON po.buyer_id = b.id
        WHERE po.po_number = ?
    """,
        (po_number,),
    ).fetchone()

    if not po:
        raise ResourceNotFoundError("PO", po_number)

    return dict(po)


@router.get("/{po_number}/dc")
def check_po_has_dc(po_number: str, db: sqlite3.Connection = Depends(get_db)):
    """Check if PO has an associated Delivery Challan"""
    try:
        dc_row = db.execute(
            """
            SELECT id, dc_number FROM delivery_challans 
            WHERE po_number = ? 
            LIMIT 1
        """,
            (po_number,),
        ).fetchone()

        if dc_row:
            return {
                "has_dc": True,
                "dc_id": dc_row["id"],
                "dc_number": dc_row["dc_number"],
            }
        else:
            return {"has_dc": False}
    except Exception:
        return {"has_dc": False}


@router.post("/", response_model=PODetail)
@transactional
async def create_po_manual(po_data: PODetail, db: sqlite3.Connection = Depends(get_db)):
    """Manually create a Purchase Order from structured data"""
    return await process_po_update(po_data, db)


@router.put("/{po_number}", response_model=PODetail)
@transactional
async def update_po(po_number: str, po_data: PODetail, db: sqlite3.Connection = Depends(get_db)):
    """Update an existing Purchase Order"""
    # Force po_number consistency
    po_data.header.po_number = po_number
    return await process_po_update(po_data, db)


async def process_po_update(po_data: PODetail, db: sqlite3.Connection):
    """Shared logic for creating/updating PO via structured model"""
    if not po_data.items:
        raise ValidationError("At least one item is required")
    if len(po_data.items) > 500:
        raise ValidationError("Too many items in a single PO (max 500)")

    ingestion_service = POIngestionService()

    # 1. Map header to scraper-like format
    header_map = {
        "PURCHASE ORDER": str(po_data.header.po_number),
        "PO DATE": po_data.header.po_date,
        "SUPP NAME M/S": po_data.header.supplier_name,
        "SUPP CODE": po_data.header.supplier_code,
        "PHONE": po_data.header.supplier_phone,
        "FAX": po_data.header.supplier_fax,
        "EMAIL": po_data.header.supplier_email,
        "DVN": po_data.header.department_no,
        "ENQUIRY": po_data.header.enquiry_no,
        "ENQ DATE": po_data.header.enquiry_date,
        "QUOTATION": po_data.header.quotation_ref,
        "QUOT-DATE": po_data.header.quotation_date,
        "RC NO": po_data.header.rc_no,
        "ORD-TYPE": po_data.header.order_type,
        "PO STATUS": po_data.header.po_status,
        "TIN NO": po_data.header.tin_no,
        "ECC NO": po_data.header.ecc_no,
        "MPCT NO": po_data.header.mpct_no,
        "PO-VALUE": po_data.header.po_value,
        "FOB VALUE": po_data.header.fob_value,
        "NET PO VAL": po_data.header.net_po_value,
        "AMEND NO": po_data.header.amend_no,
        "INSPECTION BY": po_data.header.inspection_by,
        "INSPECTION AT SITE": po_data.header.inspection_at,
        "NAME": po_data.header.issuer_name,
        "DESIGNATION": po_data.header.issuer_designation,
        "PHONE NO": po_data.header.issuer_phone,
        "REMARKS": po_data.header.remarks,
        "OUR_REF": po_data.header.our_ref,
        "CONSIGNEE_NAME": po_data.header.consignee_name,
        "CONSIGNEE_ADDRESS": po_data.header.consignee_address,
    }

    # 2. Map items and their nested deliveries
    items_list = []
    for item in po_data.items:
        item_map = {
            "PO ITM": item.po_item_no,
            "MATERIAL CODE": item.material_code,
            "DESCRIPTION": item.material_description,
            "DRG": item.drg_no,
            "UNIT": item.unit,
            "PO RATE": item.po_rate,
            "ORD QTY": item.ord_qty,
            "RCD QTY": item.rcd_qty,
            "REJ QTY": item.rej_qty,
            "MTRL CAT": item.mtrl_cat,
            "DSP QTY": item.dsp_qty,
            "HSN CODE": item.hsn_code,
            "ITEM VALUE": item.item_value,
            "deliveries": [],
        }

        # Map nested lots
        if item.deliveries:
            for d in item.deliveries:
                item_map["deliveries"].append({
                    "LOT NO": d.lot_no,
                    "DELY QTY": d.ord_qty,
                    "DELY DATE": d.dely_date,
                    "ENTRY ALLOW DATE": d.entry_allow_date,
                    "DEST CODE": d.dest_code,
                    "manual_override_qty": d.manual_override_qty or d.dsp_qty or 0.0,
                })
        else:
            # Fallback for manual items without specific lots
            item_map["deliveries"].append({
                "LOT NO": 1,
                "DELY QTY": item.ord_qty,
                "DELY DATE": po_data.header.po_date,
                "ENTRY ALLOW DATE": None, # Explicitly NULL if not provided
                "DEST CODE": po_data.header.department_no or 1,
            })

        items_list.append(item_map)

    try:
        success, warnings, _ = ingestion_service.ingest_po(db, header_map, items_list)

        if success:
            # NOTE: We intentionally do NOT call sync_po here.
            # Manual PO edits should preserve user-specified values.
            # Sync is only for automated reconciliation (e.g., after DC/SRV creation).
            return po_data
    except Exception as e:
        logger.error(f"Error processing PO update: {e}", exc_info=True)
        raise ValidationError(f"Backend error: {str(e)}")

    raise ValidationError(f"Failed to ingest PO: {', '.join(warnings)}")


def parse_po_html(content: bytes) -> tuple[dict, list[dict]]:
    """Helper to parse PO HTML in a thread-safe way (CPU-bound)"""
    soup = BeautifulSoup(content, "lxml")
    po_header = extract_po_header(soup)
    po_items = extract_items(soup)
    return po_header, po_items


@router.post("/upload")
@transactional
async def upload_po_html(file: UploadFile = File(...), db: sqlite3.Connection = Depends(get_db)):
    """Upload and parse PO HTML file"""
    if not file.filename.endswith(".html"):
        raise ValidationError("Only HTML files are supported")

    content = await file.read()
    po_header, po_items = await asyncio.to_thread(parse_po_html, content)

    if not po_header.get("PURCHASE ORDER"):
        raise ValidationError("Could not extract PO number from HTML")

    if len(po_items) > 500:
        raise ValidationError(f"Too many items in HTML ({len(po_items)}). Max 500 allowed.")

    ingestion_service = POIngestionService()
    success, warnings, _ = ingestion_service.ingest_po(db, po_header, po_items)
    
    if not success:
        raise ValidationError(f"Ingestion logic returned failure: {warnings}")

    return {
        "success": True,
        "po_number": po_header.get("PURCHASE ORDER"),
        "warnings": warnings,
    }


@router.post("/upload/batch")
async def upload_po_batch(files: list[UploadFile] = File(...), db: sqlite3.Connection = Depends(get_db)):
    """Batch upload POs - each file is its own transaction"""
    results = []
    successful = 0
    failed = 0

    ingestion_service = POIngestionService()

    for file in files:
        result = {"filename": file.filename, "success": False, "po_number": None, "message": ""}
        try:
            if not file.filename.endswith(".html"):
                result["message"] = "Only HTML files are supported"
                failed += 1
                results.append(result)
                continue

            # Handle async file read
            try:
                content = await file.read()
            except Exception:
                content = await file.read()

            po_header, po_items = await asyncio.to_thread(parse_po_html, content)

            if not po_header.get("PURCHASE ORDER"):
                raise ValueError("Missing PO Number")

            with db_transaction(db):
                success, warnings, status_type = ingestion_service.ingest_po(db, po_header, po_items)
                if success:
                    result["success"] = True
                    result["po_number"] = po_header.get("PURCHASE ORDER")
                    result["status_type"] = status_type
                    result["message"] = warnings[0] if warnings else "Success"
                    successful += 1
                else:
                    raise ValueError(f"Ingestion Error: {warnings}")
        except Exception as e:
            result["message"] = str(e)
            failed += 1
        results.append(result)

    return {"total": len(files), "successful": successful, "failed": failed, "results": results}


@router.get("/{po_number}/excel")
def download_po_excel(po_number: str, db: sqlite3.Connection = Depends(get_db)):
    """Download PO as Excel"""
    try:
        po_detail = po_service.get_po_detail(db, po_number)
        deliveries = []
        for item in po_detail.items:
            deliveries.extend(item.deliveries)

        from fastapi.responses import StreamingResponse

        from backend.services.excel_service import ExcelService

        excel_file = ExcelService.generate_po_excel(po_detail.header, po_detail.items, deliveries)
        filename = f"PO_{po_number}.xlsx"
        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}

        return StreamingResponse(
            excel_file,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers=headers,
        )
    except Exception as e:
        raise internal_error(f"Failed to generate Excel: {e!s}", e) from e


