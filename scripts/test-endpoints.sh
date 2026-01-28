#!/bin/bash
# Isaac/Levi Full Function Test Script
# Tests major API endpoints to verify they're working before deployment
# Usage: ./test-endpoints.sh [base_url] [verbose]
# Example: ./test-endpoints.sh https://192.168.5.56:8443 true

# Don't exit on error - we want to collect all test results
# set -e

# Configuration
BASE_URL="${1:-http://127.0.0.1:8000}"
VERBOSE="${2:-false}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
WARNINGS=0
SKIPPED=0

declare -A CATEGORY_RESULTS

log_pass() {
    echo -e "${GREEN}✓${NC} $1"
    PASSED=$((PASSED + 1))
}

log_fail() {
    echo -e "${RED}✗${NC} $1"
    FAILED=$((FAILED + 1))
}

log_warn() {
    echo -e "${YELLOW}!${NC} $1"
    WARNINGS=$((WARNINGS + 1))
}

log_skip() {
    echo -e "${CYAN}-${NC} $1"
    SKIPPED=$((SKIPPED + 1))
}

test_endpoint() {
    local method="$1"
    local endpoint="$2"
    local expected_status="$3"
    local description="$4"
    local allow_empty="${5:-false}"

    if [ "$VERBOSE" = "true" ]; then
        echo "  Testing: $method $endpoint"
    fi

    # Use -k to ignore SSL certificate errors for self-signed certs
    response=$(curl -sk -o /tmp/test_response.txt -w "%{http_code}" -X "$method" "$BASE_URL$endpoint" 2>/dev/null)
    body_size=$(wc -c < /tmp/test_response.txt)

    if [ "$response" = "$expected_status" ]; then
        # Check for empty response (might indicate issue)
        if [ "$allow_empty" = "false" ] && [ "$body_size" -lt 3 ] && [ "$response" = "200" ]; then
            log_warn "$description - Empty response"
        else
            log_pass "$description"
        fi
    elif [ "$response" = "401" ] || [ "$response" = "403" ]; then
        log_warn "$description - Auth required ($response)"
    elif [ "$response" = "000" ]; then
        log_fail "$description - Connection failed"
    else
        log_fail "$description - Expected $expected_status, got $response"
        if [ "$VERBOSE" = "true" ]; then
            echo "    Response body: $(head -c 200 /tmp/test_response.txt)"
        fi
    fi
}

print_section() {
    echo ""
    echo -e "${CYAN}━━━ $1 ━━━${NC}"
}

# Check connectivity first
echo "=========================================="
echo "Isaac/Levi Full Function Test"
echo "Base URL: $BASE_URL"
echo "=========================================="

print_section "Connectivity Check"
response=$(curl -sk -o /dev/null -w "%{http_code}" "$BASE_URL/health" 2>/dev/null || echo "000")
if [ "$response" = "000" ]; then
    echo -e "${RED}Cannot connect to $BASE_URL${NC}"
    echo "Please ensure the server is running."
    exit 1
fi
log_pass "Server reachable"

# ========================================
# CORE SYSTEM
# ========================================
print_section "Core System"
test_endpoint "GET" "/health" "200" "Health check"
test_endpoint "GET" "/" "200" "Root endpoint"
test_endpoint "GET" "/api/settings/version/" "200" "Version info"
test_endpoint "GET" "/api/settings/health-check/" "200" "Health monitor"
test_endpoint "GET" "/api/settings/health-summary/" "200" "Health summary"

# ========================================
# AUTHENTICATION
# ========================================
print_section "Authentication"
test_endpoint "GET" "/api/auth/check" "200" "Auth check"
test_endpoint "GET" "/api/auth/roles" "200" "Roles list"
test_endpoint "GET" "/api/auth/permissions" "200" "Permissions list"

# ========================================
# DASHBOARD
# ========================================
print_section "Dashboard"
test_endpoint "GET" "/api/dashboard/" "200" "Dashboard data"
test_endpoint "GET" "/api/dashboard/quick-stats" "200" "Quick stats"
test_endpoint "GET" "/api/dashboard/cold-protection/" "200" "Cold protection"
test_endpoint "GET" "/api/dashboard/freeze-warning/" "200" "Freeze warning"
test_endpoint "GET" "/api/dashboard/storage/" "200" "Storage stats"
# Calendar
YEAR=$(date +%Y)
MONTH=$(date +%m)
DAY=$(date +%d)
test_endpoint "GET" "/api/dashboard/calendar/$YEAR/$MONTH" "200" "Monthly calendar"
test_endpoint "GET" "/api/dashboard/calendar/week/$YEAR/$MONTH/$DAY" "200" "Weekly calendar"

# ========================================
# WEATHER
# ========================================
print_section "Weather"
test_endpoint "GET" "/api/weather/current/" "200" "Current weather"
test_endpoint "GET" "/api/weather/current/raw/" "200" "Raw weather data"
test_endpoint "GET" "/api/weather/forecast/" "200" "Weather forecast"
test_endpoint "GET" "/api/weather/alerts/" "200" "Weather alerts"
test_endpoint "GET" "/api/weather/stats/" "200" "Weather stats"
test_endpoint "GET" "/api/weather/soil-moisture/" "200" "Soil moisture"
test_endpoint "GET" "/api/weather/rain-forecast/" "200" "Rain forecast"

# ========================================
# SETTINGS
# ========================================
print_section "Settings"
test_endpoint "GET" "/api/settings/" "200" "Settings list"

# ========================================
# TASKS
# ========================================
print_section "Tasks"
test_endpoint "GET" "/api/tasks/" "200" "Tasks list"
test_endpoint "GET" "/api/tasks/today/" "200" "Today's tasks"
test_endpoint "GET" "/api/tasks/upcoming/" "200" "Upcoming tasks"
test_endpoint "GET" "/api/tasks/overdue/" "200" "Overdue tasks"
test_endpoint "GET" "/api/tasks/metrics/" "200" "Task metrics"
test_endpoint "GET" "/api/tasks/caldav/status/" "200" "CalDAV status"

# ========================================
# PLANTS
# ========================================
print_section "Plants"
test_endpoint "GET" "/api/plants/" "200" "Plants list"
test_endpoint "GET" "/api/plants/tags/" "200" "Plant tags"
test_endpoint "GET" "/api/plants/needs-water/today/" "200" "Plants needing water"

# ========================================
# SEEDS
# ========================================
print_section "Seeds"
test_endpoint "GET" "/api/seeds/" "200" "Seeds inventory"
test_endpoint "GET" "/api/seeds/categories/" "200" "Seed categories"

# ========================================
# ANIMALS
# ========================================
print_section "Animals"
test_endpoint "GET" "/api/animals/" "200" "Animals list"
test_endpoint "GET" "/api/animals/pets/list/" "200" "Pets list"
test_endpoint "GET" "/api/animals/livestock/list/" "200" "Livestock list"
test_endpoint "GET" "/api/animals/care-due/worming/" "200" "Worming due"
test_endpoint "GET" "/api/animals/care-due/vaccination/" "200" "Vaccination due"
test_endpoint "GET" "/api/animals/care-due/hoof-trim/" "200" "Hoof trim due"
test_endpoint "GET" "/api/animals/care-due/dental/" "200" "Dental due"
test_endpoint "GET" "/api/animals/cold-sensitive/" "200" "Cold sensitive animals"
test_endpoint "GET" "/api/animals/needs-blanket/?temp=30" "200" "Animals needing blanket"
test_endpoint "GET" "/api/animals/livestock/approaching-slaughter/" "200" "Approaching slaughter"

# ========================================
# PRODUCTION
# ========================================
print_section "Production"
test_endpoint "GET" "/api/production/stats/" "200" "Production stats" "true"
test_endpoint "GET" "/api/production/livestock/" "200" "Livestock production"
test_endpoint "GET" "/api/production/harvests/" "200" "Plant harvests"
test_endpoint "GET" "/api/production/sales/" "200" "Sales records"
test_endpoint "GET" "/api/production/customers/" "200" "Customers list"
test_endpoint "GET" "/api/production/orders/" "200" "Livestock orders"
test_endpoint "GET" "/api/production/financial-summary/" "200" "Financial summary"

# ========================================
# HOME MAINTENANCE
# ========================================
print_section "Home Maintenance"
test_endpoint "GET" "/api/home-maintenance/" "200" "Home maintenance list"
test_endpoint "GET" "/api/home-maintenance/categories/list" "200" "Maintenance categories"
test_endpoint "GET" "/api/home-maintenance/areas/list" "200" "Maintenance areas"

# ========================================
# VEHICLES
# ========================================
print_section "Vehicles"
test_endpoint "GET" "/api/vehicles/" "200" "Vehicles list"
test_endpoint "GET" "/api/vehicles/types/list" "200" "Vehicle types"

# ========================================
# EQUIPMENT
# ========================================
print_section "Equipment"
test_endpoint "GET" "/api/equipment/" "200" "Equipment list"

# ========================================
# FARM AREAS
# ========================================
print_section "Farm Areas"
test_endpoint "GET" "/api/farm-areas/" "200" "Farm areas list"

# ========================================
# TEAM
# ========================================
print_section "Team"
test_endpoint "GET" "/api/team/members/" "200" "Team members list"
test_endpoint "GET" "/api/team/vitals/types/" "200" "Vital types"
test_endpoint "GET" "/api/team/values-summary/" "200" "Values summary"
test_endpoint "GET" "/api/team/readiness/" "200" "Team readiness"
test_endpoint "GET" "/api/team/gear/" "200" "Team gear"
test_endpoint "GET" "/api/team/training-summary/" "200" "Training summary"
test_endpoint "GET" "/api/team/supply-requests/" "200" "Supply requests"
test_endpoint "GET" "/api/team/aar/" "200" "After Action Reports"
test_endpoint "GET" "/api/team/aar/current/" "200" "Current AAR"

# ========================================
# WORKERS
# ========================================
print_section "Workers"
test_endpoint "GET" "/api/workers/" "200" "Workers list"
test_endpoint "GET" "/api/workers/assignable-tasks/" "200" "Assignable tasks"

# ========================================
# FEEDBACK (Dev only)
# ========================================
print_section "Feedback"
test_endpoint "GET" "/api/feedback/enabled/" "200" "Feedback enabled check"

# ========================================
# SUPPLY REQUESTS
# ========================================
print_section "Supply Requests"
test_endpoint "GET" "/api/supply-requests/" "200" "Supply requests list"

# ========================================
# DEV TRACKER
# ========================================
print_section "Dev Tracker"
test_endpoint "GET" "/api/dev-tracker/" "200" "Dev tracker items"

# ========================================
# SUMMARY
# ========================================
echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "${GREEN}Passed:${NC}   $PASSED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS (auth-required or empty)"
echo -e "${CYAN}Skipped:${NC}  $SKIPPED"
echo -e "${RED}Failed:${NC}   $FAILED"
echo ""

TOTAL=$((PASSED + WARNINGS + FAILED))
SUCCESS_RATE=$((PASSED * 100 / TOTAL))

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}TESTS FAILED! ($SUCCESS_RATE% passed)${NC}"
    echo -e "${RED}Fix the failed endpoints before deploying.${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    exit 1
elif [ $WARNINGS -gt 5 ]; then
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}TESTS PASSED WITH WARNINGS${NC}"
    echo -e "${YELLOW}Check auth-required endpoints if needed.${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    exit 0
else
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}ALL TESTS PASSED! ($SUCCESS_RATE%)${NC}"
    echo -e "${GREEN}Safe to deploy.${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    exit 0
fi
