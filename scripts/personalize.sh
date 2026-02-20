#!/bin/bash
# =============================================================================
# Isaac Personalization Script
# =============================================================================
# For pre-installed systems - helps new owners set up their Isaac
# Most options are OPTIONAL - press Enter to skip
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
DIM='\033[2m'
NC='\033[0m'

INSTALL_DIR="/opt/isaac"
ENV_FILE="$INSTALL_DIR/backend/.env"

# Helper functions
print_header() {
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  $1${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_section() {
    echo ""
    echo -e "${CYAN}${BOLD}▸ $1${NC}"
    echo -e "${DIM}  $2${NC}"
    echo ""
}

prompt() {
    echo -en "${BOLD}  $1${NC} "
}

prompt_optional() {
    echo -en "${BOLD}  $1${NC} ${DIM}(press Enter to skip)${NC} "
}

success() {
    echo -e "  ${GREEN}✓${NC} $1"
}

skip() {
    echo -e "  ${DIM}○ Skipped${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run with sudo: sudo bash $0${NC}"
    exit 1
fi

# Check if Isaac is installed
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: Isaac is not installed.${NC}"
    echo "Please contact support for assistance."
    exit 1
fi

clear

# =============================================================================
# Welcome Screen
# =============================================================================
echo ""
echo -e "${GREEN}"
echo "    ╔═══════════════════════════════════════════════════════════════╗"
echo "    ║                                                               ║"
echo "    ║              Welcome to Isaac Farm Assistant                  ║"
echo "    ║                                                               ║"
echo "    ║     Let's personalize your system. This only takes a few     ║"
echo "    ║     minutes. Most options are optional - just press Enter    ║"
echo "    ║     to skip anything you don't need right now.               ║"
echo "    ║                                                               ║"
echo "    ║     You can always change these settings later in the app.   ║"
echo "    ║                                                               ║"
echo "    ╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo -e "${DIM}  Press Enter to begin...${NC}"
read -r

# =============================================================================
# REQUIRED: Basic Information
# =============================================================================
print_header "Step 1 of 4: Your Farm"

print_section "Farm Name" "This appears on your dashboard"
prompt "What should we call your farm? "
read -r FARM_NAME
FARM_NAME="${FARM_NAME:-My Farm}"
success "Got it: $FARM_NAME"

print_section "Time Zone" "Used for scheduling and weather"
echo -e "  ${DIM}Common options:${NC}"
echo -e "  ${DIM}  America/New_York    (Eastern)${NC}"
echo -e "  ${DIM}  America/Chicago     (Central)${NC}"
echo -e "  ${DIM}  America/Denver      (Mountain)${NC}"
echo -e "  ${DIM}  America/Los_Angeles (Pacific)${NC}"
echo ""
prompt "Your timezone [America/New_York]: "
read -r TIMEZONE
TIMEZONE="${TIMEZONE:-America/New_York}"
success "Using: $TIMEZONE"

print_section "Location" "For accurate sunrise/sunset and weather"
echo -e "  ${DIM}Tip: Search \"latitude longitude [your city]\" on Google${NC}"
echo ""
prompt "Latitude (e.g., 40.7128): "
read -r LATITUDE
LATITUDE="${LATITUDE:-40.7128}"

prompt "Longitude (e.g., -74.0060): "
read -r LONGITUDE
LONGITUDE="${LONGITUDE:--74.0060}"
success "Location set: $LATITUDE, $LONGITUDE"

# =============================================================================
# OPTIONAL: Remote Access (Tailscale)
# =============================================================================
print_header "Step 2 of 4: Remote Access (Optional)"

print_section "Tailscale" "Access your Isaac from anywhere, securely"
echo -e "  ${DIM}Tailscale lets you access your farm dashboard from your phone${NC}"
echo -e "  ${DIM}or computer, even when you're away from home.${NC}"
echo ""
prompt "Set up remote access? (y/N): "
read -r SETUP_TAILSCALE

if [[ "$SETUP_TAILSCALE" =~ ^[Yy] ]]; then
    echo ""
    echo -e "  ${CYAN}Starting Tailscale setup...${NC}"
    echo -e "  ${DIM}A browser window will open to log in to your Tailscale account.${NC}"
    echo -e "  ${DIM}If you don't have one, you can create a free account.${NC}"
    echo ""

    if command -v tailscale &>/dev/null; then
        tailscale up 2>/dev/null && success "Tailscale connected!" || echo -e "  ${YELLOW}! Please complete setup in browser${NC}"
    else
        echo -e "  ${YELLOW}! Tailscale not installed. Skipping.${NC}"
    fi
else
    skip
fi

# =============================================================================
# OPTIONAL: Email Notifications
# =============================================================================
print_header "Step 3 of 4: Notifications (Optional)"

print_section "Email" "Get daily summaries and weather alerts"
echo -e "  ${DIM}Receive email notifications about your farm tasks,${NC}"
echo -e "  ${DIM}weather alerts, and daily summaries.${NC}"
echo ""
prompt_optional "Set up email notifications? (y/N): "
read -r SETUP_EMAIL

if [[ "$SETUP_EMAIL" =~ ^[Yy] ]]; then
    echo ""
    echo -e "  ${DIM}Common email providers:${NC}"
    echo -e "  ${DIM}  Gmail:    smtp.gmail.com (requires App Password)${NC}"
    echo -e "  ${DIM}  Outlook:  smtp.office365.com${NC}"
    echo -e "  ${DIM}  Yahoo:    smtp.mail.yahoo.com${NC}"
    echo ""

    prompt "SMTP Server: "
    read -r SMTP_HOST

    prompt "SMTP Port [587]: "
    read -r SMTP_PORT
    SMTP_PORT="${SMTP_PORT:-587}"

    prompt "Your email address: "
    read -r SMTP_USER

    prompt "Email password: "
    read -rs SMTP_PASS
    echo ""

    if [ -n "$SMTP_HOST" ] && [ -n "$SMTP_USER" ]; then
        success "Email configured"
    else
        skip
    fi
else
    skip
fi

# =============================================================================
# OPTIONAL: Weather Station
# =============================================================================
print_section "Weather Station" "Connect your personal weather station"
echo -e "  ${DIM}If you have an Ambient Weather station, you can display${NC}"
echo -e "  ${DIM}live local conditions on your dashboard.${NC}"
echo ""
prompt_optional "Set up weather station? (y/N): "
read -r SETUP_WEATHER

if [[ "$SETUP_WEATHER" =~ ^[Yy] ]]; then
    echo ""
    echo -e "  ${DIM}Get your API keys from: https://ambientweather.net/account${NC}"
    echo ""

    prompt "API Key: "
    read -r AWN_API_KEY

    prompt "Application Key: "
    read -r AWN_APP_KEY

    if [ -n "$AWN_API_KEY" ] && [ -n "$AWN_APP_KEY" ]; then
        success "Weather station configured"
    else
        skip
    fi
else
    skip
fi

# =============================================================================
# Database Setup
# =============================================================================
print_header "Step 4 of 4: Final Setup"

print_section "Fresh Start" "Start with a clean database"
echo -e "  ${DIM}Choose 'yes' if this is a brand new setup.${NC}"
echo -e "  ${DIM}Choose 'no' if you're updating an existing installation.${NC}"
echo ""
prompt "Start fresh with empty database? (Y/n): "
read -r RESET_DB
RESET_DB="${RESET_DB:-Y}"

# =============================================================================
# Apply Configuration
# =============================================================================
echo ""
echo -e "${CYAN}  Applying your settings...${NC}"
echo ""

# Backup existing .env
cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d%H%M%S)" 2>/dev/null || true

# Load existing secrets (preserve encryption key)
EXISTING_SECRET_KEY=$(grep "^SECRET_KEY=" "$ENV_FILE" 2>/dev/null | cut -d= -f2 || echo "")
EXISTING_ENCRYPT_KEY=$(grep "^ENCRYPTION_KEY=" "$ENV_FILE" 2>/dev/null | cut -d= -f2 || echo "")

# Generate new secret key if needed
SECRET_KEY="${EXISTING_SECRET_KEY:-$(openssl rand -hex 32)}"
ENCRYPTION_KEY="${EXISTING_ENCRYPT_KEY:-$(openssl rand -hex 32)}"

# Write new .env
cat > "$ENV_FILE" << EOF
# Isaac Configuration
# Personalized on $(date)

# Location & Time
TIMEZONE=$TIMEZONE
LATITUDE=$LATITUDE
LONGITUDE=$LONGITUDE

# Security Keys (do not modify)
SECRET_KEY=$SECRET_KEY
ENCRYPTION_KEY=$ENCRYPTION_KEY
EOF

# Add optional email settings if configured
if [ -n "$SMTP_HOST" ] && [ -n "$SMTP_USER" ]; then
    cat >> "$ENV_FILE" << EOF

# Email Notifications
SMTP_HOST=$SMTP_HOST
SMTP_PORT=$SMTP_PORT
SMTP_USER=$SMTP_USER
SMTP_PASSWORD=$SMTP_PASS
EOF
fi

# Add optional weather settings if configured
if [ -n "$AWN_API_KEY" ] && [ -n "$AWN_APP_KEY" ]; then
    cat >> "$ENV_FILE" << EOF

# Ambient Weather
AWN_API_KEY=$AWN_API_KEY
AWN_APP_KEY=$AWN_APP_KEY
EOF
fi

chmod 600 "$ENV_FILE"
success "Configuration saved"

# Set system timezone
timedatectl set-timezone "$TIMEZONE" 2>/dev/null && success "System timezone set" || true

# Reset database if requested
if [[ "$RESET_DB" =~ ^[Yy] ]]; then
    rm -f "$INSTALL_DIR/backend/data/"*.db 2>/dev/null || true
    rm -f "$INSTALL_DIR/data/"*.db 2>/dev/null || true
    success "Database reset"
else
    # Update farm name in existing database
    if [ -n "$FARM_NAME" ]; then
        DB_FILE="$INSTALL_DIR/backend/data/levi.db"
        if [ -f "$DB_FILE" ]; then
            sqlite3 "$DB_FILE" "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('farm_name', '$FARM_NAME');" 2>/dev/null || true
            success "Farm name updated"
        fi
    fi
fi

# Restart services
systemctl restart isaac-backend 2>/dev/null || systemctl restart levi-backend 2>/dev/null || true
sleep 3

# Get IP address
IP_ADDR=$(hostname -I | awk '{print $1}')

# =============================================================================
# Success Screen
# =============================================================================
clear
echo ""
echo -e "${GREEN}"
echo "    ╔═══════════════════════════════════════════════════════════════╗"
echo "    ║                                                               ║"
echo "    ║                    Setup Complete!                            ║"
echo "    ║                                                               ║"
echo "    ╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo -e "  ${BOLD}Your Farm:${NC}      $FARM_NAME"
echo -e "  ${BOLD}Location:${NC}       $LATITUDE, $LONGITUDE"
echo -e "  ${BOLD}Timezone:${NC}       $TIMEZONE"
echo ""
echo -e "  ${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${BOLD}Your Dashboard:${NC}  ${CYAN}http://$IP_ADDR${NC}"
echo ""
echo -e "  ${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check service status
if systemctl is-active --quiet isaac-backend 2>/dev/null || systemctl is-active --quiet levi-backend 2>/dev/null; then
    echo -e "  ${GREEN}●${NC} Isaac is running"
else
    echo -e "  ${RED}●${NC} Isaac may need to be started manually"
fi

echo ""

if [[ "$RESET_DB" =~ ^[Yy] ]]; then
    echo -e "  ${YELLOW}→${NC} Open your browser to create your admin account"
else
    echo -e "  ${BOLD}→${NC} Open your browser to access your dashboard"
fi

echo ""
echo -e "  ${DIM}Need to change settings later?${NC}"
echo -e "  ${DIM}  • Use the Settings page in the app${NC}"
echo -e "  ${DIM}  • Or run this script again: sudo bash $INSTALL_DIR/scripts/personalize.sh${NC}"
echo ""
