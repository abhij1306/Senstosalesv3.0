# Deviation Tracking Feature

**Status:** Planned
**Standard Core**: [feature_prompt.md](file:///c:/Users/abhij/.gemini/antigravity/scratch/SenstoSales/docs/features/feature_prompt.md)

---

## 1. Overview
The system must ingest external data (SRVs) even when inconsistencies exist, flagging them for manual audit. Deviations represent "truth on the ground" versus "records in the system".

---

## 2. Types of Deviations

| Deviation Type | Description | Invariant Check |
|----------------|-------------|-----------------|
| **FY Collision** | Document (e.g. Inv 344) exists but in a different Financial Year | `invoice_number = ? AND fin_year != ?` |
| **Missing Ref** | SRV references a DC/Invoice not in system | `SELECT 1 FROM delivery_challans WHERE dc_number = ?` returns NULL |
| **Qty Overage** | `received_qty > ord_qty` | Compare against `purchase_order_items` |
| **Unmapped PO** | SRV references an unknown PO | Pre-check during ingestion |

---

## 3. Implementation Plan

### A. Database (Schema)
Update schema via `scripts/dev_tools/reinit_db.py` after adding:
```sql
CREATE TABLE deviations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deviation_type TEXT NOT NULL, 
    entity_type TEXT NOT NULL,    -- 'srv', 'invoice'
    entity_id TEXT NOT NULL,      -- document number
    po_number TEXT,               -- context
    details JSON,                 -- structured mismatch info
    is_resolved BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### B. Backend (Service Layer)
- **Service**: `backend/services/deviation_service.py` to handle logging and resolution.
- **Ingestion**: Modify `srv_ingestion_optimized.py` to detect mismatches (especially FY collisions) and call `log_deviation`.

### C. Frontend (Tahoe UI)
- **Dashboard**: High-density badge for "Open Deviations".
- **Detail Pages**: Mini-table showing linked deviations for a specific document.
- **Components**: Use `Mini` and `Accounting` tokens.

---

## 4. Risks & Invariants
- **INV-DEV-1**: A deviation must not block data ingestion.
- **INV-DEV-2**: Documents with collisions must NOT be auto-linked to the wrong Financial Year records.
