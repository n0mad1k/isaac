#!/bin/bash
# Quick Deploy Script for Levi
# Run this from your local machine as your user (not root)

set -e

PI_HOST="levi"
LEVI_DIR="/home/n0mad1k/Tools/levi"

echo "======================================"
echo "  Levi Quick Deploy"
echo "======================================"

# Step 1: Copy SSH key to Pi if needed
echo ""
echo "[Step 1] Checking SSH key setup..."
if ! ssh -o BatchMode=yes -o ConnectTimeout=5 $PI_HOST "echo ok" 2>/dev/null; then
    echo "SSH key not set up. Copying public key to Pi..."
    echo "You'll need to enter the Pi's password:"
    ssh-copy-id -i ~/.ssh/levi $PI_HOST
fi

echo ""
echo "[Step 2] Creating directories on Pi..."
ssh $PI_HOST "sudo mkdir -p /opt/levi/{backend,frontend,deploy,data,logs} && sudo chown -R n0mad1k:n0mad1k /opt/levi"

echo ""
echo "[Step 3] Installing dependencies on Pi..."
ssh $PI_HOST << 'DEPS'
set -e
echo "Updating packages..."
sudo apt-get update

echo "Installing Python, Node, Nginx..."
sudo apt-get install -y python3 python3-pip python3-venv nginx git curl rsync

# Check if Node.js is installed
if ! command -v node &> /dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 18 ]]; then
    echo "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "Installing kiosk dependencies..."
sudo apt-get install -y chromium-browser unclutter xdotool

echo "Dependencies installed!"
DEPS

echo ""
echo "[Step 4] Syncing files to Pi..."
rsync -avz --delete \
    --exclude '__pycache__' \
    --exclude '*.pyc' \
    --exclude 'venv' \
    --exclude '.env' \
    --exclude '*.db' \
    --exclude 'node_modules' \
    --exclude 'dist' \
    "$LEVI_DIR/backend/" \
    "$PI_HOST:/opt/levi/backend/"

rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude 'dist' \
    "$LEVI_DIR/frontend/" \
    "$PI_HOST:/opt/levi/frontend/"

rsync -avz \
    "$LEVI_DIR/deploy/" \
    "$PI_HOST:/opt/levi/deploy/"

echo ""
echo "[Step 5] Setting up Python environment and building frontend..."
ssh $PI_HOST << 'BUILD'
set -e
cd /opt/levi

# Python setup
if [ ! -d "backend/venv" ]; then
    echo "Creating Python virtual environment..."
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    cd ..
else
    echo "Updating Python dependencies..."
    cd backend
    source venv/bin/activate
    pip install -r requirements.txt
    cd ..
fi

# Create .env if missing
if [ ! -f "backend/.env" ]; then
    cp backend/.env.example backend/.env
    echo "Created .env from template"
fi

# Create logs directory
mkdir -p backend/logs

# Frontend build
echo "Building frontend..."
cd frontend
npm install
npm run build
cd ..

echo "Build complete!"
BUILD

echo ""
echo "[Step 6] Setting up systemd services..."
ssh $PI_HOST << 'SERVICES'
set -e

# Copy service files
sudo cp /opt/levi/deploy/levi-backend.service /etc/systemd/system/
sudo cp /opt/levi/deploy/levi-kiosk.service /etc/systemd/system/

# Make kiosk script executable
sudo chmod +x /opt/levi/deploy/kiosk.sh

# Reload systemd
sudo systemctl daemon-reload

# Enable backend service
sudo systemctl enable levi-backend

echo "Services configured!"
SERVICES

echo ""
echo "[Step 7] Configuring Nginx..."
ssh $PI_HOST << 'NGINX'
set -e

# Copy nginx config
sudo cp /opt/levi/deploy/nginx-levi.conf /etc/nginx/sites-available/levi
sudo ln -sf /etc/nginx/sites-available/levi /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and restart nginx
sudo nginx -t
sudo systemctl restart nginx

echo "Nginx configured!"
NGINX

echo ""
echo "[Step 8] Starting Levi backend..."
ssh $PI_HOST "sudo systemctl restart levi-backend && sleep 2 && sudo systemctl status levi-backend --no-pager"

echo ""
echo "======================================"
echo "  Deployment Complete!"
echo "======================================"
echo ""
echo "Dashboard: http://levi.local"
echo "API Docs:  http://levi.local/api/docs"
echo ""
echo "Next: Configure .env and start kiosk mode"
echo "  ssh levi"
echo "  nano /opt/levi/backend/.env"
echo "  sudo systemctl start levi-kiosk"
echo ""
