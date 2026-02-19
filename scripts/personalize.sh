#!/bin/bash
# =============================================================================
# Isaac Personalization Script
# =============================================================================
# For pre-installed systems - customize settings for new owner
# Does NOT reinstall anything, just updates configuration
#
# Usage: sudo bash personalize.sh
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

prompt() { echo -en "${CYAN}${BOLD}$1${NC}"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }

INSTALL_DIR="/opt/isaac"
ENV_FILE="$INSTALL_DIR/backend/.env"

clear
echo ""
echo -e "${GREEN}========================================"
echo "   Welcome to Your Isaac Farm Assistant"
echo "========================================${NC}"
echo ""
echo "Let's personalize Isaac for your farm!"
echo ""

# Check if Isaac is installed
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: Isaac doesn't appear to be installed.${NC}"
    echo "Run the full installer first: sudo bash install.sh"
    exit 1
fi

# =============================================================================
# Basic Information
# =============================================================================
echo -e "${BOLD}== Basic Information ==${NC}"
echo ""

prompt "What's your farm/homestead name? "
read -r FARM_NAME
FARM_NAME="${FARM_NAME:-My Farm}"

prompt "Your timezone (e.g., America/New_York, America/Chicago): "
read -r TIMEZONE
TIMEZONE="${TIMEZONE:-America/New_York}"

echo ""
echo -e "${BOLD}== Location (for weather & sunrise/sunset) ==${NC}"
echo "Tip: Search 'latitude longitude [your city]' on Google"
echo ""

prompt "Latitude (e.g., 40.7128): "
read -r LATITUDE
LATITUDE="${LATITUDE:-40.7128}"

prompt "Longitude (e.g., -74.0060): "
read -r LONGITUDE
LONGITUDE="${LONGITUDE:--74.0060}"

# =============================================================================
# Email Setup (Optional)
# =============================================================================
echo ""
echo -e "${BOLD}== Email Notifications (Optional) ==${NC}"
echo "For daily digests and weather alerts"
echo ""

prompt "Set up email notifications? (y/N): "
read -r SETUP_EMAIL

if [[ "$SETUP_EMAIL" =~ ^[Yy] ]]; then
    echo ""
    echo "Common SMTP settings:"
    echo "  Gmail:      smtp.gmail.com (use App Password)"
    echo "  Outlook:    smtp.office365.com"
    echo "  ProtonMail: Use Bridge"
    echo ""

    prompt "SMTP Server: "
    read -r SMTP_HOST

    prompt "SMTP Port [587]: "
    read -r SMTP_PORT
    SMTP_PORT="${SMTP_PORT:-587}"

    prompt "Email address: "
    read -r SMTP_USER

    prompt "Email password (hidden): "
    read -rs SMTP_PASS
    echo ""
fi

# =============================================================================
# Weather Station (Optional)
# =============================================================================
echo ""
echo -e "${BOLD}== Weather Station (Optional) ==${NC}"
echo "Connect your Ambient Weather station for local conditions"
echo ""

prompt "Set up Ambient Weather? (y/N): "
read -r SETUP_WEATHER

if [[ "$SETUP_WEATHER" =~ ^[Yy] ]]; then
    echo ""
    echo "Get your API keys from: https://ambientweather.net/account"
    echo ""

    prompt "API Key: "
    read -r AWN_API_KEY

    prompt "App Key: "
    read -r AWN_APP_KEY
fi

# =============================================================================
# Update Configuration
# =============================================================================
echo ""
log_info "Updating configuration..."

# Backup existing .env
cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d%H%M%S)"

# Generate new secret key
SECRET_KEY=$(openssl rand -hex 32)

# Write new .env
cat > "$ENV_FILE" << EOF
# Isaac Configuration
# Personalized on $(date)

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

# Security
SECRET_KEY=$SECRET_KEY
EOF

chmod 600 "$ENV_FILE"

log_success "Configuration updated"

# =============================================================================
# Update timezone
# =============================================================================
log_info "Setting system timezone..."
timedatectl set-timezone "$TIMEZONE" 2>/dev/null || true
log_success "Timezone set to $TIMEZONE"

# =============================================================================
# Reset database for new owner (optional)
# =============================================================================
echo ""
prompt "Reset database for fresh start? This removes ALL existing data (y/N): "
read -r RESET_DB

if [[ "$RESET_DB" =~ ^[Yy] ]]; then
    log_info "Resetting database..."
    rm -f "$INSTALL_DIR/backend/data/"*.db 2>/dev/null || true
    rm -f "$INSTALL_DIR/data/"*.db 2>/dev/null || true
    log_success "Database reset - you'll create a new admin account"
fi

# =============================================================================
# Update farm name in database (if not reset)
# =============================================================================
if [[ ! "$RESET_DB" =~ ^[Yy] ]] && [ -n "$FARM_NAME" ]; then
    DB_FILE="$INSTALL_DIR/backend/data/levi.db"
    if [ -f "$DB_FILE" ]; then
        log_info "Updating farm name..."
        sqlite3 "$DB_FILE" "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('farm_name', '$FARM_NAME');" 2>/dev/null || true
    fi
fi

# =============================================================================
# Restart services
# =============================================================================
log_info "Restarting Isaac..."
systemctl restart isaac-backend
sleep 3

# Get IP
IP_ADDR=$(hostname -I | awk '{print $1}')

# =============================================================================
# Done!
# =============================================================================
clear
echo ""
echo -e "${GREEN}========================================"
echo "     Personalization Complete!"
echo "========================================${NC}"
echo ""
echo -e "  ${BOLD}Your farm:${NC}  $FARM_NAME"
echo -e "  ${BOLD}Location:${NC}   $LATITUDE, $LONGITUDE"
echo -e "  ${BOLD}Timezone:${NC}   $TIMEZONE"
echo ""
echo -e "  ${BOLD}Dashboard:${NC}  http://$IP_ADDR"
echo ""
if systemctl is-active --quiet isaac-backend; then
    echo -e "  ${GREEN}Status: Running${NC}"
else
    echo -e "  ${RED}Status: Not Running${NC}"
fi
echo ""
if [[ "$RESET_DB" =~ ^[Yy] ]]; then
    echo -e "  ${YELLOW}Open your browser and create your admin account!${NC}"
else
    echo -e "  ${BOLD}Open your browser to access your dashboard.${NC}"
fi
echo ""
echo "  Need to change settings later?"
echo "    - Edit config: sudo nano $ENV_FILE"
echo "    - Restart:     sudo systemctl restart isaac-backend"
echo "    - Run again:   sudo bash $INSTALL_DIR/scripts/personalize.sh"
echo ""
