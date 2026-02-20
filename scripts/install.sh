#!/bin/bash
# =============================================================================
# Isaac Pre-Install Script (Private)
# =============================================================================
# Silent installation of ALL services - run before shipping to customer
#
# Installs:
#   - Core: Python, Node.js, Nginx, SQLite
#   - Remote Access: Tailscale, Cloudflared
#   - Calendar: Radicale (CalDAV server)
#   - Kiosk: Chromium for dashboard display
#   - Isaac: Backend + Frontend
#
# Customer runs personalize.sh after receiving the Pi
#
# Usage: sudo bash install.sh
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
ok() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

INSTALL_DIR="/opt/isaac"
CURRENT_USER="${SUDO_USER:-$USER}"

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════╗"
echo "║   Isaac Farm Assistant - Pre-Install      ║"
echo "╚═══════════════════════════════════════════╝${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Run with sudo: sudo bash $0${NC}"
    exit 1
fi

export DEBIAN_FRONTEND=noninteractive

# =============================================================================
log "[1/10] Updating system..."
# =============================================================================
apt-get update -qq
apt-get upgrade -y -qq
ok "System updated"

# =============================================================================
log "[2/10] Installing core dependencies..."
# =============================================================================
apt-get install -y -qq \
    python3 python3-pip python3-venv \
    nginx git curl rsync sqlite3 openssl \
    apache2-utils  # for htpasswd (Radicale)

# Node.js 20.x
if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 18 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x 2>/dev/null | bash - >/dev/null 2>&1
    apt-get install -y -qq nodejs
fi
ok "Core dependencies"

# =============================================================================
log "[3/10] Installing Tailscale..."
# =============================================================================
if ! command -v tailscale &>/dev/null; then
    curl -fsSL https://tailscale.com/install.sh 2>/dev/null | sh >/dev/null 2>&1
fi
ok "Tailscale installed (not connected)"

# =============================================================================
log "[4/10] Installing Cloudflared..."
# =============================================================================
if ! command -v cloudflared &>/dev/null; then
    curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
    echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | tee /etc/apt/sources.list.d/cloudflared.list >/dev/null
    apt-get update -qq
    apt-get install -y -qq cloudflared
fi
ok "Cloudflared installed (not configured)"

# =============================================================================
log "[5/10] Installing Radicale (CalDAV)..."
# =============================================================================
apt-get install -y -qq radicale

# Configure Radicale
mkdir -p /etc/radicale /var/lib/radicale/collections
cat > /etc/radicale/config << 'EOF'
[server]
hosts = 127.0.0.1:5232

[auth]
type = htpasswd
htpasswd_filename = /etc/radicale/users
htpasswd_encryption = bcrypt

[storage]
filesystem_folder = /var/lib/radicale/collections

[logging]
level = warning
mask_passwords = True

[rights]
type = owner_only
EOF

# Create default user (customer changes via personalize.sh)
touch /etc/radicale/users
chown -R radicale:radicale /var/lib/radicale
chmod 750 /var/lib/radicale

systemctl enable radicale -q 2>/dev/null || true
ok "Radicale CalDAV server"

# =============================================================================
log "[6/10] Installing kiosk dependencies..."
# =============================================================================
apt-get install -y -qq chromium-browser unclutter xdotool 2>/dev/null || \
apt-get install -y -qq chromium unclutter xdotool 2>/dev/null || \
warn "Kiosk deps not available (desktop required)"
ok "Kiosk mode"

# =============================================================================
log "[7/10] Setting up Isaac directories..."
# =============================================================================
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
fi
ok "Isaac files"

# =============================================================================
log "[8/10] Setting up Python backend..."
# =============================================================================
cd "$INSTALL_DIR/backend"

if [ ! -d "venv" ]; then
    sudo -u "$CURRENT_USER" python3 -m venv venv
fi
sudo -u "$CURRENT_USER" bash -c "source venv/bin/activate && pip install --upgrade pip -q && pip install -r requirements.txt -q"

# Minimal .env - customer configures via personalize.sh
cat > .env << EOF
# Isaac Configuration - Run personalize.sh to configure
TIMEZONE=America/New_York
LATITUDE=40.7128
LONGITUDE=-74.0060
SECRET_KEY=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
EOF
chown "$CURRENT_USER:$CURRENT_USER" .env
chmod 600 .env
ok "Python backend"

# =============================================================================
log "[9/10] Building frontend..."
# =============================================================================
cd "$INSTALL_DIR/frontend"
sudo -u "$CURRENT_USER" npm install --silent 2>/dev/null || sudo -u "$CURRENT_USER" npm install
sudo -u "$CURRENT_USER" npm run build 2>/dev/null || sudo -u "$CURRENT_USER" npm run build
ok "Frontend built"

# =============================================================================
log "[10/10] Configuring services..."
# =============================================================================

# Isaac backend service
cat > /etc/systemd/system/isaac-backend.service << EOF
[Unit]
Description=Isaac Farm Assistant
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

# Kiosk service
cat > /etc/systemd/system/isaac-kiosk.service << EOF
[Unit]
Description=Isaac Dashboard Kiosk
After=graphical.target

[Service]
Type=simple
User=$CURRENT_USER
Environment=DISPLAY=:0
ExecStartPre=/bin/sleep 10
ExecStart=/usr/bin/chromium-browser --kiosk --noerrdialogs --disable-infobars --no-first-run --enable-features=OverlayScrollbar --start-fullscreen http://localhost
Restart=always

[Install]
WantedBy=graphical.target
EOF

# Nginx
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
        proxy_read_timeout 300s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
}
EOF

ln -sf /etc/nginx/sites-available/isaac /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Check for port conflicts
if ss -tlnp | grep -q ':80 '; then
    warn "Port 80 already in use - stopping conflicting service"
    systemctl stop apache2 2>/dev/null || true
fi

systemctl daemon-reload
systemctl enable isaac-backend nginx radicale -q

# Test nginx config before starting
if ! nginx -t 2>/dev/null; then
    warn "Nginx config test failed"
    nginx -t  # Show the error
else
    systemctl restart nginx || warn "Nginx failed to start - check: journalctl -xeu nginx.service"
fi

systemctl start isaac-backend radicale 2>/dev/null || true

ok "Services configured"

# =============================================================================
# Done
# =============================================================================
IP=$(hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════╗"
echo "║        Pre-Install Complete!              ║"
echo "╚═══════════════════════════════════════════╝${NC}"
echo ""
echo "  Installed Services:"
echo "    ✓ Isaac Backend + Frontend"
echo "    ✓ Nginx (web server)"
echo "    ✓ Radicale (CalDAV calendar sync)"
echo "    ✓ Tailscale (remote access - not connected)"
echo "    ✓ Cloudflared (tunnel - not configured)"
echo "    ✓ Kiosk mode (ready)"
echo ""
echo "  Dashboard: http://$IP"
echo ""
echo -e "  ${YELLOW}Ship to customer. They should run:${NC}"
echo "    sudo bash /opt/isaac/scripts/personalize.sh"
echo ""
