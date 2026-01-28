#!/bin/bash
# Isaac/Levi Function Test Script
# Tests major API endpoints to verify they're working before deployment

set -e

# Configuration
BASE_URL="${1:-http://127.0.0.1:8000}"
VERBOSE="${2:-false}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
WARNINGS=0

log_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

log_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

log_warn() {
    echo -e "${YELLOW}!${NC} $1"
    ((WARNINGS++))
}

test_endpoint() {
    local method="$1"
    local endpoint="$2"
    local expected_status="$3"
    local description="$4"

    if [ "$VERBOSE" = "true" ]; then
        echo "Testing: $method $endpoint"
    fi

    response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$BASE_URL$endpoint" 2>/dev/null)

    if [ "$response" = "$expected_status" ]; then
        log_pass "$description ($method $endpoint)"
    elif [ "$response" = "401" ] || [ "$response" = "403" ]; then
        log_warn "$description - Auth required ($response)"
    else
        log_fail "$description - Expected $expected_status, got $response"
    fi
}

echo "=========================================="
echo "Isaac/Levi API Endpoint Tests"
echo "Base URL: $BASE_URL"
echo "=========================================="
echo ""

# Health Check
echo "--- Core Health ---"
test_endpoint "GET" "/health" "200" "Health check"
test_endpoint "GET" "/" "200" "Root endpoint"

# Dashboard
echo ""
echo "--- Dashboard ---"
test_endpoint "GET" "/dashboard/" "200" "Dashboard data"
test_endpoint "GET" "/dashboard/quick-stats/" "200" "Quick stats"
test_endpoint "GET" "/dashboard/cold-protection/" "200" "Cold protection"

# Weather
echo ""
echo "--- Weather ---"
test_endpoint "GET" "/weather/current/" "200" "Current weather"
test_endpoint "GET" "/weather/forecast/" "200" "Weather forecast"
test_endpoint "GET" "/weather/alerts/" "200" "Weather alerts"

# Settings (may require auth)
echo ""
echo "--- Settings ---"
test_endpoint "GET" "/settings/" "200" "Settings list"
test_endpoint "GET" "/settings/version/" "200" "Version info"
test_endpoint "GET" "/settings/health-check/" "200" "Health monitor"
test_endpoint "GET" "/settings/health-summary/" "200" "Health summary"

# Auth
echo ""
echo "--- Authentication ---"
test_endpoint "GET" "/auth/check" "200" "Auth check (no session)"

# Plants
echo ""
echo "--- Plants ---"
test_endpoint "GET" "/plants/" "200" "Plants list"
test_endpoint "GET" "/plants/tags/" "200" "Plant tags"
test_endpoint "GET" "/plants/needs-water/today/" "200" "Plants needing water"

# Animals
echo ""
echo "--- Animals ---"
test_endpoint "GET" "/animals/" "200" "Animals list"
test_endpoint "GET" "/animals/care-groups/" "200" "Care groups"

# Tasks
echo ""
echo "--- Tasks ---"
test_endpoint "GET" "/tasks/" "200" "Tasks list"
test_endpoint "GET" "/tasks/backlog/" "200" "Backlog tasks"

# Seeds
echo ""
echo "--- Seeds ---"
test_endpoint "GET" "/seeds/" "200" "Seeds inventory"
test_endpoint "GET" "/seeds/categories/" "200" "Seed categories"

# Home Maintenance
echo ""
echo "--- Home Maintenance ---"
test_endpoint "GET" "/home-maintenance/" "200" "Home maintenance list"
test_endpoint "GET" "/home-maintenance/categories/list/" "200" "Maintenance categories"

# Vehicles
echo ""
echo "--- Vehicles ---"
test_endpoint "GET" "/vehicles/" "200" "Vehicles list"

# Equipment
echo ""
echo "--- Equipment ---"
test_endpoint "GET" "/equipment/" "200" "Equipment list"

# Farm Areas
echo ""
echo "--- Farm Areas ---"
test_endpoint "GET" "/farm-areas/" "200" "Farm areas list"

# Team
echo ""
echo "--- Team ---"
test_endpoint "GET" "/team/members/" "200" "Team members list"
test_endpoint "GET" "/team/vitals/types/" "200" "Vital types"

# Production
echo ""
echo "--- Production ---"
test_endpoint "GET" "/production/" "200" "Production records"

# Summary
echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "${GREEN}Passed:${NC}   $PASSED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS (auth-required endpoints)"
echo -e "${RED}Failed:${NC}   $FAILED"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Some tests failed! Check above for details.${NC}"
    exit 1
else
    echo -e "${GREEN}All endpoint tests passed!${NC}"
    exit 0
fi
