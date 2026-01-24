## 2025-05-15 - FieldGroup Accessibility Pattern
**Learning:** Common form field wrapper pattern (FieldGroup) was missing native label association. Using a visual text component (Caption1) instead of `<label>` breaks screen reader support and click-to-focus behavior.
**Action:** When creating form wrappers, always use `<label>` with `htmlFor` matching the input's `id`. Use `useId()` for auto-generating unique IDs if not provided.

## 2025-05-15 - Skeleton Loading for Tables
**Learning:** Full-height loading spinners in data tables cause significant layout shifts (CLS) and disconnect the user from the context (column headers disappear).
**Action:** Prefer Skeleton loaders that mirror the table structure (preserving headers and row height) over centralized spinners for initial data fetching. This improves perceived performance and maintains layout stability.
