-- ============================================================================
-- SENSTOSALES DEFAULT SEED DATA (SANITIZED)
-- Default Buyer and Supplier configuration placeholders
-- ============================================================================

-- 1. Default Company (Supplier) Settings
INSERT OR IGNORE INTO settings (key, value) VALUES ('supplier_name', 'Your Company Name');
INSERT OR IGNORE INTO settings (key, value) VALUES ('supplier_address', '123 Business Avenue, Industrial Park, City - 000000');
INSERT OR IGNORE INTO settings (key, value) VALUES ('supplier_gstin', '23AAAAAAAAAAAAA');
INSERT OR IGNORE INTO settings (key, value) VALUES ('supplier_contact', '+91 00000 00000');
INSERT OR IGNORE INTO settings (key, value) VALUES ('supplier_state', 'State Name');
INSERT OR IGNORE INTO settings (key, value) VALUES ('supplier_state_code', '00');
INSERT OR IGNORE INTO settings (key, value) VALUES ('supplier_description', 'Specialist in: Sensors, Automation & Engineering Solutions');

-- 2. Default GST Rates
INSERT OR IGNORE INTO settings (key, value) VALUES ('cgst_rate', '9.0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('sgst_rate', '9.0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('igst_rate', '18.0');

-- 3. Default Buyer (Placeholders)
INSERT OR IGNORE INTO buyers (name, gstin, billing_address, shipping_address, address, state, state_code, place_of_supply, is_default) 
VALUES (
    'Partner Engineering PSU', 
    '23BBBBBBBBBBBBB', 
    'Central Accounts Office, District Park, City - 000000', 
    'Central Accounts Office, District Park, City - 000000', 
    'District Park, City', 
    'State Name', 
    '00', 
    'CITY, STATE', 
    1
);

-- 4. Default Consignee Master
INSERT OR IGNORE INTO consignee_master (consignee_name, consignee_gstin, address)
VALUES (
    'Partner Engineering PSU',
    '23BBBBBBBBBBBBB',
    'Central Accounts Office, District Park, City - 000000'
);
