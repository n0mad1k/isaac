# Isaac/Levi Deployment Guide

## Quick Start

### On the Raspberry Pi:

1. **Clone or copy the project** to `/opt/levi/`

2. **Run the setup script:**
   ```bash
   cd /opt/levi/deploy
   sudo ./install.sh
   ```

3. **Configure your settings:**
   ```bash
   nano /opt/levi/backend/.env
   ```

4. **Start the service:**
   ```bash
   sudo systemctl start levi-backend
   ```

5. **Access the dashboard:**
   - Local: http://levi.local:8000
   - With SSL: https://levi.local:8000

---

## Setup Options

### Basic Setup (no external access)
```bash
sudo ./setup.sh
```

### With SSL Certificates (recommended)
```bash
sudo ./setup.sh --with-ssl
```

### With Cloudflare Tunnel (for remote access)
```bash
sudo ./setup.sh --with-cloudflare
```

### Full Setup (recommended)
```bash
sudo ./setup.sh --with-ssl --with-cloudflare
```

---

## Required Configuration

Edit `/opt/levi/backend/.env` with your settings:

### Weather (Required)
Get API keys from: https://ambientweather.net/account
```
AWN_API_KEY=your_api_key
AWN_APP_KEY=your_app_key
```

### Location (Required)
For sunrise/sunset calculations:
```
LATITUDE=28.5383
LONGITUDE=-81.3792
```

### Email Notifications (Recommended)
For Protonmail SMTP:
```
SMTP_HOST=smtp.protonmail.ch
SMTP_PORT=587
SMTP_USER=your_email@protonmail.com
SMTP_PASSWORD=your_smtp_token
```

---

## Optional Features

### Translation (DeepL)
Get a free API key: https://www.deepl.com/pro-api
```
DEEPL_API_KEY=your_key:fx
```
Then enable in Settings > Display Settings > Translation

### Cloudflare Tunnel
1. Create a tunnel in Cloudflare Zero Trust dashboard
2. Get the tunnel token
3. Install with: `sudo cloudflared service install <TOKEN>`

### Calendar Sync (CalDAV)
```
CALDAV_URL=http://127.0.0.1:5232
CALDAV_USERNAME=user
CALDAV_PASSWORD=password
```

---

## Service Management

```bash
# Start/Stop/Restart
sudo systemctl start levi-backend
sudo systemctl stop levi-backend
sudo systemctl restart levi-backend

# View logs
journalctl -u levi-backend -f

# Check status
sudo systemctl status levi-backend

# Enable/Disable auto-start
sudo systemctl enable levi-backend
sudo systemctl disable levi-backend
```

---

## Directory Structure

```
/opt/levi/
├── backend/          # Python FastAPI backend
│   ├── venv/         # Python virtual environment
│   ├── data/         # SQLite database
│   ├── logs/         # Application logs
│   └── .env          # Configuration
├── frontend/         # React frontend
│   └── dist/         # Built frontend files
├── deploy/           # Deployment scripts
├── certs/            # SSL certificates
└── logs/             # Service logs
```

---

## Troubleshooting

### Backend won't start
```bash
# Check logs
journalctl -u levi-backend -n 50

# Test manually
cd /opt/levi/backend
source venv/bin/activate
python -c "import main"
```

### Frontend not loading
```bash
# Rebuild frontend
cd /opt/levi/frontend
npm install
npm run build
```

### Database issues
```bash
# Check database
sqlite3 /opt/levi/backend/data/levi.db ".tables"

# Backup database
cp /opt/levi/backend/data/levi.db /opt/levi/backend/data/levi.db.backup
```

### Permission issues
```bash
sudo chown -R n0mad1k:n0mad1k /opt/levi
```
