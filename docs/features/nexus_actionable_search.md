# Nexus: Actionable & Semantic Search

**Status:** Proposed
**Category:** UX Innovation / Core Feature Enhancement
**Concept:** "Search is the new Navigation"

## Overview
Elevate the current Global Search from a passive "lookup" tool to an active "command center." Nexus leverages semantic understanding to allow users to perform actions, filter complex data, and visualize relationships directly from the search bar.

## Key Features

### 1. Actionable Commands
Instead of navigating through menus, users can type commands directly into the search bar:
- `create dc for PO-123`: Instantly opens the DC creation page pre-filled with items from PO-123.
- `download INV-456`: Immediately triggers the Excel download for the specified invoice.
- `email status to [Supplier]`: Prepares an email draft with the current reconciliation status for the supplier.

### 2. Natural Language Filtering (Semantic)
Allow non-technical queries that the system parses into complex filters:
- "POs over 5 lakhs in Dec": Filters the PO list for December with sub-totals above ₹5,00,000.
- "Show me rejections for [Material Code]": Aggregates all SRV rejections for a specific material across all historical documents.
- "Pending DCs for PSU": Shows all open Delivery Challans specifically for the PSU consignee.

### 3. Quick-Look Relationship Preview
Hovering over a search result (e.g., a PO) shows a miniature "Pulse" indicator:
- **Visual Cues**: A progress bar showing % Dispatched, % Invoiced, and % Received without leaving the current page.
- **Deep Links**: Direct buttons to "View DC," "Create Invoice," or "Check SRV" directly from the search results dropdown.

## Premium UX Design (Tahoe Style)
- **Glassmorphic Dropdown**: A wider, more immersive search overlay (Command-K style).
- **Type-Ahead Suggestions**: Intelligent autocompletion for document numbers, supplier names, and common actions.
- **Keyboard-First Workflow**: Full support for arrow keys and shortcuts (Ctrl+Enter to Execute, Esc to Clear).

## Impact
- **Efficiency**: Reduces clicks by 60% for frequent operations like DC creation.
- **Accessibility**: Makes complex reporting accessible via simple language.
- **Discovery**: Helps users find "hidden" relationships between mismatched documents.
