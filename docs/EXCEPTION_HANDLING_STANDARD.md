# Exception Handling Standards

**Created:** 2026-01-10  
**Purpose:** Document exception handling patterns for SenstoSales backend

---

## Overview

All API routes should use the error helper functions from `backend.core.errors` instead of raising `HTTPException` directly. This ensures consistent error responses and proper logging.

---

## Error Helper Functions

Located in `backend/core/errors.py`:

### `bad_request(message: str, log_details: str | None = None) -> HTTPException`
**Status Code:** 400  
**Use for:** Validation failures, missing required fields, invalid formats

```python
from backend.core.errors import bad_request

if not request.items:
    raise bad_request("At least one item is required")
```

---

### `not_found(message: str, resource_type: str | None = None) -> HTTPException`
**Status Code:** 404  
**Use for:** Resource not found errors

```python
from backend.core.errors import not_found

if not invoice_row:
    raise not_found(f"Invoice {invoice_number} not found", "Invoice")
```

---

### `internal_error(message: str, exception: Exception | None = None) -> HTTPException`
**Status Code:** 500  
**Use for:** Database errors, unexpected exceptions

```python
from backend.core.errors import internal_error

try:
    # operation
except Exception as e:
    raise internal_error("Failed to process request", e)
```

---

### `forbidden(message: str, reason: str | None = None) -> HTTPException`
**Status Code:** 403  
**Use for:** Permission denied, authorization failures

```python
from backend.core.errors import forbidden

if not has_permission:
    raise forbidden("Access denied", "Insufficient permissions")
```

---

### `conflict(message: str, details: dict | None = None) -> HTTPException`
**Status Code:** 409  
**Use for:** Conflict errors (duplicates, resource already exists)

```python
from backend.core.errors import conflict

if existing:
    raise conflict(f"DC number {dc_number} already exists")
```

---

## Service Layer Exceptions

Services should raise `AppException` subclasses, not `HTTPException`:

- `ValidationError` - Validation failures
- `ResourceNotFoundError` - Resource not found
- `ConflictError` - Conflict errors
- `BusinessRuleViolation` - Business rule violations

Services return `ServiceResult` or raise exceptions that routers catch and convert to HTTP responses.

---

## Migration Status

### ✅ Standardized
- `backend/api/common.py` - Uses error helpers
- `backend/api/reports.py` - Uses error helpers
- Most API routes already use error helpers

### Pattern to Follow

```python
# ✅ CORRECT
from backend.core.errors import not_found, internal_error, bad_request

if not resource:
    raise not_found(f"Resource {id} not found", "Resource")

try:
    result = service_function(data)
except Exception as e:
    raise internal_error("Operation failed", e)

# ❌ WRONG
from fastapi import HTTPException

if not resource:
    raise HTTPException(status_code=404, detail="Not found")
```

---

## Exception Handler

The application has a global exception handler in `backend/main.py` that catches `AppException` and returns standardized responses:

```python
@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.message,
            "error_code": exc.error_code,
            "details": exc.details,
        },
    )
```

---

## Benefits

1. **Consistent error responses** - All errors follow the same format
2. **Automatic logging** - Error helpers log errors appropriately
3. **Better debugging** - Error context is preserved
4. **Type safety** - Error helpers enforce correct status codes
5. **Maintainability** - Centralized error handling logic

---

## Related Files

- `backend/core/errors.py` - Error helper functions
- `backend/core/exceptions.py` - AppException hierarchy
- `backend/main.py` - Global exception handlers
