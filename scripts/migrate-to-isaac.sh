#!/bin/bash
# =============================================================
# Isaac Migration Script — Pi-Side
# Run this via SSH using the OLD key before renaming it:
#   ssh -i ~/.ssh/levi n0mad1k@levi.local 'bash -s' < scripts/migrate-to-isaac.sh
#
# This script:
#   1. Stops all services
#   2. Shuffles /opt/levi → /opt/isaac, /opt/isaac → /opt/isaac-dev
#   3. Creates backward-compat symlink /opt/levi → /opt/isaac
#   4. Installs new systemd services
#   5. Updates nginx config
#   6. Regenerates SSL cert for isaac.local
#   7. Changes hostname to isaac
#   8. Updates crontab paths
#   9. Starts services and verifies health
#  10. Prompts for reboot
# =============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

step() { echo -e "\n${GREEN}[$1] $2${NC}"; }
warn() { echo -e "${YELLOW}WARNING: $1${NC}"; }

# Ensure running as correct user (will need sudo for some ops)
if [ "$(whoami)" != "n0mad1k" ]; then
    echo -e "${RED}Run as n0mad1k, not root${NC}"
    exit 1
fi

echo "============================================"
echo "  Isaac Migration — Pi-Side"
echo "============================================"
echo ""
echo "This will rename levi → isaac on this Pi."
echo "Expected ~10 min downtime."
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
[[ $REPLY =~ ^[Yy]$ ]] || exit 0

# ---- Step 1: Back up databases ----
step 1 "Backing up databases..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
if [ -f /opt/levi/backend/data/levi.db ]; then
    cp /opt/levi/backend/data/levi.db "/opt/levi/backend/data/levi.db.pre-isaac-$TIMESTAMP"
    echo "  Backed up prod DB"
fi
if [ -f /opt/isaac/backend/data/levi.db ]; then
    cp /opt/isaac/backend/data/levi.db "/opt/isaac/backend/data/levi.db.pre-isaac-$TIMESTAMP"
    echo "  Backed up dev DB"
fi

# ---- Step 2: Stop services ----
step 2 "Stopping services..."
sudo systemctl stop levi-backend 2>/dev/null || true
sudo systemctl stop isaac-backend 2>/dev/null || true
sudo systemctl stop levi-kiosk 2>/dev/null || true
echo "  All services stopped"

# ---- Step 3: Shuffle directories ----
step 3 "Shuffling directories..."
# /opt/isaac (old dev) → /opt/isaac-dev
if [ -d /opt/isaac ] && [ ! -L /opt/isaac ]; then
    sudo mv /opt/isaac /opt/isaac-dev
    echo "  /opt/isaac → /opt/isaac-dev"
fi

# /opt/levi (old prod) → /opt/isaac
if [ -d /opt/levi ] && [ ! -L /opt/levi ]; then
    sudo mv /opt/levi /opt/isaac
    echo "  /opt/levi → /opt/isaac"
fi

# Backward-compat symlink
sudo ln -sf /opt/isaac /opt/levi
echo "  /opt/levi → /opt/isaac (symlink)"

# Ensure log directories exist
sudo mkdir -p /opt/isaac/logs /opt/isaac-dev/logs
sudo chown -R n0mad1k:n0mad1k /opt/isaac/logs /opt/isaac-dev/logs

# ---- Step 4: Systemd services ----
step 4 "Installing new systemd services..."

# Prod service
sudo tee /etc/systemd/system/isaac-backend.service > /dev/null << 'EOF'
[Unit]
Description=Isaac Farm Assistant Backend
After=network.target

[Service]
Type=simple
User=n0mad1k
Group=n0mad1k
WorkingDirectory=/opt/isaac/backend
Environment="PATH=/opt/isaac/backend/venv/bin"
ExecStart=/opt/isaac/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10
StandardOutput=append:/opt/isaac/logs/backend.log
StandardError=append:/opt/isaac/logs/backend-error.log

[Install]
WantedBy=multi-user.target
EOF

# Dev service
sudo tee /etc/systemd/system/isaac-dev-backend.service > /dev/null << 'EOF'
[Unit]
Description=Isaac Farm Assistant Backend (Dev)
After=network.target

[Service]
Type=simple
User=n0mad1k
Group=n0mad1k
WorkingDirectory=/opt/isaac-dev/backend
Environment="PATH=/opt/isaac-dev/backend/venv/bin"
ExecStart=/opt/isaac-dev/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=10
StandardOutput=append:/opt/isaac-dev/logs/backend.log
StandardError=append:/opt/isaac-dev/logs/backend-error.log

[Install]
WantedBy=multi-user.target
EOF

# Kiosk service
sudo tee /etc/systemd/system/isaac-kiosk.service > /dev/null << 'EOF'
[Unit]
Description=Isaac Dashboard Kiosk Mode
After=graphical.target
Wants=graphical.target

[Service]
Type=simple
User=n0mad1k
Environment=DISPLAY=:0
Environment=XAUTHORITY=/home/n0mad1k/.Xauthority
ExecStartPre=/bin/sleep 10
ExecStart=/opt/isaac/deploy/kiosk.sh
Restart=on-failure
RestartSec=5

[Install]
WantedBy=graphical.target
EOF

# Disable old services
sudo systemctl disable levi-backend 2>/dev/null || true
sudo systemctl disable levi-kiosk 2>/dev/null || true
sudo systemctl disable isaac-backend 2>/dev/null || true
sudo rm -f /etc/systemd/system/levi-backend.service
sudo rm -f /etc/systemd/system/levi-kiosk.service

# Reload and enable new services
sudo systemctl daemon-reload
sudo systemctl enable isaac-backend
sudo systemctl enable isaac-dev-backend
echo "  Systemd services installed"

# ---- Step 5: Nginx ----
step 5 "Updating nginx configuration..."

# Write prod config
sudo tee /etc/nginx/sites-available/isaac > /dev/null << 'NGINX'
server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name isaac isaac.local _;

    ssl_certificate /opt/isaac/certs/isaac.crt;
    ssl_certificate_key /opt/isaac/certs/isaac.key;
    ssl_protocols TLSv1.2 TLSv1.3;

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
        proxy_set_header X-Forwarded-Prefix /api;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        proxy_redirect ~^(/.*)$ /api$1;
    }

    location /health {
        proxy_pass http://127.0.0.1:8000/health;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1d;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;
}

# HTTP → HTTPS redirect
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    return 301 https://$host$request_uri;
}
NGINX

# Write dev config
sudo tee /etc/nginx/sites-available/isaac-dev > /dev/null << 'NGINX'
server {
    listen 8443 ssl;
    listen [::]:8443 ssl;
    server_name isaac isaac.local _;

    ssl_certificate /opt/isaac/certs/isaac.crt;
    ssl_certificate_key /opt/isaac/certs/isaac.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    root /opt/isaac-dev/frontend/dist;
    index index.html;
    client_max_body_size 50M;

    location ^~ /api/ {
        proxy_pass http://127.0.0.1:8001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Prefix /api;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        proxy_redirect ~^(/.*)$ /api$1;
    }

    location /health {
        proxy_pass http://127.0.0.1:8001/health;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1d;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;
}
NGINX

# Enable sites, remove old
sudo ln -sf /etc/nginx/sites-available/isaac /etc/nginx/sites-enabled/isaac
sudo ln -sf /etc/nginx/sites-available/isaac-dev /etc/nginx/sites-enabled/isaac-dev
sudo rm -f /etc/nginx/sites-enabled/levi
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t && sudo systemctl reload nginx
echo "  Nginx updated"

# ---- Step 6: SSL Certificate ----
step 6 "Regenerating SSL certificate..."
CERT_DIR="/opt/isaac/certs"
sudo mkdir -p "$CERT_DIR"
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$CERT_DIR/isaac.key" \
    -out "$CERT_DIR/isaac.crt" \
    -subj "/C=US/ST=State/L=City/O=Isaac/CN=isaac.local" \
    -addext "subjectAltName=DNS:isaac.local,DNS:isaac,IP:127.0.0.1"
sudo chown n0mad1k:n0mad1k "$CERT_DIR/isaac.key" "$CERT_DIR/isaac.crt"
sudo chmod 600 "$CERT_DIR/isaac.key"
echo "  SSL cert generated for isaac.local"

# Reload nginx with new cert
sudo systemctl reload nginx

# ---- Step 7: Hostname ----
step 7 "Changing hostname to isaac..."
sudo hostnamectl set-hostname isaac
echo "isaac" | sudo tee /etc/hostname > /dev/null
sudo sed -i 's/levi/isaac/g' /etc/hosts
echo "  Hostname set to isaac"

# ---- Step 8: Crontab ----
step 8 "Updating crontab paths..."
crontab -l 2>/dev/null | sed 's|/opt/levi|/opt/isaac|g; s|/opt/isaac-old|/opt/isaac-dev|g' | crontab - 2>/dev/null || warn "No crontab to update"
echo "  Crontab updated"

# ---- Step 9: Backup scripts ----
step 9 "Updating backup scripts..."
for f in /opt/isaac/backup.sh /opt/isaac-dev/backup.sh; do
    if [ -f "$f" ]; then
        sed -i 's|/opt/levi|/opt/isaac|g' "$f"
        echo "  Updated $f"
    fi
done

# ---- Step 10: Start services ----
step 10 "Starting services..."
sudo systemctl start isaac-backend
sleep 3
sudo systemctl start isaac-dev-backend 2>/dev/null || warn "Dev backend failed to start (may need venv setup)"

# ---- Step 11: Verify health ----
step 11 "Verifying health..."
echo -n "  Prod backend: "
if curl -sk https://localhost/api/health/ 2>/dev/null | grep -q healthy; then
    echo -e "${GREEN}HEALTHY${NC}"
else
    echo -e "${RED}UNHEALTHY${NC}"
fi

echo -n "  Dev backend: "
if curl -sk https://localhost:8443/api/health/ 2>/dev/null | grep -q healthy; then
    echo -e "${GREEN}HEALTHY${NC}"
else
    echo -e "${YELLOW}NOT RUNNING (may need deploy)${NC}"
fi

echo ""
echo "============================================"
echo -e "${GREEN}  Migration Complete!${NC}"
echo "============================================"
echo ""
echo "Next steps on your workstation:"
echo "  1. mv ~/.ssh/levi ~/.ssh/isaac"
echo "  2. mv ~/.ssh/levi.pub ~/.ssh/isaac.pub"
echo "  3. sudo reboot  (on the Pi, for hostname change)"
echo "  4. ping isaac.local"
echo "  5. ssh -i ~/.ssh/isaac n0mad1k@isaac.local"
echo ""
echo -e "${YELLOW}Reboot now for hostname to take effect? (y/n)${NC}"
read -p "" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    sudo reboot
fi
