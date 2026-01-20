# Stability and Performance Guide

**Last Updated:** 2026-01-10  
**Purpose:** Ensure application stability, performance, and EXE compatibility

---

## EXE Build Compatibility

### Database Path Handling

The application uses intelligent database path resolution for EXE builds:

**Development Mode:**
- Database path: `db/business.db` (relative to project root)
- Handled by: `backend/core/config.py`

**EXE Mode (Frozen):**
- Detects PyInstaller environment (`sys.frozen`)
- Uses persistent path: `{exe_directory}/db/business.db`
- Copies seed database from bundle if needed
- Ensures database is writable

**Key Implementation:**
```python
# backend/core/config.py
if is_frozen and hasattr(sys, '_MEIPASS'):
    exe_dir = Path(sys.executable).parent
    persistent_db_path = exe_dir / "db" / "business.db"
    persistent_db_dir.mkdir(exist_ok=True)
```

**Verification:**
- Database path is always absolute in EXE builds
- Database directory is created if missing
- File permissions are set correctly (0o666)

---

## CORS Configuration

### Environment-Based CORS

CORS is configured based on environment mode:

**Development Mode:**
- Allows specific origins: `localhost:3000`, `127.0.0.1:3000`
- Can allow all origins if `CORS_ALLOW_ALL_ORIGINS=true`

**Production Mode:**
- **Restricted:** Only explicit origins allowed
- **No wildcard:** `allow_origins=["*"]` is disabled
- Origins must be specified in `CORS_ALLOW_ORIGINS` environment variable

**Configuration:**
```python
# backend/core/config.py
CORS_ALLOW_ORIGINS: str = os.environ.get(
    "CORS_ALLOW_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000"
)
CORS_ALLOW_ALL_ORIGINS: bool = os.environ.get(
    "CORS_ALLOW_ALL_ORIGINS", "false"
).lower() == "true"
```

**Security:**
- Production mode enforces explicit origins
- Wildcard only allowed in development
- Environment variable controls behavior

---

## Database Performance Settings

### Optimized SQLite Configuration

The application uses optimized SQLite settings for performance:

**Journal Mode: WAL (Write-Ahead Logging)**
- Better concurrency
- Faster writes
- Set per connection: `PRAGMA journal_mode = WAL`

**Synchronous: NORMAL**
- Balance between safety and performance
- Faster than FULL, safer than OFF
- Set per connection: `PRAGMA synchronous = NORMAL`

**Foreign Keys: ON**
- Data integrity enforcement
- Set per connection: `PRAGMA foreign_keys = ON`

**Busy Timeout: 5000ms**
- Prevents "database is locked" errors
- Allows retries for concurrent access
- Set per connection: `PRAGMA busy_timeout = 5000`

**Implementation:**
```python
# backend/db/session.py
conn.execute("PRAGMA journal_mode = WAL")
conn.execute("PRAGMA synchronous = NORMAL")
conn.execute("PRAGMA foreign_keys = ON")
conn.execute("PRAGMA busy_timeout = 5000")
```

---

## Transaction Management

### Race Condition Prevention

Critical operations use `BEGIN IMMEDIATE` to prevent race conditions:

**DC Creation:**
- Uses `BEGIN IMMEDIATE` for atomic operations
- Prevents duplicate DC numbers
- Ensures quantity checks are atomic

**Invoice Creation:**
- Uses `BEGIN IMMEDIATE` for collision safety
- Prevents duplicate invoice numbers
- Ensures DC linking is atomic

**Implementation:**
```python
# backend/db/session.py
@contextmanager
def db_transaction(conn: sqlite3.Connection):
    try:
        conn.execute("BEGIN IMMEDIATE")  # Prevents deadlocks
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise
```

**Best Practices:**
- Use `@transactional` decorator for route-level transactions
- Use `db_transaction()` context manager for service-level transactions
- Always use `BEGIN IMMEDIATE` for critical operations

---

## Connection Lifecycle

### Proper Connection Management

**FastAPI Dependency Pattern:**
```python
def get_db() -> Generator[sqlite3.Connection, None, None]:
    conn = get_connection()
    try:
        yield conn
    except Exception as e:
        conn.rollback()
        raise
    finally:
        conn.close()  # Always closes
```

**Guarantees:**
- Connection created per request
- Connection closed after request (success or error)
- Automatic rollback on exceptions
- No connection leaks

---

## Error Handling

### Consistent Exception Handling

**Pattern:**
- Services raise `AppException` subclasses
- Routes use error helpers from `backend/core/errors.py`
- Global exception handlers in `main.py` convert to HTTP responses

**Error Helpers:**
- `bad_request()` - 400 Bad Request
- `not_found()` - 404 Not Found
- `conflict()` - 409 Conflict
- `internal_error()` - 500 Internal Server Error
- `forbidden()` - 403 Forbidden

---

## Stability Best Practices

### 1. Path Handling
- ✅ Always use `Path` objects, not strings
- ✅ Use absolute paths in EXE builds
- ✅ Handle both development and frozen environments

### 2. Database Operations
- ✅ Use transactions for multi-step operations
- ✅ Use `BEGIN IMMEDIATE` for critical operations
- ✅ Always close connections
- ✅ Handle exceptions with rollback

### 3. Configuration
- ✅ Environment-based configuration
- ✅ Sensible defaults
- ✅ Validation on startup

### 4. Error Handling
- ✅ Consistent exception patterns
- ✅ Proper logging
- ✅ User-friendly error messages

---

## Performance Optimizations

### Database
- ✅ WAL mode for better concurrency
- ✅ Appropriate indexes on foreign keys
- ✅ Explicit column lists (no SELECT *)
- ✅ Connection pooling not needed (SQLite limitation)

### Application
- ✅ Efficient query patterns
- ✅ Proper use of indexes
- ✅ Transaction boundaries optimized
- ✅ Connection management optimized

---

## EXE Build Checklist

Before building EXE:

1. ✅ Verify database path handling works in frozen mode
2. ✅ Test CORS configuration in production mode
3. ✅ Verify all file paths are absolute or properly resolved
4. ✅ Test database operations in EXE environment
5. ✅ Verify error handling works correctly
6. ✅ Test transaction rollback scenarios

---

## Monitoring

### Key Metrics to Monitor

1. **Database Performance:**
   - Query execution times
   - Lock contention
   - Connection pool usage

2. **Application Performance:**
   - Request response times
   - Error rates
   - Transaction success rates

3. **Stability:**
   - Connection leaks
   - Memory usage
   - Exception rates

---

## Related Documentation

- [DATABASE_CONNECTION_MANAGEMENT.md](./DATABASE_CONNECTION_MANAGEMENT.md)
- [DATABASE_AUDIT_REPORT.md](./DATABASE_AUDIT_REPORT.md)
- [EXCEPTION_HANDLING_STANDARD.md](./EXCEPTION_HANDLING_STANDARD.md)
- [EXE_BUILD_GUIDE.md](./EXE_BUILD_GUIDE.md)

---

**Status:** ✅ Production Ready  
**Last Verified:** 2026-01-10
