#!/bin/bash
# Initial Raspberry Pi Setup for Levi
# Run this ON the Raspberry Pi ONCE after first boot

set -e

echo "======================================"
echo "  Raspberry Pi Initial Setup for Levi"
echo "======================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if running as sudo
if [ "$EUID" -ne 0 ]; then
    echo "Please run with sudo: sudo $0"
    exit 1
fi

echo -e "${GREEN}[1/7] Updating system...${NC}"
apt-get update && apt-get upgrade -y

echo -e "${GREEN}[2/7] Installing core dependencies...${NC}"
apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    nginx \
    git \
    curl \
    rsync \
    vim \
    htop

echo -e "${GREEN}[3/7] Installing Node.js 20.x...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo -e "${GREEN}[4/7] Installing kiosk mode dependencies...${NC}"
apt-get install -y \
    chromium-browser \
    unclutter \
    xdotool

echo -e "${GREEN}[5/7] Creating Levi directories...${NC}"
mkdir -p /opt/levi/{backend,frontend,deploy,data,logs}
chown -R n0mad1k:n0mad1k /opt/levi

echo -e "${GREEN}[6/7] Configuring system for kiosk mode...${NC}"
# Disable screen blanking
cat >> /etc/xdg/lxsession/LXDE-pi/autostart << 'EOF'
@xset s off
@xset -dpms
@xset s noblank
EOF

# Configure boot to desktop (autologin)
raspi-config nonint do_boot_behaviour B4

echo -e "${GREEN}[7/7] Setting timezone to Eastern...${NC}"
timedatectl set-timezone America/New_York

echo ""
echo -e "${GREEN}======================================"
echo "  Initial Setup Complete!"
echo "======================================${NC}"
echo ""
echo -e "${YELLOW}The Pi is ready for Levi deployment.${NC}"
echo ""
echo "From your development machine, run:"
echo "  ./scripts/deploy-to-pi.sh"
echo ""
echo "After deployment, configure:"
echo "  nano /opt/levi/backend/.env"
echo ""
echo "Then start Levi:"
echo "  sudo systemctl start levi-backend"
echo ""
echo "Reboot is recommended to apply all changes:"
echo "  sudo reboot"
echo ""
