import logging
import re

from backend.core.date_utils import normalize_date
from backend.core.number_utils import safe_to_float, safe_to_int, to_float, to_int
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# Regex
RX_LABEL_ONLY = re.compile(r"^[A-Z\s/-]{3,}$")
# Regex to find Drawing No in description
# Matches "DRG: 123", "DRAWING: 123", "DRAWING NO 123", "DRG. NO. 123", "DRG. 123", "TO DRG. 123"
# Refined to stop before "ITEM", "VAR", "REV" to avoid capturing "3253020460ITEM"
RX_DRG_IN_DESC = re.compile(r"(?:DRG|DRAWING)[ \.\-]*(?:NO[\.\-]*)?[\:\-]?\s*([A-Z0-9][A-Z0-9\.\-/]*?)(?=\s|ITEM|VAR|REV|,|$)", re.IGNORECASE)


def clean(text):
    if not text:
        return ""
    # Normalize non-breaking spaces and multi-spaces
    text = text.replace("\xa0", " ")
    return re.sub(r"\s+", " ", text).strip()


def has_value(text):
    return bool(text and any(c.isalnum() for c in text))


def validate_po_data(header: dict, items: list[dict]):
    """Ensure we didn't ingest 'garbage' by checking for critical identifiers."""
    po_no = header.get("PURCHASE ORDER")
    if not po_no or not re.search(r"\d{7}", str(po_no)):
        logger.warning(f"Suspect PO Number extracted: {po_no}")
        return False

    if not items:
        logger.warning(f"No items found for PO {po_no}")
        return False

    for idx, item in enumerate(items):
        if not item.get("MATERIAL CODE") or len(str(item.get("MATERIAL CODE"))) < 5:
            logger.warning(f"Invalid Material Code in Item {idx + 1} for PO {po_no}")
            return False

    return True


def extract_po_header(soup: BeautifulSoup) -> dict:
    tables = soup.find_all("table")
    header = {}

    def find_value(label_rx, prefer="any", allow_label_like=False):
        label_found = False
        final_empty_match = False

        for table in tables:
            rows = table.find_all("tr")
            for r_idx, row in enumerate(rows):
                # Search both td and th
                cells = row.find_all(["td", "th"])
                for c_idx, cell in enumerate(cells):
                    cell_text = clean(cell.get_text())
                    if not re.search(label_rx, cell_text, re.IGNORECASE):
                        continue

                    label_found = True
                    # Inline Check: "Label: Value"
                    inline = re.search(rf"{label_rx}[:\.]?\s*(.+)", cell_text, re.IGNORECASE)

                    found_val = None
                    if inline and has_value(inline.group(1)):
                        val = clean(inline.group(1))
                        if allow_label_like or not RX_LABEL_ONLY.match(val):
                            found_val = val

                    # Adjacent Check
                    if not found_val and prefer in ["adjacent", "any"] and c_idx + 1 < len(cells):
                        val = clean(cells[c_idx + 1].get_text())
                        if has_value(val):
                            if allow_label_like or not RX_LABEL_ONLY.match(val):
                                found_val = val
                        elif prefer != "below":
                            # Found adjacent but empty
                            final_empty_match = True

                    # Below Check
                    if not found_val and r_idx + 1 < len(rows) and prefer in ["below", "any"]:
                        below_cells = rows[r_idx + 1].find_all(["td", "th"])

                        # Standard Case: Check cell at same index (or close to it)
                        if c_idx < len(below_cells):
                            val = clean(below_cells[c_idx].get_text())
                            if has_value(val):
                                if allow_label_like or not RX_LABEL_ONLY.match(val):
                                    found_val = val
                            else:
                                final_empty_match = True

                        # Colspan/Offset Fallback:
                        # If the label has colspan (like REMARKS often does), the value might be in the first cell of the next row
                        # or shifted. If we didn't find a value at c_idx, and checking specifically for REMARKS or similar wide fields,
                        # try looking at the very first cell of the next row if c_idx was 0 or small.
                        if not found_val and "REMARKS" in cell_text.upper():
                            # Remarks text usually spans the whole next row or is the first major cell
                            if below_cells:
                                val_candidate = clean(below_cells[0].get_text())
                                if has_value(val_candidate) and not RX_LABEL_ONLY.match(val_candidate):
                                    found_val = val_candidate

                    if found_val:
                        # Filter out "Details" headers or super long garbage
                        if (
                            found_val.upper().startswith("DETAILS")
                            or "PURCHASE ORDER DETAILS" in found_val.upper()
                            or "ORDER DETAILS" in found_val.upper()
                        ):
                            continue
                        if len(found_val) > 500:  # Increased limit for Remarks
                            pass  # Remarks can be long
                        elif len(found_val) > 200:
                            # Generally headers aren't this long, but REMARKS can be.
                            # If it's not remarks, maybe skip?
                            if "REMARKS" not in cell_text.upper():
                                continue

                        # Fix for PSU Footer Leakage
                        if "GOVERNED BY" in found_val.upper() or "TERMS & CONDITION" in found_val.upper():
                            continue

                        return found_val

        # If we found the label but no value, return explicitly empty string
        # to indicate "field found but empty" vs None "field not found"
        return "" if (final_empty_match or label_found) else None

    # Extraction Map (Robust)
    # Format: Key -> (Regex, Preference, AllowLabelLike)
    fields = {
        "PURCHASE ORDER": (r"PURCHASE\s+ORDER(?:\s+NO[\.]?)?", "any", False),
        "PO DATE": (r"^PO\s+DATE$", "any", False),
        "SUPP NAME M/S": (r"^SUPP\s+NAME\s+M/S$", "below", True),
        "SUPP CODE": (r"^SUPP\s+CODE", "below", False),
        "TIN NO": (r"TIN\s+NO", "any", False),
        "ECC NO": (r"ECC\s+NO", "any", False),
        "MPCT NO": (r"MPCT\s+NO", "any", False),
        # Relaxed Regexes
        "ENQUIRY": (r"^(?:ENQUIRY|ENQ)[\s\.\-\:]*(?:NO[\.]?)?", "any", False),
        "ENQ DATE": (r"^(?:ENQUIRY|ENQ)[\s\.\-\:]*DATE", "any", False),
        "RC NO": (r"^R[\.\s]*C[\.\s\-\:]*(?:NO[\.]?)?", "any", False),
        # End Relaxed
        "QUOTATION": (r"QUOTATION", "any", False),
        "QUOT-DATE": (r"QUOT[\s\-]+DATE", "any", False),
        "PO-VALUE": (r"PO-VALUE", "below", False),
        "NET PO VAL": (r"NET\s+PO\s+VAL", "below", False),
        "FOB VALUE": (r"FOB\s+VALUE", "below", False),
        "DVN": (r"DVN", "below", False),
        "AMEND NO": (r"AMEND\s+NO", "below", False),
        "REMARKS": (r"REMARKS", "below", True),
        "ORD-TYPE": (r"ORD-TYPE", "any", False),
        "PO STATUS": (r"PO\s+STATUS", "any", False),
        "EX RATE": (r"EX\s+RATE", "any", False),
        "CURRENCY": (r"CURRENCY", "any", False),
        "INSPECTION BY": (r"INSPECTION\s+BY", "any", True),
        "INSPECTION AT SITE": (r"INSPECTION\s+AT", "any", True),
        "PHONE": (r"^PHONE(?::)?$", "any", False),
        "FAX": (r"^FAX(?::)?$", "any", False),
        "EMAIL": (r"^EMAIL(?::)?$", "any", False),
        "NAME": (r"^NAME$", "adjacent", True),
        "DESIGNATION": (r"^DESIGNATION$", "adjacent", True),
        "PHONE NO": (r"^PHONE\s+NO$", "adjacent", False),
    }

    for k, config in fields.items():
        rx, pref = config[0], config[1]
        allow_label = config[2] if len(config) > 2 else False

        val = find_value(rx, prefer=pref, allow_label_like=allow_label)
        header[k] = val if val is not None else ""

    # Normalize
    header["PURCHASE ORDER"] = str(header.get("PURCHASE ORDER", "")).strip()
    header["PO DATE"] = normalize_date(header.get("PO DATE"))
    header["PO-VALUE"] = safe_to_float(header.get("PO-VALUE"), label="PO-VALUE")
    header["DVN"] = safe_to_int(header.get("DVN"), label="DVN")
    header["AMEND NO"] = safe_to_int(header.get("AMEND NO"), label="AMEND NO")
    header["ENQ DATE"] = normalize_date(header.get("ENQ DATE"))
    header["QUOT-DATE"] = normalize_date(header.get("QUOT-DATE"))

    return header


def extract_po_items(soup: BeautifulSoup) -> list[dict]:
    tables = soup.find_all("table")
    # Identify item table by "MATERIAL CODE"
    item_table = next((t for t in tables if t.find(string=re.compile("MATERIAL CODE", re.I))), None)
    if not item_table:
        return []

    # Find the header row
    rows = item_table.find_all("tr")
    header_row_idx = -1
    cols_map = {}

    for i, r in enumerate(rows):
        cells = r.find_all(["td", "th"])  # Support TH
        texts = [clean(c.get_text()).upper() for c in cells]
        if "MATERIAL CODE" in texts:
            header_row_idx = i
            # Map column names to indices
            for c_i, txt in enumerate(texts):
                if "PO ITM" in txt:
                    cols_map["PO ITM"] = c_i
                elif "MATERIAL CODE" in txt:
                    cols_map["MATERIAL CODE"] = c_i
                elif "MTRL CAT" in txt:
                    cols_map["MTRL CAT"] = c_i
                elif "UNIT" in txt:
                    cols_map["UNIT"] = c_i
                elif "PO RATE" in txt:
                    cols_map["PO RATE"] = c_i
                elif "ORD QTY" in txt:
                    cols_map["ORD QTY"] = c_i
                elif "RCD QTY" in txt:
                    cols_map["RCD QTY"] = c_i
                elif "REJ QTY" in txt:
                    cols_map["REJ QTY"] = c_i
                elif "LOT NO" in txt:
                    cols_map["LOT NO"] = c_i
                elif "DELY QTY" in txt:
                    cols_map["DELY QTY"] = c_i
                elif "DELY DATE" in txt:
                    cols_map["DELY DATE"] = c_i
                elif "ENTRY ALLOW DATE" in txt:
                    cols_map["ENTRY ALLOW DATE"] = c_i
                elif "DEST CODE" in txt:
                    cols_map["DEST CODE"] = c_i
            break

    if header_row_idx == -1:
        return []

    items = []
    current_item = None

    for row in rows[header_row_idx + 1 :]:
        cells = row.find_all(["td", "th"])
        texts = [clean(c.get_text()) for c in cells]

        # Check if this is an Item Row (first column is number)

        # Helper to get value based on dynamic map
        def get_col(name):
            idx = cols_map.get(name)
            if idx is not None and idx < len(texts):
                return texts[idx]
            return ""

        itm_val = get_col("PO ITM")
        if itm_val and itm_val.isdigit():
            _is_item_root = True
            po_itm_num = to_int(itm_val)

            # Check if item already exists (Multi-row item definition)
            existing_item = next((it for it in items if it["PO ITM"] == po_itm_num), None)

            if existing_item:
                current_item = existing_item
                # Accumulate quantity for multi-row item definitions
                new_qty = safe_to_float(get_col("ORD QTY"), label="ORD QTY")
                if new_qty > 0:
                    current_item["ORDERED QTY"] = safe_to_float(current_item.get("ORDERED QTY", 0)) + new_qty

                # Append delivery lot from this row if present (Deduplicated)
                lot_no_val = get_col("LOT NO")
                if lot_no_val:
                    lot_no = to_int(lot_no_val)
                    if not any(d["LOT NO"] == lot_no for d in current_item["deliveries"]):
                        allow_val = get_col("ENTRY ALLOW DATE")
                        norm_allow = normalize_date(allow_val)
                        current_item["deliveries"].append(
                            {
                                "LOT NO": lot_no,
                                "DELY QTY": to_float(get_col("DELY QTY")),
                                "DELY DATE": normalize_date(get_col("DELY DATE")),
                                "ENTRY ALLOW DATE": norm_allow,
                                "REMARKS": allow_val if not norm_allow and allow_val.strip() else "",
                                "DEST CODE": to_int(get_col("DEST CODE")),
                                "RCD QTY": 0.0,
                                "REJ QTY": 0.0,
                            }
                        )
            else:
                # Start new item structure
                current_item = {
                    "PO ITM": po_itm_num,
                    "MATERIAL CODE": get_col("MATERIAL CODE"),
                    "MTRL CAT": safe_to_int(get_col("MTRL CAT"), label="MTRL CAT"),
                    "UNIT": get_col("UNIT"),
                    "PO RATE": safe_to_float(get_col("PO RATE"), label="PO RATE"),
                    "ORD QTY": safe_to_float(get_col("ORD QTY"), label="ORD QTY"),
                    "RCD QTY": safe_to_float(get_col("RCD QTY"), label="RCD QTY"),
                    "REJ QTY": safe_to_float(get_col("REJ QTY"), label="REJ QTY"),
                    "DESCRIPTION": "",  # Will fill from subsequent rows
                    "DRG": "",
                    "deliveries": [],
                }
                items.append(current_item)

                # Add the first delivery lot from the root row if present
                lot_no = get_col("LOT NO")
                if lot_no:  # Some rows might just be item header? usually includes first lot
                    allow_val = get_col("ENTRY ALLOW DATE")
                    norm_allow = normalize_date(allow_val)
                    current_item["deliveries"].append(
                        {
                            "LOT NO": safe_to_int(lot_no, default=1, label="LOT NO"),
                            "DELY QTY": safe_to_float(get_col("DELY QTY"), label="DELY QTY"),
                            "DELY DATE": normalize_date(get_col("DELY DATE")),
                            "ENTRY ALLOW DATE": norm_allow,
                            "REMARKS": allow_val if not norm_allow and allow_val.strip() else "",
                            "DEST CODE": safe_to_int(get_col("DEST CODE"), label="DEST CODE"),
                            "RCD QTY": 0.0,
                            "REJ QTY": 0.0,
                        }
                    )

        elif current_item:
            # Continuation Row (Description OR Delivery Lot)
            # Check if it looks like a delivery lot (empty Item column but has Lot No)
            lot_val = get_col("LOT NO")

            # If we have a lot value AND it doesn't look like a description text...
            # Caveat: Description text often spans multiple columns.
            # PSU Format: Description is usually in a single wide cell or 'colspan' row

            full_text = "".join(texts)
            if not full_text:
                continue  # skip empty rows

            # Heuristic: If it has Lot No and Dely Qty, it's a delivery schedule row
            if lot_val and get_col("DELY QTY"):
                # Add to deliveries (Deduplicated)
                lot_no = to_int(lot_val)
                existing_lot = next((d for d in current_item["deliveries"] if d["LOT NO"] == lot_no), None)

                allow_val = get_col("ENTRY ALLOW DATE")
                norm_allow = normalize_date(allow_val)
                lot_data = {
                    "LOT NO": lot_no,
                    "DELY QTY": to_float(get_col("DELY QTY")),
                    "DELY DATE": normalize_date(get_col("DELY DATE")),
                    "ENTRY ALLOW DATE": norm_allow,
                    "REMARKS": allow_val if not norm_allow and allow_val.strip() else "",
                    "DEST CODE": to_int(get_col("DEST CODE")),
                    "RCD QTY": 0.0,
                    "REJ QTY": 0.0,
                }

                if not existing_lot:
                    current_item["deliveries"].append(lot_data)
                else:
                    # Update existing lot (prefer row with more data)
                    if lot_data["DELY QTY"] > 0:
                        existing_lot.update(lot_data)
            else:
                # Assume Description Continuation
                if "REMARKS" in full_text or "TOTAL VALUE" in full_text:
                    current_item = None  # End of items block
                    continue

                # PSU MULTI-ITEM FIX: Some description rows mention their target item number
                # as a single digit in a trailing cell (e.g., cell index 11 in 1105317.html)
                target_itm_no = None
                ignored_indices = set()

                for idx, txt in enumerate(texts):
                    # Check for trailing single digit item numbers
                    if txt.isdigit() and len(txt) <= 2:
                        potential_no = int(txt)
                        if any(it["PO ITM"] == potential_no for it in items):
                            target_itm_no = potential_no
                            ignored_indices.add(idx)
                            break

                # Construct description part excluding only the identified item number cell
                desc_parts = [t for i, t in enumerate(texts) if t and i not in ignored_indices]
                desc_part = " ".join(desc_parts)

                if target_itm_no is not None:
                    # Append to specific item
                    target_itm = next(it for it in items if it["PO ITM"] == target_itm_no)
                    target_itm["DESCRIPTION"] = (target_itm["DESCRIPTION"] + " " + desc_part).strip()
                elif current_item:
                    # Append to current/last item
                    current_item["DESCRIPTION"] = (current_item["DESCRIPTION"] + " " + desc_part).strip()

    # Post-Process Items: Extract DRG from Description + Distribute RCD QTY
    for itm in items:
        # Drawing Extraction
        desc = itm.get("DESCRIPTION", "")
        # Try to find ALL drgs
        drgs = RX_DRG_IN_DESC.findall(desc)
        if drgs:
            # Filter noise (short numbers) and remove duplicates
            valid_drgs = sorted(list(set(d.strip() for d in drgs if len(d) > 4)))
            if valid_drgs:
                itm["DRG"] = ", ".join(valid_drgs)  # Use 'DRG' key for ingest compatibility

        # RCD QTY Distribution
        total_rcd = itm.get("RCD QTY", 0.0) or 0.0
        rem = float(total_rcd)
        ds = itm["deliveries"]
        # If no deliveries found (weird), add a dummy one
        if not ds:
            ds.append({"LOT NO": 1, "DELY QTY": itm["ORD QTY"], "DELY DATE": ""})

        # Distribute strictly
        for i, d in enumerate(ds):
            d_ord_qty = d.get("DELY QTY", 0.0) or 0.0
            if i == len(ds) - 1:
                d["RCD QTY"] = max(0.0, rem)
            else:
                take = min(rem, float(d_ord_qty))
                d["RCD QTY"] = take
                rem -= take

        # REJ QTY Distribution
        total_rej = itm.get("REJ QTY", 0.0) or 0.0
        rem_rej = float(total_rej)
        for i, d in enumerate(ds):
            d_ord_qty = d.get("DELY QTY", 0.0) or 0.0
            if i == len(ds) - 1:
                d["REJ QTY"] = max(0.0, rem_rej)
            else:
                take_rej = min(rem_rej, float(d_ord_qty))
                d["REJ QTY"] = take_rej
                rem_rej -= take_rej

    return items


def extract_po_full(html_content: str) -> dict:
    """Entry point for PO parsing with validation."""
    soup = BeautifulSoup(html_content, "html.parser")
    header = extract_po_header(soup)
    items = extract_po_items(soup)

    is_valid = validate_po_data(header, items)

    return {"header": header, "items": items, "is_valid": is_valid}
