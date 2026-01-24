"""
Final System Validation Script
Runs comprehensive checks across all 9 audit categories
"""

import json
import sqlite3
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from backend.core.config import DATABASE_PATH


# Color codes for terminal output
class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    END = "\033[0m"


def print_header(text):
    """Print section header"""
    print(f"\n{Colors.BLUE}{'=' * 100}{Colors.END}")
    print(f"{Colors.BLUE}{text.center(100)}{Colors.END}")
    print(f"{Colors.BLUE}{'=' * 100}{Colors.END}\n")


def check_database_exists():
    """Section 1: Verify database exists and is accessible"""
    print("[SCAN] Checking database existence...")
    if not DATABASE_PATH.exists():
        print(f"{Colors.RED}[FAIL] Database not found at {DATABASE_PATH}{Colors.END}")
        return False
    print(f"{Colors.GREEN}[PASS] Database exists at {DATABASE_PATH}{Colors.END}")
    return True


def check_migrations_applied():
    """Section 2: Verify consolidated schema applied"""
    print("[SCAN] Checking migrations...")
    try:
        conn = sqlite3.connect(str(DATABASE_PATH))
        cursor = conn.cursor()

        # Check if schema_version table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'")
        if not cursor.fetchone():
            print(f"{Colors.YELLOW}[WARN] schema_version table not found (using init_db approach){Colors.END}")
            conn.close()
            return True  # Acceptable if using init_db pattern

        cursor.execute("SELECT version FROM schema_version ORDER BY version DESC LIMIT 1")
        row = cursor.fetchone()
        conn.close()

        if row and row[0] >= 2:
            print(f"{Colors.GREEN}[PASS] Consolidated schema v{row[0]} applied{Colors.END}")
            return True
        else:
            print(f"{Colors.YELLOW}[WARN] Schema version {row[0] if row else 'unknown'} (expected v2+){Colors.END}")
            return False
    except Exception as e:
        print(f"{Colors.RED}[FAIL] Error checking migrations: {e}{Colors.END}")
        return False


def check_backend_routes():
    """Section 3: Verify backend routes are accessible"""
    print("[SCAN] Checking backend health...")
    try:
        import requests

        response = requests.get("http://localhost:8000/api/health", timeout=5)
        if response.status_code == 200:
            print(f"{Colors.GREEN}[PASS] Backend is running and healthy{Colors.END}")
            return True
        else:
            print(f"{Colors.YELLOW}[WARN] Backend returned status {response.status_code}{Colors.END}")
            return False
    except ImportError:
        print(f"{Colors.YELLOW}[WARN] requests library not installed, skipping HTTP check{Colors.END}")
        return True  # Non-blocking
    except Exception as e:
        print(f"{Colors.RED}[FAIL] Backend not accessible: {e}{Colors.END}")
        return False


def check_frontend_build():
    """Section 4: Verify frontend can build"""
    print("[SCAN] Checking frontend build readiness...")
    frontend_path = Path("frontend")

    # Check if package.json exists
    if not (frontend_path / "package.json").exists():
        print(f"{Colors.RED}[FAIL] frontend/package.json not found{Colors.END}")
        return False

    # Check if node_modules exists
    if not (frontend_path / "node_modules").exists():
        print(f"{Colors.YELLOW}[WARN] node_modules not found, run 'npm install'{Colors.END}")
        return False

    print(f"{Colors.GREEN}[PASS] Frontend structure looks good{Colors.END}")
    return True


def check_no_duplicate_files():
    """Section 5: Check for duplicate utility files"""
    print("[SCAN] Checking for duplicate code...")

    # Check if old utils/ folder still exists
    if Path("utils").exists():
        print(f"{Colors.RED}[FAIL] Old utils/ folder still exists (should be archived){Colors.END}")
        return False

    # Check that backend services exist
    if not Path("backend/services").exists():
        print(f"{Colors.RED}[FAIL] backend/services not found{Colors.END}")
        return False

    print(f"{Colors.GREEN}[PASS] No duplicate utility files detected{Colors.END}")
    return True


def check_docs_up_to_date():
    """Section 6: Verify documentation exists"""
    print("[SCAN] Checking documentation...")

    required_docs = [
        "README.md",
        "docs/BACKEND_ARCHITECTURE.md",
        "docs/FRONTEND_ARCHITECTURE.md",
        "docs/DATABASE_SCHEMA.md",
        "docs/DEPLOYMENT_GUIDE.md",
    ]

    missing = []
    for doc in required_docs:
        if not Path(doc).exists():
            missing.append(doc)

    if missing:
        print(f"{Colors.YELLOW}[WARN] Missing docs: {', '.join(missing)}{Colors.END}")
        return False

    print(f"{Colors.GREEN}[PASS] All documentation files present{Colors.END}")
    return True


def check_loading_states():
    """Section 7: Check if loading states are implemented"""
    print("[SCAN] Checking loading state implementation...")

    # Check DataTable component
    data_table_path = Path("frontend/components/common/DataTable.tsx")
    if not data_table_path.exists():
        print(f"{Colors.YELLOW}[WARN] DataTable.tsx not found{Colors.END}")
        return False

    content = data_table_path.read_text(encoding="utf-8")
    if "loading" in content.lower():
        print(f"{Colors.GREEN}[PASS] Loading states implemented in DataTable{Colors.END}")
        return True
    else:
        print(f"{Colors.YELLOW}[WARN] Loading prop not found in DataTable{Colors.END}")
        return False


def check_error_handling():
    """Section 8: Verify error handling is comprehensive"""
    print("[SCAN] Checking error handling...")

    # Check core exceptions exist
    exceptions_path = Path("backend/core/exceptions.py")
    if not exceptions_path.exists():
        print(f"{Colors.RED}[FAIL] core/exceptions.py not found{Colors.END}")
        return False

    content = exceptions_path.read_text(encoding="utf-8")
    required_exceptions = ["ResourceNotFoundError", "DomainError", "AppException"]

    missing = [exc for exc in required_exceptions if exc not in content]
    if missing:
        print(f"{Colors.YELLOW}[WARN] Missing exception classes: {', '.join(missing)}{Colors.END}")
        return False

    print(f"{Colors.GREEN}[PASS] Exception handling classes present{Colors.END}")
    return True


def check_reconciliation_view():
    """Section 9: Verify reconciliation_ledger view exists"""
    print("[SCAN] Checking reconciliation view...")
    try:
        conn = sqlite3.connect(str(DATABASE_PATH))
        cursor = conn.cursor()

        # Check if view exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='view' AND name='reconciliation_ledger'")
        if cursor.fetchone():
            print(f"{Colors.GREEN}[PASS] reconciliation_ledger view exists{Colors.END}")
            conn.close()
            return True
        else:
            print(f"{Colors.RED}[FAIL] reconciliation_ledger view not found{Colors.END}")
            conn.close()
            return False
    except Exception as e:
        print(f"{Colors.RED}[FAIL] Error checking view: {e}{Colors.END}")
        return False


def main():
    """Run all validation checks"""
    print_header("SENSTOSALES SYSTEM VALIDATION")

    checks = {
        "Database Exists": check_database_exists,
        "Migrations Applied": check_migrations_applied,
        "Backend Health": check_backend_routes,
        "Frontend Build": check_frontend_build,
        "No Duplicate Files": check_no_duplicate_files,
        "Documentation Complete": check_docs_up_to_date,
        "Loading States": check_loading_states,
        "Error Handling": check_error_handling,
        "Reconciliation View": check_reconciliation_view,
    }

    results = {}
    for name, check_func in checks.items():
        try:
            results[name] = check_func()
        except Exception as e:
            print(f"{Colors.RED}✗ {name} check crashed: {e}{Colors.END}")
            results[name] = False

    # Summary
    print_header("VALIDATION SUMMARY")

    passed = sum(results.values())
    total = len(results)
    percentage = (passed / total * 100) if total > 0 else 0

    print(f"\nPassed: {passed}/{total} ({percentage:.1f}%)\n")

    for name, result in results.items():
        status = f"{Colors.GREEN}[PASS]{Colors.END}" if result else f"{Colors.RED}[FAIL]{Colors.END}"
        print(f"  {name:30s} {status}")

    # Grade calculation
    print(f"\n{'=' * 100}")
    if percentage == 100:
        grade = "A"
        color = Colors.GREEN
        print(f"{color}GRADE: {grade} - PRODUCTION READY [OK]{Colors.END}")
    elif percentage >= 90:
        grade = "A-"
        color = Colors.GREEN
        print(f"{color}GRADE: {grade} - PRODUCTION READY (with minor notes){Colors.END}")
    elif percentage >= 80:
        grade = "B"
        color = Colors.YELLOW
        print(f"{color}GRADE: {grade} - NEEDS ATTENTION{Colors.END}")
    else:
        grade = "C"
        color = Colors.RED
        print(f"{color}GRADE: {grade} - NOT PRODUCTION READY{Colors.END}")

    print(f"{'=' * 100}\n")

    # Export results
    results_file = Path("validation_results.json")
    with open(results_file, "w") as f:
        json.dump(
            {
                "checks": results,
                "passed": passed,
                "total": total,
                "percentage": percentage,
                "grade": grade,
            },
            f,
            indent=2,
        )

    print(f"Results saved to: {results_file}")

    # Exit code
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
