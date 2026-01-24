"""
Dashboard Router
Summary statistics and recent activity
"""

import sqlite3
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends

from backend.core.errors import internal_error
from backend.db.models import DashboardSummary
from backend.db.session import get_db
from backend.services.analytics_service import AnalyticsService
from backend.services.status_service import calculate_entity_status

router = APIRouter()


def _fetch_recent_activity(db: sqlite3.Connection, limit: int) -> list[dict[str, Any]]:
    """Shared logic to fetch recent mixed activity"""
    activities = []

    # Recent POs with live status (Optimized with CTEs)
    po_rows = db.execute(
        """
        WITH po_items_agg AS (
            SELECT po_number, SUM(ord_qty) as t_ord
            FROM purchase_order_items
            GROUP BY po_number
        ),
        po_deliveries_agg AS (
            SELECT poi.po_number, 
                    SUM(pod.dsp_qty) as t_del,
                    SUM(pod.rcd_qty) as t_recd
            FROM purchase_order_deliveries pod
            JOIN purchase_order_items poi ON pod.po_item_id = poi.id
            GROUP BY poi.po_number
        )
        SELECT 'PO' as type, po.po_number as number, po.po_date as date, po.supplier_name as party, po.po_value as amount, 
                po.created_at,
                COALESCE(i.t_ord, 0) as t_ord,
                COALESCE(d.t_del, 0) as t_del,
                COALESCE(d.t_recd, 0) as t_recd
        FROM purchase_orders po
        LEFT JOIN po_items_agg i ON po.po_number = i.po_number
        LEFT JOIN po_deliveries_agg d ON po.po_number = d.po_number
        ORDER BY po.created_at DESC LIMIT ?
    """,
        (limit,),
    ).fetchall()
    for row in po_rows:
        d = dict(row)
        d["status"] = calculate_entity_status(d["t_ord"], d["t_del"], d["t_recd"])
        activities.append(d)

    # Recent Invoices with live status (Optimized with CTEs)
    inv_rows = db.execute(
        """
        WITH inv_items_agg AS (
            SELECT invoice_number, SUM(quantity) as t_ord
            FROM gst_invoice_items
            GROUP BY invoice_number
        ),
        dc_dispatch_agg AS (
            SELECT dc_number, SUM(dsp_qty) as t_del
            FROM delivery_challan_items
            GROUP BY dc_number
        ),
        srv_received_agg AS (
            SELECT s.invoice_number, SUM(si.rcd_qty) as t_recd
            FROM srv_items si
            JOIN srvs s ON si.srv_number = s.srv_number
            GROUP BY s.invoice_number
        )
        SELECT 'Invoice' as type, inv.invoice_number as number, inv.invoice_date as date, inv.buyer_gstin as party, 
                inv.total_invoice_value as amount, inv.created_at, inv.dc_number,
                COALESCE(i.t_ord, 0) as t_ord,
                COALESCE(d.t_del, 0) as t_del,
                COALESCE(r.t_recd, 0) as t_recd
        FROM gst_invoices inv
        LEFT JOIN inv_items_agg i ON inv.invoice_number = i.invoice_number
        LEFT JOIN dc_dispatch_agg d ON inv.dc_number = d.dc_number
        LEFT JOIN srv_received_agg r ON inv.invoice_number = r.invoice_number
        ORDER BY inv.created_at DESC LIMIT ?
    """,
        (limit,),
    ).fetchall()
    for row in inv_rows:
        d = dict(row)
        d["party"] = d["party"] or "Client"
        d["status"] = calculate_entity_status(d["t_ord"], d["t_del"], d["t_recd"])
        activities.append(d)

    # Recent DCs with live status (Optimized with CTEs)
    dc_rows = db.execute(
        """
        WITH dc_value_agg AS (
            SELECT dci.dc_number, SUM(dci.dsp_qty * poi.po_rate) as amount
            FROM delivery_challan_items dci
            JOIN purchase_order_items poi ON dci.po_item_id = poi.id
            GROUP BY dci.dc_number
        ),
        dc_ord_agg AS (
            SELECT dci.dc_number, SUM(COALESCE(pod.ord_qty, 0)) as t_ord
            FROM delivery_challan_items dci
            LEFT JOIN purchase_order_deliveries pod ON dci.po_item_id = pod.po_item_id AND dci.lot_no = pod.lot_no
            GROUP BY dci.dc_number
        ),
        dc_del_agg AS (
            SELECT dc_number, SUM(dsp_qty) as t_del
            FROM delivery_challan_items
            GROUP BY dc_number
        ),
        dc_recd_agg AS (
            SELECT challan_no, SUM(rcd_qty) as t_recd
            FROM srv_items
            GROUP BY challan_no
        )
        SELECT 'DC' as type, dc.dc_number as number, dc.dc_date as date, dc.consignee_name as party, 
                COALESCE(v.amount, 0) as amount, dc.created_at,
                COALESCE(o.t_ord, 0) as t_ord,
                COALESCE(d.t_del, 0) as t_del,
                COALESCE(r.t_recd, 0) as t_recd
        FROM delivery_challans dc
        LEFT JOIN dc_value_agg v ON dc.dc_number = v.dc_number
        LEFT JOIN dc_ord_agg o ON dc.dc_number = o.dc_number
        LEFT JOIN dc_del_agg d ON dc.dc_number = d.dc_number
        LEFT JOIN dc_recd_agg r ON dc.dc_number = r.challan_no
        ORDER BY dc.created_at DESC LIMIT ?
    """,
        (limit,),
    ).fetchall()
    for row in dc_rows:
        d = dict(row)
        d["status"] = calculate_entity_status(d["t_ord"], d["t_del"], d["t_recd"])
        activities.append(d)

    # Sort combined list by created_at desc
    def sort_key(x):
        return x["created_at"] or x["date"] or ""

    activities.sort(key=sort_key, reverse=True)
    return activities[:limit]


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(time_range: str = "month", db: sqlite3.Connection = Depends(get_db)):
    """Get dashboard summary statistics

    Args:
        time_range: 'month' (default), '30d', 'all'
    """
    try:
        now = datetime.now()
        start_date = None

        # Calculate Start Date based on Range
        if time_range == "30d":
            from datetime import timedelta

            start_date = (now - timedelta(days=30)).strftime("%Y-%m-%d")
        elif time_range == "month":
            start_date = now.replace(day=1).strftime("%Y-%m-%d")
        # 'all' implies start_date is None

        # 1. Total Sales (Month/Filtered)
        # Using invoice_date for business accuracy.
        sales_query = "SELECT SUM(total_invoice_value) FROM gst_invoices"
        sales_params = ()
        if start_date:
            sales_query += " WHERE invoice_date >= ?"
            sales_params = (start_date,)

        sales_row = db.execute(sales_query, sales_params).fetchone()
        total_sales = sales_row[0] if sales_row and sales_row[0] else 0.0

        # 2. Pending/Draft POs (Live Count) - Unaffected by time range (Status is absolute)
        # Status "Closed" means transaction complete.
        active_pos_count = db.execute("""
            SELECT COUNT(DISTINCT po_number) 
            FROM purchase_order_items 
            WHERE pending_qty > 0.001
        """).fetchone()[0]

        # 3. New POs Today - Unaffected by time range (Specific metric)
        today_start = datetime.now().strftime("%Y-%m-%d")
        new_pos_today = db.execute(
            """
            SELECT COUNT(*) FROM purchase_orders 
            WHERE po_date = ?
        """,
            (today_start,),
        ).fetchone()[0]

        # 4. Active Challans (Uninvoiced) - Unaffected by time range (Status is absolute)
        active_challans = db.execute("""
            SELECT COUNT(DISTINCT dc.dc_number)
            FROM delivery_challans dc
            LEFT JOIN gst_invoices i ON dc.dc_number = i.dc_number
            WHERE i.invoice_number IS NULL
        """).fetchone()[0]

        # 5. Total PO Value (Filtered)
        # Using po_date for business accuracy
        po_val_query = "SELECT SUM(po_value) FROM purchase_orders"
        po_val_params = ()
        if start_date:
            po_val_query += " WHERE po_date >= ?"
            po_val_params = (start_date,)

        value_row = db.execute(po_val_query, po_val_params).fetchone()
        total_po_value = value_row[0] if value_row and value_row[0] else 0.0

        # 6. Overall Quantity Stats (Filtered by Originating PO Date / Lifecycle)
        # Reflects "Efficiency of orders placed in this period" or "Activity in this period"
        # User requested "doc wise".

        # Total Ordered: Items from POs dated in range
        ord_query = "SELECT SUM(poi.ord_qty) FROM purchase_order_items poi JOIN purchase_orders po ON poi.po_number = po.po_number"
        dsp_query = "SELECT SUM(dci.dsp_qty) FROM delivery_challan_items dci JOIN purchase_order_items poi ON dci.po_item_id = poi.id JOIN purchase_orders po ON poi.po_number = po.po_number"
        # For Receipt/Rejection, we link back to PO to keep the "Supply Chain View" consistent?
        # Or filter by SRV Date?
        # User: "PO value linked to actual PO date and so on"
        # If I want "Total Received", usually people mean "Received in this period".
        # But if we want "Fulfillment of POs in this period", we filter by PO Date.
        # Given "Supply Chain Health" is its own metric (receipt quality), let's keep Quantity stats as "Lifecycle of POs in this period" to match "Filtered PO Value".

        qtys_params = ()
        if start_date:
            ord_query += " WHERE po.po_date >= ?"
            dsp_query += " WHERE po.po_date >= ?"
            # For SRVs, we join back to PO for lifecycle view
            rcd_rej_query = """
                SELECT SUM(si.rcd_qty), SUM(si.rej_qty) 
                FROM srv_items si 
                JOIN purchase_order_items poi ON si.po_number = poi.po_number AND si.po_item_no = poi.po_item_no
                JOIN purchase_orders po ON poi.po_number = po.po_number
                WHERE po.po_date >= ?
            """
            qtys_params = (start_date,)
        else:
            rcd_rej_query = "SELECT SUM(rcd_qty), SUM(rej_qty) FROM srv_items"

        total_ord_qty = db.execute(ord_query, qtys_params).fetchone()[0] or 0.0
        total_dsp_qty = db.execute(dsp_query, qtys_params).fetchone()[0] or 0.0

        rcd_rej_row = db.execute(rcd_rej_query, qtys_params).fetchone()
        total_rcd_qty = rcd_rej_row[0] if rcd_rej_row and rcd_rej_row[0] else 0.0
        total_rej_qty = rcd_rej_row[1] if rcd_rej_row and rcd_rej_row[1] else 0.0

        # 7. Recent Activity (Consolidated)
        # Using shared helper to include POs, DCs, and Invoices
        recent_activity = _fetch_recent_activity(db, 5)

        # 8. Performance Data (Consolidated)
        # Momentum Trend: Linked to Time Range
        from datetime import timedelta

        return {
            "total_sales_month": total_sales,
            "sales_growth": 0.0,  # Placeholder as trend logic removed/simplified
            "pending_pos": active_pos_count,
            "new_pos_today": new_pos_today,
            "active_challans": active_challans,
            "active_challans_growth": "0%",  # Placeholder
            "total_po_value": total_po_value,
            "po_value_growth": 0.0,  # Placeholder
            "total_ord_qty": total_ord_qty,
            "total_dsp_qty": total_dsp_qty,
            "total_rcd_qty": total_rcd_qty,
            "total_rej_qty": total_rej_qty,
            "avg_lead_time": AnalyticsService.get_lead_time_analysis(db, start_date),
            "supply_health_score": AnalyticsService.get_supply_health_score(db, start_date),  # Pass Filter
            "rejection_profile": AnalyticsService.get_rejection_profile(db, limit=10, start_date=start_date),
            "fulfillment_trends": AnalyticsService.get_fulfillment_trends(db, start_date=start_date),
            "recent_activity": recent_activity,
            "performance_data": [],  # Explicitly empty as section removed
        }
    except Exception as e:
        import traceback

        traceback.print_exc()
        raise internal_error(str(e), e)


@router.get("/activity")
def get_recent_activity(limit: int = 10, db: sqlite3.Connection = Depends(get_db)) -> list[dict[str, Any]]:
    """Get recent activity (POs, DCs, Invoices)"""
    try:
        return _fetch_recent_activity(db, limit)

    except Exception as e:
        raise internal_error(str(e), e)


@router.get("/insights")
def get_dashboard_insights(db: sqlite3.Connection = Depends(get_db)):
    """
    Get deterministic insights/alerts based on business rules.
    Replaces the old AI-based insights.
    """
    insights = []

    try:
        # Rule 1: Pending POs
        pending_pos = db.execute("SELECT COUNT(*) FROM purchase_orders WHERE po_status = 'New' OR po_status IS NULL").fetchone()[0]
        if pending_pos > 5:
            insights.append(
                {
                    "type": "warning",
                    "text": f"{pending_pos} Purchase Orders pending approval",
                    "action": "view_pending",
                }
            )

        # Rule 2: Uninvoiced Challans
        uninvoiced = db.execute("""
            SELECT COUNT(DISTINCT dc.dc_number)
            FROM delivery_challans dc
            LEFT JOIN gst_invoices i ON dc.dc_number = i.dc_number
            WHERE i.invoice_number IS NULL
        """).fetchone()[0]

        if uninvoiced > 0:
            insights.append(
                {
                    "type": "success" if uninvoiced < 10 else "warning",
                    "text": f"{uninvoiced} Challans ready for invoicing",
                    "action": "view_uninvoiced",
                }
            )

        # Rule 3: Recent Rejections (SRV)
        recent_rejections = db.execute("""
            SELECT COUNT(*) FROM srv_items 
            WHERE rej_qty > 0 
            AND created_at >= date('now', '-7 days')
        """).fetchone()[0]

        if recent_rejections > 0:
            insights.append(
                {
                    "type": "error",
                    "text": f"{recent_rejections} items rejected in last 7 days",
                    "action": "view_srv",
                }
            )

        # Fallback if quiet
        if not insights:
            insights.append(
                {
                    "type": "success",
                    "text": "All systems operational. No immediate alerts.",
                    "action": "none",
                }
            )

        return insights

    except Exception:
        # Fail gracefully
        return [{"type": "error", "text": "System alert check failed", "action": "none"}]
