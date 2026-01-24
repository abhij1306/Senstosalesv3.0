"""
Unified Data Models with Robust Validation
Per Critical Feedback: Added constraints, regex patterns, and type safety.
"""

import re
from typing import Any, Generic, List, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.generics import GenericModel

T = TypeVar("T")


class PaginatedMetadata(BaseModel):
    total_count: int
    page: int
    limit: int


class PaginatedResponse(GenericModel, Generic[T]):
    items: List[T]
    metadata: PaginatedMetadata


# Relaxed patterns for legacy/null data
GSTIN_PATTERN = r"^[A-Za-z0-9\-/.\s]*$"
DATE_PATTERN = r"^[0-9\-/.\s]*$"
# Allows alphanumeric, hyphen, and forward slash (common in PO/DC numbers)
DOC_NUMBER_PATTERN = r"^[A-Za-z0-9\-/]+$"

# ============================================================
# UTILITIES & VALIDATORS
# ============================================================


def empty_to_none(v: Any) -> Any:
    if isinstance(v, str):
        v = v.strip()
    if v is None or v == "":
        return None
    return v


def validate_date_fmt(v: str | None) -> str | None:
    if v is None or v == "":
        return None
    if not re.match(DATE_PATTERN, v):
        raise ValueError(f"Invalid date format '{v}'. Expected YYYY-MM-DD")
    return v


def validate_gstin_fmt(v: str | None) -> str | None:
    if v is None or v == "":
        return None
    if not re.match(GSTIN_PATTERN, v):
        raise ValueError(f"Invalid GSTIN format '{v}'")
    return v


def check_doc_number(v: str) -> str:
    if v is None:
        return None
    if not re.match(DOC_NUMBER_PATTERN, v):
        raise ValueError(f"Invalid characters in document number '{v}'")
    return v


class CoreModel(BaseModel):
    """Base model with shared configuration and validators"""

    model_config = ConfigDict(extra="ignore")

    @classmethod
    def coerce_to_int(cls, v):
        """Ensure integer fields are proper ints (handles SQLite float return)"""
        if v is None:
            return None
        if isinstance(v, float):
            return int(v)
        return v


# ============================================================
# PURCHASE ORDER MODELS
# ============================================================


class POHeader(CoreModel):
    """Purchase Order Header - Maximally Relaxed"""

    po_number: str = Field(..., min_length=1, max_length=100)
    po_date: str | None = None
    supplier_name: str | None = None
    supplier_gstin: str | None = None
    supplier_code: str | None = None
    supplier_phone: str | None = None
    supplier_fax: str | None = None
    supplier_email: str | None = None
    department_no: int | None = None
    enquiry_no: str | None = None
    enquiry_date: str | None = None
    quotation_ref: str | None = None
    quotation_date: str | None = None
    rc_no: str | None = None
    order_type: str | None = None
    po_status: str | None = None
    tin_no: str | None = None
    ecc_no: str | None = None
    mpct_no: str | None = None
    po_value: float | None = 0.0
    fob_value: float | None = 0.0
    ex_rate: float | None = 1.0
    currency: str | None = "INR"
    net_po_value: float | None = 0.0
    amend_no: int = 0
    remarks: str | None = None
    our_ref: str | None = None
    issuer_name: str | None = None
    issuer_designation: str | None = None
    issuer_phone: str | None = None
    inspection_by: str | None = None
    inspection_at: str | None = None
    financial_year: str | None = None
    consignee_name: str | None = None
    consignee_address: str | None = None

    @field_validator("po_number")
    def check_po_number(cls, v):
        return check_doc_number(v)


class PODelivery(CoreModel):
    """Purchase Order Delivery Schedule - Maximally Relaxed"""

    id: str | None = None
    lot_no: int | None = None
    ord_qty: float = 0.0
    dsp_qty: float = 0.0
    rcd_qty: float = 0.0
    rej_qty: float = 0.0
    dely_date: str | None = None
    entry_allow_date: str | None = None
    dest_code: int | None = None
    remarks: str | None = None
    manual_override_qty: float | None = 0.0

    @field_validator("lot_no", "dest_code", mode="before")
    @classmethod
    def validate_ints(cls, v):
        return cls.coerce_to_int(v)

    @field_validator("dely_date", "entry_allow_date", mode="before")
    @classmethod
    def validate_dates(cls, v):
        return empty_to_none(v)


class POItem(CoreModel):
    """Purchase Order Item - Maximally Relaxed"""

    id: str | None = None
    po_item_no: int = Field(..., ge=0)
    material_code: str | None = None
    material_description: str | None = None
    drg_no: str | None = None
    mtrl_cat: int | None = None
    unit: str | None = None
    po_rate: float = 0.0
    ord_qty: float = 0.0
    rcd_qty: float = 0.0
    rej_qty: float = 0.0
    dsp_qty: float = 0.0
    item_value: float = 0.0
    hsn_code: str | None = None
    pending_qty: float = 0.0
    deliveries: list[PODelivery] = Field(default_factory=list)

    @field_validator("po_item_no", "mtrl_cat", mode="before")
    @classmethod
    def validate_ints(cls, v):
        return cls.coerce_to_int(v)

    @field_validator("deliveries")
    def limit_deliveries(cls, v):
        if len(v) > 1000:
            raise ValueError("Too many delivery schedules (max 1000)")
        return v


class POListItem(BaseModel):
    """Purchase Order List Item (Summary)"""

    model_config = ConfigDict(extra="ignore")

    po_number: str
    po_date: str | None = None
    supplier_name: str | None = None
    po_value: float | None = None
    amend_no: int = 0
    po_status: str | None = None
    financial_year: str | None = None
    linked_dc_numbers: str | None = None
    total_ord_qty: float = 0.0
    total_dsp_qty: float = 0.0
    total_rcd_qty: float = 0.0
    total_rej_qty: float = 0.0
    total_pending_qty: float = 0.0
    total_items_count: int = 0
    drg_no: str | None = None
    created_at: str | None = None


class POStats(BaseModel):
    """PO Page KPIs"""

    open_orders_count: int = Field(..., ge=0)
    pending_approval_count: int = Field(..., ge=0)
    total_value_ytd: float = Field(..., ge=0)
    total_value_change: float = 0.0
    total_shipped_qty: float = 0.0
    total_rejected_qty: float = 0.0


class PODetail(BaseModel):
    """Purchase Order Detail (Full)"""

    header: POHeader
    items: list[POItem]

    @field_validator("items")
    def limit_items(cls, v):
        if len(v) > 500:
            raise ValueError("Too many items in PO (max 500)")
        return v


# ============================================================
# DELIVERY CHALLAN MODELS
# ============================================================


class DCCreate(BaseModel):
    """Create Delivery Challan - Maximally Relaxed"""

    dc_number: str = Field(..., min_length=1, max_length=100)
    dc_date: str | None = None
    our_ref: str | None = None
    po_number: str | None = None
    department_no: int | None = None
    consignee_name: str | None = None
    consignee_gstin: str | None = None
    consignee_address: str | None = None
    inspection_company: str | None = None
    eway_bill_no: str | None = None
    vehicle_no: str | None = None
    lr_no: str | None = None
    transporter: str | None = None
    mode_of_transport: str | None = None
    remarks: str | None = None
    gc_number: str | None = None
    gc_date: str | None = None

    # Supplier Override Details
    supplier_name: str | None = None
    supplier_address: str | None = None
    supplier_gstin: str | None = None
    supplier_contact: str | None = None

    model_config = ConfigDict(extra="ignore")

    @field_validator("dc_date", mode="before")
    @classmethod
    def validate_required_date(cls, v):
        if v == "":
            raise ValueError("Date cannot be empty")
        return v

    @field_validator("consignee_gstin", mode="before")
    @classmethod
    def validate_gstin(cls, v):
        return empty_to_none(v)

    @field_validator("dc_number")
    def check_dc_number(cls, v):
        return check_doc_number(v)


class DCListItem(BaseModel):
    """Delivery Challan List Item"""

    model_config = ConfigDict(extra="ignore")

    dc_number: str
    dc_date: str
    our_ref: str | None = None  # NEW: Our Ref field
    po_number: str | None = None
    consignee_name: str | None = None
    status: str = "Pending"
    total_value: float = 0.0
    created_at: str | None = None
    total_ord_qty: float = 0.0
    total_dsp_qty: float = 0.0
    total_pending_qty: float = 0.0
    total_rcd_qty: float = 0.0
    invoice_number: str | None = None
    gc_number: str | None = None


class DCStats(BaseModel):
    """Delivery Challan KPIs"""

    total_challans: int = Field(..., ge=0)
    total_challans_change: float = 0.0
    pending_delivery: int = Field(..., ge=0)
    completed_delivery: int = Field(..., ge=0)
    completed_change: float = 0.0
    total_value: float = Field(..., ge=0)


# ============================================================
# INVOICE MODELS
# ============================================================


class InvoiceCreate(BaseModel):
    """Create Invoice - Maximally Relaxed"""

    invoice_number: str = Field(..., min_length=1, max_length=100)
    invoice_date: str | None = None
    dc_number: str | None = None
    po_numbers: str | None = None
    buyer_gstin: str | None = None
    place_of_supply: str | None = None
    taxable_value: float = 0.0
    cgst: float = 0.0
    sgst: float = 0.0
    igst: float = 0.0
    total_invoice_value: float = 0.0
    remarks: str | None = None

    # Missing fields required for overrides
    vehicle_no: str | None = None
    transporter: str | None = None
    lr_no: str | None = None

    model_config = ConfigDict(extra="ignore")

    @field_validator("invoice_date", mode="before")
    @classmethod
    def validate_required_date(cls, v):
        if v == "":
            raise ValueError("Date cannot be empty")
        return v

    @field_validator("buyer_gstin", mode="before")
    @classmethod
    def validate_gstin(cls, v):
        return empty_to_none(v)

    @field_validator("invoice_number")
    def check_invoice_number(cls, v):
        return check_doc_number(v)


class InvoiceListItem(BaseModel):
    """Invoice List Item"""

    model_config = ConfigDict(extra="ignore")

    invoice_number: str
    invoice_date: str
    po_numbers: str | None = None
    dc_number: str | None = None
    buyer_gstin: str | None = None
    taxable_value: float | None = None
    total_items: int = 0
    total_ord_qty: float = 0.0
    total_dsp_qty: float = 0.0
    total_pending_qty: float = 0.0
    total_rcd_qty: float = 0.0
    total_invoice_value: float | None = None
    status: str = "Pending"
    created_at: str | None = None


class InvoiceStats(BaseModel):
    """Invoice Page KPIs"""

    total_invoiced: float = Field(..., ge=0)
    pending_payments: float = Field(..., ge=0)
    gst_collected: float = Field(..., ge=0)
    total_invoiced_change: float = 0.0


# ============================================================
# SRV MODELS
# ============================================================


class SRVHeader(BaseModel):
    """SRV Header"""

    srv_number: str = Field(..., min_length=1, max_length=50)
    srv_date: str = Field(..., pattern=DATE_PATTERN)
    po_number: str = Field(..., min_length=1, max_length=50)
    srv_status: str = "Received"
    po_found: bool = True
    is_active: bool = True
    invoice_number: str | None = None
    warning_message: str | None = None
    created_at: str | None = None
    updated_at: str | None = None

    model_config = ConfigDict(extra="ignore")


class SRVListItem(BaseModel):
    """SRV List Item"""

    model_config = ConfigDict(extra="ignore")

    srv_number: str
    srv_date: str
    po_number: str
    srv_status: str = "Received"
    po_found: bool = True
    created_at: str | None = None


class SRVListItemOptimized(BaseModel):
    """Optimized SRV List Item for Performance"""

    model_config = ConfigDict(extra="ignore")

    srv_number: str
    srv_date: str
    po_number: str
    total_rcd_qty: float
    total_rej_qty: float
    total_accepted_qty: float
    total_ord_qty: float
    po_found: bool
    warning_message: str | None = None
    created_at: str | None = None


class SRVItem(BaseModel):
    """SRV Item - Maximally Relaxed"""

    id: str | None = None
    po_item_no: int = Field(0, ge=0)
    lot_no: int | None = 0
    srv_item_no: int | None = 0
    rev_no: str | None = "0"
    material_code: str | None = None
    rcd_qty: float = 0.0
    rej_qty: float = 0.0
    ord_qty: float = 0.0
    challan_qty: float = 0.0
    accepted_qty: float = 0.0
    unit: str | None = None
    challan_no: str | None = None
    challan_date: str | None = None
    invoice_no: str | None = None
    invoice_date: str | None = None
    div_code: str | None = None
    pmir_no: str | None = None
    finance_date: str | None = None
    cnote_no: str | None = None
    cnote_date: str | None = None
    material_description: str | None = None
    mtrl_cat: int | None = None
    drg_no: str | None = None
    remarks: str | None = None

    model_config = ConfigDict(extra="ignore")

    @field_validator("po_item_no", "lot_no", "srv_item_no", "rev_no", mode="before")
    @classmethod
    def coerce_to_int(cls, v):
        """Ensure integer fields are proper ints (not 1.0 from SQLite)"""
        if v is None:
            return None
        if isinstance(v, float):
            return int(v)
        return v


class SRVDetail(BaseModel):
    """SRV Detail (Full)"""

    header: SRVHeader
    items: list[SRVItem]

    @field_validator("items")
    def limit_items(cls, v):
        if len(v) > 1000:
            raise ValueError("Too many items in SRV upload (max 1000)")
        return v


class SRVStats(BaseModel):
    """SRV Page KPIs"""

    total_srvs: int = Field(..., ge=0)
    srvs_this_month: int | None = Field(0, ge=0)
    total_rcd_qty: float = Field(..., ge=0)
    total_rej_qty: float = Field(..., ge=0)
    srv_change_pct: float | None = 0.0
    rejection_rate: float | None = 0.0
    missing_po_count: int | None = 0


# ============================================================
# SETTINGS & BUYERS

# ============================================================


class Settings(BaseModel):
    """Business Settings"""

    supplier_description: str | None = Field(None, max_length=500)
    supplier_address: str | None = Field(None, max_length=500)
    supplier_gstin: str | None = Field(None, max_length=100)
    supplier_contact: str | None = Field(None, max_length=100)
    supplier_phone: str | None = Field(None, max_length=50)
    supplier_state: str | None = Field(None, max_length=100)
    supplier_state_code: str | None = Field(None, max_length=10)
    pan_number: str | None = Field(None, max_length=20)
    buyer_name: str | None = Field(None, max_length=200)
    buyer_address: str | None = Field(None, max_length=500)
    buyer_gstin: str | None = Field(None, max_length=100)
    buyer_state: str | None = Field(None, max_length=100)
    buyer_state_code: str | None = Field(None, max_length=10)
    bank_name: str | None = Field(None, max_length=200)
    bank_branch: str | None = Field(None, max_length=200)
    bank_account_no: str | None = Field(None, max_length=50)
    bank_ifsc: str | None = Field(None, max_length=20)

    model_config = ConfigDict(extra="allow")

    @field_validator("supplier_gstin", "buyer_gstin", mode="before")
    @classmethod
    def validate_gstins(cls, v):
        return empty_to_none(v)


class SettingsUpdate(BaseModel):
    """Single Setting Update"""

    key: str
    value: str


class Buyer(BaseModel):
    """Buyer Entity (Unified Schema)"""

    id: int | None = None
    name: str = Field(..., min_length=1, max_length=200)
    gstin: str | None = Field(None, pattern=GSTIN_PATTERN)
    billing_address: str | None = Field(None, max_length=1000)
    shipping_address: str | None = Field(None, max_length=1000)
    address: str | None = Field(None, max_length=500)  # Legacy support
    place_of_supply: str | None = Field(None, max_length=100)
    state: str | None = Field(None, max_length=50)
    state_code: str | None = Field(None, max_length=5)
    is_default: bool = False
    is_active: bool = True
    created_at: str | None = None


class DownloadPrefs(BaseModel):
    """User Download Folder Preferences"""

    id: int | None = None
    po_html: str | None = Field(default=r"C:\Downloads\PO_HTML")
    srv_html: str | None = Field(default=r"C:\Downloads\SRV_HTML")
    challan: str | None = Field(default=r"C:\Downloads\Challan")
    invoice: str | None = Field(default=r"C:\Downloads\Invoice")
    challan_summary: str | None = Field(default=r"C:\Downloads\Challan_Summary")
    invoice_summary: str | None = Field(default=r"C:\Downloads\Invoice_Summary")
    items_summary: str | None = Field(default=r"C:\Downloads\Items_Summary")
    gc: str | None = Field(default=r"C:\Downloads\GC")
    updated_at: str | None = None


# ============================================================
# DASHBOARD MODELS

# ============================================================


class RejectionProfileItem(BaseModel):
    """Analytics: Rejection Profile Item"""

    material: str | None
    total_received: float = 0.0
    total_rejected: float = 0.0
    rejection_rate: float = 0.0
    example_po_number: str | None = None


class FulfillmentTrendItem(BaseModel):
    """Analytics: Fulfillment Trend Item"""

    month: str
    ordered_qty: float = 0.0
    accepted_qty: float = 0.0


class DashboardSummary(BaseModel):
    """Dashboard KPIs (Consolidated for Zero-Flicker)"""

    total_sales_month: float
    sales_growth: float
    pending_pos: int
    new_pos_today: int
    active_challans: int
    active_challans_growth: str
    total_po_value: float
    po_value_growth: float
    total_ord_qty: float = 0
    total_dsp_qty: float = 0
    total_rcd_qty: float = 0
    total_rej_qty: float = 0

    # Analytics Extensions
    avg_lead_time: float = 0.0
    supply_health_score: float = 100.0
    rejection_profile: list[RejectionProfileItem] = []
    fulfillment_trends: list[FulfillmentTrendItem] = []

    recent_activity: list[dict[str, Any]] = []
    performance_data: list[dict[str, Any]] = []


DashboardSummary.model_rebuild()


class ActivityItem(BaseModel):
    """Recent Activity Item"""

    type: str  # "PO", "DC", "Invoice"
    number: str
    date: str
    party: str | None = None
    amount: float | None = None
    status: str | None = None
    description: str | None = None
    created_at: str | None = None


# ============================================================
# SEARCH MODELS
# ============================================================
class SearchResult(BaseModel):
    """Global Search Result"""

    id: str
    type: str
    number: str
    date: str
    party: str
    amount: float = 0.0
    type_label: str
    status: str
