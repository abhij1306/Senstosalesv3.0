# Agent Feature Development Protocol (v2.0 - Exhaustive)

Use this guide for **SenstoSales** development. This project has a specific "Tahoe" aesthetic and strict architectural invariants.

---

## 1. Environment & Architecture

### Tech Stack
- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Shadcn UI.
- **Backend**: FastAPI, SQLite (with `msgspec` optimization), Pydantic V2.
- **Packaging**: PyInstaller (Sidecar model).

### Critical Constraints (The "Never" List)
1.  **NEVER** hardcode paths. Use `backend.core.config.resource_path()` for data/resources.
2.  **NEVER** skip `Pydantic` validation. If a field exists in a Service return, it MUST be in the Model.
3.  **NEVER** use raw colors (e.g., `#fff` or `bg-white`). Always use semantic tokens: `bg-surface`, `text-text-primary`.
4.  **NEVER** perform direct DB writes in API routers. Keep routers thin; use `backend.services/`.

---

## 2. Shared Patterns & Modules

### A. The Invariant Principle (FY Context)
All document linking (PO -> DC -> Invoice -> SRV) **MUST** consider the Financial Year (FY) context. 
- Document numbers (e.g., "344") collide across years.
- When searching or linking, always filter by `fin_year` if available, or flag as a "Potential Collision" if uncertain.

### B. Database Migrations
- For schema changes, update `backend/db/models.py` (Pydantic) AND the SQL initialization logic.
- Use `scripts/dev_tools/reinit_db.py` to reset and test the schema locally. **WARNING**: This wipes local data.

### C. Backend Flow
1. **Model**: `backend/db/models.py` (Define schemas).
2. **Service**: `backend/services/` (Business logic, transactions).
3. **API**: `backend/api/` (Routing, auth, input validation).

---

## 3. Frontend Standards ("Tahoe Aesthetic")

### A. Table & Pagination (Avoiding Infinite Loops)
Infinite loops commonly occur in `useEffect` when state updates trigger a re-fetch, which then updates state.
- **Pattern**: Use `useTableState` hook.
- **Protection**: Use a `useRef` to track the first load. Skip the initial dependency-triggered fetch if data is provided via props.
- **Dependencies**: Effects should depend on individual primitives (`table.limit`, `table.offset`) rather than the entire table object to avoid unnecessary cycles.

### B. Design System (Semantic Only)
- **Density**: The UI is "Compact" by default. Use `Mini`, `Tiny`, and `Accounting` components from `@/components/common`.
- **Buttons**:
  - `primary`: Blue gradient (Actions).
  - `secondary/tonal`: Slate/Grey gradient (Pagination, Nav).
  - `success`: Green (Excel, Completion).
  - `destructive`: Red (Delete).

---

## 4. Common Pitfalls & Error Handling

- **500 Response**: Usually a Pydantic violation. Check `models.py` for missing or mismatched keys.
- **Frontend Build Fail**: `npm run build` is strictly linted. Fix ALL unused variables and type errors.
- **Document Linking Failure**: Often due to missing `trim()` or case sensitivity on document numbers. Always normalize keys.

---

## 5. Implementation Checklist

Before marking a task as complete:
1. [ ] **Lint & Type Check**: `npm run lint` must be clean.
2. [ ] **Production Build**: `npm run build` must succeed.
3. [ ] **Backend Audit**: Run `backend/scripts/final_validation.py` (Check for Grade A).
4. [ ] **FY Check**: Verify that document links use Financial Year context.
5. [ ] **Cleanup**: Delete all `.json` logs, debug scripts, or unused components created during development.
