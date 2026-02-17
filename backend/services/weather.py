"""
Weather Integration Service
- Ambient Weather Network for current conditions
- National Weather Service API for forecasts

Settings are loaded from the database with fallback to config for backwards compatibility.
"""

import httpx
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any, Tuple
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from config import settings as config_settings
from models.weather import WeatherReading, WeatherAlert, AlertSeverity
from models.settings import AppSetting


# Default thresholds (mirrors routers/settings.py)
DEFAULT_THRESHOLDS = {
    "frost_warning_temp": 35.0,
    "freeze_warning_temp": 32.0,
    "heat_warning_temp": 95.0,
    "wind_warning_speed": 25.0,
    "rain_warning_inches": 2.0,
}


async def get_threshold(db: AsyncSession, key: str) -> float:
    """Get a threshold value from the database, or return default"""
    result = await db.execute(
        select(AppSetting).where(AppSetting.key == key)
    )
    setting = result.scalar_one_or_none()
    if setting and setting.value is not None:
        try:
            return float(setting.value)
        except ValueError:
            pass
    return DEFAULT_THRESHOLDS.get(key, 0.0)


async def get_location_from_db(db: AsyncSession) -> Tuple[Optional[float], Optional[float]]:
    """
    Get latitude and longitude from database settings.
    Returns (latitude, longitude) tuple, or (None, None) if not configured.
    Falls back to config file values for backwards compatibility.
    """
    lat_result = await db.execute(
        select(AppSetting).where(AppSetting.key == "latitude")
    )
    lon_result = await db.execute(
        select(AppSetting).where(AppSetting.key == "longitude")
    )

    lat_setting = lat_result.scalar_one_or_none()
    lon_setting = lon_result.scalar_one_or_none()

    lat = None
    lon = None

    # Try DB settings first
    if lat_setting and lat_setting.value:
        try:
            lat = float(lat_setting.value)
        except ValueError:
            pass

    if lon_setting and lon_setting.value:
        try:
            lon = float(lon_setting.value)
        except ValueError:
            pass

    # Fall back to config for backwards compatibility
    if lat is None and config_settings.latitude:
        lat = config_settings.latitude
    if lon is None and config_settings.longitude:
        lon = config_settings.longitude

    return lat, lon


async def get_awn_keys_from_db(db: AsyncSession) -> Tuple[Optional[str], Optional[str]]:
    """
    Get Ambient Weather API keys from database settings.
    Returns (api_key, app_key) tuple.
    Falls back to config file values for backwards compatibility.
    Uses get_setting which handles decryption of encrypted values.
    """
    from routers.settings import get_setting

    api_key = await get_setting(db, "awn_api_key")
    app_key = await get_setting(db, "awn_app_key")

    # Fall back to config for backwards compatibility
    if not api_key and config_settings.awn_api_key:
        api_key = config_settings.awn_api_key
    if not app_key and config_settings.awn_app_key:
        app_key = config_settings.awn_app_key

    return api_key, app_key


class NWSForecastService:
    """National Weather Service API for forecasts"""

    BASE_URL = "https://api.weather.gov"

    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None
        self._grid_cache: Optional[Dict[str, str]] = None

    async def get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=30.0,
                follow_redirects=True,
                headers={"User-Agent": "(Isaac Farm Assistant, contact@example.com)"}
            )
        return self._client

    async def get_grid_info(self, lat: float, lon: float) -> Optional[Dict[str, str]]:
        """Get NWS grid point info for coordinates"""
        if self._grid_cache:
            return self._grid_cache

        client = await self.get_client()
        try:
            response = await client.get(f"{self.BASE_URL}/points/{lat},{lon}")
            response.raise_for_status()
            data = response.json()

            self._grid_cache = {
                "office": data["properties"]["gridId"],
                "gridX": data["properties"]["gridX"],
                "gridY": data["properties"]["gridY"],
                "forecast_url": data["properties"]["forecast"],
                "forecast_hourly_url": data["properties"]["forecastHourly"],
            }
            return self._grid_cache
        except Exception as e:
            logger.error(f"Failed to get NWS grid info: {e}")
            return None

    async def get_forecast(self, lat: float = None, lon: float = None) -> Optional[List[Dict[str, Any]]]:
        """Get 7-day forecast from NWS"""
        # Fall back to config settings if not provided (used when called without DB)
        lat = lat or config_settings.latitude
        lon = lon or config_settings.longitude

        if not lat or not lon:
            logger.warning("Location not configured - cannot get forecast")
            return None

        grid = await self.get_grid_info(lat, lon)
        if not grid:
            return None

        client = await self.get_client()
        try:
            response = await client.get(grid["forecast_url"])
            response.raise_for_status()
            data = response.json()

            forecasts = []
            periods = data["properties"]["periods"]

            # NWS returns day/night periods, we'll pair them
            for i, period in enumerate(periods[:10]):  # 5 days (day + night)
                # Extract precipitation probability (NWS returns as {"unitCode": "...", "value": X} or null)
                precip_prob = period.get("probabilityOfPrecipitation")
                rain_chance = 0
                if precip_prob and isinstance(precip_prob, dict):
                    rain_chance = precip_prob.get("value") or 0

                forecasts.append({
                    "name": period["name"],
                    "temperature": period["temperature"],
                    "temperature_unit": period["temperatureUnit"],
                    "wind_speed": period["windSpeed"],
                    "wind_direction": period["windDirection"],
                    "short_forecast": period["shortForecast"],
                    "detailed_forecast": period["detailedForecast"],
                    "is_daytime": period["isDaytime"],
                    "icon": period["icon"],
                    "start_time": period["startTime"],
                    "end_time": period["endTime"],
                    "rain_chance": rain_chance,
                })

            return forecasts
        except Exception as e:
            logger.error(f"Failed to get NWS forecast: {e}")
            return None

    async def get_forecast_simple(self, lat: float = None, lon: float = None) -> Optional[List[Dict[str, Any]]]:
        """Get simplified 5-day forecast (one entry per day)"""
        forecasts = await self.get_forecast(lat, lon)
        if not forecasts:
            return None

        # Group into days (combine day/night into single day entry)
        days = []
        i = 0
        while i < len(forecasts) and len(days) < 5:
            period = forecasts[i]

            day_entry = {
                "name": period["name"].replace(" Night", "").replace("Tonight", "Today"),
                "high": None,
                "low": None,
                "forecast": period["short_forecast"],
                "wind": period["wind_speed"],
                "icon": period["icon"],
                "rain_chance": period.get("rain_chance", 0),
            }

            if period["is_daytime"]:
                day_entry["high"] = period["temperature"]
                # Check if next period is night
                if i + 1 < len(forecasts) and not forecasts[i + 1]["is_daytime"]:
                    day_entry["low"] = forecasts[i + 1]["temperature"]
                    # Take max rain chance from day and night periods
                    night_rain = forecasts[i + 1].get("rain_chance", 0)
                    day_entry["rain_chance"] = max(day_entry["rain_chance"], night_rain)
                    i += 1
            else:
                day_entry["low"] = period["temperature"]
                # If starting with night, this is "Tonight"
                day_entry["name"] = "Tonight"

            days.append(day_entry)
            i += 1

        return days

    async def get_hourly_forecast(self, lat: float = None, lon: float = None) -> Optional[List[Dict[str, Any]]]:
        """Get hourly forecast from NWS (up to 156 hours)"""
        lat = lat or config_settings.latitude
        lon = lon or config_settings.longitude

        if not lat or not lon:
            logger.warning("Location not configured - cannot get hourly forecast")
            return None

        grid = await self.get_grid_info(lat, lon)
        if not grid or "forecast_hourly_url" not in grid:
            return None

        client = await self.get_client()
        try:
            response = await client.get(grid["forecast_hourly_url"])
            response.raise_for_status()
            data = response.json()

            forecasts = []
            periods = data["properties"]["periods"]

            for period in periods[:48]:  # Next 48 hours
                precip_prob = period.get("probabilityOfPrecipitation")
                rain_chance = 0
                if precip_prob and isinstance(precip_prob, dict):
                    rain_chance = precip_prob.get("value") or 0

                forecasts.append({
                    "start_time": period["startTime"],
                    "temperature": period["temperature"],
                    "short_forecast": period["shortForecast"],
                    "rain_chance": rain_chance,
                    "wind_speed": period["windSpeed"],
                    "is_daytime": period["isDaytime"],
                })

            return forecasts
        except Exception as e:
            logger.error(f"Failed to get NWS hourly forecast: {e}")
            return None

    async def get_rain_forecast(self, lat: float = None, lon: float = None) -> Dict[str, Any]:
        """
        Analyze hourly forecast to determine when rain is expected.
        Returns info about upcoming rain or clear conditions.
        Uses start_time from NWS periods for accurate time calculation.
        """
        hourly = await self.get_hourly_forecast(lat, lon)
        if not hourly:
            return {
                "has_data": False,
                "message": "Forecast unavailable"
            }

        # Use timezone-aware current time for accurate comparison
        now = datetime.now().astimezone()
        rain_keywords = ['rain', 'shower', 'storm', 'thunder', 'drizzle', 'precipitation']

        # Find first hour with rain in forecast text or high precipitation chance
        first_rain_entry = None
        for hour in hourly:
            forecast_lower = hour["short_forecast"].lower()
            has_rain_keyword = any(kw in forecast_lower for kw in rain_keywords)
            high_rain_chance = hour["rain_chance"] >= 40

            if has_rain_keyword or high_rain_chance:
                first_rain_entry = hour
                break

        if first_rain_entry is None:
            return {
                "has_data": True,
                "raining_now": False,
                "rain_expected": False,
                "hours_until_rain": None,
                "rain_chance": 0,
                "message": "No rain expected (48hr)"
            }

        # Calculate actual hours until rain using the period's start_time
        try:
            rain_start = datetime.fromisoformat(first_rain_entry["start_time"])
            diff = rain_start - now
            hours_until = max(0, int(diff.total_seconds() / 3600))
        except (ValueError, KeyError):
            # Fallback to index if start_time parsing fails
            hours_until = hourly.index(first_rain_entry)

        rain_hour = first_rain_entry

        if hours_until == 0:
            return {
                "has_data": True,
                "raining_now": True,
                "rain_expected": True,
                "hours_until_rain": 0,
                "rain_chance": rain_hour["rain_chance"],
                "forecast": rain_hour["short_forecast"],
                "message": f"Rain now ({rain_hour['rain_chance']}%)"
            }

        return {
            "has_data": True,
            "raining_now": False,
            "rain_expected": True,
            "hours_until_rain": hours_until,
            "rain_chance": rain_hour["rain_chance"],
            "forecast": rain_hour["short_forecast"],
            "message": f"Rain in {hours_until}hr ({rain_hour['rain_chance']}%)"
        }


class WeatherService:
    """Service for fetching and processing Ambient Weather data"""

    BASE_URL = "https://rt.ambientweather.net/v1"

    def __init__(self, api_key: str = None, app_key: str = None):
        """
        Initialize weather service.
        Keys can be passed directly or will fall back to config settings.
        For DB-based keys, use configure_from_db() method.
        """
        self.api_key = api_key or config_settings.awn_api_key
        self.app_key = app_key or config_settings.awn_app_key
        self._client: Optional[httpx.AsyncClient] = None

    async def configure_from_db(self, db: AsyncSession) -> None:
        """Load API keys from database settings"""
        api_key, app_key = await get_awn_keys_from_db(db)
        if api_key:
            self.api_key = api_key
        if app_key:
            self.app_key = app_key

    async def get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    async def close(self):
        if self._client:
            await self._client.aclose()

    async def fetch_current_weather(self) -> Optional[Dict[str, Any]]:
        """Fetch current weather from Ambient Weather API"""
        if not self.api_key or not self.app_key:
            logger.debug("Ambient Weather API keys not configured - using NWS forecast only")
            return None

        client = await self.get_client()
        url = f"{self.BASE_URL}/devices"
        params = {
            "apiKey": self.api_key,
            "applicationKey": self.app_key,
        }

        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            if data and len(data) > 0:
                # Get the most recent data from the first device
                device = data[0]
                if "lastData" in device:
                    return device["lastData"]

            logger.warning("No weather data returned from API")
            return None

        except httpx.HTTPStatusError as e:
            logger.error(f"Weather API HTTP error: {e.response.status_code} - {e.response.text[:200] if e.response.text else 'no body'}")
            return None
        except httpx.HTTPError as e:
            logger.error(f"Weather API error: {type(e).__name__} - {str(e) or 'timeout or connection error'}")
            return None

    def parse_reading(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Parse Ambient Weather API response into our format"""
        # Ambient Weather field mappings
        # See: https://github.com/ambient-weather/api-docs/wiki/Device-Data-Specs

        reading_time = datetime.fromtimestamp(data.get("dateutc", 0) / 1000)

        return {
            "reading_time": reading_time,
            "temp_outdoor": data.get("tempf"),
            "temp_indoor": data.get("tempinf"),
            "feels_like": data.get("feelsLike"),
            "dew_point": data.get("dewPoint"),
            "humidity_outdoor": data.get("humidity"),
            "humidity_indoor": data.get("humidityin"),
            "wind_speed": data.get("windspeedmph"),
            "wind_gust": data.get("windgustmph"),
            "wind_direction": data.get("winddir"),
            "wind_direction_avg": data.get("winddir_avg10m"),
            "pressure_relative": data.get("baromrelin"),
            "pressure_absolute": data.get("baromabsin"),
            "rain_hourly": data.get("hourlyrainin"),
            "rain_daily": data.get("dailyrainin"),
            "rain_weekly": data.get("weeklyrainin"),
            "rain_monthly": data.get("monthlyrainin"),
            "rain_total": data.get("totalrainin"),
            "rain_rate": data.get("rainratein"),
            "solar_radiation": data.get("solarradiation"),
            "uv_index": data.get("uv"),
            "battery_outdoor": data.get("battout"),
            # Soil moisture sensors (soilhum1-10 are percentage values)
            "soil_moisture_1": data.get("soilhum1"),
            "soil_moisture_2": data.get("soilhum2"),
            "soil_moisture_3": data.get("soilhum3"),
            "soil_moisture_4": data.get("soilhum4"),
            "soil_temp_1": data.get("soiltemp1f"),
            "soil_temp_2": data.get("soiltemp2f"),
            "raw_data": json.dumps(data),
        }

    async def save_reading(self, db: AsyncSession, data: Dict[str, Any]) -> WeatherReading:
        """Save a weather reading to the database"""
        parsed = self.parse_reading(data)
        reading = WeatherReading(**parsed)
        db.add(reading)
        await db.commit()
        await db.refresh(reading)
        logger.info(f"Saved weather reading: {reading.temp_outdoor}°F at {reading.reading_time}")
        return reading

    async def get_latest_reading(self, db: AsyncSession) -> Optional[WeatherReading]:
        """Get the most recent weather reading from database"""
        result = await db.execute(
            select(WeatherReading).order_by(desc(WeatherReading.reading_time)).limit(1)
        )
        return result.scalar_one_or_none()

    async def get_readings_range(
        self, db: AsyncSession, start: datetime, end: datetime
    ) -> List[WeatherReading]:
        """Get weather readings within a time range"""
        result = await db.execute(
            select(WeatherReading)
            .where(WeatherReading.reading_time >= start)
            .where(WeatherReading.reading_time <= end)
            .order_by(desc(WeatherReading.reading_time))
        )
        return result.scalars().all()

    async def check_alerts(
        self, db: AsyncSession, reading: WeatherReading
    ) -> List[WeatherAlert]:
        """Check weather conditions and generate alerts if needed"""
        alerts = []

        # Get dynamic thresholds from settings
        frost_temp = await get_threshold(db, "frost_warning_temp")
        freeze_temp = await get_threshold(db, "freeze_warning_temp")
        heat_temp = await get_threshold(db, "heat_warning_temp")
        wind_speed = await get_threshold(db, "wind_warning_speed")
        rain_inches = await get_threshold(db, "rain_warning_inches")

        # Frost warning
        if reading.temp_outdoor and reading.temp_outdoor <= frost_temp:
            severity = (
                AlertSeverity.CRITICAL
                if reading.temp_outdoor <= freeze_temp
                else AlertSeverity.WARNING
            )
            alert_type = (
                "freeze_warning"
                if reading.temp_outdoor <= freeze_temp
                else "frost_warning"
            )

            alert = WeatherAlert(
                alert_type=alert_type,
                severity=severity,
                title=f"{'Freeze' if severity == AlertSeverity.CRITICAL else 'Frost'} Warning",
                message=f"Temperature has dropped to {reading.temp_outdoor}°F. "
                f"Protect frost-sensitive plants!",
                trigger_value=reading.temp_outdoor,
                threshold_value=frost_temp,
                recommended_actions="Cover frost-sensitive plants with blankets or frost cloth. "
                "Move potted plants indoors. Check on citrus trees.",
                expires_at=datetime.utcnow() + timedelta(hours=12),
            )
            alerts.append(alert)

        # Heat warning
        if reading.temp_outdoor and reading.temp_outdoor >= heat_temp:
            alert = WeatherAlert(
                alert_type="heat_warning",
                severity=AlertSeverity.WARNING,
                title="Extreme Heat Warning",
                message=f"Temperature has reached {reading.temp_outdoor}°F. "
                f"Ensure animals have shade and water.",
                trigger_value=reading.temp_outdoor,
                threshold_value=heat_temp,
                recommended_actions="Ensure all animals have access to shade and fresh water. "
                "Consider additional watering for plants. Avoid working during peak heat.",
                expires_at=datetime.utcnow() + timedelta(hours=8),
            )
            alerts.append(alert)

        # High wind warning
        if reading.wind_gust and reading.wind_gust >= wind_speed:
            alert = WeatherAlert(
                alert_type="wind_warning",
                severity=AlertSeverity.WARNING,
                title="High Wind Warning",
                message=f"Wind gusts reaching {reading.wind_gust} mph.",
                trigger_value=reading.wind_gust,
                threshold_value=wind_speed,
                recommended_actions="Secure loose items. Check that animal shelters are stable. "
                "Young trees may need staking.",
                expires_at=datetime.utcnow() + timedelta(hours=6),
            )
            alerts.append(alert)

        # Heavy rain warning
        if reading.rain_daily and reading.rain_daily >= rain_inches:
            alert = WeatherAlert(
                alert_type="heavy_rain",
                severity=AlertSeverity.INFO,
                title="Heavy Rain",
                message=f"Daily rainfall has reached {reading.rain_daily} inches.",
                trigger_value=reading.rain_daily,
                threshold_value=rain_inches,
                recommended_actions="Skip watering today. Check for standing water. "
                "Ensure drainage is clear.",
                expires_at=datetime.utcnow() + timedelta(hours=24),
            )
            alerts.append(alert)

        # Save alerts to database (email notifications handled by sunset scheduler)
        # Group related alert types (e.g., frost and freeze are related)
        cold_alerts = {"frost_warning", "freeze_warning"}

        for alert in alerts:
            # Check for existing alerts of the same type OR related types
            if alert.alert_type in cold_alerts:
                # Check all cold-related alerts
                existing_result = await db.execute(
                    select(WeatherAlert)
                    .where(WeatherAlert.alert_type.in_(cold_alerts))
                )
            else:
                existing_result = await db.execute(
                    select(WeatherAlert)
                    .where(WeatherAlert.alert_type == alert.alert_type)
                )

            existing_alerts = existing_result.scalars().all()

            # Check if any dismissed alerts exist - if so, respect the user's dismissal
            # and don't create a new alert (they've already seen and handled it)
            dismissed_exists = any(not a.is_active for a in existing_alerts)
            if dismissed_exists:
                logger.debug(f"Skipping {alert.alert_type} - dismissed alert exists")
                continue

            # Delete only active alerts (not dismissed ones) when replacing
            for old_alert in existing_alerts:
                if old_alert.is_active:
                    await db.delete(old_alert)

            # Add the new alert
            db.add(alert)
            logger.warning(f"Weather alert created: {alert.title}")

        await db.commit()
        return alerts

    def get_weather_summary(self, reading: WeatherReading) -> Dict[str, Any]:
        """Generate a summary of current weather for dashboard"""
        wind_directions = [
            "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
            "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"
        ]
        wind_dir_str = ""
        if reading.wind_direction is not None:
            idx = round(reading.wind_direction / 22.5) % 16
            wind_dir_str = wind_directions[idx]

        # Get soil moisture (use first available sensor)
        soil_moisture = None
        if reading.soil_moisture_1 is not None:
            soil_moisture = reading.soil_moisture_1
        elif reading.soil_moisture_2 is not None:
            soil_moisture = reading.soil_moisture_2
        elif reading.soil_moisture_3 is not None:
            soil_moisture = reading.soil_moisture_3
        elif reading.soil_moisture_4 is not None:
            soil_moisture = reading.soil_moisture_4

        return {
            "temperature": reading.temp_outdoor,
            "feels_like": reading.feels_like,
            "humidity": reading.humidity_outdoor,
            "wind_speed": reading.wind_speed,
            "wind_gust": reading.wind_gust,
            "wind_direction": wind_dir_str,
            "rain_today": reading.rain_daily,
            "rain_rate": reading.rain_rate,
            "uv_index": reading.uv_index,
            "pressure": reading.pressure_relative,
            "soil_moisture": soil_moisture,
            "reading_time": reading.reading_time.isoformat() if reading.reading_time else None,
        }


async def get_soil_moisture_status(db: AsyncSession) -> Dict[str, Any]:
    """
    Get current soil moisture status and whether plants should skip watering.
    Returns dict with moisture level and skip_watering boolean.
    """
    # Check if soil moisture feature is enabled
    enabled_result = await db.execute(
        select(AppSetting).where(AppSetting.key == "awn_soil_moisture_enabled")
    )
    enabled_setting = enabled_result.scalar_one_or_none()
    is_enabled = enabled_setting and enabled_setting.value == "true"

    if not is_enabled:
        return {
            "enabled": False,
            "moisture": None,
            "threshold": None,
            "skip_watering": False,
            "message": "Soil moisture sensor not enabled"
        }

    # Get threshold
    threshold_result = await db.execute(
        select(AppSetting).where(AppSetting.key == "awn_soil_moisture_threshold")
    )
    threshold_setting = threshold_result.scalar_one_or_none()
    threshold = 50  # default
    if threshold_setting and threshold_setting.value:
        try:
            threshold = int(threshold_setting.value)
        except ValueError:
            pass

    # Get latest weather reading with soil moisture
    from models.weather import WeatherReading
    result = await db.execute(
        select(WeatherReading)
        .where(WeatherReading.soil_moisture_1.isnot(None))
        .order_by(desc(WeatherReading.reading_time))
        .limit(1)
    )
    reading = result.scalar_one_or_none()

    if not reading:
        return {
            "enabled": True,
            "moisture": None,
            "threshold": threshold,
            "skip_watering": False,
            "message": "No soil moisture data available"
        }

    # Use first available sensor
    moisture = (
        reading.soil_moisture_1 or
        reading.soil_moisture_2 or
        reading.soil_moisture_3 or
        reading.soil_moisture_4
    )

    skip_watering = moisture is not None and moisture >= threshold

    return {
        "enabled": True,
        "moisture": moisture,
        "threshold": threshold,
        "skip_watering": skip_watering,
        "reading_time": reading.reading_time.isoformat() if reading.reading_time else None,
        "message": f"Soil is {'wet enough' if skip_watering else 'dry'} ({moisture}%)"
    }
