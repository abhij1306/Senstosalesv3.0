-- ============================================================================
-- PERFORMANCE OPTIMIZATION INDEXES
-- Critical indexes to resolve table scan issues
-- ============================================================================

-- SRV Performance Indexes
CREATE INDEX IF NOT EXISTS idx_srv_items_challan_no ON srv_items(challan_no);
CREATE INDEX IF NOT EXISTS idx_srv_items_created_at ON srv_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_srv_items_po_challan ON srv_items(po_number, challan_no);
CREATE INDEX IF NOT EXISTS idx_srv_items_po_item_lot ON srv_items(po_number, po_item_no, lot_no);
-- Required by audit: srv_items(po_number, po_item_no, lot_no, srv_number)
CREATE INDEX IF NOT EXISTS idx_srv_items_composite ON srv_items(po_number, po_item_no, lot_no, srv_number);

-- PO Performance Indexes
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_status ON purchase_order_items(status);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_status_qty ON purchase_order_items(status, ord_qty) WHERE status = 'Active';
CREATE INDEX IF NOT EXISTS idx_po_deliveries_composite ON purchase_order_deliveries(po_item_id, lot_no, dely_date);
-- Required by audit: purchase_orders(po_number, financial_year)
CREATE INDEX IF NOT EXISTS idx_po_number_fy ON purchase_orders(po_number, financial_year);
-- Required by audit: purchase_order_items(po_number, po_item_no)
CREATE INDEX IF NOT EXISTS idx_poi_po_item_composite ON purchase_order_items(po_number, po_item_no);
-- Required by audit: purchase_order_deliveries(po_item_id, lot_no)
CREATE INDEX IF NOT EXISTS idx_pod_item_lot ON purchase_order_deliveries(po_item_id, lot_no);

-- DC Performance Indexes
CREATE INDEX IF NOT EXISTS idx_delivery_challan_items_po_item_lot ON delivery_challan_items(po_item_id, lot_no);
CREATE INDEX IF NOT EXISTS idx_dc_items_po_lot ON delivery_challan_items(po_item_id, lot_no);
-- Required by audit: delivery_challan_items(po_item_id, lot_no, dc_number)
CREATE INDEX IF NOT EXISTS idx_dci_composite ON delivery_challan_items(po_item_id, lot_no, dc_number);

-- Invoice Performance Indexes
-- Required by audit: gst_invoices(invoice_number, dc_number, financial_year)
CREATE INDEX IF NOT EXISTS idx_invoice_composite ON gst_invoices(invoice_number, dc_number, financial_year);
CREATE INDEX IF NOT EXISTS idx_invoice_number_fy ON gst_invoices(invoice_number, financial_year);

-- Dashboard Query Optimization
CREATE INDEX IF NOT EXISTS idx_po_date_status ON purchase_orders(po_date DESC, po_status);
CREATE INDEX IF NOT EXISTS idx_dc_date_po ON delivery_challans(dc_date DESC, po_number);
CREATE INDEX IF NOT EXISTS idx_invoice_date ON gst_invoices(invoice_date DESC);

-- Search Optimization
CREATE INDEX IF NOT EXISTS idx_po_supplier_search ON purchase_orders(supplier_name, po_number);
CREATE INDEX IF NOT EXISTS idx_srv_search ON srvs(srv_number, po_number);