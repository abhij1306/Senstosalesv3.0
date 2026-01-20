import sys
from pathlib import Path

# Add project root to sys.path so we can import backend
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(PROJECT_ROOT))

import sqlite3  # noqa: E402

from backend.core.config import settings  # noqa: E402


def apply_indexes():
    # Parse the real path from the sqlalchemy URL
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    print(f"Connecting to database at {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Debug: List all tables
    print("Tables in DB:")
    tables = cursor.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()
    for t in tables:
        print(f" - {t[0]}")

    indexes = [
        "CREATE INDEX IF NOT EXISTS idx_po_created_at ON purchase_orders(created_at);",
        "CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(po_status);",
        "CREATE INDEX IF NOT EXISTS idx_inv_created_at ON gst_invoices(created_at);",
        "CREATE INDEX IF NOT EXISTS idx_dc_created_at ON delivery_challans(created_at);",
        "CREATE INDEX IF NOT EXISTS idx_srv_created_at ON srv_items(created_at);",
        "CREATE INDEX IF NOT EXISTS idx_po_items_po_number ON purchase_order_items(po_number);",
        "CREATE INDEX IF NOT EXISTS idx_dc_items_dc_number ON delivery_challan_items(dc_number);"
    ]

    print("Applying indexes...")
    for idx_sql in indexes:
        try:
            print(f"Executing: {idx_sql}")
            cursor.execute(idx_sql)
        except Exception as e:
            print(f"Error creating index: {e}")

    conn.commit()
    conn.close()
    print("Indexes applied successfully.")

if __name__ == "__main__":
    apply_indexes()
