# Settings & Configuration

Most Isaac configuration is done through the web interface.

## Accessing Settings

1. Log in as an admin user
2. Click the gear icon or navigate to Settings
3. Expand sections to view/edit settings

## Settings Categories

### Location Settings

| Setting | Description | Example |
|---------|-------------|---------|
| Timezone | Your timezone | America/New_York |
| Latitude | Farm latitude | 28.5383 |
| Longitude | Farm longitude | -81.3792 |
| USDA Zone | Hardiness zone | 9b |

Location is used for:
- Weather forecasts
- Sunrise/sunset calculations
- Growing zone recommendations

### Weather Integration

| Setting | Description |
|---------|-------------|
| AWN API Key | Ambient Weather API key |
| AWN App Key | Ambient Weather application key |

Get credentials at [ambientweather.net/account](https://ambientweather.net/account)

### Weather Alert Thresholds

| Setting | Default | Description |
|---------|---------|-------------|
| Frost Warning | 35°F | Temperature to trigger frost alert |
| Freeze Warning | 32°F | Temperature to trigger freeze alert |
| Heat Warning | 95°F | Temperature to trigger heat alert |
| Wind Warning | 25 mph | Wind speed to trigger alert |
| Rain Warning | 2.0" | Daily rainfall to trigger alert |
| Cold Buffer | 7°F | Buffer for forecast error |

### Email Server (SMTP)

| Setting | Description | Example |
|---------|-------------|---------|
| SMTP Host | Mail server | smtp.gmail.com |
| SMTP Port | Server port | 587 |
| SMTP User | Username/email | you@gmail.com |
| SMTP Password | Password or app password | xxxxxxxx |
| SMTP From | Sender address | isaac@yourfarm.com |

**For Gmail:** Use an [App Password](https://myaccount.google.com/apppasswords)
**For Protonmail:** Use SMTP token from Settings > IMAP/SMTP

### Email Notifications

| Setting | Default | Description |
|---------|---------|-------------|
| Email Alerts | Enabled | Master toggle for email |
| Recipients | (empty) | Comma-separated addresses |
| Daily Digest | Enabled | Morning summary email |
| Digest Time | 06:30 | When to send digest |

### Calendar Sync (CalDAV)

| Setting | Description |
|---------|-------------|
| Calendar Enabled | Toggle sync on/off |
| CalDAV URL | Server URL (e.g., http://localhost:5232) |
| Username | Calendar account username |
| Password | Calendar password |
| Calendar Name | Which calendar to sync |
| Sync Interval | Minutes between syncs |

See [Integrations](Integrations.md) for detailed setup.

### Dashboard Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Refresh Interval | 5 min | Auto-refresh frequency (0 = off) |
| Bible Translation | NKJV | ESV, NKJV, KJV, NIV, NLT, NASB |

### Notification Preferences

Configure which notifications go where for each category:

**Channels:**
- Dashboard (always visible on main screen)
- Email (sends notification)
- Calendar (creates calendar event)

**Categories:**

| Category | Notification Types |
|----------|-------------------|
| Animal Care | Hoof trim, worming, vaccination, dental, vet, slaughter, labor |
| Plant Care | Watering, fertilizing, harvest, pruning, sowing |
| Maintenance | Equipment, vehicles, home, farm areas |

### Storage Monitoring

| Setting | Default | Description |
|---------|---------|-------------|
| Warning Threshold | 80% | Disk usage for warning |
| Critical Threshold | 95% | Disk usage for critical alert |

**Clear Logs Button:** Deletes log files to free space.

## Initial Setup (One-Time)

Some settings require the `.env` file on first install:

```bash
# Location
LATITUDE=28.5383
LONGITUDE=-81.3792
TIMEZONE=America/New_York

# Weather API (optional)
AWN_API_KEY=your_key
AWN_APP_KEY=your_key

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASSWORD=app_password
```

After initial setup, all settings are managed through the web UI.

## Sensitive Settings

These settings are masked in the UI:
- Calendar password
- SMTP password
- AWN API key
- AWN App key

The actual values are stored but displayed as dots (••••••••).

## Resetting Settings

Individual settings can be reset to defaults:
1. Click the reset icon next to the setting
2. Confirm the reset

To reset all settings:
1. Scroll to bottom of Settings page
2. Click "Reset All to Defaults"
3. Confirm (this cannot be undone)

## Test Functions

### Test Cold Protection Email
Sends a test cold protection alert email to verify SMTP configuration.

### Test Calendar Sync
Tests connection to CalDAV server and creates a test event.

### Manual Calendar Sync
Forces an immediate bi-directional sync with the calendar server.
