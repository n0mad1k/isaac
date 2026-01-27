#!/bin/bash
# Isaac Dev Deploy Script
# Syncs code to dev environment for testing before production

SSH_KEY="/home/n0mad1k/.ssh/levi"
REMOTE="n0mad1k@192.168.5.56"
REMOTE_PATH="/opt/isaac"
LOCAL_PATH="/home/n0mad1k/Tools/levi"

echo "=== Deploying to Dev (Isaac) ==="

# Auto-commit any uncommitted changes
cd $LOCAL_PATH
if [[ -n $(git status --porcelain) ]]; then
    echo "Committing uncommitted changes..."
    git add -A
    VERSION=$(cat VERSION)
    git commit -m "v${VERSION} - Auto-commit before dev deploy"
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

# Create pre-deploy backup
echo "Creating pre-deploy backup..."
ssh -i $SSH_KEY $REMOTE "/opt/isaac/backup.sh"

# Sync backend (excluding venv, data, logs, __pycache__)
echo "Syncing backend..."
rsync -avz \
  --exclude 'venv/' \
  --exclude 'data/' \
  --exclude 'logs/' \
  --exclude '__pycache__/' \
  --exclude '*.pyc' \
  --exclude '.env' \
  -e "ssh -i $SSH_KEY" \
  /home/n0mad1k/Tools/levi/backend/ \
  $REMOTE:$REMOTE_PATH/backend/

# Sync frontend source (not node_modules or dist)
echo "Syncing frontend source..."
rsync -avz \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  -e "ssh -i $SSH_KEY" \
  /home/n0mad1k/Tools/levi/frontend/src/ \
  $REMOTE:$REMOTE_PATH/frontend/src/

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
ssh -i $SSH_KEY $REMOTE "pkill -f 'uvicorn.*isaac.*main:app' || true"
sleep 1

# Restart backend service
echo "Restarting backend..."
ssh -i $SSH_KEY $REMOTE "sudo systemctl restart isaac-backend"

echo "=== Dev Deploy Complete ==="
echo "Test at: https://isaac.local"
echo "Checking backend status..."
ssh -i $SSH_KEY $REMOTE "sudo systemctl status isaac-backend --no-pager | head -10"
