import sqlite3
from typing import Any

from fastapi import APIRouter, Depends

from backend.db.models import DownloadPrefs, Settings, SettingsUpdate
from backend.db.session import get_db, transactional

router = APIRouter()


@router.get("/download-folders", response_model=DownloadPrefs)
def get_download_prefs(db: sqlite3.Connection = Depends(get_db)):
    """
    Get user download folder preferences.
    If none exist, create and return defaults.
    """
    import logging

    logger = logging.getLogger(__name__)

    defaults = {
        "po_html": r"C:\Downloads\PO_HTML",
        "srv_html": r"C:\Downloads\SRV_HTML",
        "challan": r"C:\Downloads\Challan",
        "invoice": r"C:\Downloads\Invoice",
        "challan_summary": r"C:\Downloads\Challan_Summary",
        "invoice_summary": r"C:\Downloads\Invoice_Summary",
        "items_summary": r"C:\Downloads\Items_Summary",
        "gc": r"C:\Downloads\GC",
    }

    # Try to fetch existing
    try:
        row = db.execute(
            """
            SELECT id, po_html, srv_html, challan, invoice, 
                   challan_summary, invoice_summary, items_summary, gc
            FROM user_download_prefs 
            ORDER BY id DESC 
            LIMIT 1
            """
        ).fetchone()
        if row:
            result = dict(row)
            # Self-healing: Fix rows with NULL values (caused by old INSERT OR IGNORE)
            if result.get("po_html") is None:
                logger.warning(f"Fixing corrupted row id={result['id']} with NULL paths")
                db.execute(
                    """
                    UPDATE user_download_prefs SET 
                        po_html=?, srv_html=?, challan=?, invoice=?, 
                        challan_summary=?, invoice_summary=?, items_summary=?, gc=?
                    WHERE id=?
                    """,
                    (
                        defaults["po_html"],
                        defaults["srv_html"],
                        defaults["challan"],
                        defaults["invoice"],
                        defaults["challan_summary"],
                        defaults["invoice_summary"],
                        defaults["items_summary"],
                        defaults["gc"],
                        result["id"],
                    ),
                )
                db.commit()
                return {**defaults, "id": result["id"]}
            logger.info(f"Loaded download prefs from DB: {result}")
            return result
    except sqlite3.OperationalError as e:
        logger.warning(f"DB error fetching download prefs: {e}")

    # No existing prefs found, insert defaults
    logger.info("No existing prefs found, inserting defaults")
    # Ensure default directories exist (Fix for EXE build)
    import os

    for path in defaults.values():
        try:
            os.makedirs(path, exist_ok=True)
        except:
            pass

    # Insert defaults AND commit so they persist
    try:
        cursor = db.execute(
            """
            INSERT INTO user_download_prefs (
                po_html, srv_html, challan, invoice, 
                challan_summary, invoice_summary, items_summary, gc
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                defaults["po_html"],
                defaults["srv_html"],
                defaults["challan"],
                defaults["invoice"],
                defaults["challan_summary"],
                defaults["invoice_summary"],
                defaults["items_summary"],
                defaults["gc"],
            ),
        )
        db.commit()  # Commit the default insert!
        new_id = cursor.lastrowid
        logger.info(f"Inserted default prefs with id={new_id}")
        return {**defaults, "id": new_id}
    except Exception as e:
        logger.error(f"Failed to insert defaults: {e}")
        # Fallback if DB insert fails
        return {**defaults, "id": 0}


@router.post("/download-folders")
def update_download_prefs(prefs: DownloadPrefs, db: sqlite3.Connection = Depends(get_db)):
    """
    Update download folder preferences.
    Validates paths and creates directories if they don't exist.
    """
    import logging
    import os

    logger = logging.getLogger(__name__)

    logger.info(f"Received download prefs update: po_html={prefs.po_html}, srv_html={prefs.srv_html}")

    # Validation & Creation Logic
    paths = {
        "po_html": prefs.po_html,
        "srv_html": prefs.srv_html,
        "challan": prefs.challan,
        "invoice": prefs.invoice,
        "challan_summary": prefs.challan_summary,
        "invoice_summary": prefs.invoice_summary,
        "items_summary": prefs.items_summary,
    }

    for _key, path in paths.items():
        if not path:
            continue

        # Clean path
        clean_path = os.path.abspath(path)

        # Check for illegal chars (basic Windows check)
        if any(c in clean_path for c in "<>|?*"):
            continue  # Skip invalid paths or handle error

        # Try to create directory
        try:
            os.makedirs(clean_path, exist_ok=True)
        except Exception:
            pass  # We accept the path even if creation fails (might be permissions), frontend shows warning usually

    # Update DB (Single Row Logic: Always Update latest or Insert new)
    # Check if exists
    cursor = db.execute("SELECT id FROM user_download_prefs ORDER BY id DESC LIMIT 1")
    row = cursor.fetchone()

    if row:
        logger.info(f"Updating existing row id={row['id']}")
        db.execute(
            """
            UPDATE user_download_prefs SET 
                po_html=?, srv_html=?, challan=?, invoice=?, 
                challan_summary=?, invoice_summary=?, items_summary=?, gc=?
            WHERE id=?
            """,
            (
                prefs.po_html,
                prefs.srv_html,
                prefs.challan,
                prefs.invoice,
                prefs.challan_summary,
                prefs.invoice_summary,
                prefs.items_summary,
                prefs.gc,
                row["id"],
            ),
        )
    else:
        logger.info("No existing row, inserting new")
        db.execute(
            """
            INSERT INTO user_download_prefs (
                po_html, srv_html, challan, invoice, 
                challan_summary, invoice_summary, items_summary, gc
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                prefs.po_html,
                prefs.srv_html,
                prefs.challan,
                prefs.invoice,
                prefs.challan_summary,
                prefs.invoice_summary,
                prefs.items_summary,
                prefs.gc,
            ),
        )

    # Explicit commit to ensure data is persisted
    db.commit()
    logger.info("Download prefs committed to database")

    return {"success": True, "message": "Download preferences saved"}


@router.get("/", response_model=Settings)
def get_settings(db: sqlite3.Connection = Depends(get_db)):
    """Get all settings as a dict mapped to Settings model"""
    try:
        cursor = db.execute("SELECT key, value FROM settings")
        rows = cursor.fetchall()
        settings_dict = {row["key"]: row["value"] for row in rows}
        return settings_dict
    except sqlite3.OperationalError:
        return {}  # Return empty dict if table doesn't exist


@router.get("/full")
def get_settings_full(db: sqlite3.Connection = Depends(get_db)) -> dict[str, Any]:
    """
    Get all settings AND buyers in a single API call.
    Eliminates double API calls on Settings page (audit fix).
    """
    # Fetch settings
    try:
        settings_cursor = db.execute("SELECT key, value FROM settings")
        settings_rows = settings_cursor.fetchall()
        settings_dict = {row["key"]: row["value"] for row in settings_rows}
    except sqlite3.OperationalError:
        settings_dict = {}

    # Fetch buyers
    try:
        buyers_rows = db.execute(
            """
            SELECT 
                id, name, gstin, address, state, state_code,
                place_of_supply, is_default, created_at
            FROM buyers 
            WHERE is_active = 1 
            ORDER BY created_at DESC
            """
        ).fetchall()
        buyers_list = [dict(row) for row in buyers_rows]
    except sqlite3.OperationalError:
        buyers_list = []

    # Fetch download prefs
    try:
        prefs = get_download_prefs(db)
    except Exception as e:
        print(f"Error fetching download prefs: {e}")
        prefs = {}

    return {"settings": settings_dict, "buyers": buyers_list, "download_prefs": prefs}


@router.post("/")
@transactional
def update_setting(setting: SettingsUpdate, db: sqlite3.Connection = Depends(get_db)):
    """Update a single setting"""
    db.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (setting.key, setting.value),
    )
    # No manual commit - get_db handles it
    return {"success": True, "key": setting.key, "value": setting.value}


@router.post("/batch")
@transactional
def update_settings_batch(settings: list[SettingsUpdate], db: sqlite3.Connection = Depends(get_db)):
    """Batch update settings"""
    data = [(s.key, s.value) for s in settings]
    db.executemany(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        data,
    )
    # No manual commit - get_db handles it
    return {"success": True, "count": len(settings)}
