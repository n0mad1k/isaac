#!/bin/bash
# Isaac Dev Deploy Script
# Syncs code to dev environment for testing before production

SSH_KEY="/home/n0mad1k/.ssh/levi"
REMOTE="n0mad1k@levi.local"
REMOTE_PATH="/opt/isaac"

echo "=== Deploying to Dev (Isaac) ==="

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

# Restart backend service
echo "Restarting backend..."
ssh -i $SSH_KEY $REMOTE "sudo systemctl restart isaac-backend"

echo "=== Dev Deploy Complete ==="
echo "Test at: https://isaac.local"
echo "Checking backend status..."
ssh -i $SSH_KEY $REMOTE "sudo systemctl status isaac-backend --no-pager | head -10"
