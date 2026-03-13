#!/bin/bash
# Deploy Isaac to Raspberry Pi
# Run this from your development machine

set -e

# Configuration
PI_HOST="test-isaac.local"
PI_USER="n0mad1k"
SSH_KEY="$HOME/.ssh/test-isaac"
REMOTE_DIR="/opt/isaac"
LOCAL_DIR="$(dirname "$0")/.."

echo "======================================"
echo "  Deploying Isaac to Raspberry Pi"
echo "======================================"
echo "Host: $PI_HOST"
echo "User: $PI_USER"
echo ""

# Check SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    echo "Error: SSH key not found at $SSH_KEY"
    exit 1
fi

# Test connection
echo "[1/6] Testing SSH connection..."
ssh -i "$SSH_KEY" -o ConnectTimeout=10 "$PI_USER@$PI_HOST" "echo 'Connected!'" || {
    echo "Error: Cannot connect to $PI_HOST"
    exit 1
}

echo "[2/7] Installing system dependencies..."
ssh -i "$SSH_KEY" "$PI_USER@$PI_HOST" << 'DEPS_SCRIPT'
# Check and install required system packages
MISSING=""
dpkg -s python3-dev &>/dev/null || MISSING="$MISSING python3-dev"
dpkg -s gcc &>/dev/null || MISSING="$MISSING gcc"
command -v node &>/dev/null || MISSING="$MISSING nodejs"

if [ -n "$MISSING" ]; then
    echo "Installing missing packages:$MISSING"
    # Add NodeSource repo if nodejs is needed and not available
    if echo "$MISSING" | grep -q nodejs && ! apt-cache show nodejs 2>/dev/null | grep -q nodesource; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    fi
    sudo apt-get install -y $MISSING
else
    echo "All system dependencies present."
fi
DEPS_SCRIPT

echo "[3/7] Creating remote directories..."
ssh -i "$SSH_KEY" "$PI_USER@$PI_HOST" "sudo mkdir -p $REMOTE_DIR/{backend,frontend,deploy,data,logs} && sudo chown -R $PI_USER:$PI_USER $REMOTE_DIR"

echo "[4/7] Syncing backend files..."
rsync -avz --delete \
    -e "ssh -i $SSH_KEY" \
    --exclude '__pycache__' \
    --exclude '*.pyc' \
    --exclude 'venv' \
    --exclude '.env' \
    --exclude '*.db' \
    "$LOCAL_DIR/backend/" \
    "$PI_USER@$PI_HOST:$REMOTE_DIR/backend/"

echo "[5/7] Syncing frontend files..."
rsync -avz --delete \
    -e "ssh -i $SSH_KEY" \
    --exclude 'node_modules' \
    --exclude 'dist' \
    "$LOCAL_DIR/frontend/" \
    "$PI_USER@$PI_HOST:$REMOTE_DIR/frontend/"

echo "[6/7] Syncing deployment files..."
rsync -avz \
    -e "ssh -i $SSH_KEY" \
    "$LOCAL_DIR/deploy/" \
    "$PI_USER@$PI_HOST:$REMOTE_DIR/deploy/"

echo "[7/7] Running remote setup..."
ssh -i "$SSH_KEY" "$PI_USER@$PI_HOST" << 'REMOTE_SCRIPT'
set -e
cd /opt/isaac

# Make scripts executable
chmod +x deploy/*.sh

# Check if first install
if [ ! -d "backend/venv" ]; then
    echo "First install detected - running full setup..."

    # Create Python venv
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    cd ..

    # Build frontend
    cd frontend
    npm install
    npm run build
    cd ..

    # Copy .env template if not exists
    if [ ! -f "backend/.env" ]; then
        cp backend/.env.example backend/.env
        echo "Created .env file - please configure it!"
    fi
else
    echo "Updating existing installation..."

    # Update Python deps
    cd backend
    source venv/bin/activate
    pip install -r requirements.txt
    cd ..

    # Rebuild frontend
    cd frontend
    npm install
    npm run build
    cd ..
fi

# Setup systemd services if not done
if [ ! -f "/etc/systemd/system/isaac-backend.service" ]; then
    echo "Setting up systemd services..."
    sudo cp deploy/isaac-backend.service /etc/systemd/system/
    sudo cp deploy/isaac-kiosk.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable isaac-backend
fi

# Restart backend service
echo "Restarting Isaac backend..."
sudo systemctl restart isaac-backend || sudo systemctl start isaac-backend

echo "Deployment complete!"
REMOTE_SCRIPT

echo ""
echo "======================================"
echo "  Deployment Complete!"
echo "======================================"
echo ""
echo "Dashboard: http://$PI_HOST"
echo "API Docs:  http://$PI_HOST/api/docs"
echo ""
echo "Next steps:"
echo "1. SSH into the Pi: ssh -i $SSH_KEY $PI_USER@$PI_HOST"
echo "2. Configure .env: nano $REMOTE_DIR/backend/.env"
echo "3. Restart: sudo systemctl restart isaac-backend"
echo ""
