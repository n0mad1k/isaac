#!/bin/bash
# prod-api.sh - Authenticated curl requests to production API
# Usage: ./prod-api.sh METHOD PATH [DATA]
# Examples:
#   ./prod-api.sh GET /tasks/calendar/?start_date=2026-01-30&end_date=2026-02-22
#   ./prod-api.sh PATCH /tasks/123/ '{"description": "new desc"}'
#   ./prod-api.sh POST /tasks/ '{"title": "test"}'

METHOD="${1:-GET}"
PATH_URL="$2"
DATA="$3"
TOKEN="ljm30jeCKagzDR7zbSqBNlOHL9WiOio8bA-Qy_bLvJ8"
PI_HOST="n0mad1k@levi.local"
SSH_KEY="/home/n0mad1k/.ssh/levi"
BASE_URL="http://127.0.0.1:8000"

if [ -z "$PATH_URL" ]; then
    echo "Usage: $0 METHOD PATH [JSON_DATA]"
    echo "  METHOD: GET, POST, PATCH, PUT, DELETE"
    echo "  PATH: API path (e.g., /tasks/calendar/)"
    echo "  DATA: Optional JSON body for POST/PATCH/PUT"
    exit 1
fi

# Build curl command
CURL_CMD="curl -sL -w '\n%{http_code}' -H 'Cookie: session_token=${TOKEN}' -H 'Content-Type: application/json'"

if [ "$METHOD" != "GET" ]; then
    CURL_CMD="$CURL_CMD -X $METHOD"
fi

if [ -n "$DATA" ]; then
    # Escape single quotes in data for SSH
    ESCAPED_DATA=$(echo "$DATA" | sed "s/'/'\\\\''/g")
    CURL_CMD="$CURL_CMD -d '${ESCAPED_DATA}'"
fi

CURL_CMD="$CURL_CMD '${BASE_URL}${PATH_URL}'"

ssh -i "$SSH_KEY" "$PI_HOST" "$CURL_CMD" 2>/dev/null
