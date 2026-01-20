# Supply Cycle Pulse: Predictive Analytics

**Status:** Proposed
**Category:** Data Science / Proactive Business Intelligence
**Concept:** "Know before it happens"

## Overview
Traditional dashboards show what *happened*. **Supply Cycle Pulse** uses the rich historical data of POs, DCs, and SRVs to predict what *will* happen. It identifies bottlenecks, forecasts revenue, and rates supply chain health with proactive alerts.

## Key Analytic Modules

### 1. Rejection Trend Prediction (The "Quality Radar")
Analyze historical SRV rejections to identify high-risk material batches or suppliers.
- **Metric**: "Material-Supplier Risk Score."
- **Benefit**: Alert users during DC creation if a particular material from a supplier has had a >15% rejection rate in the last quarter.

### 2. Lead-Time Benchmarking & Bottlenecks
Automatically calculate the time difference between `PO Date -> DC Date` and `DC Date -> SRV Date`.
- **Insight**: Identify which departments (DVNs) are slow to "Accept" SRVs or which buyers take the longest to process invoices.
- **Action**: A "Heatmap" view on the dashboard showing where documents are currently stuck.

### 3. Revenue & Cash-Flow Projection
Analyze "Uninvoiced DCs" and "Pending POs" to forecast upcoming revenue.
- **Algorithm**: `Expected Revenue = (Sum of Uninvoiced DCs) + (Sum of Open POs * Historical Fulfillment Rate)`.
- **Visualization**: A 30/60/90-day projection chart helping management with financial planning.

### 4. Smart Fulfillment Alerts
Instead of manual checking, the system "pulses" alerts for:
- **Low Fulfillment**: "PO-999 is only 10% fulfilled despite being 60 days old."
- **Orphan DCs**: "DC-001 has been created 15 days ago but no Invoice is linked."
- **Price Deviation**: Alert if a material rate in a new PO deviates by more than 10% from the 6-month average.

## Premium UI Integration
- **Pulse Indicators**: Tiny animated dots (Green/Yellow/Red) next to document numbers in lists.
- **Health Score Widget**: A premium circular gauge on the dashboard showing overall system health.
- **Trend Overlays**: Subtle "Previous Month" comparison lines on all KPI charts.

## Impact
- **Risk Mitigation**: Reduces financial loss from rejections and late deliveries.
- **Data-Driven Growth**: Shifts user behavior from "Data Entry" to "Strategic Management."
- **Transparency**: Clear visibility into departmental performance.
