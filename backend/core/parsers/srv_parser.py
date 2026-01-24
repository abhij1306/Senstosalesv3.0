"""
SRV Parser - Pure functions to extract data from SRV HTML.
"""

import logging
import re

from backend.core.date_utils import normalize_date
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


def parse_decimal(v: str | None) -> float | None:
    if not v:
        return None
    try:
        return float(re.sub(r"[^\d.]", "", v))
    except (ValueError, TypeError):
        return None


def parse_int(v: str | None) -> int | None:
    if not v:
        return None
    try:
        return int(re.sub(r"[^\d]", "", v))
    except (ValueError, TypeError):
        return None


def safe_get_text(cells, hmap, *keys):
    """Helper to try multiple header keys and return stripped text."""
    for key in keys:
        if key in hmap and hmap[key] < len(cells):
            return cells[hmap[key]].get_text(strip=True)
    return None


def scrape_srv_html(html_content: str) -> list[dict]:
    soup = BeautifulSoup(html_content, "html.parser")
    srv_groups = {}
    tables = soup.find_all("table")

    for table in tables:
        rows = table.find_all("tr")
        if not rows:
            continue

        # Flatten headers: remove newlines, multiple spaces
        headers = [re.sub(r"\s+", " ", th.get_text(strip=True).upper()) for th in rows[0].find_all(["th", "td"])]

        # Identify if this is a valid SRV table
        if "SRV NO" not in headers and "SRV NUMBER" not in headers:
            continue

        hmap = {h: i for i, h in enumerate(headers)}

        for row in rows[1:]:
            cells = row.find_all("td")
            if len(cells) < 5:
                continue

            srv_no = safe_get_text(cells, hmap, "SRV NO", "SRV NUMBER")
            if not srv_no or not re.search(r"\d+", srv_no):
                continue

            if srv_no not in srv_groups:
                po_no = safe_get_text(cells, hmap, "PO NO", "PO NUMBER", "PURCHASE ORDER")
                srv_date = normalize_date(safe_get_text(cells, hmap, "SRV DATE", "DATE", "RECEIPT DATE"))

                srv_groups[srv_no] = {
                    "header": {"srv_number": srv_no, "srv_date": srv_date, "po_number": po_no, "srv_status": "Received", "is_active": True},
                    "items": [],
                }

            # Extract Item Data
            # Using multiple aliases for robustness

            # Quants
            # Quants
            recd_qty = parse_decimal(safe_get_text(cells, hmap, "RECVD QTY", "RECEIVED QTY", "RECD QTY"))
            rej_qty = parse_decimal(safe_get_text(cells, hmap, "REJ QTY", "REJECTED QTY", "REJECTED"))
            ord_qty = parse_decimal(safe_get_text(cells, hmap, "ORD QTY", "ORDER QTY", "PO QTY"))

            # For Accepted Qty, we want to know if it was explicitly present or not
            # If columns are missing, safe_get_text returns None.
            # We want to preserve None so ingestion can default to (Received - Rejected)
            raw_accepted = safe_get_text(cells, hmap, "ACPT QTY", "ACCEPTED QTY", "ACCEPTED")
            accepted_qty = parse_decimal(raw_accepted) if raw_accepted is not None else None

            challan_qty = parse_decimal(safe_get_text(cells, hmap, "CHALLAN QTY", "CHALLAN QUANTITY"))

            # Keys
            po_itm = parse_int(safe_get_text(cells, hmap, "PO ITM", "PO ITEM", "ITEM NO"))
            lot_no = parse_int(safe_get_text(cells, hmap, "LOT NO", "LOT"))
            srv_item_no = parse_int(safe_get_text(cells, hmap, "SRV ITM", "SRV ITEM NO"))
            rev_no = safe_get_text(cells, hmap, "REV NO", "REVISION")  # Keep as string for variants

            # Meta
            unit = safe_get_text(cells, hmap, "UNIT", "UOM")
            challan_no = safe_get_text(cells, hmap, "CHALLAN NO", "CHALLAN NUMBER")
            challan_date = normalize_date(safe_get_text(cells, hmap, "CHALLAN DATE", "CHALLAN DT", "CHL DT"))

            invoice_no = safe_get_text(cells, hmap, "INV NO", "INVOICE NO", "INVOICE NUMBER", "TAX INV")
            invoice_date = normalize_date(safe_get_text(cells, hmap, "INV DATE", "INVOICE DATE", "INVOICE DT", "TAX INV DT"))

            div_code = safe_get_text(cells, hmap, "DIV", "DIV CODE", "DIVISION")
            pmir_no = safe_get_text(cells, hmap, "PMIR NO", "PMIR")

            finance_date = normalize_date(safe_get_text(cells, hmap, "FINANCE DT", "FINANCE DATE"))
            cnote_no = safe_get_text(cells, hmap, "CNOTE NO", "CNOTE NO.", "CNOTE")
            cnote_date = normalize_date(safe_get_text(cells, hmap, "CNOTE DT", "CNOTE DATE"))

            remarks = safe_get_text(cells, hmap, "REMARKS", "REMARK")

            srv_groups[srv_no]["items"].append(
                {
                    "po_item_no": po_itm,
                    "lot_no": lot_no,
                    "srv_item_no": srv_item_no,
                    "rev_no": rev_no,
                    "rcd_qty": recd_qty,  # Note: mapped to rcd_qty to match model
                    "rej_qty": rej_qty,
                    "ord_qty": ord_qty,
                    "challan_qty": challan_qty,
                    "accepted_qty": accepted_qty,
                    "unit": unit,
                    "challan_no": challan_no,
                    "challan_date": challan_date,
                    "invoice_no": invoice_no,
                    "invoice_date": invoice_date,
                    "div_code": div_code,
                    "pmir_no": pmir_no,
                    "finance_date": finance_date,
                    "cnote_no": cnote_no,
                    "cnote_date": cnote_date,
                    "remarks": remarks,
                }
            )

    return list(srv_groups.values())
