"""
Reconciliation Service V2 - Optimized
Enforces:
1. Centralized status logic (uses status_service)
2. Status updates only (quantities handled by triggers)
"""

import logging
import sqlite3

from .status_service import calculate_entity_status

logger = logging.getLogger(__name__)

# Tolerance for float comparison
TOLERANCE = 0.001


class ReconciliationServiceV2:
    """Pure reconciliation service with batch optimizations."""

    @staticmethod
    def sync_po(db: sqlite3.Connection, po_number: str):
        """
        Optimized PO Status Update
        
        NOTE: Quantity updates are handled by database triggers:
        - trg_dc_items_dispatch_sync -> updates dsp_qty
        - trg_srv_items_receipt_sync -> updates rcd_qty
        """
        logger.info(f"Syncing PO status for {po_number}")
        
        try:
            # 1. Fetch current quantities from PO Items (updated by triggers)
            # Use dictionary cursor for easier access if needed, or just row
            original_row_factory = db.row_factory
            db.row_factory = sqlite3.Row
            
            items = db.execute(
                """
                SELECT id, ord_qty, dsp_qty, rcd_qty, rej_qty 
                FROM purchase_order_items 
                WHERE po_number = ?
                """,
                (po_number,)
            ).fetchall()
            
            db.row_factory = original_row_factory
            
            if not items:
                return

            item_status_updates = []
            
            total_ordered = 0.0
            total_delivered = 0.0
            total_received = 0.0
            total_rejected = 0.0
            
            # 2. Calculate Item Statuses
            for item in items:
                ord_qty = item['ord_qty'] or 0
                dsp_qty = item['dsp_qty'] or 0
                rcd_qty = item['rcd_qty'] or 0
                rej_qty = item['rej_qty'] or 0
                
                # Aggregate totals
                total_ordered += ord_qty
                total_delivered += dsp_qty
                total_received += rcd_qty
                total_rejected += rej_qty

                # Determine item status
                new_status = calculate_entity_status(ord_qty, dsp_qty, rcd_qty)
                item_status_updates.append((new_status, item['id']))

            # 3. Batch Update Item Statuses
            db.executemany(
                "UPDATE purchase_order_items SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                item_status_updates
            )

            # 3.5 Sync lot table (purchase_order_deliveries) dsp_qty and rcd_qty
            # Both need to be accurate for the lot-level locking in the UI
            
            # Sync rcd_qty (already there, just ensuring it's robust)
            # Sync rcd_qty managed by triggers (trg_srv_items_receipt_sync) and ingest_po
            # Removed aggressive overwrite to preserve PO-uploaded quantities


            # 3.1 Item-level received quantities sync
            # Source of Truth: Sum of all matching srv_items
            db.execute(
                """
                UPDATE purchase_order_items
                SET rcd_qty = COALESCE((
                    SELECT SUM(rcd_qty) 
                    FROM srv_items 
                    WHERE po_number = purchase_order_items.po_number 
                    AND po_item_no = purchase_order_items.po_item_no
                ), 0),
                rej_qty = COALESCE((
                    SELECT SUM(rej_qty) 
                    FROM srv_items 
                    WHERE po_number = purchase_order_items.po_number 
                    AND po_item_no = purchase_order_items.po_item_no
                ), 0)
                WHERE po_number = ?
                """,
                (po_number,)
            )

            # 3.2 Ensure lot tables are clean (Lots only track schedules, not activity)
            db.execute(
                """
                UPDATE purchase_order_deliveries
                SET dsp_qty = 0, rcd_qty = 0, rej_qty = 0
                WHERE po_item_id IN (SELECT id FROM purchase_order_items WHERE po_number = ?)
                """,
                (po_number,)
            )

            # 3.3 Update Item Dispatch (dsp_qty) from DC items
            # CRITICAL: If no DCs exist for an item, we PRESERVE the current dsp_qty 
            # to support manual overrides from the PO Edit page.
            db.execute(
                """
                UPDATE purchase_order_items
                SET dsp_qty = (
                    SELECT SUM(dci.dsp_qty)
                    FROM delivery_challan_items dci
                    WHERE dci.po_item_id = purchase_order_items.id
                ),
                updated_at = CURRENT_TIMESTAMP
                WHERE po_number = ?
                AND EXISTS (
                    SELECT 1 FROM delivery_challan_items dci 
                    WHERE dci.po_item_id = purchase_order_items.id
                )
                """,
                (po_number,)
            )

            # 3.4 Update pending_qty (Source of Truth: ord_qty - dsp_qty)
            db.execute(
                """
                UPDATE purchase_order_items
                SET pending_qty = MAX(0, ord_qty - COALESCE(dsp_qty, 0))
                WHERE po_number = ?
                """,
                (po_number,)
            )

            # 4. Determine PO Level Status
            # Re-fetch aggregated totals for accurate status
            totals = db.execute(
                """
                SELECT SUM(ord_qty) as t_ord, SUM(dsp_qty) as t_dsp, SUM(rcd_qty) as t_rcd, SUM(rej_qty) as t_rej
                FROM purchase_order_items
                WHERE po_number = ?
                """,
                (po_number,)
            ).fetchone()
            
            po_status = calculate_entity_status(totals['t_ord'], totals['t_dsp'], totals['t_rcd'])
            
            # 5. Update PO Status
            db.execute(
                "UPDATE purchase_orders SET po_status = ?, updated_at = CURRENT_TIMESTAMP WHERE po_number = ?",
                (po_status, po_number)
            )
            
        except Exception as e:
            logger.error(f"Error syncing PO {po_number}: {e}")
            raise

    # -------------------------------------------------------------------------
    # Legacy / Passthrough Methods (kept for compatibility)
    # -------------------------------------------------------------------------

    @staticmethod
    def reconcile_po(db: sqlite3.Connection, po_number: str):
        ReconciliationServiceV2.sync_po(db, po_number)

    @staticmethod
    def reconcile_dc(db: sqlite3.Connection, dc_number: str):
        # Fetch PO from DC and sync PO status
        po = db.execute("SELECT po_number FROM delivery_challans WHERE dc_number = ?", (dc_number,)).fetchone()
        if po:
            ReconciliationServiceV2.sync_po(db, po['po_number'])

    @staticmethod
    def reconcile_srv(db: sqlite3.Connection, srv_number: str):
        # Fetch PO from SRV and sync PO status
        po = db.execute("SELECT po_number FROM srvs WHERE srv_number = ?", (srv_number,)).fetchone()
        if po:
            ReconciliationServiceV2.sync_po(db, po['po_number'])

    @staticmethod
    def srv_has_invoice(db: sqlite3.Connection, srv_number: str) -> bool:
        """Check if SRV has an invoice number assigned"""
        row = db.execute("SELECT invoice_no FROM srv_items WHERE srv_number = ? AND invoice_no IS NOT NULL LIMIT 1", (srv_number,)).fetchone()
        return row is not None


# Alias
ReconciliationService = ReconciliationServiceV2
