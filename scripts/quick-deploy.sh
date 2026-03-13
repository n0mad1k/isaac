#!/bin/bash
# Quick Deploy Script for Isaac
# Run this from your local machine as your user (not root)
#
# Usage:
#   ./quick-deploy.sh                          # Interactive prompts
#   ./quick-deploy.sh --host test-isaac.local   # Override host
#   ./quick-deploy.sh --config ~/.isaac-deploy  # Use saved config
#
# Options:
#   --host HOST        Pi hostname or IP
#   --user USER        Remote username (default: current user)
#   --key PATH         SSH key path (default: ~/.ssh/id_rsa)
#   --remote-dir DIR   Install directory on Pi (default: /opt/isaac)
#   --no-kiosk         Skip kiosk dependencies
#   --config FILE      Load settings from file
#   --save-config      Save current settings for future runs

set -e

# Defaults
PI_HOST=""
PI_USER="$(whoami)"
SSH_KEY=""
REMOTE_DIR="/opt/isaac"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL_KIOSK=true
CONFIG_FILE=""
SAVE_CONFIG=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --host)       PI_HOST="$2"; shift 2 ;;
        --user)       PI_USER="$2"; shift 2 ;;
        --key)        SSH_KEY="$2"; shift 2 ;;
        --remote-dir) REMOTE_DIR="$2"; shift 2 ;;
        --no-kiosk)   INSTALL_KIOSK=false; shift ;;
        --config)     CONFIG_FILE="$2"; shift 2 ;;
        --save-config) SAVE_CONFIG=true; shift ;;
        -h|--help)
            sed -n '2,/^$/p' "$0" | sed 's/^# \?//'
            exit 0 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Load config file if specified
if [ -n "$CONFIG_FILE" ] && [ -f "$CONFIG_FILE" ]; then
    echo "Loading config from $CONFIG_FILE"
    source "$CONFIG_FILE"
fi

# Interactive prompts for missing required values
if [ -z "$PI_HOST" ]; then
    read -rp "Pi hostname or IP: " PI_HOST
    [ -z "$PI_HOST" ] && { echo "Error: hostname is required"; exit 1; }
fi

if [ -z "$SSH_KEY" ]; then
    # Try to find a matching key
    DEFAULT_KEY="$HOME/.ssh/$PI_HOST"
    if [ -f "$DEFAULT_KEY" ]; then
        SSH_KEY="$DEFAULT_KEY"
    elif [ -f "$HOME/.ssh/id_rsa" ]; then
        SSH_KEY="$HOME/.ssh/id_rsa"
    elif [ -f "$HOME/.ssh/id_ed25519" ]; then
        SSH_KEY="$HOME/.ssh/id_ed25519"
    fi
    read -rp "SSH key path [$SSH_KEY]: " INPUT_KEY
    SSH_KEY="${INPUT_KEY:-$SSH_KEY}"
    [ -z "$SSH_KEY" ] && { echo "Error: SSH key path is required"; exit 1; }
fi

if [ ! -f "$SSH_KEY" ]; then
    echo "Error: SSH key not found at $SSH_KEY"
    exit 1
fi

SSH_CMD="ssh -i $SSH_KEY"
SSH_TARGET="$PI_USER@$PI_HOST"

# Save config if requested
if [ "$SAVE_CONFIG" = true ]; then
    SAVE_PATH="${CONFIG_FILE:-$HOME/.isaac-deploy}"
    cat > "$SAVE_PATH" << EOF
PI_HOST="$PI_HOST"
PI_USER="$PI_USER"
SSH_KEY="$SSH_KEY"
REMOTE_DIR="$REMOTE_DIR"
INSTALL_KIOSK=$INSTALL_KIOSK
EOF
    echo "Config saved to $SAVE_PATH"
fi

echo "======================================"
echo "  Isaac Quick Deploy"
echo "======================================"
echo "  Host:       $PI_HOST"
echo "  User:       $PI_USER"
echo "  SSH Key:    $SSH_KEY"
echo "  Remote Dir: $REMOTE_DIR"
echo "  Local Dir:  $LOCAL_DIR"
echo "  Kiosk:      $INSTALL_KIOSK"
echo "======================================"
echo ""

# Step 1: Test SSH connection
echo "[Step 1/8] Checking SSH connection..."
if ! $SSH_CMD -o BatchMode=yes -o ConnectTimeout=5 "$SSH_TARGET" "echo ok" 2>/dev/null; then
    echo "SSH key not set up. Copying public key to Pi..."
    echo "You'll need to enter the Pi's password:"
    ssh-copy-id -i "$SSH_KEY" "$SSH_TARGET"
fi

# Step 2: Create directories
echo ""
echo "[Step 2/8] Creating directories on Pi..."
$SSH_CMD "$SSH_TARGET" "sudo mkdir -p $REMOTE_DIR/{backend,frontend,deploy,data,logs} && sudo chown -R $PI_USER:$PI_USER $REMOTE_DIR"

# Step 3: Install system dependencies
echo ""
echo "[Step 3/8] Installing system dependencies..."
$SSH_CMD "$SSH_TARGET" "INSTALL_KIOSK=$INSTALL_KIOSK bash -s" << 'DEPS'
set -e
MISSING=""
dpkg -s python3 &>/dev/null || MISSING="$MISSING python3"
dpkg -s python3-pip &>/dev/null || MISSING="$MISSING python3-pip"
dpkg -s python3-venv &>/dev/null || MISSING="$MISSING python3-venv"
dpkg -s python3-dev &>/dev/null || MISSING="$MISSING python3-dev"
dpkg -s gcc &>/dev/null || MISSING="$MISSING gcc"
dpkg -s nginx &>/dev/null || MISSING="$MISSING nginx"
dpkg -s git &>/dev/null || MISSING="$MISSING git"
dpkg -s curl &>/dev/null || MISSING="$MISSING curl"
dpkg -s rsync &>/dev/null || MISSING="$MISSING rsync"

if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 18 ]]; then
    echo "Setting up Node.js 20.x repository..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    MISSING="$MISSING nodejs"
fi

if [ "$INSTALL_KIOSK" = "true" ]; then
    if ! dpkg -s chromium &>/dev/null 2>&1 && ! dpkg -s chromium-browser &>/dev/null 2>&1; then
        # Use whichever package name has an install candidate
        if apt-cache policy chromium 2>/dev/null | grep -q "Candidate:"; then
            MISSING="$MISSING chromium"
        elif apt-cache policy chromium-browser 2>/dev/null | grep -q "Candidate:"; then
            MISSING="$MISSING chromium-browser"
        else
            echo "Warning: No chromium package found in repos, skipping"
        fi
    fi
    dpkg -s unclutter &>/dev/null || MISSING="$MISSING unclutter"
    dpkg -s xdotool &>/dev/null || MISSING="$MISSING xdotool"
fi

if [ -n "$MISSING" ]; then
    echo "Installing:$MISSING"
    sudo apt-get update -qq
    sudo apt-get install -y $MISSING
else
    echo "All system dependencies present."
fi
DEPS

# Step 4: Set up git repo (before rsync so rsync overrides are preserved)
echo ""
echo "[Step 4/8] Setting up git repo for updates..."
$SSH_CMD "$SSH_TARGET" "REMOTE_DIR=$REMOTE_DIR bash -s" << 'GITSETUP'
cd "$REMOTE_DIR"
if [ ! -d ".git" ]; then
    echo "Initializing git repo..."
    git init -b main
    git remote add origin https://github.com/n0mad1k/isaac.git 2>/dev/null || true
fi
# Pull latest public repo as the base
git fetch origin main
git reset --hard origin/main
git branch -M main
echo "Git repo aligned to origin/main."
GITSETUP

# Step 5: Sync local overrides on top of public repo
echo ""
echo "[Step 5/8] Syncing files to Pi..."
rsync -avz --delete \
    -e "ssh -i $SSH_KEY" \
    --exclude '__pycache__' \
    --exclude '*.pyc' \
    --exclude 'venv' \
    --exclude '.env' \
    --exclude '*.db' \
    --exclude 'node_modules' \
    --exclude 'dist' \
    --exclude 'logs' \
    --exclude 'data' \
    "$LOCAL_DIR/backend/" \
    "$SSH_TARGET:$REMOTE_DIR/backend/"

rsync -avz --delete \
    -e "ssh -i $SSH_KEY" \
    --exclude 'node_modules' \
    --exclude 'dist' \
    "$LOCAL_DIR/frontend/" \
    "$SSH_TARGET:$REMOTE_DIR/frontend/"

rsync -avz \
    -e "ssh -i $SSH_KEY" \
    "$LOCAL_DIR/deploy/" \
    "$SSH_TARGET:$REMOTE_DIR/deploy/"

rsync -avz \
    -e "ssh -i $SSH_KEY" \
    "$LOCAL_DIR/VERSION" \
    "$LOCAL_DIR/CHANGELOG.md" \
    "$SSH_TARGET:$REMOTE_DIR/"

# Step 5: Python environment and frontend build
echo ""
echo "[Step 6/9] Setting up Python environment and building frontend..."
$SSH_CMD "$SSH_TARGET" "REMOTE_DIR=$REMOTE_DIR bash -s" << 'BUILD'
set -e
cd "$REMOTE_DIR"

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
    if [ -f "backend/.env.example" ]; then
        cp backend/.env.example backend/.env
        echo "Created .env from template — configure it after deploy!"
    fi
fi

# Create logs directory
mkdir -p logs

# Frontend build
echo "Building frontend..."
cd frontend
npm install
npm run build
cd ..

echo "Build complete!"
BUILD

# Step 6: Systemd services
echo ""
echo "[Step 7/9] Setting up systemd services..."
$SSH_CMD "$SSH_TARGET" "REMOTE_DIR=$REMOTE_DIR PI_USER=$PI_USER bash -s" << 'SERVICES'
set -e

# Generate backend service file dynamically
sudo tee /etc/systemd/system/isaac-backend.service > /dev/null << EOF
[Unit]
Description=Isaac Farm Assistant Backend
After=network.target

[Service]
Type=simple
User=$PI_USER
Group=$PI_USER
WorkingDirectory=$REMOTE_DIR/backend
Environment="PATH=$REMOTE_DIR/backend/venv/bin"
ExecStart=$REMOTE_DIR/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10
StandardOutput=append:$REMOTE_DIR/logs/backend.log
StandardError=append:$REMOTE_DIR/logs/backend-error.log

[Install]
WantedBy=multi-user.target
EOF

# Copy kiosk service if it exists
if [ -f "$REMOTE_DIR/deploy/isaac-kiosk.service" ]; then
    sudo cp "$REMOTE_DIR/deploy/isaac-kiosk.service" /etc/systemd/system/
fi
[ -f "$REMOTE_DIR/deploy/kiosk.sh" ] && sudo chmod +x "$REMOTE_DIR/deploy/kiosk.sh"

sudo systemctl daemon-reload
sudo systemctl enable isaac-backend

echo "Services configured!"
SERVICES

# Step 7: Nginx
echo ""
echo "[Step 8/9] Configuring Nginx..."
$SSH_CMD "$SSH_TARGET" "REMOTE_DIR=$REMOTE_DIR bash -s" << 'NGINX'
set -e

# Use deploy config if it exists, otherwise generate one
if [ -f "$REMOTE_DIR/deploy/nginx-isaac.conf" ]; then
    sudo cp "$REMOTE_DIR/deploy/nginx-isaac.conf" /etc/nginx/sites-available/isaac
else
    sudo tee /etc/nginx/sites-available/isaac > /dev/null << EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root $REMOTE_DIR/frontend/dist;
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
fi

sudo ln -sf /etc/nginx/sites-available/isaac /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

echo "Nginx configured!"
NGINX

# Step 8: Start backend
echo ""
echo "[Step 9/9] Starting Isaac backend..."
$SSH_CMD "$SSH_TARGET" "sudo systemctl restart isaac-backend && sleep 2 && sudo systemctl status isaac-backend --no-pager"

echo ""
echo "======================================"
echo "  Deployment Complete!"
echo "======================================"
echo ""
echo "  Dashboard: http://$PI_HOST"
echo "  API Docs:  http://$PI_HOST/api/docs"
echo ""
echo "  SSH:       ssh -i $SSH_KEY $SSH_TARGET"
echo "  .env:      $REMOTE_DIR/backend/.env"
echo "  Logs:      journalctl -u isaac-backend -f"
echo ""
