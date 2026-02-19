#!/bin/bash
# =============================================================================
# Isaac Installation Script (Private)
# =============================================================================
# Full installation with all integrations:
# - Tailscale VPN
# - Cloudflare Tunnel
# - Email (SMTP)
# - AI Assistant (Claude/OpenAI/Ollama)
# - Weather (Ambient Weather)
# - Translation (LibreTranslate)
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
prompt() { echo -en "${CYAN}${BOLD}$1${NC}"; }
section() { echo -e "\n${BOLD}== $1 ==${NC}\n"; }

# Configuration
INSTALL_DIR="/opt/isaac"
REPO_URL="https://github.com/n0mad1k/isaac.git"
CURRENT_USER="${SUDO_USER:-$USER}"

clear
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗"
echo "║    Isaac Farm Assistant Installer      ║"
echo "║           (Full Setup)                 ║"
echo "╚════════════════════════════════════════╝${NC}"
echo ""

# Check if running as root/sudo
if [ "$EUID" -ne 0 ]; then
    log_error "Please run with sudo: sudo bash $0"
    exit 1
fi

# =============================================================================
# Gather ALL configuration upfront
# =============================================================================

section "Basic Information"

prompt "Farm/Homestead name [My Farm]: "
read -r FARM_NAME
FARM_NAME="${FARM_NAME:-My Farm}"

CURRENT_TZ=$(timedatectl show --property=Timezone --value 2>/dev/null || echo "America/New_York")
prompt "Timezone [$CURRENT_TZ]: "
read -r TIMEZONE
TIMEZONE="${TIMEZONE:-$CURRENT_TZ}"

prompt "Latitude (for weather/sunrise) [40.7128]: "
read -r LATITUDE
LATITUDE="${LATITUDE:-40.7128}"

prompt "Longitude [-74.0060]: "
read -r LONGITUDE
LONGITUDE="${LONGITUDE:--74.0060}"

# -----------------------------------------------------------------------------
section "Tailscale VPN"
echo "Tailscale provides secure remote access to your Isaac dashboard."
echo ""

prompt "Install Tailscale? (Y/n): "
read -r INSTALL_TAILSCALE
INSTALL_TAILSCALE="${INSTALL_TAILSCALE:-Y}"

# -----------------------------------------------------------------------------
section "Cloudflare Tunnel"
echo "Cloudflare Tunnel provides secure HTTPS access without port forwarding."
echo ""

prompt "Install Cloudflare Tunnel? (y/N): "
read -r INSTALL_CLOUDFLARE

if [[ "$INSTALL_CLOUDFLARE" =~ ^[Yy] ]]; then
    prompt "Cloudflare Tunnel Token: "
    read -r CF_TUNNEL_TOKEN
fi

# -----------------------------------------------------------------------------
section "Email Notifications"
echo "For daily digests, weather alerts, and task reminders."
echo ""

prompt "SMTP Host (e.g., smtp.gmail.com) [skip]: "
read -r SMTP_HOST

if [ -n "$SMTP_HOST" ]; then
    prompt "SMTP Port [587]: "
    read -r SMTP_PORT
    SMTP_PORT="${SMTP_PORT:-587}"

    prompt "SMTP Username/Email: "
    read -r SMTP_USER

    prompt "SMTP Password: "
    read -rs SMTP_PASS
    echo ""

    prompt "Default recipient email: "
    read -r EMAIL_RECIPIENT
fi

# -----------------------------------------------------------------------------
section "AI Assistant"
echo "Built-in AI chat for farm questions and insights."
echo "Options: Claude (Anthropic), ChatGPT (OpenAI), or Ollama (local)"
echo ""

prompt "AI Provider (claude/openai/ollama/skip) [skip]: "
read -r AI_PROVIDER

case "$AI_PROVIDER" in
    claude|Claude|CLAUDE)
        prompt "Anthropic API Key: "
        read -r ANTHROPIC_API_KEY
        AI_PROVIDER="claude"
        ;;
    openai|OpenAI|OPENAI|chatgpt)
        prompt "OpenAI API Key: "
        read -r OPENAI_API_KEY
        AI_PROVIDER="openai"
        ;;
    ollama|Ollama|OLLAMA)
        prompt "Ollama URL [http://localhost:11434]: "
        read -r OLLAMA_URL
        OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
        AI_PROVIDER="ollama"
        ;;
    *)
        AI_PROVIDER=""
        ;;
esac

# -----------------------------------------------------------------------------
section "Weather Station"
echo "Connect your Ambient Weather station for local conditions."
echo "Get keys from: https://ambientweather.net/account"
echo ""

prompt "Ambient Weather API Key [skip]: "
read -r AWN_API_KEY

if [ -n "$AWN_API_KEY" ]; then
    prompt "Ambient Weather App Key: "
    read -r AWN_APP_KEY
fi

# -----------------------------------------------------------------------------
section "Translation Service"
echo "For translating worker task lists (Spanish, etc.)"
echo "Options: LibreTranslate (local) or skip"
echo ""

prompt "Install LibreTranslate for worker translations? (y/N): "
read -r INSTALL_TRANSLATE

# =============================================================================
# Confirmation
# =============================================================================
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Configuration Summary:${NC}"
echo "  Farm: $FARM_NAME"
echo "  Location: $LATITUDE, $LONGITUDE ($TIMEZONE)"
echo "  Tailscale: $([[ "$INSTALL_TAILSCALE" =~ ^[Yy] ]] && echo "Yes" || echo "No")"
echo "  Cloudflare: $([[ "$INSTALL_CLOUDFLARE" =~ ^[Yy] ]] && echo "Yes" || echo "No")"
echo "  Email: $([ -n "$SMTP_HOST" ] && echo "$SMTP_HOST" || echo "Not configured")"
echo "  AI: $([ -n "$AI_PROVIDER" ] && echo "$AI_PROVIDER" || echo "Not configured")"
echo "  Weather: $([ -n "$AWN_API_KEY" ] && echo "Ambient Weather" || echo "Not configured")"
echo "  Translation: $([[ "$INSTALL_TRANSLATE" =~ ^[Yy] ]] && echo "LibreTranslate" || echo "No")"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

prompt "Proceed with installation? (Y/n): "
read -r CONFIRM
if [[ "$CONFIRM" =~ ^[Nn] ]]; then
    echo "Installation cancelled."
    exit 0
fi

echo ""
echo -e "${BOLD}Starting installation...${NC}"
echo ""

# =============================================================================
# Step 1: Update system
# =============================================================================
log_info "[1/10] Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
log_success "System updated"

# =============================================================================
# Step 2: Install core dependencies
# =============================================================================
log_info "[2/10] Installing core dependencies..."

apt-get install -y -qq \
    python3 \
    python3-pip \
    python3-venv \
    nginx \
    git \
    curl \
    rsync \
    sqlite3 \
    openssl

# Node.js 20.x
if ! command -v node &> /dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 18 ]]; then
    log_info "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x 2>/dev/null | bash - >/dev/null 2>&1
    apt-get install -y -qq nodejs
fi

log_success "Core dependencies installed"

# =============================================================================
# Step 3: Install Tailscale
# =============================================================================
if [[ "$INSTALL_TAILSCALE" =~ ^[Yy] ]]; then
    log_info "[3/10] Installing Tailscale..."

    if ! command -v tailscale &> /dev/null; then
        curl -fsSL https://tailscale.com/install.sh | sh >/dev/null 2>&1
    fi

    log_success "Tailscale installed"
    log_warn "Run 'sudo tailscale up' after installation to connect"
else
    log_info "[3/10] Skipping Tailscale..."
fi

# =============================================================================
# Step 4: Install Cloudflare Tunnel
# =============================================================================
if [[ "$INSTALL_CLOUDFLARE" =~ ^[Yy] ]] && [ -n "$CF_TUNNEL_TOKEN" ]; then
    log_info "[4/10] Installing Cloudflare Tunnel..."

    if ! command -v cloudflared &> /dev/null; then
        curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
        echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | tee /etc/apt/sources.list.d/cloudflared.list >/dev/null
        apt-get update -qq
        apt-get install -y -qq cloudflared
    fi

    # Install as service
    cloudflared service install "$CF_TUNNEL_TOKEN" 2>/dev/null || true

    log_success "Cloudflare Tunnel installed"
else
    log_info "[4/10] Skipping Cloudflare Tunnel..."
fi

# =============================================================================
# Step 5: Install LibreTranslate
# =============================================================================
if [[ "$INSTALL_TRANSLATE" =~ ^[Yy] ]]; then
    log_info "[5/10] Installing LibreTranslate..."

    # Install Docker if not present
    if ! command -v docker &> /dev/null; then
        curl -fsSL https://get.docker.com | sh >/dev/null 2>&1
        usermod -aG docker "$CURRENT_USER"
    fi

    # Pull and run LibreTranslate
    docker pull libretranslate/libretranslate:latest >/dev/null 2>&1

    # Create systemd service for LibreTranslate
    cat > /etc/systemd/system/libretranslate.service << 'EOF'
[Unit]
Description=LibreTranslate
After=docker.service
Requires=docker.service

[Service]
Restart=always
ExecStartPre=-/usr/bin/docker stop libretranslate
ExecStartPre=-/usr/bin/docker rm libretranslate
ExecStart=/usr/bin/docker run --name libretranslate -p 5000:5000 libretranslate/libretranslate
ExecStop=/usr/bin/docker stop libretranslate

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable libretranslate -q

    TRANSLATE_URL="http://localhost:5000"
    log_success "LibreTranslate installed"
else
    log_info "[5/10] Skipping LibreTranslate..."
    TRANSLATE_URL=""
fi

# =============================================================================
# Step 6: Create directories & clone repo
# =============================================================================
log_info "[6/10] Setting up Isaac..."

mkdir -p "$INSTALL_DIR"/{backend,frontend,deploy,data,logs}
chown -R "$CURRENT_USER:$CURRENT_USER" "$INSTALL_DIR"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"

if [ -f "$SCRIPT_DIR/../backend/requirements.txt" ]; then
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
# Step 7: Setup Python backend
# =============================================================================
log_info "[7/10] Setting up Python backend..."

cd "$INSTALL_DIR/backend"

if [ ! -d "venv" ]; then
    sudo -u "$CURRENT_USER" python3 -m venv venv
fi

sudo -u "$CURRENT_USER" bash -c "source venv/bin/activate && pip install --upgrade pip -q && pip install -r requirements.txt -q"

# Generate secret key
SECRET_KEY=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Create comprehensive .env
cat > .env << EOF
# =============================================================================
# Isaac Configuration
# Generated by install.sh on $(date)
# =============================================================================

# -----------------------------------------------------------------------------
# Location & Time
# -----------------------------------------------------------------------------
TIMEZONE=$TIMEZONE
LATITUDE=$LATITUDE
LONGITUDE=$LONGITUDE

# -----------------------------------------------------------------------------
# Security
# -----------------------------------------------------------------------------
SECRET_KEY=$SECRET_KEY
ENCRYPTION_KEY=$ENCRYPTION_KEY

# -----------------------------------------------------------------------------
# Weather - Ambient Weather
# https://ambientweather.net/account
# -----------------------------------------------------------------------------
AWN_API_KEY=${AWN_API_KEY:-}
AWN_APP_KEY=${AWN_APP_KEY:-}

# -----------------------------------------------------------------------------
# Email Notifications (SMTP)
# -----------------------------------------------------------------------------
SMTP_HOST=${SMTP_HOST:-}
SMTP_PORT=${SMTP_PORT:-587}
SMTP_USER=${SMTP_USER:-}
SMTP_PASSWORD=${SMTP_PASS:-}
EMAIL_RECIPIENT=${EMAIL_RECIPIENT:-}

# -----------------------------------------------------------------------------
# AI Assistant
# Supported: claude, openai, ollama
# -----------------------------------------------------------------------------
AI_PROVIDER=${AI_PROVIDER:-}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
OPENAI_API_KEY=${OPENAI_API_KEY:-}
OLLAMA_URL=${OLLAMA_URL:-}

# -----------------------------------------------------------------------------
# Translation Service (LibreTranslate)
# -----------------------------------------------------------------------------
TRANSLATE_URL=${TRANSLATE_URL:-}

# -----------------------------------------------------------------------------
# CalDAV Calendar Sync
# Configure in Settings UI after install
# -----------------------------------------------------------------------------
# CALDAV_URL=
# CALDAV_USERNAME=
# CALDAV_PASSWORD=
EOF

chown "$CURRENT_USER:$CURRENT_USER" .env
chmod 600 .env

log_success "Backend configured"

# =============================================================================
# Step 8: Build frontend
# =============================================================================
log_info "[8/10] Building frontend..."

cd "$INSTALL_DIR/frontend"

sudo -u "$CURRENT_USER" npm install --silent 2>/dev/null || sudo -u "$CURRENT_USER" npm install
sudo -u "$CURRENT_USER" npm run build 2>/dev/null || sudo -u "$CURRENT_USER" npm run build

log_success "Frontend built"

# =============================================================================
# Step 9: Configure systemd & nginx
# =============================================================================
log_info "[9/10] Configuring services..."

# Systemd service
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

# Nginx config
cat > /etc/nginx/sites-available/isaac << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /opt/isaac/frontend/dist;
    index index.html;

    client_max_body_size 50M;

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

systemctl daemon-reload
systemctl enable isaac-backend -q
nginx -t -q
systemctl restart nginx

log_success "Services configured"

# =============================================================================
# Step 10: Start everything
# =============================================================================
log_info "[10/10] Starting services..."

timedatectl set-timezone "$TIMEZONE" 2>/dev/null || true

systemctl start isaac-backend
[[ "$INSTALL_TRANSLATE" =~ ^[Yy] ]] && systemctl start libretranslate

sleep 3

IP_ADDR=$(hostname -I | awk '{print $1}')

# =============================================================================
# Done!
# =============================================================================
clear
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗"
echo "║      Installation Complete!            ║"
echo "╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Farm:${NC}       $FARM_NAME"
echo -e "  ${BOLD}Dashboard:${NC}  http://$IP_ADDR"
echo ""
echo -e "  ${BOLD}Services:${NC}"
if systemctl is-active --quiet isaac-backend; then
    echo -e "    Isaac Backend:    ${GREEN}Running${NC}"
else
    echo -e "    Isaac Backend:    ${RED}Not Running${NC}"
fi
[[ "$INSTALL_TAILSCALE" =~ ^[Yy] ]] && echo -e "    Tailscale:        ${YELLOW}Run 'sudo tailscale up' to connect${NC}"
[[ "$INSTALL_CLOUDFLARE" =~ ^[Yy] ]] && echo -e "    Cloudflare:       $(systemctl is-active cloudflared 2>/dev/null || echo "Configured")"
[[ "$INSTALL_TRANSLATE" =~ ^[Yy] ]] && echo -e "    LibreTranslate:   $(systemctl is-active --quiet libretranslate && echo -e "${GREEN}Running${NC}" || echo "Starting...")"
echo ""
echo -e "  ${YELLOW}Next: Open your browser and create an admin account!${NC}"
echo ""
echo "  Commands:"
echo "    Status:   sudo systemctl status isaac-backend"
echo "    Logs:     tail -f $INSTALL_DIR/logs/backend.log"
echo "    Restart:  sudo systemctl restart isaac-backend"
echo "    Config:   sudo nano $INSTALL_DIR/backend/.env"
echo ""
