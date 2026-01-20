/**
 * Centralized Type Definitions for SenstoSales
 * Replaces all 'any' usage with strict interfaces
 */

// ============================================================
// DASHBOARD & COMMON TYPES
// ============================================================

export interface RejectionProfileItem {
    material: string | null;
    total_received: number;
    total_rejected: number;
    rejection_rate: number;
    example_po_number?: string;
}

export interface FulfillmentTrendItem {
    month: string;
    ordered_qty: number;
    accepted_qty: number;
}

export interface DashboardSummary {
    total_sales_month: number;
    sales_growth: number;
    pending_pos: number;
    new_pos_today: number;
    active_challans: number;
    active_challans_growth: string;
    total_po_value: number;
    po_value_growth: number;
    total_ord_qty: number;
    total_dsp_qty: number;
    total_rcd_qty: number;
    total_rej_qty: number;

    // Analytics Extensions
    avg_lead_time?: number;
    supply_health_score?: number;
    rejection_profile?: RejectionProfileItem[];
    fulfillment_trends?: FulfillmentTrendItem[];

    recent_activity: ActivityItem[];
    performance_data: any[];
}

export interface ActivityItem {
    type: string;
    number: string;
    date: string;
    party: string;
    amount: number | null;
    status: string;
}

export interface SearchResult {
    type: "PO" | "DC" | "Invoice" | "SRV";
    id: string;
    number: string;
    date: string;
    party: string;
    amount: number | null;
    status: string;
    title?: string;
    subtitle?: string;
    description?: string;
    total_items?: number;
    total_qty?: number;
    total_ordered?: number;
    total_value?: number;
    po_number?: string;
    invoice_number?: string;
    dc_number?: string;
    dc_numbers?: string[];
    invoice_numbers?: string[];
    srv_numbers?: string[];
    po_exists?: boolean;
    dc_exists?: boolean;
    invoice_exists?: boolean;
    accepted_qty?: number;
    rejected_qty?: number;
    ordered_qty?: number;
    match_context?: string;
    has_deviations?: boolean;
}

export interface Alert {
    id: string;
    alert_type: string;
    entity_type: string;
    entity_id: string;
    message: string;
    severity: "error" | "warning" | "info";
    is_acknowledged: boolean;
    created_at: string;
}

// ============================================================
// REPORT TYPES
// ============================================================

export interface ReconciliationItem {
    po_number: string;
    po_date: string;
    supplier_name: string;
    po_item_no: number;
    material_code: string;
    material_description: string;
    ord_qty: number;
    dsp_qty: number;
    pending_qty: number;
}

export interface DCWithoutInvoice {
    dc_number: string;
    dc_date: string;
    po_number: string;
    consignee_name: string;
    created_at: string;
}

export interface SupplierSummary {
    supplier_name: string;
    po_count: number;
    total_po_value: number;
    last_po_date: string;
}

// ============================================================
// ============================================================
// PURCHASE ORDER TYPES
// ============================================================

export interface LinkedDC {
    dc_number: string;
    dc_date: string | null;
    dsp_qty: number;
}

export interface PODelivery {
    id?: string;
    lot_no?: number;
    ord_qty?: number;
    dsp_qty?: number;
    rcd_qty?: number;
    dely_date?: string;
    entry_allow_date?: string;
    dest_code?: number;
    remarks?: string;
    manual_override_qty?: number;
    linked_dcs?: LinkedDC[];
}

export interface POItem {
    id?: string;
    po_item_no: number;
    material_code?: string;
    material_description?: string;
    drg_no?: string;
    mtrl_cat?: number;
    unit?: string;
    po_rate?: number;
    ord_qty?: number;
    rcd_qty?: number;
    rej_qty?: number;
    item_value?: number;
    hsn_code?: string;
    dsp_qty?: number;
    pending_qty?: number;
    deliveries: PODelivery[];
}

export interface POHeader {
    po_number: string;
    po_date?: string;
    supplier_name?: string;
    supplier_gstin?: string;
    supplier_code?: string;
    our_ref?: string;
    supplier_phone?: string;
    supplier_fax?: string;
    supplier_email?: string;
    department_no?: string;
    enquiry_no?: string;
    enquiry_date?: string;
    quotation_ref?: string;
    quotation_date?: string;
    rc_no?: string;
    order_type?: string;
    po_status?: string;
    tin_no?: string;
    ecc_no?: string;
    mpct_no?: string;
    po_value?: number;
    fob_value?: number;
    ex_rate?: number;
    currency?: string;
    net_po_value?: number;
    amend_no?: number;
    inspection_by?: string;
    inspection_at?: string;
    issuer_name?: string;
    issuer_designation?: string;
    issuer_phone?: string;
    remarks?: string;
    project_name?: string;
    consignee_name?: string;
    consignee_address?: string;
    status?: string;
    payment_terms?: string;
    issuer_department?: string;
}

export interface PODetail {
    header: POHeader;
    items: POItem[];
}

export interface POListItem {
    po_number: string;
    po_date: string | null;
    supplier_name: string | null;
    po_value: number | null;
    amend_no: number;
    po_status: string | null;
    linked_dc_numbers: string | null;
    total_ord_qty: number;
    total_dsp_qty: number;
    total_rcd_qty?: number;
    total_rej_qty?: number;
    total_pending_qty: number;
    total_items_count?: number;
    created_at: string | null;
}

export interface POStats {
    open_orders_count: number;
    pending_approval_count: number;
    total_value_ytd: number;
    total_value_change: number;
    total_shipped_qty: number;
    total_rejected_qty: number;
}

// ============================================================
// DELIVERY CHALLAN TYPES
// ============================================================

export interface DCItemRow {
    id: string;
    po_item_id: string;
    po_item_no?: number;
    lot_no?: number | string;
    material_code?: string;
    material_description?: string;
    description?: string;
    unit?: string;
    po_rate?: number;
    ord_qty?: number;
    dsp_qty?: number;
    rcd_qty?: number;
    rej_qty?: number;
    lot_ord_qty?: number;
    dispatch_qty?: number; // User input for new DC
    pending_qty?: number;
    hsn_code?: string;
    hsn_rate?: number;
    pending_post_dc?: number;
    drg_no?: string;
    mtrl_cat?: number;
    original_pending?: number;
    dely_date?: string;
    linked_dcs?: LinkedDC[];
}

export interface DCHeader {
    dc_number: string;
    dc_date: string;
    our_ref?: string;  // NEW: Our Ref field
    po_number?: string;
    department_no?: string;
    consignee_name?: string;
    consignee_gstin?: string;
    consignee_address?: string;
    inspection_company?: string;
    eway_bill_no?: string;
    vehicle_no?: string;
    lr_no?: string;
    transporter?: string;
    mode_of_transport?: string;
    remarks?: string;
    created_at?: string;
    supplier_phone?: string;
    supplier_gstin?: string;
    po_date?: string;
    invoice_number?: string;
    gc_number?: string;
    gc_date?: string;
    supplier_name?: string;
    supplier_address?: string;
    supplier_contact?: string;
}

export interface DCDetail {
    header: DCHeader;
    items: DCItemRow[];
}

export interface DCListItem {
    dc_number: string;
    dc_date: string;
    po_number: number | string | null;
    consignee_name: string | null;
    status: string;
    total_ord_qty?: number;
    total_dsp_qty?: number;
    total_value: number;
    total_rcd_qty?: number;
    created_at: string | null;
    invoice_number?: string;
}

export interface DCStats {
    total_challans: number;
    total_challans_change: number;
    pending_delivery: number;
    completed_delivery: number;
    completed_change: number;
    total_value: number;
}

export interface DCCreate {
    dc_number: string;
    dc_date: string;
    po_number?: number;
    department_no?: number;
    consignee_name?: string;
    consignee_gstin?: string;
    consignee_address?: string;
    inspection_company?: string;
    eway_bill_no?: string;
    vehicle_no?: string;
    lr_no?: string;
    transporter?: string;
    mode_of_transport?: string;
    remarks?: string;
    gc_number?: string;
    gc_date?: string;
}

// ============================================================
// INVOICE TYPES
// ============================================================

export interface InvoiceItem {
    id?: number;
    invoice_number: string;
    po_item_no?: string;
    lot_no?: number;
    description?: string;
    hsn_sac?: string;
    quantity: number;
    unit?: string;
    rate: number;
    taxable_value: number;
    cgst_rate?: number;
    cgst_amount?: number;
    sgst_rate?: number;
    sgst_amount?: number;
    igst_rate?: number;
    igst_amount?: number;
    total_amount: number;
    amount?: number;
    material_code?: string;
    no_of_packets?: number;
    rcd_qty?: number;
    dc_dsp_qty?: number;
}

export interface InvoiceHeader {
    invoice_number: string;
    invoice_date: string;
    linked_dc_numbers?: string;
    po_numbers?: string;
    buyer_name?: string;
    buyer_address?: string;
    buyer_gstin?: string;
    buyer_state?: string;
    buyer_state_code?: string;
    customer_gstin?: string;
    place_of_supply?: string;
    buyers_order_no?: string;
    buyers_order_date?: string;
    vehicle_no?: string;
    lr_no?: string;
    transporter?: string;
    destination?: string;
    terms_of_delivery?: string;
    gemc_number?: string;
    gemc_date?: string;
    mode_of_payment?: string;
    payment_terms?: string;
    despatch_doc_no?: string;
    despatch_through?: string;
    srv_no?: string;
    srv_date?: string;
    taxable_value?: number;
    total_taxable_value?: number;
    cgst?: number;
    cgst_total?: number;
    sgst?: number;
    sgst_total?: number;
    igst?: number;
    total_invoice_value?: number;
    dc_number?: string;
    dc_date?: string;
    remarks?: string;
    created_at?: string;
    // Supplier Overrides
    supplier_name?: string;
    supplier_address?: string;
    supplier_gstin?: string;
    supplier_contact?: string;
}

export interface InvoiceDetail {
    header: InvoiceHeader;
    items: InvoiceItem[];
    linked_dcs?: DCHeader[];
}

export interface InvoiceListItem {
    invoice_number: string;
    invoice_date: string;
    po_numbers: string | null;
    dc_number?: string;
    linked_dc_numbers: string | null;
    customer_gstin: string | null;
    total_items?: number;
    total_dsp_qty?: number;
    total_rcd_qty?: number;
    taxable_value: number | null;
    total_invoice_value: number | null;
    created_at: string | null;
    status: "Paid" | "Pending" | "Overdue";
}

export interface InvoiceStats {
    total_invoiced: number;
    pending_payments: number;
    gst_collected: number;
    total_invoiced_change: number;
    pending_payments_count: number;
    gst_collected_change: number;
}

export interface InvoiceCreate {
    invoice_number: string;
    invoice_date: string;
    linked_dc_numbers: string;
    po_numbers: string;
    customer_gstin: string;
    place_of_supply: string;
    taxable_value: number;
    cgst: number;
    sgst: number;
    igst: number;
    total_invoice_value: number;
    remarks: string;
}

// ============================================================
// FORM FIELD TYPES
// ============================================================

export interface FieldProps {
    label: string;
    value: string | number;
    onChange?: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => void;
    placeholder?: string;
    disabled?: boolean;
    readonly?: boolean;
    type?: string;
    field?: string;
}

export interface TableInputProps {
    value: string | number;
    onChange: (value: string | number) => void;
    type?: string;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    readOnly?: boolean;
    max?: number;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface APIResponse<T> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}

export interface CreateResponse {
    success: boolean;
    dc_number?: string;
    invoice_number?: string;
    total_amount?: number;
    items_count?: number;
}

// ============================================================
// SRV (STORES RECEIPT VOUCHER) TYPES
// ============================================================

export interface SRVHeader {
    srv_number: string;
    srv_date: string;
    po_number: string;
    srv_status: string;
    po_found?: boolean;
    created_at?: string;
    total_value?: number;
}

export interface SRVItem {
    id: number;
    po_item_no: number;
    lot_no: number | null;
    srv_item_no?: number;
    rev_no?: string | number;
    rcd_qty: number;
    rej_qty: number;
    ord_qty?: number;
    challan_qty?: number;
    accepted_qty?: number;
    unit?: string;
    challan_no: string | null;
    challan_date?: string;
    invoice_no: string | null;
    invoice_date?: string;
    div_code?: string;
    pmir_no?: string;
    finance_date?: string;
    cnote_no?: string;
    cnote_date?: string;
    material_description?: string;
    mtrl_cat?: number;
    drg_no?: string;
    remarks: string | null;
}

export interface SRVDetail {
    header: SRVHeader;
    items: SRVItem[];
}

export interface SRVListItem {
    srv_number: string;
    srv_date: string;
    po_number: string;
    total_rcd_qty: number;
    total_rej_qty: number;
    total_ord_qty: number;
    total_challan_qty: number;
    total_accepted_qty: number;
    srv_status?: string;
    total_value?: number;
    po_found?: boolean;
    po_ordered_qty?: number;
    warning_message?: string;
    challan_numbers?: string;
    invoice_numbers?: string;
    created_at?: string;
}

export interface SRVStats {
    total_srvs: number;
    total_rcd_qty: number;
    total_rej_qty: number;
    missing_po_count: number;
    rejection_rate?: number; // Added
}

// ============================================================
// DEVIATION TYPES
// ============================================================

export interface Deviation {
    id: number;
    deviation_type: "QTY_MISMATCH" | "DOC_NUMBER_CONFLICT" | "FY_COLLISION";
    entity_type: "srv_item" | "srv" | "dc_item";
    entity_id: string;
    po_number: string | null;
    field_name: string | null;
    expected_value: string | null;
    actual_value: string | null;
    details: any | null;
    is_resolved: boolean;
    resolved_at: string | null;
    resolved_by: string | null;
    created_at: string;
}

