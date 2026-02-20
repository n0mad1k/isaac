#!/bin/bash
# =============================================================================
# Isaac Pre-Install Script (Private)
# =============================================================================
# Silent installation of ALL services - run before shipping to customer
#
# Installs:
#   - Core: Python, Node.js, Nginx, SQLite
#   - Security: HTTPS (self-signed), Unattended Upgrades
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
SSL_DIR="/etc/ssl/isaac"

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
log "[1/12] Updating system..."
# =============================================================================
apt-get update -qq
apt-get upgrade -y -qq
ok "System updated"

# =============================================================================
log "[2/12] Installing core dependencies..."
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
log "[3/12] Configuring unattended upgrades..."
# =============================================================================
apt-get install -y -qq unattended-upgrades apt-listchanges

# Configure unattended-upgrades
cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}";
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};
Unattended-Upgrade::Package-Blacklist {
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF

# Enable automatic updates
cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

systemctl enable unattended-upgrades -q 2>/dev/null || true
ok "Unattended upgrades configured"

# =============================================================================
log "[4/12] Generating SSL certificate..."
# =============================================================================
mkdir -p "$SSL_DIR"

# Generate self-signed certificate (valid for 10 years)
if [ ! -f "$SSL_DIR/isaac.crt" ]; then
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout "$SSL_DIR/isaac.key" \
        -out "$SSL_DIR/isaac.crt" \
        -subj "/C=US/ST=State/L=City/O=Isaac/CN=isaac.local" \
        2>/dev/null
    chmod 600 "$SSL_DIR/isaac.key"
    chmod 644 "$SSL_DIR/isaac.crt"
fi
ok "SSL certificate generated"

# =============================================================================
log "[5/12] Installing Tailscale..."
# =============================================================================
if ! command -v tailscale &>/dev/null; then
    curl -fsSL https://tailscale.com/install.sh 2>/dev/null | sh >/dev/null 2>&1
fi
ok "Tailscale installed (not connected)"

# =============================================================================
log "[6/12] Installing Cloudflared..."
# =============================================================================
if ! command -v cloudflared &>/dev/null; then
    curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
    echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | tee /etc/apt/sources.list.d/cloudflared.list >/dev/null
    apt-get update -qq
    apt-get install -y -qq cloudflared
fi
ok "Cloudflared installed (not configured)"

# =============================================================================
log "[7/12] Installing Radicale (CalDAV)..."
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
log "[8/12] Installing kiosk dependencies..."
# =============================================================================
# Minimal X11 for kiosk (no full desktop environment)
apt-get install -y -qq \
    xserver-xorg x11-xserver-utils xinit openbox \
    chromium-browser unclutter xdotool 2>/dev/null || \
apt-get install -y -qq \
    xserver-xorg x11-xserver-utils xinit openbox \
    chromium unclutter xdotool 2>/dev/null || \
warn "Kiosk deps not available"
ok "Kiosk mode (minimal X11)"

# =============================================================================
log "[9/12] Setting up Isaac directories..."
# =============================================================================
mkdir -p "$INSTALL_DIR"/{backend,frontend,deploy,data,logs,scripts}
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
log "[10/12] Setting up Python backend..."
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
log "[11/12] Building frontend..."
# =============================================================================
cd "$INSTALL_DIR/frontend"
sudo -u "$CURRENT_USER" npm install --silent 2>/dev/null || sudo -u "$CURRENT_USER" npm install
sudo -u "$CURRENT_USER" npm run build 2>/dev/null || sudo -u "$CURRENT_USER" npm run build
ok "Frontend built"

# =============================================================================
log "[12/12] Configuring services..."
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
ExecStart=$INSTALL_DIR/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5
StandardOutput=append:$INSTALL_DIR/logs/backend.log
StandardError=append:$INSTALL_DIR/logs/backend-error.log

[Install]
WantedBy=multi-user.target
EOF

# Detect chromium binary
if command -v chromium-browser &>/dev/null; then
    CHROMIUM_BIN="chromium-browser"
elif command -v chromium &>/dev/null; then
    CHROMIUM_BIN="chromium"
else
    CHROMIUM_BIN="chromium-browser"  # fallback
fi

# Kiosk startup script (generated for this environment)
cat > /opt/isaac/scripts/kiosk.sh << EOF
#!/bin/bash
# Isaac Kiosk - Minimal X11 + Chromium
# Generated during install for this environment

# Disable screen blanking
xset s off
xset s noblank
xset -dpms

# Hide cursor after 0.5 seconds of inactivity
unclutter -idle 0.5 -root &

# Start window manager in background (required for minimal X11)
openbox &

# Wait for backend to be ready
sleep 5

# Start Chromium in kiosk mode
$CHROMIUM_BIN \\
    --kiosk \\
    --noerrdialogs \\
    --disable-infobars \\
    --no-first-run \\
    --enable-features=OverlayScrollbar \\
    --start-fullscreen \\
    --ignore-certificate-errors \\
    --disable-translate \\
    --disable-features=TranslateUI \\
    --disk-cache-dir=/tmp/chromium-cache \\
    https://localhost
EOF
chmod +x /opt/isaac/scripts/kiosk.sh

# Kiosk service (starts X via xinit)
cat > /etc/systemd/system/isaac-kiosk.service << EOF
[Unit]
Description=Isaac Dashboard Kiosk
After=network.target isaac-backend.service
Wants=isaac-backend.service

[Service]
Type=simple
User=$CURRENT_USER
TTYPath=/dev/tty1
StandardInput=tty
StandardOutput=tty
ExecStart=/usr/bin/xinit /opt/isaac/scripts/kiosk.sh -- :0 vt1 -nocursor
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Nginx with HTTPS only (no HTTP)
cat > /etc/nginx/sites-available/isaac << EOF
# HTTPS only - no HTTP listener
server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name _;

    ssl_certificate $SSL_DIR/isaac.crt;
    ssl_certificate_key $SSL_DIR/isaac.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    root /opt/isaac/frontend/dist;
    index index.html;
    client_max_body_size 50M;

    location ^~ /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
}
EOF

ln -sf /etc/nginx/sites-available/isaac /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Disable apache2 if installed (conflicts with nginx)
systemctl stop apache2 2>/dev/null || true
systemctl disable apache2 2>/dev/null || true

systemctl daemon-reload
systemctl enable isaac-backend nginx radicale isaac-kiosk -q

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
# Verification
# =============================================================================
log "Verifying installation..."

ERRORS=0

# Check critical files exist and have content
check_file() {
    if [ ! -s "$1" ]; then
        warn "MISSING or EMPTY: $1"
        ERRORS=$((ERRORS + 1))
    fi
}

check_file "/opt/isaac/scripts/kiosk.sh"
check_file "/etc/systemd/system/isaac-backend.service"
check_file "/etc/systemd/system/isaac-kiosk.service"
check_file "/etc/nginx/sites-available/isaac"
check_file "/etc/ssl/isaac/isaac.crt"
check_file "/etc/ssl/isaac/isaac.key"
check_file "/opt/isaac/frontend/dist/index.html"
check_file "/opt/isaac/backend/venv/bin/uvicorn"

# Check services are enabled
for svc in isaac-backend nginx radicale isaac-kiosk; do
    if ! systemctl is-enabled "$svc" &>/dev/null; then
        warn "Service not enabled: $svc"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check nginx config
if ! nginx -t 2>/dev/null; then
    warn "Nginx configuration test failed"
    ERRORS=$((ERRORS + 1))
fi

if [ $ERRORS -gt 0 ]; then
    echo ""
    echo -e "${RED}╔═══════════════════════════════════════════╗"
    echo "║     Installation completed with ERRORS    ║"
    echo "╚═══════════════════════════════════════════╝${NC}"
    echo ""
    echo "  Found $ERRORS verification errors."
    echo "  Please review the warnings above and fix."
    echo ""
    exit 1
fi

ok "All verification checks passed"

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
echo "    ✓ Nginx (HTTPS web server)"
echo "    ✓ Radicale (CalDAV calendar sync)"
echo "    ✓ Tailscale (remote access - not connected)"
echo "    ✓ Cloudflared (tunnel - not configured)"
echo "    ✓ Kiosk mode (ready)"
echo "    ✓ Unattended upgrades (security updates)"
echo ""
echo "  Dashboard: https://$IP"
echo "  (Self-signed certificate - browser will show warning)"
echo ""
echo -e "  ${YELLOW}Next Steps:${NC}"
echo "    1. Visit https://$IP in a browser"
echo "    2. Complete the setup wizard to create your admin account"
echo "    3. Configure your farm settings and choose which modules to enable"
echo ""
