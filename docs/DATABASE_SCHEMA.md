# Database Schema

**Version:** 2.3  
**Last Updated:** 2026-01-19  
**Location:** `db/business.db`

---

## Core Tables

### purchase_orders
```sql
CREATE TABLE purchase_orders (
    po_number TEXT PRIMARY KEY,
    po_date DATE,
    buyer_id INTEGER REFERENCES buyers(id),
    supplier_name TEXT,
    supplier_gstin TEXT,
    supplier_code TEXT,
    supplier_phone TEXT,
    supplier_fax TEXT,
    supplier_email TEXT,
    department_no INTEGER,
    enquiry_no TEXT,
    enquiry_date DATE,
    quotation_ref TEXT,
    quotation_date DATE,
    rc_no TEXT,
    order_type TEXT,
    po_status TEXT DEFAULT 'Pending',
    tin_no TEXT,
    ecc_no TEXT,
    mpct_no TEXT,
    po_value DECIMAL(15,2),
    fob_value DECIMAL(15,2),
    ex_rate DECIMAL(15,4),
    currency TEXT,
    net_po_value DECIMAL(15,2),
    amend_no INTEGER DEFAULT 0,
    amend_1_date DATE,
    amend_2_date DATE,
    remarks TEXT,
    issuer_name TEXT,
    issuer_designation TEXT,
    issuer_phone TEXT,
    inspection_by TEXT,
    inspection_at TEXT,
    financial_year TEXT,
    consignee_name TEXT,
    consignee_address TEXT,
    our_ref TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### purchase_order_items
```sql
CREATE TABLE purchase_order_items (
    id TEXT PRIMARY KEY,
    po_number TEXT NOT NULL REFERENCES purchase_orders(po_number) ON DELETE CASCADE,
    po_item_no INTEGER NOT NULL,
    status TEXT DEFAULT 'Active',
    material_code TEXT,
    material_description TEXT,
    drg_no TEXT,
    mtrl_cat INTEGER,
    unit TEXT,
    po_rate DECIMAL(15,2),
    ord_qty DECIMAL(15,3) NOT NULL,
    rcd_qty DECIMAL(15,3) DEFAULT 0,
    rej_qty DECIMAL(15,3) DEFAULT 0,
    dsp_qty DECIMAL(15,3) DEFAULT 0,
    manual_delivered_qty DECIMAL(15,3) DEFAULT 0,
    pending_qty DECIMAL(15,3) DEFAULT 0,
    hsn_code TEXT,
    item_value DECIMAL(15,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(po_number, po_item_no)
);
```

### purchase_order_deliveries (Lot Schedule)
```sql
CREATE TABLE purchase_order_deliveries (
    id TEXT PRIMARY KEY,
    po_item_id TEXT NOT NULL REFERENCES purchase_order_items(id) ON DELETE CASCADE,
    lot_no INTEGER,
    ord_qty DECIMAL(15,3),
    dely_date DATE,
    dsp_qty DECIMAL(15,3) DEFAULT 0,
    rcd_qty DECIMAL(15,3) DEFAULT 0,
    manual_override_qty DECIMAL(15,3) DEFAULT 0,
    entry_allow_date DATE,
    dest_code INTEGER,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Delivery Challan Tables

### delivery_challans
```sql
CREATE TABLE delivery_challans (
    dc_number TEXT PRIMARY KEY,
    dc_date DATE NOT NULL,
    po_number TEXT NOT NULL REFERENCES purchase_orders(po_number) ON DELETE CASCADE,
    department_no INTEGER,
    financial_year TEXT,
    consignee_name TEXT,
    consignee_gstin TEXT,
    consignee_address TEXT,
    inspection_company TEXT,
    eway_bill_no TEXT,
    vehicle_no TEXT,
    lr_no TEXT,
    transporter TEXT,
    mode_of_transport TEXT,
    remarks TEXT,
    our_ref TEXT,
    gc_number TEXT,          -- Guarantee Certificate number (defaults to dc_number)
    gc_date TEXT,            -- Guarantee Certificate date (defaults to dc_date)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### delivery_challan_items
```sql
CREATE TABLE delivery_challan_items (
    id TEXT PRIMARY KEY,
    dc_number TEXT NOT NULL REFERENCES delivery_challans(dc_number) ON DELETE CASCADE,
    po_item_id TEXT NOT NULL REFERENCES purchase_order_items(id) ON DELETE CASCADE,
    lot_no INTEGER,
    dsp_qty DECIMAL(15,3) NOT NULL,
    rcd_qty DECIMAL(15,3) DEFAULT 0,
    accepted_qty DECIMAL(15,3) DEFAULT 0,
    rej_qty DECIMAL(15,3) DEFAULT 0,
    hsn_code TEXT,
    hsn_rate DECIMAL(15,2),
    no_of_packets INTEGER DEFAULT 0,
    CHECK (dsp_qty > 0)
);
```

---

## Invoice Tables

### gst_invoices
```sql
CREATE TABLE gst_invoices (
    invoice_number TEXT PRIMARY KEY,
    invoice_date DATE NOT NULL,
    financial_year TEXT,
    dc_number TEXT UNIQUE REFERENCES delivery_challans(dc_number),
    po_numbers TEXT,
    buyer_name TEXT,
    buyer_gstin TEXT,
    buyer_address TEXT,
    buyer_state TEXT,
    buyer_state_code TEXT,
    place_of_supply TEXT,
    buyers_order_date TEXT,
    taxable_value DECIMAL(15,2),
    cgst DECIMAL(15,2) DEFAULT 0,
    sgst DECIMAL(15,2) DEFAULT 0,
    igst DECIMAL(15,2) DEFAULT 0,
    total_invoice_value DECIMAL(15,2),
    gemc_number TEXT,
    gemc_date TEXT,
    mode_of_payment TEXT,
    payment_terms TEXT DEFAULT '45 Days',
    despatch_doc_no TEXT,
    srv_no TEXT,
    srv_date TEXT,
    vehicle_no TEXT,
    lr_no TEXT,
    transporter TEXT,
    destination TEXT,
    terms_of_delivery TEXT,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### gst_invoice_items
```sql
CREATE TABLE gst_invoice_items (
    id TEXT PRIMARY KEY,
    invoice_number TEXT NOT NULL REFERENCES gst_invoices(invoice_number) ON DELETE CASCADE,
    po_item_no INTEGER,
    description TEXT NOT NULL,
    material_code TEXT,
    drg_no TEXT,
    mtrl_cat INTEGER,
    quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
    unit TEXT DEFAULT 'NO',
    rate DECIMAL(15,2) NOT NULL DEFAULT 0,
    taxable_value DECIMAL(15,2) DEFAULT 0,
    cgst_amount DECIMAL(15,2) DEFAULT 0,
    sgst_amount DECIMAL(15,2) DEFAULT 0,
    igst_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0,
    no_of_packets INTEGER,
    hsn_sac TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## SRV Tables

### srvs
```sql
CREATE TABLE srvs (
    srv_number TEXT PRIMARY KEY,
    srv_date DATE NOT NULL,
    po_number TEXT NOT NULL,
    invoice_number TEXT,
    srv_status TEXT DEFAULT 'Received',
    po_found BOOLEAN DEFAULT 1,
    warning_message TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### srv_items
```sql
CREATE TABLE srv_items (
    id TEXT PRIMARY KEY,
    srv_number TEXT NOT NULL REFERENCES srvs(srv_number) ON DELETE CASCADE,
    po_number TEXT NOT NULL,
    po_item_no INTEGER NOT NULL,
    lot_no INTEGER,
    srv_item_no INTEGER,
    rev_no TEXT,
    
    -- Quantities
    rcd_qty DECIMAL(15,3) DEFAULT 0,
    rej_qty DECIMAL(15,3) DEFAULT 0,
    accepted_qty DECIMAL(15,3) DEFAULT 0,
    ord_qty DECIMAL(15,3) DEFAULT 0,
    challan_qty DECIMAL(15,3) DEFAULT 0,
    unit TEXT,
    
    -- Challan Reference
    challan_no TEXT,
    challan_date DATE,
    
    -- Invoice Reference  
    invoice_no TEXT,
    invoice_date DATE,
    
    -- Additional Fields
    div_code TEXT,
    pmir_no TEXT,
    finance_date DATE,
    cnote_no TEXT,
    cnote_date DATE,
    remarks TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Settings & Buyers

### settings
```sql
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### buyers
```sql
CREATE TABLE buyers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    gstin TEXT,
    address TEXT,
    state TEXT,
    state_code TEXT,
    place_of_supply TEXT,
    is_default BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Deviations (Quality Control)

### deviations
```sql
CREATE TABLE deviations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deviation_type TEXT NOT NULL,      -- 'QTY_MISMATCH', 'DOC_NUMBER_CONFLICT', 'FY_COLLISION'
    entity_type TEXT NOT NULL,         -- 'srv_item', 'srv', 'dc_item'
    entity_id TEXT NOT NULL,           -- srv_item.id or srv.srv_number
    po_number TEXT,
    field_name TEXT,                   -- 'ord_qty', 'challan_no', etc.
    expected_value TEXT,               -- What system expected
    actual_value TEXT,                 -- What document contained
    details TEXT,                      -- JSON for additional context
    is_resolved BOOLEAN DEFAULT 0,
    resolved_at TIMESTAMP,
    resolved_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Deviation Types:**
| Type | Description |
|------|-------------|
| `QTY_MISMATCH` | SRV ord_qty differs from PO ord_qty |
| `DOC_NUMBER_CONFLICT` | SRV references DC/Invoice not in system |
| `FY_COLLISION` | SRV year doesn't match DC/Invoice year |

---

## Triggers

| Name | Table | Event | Action |
|------|-------|-------|--------|
| `update_po_timestamp` | `purchase_orders` | AFTER UPDATE | Updates `updated_at` |
| `update_poi_timestamp` | `purchase_order_items` | AFTER UPDATE | Updates `updated_at` |
| `calculate_pending_qty_insert` | `purchase_order_items` | AFTER INSERT | Sets `pending_qty = ord_qty - dsp_qty` |
| `calculate_pending_qty_update` | `purchase_order_items` | AFTER UPDATE | Updates `pending_qty` |
| `trg_dc_items_dispatch_sync` | `delivery_challan_items` | AFTER INSERT/UPDATE/DELETE | Updates `purchase_order_items.dsp_qty` |
| `trg_srv_items_receipt_sync` | `srv_items` | AFTER INSERT/UPDATE/DELETE | Updates `purchase_order_items.rcd_qty` and `rej_qty` |

---

## Indexes & Performance

| Index Name | Table | Columns | Purpose |
|------------|-------|---------|---------|
| `idx_po` | `purchase_orders` | `po_number`, `financial_year` | PO Lookups |
| `idx_poi` | `purchase_order_items` | `po_number`, `po_item_no` | Item Lookups |
| `idx_po_created_at` | `purchase_orders` | `created_at` | Date Filtering (Dashboard) |
| `idx_po_status` | `purchase_orders` | `po_status` | Status Filtering |
| `idx_inv_created_at` | `gst_invoices` | `created_at` | Date Filtering (Dashboard) |
| `idx_dc_created_at` | `delivery_challans` | `created_at` | Date Filtering (Dashboard) |
| `idx_srv_created_at` | `srv_items` | `created_at` | Date Filtering (Dashboard) |
| `idx_srv_items_challan` | `srv_items` | `challan_no` | Challan Lookups |
| `idx_deviations_entity` | `deviations` | `entity_type`, `entity_id` | Deviation Lookups |
| `idx_deviations_unresolved` | `deviations` | `is_resolved` | Pending Deviations |
