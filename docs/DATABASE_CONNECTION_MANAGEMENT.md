# Database Connection Management

**Created:** 2026-01-10  
**Purpose:** Document database connection lifecycle and management patterns

---

## Overview

The backend uses SQLite with direct `sqlite3` connections managed through FastAPI dependencies and context managers.

---

## Connection Architecture

### Connection Creation

**Location:** `backend/db/session.py`

```python
def get_connection() -> sqlite3.Connection:
    """Get a SQLite connection with standard settings."""
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn
```

**Key Settings:**
- `WAL mode`: Write-Ahead Logging for better concurrency
- `synchronous = NORMAL`: Balance between safety and performance
- `foreign_keys = ON`: Enforce referential integrity
- `busy_timeout = 5000`: Wait up to 5 seconds for locks

---

## Connection Lifecycle

### 1. FastAPI Dependency Pattern

**Primary Pattern:** Used in all API routes

```python
def get_db() -> Generator[sqlite3.Connection, None, None]:
    """FastAPI dependency - yields a connection and closes after request."""
    conn = get_connection()
    try:
        yield conn
    except Exception as e:
        logger.error(f"Database error: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()
```

**Usage:**
```python
@router.get("/example")
def example_route(db: sqlite3.Connection = Depends(get_db)):
    # Connection automatically closed after request
    result = db.execute("SELECT ...")
    return result.fetchall()
```

**Guarantees:**
- Connection created at request start
- Connection closed after request completes (success or error)
- Automatic rollback on exceptions
- Thread-safe (check_same_thread=False)

---

### 2. Transaction Context Manager

**For Explicit Transactions:**

```python
@contextmanager
def db_transaction(conn: sqlite3.Connection):
    """Context manager for explicit transactions."""
    try:
        conn.execute("BEGIN IMMEDIATE")
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Transaction rolled back: {e}")
        raise
```

**Usage:**
```python
def create_dc(dc: DCCreate, items: list[dict], db: sqlite3.Connection):
    with db_transaction(db):
        # Multiple operations in transaction
        db.execute("INSERT INTO ...")
        db.execute("UPDATE ...")
        # Auto-commits on success, rolls back on error
```

**When to Use:**
- Multiple related database operations
- Need atomicity (all or nothing)
- Race condition prevention (BEGIN IMMEDIATE)

---

### 3. Transactional Decorator

**For Route-Level Transactions:**

```python
@transactional
def create_invoice(request: EnhancedInvoiceCreate, db: sqlite3.Connection = Depends(get_db)):
    # Entire function wrapped in transaction
    result = service_create_invoice(invoice_data, db)
    return result
```

**Note:** The `@transactional` decorator automatically wraps the function in a transaction using `db_transaction()`.

---

## Connection Patterns by Use Case

### API Routes
- **Use:** `Depends(get_db)` dependency
- **Pattern:** Request-scoped connection
- **Lifecycle:** Created at request start, closed at request end
- **Transaction:** Use `@transactional` decorator for routes that need transactions

### Service Functions
- **Receive:** Connection as parameter (from route)
- **Pattern:** Use provided connection
- **Never:** Create new connections in services
- **Transaction:** Use `db_transaction()` context manager for multi-step operations

### Scripts/One-off Operations
- **Use:** `get_connection()` directly
- **Pattern:** Manual connection management
- **Lifecycle:** Must explicitly close connections
- **Example:**
  ```python
  conn = get_connection()
  try:
      # operations
      conn.commit()
  finally:
      conn.close()
  ```

---

## Best Practices

### ✅ DO

1. **Use dependency injection in routes:**
   ```python
   def route(db: sqlite3.Connection = Depends(get_db)):
       # Connection managed automatically
   ```

2. **Pass connections to services:**
   ```python
   def service_function(data, db: sqlite3.Connection):
       # Use provided connection
   ```

3. **Use transactions for multi-step operations:**
   ```python
   with db_transaction(db):
       # Multiple operations
   ```

4. **Use BEGIN IMMEDIATE for critical operations:**
   - Prevents deadlocks
   - Used automatically by `db_transaction()`

5. **Handle exceptions properly:**
   - Connections automatically rollback on exceptions
   - Log errors for debugging

### ❌ DON'T

1. **Don't create connections in services:**
   ```python
   # ❌ WRONG
   def service_function():
       conn = get_connection()  # Don't do this
   ```

2. **Don't forget to close connections in scripts:**
   ```python
   # ❌ WRONG
   conn = get_connection()
   # Use connection
   # Forgot to close!
   ```

3. **Don't share connections across requests:**
   - Each request gets its own connection
   - Connections are not thread-safe for concurrent access

4. **Don't commit manually in routes (usually):**
   - `get_db()` dependency handles commit/rollback
   - Use `@transactional` decorator if needed

---

## Transaction Management

### When Transactions Are Needed

1. **Multiple related operations:**
   - Creating DC with multiple items
   - Creating invoice with items
   - Batch updates

2. **Race condition prevention:**
   - DC number uniqueness checks
   - Invoice number uniqueness checks
   - Quantity updates

3. **Data consistency:**
   - When partial success is not acceptable
   - When rollback is needed on errors

### Transaction Patterns

**Pattern 1: Decorator (Route Level)**
```python
@router.post("/dc")
@transactional
def create_dc(request: DCCreate, db: sqlite3.Connection = Depends(get_db)):
    # Entire route wrapped in transaction
    return service_create_dc(request, db)
```

**Pattern 2: Context Manager (Service Level)**
```python
def create_dc(dc: DCCreate, items: list[dict], db: sqlite3.Connection):
    with db_transaction(db):
        # Operations here
        db.execute("INSERT ...")
        db.execute("INSERT ...")
```

---

## Error Handling

### Automatic Rollback

Connections automatically rollback on exceptions:

```python
def get_db() -> Generator[sqlite3.Connection, None, None]:
    conn = get_connection()
    try:
        yield conn
    except Exception as e:
        conn.rollback()  # Automatic rollback
        raise
    finally:
        conn.close()  # Always closes
```

### Manual Rollback

For explicit control:

```python
try:
    db.execute("BEGIN IMMEDIATE")
    # operations
    db.commit()
except Exception:
    db.rollback()
    raise
```

---

## Connection Pooling

**Current Status:** No connection pooling (SQLite limitation)

**Why:** SQLite doesn't support true connection pooling. Each connection is a file handle.

**Performance Considerations:**
- Connections are lightweight (file handles)
- FastAPI dependency creates connections per request
- No pooling needed for SQLite

**If Migrating to PostgreSQL:**
- Would need connection pooling (e.g., SQLAlchemy pool)
- Would need to refactor connection management

---

## Monitoring & Debugging

### Connection Leaks

**Signs:**
- Database locked errors
- Increasing file handles
- Slow performance

**Prevention:**
- Always use `Depends(get_db)` in routes
- Always close connections in scripts
- Use context managers for transactions

### Debugging Connections

```python
import sqlite3

# Check active connections (SQLite doesn't expose this easily)
# Use logging to track connection creation/closing

# Check database locks
db.execute("PRAGMA busy_timeout")  # Should return 5000
```

---

## Migration Considerations

### If Migrating to PostgreSQL

1. Replace `sqlite3` with `psycopg2` or `asyncpg`
2. Implement connection pooling
3. Update transaction management (PostgreSQL supports nested transactions)
4. Update connection factory
5. Update error handling (PostgreSQL errors are different)

---

## Related Files

- `backend/db/session.py` - Connection management
- `backend/core/config.py` - Database path configuration
- `backend/main.py` - Application setup

---

## Summary

- **Connections:** Created per request via FastAPI dependency
- **Lifecycle:** Automatically managed (created/closed per request)
- **Transactions:** Use `@transactional` decorator or `db_transaction()` context manager
- **Thread Safety:** `check_same_thread=False` allows multi-threaded access
- **Error Handling:** Automatic rollback on exceptions
- **Best Practice:** Always use `Depends(get_db)` in routes, pass connections to services

---

**Last Updated:** 2026-01-10
