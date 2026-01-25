"""
PO Ingestion Service - Writes scraper output to database
Normalizes data into items and deliveries tables
"""

import logging
import sqlite3
import uuid

from backend.core.date_utils import normalize_date
from backend.core.number_utils import safe_to_int, to_float, to_int, to_qty

logger = logging.getLogger(__name__)


def to_money(val) -> float:
    """Enforce SA-2: 2 Decimal Precision"""
    try:
        return round(float(val), 2)
    except (ValueError, TypeError):
        return 0.00


class POIngestionService:
    """Handles PO data ingestion from scraper to database"""

    def ingest_po(self, db: sqlite3.Connection, po_header: dict, po_items: list[dict]) -> tuple[bool, list[str]]:
        """
        Ingest PO from scraper output.
        Normalizes data: unique items + delivery schedules

        Args:
            db: Active database connection
            po_header: Dictionary containing PO header details
            po_items: List of dictionaries containing PO item details

        Returns: (success, warnings)
        """
        if not po_items:
            raise ValueError("Scraper returned zero items for this PO. Aborting ingestion.")

        po_number = str(po_header.get('PURCHASE ORDER', '')).strip()
        logger.debug(f"Starting PO ingestion: header fields={len(po_header)}, items={len(po_items)}, PO={po_number}")
        logger.debug(f"PO items to process: {[item.get('PO ITM') for item in po_items]}")

        warnings = []
        processed_item_ids = []

        try:
            # 1. Extract & Sanitize PO number
            po_number = str(po_header.get("PURCHASE ORDER", "")).strip()
            if not po_number:
                raise ValueError("Missing PO Number in header")

            po_header["PURCHASE ORDER"] = po_number  # Ensure internal consistency

            # 2. Find Buyer (Use default buyer since buyers table doesn't track department/supplier)
            buyer_row = db.execute("SELECT id FROM buyers WHERE is_default = 1").fetchone()
            if not buyer_row:
                buyer_row = db.execute("SELECT id FROM buyers LIMIT 1").fetchone()

            buyer_id = buyer_row[0] if buyer_row else None

            # 3. Check for Existing PO
            existing = db.execute(
                "SELECT po_number, amend_no FROM purchase_orders WHERE po_number = ?",
                (po_number,),
            ).fetchone()

            if existing:
                warnings.append(f"⚠️ PO {po_number} already exists (Amendment {existing['amend_no']}). Updating...")
            
            status_type = "OVERWRITE" if existing else "NEW"

            # 4. Prepare Header Data
            from backend.core.utils import get_financial_year

            po_date = normalize_date(po_header.get("PO DATE"))
            financial_year = get_financial_year(po_date) if po_date else "2025-26"

            header_data = {
                "po_number": po_number,
                "po_date": po_date,
                "buyer_id": buyer_id,
                "supplier_name": po_header.get("SUPP NAME M/S") or po_header.get("supplier_name"),
                "supplier_gstin": po_header.get("TIN NO") or po_header.get("supplier_gstin"),  # Scraper often finds TIN as GSTIN
                "supplier_code": po_header.get("SUPP CODE"),
                "supplier_phone": po_header.get("PHONE"),
                "supplier_fax": po_header.get("FAX"),
                "supplier_email": po_header.get("EMAIL") or po_header.get("WEBSITE"),
                "department_no": to_int(po_header.get("DVN")),
                "enquiry_no": po_header.get("ENQUIRY"),
                "enquiry_date": normalize_date(po_header.get("ENQ DATE")),
                "quotation_ref": po_header.get("QUOTATION"),
                "quotation_date": normalize_date(po_header.get("QUOT-DATE")),
                "rc_no": po_header.get("RC NO"),
                "order_type": po_header.get("ORD-TYPE"),
                "po_status": po_header.get("PO STATUS") or "Open",
                "tin_no": po_header.get("TIN NO"),
                "ecc_no": po_header.get("ECC NO"),
                "mpct_no": po_header.get("MPCT NO"),
                "po_value": to_money(po_header.get("PO-VALUE")),
                "fob_value": to_money(po_header.get("FOB VALUE")),
                "ex_rate": to_float(po_header.get("EX RATE")),
                "currency": po_header.get("CURRENCY"),
                "net_po_value": to_money(po_header.get("NET PO VAL")),
                "amend_no": safe_to_int(po_header.get("AMEND NO"), 0),
                "remarks": po_header.get("REMARKS"),
                "our_ref": po_header.get("OUR_REF"),
                "issuer_name": po_header.get("NAME"),
                "issuer_designation": po_header.get("DESIGNATION"),
                "issuer_phone": po_header.get("PHONE NO"),
                "inspection_by": po_header.get("INSPECTION BY"),
                "inspection_at": po_header.get("INSPECTION AT BHEL"),
                "consignee_name": po_header.get("CONSIGNEE_NAME"),
                "consignee_address": po_header.get("CONSIGNEE_ADDRESS"),
                "financial_year": financial_year,
            }

            # 5. Upsert Header
            # Column list for insertion (must match keys and placeholders)
            columns = ", ".join(header_data.keys())
            placeholders = ", ".join(["?"] * len(header_data))
            
            # Update part for ON CONFLICT
            update_stmt = ", ".join([f"{col}=excluded.{col}" for col in header_data.keys() if col != "po_number"])

            db.execute(
                f"""
                INSERT INTO purchase_orders ({columns}) 
                VALUES ({placeholders})
                ON CONFLICT(po_number) DO UPDATE SET 
                    {update_stmt},
                    updated_at=CURRENT_TIMESTAMP
                """,
                tuple(header_data.values()),
            )

            # 6. Process Items
            # Fetch existing items for bulk processing
            existing_items_rows = db.execute(
                "SELECT po_item_no, id FROM purchase_order_items WHERE po_number = ?",
                (po_number,)
            ).fetchall()
            existing_item_map = {row["po_item_no"]: row["id"] for row in existing_items_rows}

            # Prepare data containers
            items_to_insert = []
            deliveries_to_insert = []
            # We need to collect tracking data for all these items
            # Since we will rebuild deliveries, we need to know what to keep.

            # First pass: Prepare item data and IDs
            # To perform batch insert, keys must be consistent.
            # We'll define the keys and map values.

            # Since executemany with named parameters (dict) requires consistent keys,
            # we should define the schema of item_data explicitly.

            item_data_keys = [
                "id", "po_number", "po_item_no", "status", "material_code", "material_description",
                "drg_no", "mtrl_cat", "unit", "po_rate", "ord_qty", "rcd_qty", "rej_qty",
                "dsp_qty", "hsn_code", "item_value"
            ]

            # For delivery tracking fetching
            item_ids_to_process = []

            # Temporary storage to link item dict to its deliveries for second pass
            items_with_ids = []

            for item in po_items:
                po_item_no = to_int(item.get("PO ITM"))
                if po_item_no is None:
                    continue

                # Resolve ID
                item_id = existing_item_map.get(po_item_no) or str(uuid.uuid4())
                processed_item_ids.append(item_id)
                item_ids_to_process.append(item_id)

                ord_qty = to_qty(item.get("ORD QTY") or item.get("ord_qty") or 0)
                rcd_qty = to_qty(item.get("RCD QTY") or item.get("rcd_qty") or 0)
                rej_qty = to_qty(item.get("REJ QTY") or item.get("rej_qty") or 0)
                po_rate = to_money(item.get("PO RATE") or item.get("po_rate") or 0)

                # Prepare item dict
                item_vals = {
                    "id": item_id,
                    "po_number": po_number,
                    "po_item_no": po_item_no,
                    "status": "Active",
                    "material_code": item.get("MATERIAL CODE") or item.get("material_code"),
                    "material_description": item.get("DESCRIPTION") or item.get("material_description"),
                    "drg_no": item.get("DRG") or item.get("drg_no"),
                    "mtrl_cat": to_int(item.get("MTRL CAT") or item.get("mtrl_cat")),
                    "unit": item.get("UNIT") or item.get("unit"),
                    "po_rate": po_rate,
                    "ord_qty": ord_qty,
                    "rcd_qty": rcd_qty,
                    "rej_qty": rej_qty,
                    "dsp_qty": to_qty(item.get("DSP QTY") or item.get("dsp_qty") or 0),
                    "hsn_code": item.get("HSN CODE") or item.get("hsn_code"),
                    "item_value": to_money(item.get("ITEM VALUE") or item.get("item_value") or (ord_qty * po_rate)),
                }
                items_to_insert.append(item_vals)

                # Store for delivery processing
                items_with_ids.append((item_id, item, ord_qty))

            # Batch Upsert Items
            if items_to_insert:
                item_cols = ", ".join(item_data_keys)
                item_placeholders = ", ".join([f":{k}" for k in item_data_keys])
                
                # Update part for ON CONFLICT
                # Excluding pk (id) and composite unique key (po_number, po_item_no)
                item_update_stmt = ", ".join([f"{col}=excluded.{col}" for col in item_data_keys if col not in ["po_number", "po_item_no", "id"]])

                db.executemany(
                    f"""
                    INSERT INTO purchase_order_items ({item_cols}) 
                    VALUES ({item_placeholders})
                    ON CONFLICT(po_number, po_item_no) DO UPDATE SET 
                        {item_update_stmt},
                        updated_at=CURRENT_TIMESTAMP
                    """,
                    items_to_insert,
                )

            # 8. Manage Deliveries
            if item_ids_to_process:
                # Batch fetch existing tracking
                placeholders = ",".join(["?"] * len(item_ids_to_process))
                existing_tracking_rows = db.execute(
                    f"SELECT po_item_id, lot_no, dsp_qty, rcd_qty, manual_override_qty FROM purchase_order_deliveries WHERE po_item_id IN ({placeholders})",
                    item_ids_to_process,
                ).fetchall()

                # Map: item_id -> lot_no -> {dsp, rcd, manual}
                tracking_map = {}
                for row in existing_tracking_rows:
                    i_id = row["po_item_id"]
                    l_no = to_int(row["lot_no"])
                    if i_id not in tracking_map:
                        tracking_map[i_id] = {}
                    tracking_map[i_id][l_no] = {
                        "dsp": row["dsp_qty"] or 0,
                        "rcd": row["rcd_qty"] or 0,
                        "manual": row["manual_override_qty"] or 0,
                    }

                # Batch Delete Deliveries
                db.execute(f"DELETE FROM purchase_order_deliveries WHERE po_item_id IN ({placeholders})", item_ids_to_process)

                # Prepare Delivery Inserts
                for item_id, item, ord_qty in items_with_ids:
                    # Iterate through extracted lots
                    deliveries = item.get("deliveries", [])
                    if not deliveries:
                        # Fallback for old scraper or manual items
                        deliveries = [{"LOT NO": 1, "DELY QTY": ord_qty}]

                    item_tracking = tracking_map.get(item_id, {})

                    for dely in deliveries:
                        lot_no = to_int(dely.get("LOT NO") or 1)

                        dely_data = {
                            "id": str(uuid.uuid4()),
                            "po_item_id": item_id,
                            "lot_no": lot_no,
                            "ord_qty": to_qty(dely.get("DELY QTY") or ord_qty),
                            "dely_date": normalize_date(dely.get("DELY DATE")),
                            "entry_allow_date": normalize_date(dely.get("ENTRY ALLOW DATE")),
                            "dest_code": to_int(dely.get("DEST CODE")),
                            "remarks": dely.get("REMARKS"),
                            "manual_override_qty": dely.get("manual_override_qty") or item_tracking.get(lot_no, {}).get("manual", 0),
                            "dsp_qty": 0, # Default
                            "rcd_qty": 0, # Default
                        }
                        deliveries_to_insert.append(dely_data)

                # Batch Insert Deliveries
                if deliveries_to_insert:
                    dely_keys = [
                        "id", "po_item_id", "lot_no", "ord_qty", "dely_date",
                        "entry_allow_date", "dest_code", "remarks",
                        "manual_override_qty", "dsp_qty", "rcd_qty"
                    ]
                    dely_cols = ", ".join(dely_keys)
                    dely_placeholders = ", ".join([f":{k}" for k in dely_keys])

                    db.executemany(
                        f"""
                        INSERT INTO purchase_order_deliveries ({dely_cols})
                        VALUES ({dely_placeholders})
                        """,
                        deliveries_to_insert
                    )

            # 9. Handle Cancelled Items (Amendments)
            if processed_item_ids:
                placeholders = ",".join(["?"] * len(processed_item_ids))
                db.execute(
                    f"""
                    UPDATE purchase_order_items 
                    SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP 
                    WHERE po_number = ? AND id NOT IN ({placeholders})
                    """,
                    [po_number] + processed_item_ids,
                )

            # NOTE: We no longer call sync_po here.
            # Manual PO edits should preserve user-specified values (like dsp_qty).
            # Sync is only triggered when DCs or SRVs are created, not during PO updates.
            if existing:
                print(f"ℹ️ PO {po_number} updated, skipping auto-sync to preserve manual values", flush=True)
            else:
                print(f"ℹ️ New PO upload {po_number}", flush=True)

            warnings.append(f"✅ Ingested PO {po_number} with {len(po_items)} items.")
            return True, warnings, status_type

        except Exception as e:
            print(f"❌ INGESTION ERROR: {type(e).__name__}: {e!s}", flush=True)
            import traceback

            traceback.print_exc()
            raise ValueError(f"Ingestion Failure: {e!s}") from e


# Singleton instance
po_ingestion_service = POIngestionService()
