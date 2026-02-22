# Isaac - Farm & Homestead Assistant

*"Isaac planted crops in that land and the same year reaped a hundredfold, because the LORD blessed him." - Genesis 26:12*

A self-hosted farm and homestead management system designed to run on a Raspberry Pi or cloud server. Track your plants, animals, equipment, workers, finances, and more from a beautiful touch-friendly interface.

![License](https://img.shields.io/badge/license-Commons%20Clause-blue)
![Python](https://img.shields.io/badge/python-3.11+-green)
![React](https://img.shields.io/badge/react-18.3-blue)

## Features

### Core Modules

| Module | Description |
|--------|-------------|
| **Dashboard** | Real-time weather, tasks, alerts, and farm stats at a glance |
| **Tasks & Calendar** | Day/week/month views, recurring tasks, CalDAV sync with phone |
| **Plants** | Care schedules, watering, fertilizing, harvests, frost protection |
| **Animals** | Health records, feeding, worming, vaccinations, expense tracking |
| **Garden** | Bed layouts, crop rotation planning, sprinkler zones |
| **Seeds** | Seed inventory, germination tracking, planting schedules |
| **Farm Areas** | Location management (pastures, barns, coops) with maintenance |

### Operations

| Module | Description |
|--------|-------------|
| **Vehicles** | Maintenance by miles/hours/date, service history, cost tracking |
| **Equipment** | Tool and implement maintenance, hour tracking |
| **Home Maintenance** | Recurring home tasks, seasonal checklists, cost tracking |
| **Production** | Harvest records, livestock processing, yield tracking |

### Business & Finance

| Module | Description |
|--------|-------------|
| **Farm Finances** | Customer management, orders, invoices, sales, expenses |
| **Budget** | Personal income/expense tracking, monthly budgets, bill management |
| **Workers** | External worker management, task assignment, multi-language support |

### Team & Health

| Module | Description |
|--------|-------------|
| **Team** | Household member profiles, chores, gear tracking |
| **Health Metrics** | Weight, blood pressure, body measurements with trend graphs |
| **Child Growth** | Percentile tracking, milestone monitoring, development alerts |
| **Fitness** | Workout logging, training load analysis, readiness scores |

### Integrations

| Feature | Description |
|---------|-------------|
| **Weather** | Ambient Weather station integration or NOAA fallback, automatic frost/freeze/heat alerts |
| **CalDAV** | Bi-directional sync with iPhone/Android calendars |
| **Email** | Daily digest, task reminders, weather alerts, invoice delivery |
| **AI Assistant** | Built-in chat with Claude, ChatGPT, or Ollama for farm questions |
| **Kiosk Mode** | Full-screen dashboard display for dedicated screens |

---

## Table of Contents

- [Hardware Requirements](#hardware-requirements)
- [Manual Installation Guide](#manual-installation-guide)
  - [Step 1: System Update](#step-1-system-update)
  - [Step 2: Core Dependencies](#step-2-core-dependencies)
  - [Step 3: Node.js 20.x](#step-3-nodejs-20x)
  - [Step 4: Unattended Upgrades](#step-4-unattended-upgrades-optional)
  - [Step 5: SSL Certificate](#step-5-ssl-certificate)
  - [Step 6: Clone Repository](#step-6-clone-repository)
  - [Step 7: Backend Setup](#step-7-backend-setup)
  - [Step 8: Frontend Setup](#step-8-frontend-setup)
  - [Step 9: Systemd Services](#step-9-systemd-services)
  - [Step 10: Nginx Configuration](#step-10-nginx-configuration)
  - [Step 11: Radicale CalDAV Server](#step-11-radicale-caldav-server)
  - [Step 12: Kiosk Mode](#step-12-kiosk-mode-optional)
  - [Step 13: Start Services](#step-13-start-services)
- [External Services Configuration](#external-services-configuration)
  - [Tailscale (VPN Remote Access)](#tailscale-vpn-remote-access)
  - [Cloudflare Tunnel (Public Access)](#cloudflare-tunnel-public-access)
  - [CalDAV Calendar Sync](#caldav-calendar-sync)
  - [Ambient Weather Integration](#ambient-weather-integration)
  - [Email Notifications](#email-notifications)
  - [AI Assistant](#ai-assistant)
- [Configuration Reference](#configuration-reference)
- [Updating](#updating)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Hardware Requirements

**Option 1: Raspberry Pi (Recommended)**
- Raspberry Pi 4 or 5 (4GB+ RAM)
- 32GB+ microSD card (Class A2)
- Official power supply

**Option 2: Cloud VPS**
- Any provider (Linode, DigitalOcean, Vultr)
- 1GB RAM minimum
- Ubuntu 22.04+

---

## Manual Installation Guide

This guide walks you through every step of setting up Isaac from scratch. Run all commands as a user with sudo privileges.

### Step 1: System Update

```bash
sudo apt update && sudo apt upgrade -y
```

### Step 2: Core Dependencies

Install required system packages:

```bash
sudo apt install -y \
    python3 python3-pip python3-venv \
    nginx git curl rsync sqlite3 openssl \
    apache2-utils
```

**What these are:**
- `python3`, `python3-pip`, `python3-venv` - Python runtime and package management
- `nginx` - High-performance web server (reverse proxy)
- `git` - Version control for cloning and updating
- `curl`, `rsync` - File transfer utilities
- `sqlite3` - Database engine (Isaac uses SQLite)
- `openssl` - SSL certificate generation
- `apache2-utils` - Includes `htpasswd` for CalDAV authentication

### Step 3: Node.js 20.x

Isaac's frontend requires Node.js 18+ (20.x recommended):

```bash
# Check current version
node -v

# If not installed or < 18, install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node -v  # Should show v20.x.x
npm -v   # Should show 10.x.x
```

### Step 4: Unattended Upgrades (Optional)

Automatically install security updates:

```bash
sudo apt install -y unattended-upgrades apt-listchanges
```

Configure automatic updates:

```bash
sudo tee /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}";
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF

sudo tee /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

sudo systemctl enable unattended-upgrades
```

### Step 5: SSL Certificate

Isaac runs on HTTPS only. Generate a self-signed certificate:

```bash
# Create SSL directory
sudo mkdir -p /etc/ssl/isaac

# Generate self-signed certificate (valid 10 years)
sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout /etc/ssl/isaac/isaac.key \
    -out /etc/ssl/isaac/isaac.crt \
    -subj "/C=US/ST=State/L=City/O=Isaac/CN=isaac.local"

# Set permissions
sudo chmod 600 /etc/ssl/isaac/isaac.key
sudo chmod 644 /etc/ssl/isaac/isaac.crt
```

> **Note:** Self-signed certificates will show a browser warning. For public access, use [Let's Encrypt](#using-lets-encrypt) or [Cloudflare Tunnel](#cloudflare-tunnel-public-access).

### Step 6: Clone Repository

```bash
# Create installation directory
sudo mkdir -p /opt/isaac
sudo chown $USER:$USER /opt/isaac

# Clone the repository
git clone https://github.com/n0mad1k/isaac.git /opt/isaac
cd /opt/isaac

# Create data directories
mkdir -p /opt/isaac/data /opt/isaac/logs /opt/isaac/scripts
```

### Step 7: Backend Setup

```bash
cd /opt/isaac/backend

# Create Python virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt

# Create environment configuration
cat > .env << 'EOF'
# Isaac Configuration
# Edit these values for your setup

# Location (for sunrise/sunset and weather)
TIMEZONE=America/New_York
LATITUDE=40.7128
LONGITUDE=-74.0060

# Security keys (auto-generated, don't share)
SECRET_KEY=REPLACE_WITH_RANDOM_64_CHAR_HEX
ENCRYPTION_KEY=REPLACE_WITH_RANDOM_64_CHAR_HEX

# Optional: Ambient Weather API
# AWN_API_KEY=your_api_key
# AWN_APP_KEY=your_app_key

# Optional: Email notifications
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your_email@gmail.com
# SMTP_PASSWORD=your_app_password

# Optional: AI Assistant (choose one)
# ANTHROPIC_API_KEY=your_claude_key
# OPENAI_API_KEY=your_openai_key
EOF

# Generate random keys
sed -i "s/REPLACE_WITH_RANDOM_64_CHAR_HEX/$(openssl rand -hex 32)/" .env
sed -i "0,/REPLACE_WITH_RANDOM_64_CHAR_HEX/s//$(openssl rand -hex 32)/" .env

# Secure the file
chmod 600 .env

# Deactivate virtual environment
deactivate
```

### Step 8: Frontend Setup

```bash
cd /opt/isaac/frontend

# Install Node.js dependencies
npm install

# Build production bundle
npm run build

# Verify build
ls -la dist/index.html  # Should exist
```

### Step 9: Systemd Services

Create the backend service:

```bash
sudo tee /etc/systemd/system/isaac-backend.service << EOF
[Unit]
Description=Isaac Farm Assistant
After=network.target

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=/opt/isaac/backend
Environment=PATH=/opt/isaac/backend/venv/bin:/usr/bin
ExecStart=/opt/isaac/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5
StandardOutput=append:/opt/isaac/logs/backend.log
StandardError=append:/opt/isaac/logs/backend-error.log

[Install]
WantedBy=multi-user.target
EOF
```

### Step 10: Nginx Configuration

Create the Nginx site configuration (HTTPS only):

```bash
sudo tee /etc/nginx/sites-available/isaac << 'EOF'
# Isaac Farm Assistant - HTTPS Only
server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name _;

    ssl_certificate /etc/ssl/isaac/isaac.crt;
    ssl_certificate_key /etc/ssl/isaac/isaac.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    root /opt/isaac/frontend/dist;
    index index.html;
    client_max_body_size 50M;

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
        proxy_read_timeout 300s;
    }

    # CalDAV proxy (if using Radicale)
    location /radicale/ {
        proxy_pass http://127.0.0.1:5232/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend - serve React app
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/isaac /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Disable Apache if installed (conflicts with Nginx)
sudo systemctl stop apache2 2>/dev/null || true
sudo systemctl disable apache2 2>/dev/null || true

# Test configuration
sudo nginx -t
```

### Step 11: Radicale CalDAV Server

Radicale provides CalDAV calendar sync with your phone:

```bash
# Install Radicale
sudo apt install -y radicale

# Create directories
sudo mkdir -p /etc/radicale /var/lib/radicale/collections

# Configure Radicale
sudo tee /etc/radicale/config << 'EOF'
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

# Create empty users file (add users later via setup wizard or htpasswd)
sudo touch /etc/radicale/users

# Set permissions
sudo chown -R radicale:radicale /var/lib/radicale
sudo chmod 750 /var/lib/radicale

# Enable service
sudo systemctl enable radicale
```

**To add a CalDAV user manually:**
```bash
# Add user (you'll be prompted for password)
sudo htpasswd -B /etc/radicale/users username

# Restart Radicale
sudo systemctl restart radicale
```

### Step 12: Kiosk Mode (Optional)

For a dedicated dashboard display on a Raspberry Pi:

```bash
# Install minimal X11 and Chromium
sudo apt install -y \
    xserver-xorg x11-xserver-utils xinit openbox \
    chromium-browser unclutter xdotool

# Note: On some systems, use 'chromium' instead of 'chromium-browser'
```

Create the kiosk startup script:

```bash
# Detect chromium binary name
if command -v chromium-browser &>/dev/null; then
    CHROMIUM_BIN="chromium-browser"
else
    CHROMIUM_BIN="chromium"
fi

sudo tee /opt/isaac/scripts/kiosk.sh << EOF
#!/bin/bash
# Isaac Kiosk - Minimal X11 + Chromium

# Disable screen blanking
xset s off
xset s noblank
xset -dpms

# Hide cursor after inactivity
unclutter -idle 0.5 -root &

# Start window manager
openbox &

# Wait for backend
sleep 5

# Start Chromium in kiosk mode
$CHROMIUM_BIN \\
    --kiosk \\
    --noerrdialogs \\
    --disable-infobars \\
    --no-first-run \\
    --start-fullscreen \\
    --ignore-certificate-errors \\
    --disable-translate \\
    --disk-cache-dir=/tmp/chromium-cache \\
    https://localhost
EOF

sudo chmod +x /opt/isaac/scripts/kiosk.sh
```

Create the kiosk service:

```bash
sudo tee /etc/systemd/system/isaac-kiosk.service << EOF
[Unit]
Description=Isaac Dashboard Kiosk
After=network.target isaac-backend.service
Wants=isaac-backend.service

[Service]
Type=simple
User=$USER
TTYPath=/dev/tty1
StandardInput=tty
StandardOutput=tty
ExecStart=/usr/bin/xinit /opt/isaac/scripts/kiosk.sh -- :0 vt1 -nocursor
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
```

Configure auto-login on Raspberry Pi:
```bash
sudo raspi-config
# Navigate to: System Options > Boot / Auto Login > Console Autologin
```

### Step 13: Start Services

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable services to start on boot
sudo systemctl enable isaac-backend nginx radicale

# Start services
sudo systemctl start isaac-backend nginx radicale

# For kiosk mode (optional)
sudo systemctl enable isaac-kiosk
sudo systemctl start isaac-kiosk

# Check status
sudo systemctl status isaac-backend
sudo systemctl status nginx
sudo systemctl status radicale
```

### Access Your Dashboard

1. Find your IP: `hostname -I`
2. Open browser: `https://YOUR_IP` or `https://isaac.local`
3. Accept the self-signed certificate warning
4. Complete the setup wizard to create your admin account

---

## External Services Configuration

Isaac can integrate with several external services for remote access, weather data, and notifications.

### Tailscale (VPN Remote Access)

**What it is:** Tailscale creates a secure, private network (VPN) between your devices. It allows you to access Isaac from anywhere as if you were on your home network.

**Why use it:** Access your farm dashboard from your phone or laptop while away from home, without exposing your Pi to the public internet.

**Installation:**
```bash
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Connect to your Tailscale network
sudo tailscale up

# Follow the authentication link that appears
```

**Usage:**
- After connecting, your Pi gets a Tailscale IP (e.g., `100.x.x.x`)
- Install Tailscale on your phone/laptop
- Access Isaac via `https://100.x.x.x` from anywhere
- Traffic is encrypted end-to-end

**Benefits:**
- No port forwarding needed
- Works behind NAT/firewalls
- Free for personal use (up to 100 devices)
- No public exposure of your server

### Cloudflare Tunnel (Public Access)

**What it is:** Cloudflare Tunnel (cloudflared) creates a secure connection from your Pi to Cloudflare's network, allowing public access to Isaac through a custom domain without exposing your home IP.

**Why use it:** Share your farm dashboard publicly (e.g., for customers viewing order status) or access it via a memorable domain name with automatic HTTPS.

**Prerequisites:**
- A domain name managed by Cloudflare (free tier works)
- Cloudflare account

**Installation:**
```bash
# Install cloudflared
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update
sudo apt install -y cloudflared
```

**Configuration:**
```bash
# Login to Cloudflare (opens browser)
cloudflared tunnel login

# Create a tunnel
cloudflared tunnel create isaac

# Configure the tunnel
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml << EOF
tunnel: isaac
credentials-file: /home/$USER/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: farm.yourdomain.com
    service: https://localhost:443
    originRequest:
      noTLSVerify: true
  - service: http_status:404
EOF

# Route DNS to tunnel
cloudflared tunnel route dns isaac farm.yourdomain.com

# Install as service
sudo cloudflared service install

# Start the tunnel
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

**Benefits:**
- Public access without exposing your IP
- Automatic HTTPS with valid certificate
- DDoS protection from Cloudflare
- No port forwarding required
- Access via memorable domain

**When to use Tailscale vs Cloudflare:**
| Use Case | Recommended |
|----------|-------------|
| Personal/family access only | Tailscale |
| Need public access (customers, sharing) | Cloudflare Tunnel |
| Both personal + some public pages | Both (use Cloudflare for public, Tailscale for admin) |

### CalDAV Calendar Sync

**What it is:** CalDAV is a protocol for syncing calendars. Isaac includes Radicale, a lightweight CalDAV server that syncs tasks and events with your phone.

**How it works:**
1. Isaac creates tasks/events
2. Radicale stores them in CalDAV format
3. Your phone's calendar app syncs with Radicale
4. Changes on either side sync automatically

**Phone Setup (iOS):**
1. Settings > Calendar > Accounts > Add Account > Other
2. Add CalDAV Account:
   - Server: `https://YOUR_IP/radicale/`
   - Username: Your CalDAV username
   - Password: Your CalDAV password
3. Enable calendars to sync

**Phone Setup (Android):**
1. Install DAVx5 from Play Store
2. Add account with:
   - Base URL: `https://YOUR_IP/radicale/`
   - Username/Password from setup
3. Select calendars to sync

**Creating CalDAV users:**
```bash
# Via command line
sudo htpasswd -B /etc/radicale/users newuser
sudo systemctl restart radicale
```

Or configure during Isaac's setup wizard.

### Ambient Weather Integration

**What it is:** If you have an Ambient Weather station, Isaac can display real-time local weather and generate automatic alerts.

**Setup:**
1. Go to [Ambient Weather Dashboard](https://ambientweather.net/account)
2. Create API keys (API Key and Application Key)
3. Add to `/opt/isaac/backend/.env`:
   ```
   AWN_API_KEY=your_api_key_here
   AWN_APP_KEY=your_application_key_here
   ```
4. Restart: `sudo systemctl restart isaac-backend`

**Features:**
- Real-time temperature, humidity, wind, rain on dashboard
- Automatic frost/freeze warnings for plants
- Heat alerts for livestock
- Soil moisture tracking (if sensor equipped)

**No Weather Station?**
Isaac falls back to NOAA/National Weather Service data based on your latitude/longitude. Set these in `.env` or during setup.

### Email Notifications

**What it is:** Isaac can send email notifications for daily digests, task reminders, weather alerts, and invoice delivery.

**Gmail Setup:**
1. Enable 2-factor authentication on your Google account
2. Generate an App Password:
   - Google Account > Security > 2-Step Verification > App passwords
   - Create password for "Mail" on "Other (Isaac)"
3. Add to `/opt/isaac/backend/.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASSWORD=your_16_char_app_password
   ```

**Other Providers:**
| Provider | SMTP Host | Port |
|----------|-----------|------|
| Gmail | smtp.gmail.com | 587 |
| Outlook | smtp.office365.com | 587 |
| Yahoo | smtp.mail.yahoo.com | 587 |
| ProtonMail Bridge | 127.0.0.1 | 1025 |

**Configure in Isaac:**
1. Go to Settings > Notifications
2. Add email recipients
3. Configure daily digest time
4. Enable/disable specific alert types

### AI Assistant

**What it is:** Isaac includes a chat assistant that can answer farm questions, help with plant care, and provide agricultural advice.

**Supported Providers:**

| Provider | Key Required | Best For |
|----------|--------------|----------|
| Claude (Anthropic) | Yes | Most capable, best reasoning |
| ChatGPT (OpenAI) | Yes | Good general purpose |
| Ollama | No (local) | Privacy, no API costs |

**Setup - Claude:**
1. Get API key from [Anthropic Console](https://console.anthropic.com/)
2. Add to `.env`: `ANTHROPIC_API_KEY=sk-ant-...`

**Setup - ChatGPT:**
1. Get API key from [OpenAI Platform](https://platform.openai.com/)
2. Add to `.env`: `OPENAI_API_KEY=sk-...`

**Setup - Ollama (Local, Free):**
1. Install Ollama: `curl -fsSL https://ollama.ai/install.sh | sh`
2. Pull a model: `ollama pull llama2` or `ollama pull mistral`
3. Configure in Isaac Settings > AI > Provider: Ollama
4. Set Ollama URL: `http://localhost:11434`

---

## Configuration Reference

### Environment Variables (.env)

Located at `/opt/isaac/backend/.env`:

| Variable | Required | Description |
|----------|----------|-------------|
| `TIMEZONE` | Yes | Your timezone (e.g., `America/New_York`) |
| `LATITUDE` | Yes | Your location latitude |
| `LONGITUDE` | Yes | Your location longitude |
| `SECRET_KEY` | Yes | 64-char hex for session tokens |
| `ENCRYPTION_KEY` | Yes | 64-char hex for data encryption |
| `AWN_API_KEY` | No | Ambient Weather API key |
| `AWN_APP_KEY` | No | Ambient Weather App key |
| `SMTP_HOST` | No | Email server hostname |
| `SMTP_PORT` | No | Email server port (usually 587) |
| `SMTP_USER` | No | Email username |
| `SMTP_PASSWORD` | No | Email password/app password |
| `ANTHROPIC_API_KEY` | No | Claude API key |
| `OPENAI_API_KEY` | No | ChatGPT API key |

### Web Settings

Most settings are configured through the web interface at **Settings**:

- Weather alert thresholds (frost, freeze, heat, wind)
- Email recipients and daily digest schedule
- CalDAV calendar sync credentials
- AI provider selection
- Dashboard display options
- User roles and permissions
- Module enable/disable

---

## Updating

```bash
cd /opt/isaac

# Pull latest changes
git pull

# Update backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
deactivate

# Rebuild frontend
cd ../frontend
npm install
npm run build

# Restart service
sudo systemctl restart isaac-backend
```

---

## API Documentation

When running, API docs are available at:
- Swagger UI: `https://YOUR_IP/api/docs`
- ReDoc: `https://YOUR_IP/api/redoc`

---

## Troubleshooting

### Check service status
```bash
sudo systemctl status isaac-backend
sudo systemctl status nginx
sudo systemctl status radicale
```

### View logs
```bash
# Backend logs
tail -f /opt/isaac/logs/backend.log
tail -f /opt/isaac/logs/backend-error.log

# Nginx logs
tail -f /var/log/nginx/error.log

# System journal
journalctl -u isaac-backend -f
```

### Common Issues

**Browser shows "Connection Refused"**
```bash
# Check if backend is running
sudo systemctl status isaac-backend

# Check if port 8000 is listening
ss -tlnp | grep 8000

# Check nginx
sudo nginx -t
sudo systemctl status nginx
```

**Certificate warnings**
- Expected with self-signed certificates
- Use Cloudflare Tunnel for valid HTTPS
- Or install Let's Encrypt:
  ```bash
  sudo apt install certbot python3-certbot-nginx
  sudo certbot --nginx -d yourdomain.com
  ```

**CalDAV sync not working**
```bash
# Check Radicale status
sudo systemctl status radicale

# Verify users file
cat /etc/radicale/users

# Test locally
curl -u username:password http://127.0.0.1:5232/
```

### Reset admin password
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

### Database location
SQLite database: `/opt/isaac/data/isaac.db`

---

## License

This project is licensed under the **Commons Clause License** (based on MIT).

**Free for personal, non-commercial use.** For commercial use, please contact for a license.

See [LICENSE](LICENSE) for details.

---

## Support

- **Issues:** [GitHub Issues](https://github.com/n0mad1k/isaac/issues)
- **Discussions:** [GitHub Discussions](https://github.com/n0mad1k/isaac/discussions)

---

Made with care for farmers and homesteaders
