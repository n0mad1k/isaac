#!/bin/bash
# Isaac Farm Assistant - Installation Script for Raspberry Pi
# Run this script on the Raspberry Pi

set -e

echo "======================================"
echo "  Isaac Farm Assistant Installation"
echo "======================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ISAAC_DIR="/opt/isaac"
ISAAC_USER="isaac"
DATA_DIR="/opt/isaac/data"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (sudo)${NC}"
    exit 1
fi

echo -e "${GREEN}[1/8] Updating system packages...${NC}"
apt-get update
apt-get upgrade -y

echo -e "${GREEN}[2/8] Installing dependencies...${NC}"
apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    nodejs \
    npm \
    nginx \
    git \
    curl \
    chromium-browser \
    unclutter

echo -e "${GREEN}[3/8] Creating Isaac user and directories...${NC}"
# Create user if doesn't exist
if ! id "$ISAAC_USER" &>/dev/null; then
    useradd -r -s /bin/bash -d "$ISAAC_DIR" "$ISAAC_USER"
fi

# Create directories
mkdir -p "$ISAAC_DIR"/{backend,frontend,data,logs}
chown -R "$ISAAC_USER:$ISAAC_USER" "$ISAAC_DIR"

echo -e "${GREEN}[4/8] Setting up Python virtual environment...${NC}"
cd "$ISAAC_DIR/backend"
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip

echo -e "${GREEN}[5/8] Installing Python dependencies...${NC}"
pip install -r requirements.txt

echo -e "${GREEN}[6/8] Building frontend...${NC}"
cd "$ISAAC_DIR/frontend"
npm install
npm run build

echo -e "${GREEN}[7/8] Configuring systemd services...${NC}"
# Copy service files
cp "$ISAAC_DIR/deploy/isaac-backend.service" /etc/systemd/system/
cp "$ISAAC_DIR/deploy/isaac-kiosk.service" /etc/systemd/system/

# Reload systemd
systemctl daemon-reload

# Enable services
systemctl enable isaac-backend
systemctl enable isaac-kiosk

echo -e "${GREEN}[8/8] Configuring Nginx...${NC}"
cp "$ISAAC_DIR/deploy/nginx-isaac.conf" /etc/nginx/sites-available/isaac
ln -sf /etc/nginx/sites-available/isaac /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

echo ""
echo -e "${GREEN}======================================"
echo "  Installation Complete!"
echo "======================================${NC}"
echo ""
echo "Next steps:"
echo "1. Copy your .env file to $ISAAC_DIR/backend/.env"
echo "2. Configure your Ambient Weather API keys"
echo "3. Configure your email settings"
echo "4. Start Isaac: sudo systemctl start isaac-backend"
echo "5. Access dashboard at: http://isaac.local"
echo ""
echo "To enable kiosk mode (auto-start dashboard on boot):"
echo "  sudo systemctl start isaac-kiosk"
echo ""
