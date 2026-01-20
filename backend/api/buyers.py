import logging
import sqlite3

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.core.exceptions import BusinessRuleViolation
from backend.db.models import Buyer
from backend.db.session import get_db, transactional

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/", response_model=list[Buyer])
def list_buyers(db: sqlite3.Connection = Depends(get_db)):
    try:
        rows = db.execute(
            """
            SELECT 
                id, name, gstin, address, state, state_code,
                place_of_supply, is_default, created_at
            FROM buyers 
            WHERE is_active = 1 
            ORDER BY created_at DESC
            """
        ).fetchall()
        return [dict(row) for row in rows]
    except sqlite3.OperationalError:
        return []  # Return empty list if table doesn't exist


class BuyerCreate(BaseModel):
    name: str
    gstin: str
    billing_address: str
    shipping_address: str | None = None
    place_of_supply: str
    state: str | None = None
    state_code: str | None = None
    is_default: bool = False
    is_active: bool = True

@router.post("/", response_model=Buyer)
@transactional
def create_buyer(buyer: BuyerCreate, db: sqlite3.Connection = Depends(get_db)):
    # Duplicate GSTIN Check
    existing = db.execute("SELECT id FROM buyers WHERE gstin = ?", (buyer.gstin,)).fetchone()
    if existing:
        raise BusinessRuleViolation("Buyer with this GSTIN already exists.")

    # If this is the first buyer, it should be default
    cursor = db.execute("SELECT count(*) as count FROM buyers")
    count = cursor.fetchone()["count"]
    is_default = 1 if count == 0 else (1 if buyer.is_default else 0)

    # Ensure only one default
    if is_default == 1:
        db.execute("UPDATE buyers SET is_default = 0")

    cursor = db.execute(
        """INSERT INTO buyers 
           (name, gstin, billing_address, shipping_address, place_of_supply, state, state_code, is_default, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            buyer.name,
            buyer.gstin,
            buyer.billing_address,
            buyer.shipping_address,
            buyer.place_of_supply,
            buyer.state,
            buyer.state_code,
            is_default,
            1,
        ),
    )
    # No manual commit - get_db handles it
    new_id = cursor.lastrowid
    return {**buyer.dict(), "id": new_id, "is_default": bool(is_default)}


@router.put("/{id}", response_model=Buyer)
@transactional
def update_buyer(id: int, buyer: BuyerCreate, db: sqlite3.Connection = Depends(get_db)):
    # Handle Default Flag Change
    if buyer.is_default:
        db.execute("UPDATE buyers SET is_default = 0")

    db.execute(
        """UPDATE buyers SET 
           name = ?, gstin = ?, billing_address = ?, shipping_address = ?, 
           place_of_supply = ?, state = ?, state_code = ?, is_active = ?, is_default = ?
           WHERE id = ?""",
        (
            buyer.name,
            buyer.gstin,
            buyer.billing_address,
            buyer.shipping_address,
            buyer.place_of_supply,
            buyer.state,
            buyer.state_code,
            1 if buyer.is_active else 0,
            1 if buyer.is_default else 0,
            id,
        ),
    )
    # No manual commit - get_db handles it
    return {**buyer.dict(), "id": id}


@router.put("/{id}/default")
@transactional
def set_buyer_default(id: int, db: sqlite3.Connection = Depends(get_db)):
    db.execute("UPDATE buyers SET is_default = 0")
    db.execute("UPDATE buyers SET is_default = 1 WHERE id = ?", (id,))
    # No manual commit - get_db handles it
    return {"success": True}


@router.delete("/{id}")
@transactional
def delete_buyer(id: int, db: sqlite3.Connection = Depends(get_db)):
    # Soft delete
    db.execute("UPDATE buyers SET is_active = 0, is_default = 0 WHERE id = ?", (id,))
    # No manual commit - get_db handles it
    return {"success": True}
