#!/bin/bash
# =============================================================================
# Isaac Installation Script
# =============================================================================
# Full installation for Raspberry Pi, VM, or cloud server
# Installs dependencies, builds, configures, and prompts for settings
#
# Usage: sudo bash install.sh
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
prompt() { echo -e "${CYAN}${BOLD}$1${NC}"; }

# Configuration
INSTALL_DIR="/opt/isaac"
REPO_URL="https://github.com/n0mad1k/isaac.git"
CURRENT_USER="${SUDO_USER:-$USER}"

clear
echo ""
echo -e "${GREEN}========================================"
echo "     Isaac Farm Assistant Installer"
echo "========================================${NC}"
echo ""

# Check if running as root/sudo
if [ "$EUID" -ne 0 ]; then
    log_error "Please run with sudo: sudo bash $0"
    exit 1
fi

# Check for interactive terminal
if [ -t 0 ]; then
    INTERACTIVE=true
else
    INTERACTIVE=false
    log_warn "Non-interactive mode - using defaults"
fi

# =============================================================================
# Gather configuration
# =============================================================================
if [ "$INTERACTIVE" = true ]; then
    echo -e "${BOLD}Let's configure your Isaac installation.${NC}"
    echo ""

    # Timezone
    CURRENT_TZ=$(timedatectl show --property=Timezone --value 2>/dev/null || echo "America/New_York")
    prompt "Timezone [$CURRENT_TZ]: "
    read -r INPUT_TZ
    TIMEZONE="${INPUT_TZ:-$CURRENT_TZ}"

    # Location for weather
    prompt "Latitude (for weather/sunrise) [40.7128]: "
    read -r INPUT_LAT
    LATITUDE="${INPUT_LAT:-40.7128}"

    prompt "Longitude [-74.0060]: "
    read -r INPUT_LON
    LONGITUDE="${INPUT_LON:-74.0060}"

    # Farm name
    prompt "Farm/Homestead name [My Farm]: "
    read -r INPUT_FARM
    FARM_NAME="${INPUT_FARM:-My Farm}"

    echo ""
    echo -e "${YELLOW}Optional integrations (press Enter to skip):${NC}"

    # Email (optional)
    prompt "SMTP Host (for email alerts) []: "
    read -r SMTP_HOST

    if [ -n "$SMTP_HOST" ]; then
        prompt "SMTP Port [587]: "
        read -r INPUT_PORT
        SMTP_PORT="${INPUT_PORT:-587}"

        prompt "SMTP Username/Email: "
        read -r SMTP_USER

        prompt "SMTP Password: "
        read -rs SMTP_PASS
        echo ""
    fi

    # Weather API (optional)
    prompt "Ambient Weather API Key []: "
    read -r AWN_API_KEY

    if [ -n "$AWN_API_KEY" ]; then
        prompt "Ambient Weather App Key: "
        read -r AWN_APP_KEY
    fi

    echo ""
else
    # Defaults for non-interactive
    TIMEZONE="America/New_York"
    LATITUDE="40.7128"
    LONGITUDE="-74.0060"
    FARM_NAME="My Farm"
fi

echo -e "${BOLD}Installing Isaac...${NC}"
echo ""

# =============================================================================
# Step 1: Update system
# =============================================================================
log_info "[1/8] Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
log_success "System updated"

# =============================================================================
# Step 2: Install dependencies
# =============================================================================
log_info "[2/8] Installing dependencies..."

apt-get install -y -qq \
    python3 \
    python3-pip \
    python3-venv \
    nginx \
    git \
    curl \
    rsync \
    sqlite3

# Install Node.js 20.x if not present or outdated
if ! command -v node &> /dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 18 ]]; then
    log_info "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x 2>/dev/null | bash - >/dev/null 2>&1
    apt-get install -y -qq nodejs
fi

log_success "Dependencies installed"

# =============================================================================
# Step 3: Create directories
# =============================================================================
log_info "[3/8] Creating directories..."

mkdir -p "$INSTALL_DIR"/{backend,frontend,deploy,data,logs}
chown -R "$CURRENT_USER:$CURRENT_USER" "$INSTALL_DIR"

log_success "Directories created"

# =============================================================================
# Step 4: Clone or update repository
# =============================================================================
log_info "[4/8] Setting up repository..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"

if [ -f "$SCRIPT_DIR/../backend/requirements.txt" ]; then
    # Running from within repo - copy files
    REPO_DIR="$(dirname "$SCRIPT_DIR")"
    if [ "$REPO_DIR" != "$INSTALL_DIR" ]; then
        rsync -a --exclude='venv' --exclude='node_modules' --exclude='dist' \
              --exclude='*.db' --exclude='.env' --exclude='__pycache__' \
              --exclude='logs/*' --exclude='data/*' --exclude='.git' \
              "$REPO_DIR/" "$INSTALL_DIR/"
        chown -R "$CURRENT_USER:$CURRENT_USER" "$INSTALL_DIR"
    fi
elif [ -d "$INSTALL_DIR/.git" ]; then
    cd "$INSTALL_DIR"
    sudo -u "$CURRENT_USER" git pull -q
else
    rm -rf "$INSTALL_DIR"/* 2>/dev/null || true
    sudo -u "$CURRENT_USER" git clone -q "$REPO_URL" "$INSTALL_DIR"
fi

log_success "Repository ready"

# =============================================================================
# Step 5: Setup Python backend
# =============================================================================
log_info "[5/8] Setting up Python backend..."

cd "$INSTALL_DIR/backend"

if [ ! -d "venv" ]; then
    sudo -u "$CURRENT_USER" python3 -m venv venv
fi

sudo -u "$CURRENT_USER" bash -c "source venv/bin/activate && pip install --upgrade pip -q && pip install -r requirements.txt -q"

# Create .env with user settings
cat > .env << EOF
# Isaac Configuration
# Generated by install.sh on $(date)

# Location
TIMEZONE=$TIMEZONE
LATITUDE=$LATITUDE
LONGITUDE=$LONGITUDE

# Weather API (Ambient Weather)
AWN_API_KEY=${AWN_API_KEY:-}
AWN_APP_KEY=${AWN_APP_KEY:-}

# Email Notifications
SMTP_HOST=${SMTP_HOST:-}
SMTP_PORT=${SMTP_PORT:-587}
SMTP_USER=${SMTP_USER:-}
SMTP_PASSWORD=${SMTP_PASS:-}

# Security (auto-generated)
SECRET_KEY=$(openssl rand -hex 32)
EOF

chown "$CURRENT_USER:$CURRENT_USER" .env
chmod 600 .env

log_success "Backend configured"

# =============================================================================
# Step 6: Build frontend
# =============================================================================
log_info "[6/8] Building frontend (this may take a few minutes)..."

cd "$INSTALL_DIR/frontend"

sudo -u "$CURRENT_USER" npm install --silent 2>/dev/null || sudo -u "$CURRENT_USER" npm install
sudo -u "$CURRENT_USER" npm run build 2>/dev/null || sudo -u "$CURRENT_USER" npm run build

log_success "Frontend built"

# =============================================================================
# Step 7: Configure systemd service
# =============================================================================
log_info "[7/8] Configuring systemd service..."

cat > /etc/systemd/system/isaac-backend.service << EOF
[Unit]
Description=Isaac Farm Assistant Backend
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
Group=$CURRENT_USER
WorkingDirectory=$INSTALL_DIR/backend
Environment=PATH=$INSTALL_DIR/backend/venv/bin:/usr/bin
ExecStart=$INSTALL_DIR/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5
StandardOutput=append:$INSTALL_DIR/logs/backend.log
StandardError=append:$INSTALL_DIR/logs/backend-error.log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable isaac-backend -q

log_success "Systemd service configured"

# =============================================================================
# Step 8: Configure nginx
# =============================================================================
log_info "[8/8] Configuring nginx..."

cat > /etc/nginx/sites-available/isaac << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /opt/isaac/frontend/dist;
    index index.html;

    location ^~ /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1d;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
}
EOF

ln -sf /etc/nginx/sites-available/isaac /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t -q
systemctl restart nginx

log_success "Nginx configured"

# =============================================================================
# Set timezone and start
# =============================================================================
timedatectl set-timezone "$TIMEZONE" 2>/dev/null || true

log_info "Starting Isaac..."
systemctl start isaac-backend
sleep 3

# Get IP address
IP_ADDR=$(hostname -I | awk '{print $1}')

# =============================================================================
# Done!
# =============================================================================
clear
echo ""
echo -e "${GREEN}========================================"
echo "     Installation Complete!"
echo "========================================${NC}"
echo ""
echo -e "  ${BOLD}Dashboard:${NC}  http://$IP_ADDR"
echo -e "  ${BOLD}API Docs:${NC}   http://$IP_ADDR/api/docs"
echo ""
if systemctl is-active --quiet isaac-backend; then
    echo -e "  ${GREEN}Backend Status: Running${NC}"
else
    echo -e "  ${RED}Backend Status: Not Running${NC}"
    echo "  Check logs: sudo journalctl -u isaac-backend -f"
fi
echo ""
echo -e "  ${BOLD}Open your browser and create an admin account!${NC}"
echo ""
echo "  Useful commands:"
echo "    sudo systemctl status isaac-backend"
echo "    sudo systemctl restart isaac-backend"
echo "    tail -f $INSTALL_DIR/logs/backend.log"
echo ""
