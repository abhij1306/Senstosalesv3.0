"""
Optimized SRV Ingestion Service
Fixes: Async processing, batch operations, memory efficiency
"""

import asyncio
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

from backend.core.exceptions import ResourceNotFoundError
from backend.core.number_utils import to_qty
from backend.core.parsers.srv_parser import scrape_srv_html
from backend.core.utils import get_financial_year
from backend.services.deviation_service import DeviationService
from backend.services.reconciliation_v2 import ReconciliationService
from backend.services.validation_service import ValidationService


async def process_srv_file_async(
    contents: bytes,
    filename: str,
    db: sqlite3.Connection,
    po_from_filename: str | None = None,
) -> tuple[bool, list[dict], int, int]:
    """
    Async SRV processing with batch operations and memory optimization
    """
    try:
        # Step 1: Async HTML parsing to prevent blocking
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor(max_workers=2) as executor:
            html_content = await loop.run_in_executor(executor, lambda: contents.decode("utf-8"))
            srv_list = await loop.run_in_executor(executor, scrape_srv_html, html_content)

        if not srv_list:
            return False, ["No valid SRVs found in file"], 0, 1

        # Step 2: Batch validation and processing
        results = []
        success_count = 0
        failed_count = 0

        # Process in batches to manage memory
        batch_size = 10
        for i in range(0, len(srv_list), batch_size):
            batch = srv_list[i : i + batch_size]
            batch_results = await process_srv_batch(batch, db, po_from_filename)

            for result in batch_results:
                results.append(result)
                if result["success"]:
                    success_count += 1
                else:
                    failed_count += 1

        return success_count > 0, results, success_count, failed_count

    except Exception as e:
        return False, [f"Processing error: {e!s}"], 0, 1


async def process_srv_batch(srv_batch: list[dict], db: sqlite3.Connection, po_from_filename: str | None) -> list[dict]:
    """Process a batch of SRVs with single transaction"""
    results = []

    try:
        # Begin transaction for entire batch
        db.execute("BEGIN TRANSACTION")

        for srv_data in srv_batch:
            header = srv_data.get("header", {})

            # Fallback PO number from filename
            if not header.get("po_number") and po_from_filename:
                header["po_number"] = str(po_from_filename)

            # Quick validation: SRV and PO number required
            if not header.get("srv_number") or not header.get("po_number"):
                results.append({"success": False, "srv_number": header.get("srv_number", "Unknown"), "message": "Missing SRV or PO number"})
                continue

            # CRITICAL VALIDATION: Check if PO exists in database
            try:
                ValidationService.validate_po_exists(db, header["po_number"])
            except ResourceNotFoundError:
                results.append(
                    {
                        "success": False,
                        "srv_number": header["srv_number"],
                        "message": f"PO {header['po_number']} not found in system. Upload PO first.",
                    }
                )
                continue

            # Check for existing SRV and delete if found (overwrite mode)
            existing = db.execute("SELECT 1 FROM srvs WHERE srv_number = ?", (header["srv_number"],)).fetchone()
            status_type = "OVERWRITE" if existing else "NEW"

            if existing:
                delete_srv_fast(header["srv_number"], db)

            # Batch insert SRV
            success = ingest_srv_batch(srv_data, db)
            item_count = len(srv_data.get("items", []))

            if success:
                results.append({
                    "success": True, 
                    "srv_number": header["srv_number"], 
                    "item_count": item_count,
                    "status_type": status_type,
                    "message": "Processed successfully"
                })
            else:
                results.append({
                    "success": False, 
                    "srv_number": header["srv_number"], 
                    "item_count": item_count,
                    "status_type": "FAILED",
                    "message": "Database insertion failed"
                })

        # Commit entire batch
        db.commit()

        # Batch reconciliation after all inserts
        po_numbers = {srv["header"]["po_number"] for srv in srv_batch if srv.get("header", {}).get("po_number")}
        for po_number in po_numbers:
            reconcile_po_fast(db, po_number)

    except Exception as e:
        db.rollback()
        # Mark all as failed
        for srv_data in srv_batch:
            results.append(
                {"success": False, "srv_number": srv_data.get("header", {}).get("srv_number", "Unknown"), "message": f"Batch error: {e!s}"}
            )

    return results


def ingest_srv_batch(srv_data: dict, db: sqlite3.Connection) -> bool:
    """Fast SRV insertion without individual commits, with FY-aware linking"""
    header = srv_data["header"]
    items = srv_data["items"]

    try:
        # Get SRV financial year for FY-aware linking
        srv_date = header.get("srv_date")
        srv_fy = get_financial_year(srv_date) if srv_date else None
        
        # Insert SRV header
        db.execute(
            """
            INSERT INTO srvs (
                srv_number, srv_date, po_number, invoice_number,
                is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 1, ?, ?)
            """,
            (
                header["srv_number"],
                header["srv_date"],
                header["po_number"],
                items[0].get("invoice_no") if items else None,
                datetime.now().isoformat(),
                datetime.now().isoformat(),
            ),
        )

        # Batch insert items
        item_data = []
        for item in items:
            received_qty = to_qty(item.get("rcd_qty"))
            rejected_qty = to_qty(item.get("rej_qty"))
            accepted_qty = to_qty(item.get("accepted_qty"))

            # FY-aware challan linking: only link if DC exists in same FY
            challan_no = item.get("challan_no")
            validated_challan_no = None
            
            if challan_no and srv_fy:
                dc = db.execute(
                    "SELECT dc_number, dc_date FROM delivery_challans WHERE dc_number = ?",
                    (str(challan_no),)
                ).fetchone()
                
                if dc:
                    dc_fy = get_financial_year(dc["dc_date"]) if dc["dc_date"] else None
                    if dc_fy == srv_fy:
                        validated_challan_no = challan_no  # Same FY, link is valid
                    # If FY mismatch, don't link (validated_challan_no stays None)
                # If DC doesn't exist, don't link
            
            item_id = f"{header['srv_number']}_{item['po_item_no']}_{item.get('lot_no', 0)}_{item.get('srv_item_no', 0)}"
            
            item_data.append(
                (
                    item_id,
                    header["srv_number"],
                    header["po_number"],
                    item["po_item_no"],
                    item.get("lot_no"),
                    item.get("srv_item_no", 0),
                    item.get("rev_no", "0"),
                    received_qty,
                    rejected_qty,
                    accepted_qty,
                    to_qty(item.get("ord_qty", 0)),
                    to_qty(item.get("challan_qty", 0)),
                    item.get("unit"),
                    validated_challan_no,  # FY-validated challan
                    item.get("challan_date"),
                    item.get("invoice_no"),
                    item.get("invoice_date"),
                    item.get("div_code"),
                    item.get("pmir_no"),
                    item.get("finance_date"),
                    item.get("cnote_no"),
                    item.get("cnote_date"),
                    item.get("remarks"),
                    datetime.now().isoformat(),
                )
            )
            
            # Check for qty mismatch deviation
            srv_ord_qty = to_qty(item.get("ord_qty", 0))
            if srv_ord_qty > 0:
                DeviationService.check_qty_mismatch(
                    db=db,
                    srv_item_id=item_id,
                    po_number=header["po_number"],
                    po_item_no=item["po_item_no"],
                    srv_ord_qty=srv_ord_qty
                )

        db.executemany(
            """
            INSERT INTO srv_items (
                id, srv_number, po_number, po_item_no, lot_no,
                srv_item_no, rev_no,
                rcd_qty, rej_qty, accepted_qty, ord_qty, challan_qty, unit,
                challan_no, challan_date, invoice_no, invoice_date,
                div_code, pmir_no, finance_date, cnote_no, cnote_date, remarks, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            item_data,
        )

        return True

    except Exception as e:
        print(f"Error ingesting SRV {header.get('srv_number')}: {e}")
        return False


def delete_srv_fast(srv_number: str, db: sqlite3.Connection) -> tuple[bool, str]:
    """Fast SRV deletion without individual reconciliation"""
    try:
        db.execute("DELETE FROM srv_items WHERE srv_number = ?", (srv_number,))
        cursor = db.execute("DELETE FROM srvs WHERE srv_number = ?", (srv_number,))

        if cursor.rowcount > 0:
            return True, f"SRV {srv_number} deleted successfully"
        else:
            return False, f"SRV {srv_number} not found"

    except Exception as e:
        return False, f"Error deleting SRV: {e!s}"





def reconcile_po_fast(db: sqlite3.Connection, po_number: str) -> None:
    """
    Wrapper for consistent PO status sync.
    Quantity updates are handled by triggers.
    """
    ReconciliationService.sync_po(db, po_number)
