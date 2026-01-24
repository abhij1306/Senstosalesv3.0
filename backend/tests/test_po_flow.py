from fastapi.testclient import TestClient


def test_create_po_manual(client: TestClient):
    po_data = {
        "header": {"po_number": "TEST-PO-001", "po_date": "2023-10-27", "supplier_name": "Test Supplier", "po_value": 1000.0, "po_status": "New"},
        "items": [
            {
                "po_item_no": 10,
                "material_code": "MAT-001",
                "material_description": "Test Material",
                "ord_qty": 100.0,
                "unit": "NOS",
                "po_rate": 10.0,
                "deliveries": [{"lot_no": 1, "ord_qty": 100.0, "dely_date": "2023-11-01"}],
            }
        ],
    }

    response = client.post("/api/po/", json=po_data)
    assert response.status_code == 200, response.text
    created_po = response.json()
    assert created_po["header"]["po_number"] == "TEST-PO-001"
    assert len(created_po["items"]) == 1
    assert created_po["items"][0]["po_item_no"] == 10
    assert created_po["items"][0]["ord_qty"] == 100.0


def test_list_pos(client: TestClient):
    # Create another PO to ensure list has data
    po_data = {
        "header": {"po_number": "TEST-PO-002", "po_date": "2023-10-28", "supplier_name": "Test Supplier 2", "po_value": 2000.0},
        "items": [{"po_item_no": 10, "ord_qty": 50.0, "po_rate": 40.0, "deliveries": [{"lot_no": 1, "ord_qty": 50.0}]}],
    }
    client.post("/api/po/", json=po_data)

    response = client.get("/api/po/")
    assert response.status_code == 200
    data = response.json()
    assert data["metadata"]["total_count"] >= 1
    items = data["items"]
    # Verify we find our PO
    found = any(p["po_number"] == "TEST-PO-002" for p in items)
    assert found


def test_get_po_detail(client: TestClient):
    po_number = "TEST-PO-003"
    po_data = {
        "header": {"po_number": po_number, "po_date": "2023-10-29", "supplier_name": "Test Supplier 3", "po_value": 3000.0},
        "items": [{"po_item_no": 10, "ord_qty": 10.0, "po_rate": 300.0, "deliveries": [{"lot_no": 1, "ord_qty": 10.0}]}],
    }
    client.post("/api/po/", json=po_data)

    response = client.get(f"/api/po/{po_number}")
    assert response.status_code == 200
    detail = response.json()
    assert detail["header"]["po_number"] == po_number
    assert detail["items"][0]["po_item_no"] == 10


def test_get_nonexistent_po(client: TestClient):
    response = client.get("/api/po/NONEXISTENT-PO")
    assert response.status_code == 404
