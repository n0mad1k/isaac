"""
Weather Service
Consolidated module containing:
  - Unit conversion utilities
  - Open-Meteo forecast service
  - NWS forecast service
  - Ambient Weather Network (AWN) service
  - Alert processing and soil moisture helpers

Supports two unit systems:
  "us"     — °F, mph, inHg, inches  (default; matches AWN/NWS native output)
  "metric" — °C, km/h, hPa, mm

NOTE: Alert thresholds (frost_warning_temp, etc.) are always stored and
compared in US units regardless of the display setting.  Unit conversion is
purely a display/API output concern; the internal DB representation is never
changed.

Settings are loaded from the database with fallback to config for backwards
compatibility.

Open-Meteo docs: https://open-meteo.com/en/docs
"""

import httpx
import json
import re
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import Optional, Dict, List, Any, Tuple, NamedTuple
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from config import settings as config_settings
from models.weather import WeatherReading, WeatherAlert, AlertSeverity
from models.settings import AppSetting


# ===========================================================================
# Unit Conversion Utilities
# ===========================================================================

VALID_UNIT_SYSTEMS = ("us", "metric")


class UnitLabels(NamedTuple):
    """Human-readable labels and Open-Meteo API parameter values for a unit system."""
    temperature: str   # "°F"  /  "°C"
    wind_speed: str    # "mph" /  "km/h"
    pressure: str      # "inHg" / "hPa"
    rain: str          # "in"  /  "mm"
    temp_api: str      # "fahrenheit" / "celsius"  (Open-Meteo param)
    wind_api: str      # "mph"        / "kmh"       (Open-Meteo param)


US_LABELS = UnitLabels(
    temperature="°F", wind_speed="mph", pressure="inHg", rain="in",
    temp_api="fahrenheit", wind_api="mph",
)
METRIC_LABELS = UnitLabels(
    temperature="°C", wind_speed="km/h", pressure="hPa", rain="mm",
    temp_api="celsius", wind_api="kmh",
)


def get_unit_labels(system: str) -> UnitLabels:
    return METRIC_LABELS if system == "metric" else US_LABELS


async def get_unit_system(db: AsyncSession) -> str:
    """
    Read the preferred unit system from the database, falling back to config
    and finally to "us".  Returns one of: "us", "metric".
    """
    try:
        result = await db.execute(
            select(AppSetting).where(AppSetting.key == "weather_units")
        )
        setting = result.scalar_one_or_none()
        if setting and setting.value in VALID_UNIT_SYSTEMS:
            return setting.value
    except Exception:
        logger.warning("get_unit_system: DB read failed, using config default")

    cfg = getattr(config_settings, "weather_units", "us")
    return cfg if cfg in VALID_UNIT_SYSTEMS else "us"


# ---------------------------------------------------------------------------
# Scalar conversions — all None-safe, all return rounded values
# ---------------------------------------------------------------------------

def f_to_c(f: Optional[float]) -> Optional[float]:
    return round((f - 32) * 5 / 9, 1) if f is not None else None


def c_to_f(c: Optional[float]) -> Optional[float]:
    return round(c * 9 / 5 + 32, 1) if c is not None else None


def mph_to_kmh(mph: Optional[float]) -> Optional[float]:
    return round(mph * 1.60934, 1) if mph is not None else None


def kmh_to_mph(kmh: Optional[float]) -> Optional[float]:
    return round(kmh / 1.60934, 1) if kmh is not None else None


def inhg_to_hpa(inhg: Optional[float]) -> Optional[float]:
    return round(inhg / 0.02953, 1) if inhg is not None else None


def hpa_to_inhg(hpa: Optional[float]) -> Optional[float]:
    return round(hpa * 0.02953, 2) if hpa is not None else None


def inches_to_mm(inches: Optional[float]) -> Optional[float]:
    return round(inches * 25.4, 1) if inches is not None else None


def mm_to_inches(mm: Optional[float]) -> Optional[float]:
    return round(mm / 25.4, 2) if mm is not None else None


# ---------------------------------------------------------------------------
# Wind speed string conversion  ("15 mph"  ↔  "24.1 km/h")
# ---------------------------------------------------------------------------

def convert_wind_str(wind_str: Optional[str], to_system: str) -> Optional[str]:
    """
    Convert a wind-speed string produced by NWS (e.g. "15 mph", "10 to 20 mph").
    Returns the converted string, or the original when the format is unrecognised.
    """
    if not wind_str or wind_str.strip().lower() in ("", "unknown", "calm"):
        return wind_str

    lower = wind_str.lower()

    # Handle NWS range strings like "10 to 20 mph"
    if " to " in lower:
        parts = lower.replace(" mph", "").replace(" km/h", "").split(" to ")
        try:
            lo, hi = float(parts[0].strip()), float(parts[1].strip())
            if to_system == "metric" and "mph" in lower:
                return f"{mph_to_kmh(lo):.0f} to {mph_to_kmh(hi):.0f} km/h"
            if to_system == "us" and "km/h" in lower:
                return f"{kmh_to_mph(lo):.0f} to {kmh_to_mph(hi):.0f} mph"
            return wind_str
        except (ValueError, IndexError):
            return wind_str

    # Simple "N unit" strings
    tokens = wind_str.strip().split()
    try:
        val = float(tokens[0])
        unit = tokens[1].lower() if len(tokens) > 1 else "mph"
        if to_system == "metric" and unit == "mph":
            return f"{mph_to_kmh(val):.0f} km/h"
        if to_system == "us" and unit in ("km/h", "kmh"):
            return f"{kmh_to_mph(val):.0f} mph"
        return wind_str
    except (ValueError, IndexError):
        return wind_str


# ---------------------------------------------------------------------------
# Dict converters — AWN summary (US → Metric)
# ---------------------------------------------------------------------------

def convert_summary_to_metric(summary: dict) -> dict:
    """
    Convert a WeatherService.get_weather_summary() dict from US to Metric.
    Does not mutate the input dict.
    """
    d = dict(summary)
    d["temperature"] = f_to_c(d.get("temperature"))
    d["feels_like"]  = f_to_c(d.get("feels_like"))
    d["wind_speed"]  = mph_to_kmh(d.get("wind_speed"))
    d["wind_gust"]   = mph_to_kmh(d.get("wind_gust"))
    d["pressure"]    = inhg_to_hpa(d.get("pressure"))
    d["rain_today"]  = inches_to_mm(d.get("rain_today"))
    d["rain_rate"]   = inches_to_mm(d.get("rain_rate"))
    return d


# ---------------------------------------------------------------------------
# Dict converters — NWS observation (US → Metric)
# ---------------------------------------------------------------------------

def convert_nws_observation_to_metric(obs: dict) -> dict:
    """Convert a NWSForecastService.get_current_observation() dict to metric."""
    d = dict(obs)
    d["temp_outdoor"]      = f_to_c(d.get("temp_outdoor"))
    d["feels_like"]        = f_to_c(d.get("feels_like"))
    d["dew_point"]         = f_to_c(d.get("dew_point"))
    d["wind_speed"]        = mph_to_kmh(d.get("wind_speed"))
    d["wind_gust"]         = mph_to_kmh(d.get("wind_gust"))
    d["pressure_relative"] = inhg_to_hpa(d.get("pressure_relative"))
    return d


# ---------------------------------------------------------------------------
# Dict converters — NWS forecast (US → Metric)
# ---------------------------------------------------------------------------

def convert_nws_period_to_metric(period: dict) -> dict:
    """Convert a single NWS forecast period dict to metric units."""
    d = dict(period)
    d["temperature"]      = f_to_c(d.get("temperature"))
    d["temperature_unit"] = "C"
    d["wind_speed"]       = convert_wind_str(d.get("wind_speed"), "metric")

    # Rewrite inline °F / mph literals in the detailed forecast text
    detail = d.get("detailed_forecast", "")
    if detail:
        def _replace_temp(m):
            return f"{f_to_c(float(m.group(1))):.0f}°C"
        def _replace_wind(m):
            return f"{mph_to_kmh(float(m.group(1))):.0f} km/h"
        detail = re.sub(r"(-?\d+(?:\.\d+)?)\s*°F", _replace_temp, detail)
        detail = re.sub(r"(\d+(?:\.\d+)?)\s*mph", _replace_wind, detail)
        d["detailed_forecast"] = detail

    return d


def convert_nws_forecast_to_metric(periods: list) -> list:
    return [convert_nws_period_to_metric(p) for p in periods]


def convert_nws_simple_day_to_metric(day: dict) -> dict:
    """Convert a NWSForecastService.get_forecast_simple() day dict to metric."""
    d = dict(day)
    d["high"] = f_to_c(d.get("high"))
    d["low"]  = f_to_c(d.get("low"))
    d["wind"] = convert_wind_str(d.get("wind"), "metric")
    return d


def convert_nws_simple_forecast_to_metric(days: list) -> list:
    return [convert_nws_simple_day_to_metric(d) for d in days]


def convert_nws_hourly_period_to_metric(period: dict) -> dict:
    """Convert a single NWS hourly period dict to metric."""
    d = dict(period)
    d["temperature"] = f_to_c(d.get("temperature"))
    d["wind_speed"]  = convert_wind_str(d.get("wind_speed"), "metric")
    return d


def convert_nws_hourly_to_metric(periods: list) -> list:
    return [convert_nws_hourly_period_to_metric(p) for p in periods]


# ---------------------------------------------------------------------------
# Dict converters — Stats and history (US → Metric)
# ---------------------------------------------------------------------------

def convert_stats_to_metric(stats: dict) -> dict:
    d = dict(stats)
    d["temp_high"]  = f_to_c(d.get("temp_high"))
    d["temp_low"]   = f_to_c(d.get("temp_low"))
    d["temp_avg"]   = f_to_c(d.get("temp_avg"))
    d["total_rain"] = inches_to_mm(d.get("total_rain"))
    return d


def convert_daily_summary_to_metric(summary: dict) -> dict:
    d = dict(summary)
    d["high"] = f_to_c(d.get("high"))
    d["low"]  = f_to_c(d.get("low"))
    d["rain"] = inches_to_mm(d.get("rain"))
    return d


# ===========================================================================
# WMO Weather Code Helpers  (Open-Meteo)
# https://open-meteo.com/en/docs#weathervariables
# ===========================================================================

_WMO_DESCRIPTIONS: Dict[int, str] = {
    0:  "Clear Sky",
    1:  "Mainly Clear",
    2:  "Partly Cloudy",
    3:  "Overcast",
    45: "Foggy",
    48: "Icy Fog",
    51: "Light Drizzle",
    53: "Moderate Drizzle",
    55: "Dense Drizzle",
    56: "Light Freezing Drizzle",
    57: "Heavy Freezing Drizzle",
    61: "Slight Rain",
    63: "Moderate Rain",
    65: "Heavy Rain",
    66: "Light Freezing Rain",
    67: "Heavy Freezing Rain",
    71: "Slight Snow",
    73: "Moderate Snow",
    75: "Heavy Snow",
    77: "Snow Grains",
    80: "Slight Rain Showers",
    81: "Moderate Rain Showers",
    82: "Violent Rain Showers",
    85: "Slight Snow Showers",
    86: "Heavy Snow Showers",
    95: "Thunderstorm",
    96: "Thunderstorm with Slight Hail",
    99: "Thunderstorm with Heavy Hail",
}

_WMO_RAIN_CODES = {51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99}

_WMO_ICON: Dict[int, str] = {
    0:  "sunny",        1: "mostly_sunny",  2: "partly_cloudy", 3: "overcast",
    45: "fog",         48: "fog",
    51: "drizzle",     53: "drizzle",       55: "drizzle",
    56: "freezing_rain", 57: "freezing_rain",
    61: "rain",        63: "rain",          65: "rain",
    66: "freezing_rain", 67: "freezing_rain",
    71: "snow",        73: "snow",          75: "snow",         77: "snow",
    80: "showers",     81: "showers",       82: "showers",
    85: "snow_showers", 86: "snow_showers",
    95: "thunderstorm", 96: "thunderstorm", 99: "thunderstorm",
}

_WIND_DIRECTIONS = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
]


def _degrees_to_compass(degrees: Optional[float]) -> str:
    if degrees is None:
        return ""
    idx = round(float(degrees) / 22.5) % 16
    return _WIND_DIRECTIONS[idx]


def _wmo_description(code: Optional[int]) -> str:
    if code is None:
        return "Unknown"
    return _WMO_DESCRIPTIONS.get(int(code), f"Weather code {code}")


def _wmo_icon(code: Optional[int]) -> str:
    if code is None:
        return "unknown"
    return _WMO_ICON.get(int(code), "unknown")


def _is_rain_code(code: Optional[int]) -> bool:
    return int(code) in _WMO_RAIN_CODES if code is not None else False


# ===========================================================================
# Threshold & Location Helpers
# ===========================================================================

# Default thresholds (mirrors routers/settings.py DEFAULT_SETTINGS)
# Always in US units — thresholds are compared against raw AWN DB readings.
DEFAULT_THRESHOLDS = {
    "frost_warning_temp": 35.0,
    "freeze_warning_temp": 32.0,
    "heat_warning_temp": 95.0,
    "wind_warning_speed": 25.0,
    "rain_warning_inches": 2.0,
}


async def get_threshold(db: AsyncSession, key: str) -> float:
    """Get a threshold value from the database, or return default."""
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

    if not api_key and config_settings.awn_api_key:
        api_key = config_settings.awn_api_key
    if not app_key and config_settings.awn_app_key:
        app_key = config_settings.awn_app_key

    return api_key, app_key


# ===========================================================================
# NWS Forecast Service
# ===========================================================================

class NWSForecastService:
    """National Weather Service API for forecasts (US locations only)."""

    BASE_URL = "https://api.weather.gov"

    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None
        self._grid_cache: Optional[Dict[str, str]] = None

    def _is_us_location(self, lat: float, lon: float) -> bool:
        """Check if coordinates are roughly within US bounds."""
        if lat is None or lon is None:
            return False
        return (24.396308 <= lat <= 71.386760) and (-179.148909 <= lon <= -66.949895)

    async def get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=30.0,
                follow_redirects=True,
                headers={"User-Agent": "(Isaac Farm Assistant, contact@example.com)"}
            )
        return self._client

    async def get_grid_info(self, lat: float, lon: float) -> Optional[Dict[str, str]]:
        """Get NWS grid point info for coordinates."""
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
                "observation_stations_url": data["properties"]["observationStations"],
            }
            return self._grid_cache
        except Exception as e:
            logger.error(f"Failed to get NWS grid info: {e}")
            return None

    async def get_forecast(self, lat: float = None, lon: float = None) -> Optional[List[Dict[str, Any]]]:
        """Get 7-day forecast from NWS."""
        lat = lat or config_settings.latitude
        lon = lon or config_settings.longitude

        if not lat or not lon:
            logger.warning("Location not configured - cannot get forecast")
            return None

        logger.debug("Calling get_grid_info from get_forecast")
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

            for i, period in enumerate(periods[:10]):  # 5 days (day + night)
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
        """Get simplified 5-day forecast (one entry per day)."""
        if not self._is_us_location(lat, lon):
            logger.debug("NWS requested for non-US location; skipping.")
            return None
        forecasts = await self.get_forecast(lat, lon)
        if not forecasts:
            return None

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
                if i + 1 < len(forecasts) and not forecasts[i + 1]["is_daytime"]:
                    day_entry["low"] = forecasts[i + 1]["temperature"]
                    night_rain = forecasts[i + 1].get("rain_chance", 0)
                    day_entry["rain_chance"] = max(day_entry["rain_chance"], night_rain)
                    i += 1
            else:
                day_entry["low"] = period["temperature"]
                day_entry["name"] = "Tonight"

            days.append(day_entry)
            i += 1

        return days

    async def get_hourly_forecast(self, lat: float = None, lon: float = None) -> Optional[List[Dict[str, Any]]]:
        """Get hourly forecast from NWS (up to 48 hours)."""
        lat = lat or config_settings.latitude
        lon = lon or config_settings.longitude

        if not lat or not lon:
            logger.warning("Location not configured - cannot get hourly forecast")
            return None

        logger.debug("Calling get_grid_info from get_hourly_forecast")
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

            for period in periods[:48]:
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
        Uses start_time from NWS periods for accurate time calculation.
        """
        hourly = await self.get_hourly_forecast(lat, lon)
        if not hourly:
            return {"has_data": False, "message": "Forecast unavailable"}

        now = datetime.now().astimezone()
        rain_keywords = ['rain', 'shower', 'storm', 'thunder', 'drizzle', 'precipitation']

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

        try:
            rain_start = datetime.fromisoformat(first_rain_entry["start_time"])
            diff = rain_start - now
            hours_until = max(0, int(diff.total_seconds() / 3600))
        except (ValueError, KeyError):
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

    async def get_current_observation(self, lat: float = None, lon: float = None) -> Optional[Dict[str, Any]]:
        """
        Get current weather observation from nearest NWS station.
        Used as fallback when Ambient Weather is not configured.
        """
        lat = lat or config_settings.latitude
        lon = lon or config_settings.longitude

        if not lat or not lon:
            logger.warning("Location not configured - cannot get observations")
            return None

        logger.debug("Calling get_grid_info from get_current_observation")
        grid = await self.get_grid_info(lat, lon)
        if not grid or "observation_stations_url" not in grid:
            return None

        client = await self.get_client()
        try:
            response = await client.get(grid["observation_stations_url"])
            response.raise_for_status()
            stations_data = response.json()

            stations = stations_data.get("features", [])
            if not stations:
                logger.warning("No NWS observation stations found")
                return None

            station_id = stations[0]["properties"]["stationIdentifier"]
            obs_url = f"{self.BASE_URL}/stations/{station_id}/observations/latest"

            response = await client.get(obs_url)
            response.raise_for_status()
            obs_data = response.json()

            props = obs_data.get("properties", {})

            def get_value(data, key, default=None):
                val = data.get(key)
                if val is None:
                    return default
                if isinstance(val, dict):
                    return val.get("value", default)
                return val

            def _c_to_f(c):
                return round(c * 9 / 5 + 32, 1) if c is not None else None

            def ms_to_mph(ms):
                return round(ms * 2.237, 1) if ms is not None else None

            def pa_to_inhg(pa):
                return round(pa * 0.0002953, 2) if pa is not None else None

            temp_c      = get_value(props, "temperature")
            dewpoint_c  = get_value(props, "dewpoint")
            wind_ms     = get_value(props, "windSpeed")
            gust_ms     = get_value(props, "windGust")
            pressure_pa = get_value(props, "barometricPressure")

            return {
                "source":           "nws",
                "station":          station_id,
                "timestamp":        props.get("timestamp"),
                "temp_outdoor":     _c_to_f(temp_c),
                "humidity_outdoor": get_value(props, "relativeHumidity"),
                "dew_point":        _c_to_f(dewpoint_c),
                "wind_speed":       ms_to_mph(wind_ms),
                "wind_gust":        ms_to_mph(gust_ms),
                "wind_direction":   get_value(props, "windDirection"),
                "pressure_relative": pa_to_inhg(pressure_pa),
                "text_description": props.get("textDescription"),
            }

        except Exception as e:
            logger.error(f"Failed to get NWS observation: {e}")
            return None


# ===========================================================================
# Open-Meteo Forecast Service
# ===========================================================================

class OpenMeteoForecastService:
    """
    Open-Meteo API forecast service.

    Provides the same public interface as NWSForecastService:
        - get_forecast(lat, lon)            → list of day/night period dicts
        - get_forecast_simple(lat, lon)     → list of 5-day summary dicts
        - get_hourly_forecast(lat, lon)     → list of 48-hour dicts
        - get_rain_forecast(lat, lon)       → rain timing/probability dict
        - get_current_observation(lat, lon) → current conditions dict

    Pass units="us" (default) for °F / mph / inHg, or units="metric" for
    °C / km/h / hPa.  No API key required.
    """

    BASE_URL = "https://api.open-meteo.com/v1/forecast"

    def __init__(self, units: str = "us") -> None:
        self.units   = units if units in VALID_UNIT_SYSTEMS else "us"
        self._labels = get_unit_labels(self.units)
        self._client: Optional[httpx.AsyncClient] = None

    @staticmethod
    def format_iso_utc(dt_str: str) -> str:
        """
        Converts an Open-Meteo datetime string to an explicit UTC ISO-8601 string.

        Open-Meteo returns naive local times (e.g. '2024-06-01T14:00') when
        timezone=auto is used.  The configured timezone (config_settings.timezone)
        is used to interpret the naive string before converting to true UTC.
        Strings that already carry an offset or 'Z' are normalised to UTC.
        """
        if not dt_str:
            return ""
        try:
            if "+" in dt_str or dt_str.endswith("Z"):
                return (
                    datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
                    .astimezone(timezone.utc)
                    .isoformat()
                )
            local_tz = ZoneInfo(config_settings.timezone)
            local_dt = datetime.fromisoformat(dt_str).replace(tzinfo=local_tz)
            return local_dt.astimezone(timezone.utc).isoformat()
        except Exception as exc:
            logger.warning(f"format_iso_utc: could not convert '{dt_str}': {exc}")
            return dt_str

    async def get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=30.0,
                follow_redirects=True,
                headers={"User-Agent": "FarmAssistant/1.0"},
            )
        return self._client

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()

    async def _fetch(self, params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Low-level GET against the Open-Meteo forecast endpoint."""
        client = await self.get_client()
        try:
            response = await client.get(self.BASE_URL, params=params)
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            logger.error(f"Open-Meteo request failed: {exc}")
            return None

    def _resolve_coords(
        self, lat: Optional[float], lon: Optional[float]
    ) -> tuple[Optional[float], Optional[float]]:
        lat = lat or config_settings.latitude
        lon = lon or config_settings.longitude
        return lat, lon

    async def get_forecast(
        self, lat: float = None, lon: float = None
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Return a 7-day forecast as a list of period dicts (day + night pairs),
        matching the output shape of NWSForecastService.get_forecast().
        """
        lat, lon = self._resolve_coords(lat, lon)
        if not lat or not lon:
            logger.warning("Location not configured – cannot get forecast")
            return None

        data = await self._fetch({
            "latitude": lat,
            "longitude": lon,
            "daily": (
                "weather_code,"
                "temperature_2m_max,"
                "temperature_2m_min,"
                "precipitation_probability_max,"
                "wind_speed_10m_max,"
                "wind_direction_10m_dominant,"
                "precipitation_sum,"
                "sunrise,"
                "sunset"
            ),
            "temperature_unit":   self._labels.temp_api,
            "wind_speed_unit":    self._labels.wind_api,
            "precipitation_unit": "inch" if self.units == "us" else "mm",
            "timezone":           "auto",
            "forecast_days":      7,
        })

        if not data:
            return None

        daily  = data.get("daily", {})
        dates: List[str] = daily.get("time", [])
        periods: List[Dict[str, Any]] = []

        for i, date_str in enumerate(dates):
            code     = daily["weather_code"][i]
            t_max    = daily["temperature_2m_max"][i]
            t_min    = daily["temperature_2m_min"][i]
            rain_pct = daily.get("precipitation_probability_max", [0] * len(dates))[i] or 0
            wind_val = daily.get("wind_speed_10m_max", [None] * len(dates))[i]
            wind_dir = daily.get("wind_direction_10m_dominant", [None] * len(dates))[i]
            sunrise  = daily.get("sunrise", [""] * len(dates))[i]
            sunset   = daily.get("sunset", [""] * len(dates))[i]

            desc        = _wmo_description(code)
            icon        = _wmo_icon(code)
            wind_label  = self._labels.wind_speed
            wind_str    = f"{round(wind_val)} {wind_label}" if wind_val is not None else "Unknown"
            compass     = _degrees_to_compass(wind_dir)
            day_label   = datetime.fromisoformat(date_str).strftime("%A") if i > 0 else "Today"
            night_label = "Tonight" if i == 0 else f"{day_label} Night"
            start_str   = sunrise or f"{date_str}T06:00"
            end_str     = sunset  or f"{date_str}T20:00"
            t_unit      = self._labels.temperature

            periods.append({
                "name":             day_label,
                "temperature":      t_max,
                "temperature_unit": t_unit.replace("°", ""),
                "wind_speed":       wind_str,
                "wind_direction":   compass,
                "short_forecast":   desc,
                "detailed_forecast": (
                    f"{desc}. High near {t_max}{t_unit}. "
                    f"{compass} wind around {wind_str}. "
                    f"Chance of precipitation {rain_pct}%."
                ),
                "is_daytime":  True,
                "icon":        icon,
                "start_time":  self.format_iso_utc(start_str),
                "end_time":    self.format_iso_utc(end_str),
                "rain_chance": rain_pct,
            })

            periods.append({
                "name":             night_label,
                "temperature":      t_min,
                "temperature_unit": t_unit.replace("°", ""),
                "wind_speed":       wind_str,
                "wind_direction":   compass,
                "short_forecast":   desc,
                "detailed_forecast": (
                    f"{desc}. Low around {t_min}{t_unit}. "
                    f"{compass} wind around {wind_str}. "
                    f"Chance of precipitation {rain_pct}%."
                ),
                "is_daytime":  False,
                "icon":        icon,
                "start_time":  self.format_iso_utc(sunset or f"{date_str}T20:00"),
                "end_time":    self.format_iso_utc(f"{date_str}T06:00"),
                "rain_chance": rain_pct,
            })

        return periods[:14]  # up to 7 days × 2 periods

    async def get_forecast_simple(
        self, lat: float = None, lon: float = None
    ) -> Optional[List[Dict[str, Any]]]:
        """Return a simplified 5-day forecast (one entry per day)."""
        forecasts = await self.get_forecast(lat, lon)
        if not forecasts:
            return None

        days: List[Dict[str, Any]] = []
        i = 0
        while i < len(forecasts) and len(days) < 5:
            period = forecasts[i]
            day_entry: Dict[str, Any] = {
                "name":        period["name"].replace(" Night", "").replace("Tonight", "Today"),
                "high":        None,
                "low":         None,
                "forecast":    period["short_forecast"],
                "wind":        period["wind_speed"],
                "icon":        period["icon"],
                "rain_chance": period.get("rain_chance", 0),
            }

            if period["is_daytime"]:
                day_entry["high"] = period["temperature"]
                if i + 1 < len(forecasts) and not forecasts[i + 1]["is_daytime"]:
                    day_entry["low"] = forecasts[i + 1]["temperature"]
                    night_rain = forecasts[i + 1].get("rain_chance", 0)
                    day_entry["rain_chance"] = max(day_entry["rain_chance"], night_rain)
                    i += 1
            else:
                day_entry["low"]  = period["temperature"]
                day_entry["name"] = "Tonight"

            days.append(day_entry)
            i += 1

        return days

    async def get_hourly_forecast(
        self, lat: float = None, lon: float = None
    ) -> Optional[List[Dict[str, Any]]]:
        """Return the next 48-hour forecast as a list of hourly dicts."""
        lat, lon = self._resolve_coords(lat, lon)
        if not lat or not lon:
            logger.warning("Location not configured – cannot get hourly forecast")
            return None

        data = await self._fetch({
            "latitude": lat,
            "longitude": lon,
            "hourly": (
                "temperature_2m,"
                "precipitation_probability,"
                "weather_code,"
                "wind_speed_10m,"
                "is_day"
            ),
            "temperature_unit": self._labels.temp_api,
            "wind_speed_unit":  self._labels.wind_api,
            "timezone":         "auto",
            "forecast_days":    3,  # gives 72 h; we slice to 48
        })

        if not data:
            return None

        hourly  = data.get("hourly", {})
        times   = hourly.get("time", [])
        temps   = hourly.get("temperature_2m", [])
        precip  = hourly.get("precipitation_probability", [])
        codes   = hourly.get("weather_code", [])
        winds   = hourly.get("wind_speed_10m", [])
        is_days = hourly.get("is_day", [])

        now_naive = datetime.now().strftime("%Y-%m-%dT%H:00")
        start_idx = 0
        for idx, t in enumerate(times):
            if t >= now_naive:
                start_idx = idx
                break

        result: List[Dict[str, Any]] = []
        for i in range(start_idx, min(start_idx + 48, len(times))):
            code     = codes[i] if i < len(codes) else None
            wind_val = winds[i] if i < len(winds) else None
            wind_str = f"{round(wind_val)} {self._labels.wind_speed}" if wind_val is not None else "Unknown"

            result.append({
                "start_time":     times[i],
                "temperature":    temps[i] if i < len(temps) else None,
                "short_forecast": _wmo_description(code),
                "rain_chance":    precip[i] if i < len(precip) else 0,
                "wind_speed":     wind_str,
                "is_daytime":     bool(is_days[i]) if i < len(is_days) else True,
            })

        return result

    async def get_rain_forecast(
        self, lat: float = None, lon: float = None
    ) -> Dict[str, Any]:
        """Analyse the hourly forecast to determine when rain is next expected."""
        hourly = await self.get_hourly_forecast(lat, lon)
        if not hourly:
            return {"has_data": False, "message": "Forecast unavailable"}

        now = datetime.now().astimezone()
        rain_keywords = ["rain", "shower", "storm", "thunder", "drizzle", "precipitation"]

        first_rain_entry = None
        for hour in hourly:
            forecast_lower = hour["short_forecast"].lower()
            has_keyword    = any(kw in forecast_lower for kw in rain_keywords)
            high_chance    = (hour["rain_chance"] or 0) >= 40

            if has_keyword or high_chance:
                first_rain_entry = hour
                break

        if first_rain_entry is None:
            return {
                "has_data":         True,
                "raining_now":      False,
                "rain_expected":    False,
                "hours_until_rain": None,
                "rain_chance":      0,
                "message":          "No rain expected (48hr)",
            }

        try:
            rain_start = datetime.fromisoformat(first_rain_entry["start_time"])
            if rain_start.tzinfo is None:
                rain_start = rain_start.astimezone()
            diff        = rain_start - now
            hours_until = max(0, int(diff.total_seconds() / 3600))
        except (ValueError, KeyError):
            hours_until = hourly.index(first_rain_entry)

        rain_hour = first_rain_entry

        if hours_until == 0:
            return {
                "has_data":         True,
                "raining_now":      True,
                "rain_expected":    True,
                "hours_until_rain": 0,
                "rain_chance":      rain_hour["rain_chance"],
                "forecast":         rain_hour["short_forecast"],
                "message":          f"Rain now ({rain_hour['rain_chance']}%)",
            }

        return {
            "has_data":         True,
            "raining_now":      False,
            "rain_expected":    True,
            "hours_until_rain": hours_until,
            "rain_chance":      rain_hour["rain_chance"],
            "forecast":         rain_hour["short_forecast"],
            "message":          f"Rain in {hours_until}hr ({rain_hour['rain_chance']}%)",
        }

    async def get_current_observation(
        self, lat: float = None, lon: float = None
    ) -> Optional[Dict[str, Any]]:
        """
        Return current weather conditions from Open-Meteo.
        Mirrors NWSForecastService.get_current_observation().
        """
        lat, lon = self._resolve_coords(lat, lon)
        if not lat or not lon:
            logger.warning("Location not configured – cannot get current observation")
            return None

        data = await self._fetch({
            "latitude": lat,
            "longitude": lon,
            "current": (
                "temperature_2m,"
                "relative_humidity_2m,"
                "dew_point_2m,"
                "apparent_temperature,"
                "weather_code,"
                "wind_speed_10m,"
                "wind_gusts_10m,"
                "wind_direction_10m,"
                "surface_pressure"
            ),
            "temperature_unit": self._labels.temp_api,
            "wind_speed_unit":  self._labels.wind_api,
            "timezone":         "auto",
        })

        if not data:
            return None

        cur = data.get("current", {})

        # Open-Meteo always returns surface_pressure in hPa regardless of unit system.
        pressure_hpa = cur.get("surface_pressure")
        pressure_out = (
            hpa_to_inhg(pressure_hpa) if self.units == "us"
            else (round(pressure_hpa, 1) if pressure_hpa is not None else None)
        )

        code = cur.get("weather_code")

        return {
            "source":            "open-meteo",
            "station":           "open-meteo",
            "timestamp":         cur.get("time"),
            "temp_outdoor":      cur.get("temperature_2m"),
            "feels_like":        cur.get("apparent_temperature"),
            "humidity_outdoor":  cur.get("relative_humidity_2m"),
            "dew_point":         cur.get("dew_point_2m"),
            "wind_speed":        cur.get("wind_speed_10m"),
            "wind_gust":         cur.get("wind_gusts_10m"),
            "wind_direction":    cur.get("wind_direction_10m"),
            "pressure_relative": pressure_out,
            "text_description":  _wmo_description(code),
            "units":             self.units,
        }


# ===========================================================================
# Ambient Weather Network (AWN) Service
# ===========================================================================

class WeatherService:
    """Service for fetching and processing Ambient Weather data."""

    BASE_URL = "https://rt.ambientweather.net/v1"

    def __init__(self, api_key: str = None, app_key: str = None):
        """
        Initialize weather service.
        Keys can be passed directly or will fall back to config settings.
        For DB-based keys, use configure_from_db().
        """
        self.api_key = api_key or config_settings.awn_api_key
        self.app_key = app_key or config_settings.awn_app_key
        self._client: Optional[httpx.AsyncClient] = None

    async def configure_from_db(self, db: AsyncSession) -> None:
        """Load API keys from database settings."""
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
        """Fetch current weather from Ambient Weather API."""
        if not self.api_key or not self.app_key:
            logger.debug("Ambient Weather API keys not configured - using web forecast only")
            return None

        client = await self.get_client()
        url    = f"{self.BASE_URL}/devices"
        params = {"apiKey": self.api_key, "applicationKey": self.app_key}

        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            if data and len(data) > 0:
                device = data[0]
                if "lastData" in device:
                    return device["lastData"]

            logger.warning("No weather data returned from API")
            return None

        except httpx.HTTPStatusError as e:
            logger.error(
                f"Weather API HTTP error: {e.response.status_code} - "
                f"{e.response.text[:200] if e.response.text else 'no body'}"
            )
            return None
        except httpx.HTTPError as e:
            logger.error(
                f"Weather API error: {type(e).__name__} - "
                f"{str(e) or 'timeout or connection error'}"
            )
            return None

    def parse_reading(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Parse Ambient Weather API response into our format.
        See: https://github.com/ambient-weather/api-docs/wiki/Device-Data-Specs
        """
        reading_time = datetime.fromtimestamp(data.get("dateutc", 0) / 1000)

        return {
            "reading_time":       reading_time,
            "temp_outdoor":       data.get("tempf"),
            "temp_indoor":        data.get("tempinf"),
            "feels_like":         data.get("feelsLike"),
            "dew_point":          data.get("dewPoint"),
            "humidity_outdoor":   data.get("humidity"),
            "humidity_indoor":    data.get("humidityin"),
            "wind_speed":         data.get("windspeedmph"),
            "wind_gust":          data.get("windgustmph"),
            "wind_direction":     data.get("winddir"),
            "wind_direction_avg": data.get("winddir_avg10m"),
            "pressure_relative":  data.get("baromrelin"),
            "pressure_absolute":  data.get("baromabsin"),
            "rain_hourly":        data.get("hourlyrainin"),
            "rain_daily":         data.get("dailyrainin"),
            "rain_weekly":        data.get("weeklyrainin"),
            "rain_monthly":       data.get("monthlyrainin"),
            "rain_total":         data.get("totalrainin"),
            "rain_rate":          data.get("rainratein"),
            "solar_radiation":    data.get("solarradiation"),
            "uv_index":           data.get("uv"),
            "battery_outdoor":    data.get("battout"),
            "soil_moisture_1":    data.get("soilhum1"),
            "soil_moisture_2":    data.get("soilhum2"),
            "soil_moisture_3":    data.get("soilhum3"),
            "soil_moisture_4":    data.get("soilhum4"),
            "soil_temp_1":        data.get("soiltemp1f"),
            "soil_temp_2":        data.get("soiltemp2f"),
            "raw_data":           json.dumps(data),
        }

    async def save_reading(self, db: AsyncSession, data: Dict[str, Any]) -> WeatherReading:
        """Save a weather reading to the database."""
        parsed  = self.parse_reading(data)
        reading = WeatherReading(**parsed)
        db.add(reading)
        await db.commit()
        await db.refresh(reading)
        logger.info(f"Saved weather reading: {reading.temp_outdoor}°F at {reading.reading_time}")
        return reading

    async def get_latest_reading(self, db: AsyncSession) -> Optional[WeatherReading]:
        """Get the most recent weather reading from database."""
        result = await db.execute(
            select(WeatherReading).order_by(desc(WeatherReading.reading_time)).limit(1)
        )
        return result.scalar_one_or_none()

    async def get_readings_range(
        self, db: AsyncSession, start: datetime, end: datetime
    ) -> List[WeatherReading]:
        """Get weather readings within a time range."""
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
        """Check weather conditions and generate alerts if needed."""
        alerts = []

        frost_temp  = await get_threshold(db, "frost_warning_temp")
        freeze_temp = await get_threshold(db, "freeze_warning_temp")
        heat_temp   = await get_threshold(db, "heat_warning_temp")
        wind_speed  = await get_threshold(db, "wind_warning_speed")
        rain_inches = await get_threshold(db, "rain_warning_inches")

        # Frost / freeze warning
        if reading.temp_outdoor and reading.temp_outdoor <= frost_temp:
            severity   = AlertSeverity.CRITICAL if reading.temp_outdoor <= freeze_temp else AlertSeverity.WARNING
            alert_type = "freeze_warning"   if reading.temp_outdoor <= freeze_temp else "frost_warning"

            alerts.append(WeatherAlert(
                alert_type=alert_type,
                severity=severity,
                title=f"{'Freeze' if severity == AlertSeverity.CRITICAL else 'Frost'} Warning",
                message=(
                    f"Temperature has dropped to {reading.temp_outdoor}°F. "
                    "Protect frost-sensitive plants!"
                ),
                trigger_value=reading.temp_outdoor,
                threshold_value=frost_temp,
                recommended_actions=(
                    "Cover frost-sensitive plants with blankets or frost cloth. "
                    "Move potted plants indoors. Check on citrus trees."
                ),
                expires_at=datetime.utcnow() + timedelta(hours=12),
            ))

        # Heat warning
        if reading.temp_outdoor and reading.temp_outdoor >= heat_temp:
            alerts.append(WeatherAlert(
                alert_type="heat_warning",
                severity=AlertSeverity.WARNING,
                title="Extreme Heat Warning",
                message=(
                    f"Temperature has reached {reading.temp_outdoor}°F. "
                    "Ensure animals have shade and water."
                ),
                trigger_value=reading.temp_outdoor,
                threshold_value=heat_temp,
                recommended_actions=(
                    "Ensure all animals have access to shade and fresh water. "
                    "Consider additional watering for plants. Avoid working during peak heat."
                ),
                expires_at=datetime.utcnow() + timedelta(hours=8),
            ))

        # High wind warning
        if reading.wind_gust and reading.wind_gust >= wind_speed:
            alerts.append(WeatherAlert(
                alert_type="wind_warning",
                severity=AlertSeverity.WARNING,
                title="High Wind Warning",
                message=f"Wind gusts reaching {reading.wind_gust} mph.",
                trigger_value=reading.wind_gust,
                threshold_value=wind_speed,
                recommended_actions=(
                    "Secure loose items. Check that animal shelters are stable. "
                    "Young trees may need staking."
                ),
                expires_at=datetime.utcnow() + timedelta(hours=6),
            ))

        # Heavy rain warning
        if reading.rain_daily and reading.rain_daily >= rain_inches:
            alerts.append(WeatherAlert(
                alert_type="heavy_rain",
                severity=AlertSeverity.INFO,
                title="Heavy Rain",
                message=f"Daily rainfall has reached {reading.rain_daily} inches.",
                trigger_value=reading.rain_daily,
                threshold_value=rain_inches,
                recommended_actions=(
                    "Skip watering today. Check for standing water. "
                    "Ensure drainage is clear."
                ),
                expires_at=datetime.utcnow() + timedelta(hours=24),
            ))

        # Persist alerts, respecting prior dismissals
        cold_alerts = {"frost_warning", "freeze_warning"}

        for alert in alerts:
            if alert.alert_type in cold_alerts:
                existing_result = await db.execute(
                    select(WeatherAlert).where(WeatherAlert.alert_type.in_(cold_alerts))
                )
            else:
                existing_result = await db.execute(
                    select(WeatherAlert).where(WeatherAlert.alert_type == alert.alert_type)
                )

            existing_alerts = existing_result.scalars().all()

            dismissed_exists = any(not a.is_active for a in existing_alerts)
            if dismissed_exists:
                logger.debug(f"Skipping {alert.alert_type} - dismissed alert exists")
                continue

            for old_alert in existing_alerts:
                if old_alert.is_active:
                    await db.delete(old_alert)

            db.add(alert)
            logger.warning(f"Weather alert created: {alert.title}")

        await db.commit()
        return alerts

    def get_weather_summary(self, reading: WeatherReading) -> Dict[str, Any]:
        """Generate a summary of current weather for the dashboard."""
        wind_directions = [
            "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
            "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
        ]
        wind_dir_str = ""
        if reading.wind_direction is not None:
            idx = round(reading.wind_direction / 22.5) % 16
            wind_dir_str = wind_directions[idx]

        soil_moisture = (
            reading.soil_moisture_1 or
            reading.soil_moisture_2 or
            reading.soil_moisture_3 or
            reading.soil_moisture_4
        )

        return {
            "temperature":          reading.temp_outdoor,
            "feels_like":           reading.feels_like,
            "humidity":             reading.humidity_outdoor,
            "wind_speed":           reading.wind_speed,
            "wind_gust":            reading.wind_gust,
            "wind_direction":       wind_dir_str,
            "wind_direction_degrees": reading.wind_direction,
            "rain_today":           reading.rain_daily,
            "rain_rate":            reading.rain_rate,
            "uv_index":             reading.uv_index,
            "pressure":             reading.pressure_relative,
            "soil_moisture":        soil_moisture,
            "reading_time":         reading.reading_time.isoformat() if reading.reading_time else None,
        }


# ===========================================================================
# Standalone Helpers
# ===========================================================================

async def get_soil_moisture_status(db: AsyncSession) -> Dict[str, Any]:
    """
    Get current soil moisture status and whether plants should skip watering.
    Returns dict with moisture level and skip_watering boolean.
    """
    enabled_result = await db.execute(
        select(AppSetting).where(AppSetting.key == "awn_soil_moisture_enabled")
    )
    enabled_setting = enabled_result.scalar_one_or_none()
    is_enabled = enabled_setting and enabled_setting.value == "true"

    if not is_enabled:
        return {
            "enabled":      False,
            "moisture":     None,
            "threshold":    None,
            "skip_watering": False,
            "message":      "Soil moisture sensor not enabled",
        }

    threshold_result = await db.execute(
        select(AppSetting).where(AppSetting.key == "awn_soil_moisture_threshold")
    )
    threshold_setting = threshold_result.scalar_one_or_none()
    threshold = 50
    if threshold_setting and threshold_setting.value:
        try:
            threshold = int(threshold_setting.value)
        except ValueError:
            pass

    result = await db.execute(
        select(WeatherReading)
        .where(WeatherReading.soil_moisture_1.isnot(None))
        .order_by(desc(WeatherReading.reading_time))
        .limit(1)
    )
    reading = result.scalar_one_or_none()

    if not reading:
        return {
            "enabled":      True,
            "moisture":     None,
            "threshold":    threshold,
            "skip_watering": False,
            "message":      "No soil moisture data available",
        }

    moisture = (
        reading.soil_moisture_1 or
        reading.soil_moisture_2 or
        reading.soil_moisture_3 or
        reading.soil_moisture_4
    )

    skip_watering = moisture is not None and moisture >= threshold

    return {
        "enabled":      True,
        "moisture":     moisture,
        "threshold":    threshold,
        "skip_watering": skip_watering,
        "reading_time": reading.reading_time.isoformat() if reading.reading_time else None,
        "message":      f"Soil is {'wet enough' if skip_watering else 'dry'} ({moisture}%)",
    }