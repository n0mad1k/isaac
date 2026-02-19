#!/bin/bash
# =============================================================================
# Isaac Public Repository Sanitization Script
# =============================================================================
# This script creates a sanitized version of the codebase for public release.
# It removes sensitive data, proprietary scripts, and personal information.
#
# Usage: ./scripts/create-public-repo.sh [--force]
#   --force: Overwrite existing public repo directory
# =============================================================================

set -e  # Exit on error

# Configuration
SOURCE_DIR="/home/n0mad1k/Tools/levi"
PUBLIC_DIR="/home/n0mad1k/Tools/isaac-public"
SCRIPT_NAME=$(basename "$0")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Parse arguments
FORCE=false
for arg in "$@"; do
    case $arg in
        --force) FORCE=true ;;
        *) log_warn "Unknown argument: $arg" ;;
    esac
done

# =============================================================================
# Phase 1: Pre-flight Checks
# =============================================================================
echo ""
echo "========================================"
echo " Isaac Public Repository Sanitization"
echo "========================================"
echo ""

# Check if source exists
if [ ! -d "$SOURCE_DIR" ]; then
    log_error "Source directory not found: $SOURCE_DIR"
    exit 1
fi

# Check if destination exists
if [ -d "$PUBLIC_DIR" ]; then
    if [ "$FORCE" = true ]; then
        log_warn "Removing existing public repo directory..."
        rm -rf "$PUBLIC_DIR"
    else
        log_error "Public repo directory already exists: $PUBLIC_DIR"
        log_info "Use --force to overwrite"
        exit 1
    fi
fi

# =============================================================================
# Phase 2: Copy Files with Exclusions
# =============================================================================
log_info "Phase 2: Copying files with exclusions..."

mkdir -p "$PUBLIC_DIR"

rsync -av --progress \
    --exclude='.git' \
    --exclude='.env' \
    --exclude='*.db' \
    --exclude='.local-backup' \
    --exclude='logs/' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='node_modules' \
    --exclude='venv' \
    --exclude='dist' \
    --exclude='.vscode' \
    --exclude='.idea' \
    --exclude='*.log' \
    --exclude='.claude/' \
    --exclude='deploy.sh' \
    --exclude='deploy-dev.sh' \
    --exclude='scripts/setup-pi.sh' \
    --exclude='scripts/deploy-to-pi.sh' \
    --exclude='scripts/quick-deploy.sh' \
    --exclude='scripts/prod-api.sh' \
    --exclude='scripts/dev-tracker.sh' \
    --exclude='scripts/dev_tracker.db' \
    --exclude='scripts/install.sh' \
    --exclude='scripts/personalize.sh' \
    --exclude='backend/dev_tracker.db' \
    --exclude='backend/routers/dev_tracker.py' \
    --exclude='CLAUDE.md' \
    --exclude='deploy/levi-backend.service' \
    --exclude='deploy/levi-kiosk.service' \
    --exclude='deploy/nginx-levi.conf' \
    --exclude='deploy/setup.sh' \
    --exclude='deploy/kiosk.sh' \
    --exclude='deploy/install.sh' \
    --exclude='scripts/create-public-repo.sh' \
    --exclude='data/' \
    --exclude='SECURITY_AUDIT_2026-*.md' \
    --exclude='SECURITY_AUDIT_DEEP_DIVE_*.md' \
    "$SOURCE_DIR/" "$PUBLIC_DIR/"

log_success "Files copied"

# =============================================================================
# Phase 3: String Replacements
# =============================================================================
log_info "Phase 3: Running string replacements..."

# Function to safely run sed on all text files
sanitize_strings() {
    local dir="$1"

    # Find all text files (excluding binary files)
    find "$dir" -type f \( \
        -name "*.py" -o \
        -name "*.js" -o \
        -name "*.jsx" -o \
        -name "*.ts" -o \
        -name "*.tsx" -o \
        -name "*.json" -o \
        -name "*.md" -o \
        -name "*.txt" -o \
        -name "*.yml" -o \
        -name "*.yaml" -o \
        -name "*.sh" -o \
        -name "*.conf" -o \
        -name "*.service" -o \
        -name "*.html" -o \
        -name "*.css" -o \
        -name "*.env*" -o \
        -name "Dockerfile" -o \
        -name "Makefile" -o \
        -name "LICENSE" -o \
        -name "VERSION" -o \
        -name "CHANGELOG*" \
    \) -print0 | while IFS= read -r -d '' file; do

        # Skip if file is binary
        if file "$file" | grep -q "text"; then
            # Email addresses (before username to avoid partial matches)
            sed -i 's/n0mad1k@protonmail\.com/your-email@example.com/g' "$file"

            # Username in paths and SSH
            sed -i 's|/home/n0mad1k/Tools/levi|/path/to/isaac|g' "$file"
            sed -i 's|/home/n0mad1k/.ssh/levi|~/.ssh/isaac|g' "$file"
            sed -i 's|/home/n0mad1k|/home/your-username|g' "$file"

            # Standalone username references (various contexts)
            sed -i 's/n0mad1k@/your-username@/g' "$file"
            sed -i 's/ n0mad1k / your-username /g' "$file"
            sed -i 's/:n0mad1k/:your-username/g' "$file"
            sed -i 's/n0mad1k:/your-username:/g' "$file"
            sed -i 's/"n0mad1k"/"your-username"/g' "$file"

            # GitHub username (careful with URLs)
            sed -i 's|github\.com/n0mad1k|github.com/your-username|g' "$file"

            # Hostname replacements (levi.local -> isaac.local already done)
            # Only replace standalone levi references, not isaac.local
            sed -i 's/levi\.local/isaac.local/g' "$file"
            sed -i 's/levi-backend/isaac-backend/g' "$file"
            sed -i 's/levi-kiosk/isaac-kiosk/g' "$file"

            # Paths with /opt/levi (prod path)
            sed -i 's|/opt/levi|/opt/isaac|g' "$file"

            # IP Address
            sed -i 's/192\.168\.5\.56/<raspberry-pi-ip>/g' "$file"

            # Coordinates (Oxford, FL -> NYC example)
            sed -i 's/28\.913413/40.7128/g' "$file"
            sed -i 's/-82\.093794/-74.0060/g' "$file"

            # Farm name (generic replacement)
            sed -i 's/Mealey Family Farm/Your Farm Name/g' "$file"

            # Author name in LICENSE (keep as credit but note it's original author)
            # Don't replace in LICENSE - keep attribution
        fi
    done
}

sanitize_strings "$PUBLIC_DIR"
log_success "String replacements complete"

# =============================================================================
# Phase 4: Create Sanitized Config Files
# =============================================================================
log_info "Phase 4: Creating sanitized config files..."

# Create nginx-isaac.conf (sanitized version)
cat > "$PUBLIC_DIR/deploy/nginx-isaac.conf" << 'NGINX_EOF'
# Isaac Farm Assistant - Nginx Configuration
# Copy this to /etc/nginx/sites-available/isaac

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name isaac.local _;

    root /opt/isaac/frontend/dist;
    index index.html;

    # API - proxy to FastAPI backend
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

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:8000/health;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1d;
        add_header Cache-Control "public, immutable";
    }

    # Frontend - serve built React app (catch-all)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;
}
NGINX_EOF

log_success "Created nginx-isaac.conf"

# Rename service example files
if [ -f "$PUBLIC_DIR/deploy/isaac-backend.service.example" ]; then
    mv "$PUBLIC_DIR/deploy/isaac-backend.service.example" "$PUBLIC_DIR/deploy/isaac-backend.service"
    log_success "Renamed isaac-backend.service"
fi

if [ -f "$PUBLIC_DIR/deploy/isaac-kiosk.service.example" ]; then
    mv "$PUBLIC_DIR/deploy/isaac-kiosk.service.example" "$PUBLIC_DIR/deploy/isaac-kiosk.service"
    log_success "Renamed isaac-kiosk.service"
fi

# =============================================================================
# Phase 5: Update README for public repo
# =============================================================================
log_info "Phase 5: Verifying documentation..."

# The README.md should already be sanitized by string replacements
# Just verify it exists
if [ -f "$PUBLIC_DIR/README.md" ]; then
    log_success "README.md exists"
else
    log_warn "README.md not found"
fi

# =============================================================================
# Phase 6: Create INSTALL.md
# =============================================================================
log_info "Phase 6: Creating INSTALL.md..."

cat > "$PUBLIC_DIR/INSTALL.md" << 'INSTALL_EOF'
# Isaac Installation Guide

This guide provides step-by-step instructions for manually installing Isaac on a Raspberry Pi or cloud server.

## Prerequisites

- Raspberry Pi 4/5 (4GB+ RAM recommended) or cloud VPS
- Raspberry Pi OS (64-bit) or Ubuntu 22.04+
- SSH access to your server

## Quick Start

### 1. System Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y \
    python3-pip \
    python3-venv \
    nodejs \
    npm \
    nginx \
    git
```

### 2. Clone Repository

```bash
# Create installation directory
sudo mkdir -p /opt/isaac
sudo chown $USER:$USER /opt/isaac

# Clone the repository
git clone https://github.com/your-username/isaac.git /opt/isaac
cd /opt/isaac
```

### 3. Backend Setup

```bash
cd /opt/isaac/backend

# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Create configuration file
cp .env.example .env

# Edit configuration (see Configuration section below)
nano .env
```

### 4. Frontend Setup

```bash
cd /opt/isaac/frontend

# Install Node.js dependencies
npm install

# Build frontend
npm run build
```

### 5. Create Data Directories

```bash
mkdir -p /opt/isaac/data
mkdir -p /opt/isaac/logs
```

### 6. Systemd Service

```bash
# Copy service file
sudo cp /opt/isaac/deploy/isaac-backend.service /etc/systemd/system/

# Edit service file if your username is not 'pi'
sudo nano /etc/systemd/system/isaac-backend.service

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable isaac-backend
sudo systemctl start isaac-backend

# Check status
sudo systemctl status isaac-backend
```

### 7. Nginx Configuration

```bash
# Copy nginx config
sudo cp /opt/isaac/deploy/nginx-isaac.conf /etc/nginx/sites-available/isaac

# Enable site
sudo ln -sf /etc/nginx/sites-available/isaac /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload nginx
sudo nginx -t
sudo systemctl reload nginx
```

### 8. Access Dashboard

Open your browser and navigate to:
- Local: `http://isaac.local` or `http://<your-pi-ip>`
- Cloud: `http://<your-server-ip>`

On first access, you'll be prompted to create an admin account.

## Configuration

### Required Settings (.env file)

Edit `/opt/isaac/backend/.env`:

```bash
# Your location (for weather and sunrise/sunset)
TIMEZONE=America/New_York
LATITUDE=40.7128
LONGITUDE=-74.0060

# Ambient Weather API (optional)
# Get keys from: https://ambientweather.net/account
AWN_API_KEY=your_api_key
AWN_APP_KEY=your_app_key

# Email notifications (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

### Additional Settings

Most settings can be configured through the web interface at Settings:
- Weather alert thresholds
- Email notification preferences
- Calendar sync (CalDAV)
- Dashboard display options

## HTTPS Setup (Recommended for Cloud)

### Using Let's Encrypt

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate (replace with your domain)
sudo certbot --nginx -d yourdomain.com

# Auto-renewal is configured automatically
```

### Using Self-Signed Certificate (Local Network)

```bash
# Generate self-signed certificate
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/isaac.key \
    -out /etc/ssl/certs/isaac.crt

# Update nginx config to use HTTPS
# Add to server block:
#   listen 443 ssl;
#   ssl_certificate /etc/ssl/certs/isaac.crt;
#   ssl_certificate_key /etc/ssl/private/isaac.key;
```

## Kiosk Mode (Optional)

For a dedicated dashboard display:

```bash
# Install display dependencies
sudo apt install -y chromium-browser xserver-xorg x11-xserver-utils xinit openbox

# Copy kiosk service
sudo cp /opt/isaac/deploy/isaac-kiosk.service /etc/systemd/system/
sudo systemctl enable isaac-kiosk

# Configure auto-login
sudo raspi-config
# Choose: System Options > Boot / Auto Login > Desktop Autologin

sudo reboot
```

## Updating

```bash
cd /opt/isaac

# Pull latest changes
git pull

# Update backend
cd backend
source venv/bin/activate
pip install -r requirements.txt

# Rebuild frontend
cd ../frontend
npm install
npm run build

# Restart service
sudo systemctl restart isaac-backend
```

## Troubleshooting

### Check Service Status
```bash
sudo systemctl status isaac-backend
```

### View Logs
```bash
# Backend logs
tail -f /opt/isaac/logs/backend.log

# Error logs
tail -f /opt/isaac/logs/backend-error.log

# Nginx logs
tail -f /var/log/nginx/error.log
```

### Reset Admin Password
```bash
cd /opt/isaac/backend
source venv/bin/activate
python3 -c "
from models.database import engine
from sqlalchemy import text
import asyncio

async def reset():
    async with engine.begin() as conn:
        await conn.execute(text('DELETE FROM users'))
        print('All users deleted. Visit web UI to create new admin.')

asyncio.run(reset())
"
sudo systemctl restart isaac-backend
```

### Database Location
SQLite database: `/opt/isaac/data/isaac.db`

### Port Conflicts
If port 8000 is in use:
```bash
# Check what's using the port
sudo lsof -i :8000

# Or change the port in isaac-backend.service
sudo nano /etc/systemd/system/isaac-backend.service
# Change --port 8000 to another port
```

## Support

- Issues: https://github.com/your-username/isaac/issues
- Discussions: https://github.com/your-username/isaac/discussions
INSTALL_EOF

log_success "Created INSTALL.md"

# =============================================================================
# Phase 7: Clean Up and Initialize Git
# =============================================================================
log_info "Phase 7: Initializing clean git repository..."

cd "$PUBLIC_DIR"

# Remove any leftover sensitive patterns that might have been missed
# Double-check for common sensitive patterns
SENSITIVE_PATTERNS=(
    "n0mad1k"
    "Mealey"
    "192.168.5.56"
    "28.913413"
    "-82.093794"
)

echo ""
log_info "Scanning for remaining sensitive patterns..."
FOUND_SENSITIVE=false

for pattern in "${SENSITIVE_PATTERNS[@]}"; do
    if grep -r --include="*.py" --include="*.js" --include="*.jsx" --include="*.md" --include="*.json" --include="*.sh" "$pattern" "$PUBLIC_DIR" 2>/dev/null | grep -v "Binary"; then
        log_warn "Found pattern: $pattern"
        FOUND_SENSITIVE=true
    fi
done

if [ "$FOUND_SENSITIVE" = true ]; then
    log_warn "Some sensitive patterns may remain - please review manually"
else
    log_success "No sensitive patterns found"
fi

# Check for any .db files
DB_FILES=$(find "$PUBLIC_DIR" -name "*.db" 2>/dev/null)
if [ -n "$DB_FILES" ]; then
    log_warn "Database files found (removing):"
    echo "$DB_FILES"
    find "$PUBLIC_DIR" -name "*.db" -delete
fi

# Check for .env files (should only be .env.example)
ENV_FILES=$(find "$PUBLIC_DIR" -name ".env" -not -name ".env.example" 2>/dev/null)
if [ -n "$ENV_FILES" ]; then
    log_warn "Removing .env files:"
    echo "$ENV_FILES"
    find "$PUBLIC_DIR" -name ".env" -not -name ".env.example" -delete
fi

# Initialize git repository (use master to match existing GitHub repo)
git init -b master
git add .

# Use generic author for public release
git -c user.name="Isaac Project" -c user.email="noreply@example.com" commit -m "Initial public release"

log_success "Git repository initialized"

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "========================================"
echo " Sanitization Complete!"
echo "========================================"
echo ""
log_success "Public repository created at: $PUBLIC_DIR"
echo ""
echo "Next steps:"
echo "  1. Review the repository for any remaining sensitive data"
echo "  2. Test that the application works with the sanitized files"
echo "  3. Push to your public GitHub repository:"
echo ""
echo "     cd $PUBLIC_DIR"
echo "     git remote add origin git@github.com:your-username/isaac.git"
echo "     git push -u origin master"
echo ""
echo "Files excluded (sell separately as Pro Setup Kit):"
echo "  - deploy.sh / deploy-dev.sh (deployment automation)"
echo "  - scripts/setup-pi.sh (Pi setup)"
echo "  - scripts/dev-tracker.sh (dev tracker CLI)"
echo "  - backend/routers/dev_tracker.py (dev tracker API)"
echo "  - CLAUDE.md (AI assistant config)"
echo ""
