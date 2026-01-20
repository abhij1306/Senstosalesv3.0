"""
Centralized Status Logic Service
Enforces global status invariants across PO, DC, and Invoice modules.
"""


def calculate_entity_status(total_ordered: float, total_dispatched: float, total_received: float) -> str:
    """
    Calculate entity status based on standardized quantity checks.

    Rules:
    1. Closed: Transaction Complete (All items received/accepted).
    2. Delivered: Physically Shipped (All items dispatched).
    3. Pending: Not complete (Zero or partial dispatch).
    """
    a_ord = float(total_ordered or 0)
    a_disp = float(total_dispatched or 0)

    # Fulfillment Lock Logic
    # We only lock to 'Delivered' when dispatched equals ordered.
    # 'Closed' should be a terminal state typically handled by manual closure or full reconciliation.
    # Removing auto-closure on receipt to unblock DC generation clerical corrections.

    if a_ord > 0 and a_disp >= a_ord - 0.001:
        return "Delivered"

    # Any other state (including zero dispatch/receipt) is Pending
    return "Pending"


def translate_raw_status(raw_status: str) -> str:
    """Maps numeric ERP codes to human readable strings."""
    s = str(raw_status or "").strip()
    if s == "0":
        return "Open"
    if s == "2":
        return "Closed"
    return s or "Pending"


def calculate_pending_quantity(ordered: float, fulfilled: float) -> float:
    """
    Calculate Pending Quantity (Balance).

    Invariant: Balance = Ordered - Fulfilled
    - At PO level, 'Fulfilled' is typically Total Dispatched.
    - At Invoice/DC level, 'Fulfilled' could be Total Received.
    """
    from backend.core.number_utils import to_qty

    ordered_val = float(ordered or 0)
    fulfilled_val = float(fulfilled or 0)
    return to_qty(max(0.0, ordered_val - fulfilled_val))
