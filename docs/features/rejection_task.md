# DC Rejection & Replacement Logic

**Status:** Planned
**Standard Core**: [feature_prompt.md](file:///c:/Users/abhij/.gemini/antigravity/scratch/SenstoSales/docs/features/feature_prompt.md)

---

## 1. Context
Currently, the system prevents dispatching more than the `Ordered` quantity. However, when items are **Rejected** via SRV, the `Ordered` balance remains consumed by the initial DC. Business requires a way to "re-open" the balance for rejected items so a **Replacement DC** can be issued.

---

## 2. Implementation Guide

### A. Backend (Transactional Ledger)
- **Service**: `backend/services/reconciliation_v2.py`
- **Logic**: Do NOT just mutate `delivered_qty`. Introduce a ledger or a formula change:
  - `Effective_Delivered = Total_Dispatch - Total_Rejected_and_Returned`.
- **Trigger**: When an SRV is uploaded with `rej_qty > 0`, the reconciliation service must recalculate the PO balance to allow fresh DCs for the rejected amount.

### B. Database (Evolution)
- If schema changes are needed (e.g., adding `replacement_allowed` flag to DCs), update `backend/db/models.py` and test with `scripts/dev_tools/reinit_db.py`.

### C. Frontend (Visualizing Rejections)
- **Component**: `DocumentItemsTable.tsx`
- **Display**: Use a `Tiny` badge with `status-error-container` to show "Rejected: {Qty}" and a corresponding "Balance Available" update.
- **Action**: The "Create DC" page should now see the re-opened balance and permit selection.

---

## 3. Risks & Invariants
- **INV-REJ-1**: No "phantom" balance. Balance must strictly reflect `Ordered - Accepted`.
- **INV-REJ-2**: Rejection events must be linked to the specific SRV and DC for auditability.
- **INV-REJ-3**: Manual closure of balance must be possible even if rejections exist.
