# Sensto Sales "Tahoe" Design System

**Version:** 3.4.0 (Frozen)
**Date:** 2026-01-11
**Status:** **FROZEN** - No deviations allowed without Architecture Review.

## 1. Core Philosophy
The "Tahoe" design language is defined by **High Density**, **Semantic Clarity**, and **Premium Aesthetics** (Glassmorphism, Elevated Shadows). It mimics a native macOS executable feel within a web environment.

## 2. Design Tokens (Immutable)

### Colors (OKLCH Semantic)
| Role | Token | Usage |
| :--- | :--- | :--- |
| **Surface** | `bg-surface-sunken` | Main app background (Light Grey) |
| **Primary Action** | `bg-action-primary` | Main buttons, active states (Brilliant Blue) |
| **Text Primary** | `text-text-primary` | Implementation headers, values (Dark Slate) |
| **Text Secondary** | `text-text-secondary` | Body text, table cells (Medium Slate) |
| **Text Tertiary** | `text-text-tertiary` | Labels, captions, metadata (Light Slate) |

### Typography (Inter & JetBrains Mono)
**Scale Ratio**: 13px Base / 11px Label

| Component | Size | Weight | Tracking | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `<Title1 />` | 22px | Bold | Tight | Page Titles (Hero) |
| `<Title2 />` | 18px | Semibold | Tight | Section Headers |
| `<Title3 />` | 16px | Semibold | Normal | Card Headers |
| `<Body />` | 13px | Regular | Normal | Standard Prose |
| `<StandardValue />`| 13px | Medium | Normal | Data Values |
| `<StandardLabel />`| 11px | Medium | Widest | Field Labels |
| `<Caption2 />` | 11px | Regular | Normal | Helpers |
| `<Tiny />` | 9px | Bold | Wider | Status Tags |

> **Rule**: Never use `text-[px]` classes in feature code. Always use the semantic React components.

### Spacing & Layout
- **Page Padding**: `var(--padding-page-x)` (2.5rem / 40px)
- **Component Gap**: `var(--spacing-header-gap)` (1.5rem / 24px)
- **Table Density**: `px-4 py-2` (Standard)

## 3. Component Standards

### Buttons (`Button.tsx`)
- **Primary Height**: `h-9` (36px) - The "Gold Standard" for all actions.
- **Icon Size**: Always `16px` (`size={16}`) inside buttons.
- **Radius**: `rounded-xl` (12px) - No pills (full rounded), no squares.
- **Shadows**: `shadow-tahoe-elevated` for primary actions.

### Data Tables (`DataTable.tsx`)
- **Font**: `<Accounting />` (Monospace) for all numbers.
- **Alignment**: Right-aligned for money/quantities, Left for text.
- **Interaction**: Row hover effect `hover:scale-[1.002]` (Micro-interaction).

### Cards & Surfaces
- **Glass**: Use `.glass` for overlays (blur 24px).
- **Clay**: Use `.clay` for subtle depth without borders.
- **Sunken**: Use `bg-surface-sunken` for the main canvas.

## 4. Implementation Rules
1.  **No Raw Values**: Never hardcode hex codes or pixel values. Use `globals.css` variables.
2.  **Zero Flicker**: All data loading must use skeletons or "previous data" persistence.
3.  **Strict Typing**: All components must export specific Interfaces (e.g., `ReportsChartsProps`).
4.  **Local Assets**: No external URLs for images/fonts (EXE compatibility).

## 5. Deviation Policy
Any deviation from this system requires:
1.  A documented reason in `docs/deviations.md`.
2.  Approval from the Design Owner.
3.  An update to this document if the deviation is to be adopted standard.
