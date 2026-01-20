# Frontend Architecture

**Version:** 7.0  
**Last Updated:** 2026-01-11

---

## Overview

Modern, clean, and standardized React/Next.js frontend with consistent design system, organized component structure, and performance optimizations.

**Tech Stack:**
- Next.js 14+ (App Router)
- React 18+ (Server & Client Components)
- TypeScript
- Tailwind CSS v4 (with `@theme` directive)
- Zustand (State Management)
- Lucide Icons

---

## Directory Structure

```
frontend/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Dashboard
│   ├── layout.tsx                # Root layout (sidebar, header, providers)
│   ├── globals.css               # Design tokens, colors, shadows, typography
│   ├── po/                       # Purchase Order routes
│   ├── dc/                       # Delivery Challan routes
│   ├── invoice/                  # Invoice routes
│   ├── srv/                      # SRV routes
│   ├── reports/                  # Reports
│   └── settings/                 # Settings
│
├── components/
│   ├── ui/                       # shadcn primitives (atoms)
│   │   ├── button.tsx            # Button component
│   │   ├── input.tsx             # Input component
│   │   ├── card.tsx              # Card component
│   │   ├── badge.tsx             # Badge component
│   │   ├── typography.tsx        # Typography components
│   │   └── ...                   # Other shadcn components
│   │
│   ├── common/                   # Reusable components (single export point)
│   │   ├── DataTable.tsx         # Data table component
│   │   ├── SummaryCard.tsx       # Metric card component
│   │   ├── StatusBadge.tsx       # Status badge component
│   │   ├── DocumentTemplate.tsx  # Page template wrapper
│   │   ├── ListPageTemplate.tsx  # List page template
│   │   ├── DocumentItemsTable.tsx # Items table component
│   │   ├── GlobalSearch.tsx      # Global search component
│   │   ├── Pagination.tsx        # Pagination component
│   │   └── index.ts              # Single export point - ALL imports from here
│   │
│   ├── modules/                  # Page-specific components (business logic)
│   │   ├── dashboard/            # Dashboard components
│   │   ├── po/                   # Purchase Order components
│   │   ├── dc/                   # Delivery Challan components
│   │   ├── invoice/              # Invoice components
│   │   ├── srv/                  # SRV components
│   │   ├── reports/              # Reports components
│   │   └── settings/             # Settings components
│   │
│   ├── templates/                # Page templates (higher-level layouts)
│   │   ├── DashboardTemplate.tsx
│   │   ├── DetailPageTemplate.tsx
│   │   └── FormPageTemplate.tsx
│   │
│   ├── app-sidebar.tsx           # Main sidebar navigation
│   ├── theme-provider.tsx        # Theme provider (light/dark)
│   └── theme-toggle.tsx          # Theme toggle component
│
├── store/                        # Zustand state management
│   ├── settingsStore.ts          # Settings, buyers, folders
│   ├── invoiceStore.ts           # Invoice draft & calculation
│   ├── dcStore.ts                # DC creation & item allocation
│   └── poStore.ts                # Purchase order tracking
│
├── lib/
│   ├── api.ts                    # Typed backend API client
│   └── utils.ts                  # Shared utilities (currency, date, cn)
│
└── hooks/                        # Custom React hooks
    └── useDebounce.ts            # Debounce hook
```

---

## Component Import Pattern

### ✅ CORRECT - Import from common

```typescript
// All reusable components imported from common/index.ts
import { 
  Button, 
  Card, 
  DataTable, 
  SummaryCard,
  StatusBadge,
  DocumentTemplate,
  ListPageTemplate
} from '@/components/common';
```

**Why:** `common/index.ts` is the single export point that prevents deep imports and ensures consistency.

### ✅ CORRECT - UI primitives in ui/ components

```typescript
// Only inside ui/ components (button.tsx, input.tsx, etc.)
import { Button } from '@/components/ui/button';
```

**Why:** UI primitives can import directly from other `ui/` components for composition.

### ❌ WRONG - Mixed imports

```typescript
// Don't mix common and ui imports in modules/
import { Button } from '@/components/common';
import { Input } from '@/components/ui/input';  // Use common instead
```

---

## Component Organization

### 1. UI Components (`components/ui/`)

**Purpose:** shadcn/ui primitives - basic building blocks  
**Files:** `button.tsx`, `input.tsx`, `card.tsx`, `badge.tsx`, etc.

**Characteristics:**
- Low-level primitives
- Styled with Tailwind
- Accept className props for customization
- Exported through `common/index.ts` for modules

### 2. Common Components (`components/common/`)

**Purpose:** Reusable business components  
**Files:** `DataTable.tsx`, `SummaryCard.tsx`, `StatusBadge.tsx`, etc.

**Characteristics:**
- Business logic components
- Use UI primitives
- Shared across multiple pages
- All exported from `common/index.ts`

### 3. Module Components (`components/modules/`)

**Purpose:** Page-specific components with business logic  
**Files:** `DashboardClient.tsx`, `POListClient.tsx`, `CreateDCClient.tsx`, etc.

**Characteristics:**
- Page-specific logic
- Use common components
- Client components (`"use client"`)
- Import from `common/index.ts` only

### 4. Templates (`components/templates/`)

**Purpose:** Higher-level page layouts  
**Files:** `DashboardTemplate.tsx`, `DetailPageTemplate.tsx`, etc.

**Characteristics:**
- Page structure templates
- Can use common components
- Less frequently changed

---

## Design System Registry

### Design Tokens (`app/globals.css`)

**File:** `frontend/app/globals.css`  
**Purpose:** Single source of truth for all design tokens

**Contains:**
- Color system (slate-based palette + semantic colors)
- Typography scale (`text-[10px]` to `text-2xl`)
- Spacing scale (4px base grid)
- Shadow definitions (`shadow-[0_2px_10px_rgba(0,0,0,0.03)]`)
- Border radius values
- Transition durations

**Usage:**
```typescript
// ✅ Use design tokens
className="bg-white text-slate-900 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-slate-100"

// ❌ Don't use magic numbers or hardcoded values
className="bg-[#ffffff] text-[#0f172a] shadow-[0_2px_10px_black]"
```

### Component Standards

**Card:**
```typescript
className="rounded-xl bg-white shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-slate-100 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)]"
```

**SummaryCard:**
- Top colored border: `border-t-4`
- Label: `text-[10px] font-bold text-slate-400 uppercase tracking-wider`
- Value: `text-2xl font-black text-slate-900`

**DataTable:**
- Header: `text-xs font-bold text-slate-400 uppercase tracking-widest`
- Row hover: `hover:bg-slate-50/50`
- Borders: `border-slate-200` (headers), `border-slate-100` (rows)

**Button:**
- Primary: `bg-primary text-white shadow-sm hover:shadow-md`
- Variants: `default`, `destructive`, `success`, `warning`, `outline`, `secondary`, `ghost`

---

## State Management (Zustand)

### Store Pattern

**File:** `frontend/store/[name]Store.ts`  
**Purpose:** Global state management for business logic

**Stores:**
- `settingsStore.ts` - Settings, buyers, folders
- `invoiceStore.ts` - Invoice draft state
- `dcStore.ts` - DC creation state
- `poStore.ts` - PO tracking state

**Usage:**
```typescript
import { useSettingsStore } from '@/store/settingsStore';

// In component
const { buyers, settings } = useSettingsStore();
const updateBuyer = useSettingsStore(state => state.updateBuyer);
```

---

## API Client (`lib/api.ts`)

**File:** `frontend/lib/api.ts`  
**Purpose:** Typed backend API client

**Features:**
- Type-safe API calls
- Error handling
- Request caching
- File download utilities

**Usage:**
```typescript
import { api } from '@/lib/api';

// In Server Component
const data = await api.getPOs();

// In Client Component
const data = await api.getPOs();
```

---

## Routing Structure

### App Router Pages

| Route | File | Component |
|-------|------|-----------|
| `/` | `app/page.tsx` | Dashboard |
| `/po` | `app/po/page.tsx` | PO List |
| `/po/[id]` | `app/po/[id]/page.tsx` | PO Detail |
| `/po/create` | `app/po/create/page.tsx` | Create PO |
| `/dc` | `app/dc/page.tsx` | DC List |
| `/dc/[id]` | `app/dc/[id]/page.tsx` | DC Detail |
| `/dc/create` | `app/dc/create/page.tsx` | Create DC |
| `/invoice` | `app/invoice/page.tsx` | Invoice List |
| `/invoice/[id]` | `app/invoice/[id]/page.tsx` | Invoice Detail |
| `/invoice/create` | `app/invoice/create/page.tsx` | Create Invoice |
| `/srv` | `app/srv/page.tsx` | SRV List |
| `/srv/[id]` | `app/srv/[id]/page.tsx` | SRV Detail |
| `/reports` | `app/reports/page.tsx` | Reports |
| `/settings` | `app/settings/page.tsx` | Settings |

### Page Structure Pattern

**Server Component (Page):**
```typescript
// app/po/page.tsx
import { api } from '@/lib/api';
import { POListClient } from '@/components/modules/po/POListClient';

export default async function POPage() {
  const initialData = await api.getPOs();
  return <POListClient initialPOs={initialData} />;
}
```

**Client Component (Module):**
```typescript
// components/modules/po/POListClient.tsx
"use client";
import { ListPageTemplate } from '@/components/common';
import { type Column } from '@/components/common';

export function POListClient({ initialPOs }) {
  // Client-side logic
  return <ListPageTemplate ... />;
}
```

---

## Performance Rules

### 1. Dynamic Imports for Heavy Components

```typescript
import dynamic from 'next/dynamic';

const ReconciliationChart = dynamic(
  () => import('@/components/common/ReconciliationChart'),
  { ssr: false, loading: () => <Loading /> }
);
```

**Use for:**
- Charts (`ReconciliationChart`)
- Heavy tables with virtualization
- Complex modals

### 2. Memoization

```typescript
import { useMemo, memo } from 'react';

// Memoize expensive computations
const sortedData = useMemo(() => {
  return data.sort(...);
}, [data]);

// Memoize components
export const SummaryCard = memo(function SummaryCard({ ... }) {
  // ...
});
```

### 3. Lazy Loading

```typescript
// Use Suspense boundaries
<Suspense fallback={<Loading />}>
  <ExpensiveComponent />
</Suspense>
```

### 4. Virtualization for Large Lists

```typescript
// Use react-window for 50+ items
import { VariableSizeList } from 'react-window';
```

---

## Styling Guidelines

### Tailwind CSS v4

**Theme Configuration:** `app/globals.css` with `@theme` directive

**Standard Patterns:**
```typescript
// Cards
className="rounded-xl bg-white shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-slate-100"

// Typography
className="text-2xl font-extrabold text-slate-900"  // Page title
className="text-[10px] font-bold text-slate-400 uppercase tracking-wider"  // Label

// Spacing
className="p-6 gap-6"  // Card padding and gaps

// Hover
className="hover:-translate-y-1 hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)]"
```

### ❌ Avoid

- `elevation-*` utilities (removed, use `shadow-[...]`)
- `border-none` (use proper borders: `border-slate-100`)
- Magic numbers (use design tokens)
- Heavy shadows (use subtle reference shadows)
- Large fonts (`text-4xl`, `text-5xl` - use `text-2xl` max)

---

## Code Standards

### File Naming

- Components: `PascalCase.tsx` (e.g., `DataTable.tsx`)
- Utilities: `camelCase.ts` (e.g., `api.ts`, `utils.ts`)
- Stores: `[name]Store.ts` (e.g., `settingsStore.ts`)

### Component Structure

```typescript
"use client";  // Only if needed

import { ... } from '@/components/common';
import { ... } from '@/lib/api';
import { ... } from '@/store/[name]Store';

interface ComponentProps {
  // Props
}

export function ComponentName({ ...props }: ComponentProps) {
  // Hooks
  // State
  // Effects
  // Handlers
  // Render
  return (...);
}
```

---

## Design System Implementation

See `docs/DESIGN_SYSTEM.md` for complete design system reference including:
- Typography scale
- Color palette
- Shadows
- Spacing
- Component patterns
- Best practices

---

## Removed / Deprecated

- ❌ Atomic design directories (`atoms/`, `molecules/`, `organisms/`) - Removed empty directories
- ❌ `elevation-*` utilities - Use `shadow-[...]` instead
- ❌ `border-none` - Use proper borders instead
- ❌ Multiple design system docs - Consolidated into single `DESIGN_SYSTEM.md`

---

## Future Considerations

1. **Component Testing:** Add unit tests for common components
2. **Storybook:** Consider adding Storybook for component documentation
3. **Accessibility:** Ensure WCAG 2.1 AA compliance
4. **Performance:** Monitor and optimize bundle size

---

**Version:** 7.0  
**Last Updated:** 2026-01-11  
**Design System:** See `docs/DESIGN_SYSTEM.md`
