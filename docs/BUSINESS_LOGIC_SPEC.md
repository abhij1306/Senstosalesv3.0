# Business Logic Specification

**Version:** 4.2  
**Last Updated:** 2026-01-19

---

## 1. System Overview

SenstoSales is an ERP for a **supplier** who receives Purchase Orders from a buyer (Engineering PSU).

### Core Flow
```
Buyer sends PO → Supplier uploads PO → Supplier creates DC → Supplier creates Invoice → Buyer sends SRV
```

### Document Relationships
| Relationship | Type | Description |
|--------------|------|-------------|
| **PO → DC** | 1:Many | One PO can have multiple Delivery Challans |
| **DC → Invoice** | 1:1 | One DC = One Invoice |
| **SRV → PO** | Many:1 | SRVs reference PO items (buyer creates SRV after receiving goods) |

---

## 2. Entity Definitions

| Entity | Source | Numbering | Purpose |
|--------|--------|-----------|---------|
| **PO** | Uploaded from buyer (HTML/Excel) | From buyer | Purchase Order with items and quantities |
| **DC** | Created by supplier | Manual (FY-wise unique) | Dispatch record |
| **Invoice** | Created by supplier | Manual (FY-wise unique) | GST Invoice for dispatched goods |
| **SRV** | Uploaded from buyer (HTML) | From buyer | Receipt confirmation with accepted/rejected qty |

---

## 3. Quantity Fields

| Field | Location | Source | Description |
|-------|----------|--------|-------------|
| `ord_qty` | PO Item | PO Upload | Ordered quantity |
| `dely_qty` | PO Delivery (Lot) | PO Upload | Scheduled delivery per lot |
| `delivered_qty` | PO Item/Lot | DC Creation (trigger) | Quantity dispatched via DCs |
| `dispatch_qty` | DC Item | DC Creation | Quantity in a specific DC |
| `rcd_qty` | PO Item | **PO Upload OR SRV Upload** | Received quantity |
| `manual_override_qty` | PO Delivery (Lot) | User Manual Input | Manual correction for dispatched quantity |
| `pending_qty` | PO Item | Derived | `ord_qty - delivered_qty` |

### Quantity Sync Rules

**CRITICAL: Two sources can update received quantities:**

1. **PO Upload** - Buyer PO HTML contains RCD QTY. Re-uploading a PO updates `rcd_qty`.
2. **SRV Upload** - Updates `rcd_qty` via triggers. Also syncs to lot table.

**Whichever is uploaded last wins.**

### Delivered Quantity Sync

`delivered_qty` (or `dsp_qty`) is tracked strictly at the **Item Level**:
- DC Creation: Quantities are recorded against PO Items.
- **Manual Override**: If `manual_override_qty` is set for a lot, it is used for calculation and display in the PO Detail view, effectively overriding the aggregate `dsp_qty` from DCs for that specific lot's context.
- **No Lot Distribution (Automatic)**: The system DOES NOT automatically distribute dispatched quantities to specific lots from DCs. Lot schedules in the PO are for **delivery planning/tracking only** and can be manually adjusted via `manual_override_qty`.
- Trigger: `trg_dc_items_dispatch_sync` aggregates `SUM(dispatch_qty)` from all DCs for that PO item.

### Received Quantity Sync

`rcd_qty` is tracked strictly at the **Item Level**:
- SRV Ingestion: Quantities are recorded against PO Items based on `material_code`.
- **No Lot Distribution**: The system DOES NOT distribute received quantities to specific lots.
- **Whichever is uploaded last (PO HTML or SRV HTML) updates the cumulative item total.**
- Lot schedules in the PO remain as per the original PO upload unless manually adjusted for tracking.

---

## 4. Upload Behavior

### PO Upload
- **Source:** HTML files from buyer portals
- **Behavior:** UPSERT - overwrites existing PO data
- **Key:** `(po_number)` or `(po_number, financial_year)`
- **"Entry Allow" Logic**: The parser extracts "Entry Allow Date". If the cell contains non-date text (e.g., "PO Short Closed"), it is stored in the `remarks` field of the delivery lot and displayed in the UI instead of a date.

### SRV Upload
- **Source:** HTML files from buyer portals
- **Behavior:** UPSERT - overwrites existing SRV data
- **Key:** `(srv_number)`
- **Rule:** Always accept. Store deviations (e.g., qty mismatch) for later analysis.

---

## 5. Internal Creation (DC & Invoice)

### DC Creation
- User selects PO items and enters dispatch quantities at the **ITEM LEVEL**.
- **Guardrail:** `dispatch_qty ≤ pending_qty` (prevents over-dispatch) per item.
- **Item-based Tracking**: All dispatches are recorded against PO items. The system does not track which specific PO lot/schedule a dispatch belongs to.
- **Numbering:** Manual, FY-wise unique

### Invoice Creation
- Created from DC (1:1)
- Tax computed using GST rates from settings
- **Numbering:** Manual, FY-wise unique

---

## 6. Status Logic

| Status | Condition |
|--------|-----------|
| **Pending** | No dispatch activity |
| **Delivered** | All items dispatched (`dispatched ≥ ordered`) |
| **Closed** | All items received (`received ≥ ordered`) |

**Tolerance:** 0.001 for floating-point comparison.

---

## 7. Historical Data Mode

For initial setup with ~2500 POs and SRVs:
- Upload POs and SRVs
- DC and Invoice numbers from SRV are stored as TEXT fields (not created as records)
- User can later create actual DC/Invoice records for testing

---

## 8. Deviation Handling

### Overview
Deviations are tracked when external documents (SRV) contain data that differs from system records. The system **always accepts** the data but **flags discrepancies** for review.

### Deviation Types

| Type | Trigger | Detection Point |
|------|---------|-----------------|
| `QTY_MISMATCH` | SRV `ord_qty` differs from PO `ord_qty` | SRV Ingestion |
| `DOC_NUMBER_CONFLICT` | SRV references DC/Invoice not in system | SRV Ingestion |
| `FY_COLLISION` | SRV year doesn't match linked DC year | Prevented at link time |

### FY-Aware Linking

**Problem:** Same document numbers can exist in different financial years (e.g., DC 100 in FY24-25 and DC 100 in FY25-26).

**Solution:** When SRV references `challan_no`, the system validates:
1. Does `challan_no` exist as a `dc_number`?
2. Is the DC in the **same financial year** as the SRV date?
3. If not, **don't link** (set `challan_no = NULL` in srv_items)

### DC/Invoice Number Independence

DC and Invoice are independent entity types - they can share the same number within the same FY:
- DC 344 in FY 25-26 ✓
- Invoice 344 in FY 25-26 ✓ (allowed, different entity)

### Storage

Deviations are stored in the `deviations` table:
```sql
INSERT INTO deviations (deviation_type, entity_type, entity_id, po_number, 
                        field_name, expected_value, actual_value)
VALUES ('QTY_MISMATCH', 'srv_item', '12345_1_0', '7254606', 
        'ord_qty', '100', '95');
```

### Resolution

Deviations remain flagged until manually resolved. Resolution does not change the stored data - it just marks the deviation as acknowledged.

**Principle:** Accept data, flag deviation, don't reject.

---

## 9. Guarantee Certificate (GC)

### Overview
Each Delivery Challan has an associated Guarantee Certificate. The GC Number and Date are stored and auto-populated.

### Fields
| Field | Default | Editable | Storage |
|-------|---------|----------|---------|
| `gc_number` | DC Number | Yes | `delivery_challans.gc_number` |
| `gc_date` | DC Date | Yes | `delivery_challans.gc_date` |

### Business Rules
1. **Auto-Population**: If blank, `gc_number` defaults to `dc_number`, `gc_date` defaults to `dc_date`
2. **Duplicate Check**: GC numbers must be unique within the Financial Year
3. **Read-Only Footer**: The GC line in DC remarks is auto-generated (not manually editable)
4. **Excel Export**: DC Excel auto-injects `Guarantee Certificate No. {gc_number} Dt. {gc_date}` in footer

### Downloads
- **DC Excel**: Includes GC line in footer automatically
- **GC Excel**: Separate download using `GC5.xlsx` template

---

## 10. API Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/po/upload` | Upload PO (UPSERT) |
| POST | `/api/srv/upload` | Upload SRV (UPSERT, always accept) |
| POST | `/api/dc` | Create DC (with guardrails) |
| POST | `/api/invoice/create` | Create Invoice from DC |
| GET | `/api/po/` | List POs |
| GET | `/api/dc/` | List DCs |
| GET | `/api/invoice/` | List Invoices |
| GET | `/api/search` | Global search |

---

## 11. Simplification Principles

1. **No rejection of external data** - SRV always accepted
2. **Internal guardrails** - DC/Invoice creation has validation
3. **Single source of truth** - Triggers sync quantities automatically
4. **No over-engineering** - Store data, compute on read

---

## 12. Data Integrity Layers

### Layer 1: Database Constraints (Hard)
- **Primary Keys:** Unique text-based IDs.
- **Foreign Keys:** Enforced (`PRAGMA foreign_keys = ON`).
- **Triggers:** Auto-sync derived quantities (`delivered_qty`, `rcd_qty`).

### Layer 2: Runtime Validation (Service/Model)
- **Type Coercion:** Integers (e.g., `po_item_no`, `lot_no`) are explicitly cast from Float to Int.
- **Safety Checks:** `dispatch_qty` cannot exceed `pending_qty` (checked in Service).
- **Sanity Checks:** Non-negative quantities enforced via Pydantic models (`ge=0`).

### Layer 3: Frontend Compatibility
- **Field Mapping:** API response keys match Frontend component expectations (e.g., `delivered_quantity`).
- **Display logic:** Raw values displayed without ad-hoc calculation where possible.
