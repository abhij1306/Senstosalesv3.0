## 2025-05-15 - FieldGroup Accessibility Pattern
**Learning:** Common form field wrapper pattern (FieldGroup) was missing native label association. Using a visual text component (Caption1) instead of `<label>` breaks screen reader support and click-to-focus behavior.
**Action:** When creating form wrappers, always use `<label>` with `htmlFor` matching the input's `id`. Use `useId()` for auto-generating unique IDs if not provided.
