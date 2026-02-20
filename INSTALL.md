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
