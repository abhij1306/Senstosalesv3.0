"""
Backend Services Module

Clean exports for all services per backend_logic.md:
- ReconciliationService: Quantity reconciliation and status derivation
- TaxService: FY-scoped GST calculations
- POService: Coming soon
- DCService: Coming soon
- InvoiceService: Coming soon
- SRVIngestionService: Async SRV file processing
"""

# V2 Services (new, per backend_logic.md)
from .reconciliation_v2 import ReconciliationServiceV2

# Legacy alias for backward compatibility
from .reconciliation_v2 import ReconciliationServiceV2 as ReconciliationService
from .tax_service import TaxService
from .validation_service import ValidationService

__all__ = [
    "ReconciliationService",  # Alias
    "ReconciliationServiceV2",
    "TaxService",
    "ValidationService",
]
