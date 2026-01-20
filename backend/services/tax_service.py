"""
Tax Engine Service - Per backend_logic.md Specification

Handles:
- FY-scoped GST token retrieval
- Tax calculation for invoices
- Automatic recomputation (never trust frontend values)

Tax Rules:
- taxable_value = accepted_qty × po_rate
- cgst = taxable_value × cgst_rate/100
- sgst = taxable_value × sgst_rate/100
- igst = taxable_value × igst_rate/100
- total = taxable_value + cgst + sgst + igst
"""

import sqlite3
from dataclasses import dataclass


@dataclass
class GSTRates:
    """GST rate structure"""

    cgst: float = 9.0
    sgst: float = 9.0
    igst: float = 0.0
    cess: float = 0.0


class TaxService:
    """
    FY-scoped tax calculation engine.

    Key principle: Backend ALWAYS recomputes tax values.
    Frontend-sent totals are ignored.
    """

    # Default rates if not configured
    DEFAULT_CGST = 9.0
    DEFAULT_SGST = 9.0
    DEFAULT_IGST = 0.0

    @staticmethod
    def get_gst_rates(db: sqlite3.Connection, financial_year: str | None = None) -> GSTRates:
        """
        Get GST rates from settings, optionally scoped by FY.

        Args:
            db: Database connection
            financial_year: Optional FY like "2024-25"

        Returns:
            GSTRates dataclass with rates
        """
        # Try FY-specific rates first
        if financial_year:
            result = db.execute(
                """
                SELECT cgst_rate, sgst_rate, igst_rate
                FROM settings
                WHERE key = 'gst_rates' AND financial_year = ?
            """,
                (financial_year,),
            ).fetchone()

            if result:
                return GSTRates(
                    cgst=float(result[0] or TaxService.DEFAULT_CGST),
                    sgst=float(result[1] or TaxService.DEFAULT_SGST),
                    igst=float(result[2] or TaxService.DEFAULT_IGST),
                )

        # Fall back to global settings
        result = db.execute("""
            SELECT value FROM settings WHERE key = 'cgst_rate'
        """).fetchone()
        cgst = float(result[0]) if result else TaxService.DEFAULT_CGST

        result = db.execute("""
            SELECT value FROM settings WHERE key = 'sgst_rate'
        """).fetchone()
        sgst = float(result[0]) if result else TaxService.DEFAULT_SGST

        result = db.execute("""
            SELECT value FROM settings WHERE key = 'igst_rate'
        """).fetchone()
        igst = float(result[0]) if result else TaxService.DEFAULT_IGST

        return GSTRates(cgst=cgst, sgst=sgst, igst=igst)

    @staticmethod
    def calculate_item_tax(quantity: float, rate: float, gst_rates: GSTRates, is_interstate: bool = False) -> dict[str, float]:
        """
        Calculate tax for a single item.

        Args:
            quantity: Accepted quantity
            rate: Unit rate (po_rate)
            gst_rates: GST rates to apply
            is_interstate: If True, use IGST instead of CGST+SGST

        Returns:
            Dict with taxable_value, cgst, sgst, igst, total
        """
        taxable_value = round(quantity * rate, 2)

        if is_interstate:
            cgst = 0.0
            sgst = 0.0
            igst = round(taxable_value * gst_rates.igst / 100, 2)
        else:
            cgst = round(taxable_value * gst_rates.cgst / 100, 2)
            sgst = round(taxable_value * gst_rates.sgst / 100, 2)
            igst = 0.0

        total = round(taxable_value + cgst + sgst + igst, 2)

        return {
            "taxable_value": taxable_value,
            "cgst": cgst,
            "sgst": sgst,
            "igst": igst,
            "total": total,
        }

    @staticmethod
    def calculate_invoice_totals(
        db: sqlite3.Connection, invoice_items: list, financial_year: str | None = None, is_interstate: bool = False
    ) -> dict[str, float]:
        """
        Calculate total tax for an invoice.

        Args:
            db: Database connection
            invoice_items: List of items with quantity and rate
            financial_year: Optional FY for rate lookup
            is_interstate: Interstate supply flag

        Returns:
            Dict with total_taxable, total_cgst, total_sgst, total_igst, grand_total
        """
        gst_rates = TaxService.get_gst_rates(db, financial_year)

        totals = {
            "total_taxable": 0.0,
            "total_cgst": 0.0,
            "total_sgst": 0.0,
            "total_igst": 0.0,
            "grand_total": 0.0,
        }

        for item in invoice_items:
            qty = float(item.get("quantity", 0) or item.get("accepted_qty", 0))
            rate = float(item.get("rate", 0) or item.get("po_rate", 0))

            item_tax = TaxService.calculate_item_tax(qty, rate, gst_rates, is_interstate)

            totals["total_taxable"] += item_tax["taxable_value"]
            totals["total_cgst"] += item_tax["cgst"]
            totals["total_sgst"] += item_tax["sgst"]
            totals["total_igst"] += item_tax["igst"]
            totals["grand_total"] += item_tax["total"]

        # Round final totals
        for key in totals:
            totals[key] = round(totals[key], 2)

        return totals

    @staticmethod
    def recompute_invoice(db: sqlite3.Connection, invoice_number: str) -> dict[str, float]:
        """
        Recompute all tax values for an existing invoice.
        Updates the invoice record with fresh calculations.

        Args:
            db: Database connection
            invoice_number: Invoice to recompute

        Returns:
            Dict with computed totals
        """
        # Get invoice header for FY
        header = db.execute(
            """
            SELECT financial_year, place_of_supply
            FROM gst_invoices
            WHERE invoice_number = ?
        """,
            (invoice_number,),
        ).fetchone()

        if not header:
            return {"error": "Invoice not found"}

        fy = header[0]
        # Determine interstate based on place of supply vs supplier state
        # For now, assume intrastate
        is_interstate = False

        # Get invoice items with PO rates
        items = db.execute(
            """
            SELECT ii.quantity, ii.rate
            FROM gst_invoice_items ii
            WHERE ii.invoice_number = ?
        """,
            (invoice_number,),
        ).fetchall()

        item_list = [{"quantity": r[0], "rate": r[1]} for r in items]

        totals = TaxService.calculate_invoice_totals(db, item_list, fy, is_interstate)

        # Update invoice record
        db.execute(
            """
            UPDATE gst_invoices
            SET taxable_value = ?,
                cgst = ?,
                sgst = ?,
                igst = ?,
                total_invoice_value = ?
            WHERE invoice_number = ?
        """,
            (totals["total_taxable"], totals["total_cgst"], totals["total_sgst"], totals["total_igst"], totals["grand_total"], invoice_number),
        )

        db.commit()

        return totals
