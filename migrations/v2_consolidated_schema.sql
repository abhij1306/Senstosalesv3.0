-- ============================================================================
-- SENSTOSALES CONSOLIDATED SCHEMA v2.0
-- Single source of truth for database structure
-- ============================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;

-- ============================================================================
-- SETTINGS & SYSTEM TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_sequences (
    doc_type TEXT NOT NULL,
    financial_year TEXT NOT NULL,
    last_number INTEGER DEFAULT 0,
    prefix TEXT,
    PRIMARY KEY (doc_type, financial_year)
);

CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    severity TEXT DEFAULT 'info',
    message TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    is_read BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS materials (
    material_code TEXT PRIMARY KEY,
    description TEXT,
    unit TEXT,
    hsn_code TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS buyers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    gstin TEXT,
    billing_address TEXT,
    shipping_address TEXT,
    address TEXT,  -- Mantained for legacy compatibility
    state TEXT,
    state_code TEXT,
    place_of_supply TEXT,
    is_active BOOLEAN DEFAULT 1,
    is_default BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_download_prefs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_html TEXT DEFAULT 'C:\Downloads\PO_HTML',
    srv_html TEXT DEFAULT 'C:\Downloads\SRV_HTML',
    challan TEXT DEFAULT 'C:\Downloads\Challan',
    invoice TEXT DEFAULT 'C:\Downloads\Invoice',
    challan_summary TEXT DEFAULT 'C:\Downloads\Challan_Summary',
    invoice_summary TEXT DEFAULT 'C:\Downloads\Invoice_Summary',
    items_summary TEXT DEFAULT 'C:\Downloads\Items_Summary',
    gc TEXT DEFAULT 'C:\Downloads\GC',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO user_download_prefs (id) VALUES (1);

CREATE TABLE IF NOT EXISTS hsn_master (
    hsn_code TEXT PRIMARY KEY,
    description TEXT,
    gst_rate DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS consignee_master (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    consignee_name TEXT NOT NULL,
    consignee_gstin TEXT,
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(consignee_name, consignee_gstin)
);

-- ============================================================================
-- PURCHASE ORDERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS purchase_orders (
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
    our_ref TEXT,
    remarks TEXT,
    issuer_name TEXT,
    issuer_designation TEXT,
    issuer_phone TEXT,
    inspection_by TEXT,
    inspection_at TEXT,
    consignee_name TEXT,
    consignee_address TEXT,
    financial_year TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_po_date ON purchase_orders(po_date);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_name);
CREATE INDEX IF NOT EXISTS idx_po_fy ON purchase_orders(financial_year);

-- ============================================================================
-- PURCHASE ORDER ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS purchase_order_items (
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

CREATE INDEX IF NOT EXISTS idx_poi_po_number ON purchase_order_items(po_number);
CREATE INDEX IF NOT EXISTS idx_poi_material ON purchase_order_items(material_code);

-- ============================================================================
-- PURCHASE ORDER DELIVERIES (Lot Schedule)
-- ============================================================================

CREATE TABLE IF NOT EXISTS purchase_order_deliveries (
    id TEXT PRIMARY KEY,
    po_item_id TEXT NOT NULL REFERENCES purchase_order_items(id) ON DELETE CASCADE,
    lot_no INTEGER,
    ord_qty DECIMAL(15,3),
    dely_date DATE,
    dsp_qty DECIMAL(15,3) DEFAULT 0,
    rcd_qty DECIMAL(15,3) DEFAULT 0,
    rej_qty DECIMAL(15,3) DEFAULT 0,
    manual_override_qty DECIMAL(15,3) DEFAULT 0,
    entry_allow_date DATE,
    dest_code INTEGER,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pod_po_item ON purchase_order_deliveries(po_item_id);
CREATE INDEX IF NOT EXISTS idx_pod_dely_date ON purchase_order_deliveries(dely_date);
-- Performance: speed up dispatch availability checks
CREATE INDEX IF NOT EXISTS idx_pod_dispatch_availability ON purchase_order_deliveries(po_item_id, lot_no, ord_qty, dsp_qty);
CREATE INDEX IF NOT EXISTS idx_pod_lot_tracking ON purchase_order_deliveries(po_item_id, lot_no);

-- ============================================================================
-- DELIVERY CHALLANS
-- ============================================================================

CREATE TABLE IF NOT EXISTS delivery_challans (
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
    gc_number TEXT,
    gc_date TEXT,
    -- Supplier Override Details
    supplier_name TEXT,
    supplier_address TEXT,
    supplier_gstin TEXT,
    supplier_contact TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dc_date ON delivery_challans(dc_date);
CREATE INDEX IF NOT EXISTS idx_dc_po_number ON delivery_challans(po_number);

-- ============================================================================
-- DELIVERY CHALLAN ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS delivery_challan_items (
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

CREATE INDEX IF NOT EXISTS idx_dci_dc_number ON delivery_challan_items(dc_number);
CREATE INDEX IF NOT EXISTS idx_dci_po_item_id ON delivery_challan_items(po_item_id);
-- DC lot protection: ensures unique items per lot within a DC
CREATE UNIQUE INDEX IF NOT EXISTS idx_dci_unique_lot ON delivery_challan_items(dc_number, po_item_id, lot_no);

-- ============================================================================
-- GST INVOICES
-- ============================================================================

CREATE TABLE IF NOT EXISTS gst_invoices (
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
    -- Supplier Override Details
    supplier_name TEXT,
    supplier_address TEXT,
    supplier_gstin TEXT,
    supplier_contact TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoice_date ON gst_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoice_dc ON gst_invoices(dc_number);

-- ============================================================================
-- GST INVOICE ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS gst_invoice_items (
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

CREATE INDEX IF NOT EXISTS idx_gii_invoice ON gst_invoice_items(invoice_number);

-- ============================================================================
-- SRVs (Stores Receipt Vouchers)
-- ============================================================================

CREATE TABLE IF NOT EXISTS srvs (
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

CREATE INDEX IF NOT EXISTS idx_srvs_po ON srvs(po_number);
CREATE INDEX IF NOT EXISTS idx_srvs_date ON srvs(srv_date);

-- ============================================================================
-- SRV ITEMS - ALL COLUMNS INCLUDED
-- ============================================================================

CREATE TABLE IF NOT EXISTS srv_items (
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

CREATE INDEX IF NOT EXISTS idx_srv_items_srv ON srv_items(srv_number);
CREATE INDEX IF NOT EXISTS idx_srv_items_po ON srv_items(po_number);
CREATE INDEX IF NOT EXISTS idx_srv_items_po_item ON srv_items(po_number, po_item_no);
CREATE INDEX IF NOT EXISTS idx_srv_items_challan ON srv_items(challan_no);

-- ============================================================================
-- DEVIATIONS (Qty Mismatch, Document Conflicts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS deviations (
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

CREATE INDEX IF NOT EXISTS idx_deviations_entity ON deviations(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_deviations_unresolved ON deviations(is_resolved) WHERE is_resolved = 0;
CREATE INDEX IF NOT EXISTS idx_deviations_po ON deviations(po_number);

-- ============================================================================
-- RECONCILIATION VIEW
-- ============================================================================

CREATE VIEW IF NOT EXISTS reconciliation_ledger AS
SELECT 
    poi.po_number,
    poi.po_item_no,
    poi.status as item_status,
    poi.material_description,
    poi.ord_qty,
    poi.dsp_qty AS actual_delivered_qty,
    poi.rcd_qty,
    poi.rej_qty,
    (poi.ord_qty - poi.dsp_qty) as pending_qty
FROM purchase_order_items poi;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update timestamps
CREATE TRIGGER IF NOT EXISTS update_po_timestamp
AFTER UPDATE ON purchase_orders
BEGIN
    UPDATE purchase_orders SET updated_at = CURRENT_TIMESTAMP WHERE po_number = NEW.po_number;
END;

CREATE TRIGGER IF NOT EXISTS update_poi_timestamp
AFTER UPDATE ON purchase_order_items
BEGIN
    UPDATE purchase_order_items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Auto-calculate pending_qty
CREATE TRIGGER IF NOT EXISTS calculate_pending_qty_insert
AFTER INSERT ON purchase_order_items
BEGIN
    UPDATE purchase_order_items 
    SET pending_qty = ord_qty - dsp_qty 
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS calculate_pending_qty_update
AFTER UPDATE OF ord_qty, dsp_qty ON purchase_order_items
BEGIN
    UPDATE purchase_order_items 
    SET pending_qty = ord_qty - dsp_qty 
    WHERE id = NEW.id;
END;

-- DC Dispatch Sync Trigger
CREATE TRIGGER IF NOT EXISTS trg_dc_items_dispatch_sync
AFTER INSERT ON delivery_challan_items
BEGIN
    UPDATE purchase_order_items 
    SET dsp_qty = (SELECT COALESCE(SUM(dsp_qty), 0) FROM delivery_challan_items WHERE po_item_id = NEW.po_item_id)
    WHERE id = NEW.po_item_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_dc_items_dispatch_sync_update
AFTER UPDATE OF dsp_qty ON delivery_challan_items
BEGIN
    UPDATE purchase_order_items 
    SET dsp_qty = (SELECT COALESCE(SUM(dsp_qty), 0) FROM delivery_challan_items WHERE po_item_id = NEW.po_item_id)
    WHERE id = NEW.po_item_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_dc_items_dispatch_sync_delete
AFTER DELETE ON delivery_challan_items
BEGIN
    UPDATE purchase_order_items 
    SET dsp_qty = (SELECT COALESCE(SUM(dsp_qty), 0) FROM delivery_challan_items WHERE po_item_id = OLD.po_item_id)
    WHERE id = OLD.po_item_id;
END;

-- SRV Receipt Sync Trigger
CREATE TRIGGER IF NOT EXISTS trg_srv_items_receipt_sync
AFTER INSERT ON srv_items
BEGIN
    UPDATE purchase_order_items 
    SET rcd_qty = (SELECT COALESCE(SUM(rcd_qty), 0) FROM srv_items WHERE po_number = NEW.po_number AND po_item_no = NEW.po_item_no),
        rej_qty = (SELECT COALESCE(SUM(rej_qty), 0) FROM srv_items WHERE po_number = NEW.po_number AND po_item_no = NEW.po_item_no)
    WHERE po_number = NEW.po_number AND po_item_no = NEW.po_item_no;
END;

CREATE TRIGGER IF NOT EXISTS trg_srv_items_receipt_sync_update
AFTER UPDATE OF rcd_qty, rej_qty ON srv_items
BEGIN
    UPDATE purchase_order_items 
    SET rcd_qty = (SELECT COALESCE(SUM(rcd_qty), 0) FROM srv_items WHERE po_number = NEW.po_number AND po_item_no = NEW.po_item_no),
        rej_qty = (SELECT COALESCE(SUM(rej_qty), 0) FROM srv_items WHERE po_number = NEW.po_number AND po_item_no = NEW.po_item_no)
    WHERE po_number = NEW.po_number AND po_item_no = NEW.po_item_no;
END;

CREATE TRIGGER IF NOT EXISTS trg_srv_items_receipt_sync_delete
AFTER DELETE ON srv_items
BEGIN
    UPDATE purchase_order_items 
    SET rcd_qty = (SELECT COALESCE(SUM(rcd_qty), 0) FROM srv_items WHERE po_number = OLD.po_number AND po_item_no = OLD.po_item_no),
        rej_qty = (SELECT COALESCE(SUM(rej_qty), 0) FROM srv_items WHERE po_number = OLD.po_number AND po_item_no = OLD.po_item_no)
    WHERE po_number = OLD.po_number AND po_item_no = OLD.po_item_no;
END;

-- Insert schema version
INSERT OR IGNORE INTO schema_version (version) VALUES (2);
