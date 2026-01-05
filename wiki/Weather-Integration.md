# Weather Integration

Isaac integrates with weather services to provide current conditions and smart alerts.

## Data Sources

### Ambient Weather Network
Personal weather station integration for real-time local conditions.

**Data Available:**
- Temperature (outdoor and indoor)
- Feels-like temperature
- Humidity (outdoor and indoor)
- Wind speed, gust, and direction
- Barometric pressure
- Rain rate (hourly and daily)
- UV index
- Solar radiation

**Setup:**
1. Get API credentials from [ambientweather.net/account](https://ambientweather.net/account)
2. Enter API Key and App Key in Settings
3. Weather updates automatically every 5 minutes

### National Weather Service
Forecast data from the NWS API (no account needed).

**Data Available:**
- Multi-day forecasts
- High and low temperatures
- Forecast text/descriptions
- Used for cold protection alerts

## Weather Alerts

Automatic alerts based on configurable thresholds:

### Frost Warning
- **Default**: 35°F
- Warns when temperature approaches frost
- Triggers cold protection for sensitive plants

### Freeze Warning
- **Default**: 32°F
- Hard freeze alert
- Recommendations: disconnect hoses, cover spigots, protect pipes

### Heat Warning
- **Default**: 95°F
- Extreme heat alert
- Consider animal welfare, watering needs

### Wind Warning
- **Default**: 25 mph
- High wind alert
- Secure loose items, check structures

### Rain Warning
- **Default**: 2.0 inches daily
- Heavy rain alert
- Monitor drainage, postpone outdoor work

## Alert Severity Levels

| Level | Meaning |
|-------|---------|
| Low | Advisory - be aware |
| Moderate | Action may be needed |
| High | Action recommended |
| Extreme | Immediate action required |

## Cold Protection

Isaac provides intelligent cold protection recommendations:

### How It Works
1. Gets forecast low temperature from NWS
2. Applies buffer (default 7°F) for forecast error
3. Compares against plant cold tolerance thresholds
4. Shows plants needing protection on dashboard

### Cold Protection Widget
When freeze conditions are forecasted:
- Shows current temperature
- Shows forecast low
- Lists frost-sensitive plants
- Shows each plant's tolerance threshold

### Why the Buffer?
NOAA forecasts tend to be optimistic about low temperatures. The 7-degree buffer accounts for:
- Microclimates on your property
- Radiative cooling on clear nights
- Forecast uncertainty

## Freeze Recommendations

When freeze warning is active:
- Disconnect and drain outdoor hoses
- Cover outdoor spigots/faucets
- Drain irrigation lines if needed
- Open cabinet doors for exposed pipes
- Let faucets drip overnight
- Cover sensitive plants
- Bring in potted plants
- Check animal shelter and water

## Animal Cold Alerts

For cold-sensitive animals:
- Compares forecast to animal's minimum temperature
- Checks blanket threshold
- Shows animals needing blankets on dashboard
- Integrates with weather alerts

## Configuring Thresholds

In Settings > Weather & Alerts:

| Setting | Default | Description |
|---------|---------|-------------|
| Frost Warning | 35°F | Temperature for frost alert |
| Freeze Warning | 32°F | Temperature for freeze alert |
| Heat Warning | 95°F | Temperature for heat alert |
| Wind Warning | 25 mph | Wind speed for alert |
| Rain Warning | 2.0" | Daily rainfall for alert |
| Cold Buffer | 7°F | Buffer for forecast error |

## Weather History

Isaac stores weather readings:
- Up to 7 days (168 hours) of history
- Daily summaries with high/low/rainfall
- Used for trends and analysis
- Automatic cleanup of old data

## Troubleshooting

### No Weather Data
1. Check Ambient Weather API credentials in Settings
2. Verify your weather station is online at ambientweather.net
3. Check the backend logs for API errors

### Incorrect Location
1. Verify latitude/longitude in Settings
2. Location affects NWS forecast region
3. Use decimal degrees (e.g., 28.5383, -81.3792)

### Stale Data
- Weather auto-refreshes every 5 minutes
- Click refresh button for immediate update
- Check "last updated" timestamp on widget
