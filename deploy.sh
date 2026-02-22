#!/bin/bash
# Levi Deploy Script
# Safely syncs code to remote server without deleting important files

SSH_KEY="/home/n0mad1k/.ssh/levi"
REMOTE="n0mad1k@levi.local"
REMOTE_PATH="/opt/levi"
LOCAL_PATH="/home/n0mad1k/Tools/levi"
LOCK_DIR="/tmp/levi-deploy.lock"
DEPLOY_TYPE="prod"

echo "=== Deploying Levi (Production) ==="

# Function to release lock on exit
cleanup() {
    echo "Releasing deploy lock..."
    ssh -i $SSH_KEY $REMOTE "rm -rf $LOCK_DIR" 2>/dev/null
}

# First verify SSH connectivity
echo "Checking for concurrent deploys..."
if ! ssh -i $SSH_KEY $REMOTE "echo 'SSH OK'" > /dev/null 2>&1; then
    echo ""
    echo "ERROR: Cannot connect to remote server."
    echo "Check SSH key and network connectivity."
    exit 1
fi

# Atomic lock acquisition using mkdir (fails if directory exists)
# Production deploy FAILS IMMEDIATELY if another deploy is running
echo "  Lock: $LOCK_DIR"
if ! ssh -i $SSH_KEY $REMOTE "mkdir $LOCK_DIR 2>/dev/null && echo '$DEPLOY_TYPE' > $LOCK_DIR/owner"; then
    # Failed to acquire lock - another deploy is running
    LOCK_OWNER=$(ssh -i $SSH_KEY $REMOTE "cat $LOCK_DIR/owner 2>/dev/null" || echo "unknown")
    echo ""
    echo "============================================"
    echo "   DEPLOY BLOCKED - CONCURRENT DEPLOY"
    echo "============================================"
    echo ""
    echo "Another deploy ($LOCK_OWNER) is currently running."
    echo "Production deploy will NOT run during another deployment."
    echo ""
    echo "Wait for the $LOCK_OWNER deploy to complete and try again."
    echo ""
    echo "If you believe the lock is stale, remove it manually:"
    echo "  ssh -i $SSH_KEY $REMOTE 'rm -rf $LOCK_DIR'"
    echo ""
    exit 1
fi
echo "  Lock acquired!"

# Set trap to release lock on exit (normal or error)
trap cleanup EXIT

# Auto-commit any uncommitted changes
cd $LOCAL_PATH
if [[ -n $(git status --porcelain) ]]; then
    echo "Committing uncommitted changes..."
    git add -A
    VERSION=$(cat VERSION)
    git commit -m "v${VERSION} - Auto-commit before prod deploy"
    echo "Changes committed."
fi

# Security: Run dependency audits (warnings only, don't block deploy)
echo "Running security audit on Python dependencies..."
PIP_AUDIT="${HOME}/.local/bin/pip-audit"
if [[ -x "$PIP_AUDIT" ]] || command -v pip-audit &> /dev/null; then
    ${PIP_AUDIT:-pip-audit} -r /home/n0mad1k/Tools/levi/backend/requirements.txt --ignore-vuln PYSEC-2024-* 2>/dev/null || echo "  Note: pip-audit found issues (see above)"
else
    echo "  Skipped: pip-audit not installed (pipx install pip-audit)"
fi

echo "Running security audit on Node dependencies..."
cd /home/n0mad1k/Tools/levi/frontend && npm audit --audit-level=high 2>/dev/null || echo "  Note: npm audit found issues (see above)"
cd - > /dev/null

# ALWAYS backup database first
echo "Creating pre-deploy backup..."
ssh -i $SSH_KEY $REMOTE "/opt/levi/backup.sh"

# Sync backend (excluding venv, data, logs, __pycache__, and dev-only files)
# Note: dev_tracker model is needed by customer_feedback, so only exclude the router
echo "Syncing backend..."
rsync -avz \
  --exclude 'venv/' \
  --exclude 'data/' \
  --exclude 'logs/' \
  --exclude '__pycache__/' \
  --exclude '*.pyc' \
  --exclude '.env' \
  --exclude 'routers/dev_tracker.py' \
  -e "ssh -i $SSH_KEY" \
  /home/n0mad1k/Tools/levi/backend/ \
  $REMOTE:$REMOTE_PATH/backend/

# Post-sync: Remove dev-only code from production
echo "Cleaning dev-only code from production..."
ssh -i $SSH_KEY $REMOTE "
  # Remove dev tracker router (but keep model - needed by customer_feedback)
  rm -f $REMOTE_PATH/backend/routers/dev_tracker.py

  # Remove dev_tracker try/except import block from __init__ and replace with simple assignment
  python3 -c \"
content = open('$REMOTE_PATH/backend/routers/__init__.py').read()
content = content.replace(
    'try:\n    from .dev_tracker import router as dev_tracker_router\nexcept ImportError:\n    dev_tracker_router = None  # Not available in public release',
    'dev_tracker_router = None  # Not available in public release'
)
open('$REMOTE_PATH/backend/routers/__init__.py', 'w').write(content)
\" 2>/dev/null || true
  sed -i '/dev_tracker_router/d' $REMOTE_PATH/backend/main.py 2>/dev/null || true
"

# Remove pull-from-prod endpoint using heredoc (separate SSH to avoid escaping issues)
ssh -i $SSH_KEY $REMOTE 'python3' << 'PYEOF'
import re
try:
    with open('/opt/levi/backend/routers/settings.py', 'r') as f:
        content = f.read()
    # Remove pull-from-prod endpoint
    pattern = r'@router\.post\("/pull-from-prod/"\).*?(?=@router\.|$)'
    new_content = re.sub(pattern, '', content, flags=re.DOTALL)
    if new_content != content:
        with open('/opt/levi/backend/routers/settings.py', 'w') as f:
            f.write(new_content)
        print('Removed pull-from-prod endpoint')
    else:
        print('pull-from-prod endpoint not found or already removed')
except Exception as e:
    print(f'Note: {e}')
PYEOF

# Sync frontend source (not node_modules or dist, excluding dev-only files)
echo "Syncing frontend source..."
rsync -avz \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  --exclude 'pages/DevTracker.jsx' \
  -e "ssh -i $SSH_KEY" \
  /home/n0mad1k/Tools/levi/frontend/src/ \
  $REMOTE:$REMOTE_PATH/frontend/src/

# Clean dev-only frontend files
echo "Cleaning dev-only frontend code..."
ssh -i $SSH_KEY $REMOTE "
  # Remove DevTracker page
  rm -f $REMOTE_PATH/frontend/src/pages/DevTracker.jsx

  # Remove dev-tracker route from App.jsx
  sed -i '/DevTracker/d' $REMOTE_PATH/frontend/src/App.jsx 2>/dev/null || true
  sed -i '/dev-tracker/d' $REMOTE_PATH/frontend/src/App.jsx 2>/dev/null || true

  # Remove dev-tracker API calls from api.js
  # Use range pattern to remove multi-line functions (uploadDevTrackerImage block)
  sed -i '/\/\/ Dev Tracker/,/^$/d' $REMOTE_PATH/frontend/src/services/api.js 2>/dev/null || true
  sed -i '/dev-tracker/d' $REMOTE_PATH/frontend/src/services/api.js 2>/dev/null || true
"

# Sync frontend config files if needed
echo "Syncing frontend config..."
rsync -avz \
  -e "ssh -i $SSH_KEY" \
  /home/n0mad1k/Tools/levi/frontend/package.json \
  /home/n0mad1k/Tools/levi/frontend/vite.config.js \
  /home/n0mad1k/Tools/levi/frontend/tailwind.config.js \
  /home/n0mad1k/Tools/levi/frontend/postcss.config.js \
  /home/n0mad1k/Tools/levi/frontend/index.html \
  $REMOTE:$REMOTE_PATH/frontend/

# Sync frontend public directory (PWA assets, icons, manifest, etc.)
echo "Syncing frontend public assets..."
rsync -avz \
  -e "ssh -i $SSH_KEY" \
  /home/n0mad1k/Tools/levi/frontend/public/ \
  $REMOTE:$REMOTE_PATH/frontend/public/

# Sync VERSION and CHANGELOG for version tracking
echo "Syncing version info..."
rsync -avz \
  -e "ssh -i $SSH_KEY" \
  /home/n0mad1k/Tools/levi/VERSION \
  /home/n0mad1k/Tools/levi/CHANGELOG.md \
  $REMOTE:$REMOTE_PATH/

# Rebuild frontend on remote
echo "Building frontend..."
ssh -i $SSH_KEY $REMOTE "cd $REMOTE_PATH/frontend && npm run build"

# Kill any orphaned uvicorn processes before restart
echo "Killing orphaned processes..."
ssh -i $SSH_KEY $REMOTE "pkill -f 'uvicorn.*levi.*main:app' || true"
sleep 1

# Restart backend service
echo "Restarting backend..."
ssh -i $SSH_KEY $REMOTE "sudo systemctl restart levi-backend"

echo "=== Deploy Complete ==="
echo "Checking backend status..."
ssh -i $SSH_KEY $REMOTE "sudo systemctl status levi-backend --no-pager | head -10"
