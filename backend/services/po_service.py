"""
Purchase Order Service
Handles business logic, aggregation, and data retrieval for POs.
Separates concerns from the API router.
"""

import logging
import sqlite3

from backend.core.exceptions import ResourceNotFoundError
from backend.db.models import PODetail, POHeader, POItem, POListItem, POStats
from backend.services.status_service import (
    calculate_entity_status,
)

logger = logging.getLogger(__name__)


class POService:
    """Service for Purchase Order business logic"""

    def get_stats(self, db: sqlite3.Connection) -> POStats:
        """Calculate PO Dashboard Statistics"""
        try:
            # Open Orders (Active)
            open_count = db.execute("SELECT COUNT(*) FROM purchase_orders WHERE po_status = 'Active'").fetchone()[0]

            # Pending Approval (Based on 'New' status)
            pending_count = db.execute("SELECT COUNT(*) FROM purchase_orders WHERE po_status = 'New' OR po_status IS NULL").fetchone()[0]

            # Total Value YTD (All POs for now)
            value_row = db.execute("SELECT SUM(po_value) FROM purchase_orders").fetchone()
            total_value = value_row[0] if value_row and value_row[0] else 0.0

            # Shipped and Rejected Totals
            aggregates = db.execute("""
                SELECT 
                    SUM(dsp_qty) as total_dsp,
                    SUM(rej_qty) as total_rej
                FROM purchase_order_items
            """).fetchone()

            total_dsp = aggregates[0] if aggregates and aggregates[0] else 0.0
            total_rej = aggregates[1] if aggregates and aggregates[1] else 0.0

            return POStats(
                open_orders_count=open_count,
                pending_approval_count=pending_count,
                total_value_ytd=total_value,
                total_value_change=0.0,
                total_shipped_qty=total_dsp,
                total_rejected_qty=total_rej,
            )
        except Exception as e:
            logger.error(f"Error calculating PO stats: {e}")
            # Fail gracefully for stats
            return POStats(
                open_orders_count=0,
                pending_approval_count=0,
                total_value_ytd=0.0,
                total_value_change=0.0,
            )

    def list_pos(
        self,
        db: sqlite3.Connection,
        limit: int = 10,
        offset: int = 0,
        sort_by: str = "created_at",
        order: str = "desc",
        search: str | None = None,
    ) -> tuple[list[POListItem], int]:
        """
        List all Purchase Orders with aggregated quantity details.
        Supports pagination, sorting, and searching.
        """
        # Map frontend keys to DB columns
        sort_map = {
            "po_number": "po.po_number",
            "po_date": "po.po_date",
            "supplier_name": "po.supplier_name",
            "po_value": "po.po_value",
            "po_status": "po_status",  # This is a calculated field in current service, but we have a col too
            "created_at": "po.created_at",
            "total_ord_qty": "total_ord",
            "total_dsp_qty": "total_dsp",
            "total_rcd_qty": "total_rcd",
            "total_rej_qty": "total_rej",
            "total_items_count": "total_items",
        }

        db_sort_col = sort_map.get(sort_by, "po.created_at")
        db_order = "DESC" if order.lower() == "desc" else "ASC"

        # Base query with aggregation
        base_query = """
            FROM purchase_orders po
            LEFT JOIN purchase_order_items poi ON po.po_number = poi.po_number
        """

        where_clause = ""
        params = []
        if search:
            where_clause = " WHERE po.po_number LIKE ? OR po.supplier_name LIKE ?"
            params.extend([f"%{search}%", f"%{search}%"])

        # Query for total count (for pagination metadata)
        count_query = f"SELECT COUNT(DISTINCT po.po_number) {base_query} {where_clause}"
        total_count = db.execute(count_query, params).fetchone()[0]

        # Main query for items
        items_query = f"""
            SELECT 
                po.po_number, 
                po.po_date, 
                po.supplier_name, 
                po.po_value, 
                po.amend_no, 
                po.po_status, 
                po.financial_year, 
                po.created_at,
                COALESCE(SUM(poi.ord_qty), 0) as total_ord,
                COALESCE(SUM(poi.dsp_qty), 0) as total_dsp,
                COALESCE(SUM(poi.rcd_qty), 0) as total_rcd,
                COALESCE(SUM(poi.rej_qty), 0) as total_rej,
                COALESCE(SUM(poi.pending_qty), 0) as total_pending,
                COUNT(poi.id) as total_items
            {base_query}
            {where_clause}
            GROUP BY po.po_number
            ORDER BY {db_sort_col} {db_order}
            LIMIT ? OFFSET ?
        """

        rows = db.execute(items_query, params + [limit, offset]).fetchall()

        results = []
        for row in rows:
            t_ordered = row["total_ord"] or 0
            t_dsp = row["total_dsp"] or 0
            t_rcd = row["total_rcd"] or 0
            t_rej = row["total_rej"] or 0

            # Use status from DB or recalculate if needed (PO status is usually stable once ingested)
            # Determing Status using CENTRALIZED logic to stay consistent with detail view
            accepted = max(0.0, t_rcd - t_rej)
            status = calculate_entity_status(t_ordered, t_dsp, accepted)

            results.append(
                POListItem(
                    po_number=row["po_number"],
                    po_date=row["po_date"],
                    supplier_name=row["supplier_name"],
                    po_value=row["po_value"],
                    amend_no=row["amend_no"],
                    po_status=status,
                    linked_dc_numbers="",
                    total_ord_qty=t_ordered,
                    total_dsp_qty=t_dsp,
                    total_rcd_qty=t_rcd,
                    total_rej_qty=t_rej,
                    total_pending_qty=row["total_pending"] or 0,
                    total_items_count=row["total_items"] or 0,
                    financial_year=row["financial_year"],
                    created_at=row["created_at"],
                )
            )

        return results, total_count

    def get_po_detail(self, db: sqlite3.Connection, po_number: str) -> PODetail:
        """
        Get full Purchase Order detail with items and delivery schedules.
        Includes SRV aggregated received/rejected quantities.
        """
        try:
            header_row = db.execute(
                """
                SELECT 
                    po_number, po_date, buyer_id, supplier_name,
                    supplier_gstin, supplier_code, supplier_phone,
                    supplier_fax, supplier_email, department_no,
                    enquiry_no, enquiry_date, quotation_ref,
                    quotation_date, rc_no, order_type, po_status,
                    tin_no, ecc_no, mpct_no, po_value, fob_value,
                    ex_rate, currency, net_po_value, amend_no,
                    amend_1_date, amend_2_date, remarks,
                    issuer_name, issuer_designation, issuer_phone,
                    inspection_by, inspection_at, financial_year,
                    our_ref, created_at, updated_at
                FROM purchase_orders 
                WHERE po_number = ?
            """,
                (po_number,),
            ).fetchone()
        except Exception as e:
            logger.error(f"Failed to fetch PO header for {po_number}: {e}", exc_info=True)
            raise e

        if not header_row:
            raise ResourceNotFoundError("PO", po_number)

        header_dict = dict(header_row)

        # Calculate live status based on aggregates
        agg = db.execute(
            """
            SELECT 
                SUM(poi.ord_qty) as total_ord,
                (
                    SELECT SUM(dci.dsp_qty) 
                    FROM delivery_challan_items dci 
                    JOIN purchase_order_items poi2 ON dci.po_item_id = poi2.id 
                    WHERE poi2.po_number = ?
                ) as total_dsp,
                (
                    SELECT SUM(si.rcd_qty) 
                    FROM srv_items si 
                    WHERE si.po_number = ?
                ) as total_rcd,
                (
                    SELECT SUM(si.rej_qty) 
                    FROM srv_items si 
                    WHERE si.po_number = ?
                ) as total_rej
            FROM purchase_order_items poi
            WHERE poi.po_number = ?
        """,
            (po_number, po_number, po_number, po_number),
        ).fetchone()

        if agg and agg["total_ord"] is not None:
            t_ord = agg["total_ord"] or 0
            t_dsp = agg["total_dsp"] or 0
            t_rcd = agg["total_rcd"] or 0
            t_rej = agg["total_rej"] or 0
            accepted = max(0.0, t_rcd - t_rej)
            header_dict["po_status"] = calculate_entity_status(t_ord, t_dsp, accepted)
        else:
            header_dict["po_status"] = "Pending"

        # Consignee Details (Derived)
        header_dict["consignee_name"] = "Partner Engineering PSU"
        header_dict["consignee_address"] = header_dict.get("inspection_at") or "LOCATION, STATE/UT"

        header = POHeader(**header_dict)

        # Get items with SRV aggregated data
        item_rows = db.execute(
            """
            SELECT id, po_item_no, material_code, material_description, drg_no, mtrl_cat,
                   unit, po_rate, ord_qty, 
                   dsp_qty,
                   rcd_qty, 
                   rej_qty,
                   hsn_code
            FROM purchase_order_items
            WHERE po_number = ?
            ORDER BY po_item_no
        """,
            (po_number,),
        ).fetchall()

        # 1. Batch fetch all deliveries for all items of this PO
        item_ids = [r["id"] for r in item_rows]
        placeholders = ",".join(["?"] * len(item_ids))
        all_deliveries = []
        if item_ids:
            all_deliveries = db.execute(
                f"""
                SELECT 
                    id, po_item_id, lot_no, 
                    ord_qty,
                    dsp_qty,
                    rcd_qty, 
                    dest_code,
                    dely_date, entry_allow_date, remarks
                FROM purchase_order_deliveries 
                WHERE po_item_id IN ({placeholders}) 
                ORDER BY lot_no
                """,
                item_ids,
            ).fetchall()

        # 2. Process each item and its lots
        items_with_deliveries = []
        for item_row in item_rows:
            item_dict = dict(item_row)
            item_id = item_dict["id"]

            # Map deliveries and compute High-Water Mark DLV
            item_deliveries = []
            total_lot_ord = 0.0
            total_lot_dsp = 0.0
            total_lot_rcd = 0.0

            for d in all_deliveries:
                if d["po_item_id"] == item_id:
                    d_dict = dict(d)

                    # Logic: Lot dsp = Dispatched (Physical) + Manual Override (if any)
                    # We NO LONGER merge rcd here to keep physical tracking pure.
                    # Status service handles the "Delivered" lock via max(dsp, rcd).
                    dsp = d_dict["dsp_qty"] or 0.0
                    rcd = d_dict["rcd_qty"] or 0.0
                    ord_qty = d_dict["ord_qty"] or 0.0
                    manual = d_dict.get("manual_override_qty") or 0.0

                    # Strictly use Dispatched (or Manual if set)
                    final_dsp = manual if manual > 0 else dsp

                    d_dict["dsp_qty"] = final_dsp
                    d_dict["rcd_qty"] = rcd
                    d_dict["ord_qty"] = ord_qty
                    d_dict["manual_override_qty"] = manual

                    item_deliveries.append(d_dict)

                    total_lot_ord += ord_qty
                    total_lot_dsp += final_dsp
                    total_lot_rcd += rcd

            # Update item with aggregate lot quantities
            # CRITICAL: Do NOT overwrite ord_qty - it comes from the item table directly.
            # Only aggregate dsp_qty and rcd_qty from lots as fallback if item-level is zero.
            if total_lot_dsp > 0:
                item_dict["dsp_qty"] = total_lot_dsp
            if total_lot_rcd > 0:
                item_dict["rcd_qty"] = total_lot_rcd

            # Calculate pending: ORD - DSP
            item_dict["pending_qty"] = max(0.0, item_dict.get("ord_qty", 0) - item_dict.get("dsp_qty", 0))

            item_with_deliveries = {**item_dict, "deliveries": item_deliveries}
            items_with_deliveries.append(POItem(**item_with_deliveries))

        return PODetail(header=header, items=items_with_deliveries)


# Singleton instance
po_service = POService()
