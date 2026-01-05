# Dashboard

The dashboard is your central hub for farm operations, providing at-a-glance information about everything happening on your homestead.

## Layout

The dashboard is organized into several sections:

### Header Section
- **Current Date & Time** - Live clock display
- **Bible Verse** - Daily inspirational verse (translation configurable)
- **Quick Stats** - Four cards showing:
  - Total plants
  - Total animals
  - Tasks due today
  - Overdue tasks (highlighted in red when > 0)

### Alerts Section
Priority alerts appear at the top:
- **Weather Alerts** - Frost, freeze, heat, wind, rain warnings
- **Storage Alerts** - Only shows when disk usage exceeds thresholds
- **Cold Protection Widget** - Shows plants needing protection when freeze is forecasted

### Main Content Grid

#### Left Column
- **Weather Widget** - Current conditions from your weather station
  - Temperature (current, feels like, high/low)
  - Humidity, wind speed and direction
  - Rain today, UV index
  - Last update time

- **Animal Feed Widget** - Daily feeding schedule
  - Lists animals with their feed requirements
  - Feed type, amount, and frequency

#### Right Column
- **Today's Schedule** - Tasks due today
  - Time and location when specified
  - Complete/incomplete toggle
  - Click to edit

- **To Do List** - Undated todos
  - Only shows when there are items
  - Quick complete toggle

## Auto-Refresh

The dashboard automatically refreshes every 5 minutes (configurable in Settings). The clock updates every second.

## Cold Protection Widget

When the forecast shows temperatures near freezing, this widget appears showing:
- Current temperature
- Forecast low
- List of frost-sensitive plants needing protection
- Each plant's cold tolerance threshold

The widget uses a 7-degree buffer to account for forecast error (NOAA forecasts tend to be optimistic about lows).

## Storage Monitoring

The storage widget only appears when disk usage exceeds warning thresholds:
- **Warning** (yellow) - Default 80% usage
- **Critical** (red) - Default 95% usage

Shows disk usage breakdown including database and log file sizes.
