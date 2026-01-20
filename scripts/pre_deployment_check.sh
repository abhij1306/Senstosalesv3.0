#!/bin/bash
# Pre-Deployment Validation Script
# Ensures system is truly production-ready before deployment

set -e

echo "╔══════════════════════════════════════════════════╗"
echo "║   PRE-DEPLOYMENT VALIDATION - FULL SUITE       ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Backend Health
echo -e "${YELLOW}[1/7] Backend Health Check...${NC}"
curl -sf http://localhost:8000/api/health > /dev/null || {
  echo -e "${RED}✗ Backend health check failed${NC}"
  exit 1
}
echo -e "${GREEN}✓ Backend healthy${NC}"

# Step 2: Frontend Build
echo -e "${YELLOW}[2/7] Building Frontend...${NC}"
cd frontend
npm run build > /dev/null 2>&1 || {
  echo -e "${RED}✗ Frontend build failed${NC}"
  exit 1
}
echo -e "${GREEN}✓ Frontend build successful${NC}"
cd ..

# Step 3: TypeScript Check
echo -e "${YELLOW}[3/7] Type Checking...${NC}"
cd frontend
npx tsc --noEmit || {
  echo -e "${RED}✗ TypeScript errors found${NC}"
  exit 1
}
echo -e "${GREEN}✓ No TypeScript errors${NC}"
cd ..

# Step 4: Database Validation
echo -e "${YELLOW}[4/7] Database Integrity...${NC}"
python scripts/guards/db_path_validator.py || {
  echo -e "${RED}✗ Database validation failed${NC}"
  exit 1
}
echo -e "${GREEN}✓ Database valid${NC}"

# Step 5: Critical API Endpoints
echo -e "${YELLOW}[5/7] Testing Critical Endpoints...${NC}"
curl -sf http://localhost:8000/api/dashboard/summary > /dev/null || {
  echo -e "${RED}✗ Dashboard endpoint failed${NC}"
  exit 1
}
curl -sf http://localhost:8000/api/po/stats > /dev/null || {
  echo -e "${RED}✗ PO stats endpoint failed${NC}"
  exit 1
}
curl -sf http://localhost:8000/api/dc/stats > /dev/null || {
  echo -e "${RED}✗ DC stats endpoint failed${NC}"
  exit 1
}
echo -e "${GREEN}✓ All endpoints responding${NC}"

# Step 6: Frontend Runtime
echo -e "${YELLOW}[6/7] Frontend Runtime Check...${NC}"
curl -sf http://localhost:3000 > /dev/null || {
  echo -e "${RED}✗ Frontend not responding${NC}"
  exit 1
}
echo -e "${GREEN}✓ Frontend responding${NC}"

# Step 7: Backend Tests (if exist)
echo -e "${YELLOW}[7/7] Backend Tests...${NC}"
if [ -d "backend/tests" ]; then
  cd backend
  python -m pytest tests/ -v || {
    echo -e "${RED}✗ Backend tests failed${NC}"
    exit 1
  }
  echo -e "${GREEN}✓ All tests passed${NC}"
  cd ..
else
  echo -e "${YELLOW}⚠ No tests found (skipping)${NC}"
fi

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   ✅ ALL VALIDATIONS PASSED                     ║"
echo "║   System is PRODUCTION READY                    ║"
echo "╚══════════════════════════════════════════════════╝"
