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
| **Weather** | Ambient Weather station integration, automatic frost/freeze/heat alerts |
| **CalDAV** | Bi-directional sync with iPhone/Android calendars |
| **Email** | Daily digest, task reminders, weather alerts, invoice delivery |
| **AI Assistant** | Built-in chat with Claude, ChatGPT, or Ollama for farm questions |
| **Kiosk Mode** | Full-screen dashboard display for dedicated screens |

---

## Quick Start

### Hardware Requirements

**Option 1: Raspberry Pi (Recommended)**
- Raspberry Pi 4 or 5 (4GB+ RAM)
- 32GB+ microSD card (Class A2)
- Official power supply

**Option 2: Cloud VPS**
- Any provider (Linode, DigitalOcean, Vultr)
- 1GB RAM minimum
- Ubuntu 22.04+

### Installation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y python3-pip python3-venv nodejs npm nginx git

# Clone repository
sudo mkdir -p /opt/isaac
sudo chown $USER:$USER /opt/isaac
git clone https://github.com/n0mad1k/isaac.git /opt/isaac

# Setup backend
cd /opt/isaac/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
nano .env  # Edit with your settings

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
sudo ln -sf /etc/nginx/sites-available/isaac /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### Access Your Dashboard

Open a browser and go to: `http://isaac.local` (or your server's IP)

On first load, you'll be prompted to create an admin account.

---

## Configuration

### Environment Variables (.env)

Edit `/opt/isaac/backend/.env` with your settings:

```bash
# Location (for sunrise/sunset and weather)
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

# AI Assistant (optional - choose one)
ANTHROPIC_API_KEY=your_claude_key
OPENAI_API_KEY=your_openai_key
# Or configure Ollama URL in Settings
```

### Web Settings

Most settings are configured through the web interface at **Settings**:

- Weather alert thresholds (frost, freeze, heat, wind)
- Email recipients and daily digest schedule
- CalDAV calendar sync
- AI provider selection
- Dashboard display options
- User roles and permissions

---

## Key Features Explained

### CalDAV Calendar Sync

Isaac syncs bidirectionally with your phone's calendar:
- Tasks created in Isaac appear on your phone
- Events created on your phone appear in Isaac
- Completing tasks on either side syncs automatically
- Works with any CalDAV server (Nextcloud, Radicale, iCloud, etc.)

Configure in **Settings > Calendar**.

### Weather Alerts

Connect your Ambient Weather station for:
- Real-time local conditions on dashboard
- Automatic frost/freeze warnings (protect tender plants)
- Heat alerts for livestock
- Wind and rain notifications

### Worker Management

Manage external workers (maids, contractors, farm hands):
- Assign tasks with automatic translation (Spanish supported)
- Track visits and completed work
- Supply request system
- Email task lists in worker's language

### Farm Finances

Full farm business management:
- Customer database with contact info
- Orders with line items and payment tracking
- Automated invoice scheduling and delivery
- Expense tracking with categories
- Production allocation (sold vs personal use)

### Team Health Tracking

Track household member health and fitness:
- Weight, blood pressure, body measurements
- Workout logging with training load analysis
- Readiness scores based on recovery
- Child growth percentiles and milestones
- Sick day tracking with fitness score adjustment

---

## Kiosk Mode (Raspberry Pi)

For a dedicated dashboard display:

```bash
# Install display dependencies
sudo apt install -y chromium-browser xserver-xorg xinit openbox

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

## API Documentation

When running, API docs are available at:
- Swagger UI: `http://isaac.local/api/docs`
- ReDoc: `http://isaac.local/api/redoc`

---

## Troubleshooting

### Check service status
```bash
sudo systemctl status isaac-backend
```

### View logs
```bash
tail -f /opt/isaac/logs/backend.log
tail -f /opt/isaac/logs/backend-error.log
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
