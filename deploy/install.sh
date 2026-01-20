#!/bin/bash
# ============================================
# Isaac/Levi Farm Assistant - Quick Install
# ============================================
# This script performs a full installation with recommended options
# For more control, use: sudo ./setup.sh [options]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "============================================"
echo "  Isaac/Levi Farm Assistant - Quick Install"
echo "============================================"
echo ""
echo "This will install:"
echo "  - Python 3 with virtual environment"
echo "  - Node.js 20.x"
echo "  - All backend dependencies"
echo "  - Frontend build tools"
echo "  - Systemd services"
echo "  - SSL certificates for local HTTPS"
echo "  - Cloudflare tunnel (for remote access)"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

# Run the full setup with all options
exec "$SCRIPT_DIR/setup.sh" --with-ssl --with-cloudflare
