import sqlite3
from datetime import datetime, timedelta


class AnalyticsService:
    @staticmethod
    def get_rejection_profile(db: sqlite3.Connection, limit: int = 10, start_date: str | None = None):
        """Top materials by rejection rate

        Args:
            start_date: Filter SRVs from this date onwards (Performance View)
        """
        query = """
            SELECT 
                COALESCE(poi.material_description, poi.material_code) as material,
                SUM(si.rcd_qty) as total_received,
                SUM(si.rej_qty) as total_rejected,
                MAX(si.po_number) as example_po_number,
                CASE 
                    WHEN SUM(si.rcd_qty) > 0 THEN (CAST(SUM(si.rej_qty) AS FLOAT) * 100.0 / SUM(si.rcd_qty))
                    ELSE 0.0 
                END as rejection_rate
            FROM srv_items si
            JOIN purchase_order_items poi ON si.po_number = poi.po_number AND si.po_item_no = poi.po_item_no
            JOIN srvs s ON si.srv_number = s.srv_number
            WHERE 1=1
        """
        params = []
        if start_date:
            query += " AND s.srv_date >= ?"
            params.append(start_date)

        query += """
            GROUP BY material
            HAVING SUM(si.rcd_qty) > 0
            ORDER BY rejection_rate DESC
            LIMIT ?
        """
        params.append(limit)

        rows = db.execute(query, tuple(params)).fetchall()
        return [
            {"material": row[0], "total_received": row[1], "total_rejected": row[2], "example_po_number": row[3], "rejection_rate": row[4]}
            for row in rows
        ]

    @staticmethod
    def get_lead_time_analysis(db: sqlite3.Connection, start_date: str | None = None):
        """Average days from PO Date to first SRV Date"""
        query = """
            WITH first_srv AS (
                SELECT po_number, MIN(srv_date) as first_srv_date
                FROM srvs
                GROUP BY po_number
            )
            SELECT 
                AVG(julianday(fs.first_srv_date) - julianday(po.po_date)) as avg_lead_time_days
            FROM first_srv fs
            JOIN purchase_orders po ON fs.po_number = po.po_number
            WHERE po.po_date IS NOT NULL AND fs.first_srv_date IS NOT NULL
        """
        params = []
        if start_date:
            query += " AND po.po_date >= ?"
            params.append(start_date)

        result = db.execute(query, tuple(params)).fetchone()
        return round(float(result[0]), 2) if result and result[0] is not None else 0.0

    @staticmethod
    def get_fulfillment_trends(db: sqlite3.Connection, start_date: str | None = None):
        """Monthly Ordered vs Accepted quantities"""
        # Default to 6 months if no start_date provided
        if not start_date:
            start_date = (datetime.now() - timedelta(days=180)).strftime("%Y-%m-%d")

        query = """
            SELECT 
                strftime('%Y-%m', po.po_date) as month,
                SUM(poi.ord_qty) as ordered_qty,
                SUM(poi.rcd_qty) as accepted_qty
            FROM purchase_order_items poi
            JOIN purchase_orders po ON poi.po_number = po.po_number
            WHERE po.po_date >= ?
            GROUP BY month
            ORDER BY month ASC
        """
        rows = db.execute(query, (start_date,)).fetchall()
        return [{"month": row[0], "ordered_qty": row[1], "accepted_qty": row[2]} for row in rows]

    @staticmethod
    def get_supply_health_score(db: sqlite3.Connection, start_date: str | None = None):
        """Weight-based health score (higher rejection lowers score)

        Filters by PO Date to match quantity lifecycle in dashboard.
        """
        query = """
            SELECT 
                COALESCE(SUM(si.rcd_qty), 0) as total_rcd,
                COALESCE(SUM(si.rej_qty), 0) as total_rej
            FROM srv_items si
            JOIN purchase_order_items poi ON si.po_number = poi.po_number AND si.po_item_no = poi.po_item_no
            JOIN purchase_orders po ON poi.po_number = po.po_number
            WHERE 1=1
        """
        params = []
        if start_date:
            query += " AND po.po_date >= ?"
            params.append(start_date)

        row = db.execute(query, tuple(params)).fetchone()

        if not row or row[0] == 0:
            return 100.0

        rejection_rate = (row[1] / row[0]) * 100
        health_score = max(0, 100 - (rejection_rate * 5))  # Aggressive penalty for rejections
        return round(health_score, 1)
