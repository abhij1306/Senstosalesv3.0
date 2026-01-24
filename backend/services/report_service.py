import sqlite3
import typing


def get_reports(
    report_type: str,
    start_date: str | None,
    end_date: str | None,
    db: sqlite3.Connection,
) -> typing.Any:
    """Unified report fetcher"""
    if report_type == "reconciliation":
        return get_po_reconciliation_by_date(start_date, end_date, db)

    elif report_type == "dc_register":
        return get_dc_register(start_date, end_date, db)
    elif report_type == "invoice_register":
        return get_invoice_register(start_date, end_date, db)
    elif report_type == "pending":
        return get_pending_po_items(db)
    elif report_type == "po_register":
        return get_po_register(start_date, end_date, db)
    else:
        raise ValueError(f"Unknown report type: {report_type}")


def get_pending_po_items(
    db: sqlite3.Connection, limit: int = 100, offset: int = 0, sort_by: str = "po_number", order: str = "asc"
) -> tuple[list[dict], int]:
    """
    Get items where pending_qty > 0 with full details (DC, Invoice, etc).
    """
    sort_map = {"po_number": "poi.po_number", "description": "description", "ord_qty": "poi.ord_qty", "dispatch_delivered": "dispatch_delivered"}
    db_sort_col = sort_map.get(sort_by, "poi.po_number")
    db_order = "DESC" if order.lower() == "desc" else "ASC"

    # Base where clause
    where_clause = "WHERE (poi.ord_qty - COALESCE(poi.rcd_qty, 0)) > 0.001"

    # Count query
    count_query = f"SELECT COUNT(*) FROM purchase_order_items poi {where_clause}"
    total_count = db.execute(count_query).fetchone()[0]

    query = f"""
    WITH doc_aggregates AS (
        SELECT 
            dci.po_item_id,
            SUM(COALESCE(dci.no_of_packets, 0)) as total_packets,
            GROUP_CONCAT(DISTINCT dc.dc_number) as dc_numbers,
            GROUP_CONCAT(DISTINCT inv.invoice_number) as invoice_numbers,
            GROUP_CONCAT(DISTINCT inv.gemc_number) as gemc_numbers
        FROM delivery_challan_items dci
        JOIN delivery_challans dc ON dci.dc_number = dc.dc_number
        LEFT JOIN gst_invoices inv ON dc.dc_number = inv.dc_number
        GROUP BY dci.po_item_id
    )
    SELECT 
        poi.id as unique_id,
        poi.id,
        COALESCE(poi.material_description, poi.material_code, 'No Description') as description,
        poi.ord_qty,
        poi.unit,
        COALESCE(da.total_packets, 0) as no_of_packets,
        poi.po_number,
        COALESCE(da.gemc_numbers, '') as gemc_number,
        COALESCE(da.invoice_numbers, '') as invoice_number,
        COALESCE(da.dc_numbers, '') as dc_number,
        COALESCE(poi.dsp_qty, 0) as dispatch_delivered
    FROM purchase_order_items poi
    LEFT JOIN doc_aggregates da ON poi.id = da.po_item_id
    {where_clause}
    ORDER BY {db_sort_col} {db_order}
    LIMIT ? OFFSET ?;
    """
    rows = db.execute(query, (limit, offset)).fetchall()
    return [dict(row) for row in rows], total_count


def get_selected_items_details(item_ids: list[str], db: sqlite3.Connection) -> list[dict]:
    """
    Get detailed data for specific items for Export.
    """
    if not item_ids:
        return []

    placeholders = ",".join(["?"] * len(item_ids))

    query = f"""
    WITH doc_aggregates AS (
        SELECT 
            dci.po_item_id, 
            SUM(dci.dsp_qty) as total_dispatched,
            SUM(dci.no_of_packets) as total_packets,
            GROUP_CONCAT(DISTINCT dc.dc_number) as dc_numbers,
            GROUP_CONCAT(DISTINCT inv.invoice_number) as invoice_numbers,
            GROUP_CONCAT(DISTINCT inv.gemc_number) as gemc_numbers
        FROM delivery_challan_items dci
        JOIN delivery_challans dc ON dci.dc_number = dc.dc_number
        LEFT JOIN gst_invoices inv ON dc.dc_number = inv.dc_number
        WHERE dci.po_item_id IN ({placeholders})
        GROUP BY dci.po_item_id
    )
    SELECT 
        poi.id,
        COALESCE(poi.material_description, poi.material_code, '') as description,
        poi.ord_qty, 
        poi.unit,
        poi.po_number,
        COALESCE(da.gemc_numbers, '') as gemc_number,
        COALESCE(da.total_dispatched, 0) as dispatch_delivered,
        COALESCE(da.total_packets, 0) as no_of_packets,
        COALESCE(da.dc_numbers, '') as dc_number,
        COALESCE(da.invoice_numbers, '') as invoice_number
    FROM purchase_order_items poi
    LEFT JOIN doc_aggregates da ON poi.id = da.po_item_id
    WHERE poi.id IN ({placeholders})
    ORDER BY poi.po_number, poi.po_item_no;
    """

    # We pass placeholders twice (CTE and Main Query)
    params = item_ids + item_ids
    rows = db.execute(query, params).fetchall()

    results = []
    for row in rows:
        d = dict(row)
        # Type casting simulation
        d["ord_qty"] = float(d["ord_qty"]) if d["ord_qty"] else 0.0
        d["dispatch_delivered"] = float(d["dispatch_delivered"]) if d["dispatch_delivered"] else 0.0
        d["no_of_packets"] = float(d["no_of_packets"]) if d["no_of_packets"] else 0.0
        results.append(d)

    return results


def get_po_reconciliation_by_date(start: str, end: str, db: sqlite3.Connection) -> list[dict]:
    """Detailed PO Item Reconciliation"""
    query = """
    SELECT 
        poi.id,
        poi.po_number,
        poi.po_item_no,
        COALESCE(poi.material_description, poi.material_code, '') as item_description,
        COALESCE(poi.ord_qty, 0) as ordered_qty,
        COALESCE(poi.dsp_qty, 0) as total_dispatched,
        COALESCE(poi.rcd_qty, 0) as total_accepted,
        COALESCE(poi.rej_qty, 0) as total_rejected,
        COALESCE(poi.pending_qty, 0) as pending_qty
    FROM purchase_order_items poi
    LEFT JOIN purchase_orders po ON poi.po_number = po.po_number
    WHERE date(po.po_date) BETWEEN date(?) AND date(?)
    """
    rows = db.execute(query, (start, end)).fetchall()
    return [dict(row) for row in rows]


def get_reconciliation_lots(po: str, db: sqlite3.Connection) -> list[dict]:
    """Get lot-wise reconciliation for a specific PO"""
    query = """
    SELECT 
        l.lot_no,
        l.dely_date,
        l.ord_qty as lot_qty,
        l.dsp_qty as lot_delivered,
        l.rcd_qty as lot_received
    FROM purchase_order_deliveries l
    JOIN purchase_order_items poi ON l.po_item_id = poi.id
    WHERE poi.po_number = ?
    ORDER BY l.lot_no
    """
    rows = db.execute(query, (po,)).fetchall()
    return [dict(row) for row in rows]


def get_dc_register(
    start: str, end: str, db: sqlite3.Connection, limit: int = 100, offset: int = 0, sort_by: str = "dc_date", order: str = "desc"
) -> tuple[list[dict], int]:
    """DC Register with Pagination"""
    sort_map = {
        "dc_date": "dc.dc_date",
        "dc_number": "dc.dc_number",
        "po_number": "dc.po_number",
        "consignee_name": "dc.consignee_name",
        "total_qty": "total_qty",
    }
    db_sort_col = sort_map.get(sort_by, "dc.dc_date")
    db_order = "DESC" if order.lower() == "desc" else "ASC"

    where_clause = "WHERE date(dc.dc_date) BETWEEN date(?) AND date(?)"
    params = [start, end]

    # Count query
    count_query = f"SELECT COUNT(DISTINCT dc_number) FROM delivery_challans dc {where_clause}"
    total_count = db.execute(count_query, params).fetchone()[0]

    query = f"""
    SELECT 
        dc.dc_number,
        dc.dc_date,
        dc.po_number,
        dc.consignee_name,
        COUNT(dci.id) as item_count,
        SUM(dci.dsp_qty) as total_qty
    FROM delivery_challans dc
    LEFT JOIN delivery_challan_items dci ON dc.dc_number = dci.dc_number
    {where_clause}
    GROUP BY dc.dc_number
    ORDER BY {db_sort_col} {db_order}
    LIMIT ? OFFSET ?
    """
    rows = db.execute(query, params + [limit, offset]).fetchall()
    return [dict(row) for row in rows], total_count


def get_invoice_register(
    start: str, end: str, db: sqlite3.Connection, limit: int = 100, offset: int = 0, sort_by: str = "invoice_date", order: str = "desc"
) -> tuple[list[dict], int]:
    """Invoice Register with Pagination"""
    sort_map = {
        "invoice_date": "i.invoice_date",
        "invoice_number": "i.invoice_number",
        "po_number": "po_number",
        "dc_number": "i.dc_number",
        "total_amount": "i.total_invoice_value",
    }
    db_sort_col = sort_map.get(sort_by, "i.invoice_date")
    db_order = "DESC" if order.lower() == "desc" else "ASC"

    where_clause = "WHERE date(i.invoice_date) BETWEEN date(?) AND date(?)"
    params = [start, end]

    # Count query
    count_query = f"SELECT COUNT(*) FROM gst_invoices i {where_clause}"
    total_count = db.execute(count_query, params).fetchone()[0]

    query = f"""
    SELECT 
        i.invoice_number,
        i.invoice_date,
        i.po_numbers as po_number,
        i.dc_number,
        i.total_invoice_value as total_amount,
        i.taxable_value as taxable_amount,
        i.cgst + i.sgst + i.igst as total_tax
    FROM gst_invoices i
    {where_clause}
    ORDER BY {db_sort_col} {db_order}
    LIMIT ? OFFSET ?
    """
    rows = db.execute(query, params + [limit, offset]).fetchall()
    return [dict(row) for row in rows], total_count


def get_po_register(start: str, end: str, db: sqlite3.Connection) -> list[dict]:
    """PO Register"""
    query = """
    SELECT 
        po.po_number,
        po.po_date,
        po.supplier_name,
        po.po_value,
        po.po_status,
        COUNT(poi.id) as items_count,
        SUM(poi.ord_qty) as total_qty
    FROM purchase_orders po
    LEFT JOIN purchase_order_items poi ON po.po_number = poi.po_number
    WHERE date(po.po_date) BETWEEN date(?) AND date(?)
    GROUP BY po.po_number
    ORDER BY po.po_date DESC
    """
    rows = db.execute(query, (start, end)).fetchall()
    return [dict(row) for row in rows]
