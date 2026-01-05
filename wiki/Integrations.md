# Integrations

Isaac connects with external services for weather, calendars, and plant data.

## Weather: Ambient Weather Network

### What It Does
- Retrieves real-time weather from your personal weather station
- Updates every 5 minutes
- Provides local conditions more accurate than regional forecasts

### Requirements
- Ambient Weather compatible weather station
- Station connected to AmbientWeather.net
- API credentials

### Setup
1. Log in at [ambientweather.net](https://ambientweather.net)
2. Go to Account > API Keys
3. Create an Application Key if you don't have one
4. Copy your API Key and App Key
5. In Isaac Settings > Weather Integration:
   - Enter AWN API Key
   - Enter AWN App Key
6. Save - weather should appear within 5 minutes

### Supported Data
- Temperature (indoor/outdoor)
- Humidity (indoor/outdoor)
- Wind speed, gust, direction
- Barometric pressure
- Rain rate (hourly, daily)
- UV index
- Solar radiation

---

## Weather: National Weather Service

### What It Does
- Provides weather forecasts
- Used for cold protection predictions
- No account required

### Setup
Just configure your latitude and longitude in Settings > Location.

### Data Used
- Multi-day forecasts
- High/low temperatures
- Forecast descriptions

---

## Calendar: CalDAV

### What It Does
- Bi-directional sync with calendar apps
- Events appear on your phone/computer calendar
- Changes sync back to Isaac
- Supports events (VEVENT) and reminders (VTODO)

### Compatible Services

| Service | URL Format |
|---------|------------|
| Radicale (local) | http://localhost:5232 |
| Nextcloud | https://your.nextcloud/remote.php/dav |
| iCloud | https://caldav.icloud.com |
| Proton Calendar | https://calendar.proton.me/api/calendar/v1 |
| Google Calendar | Requires OAuth (not directly supported) |
| Fastmail | https://caldav.fastmail.com |

### Setup

1. In Isaac Settings > Calendar Sync:
   - Enable Calendar Sync
   - Enter CalDAV URL
   - Enter Username
   - Enter Password (use app-specific password if available)
   - Enter Calendar Name

2. Click "Test Calendar Sync" to verify connection

3. Save settings

### Using with Radicale (Recommended)

Radicale is a simple, self-hosted CalDAV server.

**Install on same Pi:**
```bash
sudo apt install radicale
sudo systemctl enable radicale
sudo systemctl start radicale
```

**Configure Isaac:**
- URL: http://127.0.0.1:5232
- Username: your username
- Password: your password
- Calendar Name: Isaac (or any name)

### Sync Behavior

**From Isaac to Calendar:**
- New tasks/events push to calendar
- Completions sync
- Updates sync
- Deletions sync

**From Calendar to Isaac:**
- New events created on phone import to Isaac
- Completions sync back
- Deletions are respected (task marked inactive)

### What Syncs

| Isaac Item | Calendar Format |
|------------|-----------------|
| Events | VEVENT |
| Reminders/Todos | VTODO |
| Due dates | DTSTART |
| Times | DTSTART/DTEND |
| Priority | RFC 5545 priority mapping |
| Completion | STATUS: COMPLETED |

### Troubleshooting CalDAV

**"Connection refused"**
- Check URL is correct
- Verify CalDAV server is running
- Check firewall allows connection

**"Authentication failed"**
- Verify username/password
- Try app-specific password
- Check server authentication settings

**"Calendar not found"**
- Verify calendar name matches exactly
- Check you have access to that calendar
- Isaac can create the calendar if it doesn't exist

---

## Plant Data: Import Sources

### PFAF (Plants for a Future)

Website: [pfaf.org](https://pfaf.org)

**To import:**
1. Find a plant on PFAF
2. Copy the URL (e.g., https://pfaf.org/user/Plant.aspx?LatinName=Malus+domestica)
3. In Isaac, go to Plants > Import
4. Paste URL
5. Preview extracted data
6. Create plant

**Data extracted:**
- Name and Latin name
- Grow zones
- Sun requirements
- Size (height/width)
- Soil preferences
- Frost sensitivity
- Uses (edible, medicinal, etc.)
- Propagation methods

### Permapeople

Website: [permapeople.org](https://permapeople.org)

**To import:**
1. Find a plant on Permapeople
2. Copy the URL
3. In Isaac, go to Plants > Import
4. Paste URL
5. Preview and create

**Data extracted:**
- Similar to PFAF
- Growth rate
- Drought tolerance
- Growing conditions

---

## Email Notifications

### What It Does
- Sends weather alerts
- Daily digest emails
- Task reminders
- Care due notifications

### Setup

1. Configure SMTP server in Settings > Email Server:
   - SMTP Host
   - SMTP Port (usually 587 for TLS)
   - SMTP User (your email)
   - SMTP Password

2. Configure notifications in Settings > Email Notifications:
   - Enable/disable email alerts
   - Add recipient addresses
   - Set daily digest time

### Email Providers

**Gmail:**
- Host: smtp.gmail.com
- Port: 587
- Password: Use [App Password](https://myaccount.google.com/apppasswords)

**Protonmail:**
- Host: smtp.protonmail.ch
- Port: 587
- Password: Use SMTP token from Proton settings

**Outlook/Office 365:**
- Host: smtp.office365.com
- Port: 587

**Custom SMTP:**
- Use your provider's SMTP settings

### Test Email

Click "Test Cold Protection Email" in Settings to verify your SMTP configuration works.

---

## API Access

Isaac exposes a REST API for custom integrations.

### Documentation
When running, API docs are available at:
- Swagger UI: http://isaac.local/api/docs
- ReDoc: http://isaac.local/api/redoc

### Authentication
Use Bearer token authentication:
```
Authorization: Bearer <your_session_token>
```

Get token by logging in via /auth/login endpoint.
