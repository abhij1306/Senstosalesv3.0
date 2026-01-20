import logging
import sqlite3

from fastapi import APIRouter, Depends

from backend.core.utils import get_financial_year
from backend.db.session import get_db
from backend.services.status_service import calculate_entity_status

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/", response_model=dict)
def global_search(q: str, db: sqlite3.Connection = Depends(get_db)):
    """Search across POs, DCs, and Invoices using strict, precise logic."""
    results = []

    if not q:
        return {"results": []}

    # ============================================================
    # PRECISION SEARCH STRATEGY
    # ============================================================
    # 1. Document Numbers: ALWAYS usage PREFIX matching (q%)
    # 2. Party Names: Only search if query is NOT strictly numeric (avoids "Sector 3" matching "3")
    # 3. Metadata (Code, Drg, Cat): 
    #    - If Numeric: Only search if len >= 4 (avoids noise like matching Cat "100" with "1")
    #    - If Text: Always search (allows searching "SCREW", "DWG-A")
    # ============================================================
    
    prefix_search = f"{q}%"
    fuzzy_search = f"%{q}%"
    
    is_numeric = q.isdigit()
    
    # RULE 1: If numeric, DO NOT search party names (addresses often contain numbers)
    search_party = not is_numeric
    
    # RULE 2: If numeric, use STRICT PREFIX matching for metadata to be precise yet inclusive.
    # Allow 3+ digits (e.g., "700") to match "700140", but encoded strictly to avoid noise.
    # If text, continue using fuzzy matching.
    search_metadata = (not is_numeric) or (is_numeric and len(q) >= 3)
    
    # Define the pattern to use for metadata
    metadata_pattern = prefix_search if is_numeric else fuzzy_search

    try:
        # --------------------------------------------------------
        # 1. Search POs
        # --------------------------------------------------------
        po_query = """
            WITH po_items_agg AS (
                SELECT po_number, COUNT(*) as t_items, SUM(ord_qty) as t_ord
                FROM purchase_order_items
                GROUP BY po_number
            ),
            po_del_agg AS (
                SELECT poi.po_number, SUM(dci.dsp_qty) as t_del
                FROM delivery_challan_items dci 
                JOIN purchase_order_items poi ON dci.po_item_id = poi.id 
                GROUP BY poi.po_number
            ),
            po_recd_agg AS (
                SELECT po_number, SUM(rcd_qty) as t_recd
                FROM srv_items 
                GROUP BY po_number
            )
            SELECT po.po_number, po.po_date as date, po.supplier_name as party, po.po_value as amount,
                   COALESCE(i.t_items, 0) as t_items,
                   COALESCE(i.t_ord, 0) as t_ord,
                   COALESCE(d.t_del, 0) as t_del,
                   COALESCE(r.t_recd, 0) as t_recd
            FROM purchase_orders po
            LEFT JOIN po_items_agg i ON po.po_number = i.po_number
            LEFT JOIN po_del_agg d ON po.po_number = d.po_number
            LEFT JOIN po_recd_agg r ON CAST(po.po_number AS TEXT) = CAST(r.po_number AS TEXT)
            WHERE (CAST(po.po_number AS TEXT) LIKE ? 
        """
        
        po_params = [prefix_search]
        
        if search_party:
            po_query += " OR po.supplier_name LIKE ?"
            po_params.append(fuzzy_search)
            
        if search_metadata:
            po_query += """
               OR EXISTS (
                   SELECT 1 FROM purchase_order_items poi 
                   WHERE poi.po_number = po.po_number 
                   AND (poi.material_code LIKE ? OR poi.drg_no LIKE ? OR CAST(poi.mtrl_cat AS TEXT) LIKE ?)
               )
            """
            po_params.extend([metadata_pattern, metadata_pattern, metadata_pattern])
            
        po_query += (
            ") ORDER BY CASE WHEN CAST(po.po_number AS TEXT) = ? THEN 0 "
            "WHEN CAST(po.po_number AS TEXT) LIKE ? THEN 1 ELSE 2 END, "
            "po.po_number DESC LIMIT 5"
        )
        po_params.append(q)
        po_params.append(prefix_search)

        cursor = db.execute(po_query, tuple(po_params))
        for row in cursor.fetchall():
            d = dict(row)
            po_num = d["po_number"]
            # Fetch linked DCs
            dc_rows = db.execute("SELECT dc_number FROM delivery_challans WHERE po_number = ?", (po_num,)).fetchall()
            dc_numbers = [r["dc_number"] for r in dc_rows] if dc_rows else []
            # Fetch linked Invoices (via DCs)
            inv_rows = db.execute("""
                SELECT DISTINCT inv.invoice_number FROM gst_invoices inv
                JOIN delivery_challans dc ON inv.dc_number = dc.dc_number
                WHERE dc.po_number = ?
            """, (po_num,)).fetchall()
            invoice_numbers = [r["invoice_number"] for r in inv_rows] if inv_rows else []
            # Fetch linked SRVs
            srv_rows = db.execute("SELECT srv_number FROM srvs WHERE po_number = ?", (po_num,)).fetchall()
            srv_numbers = [r["srv_number"] for r in srv_rows] if srv_rows else []
            
            # Identify Match Context (Why did we find this PO?)
            # If the header didn't match, check the items for the metadata match
            match_context = None
            if q not in str(po_num) and search_metadata:
                 # Check what matched
                 meta_match = db.execute("""
                    SELECT material_code, drg_no, mtrl_cat FROM purchase_order_items 
                    WHERE po_number = ? AND (material_code LIKE ? OR drg_no LIKE ? OR CAST(mtrl_cat AS TEXT) LIKE ?)
                    LIMIT 1
                 """, (po_num, metadata_pattern, metadata_pattern, metadata_pattern)).fetchone()
                 
                 if meta_match:
                     # Use lowercase for robust checking (SQL matches are case-insensitive)
                     q_lower = q.lower()
                     if meta_match['drg_no'] and q_lower in str(meta_match['drg_no']).lower():
                         match_context = f"Drg: {meta_match['drg_no']}"
                     elif meta_match['material_code'] and q_lower in str(meta_match['material_code']).lower():
                         match_context = f"Code: {meta_match['material_code']}"
                     elif meta_match['mtrl_cat'] and q_lower in str(meta_match['mtrl_cat']).lower():
                         match_context = f"Cat: {meta_match['mtrl_cat']}"

            # Check if this PO has any unresolved deviations
            dev_exists = db.execute(
                "SELECT 1 FROM deviations WHERE po_number = ? AND is_resolved = 0 LIMIT 1",
                (str(po_num),)
            ).fetchone()

            results.append(
                {
                    "id": str(d["po_number"]),
                    "number": str(d["po_number"]),
                    "type": "PO",
                    "title": f"PO #{d['po_number']}",
                    "subtitle": d["party"] or "Unknown",
                    "description": f"Date: {d['date'] or 'N/A'} | Amount: ₹{d['amount'] or 0}",
                    "status": calculate_entity_status(d["t_ord"], d["t_del"], d["t_recd"]),
                    "total_items": d["t_items"],
                    "total_qty": d["t_ord"],
                    "amount": d["amount"],
                    "dc_numbers": dc_numbers,
                    "invoice_numbers": invoice_numbers,
                    "srv_numbers": srv_numbers,
                    "match_context": match_context,
                    "has_deviations": bool(dev_exists),
                }
            )

        # --------------------------------------------------------
        # 2. Search DCs
        # --------------------------------------------------------
        dc_query = """
            WITH dc_del_agg AS (
                SELECT dc_number, SUM(dsp_qty) as t_del
                FROM delivery_challan_items 
                GROUP BY dc_number
            ),
            dc_recd_agg AS (
                SELECT challan_no, SUM(rcd_qty) as t_recd
                FROM srv_items 
                GROUP BY challan_no
            ),
            dc_ord_agg AS (
                SELECT dci.dc_number, SUM(poi.ord_qty) as t_ord
                FROM delivery_challan_items dci 
                JOIN purchase_order_items poi ON dci.po_item_id = poi.id 
                GROUP BY dci.dc_number
            )
            SELECT dc.dc_number, dc.dc_date as date, dc.consignee_name as party, dc.po_number,
                   COALESCE(d.t_del, 0) as t_del,
                   COALESCE(r.t_recd, 0) as t_recd,
                   COALESCE(o.t_ord, 0) as t_ord
            FROM delivery_challans dc
            LEFT JOIN dc_del_agg d ON dc.dc_number = d.dc_number
            LEFT JOIN dc_recd_agg r ON dc.dc_number = r.challan_no
            LEFT JOIN dc_ord_agg o ON dc.dc_number = o.dc_number
            WHERE (CAST(dc.dc_number AS TEXT) LIKE ? 
        """
        
        dc_params = [prefix_search]

        if search_party:
            dc_query += " OR dc.consignee_name LIKE ?"
            dc_params.append(fuzzy_search)
            
        if search_metadata:
            dc_query += """
               OR EXISTS (
                   SELECT 1 FROM delivery_challan_items dci 
                   JOIN purchase_order_items poi ON dci.po_item_id = poi.id
                   WHERE dci.dc_number = dc.dc_number 
                   AND (poi.material_code LIKE ? OR poi.drg_no LIKE ? OR CAST(poi.mtrl_cat AS TEXT) LIKE ?)
               )
            """
            dc_params.extend([fuzzy_search, fuzzy_search, fuzzy_search])
            
        dc_query += (
            ") ORDER BY CASE WHEN CAST(dc.dc_number AS TEXT) = ? THEN 0 "
            "WHEN CAST(dc.dc_number AS TEXT) LIKE ? THEN 1 ELSE 2 END, "
            "dc.dc_number DESC LIMIT 5"
        )
        dc_params.append(q)
        dc_params.append(prefix_search)

        cursor = db.execute(dc_query, tuple(dc_params))
        for row in cursor.fetchall():
            d = dict(row)
            dc_num = d["dc_number"]
            # Fetch linked invoice from DC
            invoice_number = None
            invoice_row = db.execute("SELECT invoice_number FROM gst_invoices WHERE dc_number = ?", (dc_num,)).fetchone()
            if invoice_row:
                invoice_number = invoice_row["invoice_number"]
            # Fetch linked SRVs via srv_items
            srv_rows = db.execute("SELECT DISTINCT srv_number FROM srv_items WHERE challan_no = ?", (dc_num,)).fetchall()
            srv_numbers = [r["srv_number"] for r in srv_rows] if srv_rows else []
            # Calculate total value from items (dsp_qty * po_rate)
            total_value = 0
            value_row = db.execute("""
                SELECT SUM(dci.dsp_qty * COALESCE(poi.po_rate, 0)) as total_val
                FROM delivery_challan_items dci
                LEFT JOIN purchase_order_items poi ON dci.po_item_id = poi.id
                WHERE dci.dc_number = ?
            """, (dc_num,)).fetchone()
            if value_row and value_row["total_val"]:
                total_value = value_row["total_val"]
            # Check if this DC has any unresolved deviations
            # Deviations can be associated with dc_item or linked srv_item
            dev_exists = db.execute(
                """
                SELECT 1 FROM deviations 
                WHERE (entity_type = 'dc_item' AND entity_id IN (SELECT id FROM delivery_challan_items WHERE dc_number = ?))
                OR (entity_type = 'srv_item' AND entity_id IN (SELECT id FROM srv_items WHERE challan_no = ?))
                AND is_resolved = 0 LIMIT 1
                """,
                (str(dc_num), str(dc_num))
            ).fetchone()

            results.append(
                {
                    "id": str(d["dc_number"]),
                    "number": str(d["dc_number"]),
                    "type": "DC",
                    "title": f"DC{d['dc_number']} (FY {get_financial_year(d['date']) if d['date'] else 'N/A'})",
                    "subtitle": d["party"] or "Unknown",
                    "description": f"Date: {d['date'] or 'N/A'} | PO: {d['po_number']}",
                    "status": calculate_entity_status(d["t_ord"], d["t_del"], d["t_recd"]),
                    "po_number": d["po_number"],
                    "invoice_number": invoice_number,
                    "srv_numbers": srv_numbers,
                    "total_qty": d["t_del"],
                    "total_value": total_value,
                    "total_ordered": d["t_ord"],
                    "dc_number": d["dc_number"],
                    "has_deviations": bool(dev_exists),
                }
            )

        # --------------------------------------------------------
        # 3. Search Invoices
        # --------------------------------------------------------
        inv_query = """
            WITH inv_items_agg AS (
                SELECT invoice_number, SUM(quantity) as qty
                FROM gst_invoice_items 
                GROUP BY invoice_number
            ),
            inv_recd_agg AS (
                SELECT s.invoice_number, SUM(si.rcd_qty) as t_recd
                FROM srv_items si 
                JOIN srvs s ON si.srv_number = s.srv_number 
                GROUP BY s.invoice_number
            )
            SELECT inv.invoice_number, inv.invoice_date as date, inv.total_invoice_value as amount, inv.dc_number, inv.buyer_name as party,
                   COALESCE(i.qty, 0) as t_del,
                   COALESCE(r.t_recd, 0) as t_recd,
                   COALESCE(i.qty, 0) as t_ord
            FROM gst_invoices inv
            LEFT JOIN inv_items_agg i ON inv.invoice_number = i.invoice_number
            LEFT JOIN inv_recd_agg r ON inv.invoice_number = r.invoice_number
            WHERE (CAST(inv.invoice_number AS TEXT) LIKE ? 
        """
        
        inv_params = [prefix_search]

        if search_party:
            inv_query += " OR inv.buyer_name LIKE ?"
            inv_params.append(fuzzy_search)
        
        if search_metadata:
            inv_query += """
               OR EXISTS (
                   SELECT 1 FROM gst_invoice_items gii
                   WHERE gii.invoice_number = inv.invoice_number
                   AND (gii.material_code LIKE ? OR gii.drg_no LIKE ? OR CAST(gii.mtrl_cat AS TEXT) LIKE ?)
               )
            """
            inv_params.extend([fuzzy_search, fuzzy_search, fuzzy_search])
            
        inv_query += (
            ") ORDER BY CASE WHEN CAST(inv.invoice_number AS TEXT) = ? THEN 0 "
            "WHEN CAST(inv.invoice_number AS TEXT) LIKE ? THEN 1 ELSE 2 END, "
            "inv.invoice_number DESC LIMIT 5"
        )
        inv_params.append(q)
        inv_params.append(prefix_search)

        cursor = db.execute(inv_query, tuple(inv_params))
        for row in cursor.fetchall():
            d = dict(row)
            # Fetch linked PO from DC
            po_number = None
            if d["dc_number"]:
                dc_row = db.execute("SELECT po_number FROM delivery_challans WHERE dc_number = ?", (d["dc_number"],)).fetchone()
                if dc_row:
                    po_number = dc_row["po_number"]
            # Check if this Invoice has any unresolved deviations
            dev_exists = db.execute(
                """
                SELECT 1 FROM deviations 
                WHERE (entity_type = 'srv_item' AND entity_id IN (SELECT id FROM srv_items WHERE invoice_no = ?))
                AND is_resolved = 0 LIMIT 1
                """,
                (str(d["invoice_number"]),)
            ).fetchone()

            results.append(
                {
                    "id": str(d["invoice_number"]),
                    "number": str(d["invoice_number"]),
                    "type": "Invoice",
                    "title": f"INV{d['invoice_number']} (FY {get_financial_year(d['date']) if d['date'] else 'N/A'})",
                    "subtitle": d["party"] or "Client",
                    "description": f"Date: {d['date'] or 'N/A'} | Amount: ₹{d['amount'] or 0}",
                    "status": calculate_entity_status(d["t_ord"], d["t_del"], d["t_recd"]),
                    "total_qty": d["t_del"],
                    "total_value": d["amount"],
                    "dc_number": d["dc_number"],
                    "po_number": po_number,
                    "invoice_number": d["invoice_number"],
                    "has_deviations": bool(dev_exists),
                }
            )

        # --------------------------------------------------------
        # 4. Search SRVs
        # --------------------------------------------------------
        srv_query = """
            WITH srv_items_agg AS (
                SELECT srv_number, 
                       SUM(ord_qty) as t_ord,
                       SUM(rcd_qty) as t_acc, 
                       SUM(rej_qty) as t_rej,
                       SUM(rcd_qty) as t_del
                FROM srv_items 
                GROUP BY srv_number
            )
            SELECT s.srv_number, s.srv_date as date, s.po_number, s.invoice_number,
                   COALESCE(i.t_ord, 0) as t_ord,
                   COALESCE(i.t_acc, 0) as t_acc,
                   COALESCE(i.t_rej, 0) as t_rej,
                   COALESCE(i.t_del, 0) as t_del
            FROM srvs s
            LEFT JOIN srv_items_agg i ON s.srv_number = i.srv_number
            WHERE (CAST(s.srv_number AS TEXT) LIKE ? 
        """
        
        srv_params = [prefix_search]
        
        # NOTE: For SRV, we always search PO Number mostly because it's a primary ID often used to find SRVs
        # But we respect the numeric rule to avoid noise from partial matches if it's a short text
        if is_numeric:
             srv_query += " OR CAST(s.po_number AS TEXT) LIKE ?"
             srv_params.append(prefix_search) # Prefix for PO in SRV search too
        else:
             srv_query += " OR CAST(s.po_number AS TEXT) LIKE ?"
             srv_params.append(fuzzy_search) # Relaxed for text (though PO is usually numeric)

        if search_metadata:
            srv_query += """
               OR EXISTS (
                   SELECT 1 FROM srv_items si
                   JOIN purchase_order_items poi ON si.po_number = poi.po_number AND si.po_item_no = poi.po_item_no
                   WHERE si.srv_number = s.srv_number
                   AND (poi.material_code LIKE ? OR poi.drg_no LIKE ? OR CAST(poi.mtrl_cat AS TEXT) LIKE ?)
               )
            """
            srv_params.extend([fuzzy_search, fuzzy_search, fuzzy_search])
            
        srv_query += (
            ") ORDER BY CASE WHEN CAST(s.srv_number AS TEXT) = ? THEN 0 "
            "WHEN CAST(s.srv_number AS TEXT) LIKE ? THEN 1 ELSE 2 END, "
            "s.srv_number DESC LIMIT 5"
        )
        srv_params.append(q)
        srv_params.append(prefix_search)

        cursor = db.execute(srv_query, tuple(srv_params))
        for row in cursor.fetchall():
            d = dict(row)
            # Fetch dc_number from srv_items
            dc_row = db.execute("SELECT DISTINCT challan_no FROM srv_items WHERE srv_number = ?", (d["srv_number"],)).fetchone()
            dc_number = dc_row["challan_no"] if dc_row else None
            # Check if linked documents exist
            # Optimized checks
            po_exists = (
                bool(db.execute("SELECT 1 FROM purchase_orders WHERE po_number = ?", (d["po_number"],)).fetchone()) 
                if d["po_number"] else False
            )
            dc_exists = bool(db.execute("SELECT 1 FROM delivery_challans WHERE dc_number = ?", (dc_number,)).fetchone()) if dc_number else False
            invoice_exists = (
                bool(db.execute("SELECT 1 FROM gst_invoices WHERE invoice_number = ?", (d["invoice_number"],)).fetchone()) 
                if d["invoice_number"] else False
            )
            
            # Check if this SRV has any unresolved deviations
            dev_exists = db.execute(
                """
                SELECT 1 FROM deviations 
                WHERE (entity_type = 'srv' AND entity_id = ?)
                OR (entity_type = 'srv_item' AND entity_id LIKE ?)
                AND is_resolved = 0 LIMIT 1
                """,
                (str(d["srv_number"]), f"{d['srv_number']}\_%")
            ).fetchone()

            results.append(
                {
                    "id": str(d["srv_number"]),
                    "number": str(d["srv_number"]),
                    "type": "SRV",
                    "title": f"SRV #{d['srv_number']}",
                    "subtitle": f"PO #{d['po_number']}",
                    "description": f"Date: {d['date'] or 'N/A'} | Inv: {d['invoice_number'] or 'N/A'}",
                    "status": calculate_entity_status(d["t_ord"], d["t_acc"], d["t_acc"]),
                    "po_number": d["po_number"],
                    "invoice_number": d["invoice_number"],
                    "dc_number": dc_number,
                    "po_exists": po_exists,
                    "dc_exists": dc_exists,
                    "invoice_exists": invoice_exists,
                    "accepted_qty": d["t_acc"],
                    "rejected_qty": d["t_rej"],
                    "ordered_qty": d["t_ord"],
                    "has_deviations": bool(dev_exists),
                }
            )

    except Exception as e:
        logger.error(f"Search failed: {e}")
        return {"results": []}

    return {"results": results}
