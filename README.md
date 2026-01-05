# Isaac - Farm & Homestead Assistant

*"Isaac planted crops in that land and the same year reaped a hundredfold, because the LORD blessed him." - Genesis 26:12*

A self-hosted farm management dashboard designed to run on a Raspberry Pi. Track your plants, animals, equipment, tasks, weather alerts, and more from a beautiful touch-friendly interface.

![License](https://img.shields.io/badge/license-Commons%20Clause-blue)
![Python](https://img.shields.io/badge/python-3.11+-green)
![React](https://img.shields.io/badge/react-18.3-blue)

## Features at a Glance

| Feature | Description |
|---------|-------------|
| **Dashboard** | Real-time weather, tasks, alerts, and farm stats at a glance |
| **Plants** | Track care schedules, watering, fertilizing, harvests, frost protection |
| **Animals** | Health records, feeding, worming, vaccinations, expense tracking |
| **Vehicles** | Maintenance by miles/hours/date, service history, cost tracking |
| **Equipment** | Tool and implement maintenance, hour tracking |
| **Calendar** | Day/Week/Month views, events & reminders, CalDAV sync |
| **Weather** | Ambient Weather integration, automatic frost/freeze/heat alerts |
| **Production** | Harvest records, livestock processing, yield tracking |
| **Multi-User** | Role-based access (Admin/Editor/Viewer), kiosk mode |

## Quick Feature Overview

### Dashboard
Your command center showing weather, today's tasks, overdue items, alerts, and quick stats. The cold protection widget automatically warns you when frost-sensitive plants need covering.

### Plant Management
Complete plant database with care logging, automated reminders, and harvest tracking. Import plants from PFAF or Permapeople databases.

### Animal Management
Track pets and livestock with health records, care schedules (worming, vaccines, hoof care), feeding, and expenses. Automatic reminders for upcoming care.

### Calendar
Three views (day, week, month) showing both events and reminders. Visual distinction between event types. Syncs with your phone via CalDAV.

### Maintenance Tracking
Vehicles, equipment, home, and farm areas - all with customizable maintenance schedules, completion logging, and cost tracking.

### Weather Integration
Connect your Ambient Weather station for real-time local conditions. Automatic alerts for frost, freeze, heat, wind, and rain with configurable thresholds.

## Hardware Requirements

### Option 1: Raspberry Pi (Recommended for Home Use)

| Component | Recommendation | Notes |
|-----------|---------------|-------|
| **Raspberry Pi** | Raspberry Pi 5 (4GB or 8GB) | 4GB is sufficient, 8GB if running other services |
| **microSD Card** | 32GB+ Class A2 | Samsung EVO or SanDisk Extreme recommended |
| **Power Supply** | Official Pi 5 27W USB-C | Don't cheap out - poor power causes issues |
| **Case** | Any with passive/active cooling | The Pi 5 runs warm |
| **Display** (optional) | 7" touchscreen or HDMI monitor | For kiosk mode |

**Estimated Cost:** $80-150 USD

### Option 2: Cloud VPS (Linode/DigitalOcean)

For remote access or if you don't want hardware at home:

| Provider | Plan | Monthly Cost |
|----------|------|--------------|
| Linode | Nanode 1GB | $5/month |
| DigitalOcean | Basic 1GB | $6/month |
| Vultr | Cloud Compute | $5/month |

---

## Installation

### Raspberry Pi Installation

#### Step 1: Flash Raspberry Pi OS

1. Download [Raspberry Pi Imager](https://www.raspberrypi.com/software/) on your computer
2. Insert your microSD card
3. Open Raspberry Pi Imager and click "Choose OS"
4. Select **Raspberry Pi OS (64-bit)** - the Lite version is fine if not using kiosk mode
5. Click "Choose Storage" and select your microSD card
6. Click the gear icon (⚙️) for advanced options:
   - Set hostname: `isaac` (so you can access it at `isaac.local`)
   - Enable SSH with password authentication
   - Set username: `pi` and a strong password
   - Configure your WiFi (if not using ethernet)
   - Set your timezone
7. Click "Write" and wait for it to complete

#### Step 2: Boot and Connect

1. Insert the microSD into your Pi and power it on
2. Wait 2-3 minutes for first boot
3. Find your Pi on the network:
   ```bash
   # From your computer, try:
   ping isaac.local

   # Or check your router's DHCP list for the IP
   ```
4. SSH into your Pi:
   ```bash
   ssh pi@isaac.local
   ```

#### Step 3: Install Isaac

Run these commands on your Raspberry Pi:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y python3-pip python3-venv nodejs npm nginx git

# Clone Isaac
sudo mkdir -p /opt/isaac
sudo chown $USER:$USER /opt/isaac
git clone https://github.com/n0mad1k/isaac.git /opt/isaac

# Setup backend
cd /opt/isaac/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create your config
cp .env.example .env
nano .env  # Edit with your settings (see Configuration section)

# Setup frontend
cd /opt/isaac/frontend
npm install
npm run build

# Create data and log directories
mkdir -p /opt/isaac/data /opt/isaac/logs

# Install systemd service
sudo cp /opt/isaac/deploy/isaac-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable isaac-backend
sudo systemctl start isaac-backend

# Setup nginx (optional but recommended)
sudo cp /opt/isaac/deploy/nginx-isaac.conf /etc/nginx/sites-available/isaac
sudo ln -s /etc/nginx/sites-available/isaac /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo systemctl restart nginx
```

#### Step 4: Access Your Dashboard

Open a browser and go to: `http://isaac.local`

On first load, you'll be prompted to create an admin account.

---

### Cloud Installation (Linode)

#### Step 1: Create a Linode

1. Sign up at [linode.com](https://www.linode.com)
2. Click "Create Linode"
3. Choose:
   - **Image:** Ubuntu 24.04 LTS
   - **Region:** Choose closest to you
   - **Plan:** Nanode 1GB ($5/month) - sufficient for personal use
   - **Label:** `isaac`
   - **Root Password:** Set a strong password
   - **SSH Keys:** Add your public key (recommended)
4. Click "Create Linode"

#### Step 2: Connect and Secure

```bash
# SSH into your new server
ssh root@YOUR_LINODE_IP

# Create a non-root user
adduser farmer
usermod -aG sudo farmer

# Setup firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Switch to new user
su - farmer
```

#### Step 3: Install Isaac

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y python3-pip python3-venv nodejs npm nginx git certbot python3-certbot-nginx

# Clone Isaac
sudo mkdir -p /opt/isaac
sudo chown $USER:$USER /opt/isaac
git clone https://github.com/n0mad1k/isaac.git /opt/isaac

# Setup backend
cd /opt/isaac/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create config
cp .env.example .env
nano .env  # Edit settings

# IMPORTANT: For cloud deployment, disable local network restriction
# In .env, add:
# ALLOW_PUBLIC_ACCESS=true

# Setup frontend
cd /opt/isaac/frontend
npm install
npm run build

# Create directories
mkdir -p /opt/isaac/data /opt/isaac/logs

# Install and start service
sudo cp /opt/isaac/deploy/isaac-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable isaac-backend
sudo systemctl start isaac-backend

# Setup nginx
sudo cp /opt/isaac/deploy/nginx-isaac.conf /etc/nginx/sites-available/isaac
sudo ln -s /etc/nginx/sites-available/isaac /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
```

#### Step 4: Setup SSL (Required for Cloud)

Point your domain to your Linode IP, then:

```bash
sudo certbot --nginx -d yourdomain.com
```

#### Step 5: Access Your Dashboard

Go to `https://yourdomain.com` and create your admin account.

---

## Configuration

### Most settings are configured in the web UI!

After logging in, go to **Settings** to configure:

- **Weather Alerts** - Frost/freeze/heat warning thresholds
- **Email Notifications** - Recipients, daily digest, alert preferences
- **Calendar Sync** - Connect to CalDAV (Nextcloud, Radicale, etc.)
- **Dashboard** - Refresh intervals, display options
- **Notification Preferences** - Which alerts go to email, calendar, or dashboard

### Initial Setup (one-time)

The `.env` file only needs to be edited once during initial setup for API keys and location:

```bash
nano /opt/isaac/backend/.env
```

```bash
# Your location (for sunrise/sunset calculations)
TIMEZONE=America/New_York
LATITUDE=28.5383
LONGITUDE=-81.3792

# Ambient Weather API (optional - for weather station integration)
# Get keys from: https://ambientweather.net/account
AWN_API_KEY=your_api_key
AWN_APP_KEY=your_app_key

# Email Server (for sending notifications)
# Gmail: Use App Password from https://myaccount.google.com/apppasswords
# Protonmail: Use SMTP token from Settings > IMAP/SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

After editing `.env`, restart once:
```bash
sudo systemctl restart isaac-backend
```

All other settings (alert thresholds, recipients, schedules) are managed through the web interface.

---

## Kiosk Mode Setup (Raspberry Pi)

For a dedicated dashboard display:

```bash
# Install display dependencies
sudo apt install -y chromium-browser xserver-xorg x11-xserver-utils xinit openbox

# Install kiosk service
sudo cp /opt/isaac/deploy/isaac-kiosk.service /etc/systemd/system/
sudo systemctl enable isaac-kiosk

# Set Pi to auto-login to desktop
sudo raspi-config
# Choose: System Options > Boot / Auto Login > Desktop Autologin

sudo reboot
```

---

## Updating

```bash
cd /opt/isaac
git pull

# Update backend
cd backend
source venv/bin/activate
pip install -r requirements.txt

# Rebuild frontend
cd ../frontend
npm install
npm run build

# Restart
sudo systemctl restart isaac-backend
```

---

## Troubleshooting

### Check if backend is running
```bash
sudo systemctl status isaac-backend
```

### View logs
```bash
# Backend logs
tail -f /opt/isaac/logs/backend.log

# Error logs
tail -f /opt/isaac/logs/backend-error.log
```

### Database location
The SQLite database is stored at `/opt/isaac/data/isaac.db`

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
        print('All users deleted. Visit the web UI to create a new admin.')

asyncio.run(reset())
"
sudo systemctl restart isaac-backend
```

---

## Documentation

Comprehensive documentation is available in the [Wiki](https://github.com/n0mad1k/isaac/wiki).

### API Documentation

When running, API docs are available at:
- Swagger UI: `http://isaac.local/api/docs`
- ReDoc: `http://isaac.local/api/redoc`

---

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

---

## License

This project is licensed under the **Commons Clause License** (based on MIT).

**Free for personal, non-commercial use.** If you want to use Isaac for commercial purposes (selling the software, offering it as a service, etc.), please contact me for a commercial license.

See [LICENSE](LICENSE) for details.

---

## Support

- **Issues:** [GitHub Issues](https://github.com/n0mad1k/isaac/issues)
- **Discussions:** [GitHub Discussions](https://github.com/n0mad1k/isaac/discussions)

---

Made with ❤️ for farmers and homesteaders
