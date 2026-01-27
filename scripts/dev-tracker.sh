#!/bin/bash
# Dev Tracker Management Script
# Usage:
#   ./dev-tracker.sh list [pending|testing|verified|backlog]
#   ./dev-tracker.sh show <id>                      - Show full details of an item
#   ./dev-tracker.sh add <priority> <title>         - Add new item (priority: low|medium|high|critical)
#   ./dev-tracker.sh testing <id>                   - Move to testing
#   ./dev-tracker.sh verified <id>                  - Move to verified
#   ./dev-tracker.sh pending <id> [fail_note]       - Move back to pending
#   ./dev-tracker.sh backlog <id>                   - Move to backlog (work on later)
#   ./dev-tracker.sh collab <id> [on|off]           - Mark as needing interactive collaboration

DEV_URL="https://192.168.5.56:8443/api/dev-tracker"

case "$1" in
    list)
        STATUS_FILTER="$2"
        if [ -n "$STATUS_FILTER" ]; then
            curl -sk "$DEV_URL/" | python3 -c "
import json,sys
data=json.load(sys.stdin)
for item in data:
    if item['status'] == '$STATUS_FILTER':
        collab = '[COLLAB] ' if item.get('requires_collab') else ''
        print(f\"[{item['id']}] {item['priority'].upper()} - {collab}{item['title'][:55]}{'...' if len(item['title']) > 55 else ''}\")"
        else
            curl -sk "$DEV_URL/" | python3 -c "
import json,sys
data=json.load(sys.stdin)
pending = [i for i in data if i['status'] == 'pending']
testing = [i for i in data if i['status'] == 'testing']
verified = [i for i in data if i['status'] == 'verified']
backlog = [i for i in data if i['status'] == 'backlog']

print('=== PENDING ===' )
for item in sorted(pending, key=lambda x: {'critical':0,'high':1,'medium':2,'low':3}.get(x['priority'], 4)):
    collab = '[COLLAB] ' if item.get('requires_collab') else ''
    print(f\"  [{item['id']}] {item['priority'].upper()} - {collab}{item['title'][:45]}{'...' if len(item['title']) > 45 else ''}\")
print(f'\n=== TESTING ({len(testing)}) ===')
for item in testing[:5]:
    collab = '[COLLAB] ' if item.get('requires_collab') else ''
    print(f\"  [{item['id']}] {collab}{item['title'][:50]}{'...' if len(item['title']) > 50 else ''}\")
if len(testing) > 5:
    print(f'  ... and {len(testing)-5} more')
print(f'\n=== BACKLOG ({len(backlog)}) ===')
for item in backlog[:5]:
    print(f\"  [{item['id']}] {item['priority'].upper()} - {item['title'][:45]}{'...' if len(item['title']) > 45 else ''}\")
if len(backlog) > 5:
    print(f'  ... and {len(backlog)-5} more')
print(f'\n=== VERIFIED ({len(verified)}) ===')"
        fi
        ;;

    show)
        ID="$2"
        if [ -z "$ID" ]; then
            echo "Usage: $0 show <id>"
            exit 1
        fi
        curl -sk "$DEV_URL/$ID" | python3 -c "
import json,sys
try:
    item = json.load(sys.stdin)
    if 'detail' in item:
        print(f\"Error: {item['detail']}\")
        sys.exit(1)
    collab = ' [COLLAB]' if item.get('requires_collab') else ''
    print(f\"ID: {item['id']}{collab}\")
    print(f\"Priority: {item['priority'].upper()}\")
    print(f\"Status: {item['status'].upper()}\")
    print(f\"Fail Count: {item.get('fail_count', 0)}\")
    if item.get('fail_note'):
        print(f\"Fail Note: {item['fail_note']}\")
    print(f\"---\")
    print(f\"Title: {item['title']}\")
except Exception as e:
    print(f'Error parsing response: {e}')
"
        ;;

    add)
        PRIORITY="$2"
        shift 2
        TITLE="$*"
        if [ -z "$PRIORITY" ] || [ -z "$TITLE" ]; then
            echo "Usage: $0 add <priority> <title>"
            echo "Priority: low | medium | high | critical"
            exit 1
        fi
        # Validate priority
        case "$PRIORITY" in
            low|medium|high|critical) ;;
            *)
                echo "Invalid priority: $PRIORITY"
                echo "Must be: low | medium | high | critical"
                exit 1
                ;;
        esac
        RESULT=$(curl -sk -X POST "$DEV_URL/" \
            -H "Content-Type: application/json" \
            -d "{\"title\": \"$TITLE\", \"priority\": \"$PRIORITY\"}" 2>/dev/null)
        if echo "$RESULT" | grep -q '"id"'; then
            NEW_ID=$(echo "$RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
            echo "Created #$NEW_ID ($PRIORITY): $TITLE"
        else
            echo "Failed to create item"
            echo "$RESULT"
        fi
        ;;

    collab)
        ID="$2"
        TOGGLE="${3:-on}"

        if [ -z "$ID" ]; then
            echo "Usage: $0 collab <id> [on|off]"
            exit 1
        fi

        if [ "$TOGGLE" = "off" ]; then
            VALUE="false"
        else
            VALUE="true"
        fi

        RESULT=$(curl -sk -X PUT "$DEV_URL/$ID" \
            -H "Content-Type: application/json" \
            -d "{\"requires_collab\": $VALUE}" 2>/dev/null)

        if echo "$RESULT" | grep -q '"id"'; then
            TITLE=$(echo "$RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin)['title'][:50])")
            if [ "$VALUE" = "true" ]; then
                echo "Marked #$ID as [COLLAB] - Claude must work through this interactively: $TITLE"
            else
                echo "Removed [COLLAB] from #$ID: $TITLE"
            fi
        else
            echo "Failed to update #$ID"
            echo "$RESULT"
        fi
        ;;

    update|testing|verified|pending|backlog)
        if [ "$1" = "update" ]; then
            ID="$2"
            STATUS="$3"
            FAIL_NOTE="$4"
        else
            STATUS="$1"
            ID="$2"
            FAIL_NOTE="$3"
        fi

        if [ -z "$ID" ] || [ -z "$STATUS" ]; then
            echo "Usage: $0 update <id> <status> OR $0 <status> <id> [fail_note]"
            exit 1
        fi

        # Build JSON payload
        if [ -n "$FAIL_NOTE" ] && [ "$STATUS" = "pending" ]; then
            JSON="{\"status\": \"$STATUS\", \"fail_note\": \"$FAIL_NOTE\"}"
        else
            JSON="{\"status\": \"$STATUS\"}"
        fi

        RESULT=$(curl -sk -X PUT "$DEV_URL/$ID" \
            -H "Content-Type: application/json" \
            -d "$JSON" 2>/dev/null)

        if echo "$RESULT" | grep -q '"id"'; then
            TITLE=$(echo "$RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin)['title'][:50])")
            echo "Updated #$ID to $STATUS: $TITLE"
        else
            echo "Failed to update #$ID"
            echo "$RESULT"
        fi
        ;;

    *)
        echo "Dev Tracker CLI"
        echo "Usage:"
        echo "  $0 list [pending|testing|verified|backlog]  - List items"
        echo "  $0 show <id>                        - Show full details of an item"
        echo "  $0 add <priority> <title>           - Add new item (low|medium|high|critical)"
        echo "  $0 testing <id>                     - Move to testing"
        echo "  $0 verified <id>                    - Move to verified"
        echo "  $0 pending <id> [fail_note]         - Move back to pending"
        echo "  $0 backlog <id>                     - Move to backlog (work on later)"
        echo "  $0 collab <id> [on|off]             - Mark as needing interactive fixing with user"
        ;;
esac
