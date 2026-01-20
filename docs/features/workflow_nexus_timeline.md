# Workflow Nexus: Interactive Lineage Timeline

**Status:** Proposed
**Category:** UX / Relationship Visualization
**Concept:** "The Lifecycle of a PO, Visualized"

## Overview
In a complex ERP, a single Purchase Order (PO) triggers multiple Delivery Challans (DCs), which lead to multiple Invoices and Stores Receipt Vouchers (SRVs). **Workflow Nexus** provides a single, high-fidelity visual map for every document's "lineage," showing the state and relationship of all linked entities in a unified view.

## Key UX Features

### 1. The "Interactive Lineage Tree"
When viewing any document (e.g., a DC), a toggle allows users to see the "Lineage Tree":
- **Roots**: The parent PO.
- **Trunk**: The current DC.
- **Branches**: All Invoices generated from this DC and all SRVs received against it.
- **Status Color Sync**: Each node in the tree is color-coded (Green for Accepted/Invoiced, Yellow for Pending, Red for Rejected).

### 2. Partial Delivery Visualizer
Solves the "Where is my material?" problem:
- **Visual Stacks**: If a PO item of 100 units is split across 3 DCs, the timeline shows three distinct "mini-bars" moving from PO to DC to SRV.
- **Drill-Down**: Clicking any "node" in the timeline opens a glassmorphic sidebar with that document's details without losing the timeline context.

### 3. Discrepancy Spotter
The timeline highlights breaks in the flow:
- **Warning Glow**: If an Invoice exists for 50 units but the SRV only shows 40 units received, that "branch" glows with an amber warning.
- **Actionable Bridge**: Drag-and-drop an orphan SRV onto a DC node to manually link them if the automatic matching failed.

## Premium Design (Tahoe Aesthetic)
- **Fluid Transitions**: Smooth animations as the tree expands or contracts.
- **Minimalist Nodes**: Using document icons (Lucide/Tahoe style) with micro-typography for numbers and dates.
- **Immersive Overlay**: The timeline acts as a "3rd-dimension" layer that slides over the traditional table view.

## Impact
- **Root Cause Analysis**: Instantly see why a reconciliation is failing by looking for "breaks" in the visual tree.
- **Status Clarity**: No more navigating through 4 different modules to find where a PO stands. One view tells the whole story.
- **User Delight**: Transforms mundane data tracking into an interactive and visually stunning experience.
