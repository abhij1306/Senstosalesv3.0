"""
API Endpoint Verification Script
Maps all backend routes and checks frontend usage (api.ts specific)
"""

import re
from pathlib import Path


def extract_routes_from_router(file_path):
    """Extract all route decorators from a Python router file"""
    routes = []
    content = file_path.read_text(encoding="utf-8")
    router_name = file_path.stem

    # Router logic usually maps tags/prefix in main.py, but we can guess standard pattern
    # Assuming prefix is /api/{router_name} or defined in main.py
    # We will just collect the suffixes here and map them later manually or via heuristic

    # Match @router.get("/path")
    pattern = r'@router\.(get|post|put|delete|patch)\(["\']([^"\']+)["\']'
    matches = re.findall(pattern, content)

    for method, path in matches:
        # Normalize path
        if path == "/":
            path = ""
        routes.append({"method": method.upper(), "suffix": path, "router": router_name})

    return routes


def extract_api_calls_from_lib(file_path):
    """Extract API calls from api.ts"""
    api_calls = []
    content = file_path.read_text(encoding="utf-8")

    # Match string literals starting with /api/
    # Matches: "/api/foo", '/api/foo', `/api/foo`
    pattern = r'["\'`](/api/[^"\'`$]+)["\'`]'
    matches = re.findall(pattern, content)

    for match in matches:
        api_calls.append(match)

    return sorted(list(set(api_calls)))


def main():
    backend_routers = Path("backend/api")
    api_ts = Path("frontend/lib/api.ts")

    print(f"Scanning Backend Routers in {backend_routers}...")
    backend_endpoints = []

    # Map router filenames to prefixes (heuristics based on main.py usually)
    router_prefixes = {
        "dashboard": "/api/dashboard",
        "po": "/api/po",
        "dc": "/api/dc",
        "invoice": "/api/invoice",
        "srv": "/api/srv",
        "reports": "/api/reports",
        "settings": "/api/settings",
        "buyers": "/api/buyers",
        "search": "/api/search",
        "health": "/api",
    }

    for router_file in backend_routers.glob("*.py"):
        if router_file.name.startswith("__"):
            continue

        routes = extract_routes_from_router(router_file)
        prefix = router_prefixes.get(router_file.stem, f"/api/{router_file.stem}")

        for route in routes:
            full_path = f"{prefix}{route['suffix']}"
            backend_endpoints.append(full_path)

    print(f"Scanning Frontend API definitions in {api_ts}...")
    frontend_endpoints = extract_api_calls_from_lib(api_ts)

    print("\n" + "=" * 60)
    print("API PARITY CHECK")
    print("=" * 60)

    missing_in_backend = []

    print(f"Backend Routes Found: {len(backend_endpoints)}")
    print(f"Frontend Calls Found: {len(frontend_endpoints)}")

    # Simplify comparison (ignore query params in frontend strings?)
    # Frontend strings might be templated e.g. `/api/po/${poNumber}` -> logic needs to be loose

    print("\n--- FRONTEND CALLS ANALYSIS ---")
    for fe_ep in frontend_endpoints:
        # Remove query params for matching
        base_ep = fe_ep.split("?")[0]

        # Check for direct match or fuzzy match (e.g. {id} vs $id)
        # Backend: /api/po/{po_number}
        # Frontend: /api/po/ (often used as base) or /api/po/stats

        found = False
        for be_ep in backend_endpoints:
            # simple check: if fe_ep is a prefix of be_ep or vice versa?
            # actually strict match is hard due to path params.
            # let's just check if the "segment" exists.

            # Convert backend {param} to *
            re.sub(r"\{[^}]+\}", "*", be_ep)
            # Convert frontend variables to * (if any, though regex matched string literals mostly)
            # But api.ts often uses template literals: `/api/po/${poNumber}` -> regex saw `/api/po/` if split?
            # Wait, my regex `[^"\'`$]+` stops at $. So `/api/po/${...}` becomes `/api/po/`

            if base_ep == be_ep:
                found = True
                break

            # Wildcard matching
            be_regex = "^" + re.escape(be_ep).replace(r"\{[^}]+\}", ".*") + "$"
            if re.match(be_regex, base_ep):
                found = True
                break

        status = "✅" if found else "❓"
        if not found:
            # Try matching partials
            if any(be_ep.startswith(base_ep) for be_ep in backend_endpoints):
                status = "✅ (Prefix)"
            else:
                missing_in_backend.append(fe_ep)

        print(f"{status} {fe_ep}")

    print("\n" + "=" * 60)
    if missing_in_backend:
        print(f"⚠️  POTENTIAL MISSING ROUTES: {len(missing_in_backend)}")
        for m in missing_in_backend:
            print(f"  - {m}")
    else:
        print("✅  ALL FRONTEND ROUTES APPEAR TO BE COVERED")

    print("=" * 60)


if __name__ == "__main__":
    main()
