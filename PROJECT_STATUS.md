# Levi - Farm & Homestead Assistant

## Overview
Levi is a Raspberry Pi-based home assistant designed to help manage a farm/homestead in Zone 9b Florida. It runs as a kiosk dashboard on the Pi's display and provides weather monitoring, plant/animal tracking, task management, and automated alerts.

## Hardware
- **Device:** Raspberry Pi 5 (8GB RAM)
- **OS:** Raspberry Pi OS (Debian Trixie)
- **Hostname:** levi.local
- **User:** n0mad1k
- **SSH Key:** ~/.ssh/levi
- **Display:** 1920x1080 HDMI (kiosk mode via Chromium)

## Architecture

### Backend (Python FastAPI)
- **Location on Pi:** /opt/levi/backend
- **Service:** levi-backend.service (systemd)
- **Port:** 8000 (proxied through nginx)
- **Database:** SQLite with async SQLAlchemy (aiosqlite)
- **Scheduler:** APScheduler for background tasks

### Frontend (React + Vite)
- **Location on Pi:** /opt/levi/frontend
- **Build output:** /opt/levi/frontend/dist
- **Served by:** nginx on port 80
- **Styling:** TailwindCSS

### Services
- **nginx:** Reverse proxy (frontend + API)
- **lightdm:** Display manager with autologin
- **openbox:** Window manager for kiosk
- **chromium:** Fullscreen kiosk browser

## Configuration

### Environment Variables (/opt/levi/backend/.env)
```
AWN_API_KEY=d20849bc52e6407bb7a5d0599d1824e813bd2ed19b9d4b38a816318fbb29f03a
AWN_APP_KEY=6ad3ccbfd7f94d70869657bea381d57599ef7d028c7e4ddb91d79ef64b0e46e9
TIMEZONE=America/New_York
USDA_ZONE=9b
WEATHER_POLL_INTERVAL=300
```

### Weather Integration
- **Provider:** Ambient Weather Network (AWN)
- **Polling:** Every 5 minutes (configurable)
- **Data:** Temperature, humidity, wind, rain, UV index

---

## Current Status: DEPLOYED & RUNNING

### Completed Features

1. **Kiosk Mode Dashboard**
   - Full-screen Chromium browser on boot
   - Auto-login to graphical session
   - Bottom navigation bar (Home, Plants, Animals, Tasks, Seeds, Calendar)
   - Current date/time display
   - Auto-refresh every 5 minutes

2. **Weather Widget**
   - Live data from AWN station
   - Temperature, humidity, wind speed/direction
   - Rain today, UV index
   - High/low temps
   - NWS 7-day forecast integration
   - Weather alerts from NWS

3. **Database Models**
   - Plants (with categories, frost sensitivity, care logs)
   - Seeds (comprehensive planting requirements catalog)
   - Animals (horses, cattle - farrier/worming tracking)
   - Tasks (recurring, one-time, maintenance with CalDAV sync)
   - Weather readings and alerts

4. **API Endpoints**
   - /api/dashboard - Main dashboard data
   - /api/plants - CRUD for plants
   - /api/seeds - CRUD for seed catalog with stats/categories
   - /api/animals - CRUD for animals
   - /api/tasks - Task management with CalDAV integration
   - /api/weather - Weather data, forecast, and alerts

5. **Frontend Pages**
   - Dashboard with weather, forecast, stats, calendar, tasks
   - Plants page with add/filter/care logging
   - **Seeds page** - Full seed catalog with 70 seeds:
     - Comprehensive planting requirements (germination, maturity, depth, spacing)
     - Growing conditions (sun, water, soil, pH)
     - Florida Zone 9b specific info (spring/fall planting windows)
     - Characteristics (perennial, native, medicinal, culinary, etc.)
     - Search and category filtering
     - Expandable detail view
   - Animals page with add/filter/care logging
   - Tasks page with task management
   - Calendar page with month view

6. **Security**
   - API restricted to local network only (192.168.x.x, 10.x.x.x, 127.x.x.x)
   - SSH hardened (password auth disabled, key-only)
   - LocalNetworkOnlyMiddleware blocks external access

7. **CalDAV Integration**
   - Task sync to external calendar (Nextcloud/Radicale)
   - Configurable CalDAV URL in .env

---

## TODO: Features Still Needed

### High Priority

1. **Weather Alerts System**
   - [ ] Frost warning alerts (temp < 35F)
   - [ ] Freeze warning alerts (temp < 32F)
   - [ ] Heat warning alerts (temp > 95F)
   - [ ] Wind warning alerts (> 25 mph)
   - [ ] Heavy rain alerts (> 2" expected)
   - [ ] Alert banner on dashboard
   - [ ] List frost-sensitive plants needing cover

2. **Email Notifications**
   - [ ] Configure SMTP in .env (Gmail app password)
   - [ ] Daily digest email (morning summary)
   - [ ] Weather alert emails
   - [ ] Task reminder emails
   - [ ] Overdue task notifications

3. **Plant Management**
   - [x] Seed inventory tracking (70 seeds in catalog)
   - [x] Planting schedule by zone (9b Florida) - spring/fall windows per seed
   - [ ] "When to plant" recommendations
   - [ ] Watering reminders based on weather
   - [ ] Frost protection reminders

4. **Animal Management**
   - [ ] Horse farrier schedule tracking (every 6-8 weeks)
   - [ ] Horse worming schedule tracking
   - [ ] Steer slaughter scheduling
   - [ ] Care log history view

5. **Task System**
   - [ ] Recurring task templates
   - [ ] Florida home maintenance tasks:
     - A/C drain line cleaning (monthly)
     - Gutter cleaning (quarterly)
     - HVAC filter changes
   - [ ] Task categories and filtering
   - [ ] Overdue task highlighting

### Medium Priority

6. **Calendar Improvements**
   - [ ] Show tasks on calendar dates
   - [ ] Week view option
   - [ ] Click date to see/add tasks

7. **Dashboard Enhancements**
   - [ ] Weather forecast (if AWN supports)
   - [ ] Sunrise/sunset times
   - [ ] Moon phase (for planting)
   - [ ] Quick-add task button

8. **Data Entry**
   - [ ] Import existing plants/animals
   - [x] Bulk add seeds from catalog (70 seeds added)
   - [x] Pre-populated Florida Zone 9b seed database with medicinal, native, tropical varieties

### Low Priority

9. **Quality of Life**
   - [ ] Touch-friendly larger buttons
   - [ ] Dark mode (already dark, maybe light option)
   - [ ] Settings page
   - [ ] Backup/restore database

10. **Future Ideas**
    - [ ] Voice control integration
    - [ ] Camera feeds
    - [ ] Soil moisture sensors
    - [ ] Irrigation control

---

## Development Workflow

### Local Development (on dev machine)
```bash
# Files are in:
/home/n0mad1k/Tools/levi/

# Deploy to Pi:
./scripts/quick-deploy.sh
# OR manually:
rsync -avz backend/ levi:/opt/levi/backend/ --exclude venv --exclude __pycache__
rsync -avz frontend/src/ levi:/opt/levi/frontend/src/
ssh levi 'cd /opt/levi/frontend && npm run build'
```

### On the Pi
```bash
# SSH in
ssh levi

# Restart backend
sudo systemctl restart levi-backend

# View backend logs
tail -f /opt/levi/logs/backend.log

# Restart kiosk/display
sudo systemctl restart lightdm

# Refresh browser
DISPLAY=:0 xdotool key F5
```

### File Structure
```
/home/n0mad1k/Tools/levi/
├── backend/
│   ├── main.py              # FastAPI app with security middleware
│   ├── config.py            # Settings/env vars
│   ├── models/              # SQLAlchemy models
│   │   ├── database.py
│   │   ├── plants.py
│   │   ├── seeds.py         # Seed catalog model
│   │   ├── livestock.py     # Animals model
│   │   ├── tasks.py
│   │   └── weather.py
│   ├── routers/             # API endpoints
│   │   ├── dashboard.py
│   │   ├── plants.py
│   │   ├── seeds.py         # Seed catalog CRUD
│   │   ├── animals.py
│   │   ├── tasks.py
│   │   └── weather.py
│   ├── services/            # Business logic
│   │   ├── weather.py       # AWN + NWS API integration
│   │   ├── email.py         # SMTP notifications
│   │   └── scheduler.py     # Background jobs
│   ├── scripts/             # Utility scripts
│   │   ├── migrate_seeds.py # Seed migration script
│   │   └── add_seeds.py     # Original seed import
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/           # Dashboard, Plants, Animals, Tasks, Seeds, Calendar
│   │   ├── components/      # WeatherWidget, TaskList, etc.
│   │   └── services/api.js  # Axios API client
│   ├── package.json
│   └── vite.config.js
├── deploy/
│   ├── levi-backend.service
│   ├── levi-kiosk.service
│   ├── kiosk.sh
│   └── nginx-levi.conf
├── scripts/
│   ├── quick-deploy.sh
│   ├── deploy-to-pi.sh
│   └── setup-pi.sh
└── PROJECT_STATUS.md        # This file
```

---

## Quick Start for New Session

1. **Check current status:**
   ```bash
   ssh levi 'systemctl status levi-backend --no-pager'
   ```

2. **View the dashboard:**
   - Open browser to http://levi.local
   - Or view on Pi's connected monitor

3. **Make changes:**
   - Edit files in /home/n0mad1k/Tools/levi/
   - Fix permissions: `chown -R n0mad1k:n0mad1k /home/n0mad1k/Tools/levi/`
   - Sync to Pi as n0mad1k user

4. **Key issues to watch:**
   - Files created as root need `chown` before rsync
   - API endpoints need trailing slashes (axios interceptor handles this)
   - Use `chromium` not `chromium-browser` on Debian Trixie

---

## Recent Changes (December 31, 2025)

### Seed Catalog System
- Created dedicated Seeds model with comprehensive fields:
  - Planting requirements (germination, maturity, depth, spacing)
  - Growing conditions (sun, water, soil type, pH range)
  - Florida Zone 9b windows (spring/fall planting, indoor start)
  - Characteristics (perennial, native, frost sensitive, heat tolerant, drought tolerant)
  - Uses (medicinal, culinary, ornamental)
  - Notes fields (growing, harvest, medicinal, general)
- Created Seeds API with CRUD, stats, and category endpoints
- Created Seeds frontend page with expandable list view and add/edit form
- Added 70 seeds to catalog including:
  - 36 medicinal herbs (Arnica, Ashwagandha, Echinacea, etc.)
  - 14 Florida native plants (Florida Calamint, Beautyberry, etc.)
  - 15 tropical/Caribbean varieties (Moringa, Pigeon Pea, Seminole Pumpkin, etc.)
  - 5 Florida-adapted vegetables

### Security Hardening
- Added LocalNetworkOnlyMiddleware to restrict API to local network
- SSH configured for key-only authentication (password disabled)
- Fixed trailing slash redirects causing 307 errors

### Bug Fixes
- Fixed Tasks page blank screen (trailing slash middleware)
- Fixed Weather forecast "unavailable" error
- Fixed API 307 redirects through nginx

---

## Contact/Notes
- Location: Zone 9b Florida
- Weather Station: Ambient Weather Network
- Last Updated: December 31, 2025
