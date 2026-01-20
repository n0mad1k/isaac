#!/bin/bash
# ============================================
# Isaac/Levi Farm Assistant - Full Setup Script
# ============================================
# Run this script on the Raspberry Pi to set up everything
# Usage: sudo ./setup.sh [--with-cloudflare] [--with-ssl]
#
# Options:
#   --with-cloudflare  Install and configure Cloudflare tunnel
#   --with-ssl         Generate self-signed SSL certificates for local HTTPS

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
LEVI_DIR="/opt/levi"
LEVI_USER="n0mad1k"
DATA_DIR="$LEVI_DIR/data"
LOGS_DIR="$LEVI_DIR/logs"

# Parse arguments
WITH_CLOUDFLARE=false
WITH_SSL=false
for arg in "$@"; do
    case $arg in
        --with-cloudflare) WITH_CLOUDFLARE=true ;;
        --with-ssl) WITH_SSL=true ;;
    esac
done

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root: sudo $0${NC}"
    exit 1
fi

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Isaac/Levi Farm Assistant Setup${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo "Options:"
echo "  Cloudflare Tunnel: $WITH_CLOUDFLARE"
echo "  SSL Certificates:  $WITH_SSL"
echo ""

# ============================================
# Step 1: System Update
# ============================================
echo -e "${GREEN}[1/10] Updating system packages...${NC}"
apt-get update
apt-get upgrade -y

# ============================================
# Step 2: Core Dependencies
# ============================================
echo -e "${GREEN}[2/10] Installing core dependencies...${NC}"
apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    build-essential \
    libffi-dev \
    libssl-dev \
    git \
    curl \
    rsync \
    vim \
    htop \
    sqlite3

# ============================================
# Step 3: Node.js 20.x
# ============================================
echo -e "${GREEN}[3/10] Installing Node.js 20.x...${NC}"
if ! command -v node &> /dev/null || [[ $(node -v) != v20* ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
echo "  Node.js version: $(node -v)"
echo "  npm version: $(npm -v)"

# ============================================
# Step 4: Create Directories
# ============================================
echo -e "${GREEN}[4/10] Creating directories...${NC}"
mkdir -p "$LEVI_DIR"/{backend,frontend,deploy,data,logs,certs}
chown -R "$LEVI_USER:$LEVI_USER" "$LEVI_DIR"

# ============================================
# Step 5: Python Virtual Environment
# ============================================
echo -e "${GREEN}[5/10] Setting up Python virtual environment...${NC}"
cd "$LEVI_DIR/backend"

if [ ! -d "venv" ]; then
    sudo -u "$LEVI_USER" python3 -m venv venv
fi

# Activate and install dependencies
sudo -u "$LEVI_USER" bash -c "
    source venv/bin/activate
    pip install --upgrade pip wheel setuptools
    pip install -r requirements.txt
"

# ============================================
# Step 6: Frontend Build
# ============================================
echo -e "${GREEN}[6/10] Building frontend...${NC}"
cd "$LEVI_DIR/frontend"

if [ -f "package.json" ]; then
    sudo -u "$LEVI_USER" npm install
    sudo -u "$LEVI_USER" npm run build
else
    echo -e "${YELLOW}  Warning: package.json not found, skipping frontend build${NC}"
fi

# ============================================
# Step 7: SSL Certificates (Optional)
# ============================================
if [ "$WITH_SSL" = true ]; then
    echo -e "${GREEN}[7/10] Generating SSL certificates...${NC}"

    CERT_DIR="$LEVI_DIR/certs"

    if [ ! -f "$CERT_DIR/server.crt" ]; then
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout "$CERT_DIR/server.key" \
            -out "$CERT_DIR/server.crt" \
            -subj "/C=US/ST=State/L=City/O=Isaac/CN=levi.local" \
            -addext "subjectAltName=DNS:levi.local,DNS:isaac.local,IP:127.0.0.1"

        chown "$LEVI_USER:$LEVI_USER" "$CERT_DIR"/*
        chmod 600 "$CERT_DIR/server.key"
        echo "  SSL certificates created in $CERT_DIR"
    else
        echo "  SSL certificates already exist"
    fi
else
    echo -e "${YELLOW}[7/10] Skipping SSL certificates (use --with-ssl to enable)${NC}"
fi

# ============================================
# Step 8: Cloudflare Tunnel (Optional)
# ============================================
if [ "$WITH_CLOUDFLARE" = true ]; then
    echo -e "${GREEN}[8/10] Installing Cloudflare Tunnel...${NC}"

    if ! command -v cloudflared &> /dev/null; then
        # Download and install cloudflared for ARM
        ARCH=$(dpkg --print-architecture)
        curl -L "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$ARCH.deb" -o /tmp/cloudflared.deb
        dpkg -i /tmp/cloudflared.deb
        rm /tmp/cloudflared.deb
        echo "  Cloudflared installed: $(cloudflared --version)"
    else
        echo "  Cloudflared already installed: $(cloudflared --version)"
    fi

    echo ""
    echo -e "${YELLOW}  To configure Cloudflare Tunnel:${NC}"
    echo "  1. Get your tunnel token from Cloudflare Zero Trust dashboard"
    echo "  2. Run: sudo cloudflared service install <YOUR_TOKEN>"
    echo "  3. Or add CLOUDFLARE_TUNNEL_TOKEN to .env and use the service file"
else
    echo -e "${YELLOW}[8/10] Skipping Cloudflare Tunnel (use --with-cloudflare to enable)${NC}"
fi

# ============================================
# Step 9: Systemd Services
# ============================================
echo -e "${GREEN}[9/10] Configuring systemd services...${NC}"

# Main backend service
cat > /etc/systemd/system/levi-backend.service << 'EOF'
[Unit]
Description=Levi Farm Assistant Backend
After=network.target

[Service]
Type=simple
User=n0mad1k
Group=n0mad1k
WorkingDirectory=/opt/levi/backend
Environment="PATH=/opt/levi/backend/venv/bin"
ExecStart=/opt/levi/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Dev/Isaac backend service (port 8001)
cat > /etc/systemd/system/isaac-backend.service << 'EOF'
[Unit]
Description=Isaac Farm Assistant Backend (Dev)
After=network.target

[Service]
Type=simple
User=n0mad1k
Group=n0mad1k
WorkingDirectory=/opt/isaac/backend
Environment="PATH=/opt/isaac/backend/venv/bin"
ExecStart=/opt/isaac/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Cloudflare tunnel service (if token provided in .env)
cat > /etc/systemd/system/cloudflared.service << 'EOF'
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/cloudflared tunnel run
Restart=always
RestartSec=10
EnvironmentFile=/opt/levi/backend/.env

[Install]
WantedBy=multi-user.target
EOF

# Kiosk mode service
cat > /etc/systemd/system/levi-kiosk.service << 'EOF'
[Unit]
Description=Levi Kiosk Mode
After=graphical.target

[Service]
Type=simple
User=n0mad1k
Environment=DISPLAY=:0
ExecStartPre=/bin/sleep 10
ExecStart=/opt/levi/deploy/kiosk.sh
Restart=on-failure

[Install]
WantedBy=graphical.target
EOF

systemctl daemon-reload
systemctl enable levi-backend

echo "  Services configured"

# ============================================
# Step 10: Environment Configuration
# ============================================
echo -e "${GREEN}[10/10] Finalizing configuration...${NC}"

# Create .env if it doesn't exist
if [ ! -f "$LEVI_DIR/backend/.env" ]; then
    if [ -f "$LEVI_DIR/backend/.env.example" ]; then
        cp "$LEVI_DIR/backend/.env.example" "$LEVI_DIR/backend/.env"
        chown "$LEVI_USER:$LEVI_USER" "$LEVI_DIR/backend/.env"
        chmod 600 "$LEVI_DIR/backend/.env"
        echo -e "${YELLOW}  Created .env from template - please configure it!${NC}"
    fi
fi

# Set timezone
timedatectl set-timezone America/New_York

# Final permissions
chown -R "$LEVI_USER:$LEVI_USER" "$LEVI_DIR"

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Next steps:"
echo ""
echo -e "${BLUE}1. Configure your .env file:${NC}"
echo "   nano $LEVI_DIR/backend/.env"
echo ""
echo -e "${BLUE}2. Required settings to configure:${NC}"
echo "   - AWN_API_KEY and AWN_APP_KEY (weather)"
echo "   - SMTP settings (email notifications)"
echo "   - LATITUDE and LONGITUDE (your location)"
echo ""
echo -e "${BLUE}3. Optional settings:${NC}"
echo "   - DEEPL_API_KEY (translation for workers)"
echo "   - CLOUDFLARE_TUNNEL_TOKEN (remote access)"
echo "   - CALDAV settings (calendar sync)"
echo ""
echo -e "${BLUE}4. Start the backend:${NC}"
echo "   sudo systemctl start levi-backend"
echo ""
echo -e "${BLUE}5. Access the dashboard:${NC}"
echo "   http://levi.local:8000"
echo ""
if [ "$WITH_CLOUDFLARE" = true ]; then
    echo -e "${BLUE}6. For Cloudflare Tunnel:${NC}"
    echo "   sudo cloudflared service install <YOUR_TOKEN>"
    echo ""
fi
echo "View logs: journalctl -u levi-backend -f"
echo ""
