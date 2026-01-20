# Backend Architecture

**Version:** 4.4 (Production Standard)  
**Last Updated:** 2026-01-09

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | FastAPI + Python 3.11+ |
| Database | SQLite (WAL mode, FK enforced) |
| Frontend | Next.js 14 + TypeScript |

---

## Directory Structure

```
backend/
├── api/                # HTTP Routers (no business logic)
│   ├── po.py          # PO list, detail, upload
│   ├── dc.py          # DC CRUD
│   ├── invoice.py     # Invoice CRUD
│   ├── srv.py         # SRV upload
│   ├── reports.py     # Excel exports
│   └── settings.py    # System settings
│
├── services/          # Business Logic (HTTP-agnostic)
│   ├── po_service.py           # PO queries
│   ├── dc.py                   # DC creation with guardrails
│   ├── invoice.py              # Invoice creation
│   ├── srv_ingestion_optimized.py  # SRV parsing
│   ├── reconciliation_v2.py    # Quantity sync
│   └── status_service.py       # Status calculation
│
├── core/              # Shared Utilities
│   ├── config.py      # DATABASE_PATH (canonical)
│   └── number_utils.py # Quantity parsing
│
└── db/                # Database Layer
    ├── session.py     # Connection management
    └── models.py      # Pydantic models
```

---

## Key Rules

### 1. Routers Never Contain Logic
```python
# ✅ CORRECT
@router.post("/dc")
def create_dc(data, db = Depends(get_db)):
    return DCService.create_dc(db, data)

# ❌ WRONG
@router.post("/dc")
def create_dc(data, db = Depends(get_db)):
    total = sum(item.qty for item in data.items)  # NO!
```

### 2. Database Path
Always use `from backend.core.config import DATABASE_PATH`. Never hardcode paths.

### 3. Transactions
Use `BEGIN IMMEDIATE` for DC/Invoice creation to prevent race conditions.

---

## Data Sync

**Triggers (automatic):**
- `delivery_challan_items` INSERT/UPDATE → updates `purchase_order_items.delivered_qty`
- `srv_items` INSERT/UPDATE → updates `purchase_order_items.rcd_qty`

**Backfill (one-time for historical data):**
```bash
python scripts/backfill_srv_to_poi.py
```

---

## Status Logic

See [status_service.py](../backend/services/status_service.py):

| Status | Condition |
|--------|-----------|
| Pending | dispatch = 0 |
| Delivered | dispatch ≥ ordered |
| Closed | received ≥ ordered |

Tolerance: 0.001 for float comparison.

---

## Performance

Indexes applied via `migrations/add_performance_indexes.sql`:
- `idx_po` on `purchase_orders(po_number)`
- `idx_poi` on `purchase_order_items(po_number, po_item_no)`
- `idx_dc_item` on `delivery_challan_items(po_item_id)`
- `idx_srv` on `srv_items(po_number, po_item_no)`
