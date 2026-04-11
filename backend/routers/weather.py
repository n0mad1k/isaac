"""
Weather API Routes

Forecast provider is configurable:
  - "nws"        → National Weather Service (US only, no key required)
  - "open_meteo" → Open-Meteo (global, no key required)

Set via the AppSetting key "forecast_provider" in the database, or fall back
to config.forecast_provider (default: "nws").

Weather icons are served from the Basmilius Meteocons collection (MIT licence):
  https://github.com/basmilius/weather-icons
via jsDelivr CDN — no attribution required beyond including the licence notice
in your project's THIRD_PARTY_LICENSES file.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Optional, Dict, Any, Union
from datetime import datetime, timedelta
from pydantic import BaseModel
from loguru import logger

from models.database import get_db
from models.weather import WeatherReading, WeatherAlert, AlertSeverity
from models.settings import AppSetting
from services.weather import (
    WeatherService, 
    NWSForecastService, OpenMeteoForecastService, 
    get_location_from_db,
    get_unit_system, get_unit_labels,
    convert_summary_to_metric, convert_nws_observation_to_metric,
    convert_nws_simple_forecast_to_metric, convert_nws_hourly_to_metric,
    convert_nws_forecast_to_metric, convert_stats_to_metric,
    convert_daily_summary_to_metric,
)
from routers.auth import require_auth, require_admin
from models.users import User
from config import settings as config_settings

router = APIRouter(prefix="/weather", tags=["Weather"])

# ---------------------------------------------------------------------------
# Basmilius Meteocons icon mapping (MIT licence)
# https://github.com/basmilius/weather-icons  –  MIT
# Served via jsDelivr: https://cdn.jsdelivr.net/gh/basmilius/weather-icons@dev/
# ---------------------------------------------------------------------------

_ICON_CDN = (
    "https://cdn.jsdelivr.net/gh/basmilius/weather-icons@dev"
    "/production/fill/svg/{name}.svg"
)


def _icon(name: str) -> str:
    return _ICON_CDN.format(name=name)


# WMO code → (day icon name, night icon name)
_WMO_ICONS: Dict[int, tuple[str, str]] = {
    0:  ("clear-day",                    "clear-night"),
    1:  ("mostly-clear-day",             "mostly-clear-night"),
    2:  ("partly-cloudy-day",            "partly-cloudy-night"),
    3:  ("overcast-day",                 "overcast-night"),
    45: ("fog-day",                      "fog-night"),
    48: ("overcast-fog",                 "overcast-fog"),
    51: ("partly-cloudy-day-drizzle",    "partly-cloudy-night-drizzle"),
    53: ("drizzle",                      "drizzle"),
    55: ("overcast-drizzle",             "overcast-drizzle"),
    56: ("partly-cloudy-day-sleet",      "partly-cloudy-night-sleet"),
    57: ("overcast-sleet",               "overcast-sleet"),
    61: ("partly-cloudy-day-rain",       "partly-cloudy-night-rain"),
    63: ("rain",                         "rain"),
    65: ("overcast-rain",                "overcast-rain"),
    66: ("partly-cloudy-day-sleet",      "partly-cloudy-night-sleet"),
    67: ("overcast-sleet",               "overcast-sleet"),
    71: ("partly-cloudy-day-snow",       "partly-cloudy-night-snow"),
    73: ("snow",                         "snow"),
    75: ("overcast-snow",                "overcast-snow"),
    77: ("snowflake",                    "snowflake"),
    80: ("partly-cloudy-day-rain",       "partly-cloudy-night-rain"),
    81: ("overcast-rain",                "overcast-rain"),
    82: ("thunderstorms-overcast-rain",  "thunderstorms-overcast-rain"),
    85: ("partly-cloudy-day-snow",       "partly-cloudy-night-snow"),
    86: ("overcast-snow",                "overcast-snow"),
    95: ("thunderstorms-day",            "thunderstorms-night"),
    96: ("thunderstorms-day-overcast",   "thunderstorms-night-overcast"),
    99: ("thunderstorms-day-overcast",   "thunderstorms-night-overcast"),
}

_ICON_FALLBACK = ("not-available", "not-available")


def get_icon_url(wmo_code: Optional[int] = None, is_daytime: bool = True,
                 nws_icon_url: Optional[str] = None) -> str:
    """
    Return a Basmilius Meteocons SVG URL.

    For NWS forecasts the wmo_code is None; we derive a reasonable icon from
    keywords found in the NWS icon URL string (e.g. '...rain...' → rain icon).
    For Open-Meteo forecasts the WMO code is passed directly.
    """
    if wmo_code is not None:
        day_name, night_name = _WMO_ICONS.get(int(wmo_code), _ICON_FALLBACK)
        return _icon(day_name if is_daytime else night_name)

    # NWS fallback: parse keywords from the icon URL path
    if nws_icon_url:
        url_lower = nws_icon_url.lower()
        is_day = is_daytime

        if "tsra" in url_lower or "thunder" in url_lower:
            return _icon("thunderstorms-day" if is_day else "thunderstorms-night")
        if "snow" in url_lower or "blizzard" in url_lower:
            return _icon("snow")
        if "sleet" in url_lower or "fzra" in url_lower:
            return _icon("sleet")
        if "rain" in url_lower or "shower" in url_lower or "ra" in url_lower:
            return _icon("partly-cloudy-day-rain" if is_day else "partly-cloudy-night-rain")
        if "wind" in url_lower:
            return _icon("wind")
        if "fog" in url_lower:
            return _icon("fog-day" if is_day else "fog-night")
        if "ovc" in url_lower or "cloud" in url_lower:
            return _icon("overcast-day" if is_day else "overcast-night")
        if "sct" in url_lower or "bkn" in url_lower or "few" in url_lower:
            return _icon("partly-cloudy-day" if is_day else "partly-cloudy-night")
        if "skc" in url_lower or "clear" in url_lower or "sunny" in url_lower:
            return _icon("clear-day" if is_day else "clear-night")

    return _icon("not-available")


def enrich_with_icon(period: Dict[str, Any]) -> Dict[str, Any]:
    """
    Add an `icon_url` key to a forecast period dict regardless of its source.
    Works for both NWS period dicts and Open-Meteo period dicts.
    """
    is_day = period.get("is_daytime", True)
    wmo    = period.get("wmo_code")           # present only in Open-Meteo periods
    nws_icon = period.get("icon")             # NWS icon URL string or slug

    period["icon_url"] = get_icon_url(
        wmo_code=wmo,
        is_daytime=is_day,
        nws_icon_url=nws_icon if isinstance(nws_icon, str) else None,
    )
    return period


# ---------------------------------------------------------------------------
# Provider selection
# ---------------------------------------------------------------------------

_VALID_PROVIDERS = ("nws", "open_meteo")


async def get_forecast_provider(db: AsyncSession) -> str:
    """
    Read the preferred forecast provider from the database, falling back to
    config and finally to "nws".
    Returns one of: "nws", "open_meteo".
    """
    result = await db.execute(
        select(AppSetting).where(AppSetting.key == "forecast_provider")
    )
    setting = result.scalar_one_or_none()
    if setting and setting.value in _VALID_PROVIDERS:
        return setting.value

    cfg = getattr(config_settings, "forecast_provider", "nws")
    return cfg if cfg in _VALID_PROVIDERS else "nws"


async def get_forecast_service(
    db: AsyncSession = Depends(get_db),
) -> Union[NWSForecastService, OpenMeteoForecastService]:
    """FastAPI dependency — returns the configured forecast service."""
    provider = await get_forecast_provider(db)
    if provider == "open_meteo":
        logger.debug("Using Open-Meteo forecast provider")
        units = await get_unit_system(db)
        return OpenMeteoForecastService(units=units)
    logger.debug("Using NWS forecast provider")
    return NWSForecastService()


async def get_units_dep(
    db: AsyncSession = Depends(get_db),
) -> str:
    """FastAPI dependency — returns the active unit system ('us' or 'metric')."""
    return await get_unit_system(db)


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class WeatherSummary(BaseModel):
    temperature: Optional[float] = None
    feels_like: Optional[float] = None
    humidity: Optional[int] = None
    wind_speed: Optional[float] = None
    wind_gust: Optional[float] = None
    wind_direction: Optional[str] = None
    rain_today: Optional[float] = None
    rain_rate: Optional[float] = None
    uv_index: Optional[int] = None
    pressure: Optional[float] = None
    soil_moisture: Optional[int] = None
    reading_time: Optional[str] = None
    conditions: Optional[str] = None
    icon_url: Optional[str] = None
    source: Optional[str] = None  # "awn", "nws", or "open_meteo"
    units: Optional[str] = "us"   # "us" or "metric"


class WeatherReadingResponse(BaseModel):
    id: int
    reading_time: datetime
    temp_outdoor: Optional[float]
    temp_indoor: Optional[float]
    feels_like: Optional[float]
    humidity_outdoor: Optional[int]
    humidity_indoor: Optional[int]
    wind_speed: Optional[float]
    wind_gust: Optional[float]
    wind_direction: Optional[int]
    pressure_relative: Optional[float]
    rain_hourly: Optional[float]
    rain_daily: Optional[float]
    rain_rate: Optional[float]
    uv_index: Optional[int]
    solar_radiation: Optional[float]

    class Config:
        from_attributes = True


class WeatherAlertResponse(BaseModel):
    id: int
    alert_type: str
    severity: AlertSeverity
    title: str
    message: Optional[str]
    recommended_actions: Optional[str]
    is_active: bool
    is_acknowledged: bool
    created_at: datetime
    expires_at: Optional[datetime]

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Service singletons
# ---------------------------------------------------------------------------

weather_service = WeatherService()
#forecast_service = NWSForecastService()


# ---------------------------------------------------------------------------
# Routes — Current conditions
# ---------------------------------------------------------------------------

@router.get("/current/", response_model=WeatherSummary)
async def get_current_weather(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
    forecast_service: Union[NWSForecastService, OpenMeteoForecastService] = Depends(get_forecast_service),
    units: str = Depends(get_units_dep),
):
    """Get current weather conditions from most recent reading or forecast-provider fallback."""
    try:
        reading = await weather_service.get_latest_reading(db)

        if reading:
            summary = weather_service.get_weather_summary(reading)
            if units == "metric":
                summary = convert_summary_to_metric(summary)
            summary["icon_url"] = get_icon_url(is_daytime=_is_daytime_now())
            summary["source"] = "awn"
            summary["units"]  = units
            return summary

        # Fallback to configured forecast provider
        obs = await forecast_service.get_current_observation()
        if obs:
            source = obs.get("source", "nws")
            # NWS always returns US units — convert if needed
            # Open-Meteo already returns in the requested unit system
            if units == "metric" and source == "nws":
                obs = convert_nws_observation_to_metric(obs)
            return WeatherSummary(
                temperature=obs.get("temp_outdoor"),
                feels_like=obs.get("feels_like") or obs.get("temp_outdoor"),
                humidity=obs.get("humidity_outdoor"),
                wind_speed=obs.get("wind_speed"),
                wind_direction=str(obs.get("wind_direction") or ""),
                conditions=obs.get("text_description", "Unknown"),
                icon_url=get_icon_url(
                    wmo_code=obs.get("wmo_code"),
                    is_daytime=_is_daytime_now(),
                    nws_icon_url=obs.get("icon"),
                ),
                source=source,
                units=units,
            )

        raise HTTPException(status_code=404, detail="No weather data available")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"get_current_weather failed: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.get("/current/raw/", response_model=WeatherReadingResponse)
async def get_current_weather_raw(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Get current weather reading with all fields."""
    try:
        reading = await weather_service.get_latest_reading(db)
        if not reading:
            raise HTTPException(status_code=404, detail="No weather data available")
        return reading
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"get_current_weather_raw failed: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.post("/refresh/")
async def refresh_weather(
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    forecast_service: Union[NWSForecastService, OpenMeteoForecastService] = Depends(get_forecast_service),
    units: str = Depends(get_units_dep),
):
    """Manually trigger a weather data fetch (AWN → forecast-provider fallback)."""
    logger.info("Manual weather refresh triggered by user {}", user.username)
    try:
        # Try AWN first
        data = await weather_service.fetch_current_weather()
        if data:
            reading = await weather_service.save_reading(db, data)
            await weather_service.check_alerts(db, reading)
            temp_display = reading.temp_outdoor
            if units == "metric" and temp_display is not None:
                from services.weather_units import f_to_c
                temp_display = f_to_c(temp_display)
            logger.info(
                "Weather refreshed from AWN: temp={}, humidity={}",
                reading.temp_outdoor, reading.humidity_outdoor,
            )
            return {
                "message": "Weather data refreshed",
                "source": "awn",
                "temperature": temp_display,
                "humidity": reading.humidity_outdoor,
                "units": units,
            }

        # Fallback to configured forecast provider
        obs = await forecast_service.get_current_observation()
        if obs:
            source = obs.get("source", "nws")
            if units == "metric" and source == "nws":
                obs = convert_nws_observation_to_metric(obs)
            logger.info("Weather refreshed from {}: temp={}", source, obs.get("temp_outdoor"))
            return {
                "message": f"Weather data from {source.upper()} (no weather station configured)",
                "source": source,
                "temperature": obs.get("temp_outdoor"),
                "humidity": obs.get("humidity_outdoor"),
                "conditions": obs.get("text_description"),
                "icon_url": get_icon_url(
                    wmo_code=obs.get("wmo_code"),
                    is_daytime=_is_daytime_now(),
                    nws_icon_url=obs.get("icon"),
                ),
                "units": units,
            }

        logger.warning("Weather data fetch failed from both AWN and forecast provider")
        raise HTTPException(status_code=503, detail="Could not fetch weather data")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"refresh_weather failed: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


# ---------------------------------------------------------------------------
# Soil moisture
# ---------------------------------------------------------------------------

@router.get("/soil-moisture/")
async def get_soil_moisture(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Get current soil moisture status and watering recommendation."""
    try:
        from services.weather import get_soil_moisture_status
        return await get_soil_moisture_status(db)
    except Exception as e:
        logger.error(f"get_soil_moisture failed: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


# ---------------------------------------------------------------------------
# History
# ---------------------------------------------------------------------------

@router.get("/history/", response_model=List[WeatherReadingResponse])
async def get_weather_history(
    hours: int = Query(default=24, ge=1, le=168),
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Get weather readings for the past X hours."""
    try:
        start = datetime.utcnow() - timedelta(hours=hours)
        return await weather_service.get_readings_range(db, start, datetime.utcnow())
    except Exception as e:
        logger.error(f"get_weather_history failed: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.get("/history/daily/")
async def get_daily_summary(
    days: int = Query(default=7, ge=1, le=30),
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
    units: str = Depends(get_units_dep),
):
    """Get daily weather summaries (high, low, rain)."""
    try:
        summaries = []
        today = datetime.utcnow().date()

        for i in range(days):
            target_date = today - timedelta(days=i)
            start = datetime.combine(target_date, datetime.min.time())
            end   = datetime.combine(target_date, datetime.max.time())

            result = await db.execute(
                select(WeatherReading)
                .where(WeatherReading.reading_time >= start)
                .where(WeatherReading.reading_time <= end)
            )
            readings = result.scalars().all()

            if readings:
                temps       = [r.temp_outdoor for r in readings if r.temp_outdoor is not None]
                rain_totals = [r.rain_daily    for r in readings if r.rain_daily    is not None]
                summaries.append({
                    "date":           target_date.isoformat(),
                    "high":           max(temps)        if temps       else None,
                    "low":            min(temps)        if temps       else None,
                    "rain":           max(rain_totals)  if rain_totals else 0,
                    "readings_count": len(readings),
                })
            else:
                summaries.append({
                    "date":           target_date.isoformat(),
                    "high":           None,
                    "low":            None,
                    "rain":           None,
                    "readings_count": 0,
                })

        if units == "metric":
            summaries = [convert_daily_summary_to_metric(s) for s in summaries]
        return {"units": units, "summaries": summaries}
    except Exception as e:
        logger.error(f"get_daily_summary failed: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

@router.get("/alerts/", response_model=List[WeatherAlertResponse])
async def get_weather_alerts(
    active_only: bool = True,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Get weather alerts."""
    try:
        query = select(WeatherAlert)
        if active_only:
            query = query.where(WeatherAlert.is_active == True)
        query = query.order_by(desc(WeatherAlert.created_at)).limit(50)
        result = await db.execute(query)
        return result.scalars().all()
    except Exception as e:
        logger.error(f"get_weather_alerts failed: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.post("/alerts/{alert_id}/acknowledge/")
async def acknowledge_alert(
    alert_id: int,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Acknowledge a weather alert."""
    try:
        result = await db.execute(select(WeatherAlert).where(WeatherAlert.id == alert_id))
        alert = result.scalar_one_or_none()
        if not alert:
            logger.error("Weather alert not found: alert_id={}", alert_id)
            raise HTTPException(status_code=404, detail="Alert not found")

        alert.is_acknowledged  = True
        alert.acknowledged_at  = datetime.utcnow()
        await db.commit()
        logger.info("Weather alert acknowledged: alert_id={}, type={}", alert_id, alert.alert_type)
        return {"message": "Alert acknowledged"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"acknowledge_alert {alert_id} failed: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.post("/alerts/{alert_id}/dismiss/")
async def dismiss_alert(
    alert_id: int,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Dismiss (deactivate) a weather alert."""
    try:
        result = await db.execute(select(WeatherAlert).where(WeatherAlert.id == alert_id))
        alert = result.scalar_one_or_none()
        if not alert:
            logger.error("Weather alert not found for dismiss: alert_id={}", alert_id)
            raise HTTPException(status_code=404, detail="Alert not found")

        alert.is_active = False
        await db.commit()
        logger.info("Weather alert dismissed: alert_id={}, type={}", alert_id, alert.alert_type)
        return {"message": "Alert dismissed"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"dismiss_alert {alert_id} failed: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@router.get("/stats/")
async def get_weather_stats(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
    units: str = Depends(get_units_dep),
):
    """Get weather statistics for the current month."""
    try:
        today       = datetime.utcnow()
        month_start = datetime(today.year, today.month, 1)

        result   = await db.execute(
            select(WeatherReading).where(WeatherReading.reading_time >= month_start)
        )
        readings = result.scalars().all()

        if not readings:
            return {"month": today.strftime("%B %Y"), "readings_count": 0, "stats": None}

        temps       = [r.temp_outdoor  for r in readings if r.temp_outdoor  is not None]
        rain_totals = [r.rain_monthly  for r in readings if r.rain_monthly  is not None]

        raw_stats = {
            "temp_high":  max(temps)               if temps       else None,
            "temp_low":   min(temps)               if temps       else None,
            "temp_avg":   sum(temps) / len(temps)  if temps       else None,
            "total_rain": max(rain_totals)          if rain_totals else 0,
        }
        if units == "metric":
            raw_stats = convert_stats_to_metric(raw_stats)
        return {
            "month":          today.strftime("%B %Y"),
            "readings_count": len(readings),
            "units":          units,
            "stats":          raw_stats,
        }
    except Exception as e:
        logger.error(f"get_weather_stats failed: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


# ---------------------------------------------------------------------------
# Forecast endpoints  (provider-agnostic)
# ---------------------------------------------------------------------------

@router.get("/forecast/")
async def get_forecast(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
    forecast_service: Union[NWSForecastService, OpenMeteoForecastService] = Depends(get_forecast_service),
    units: str = Depends(get_units_dep),
):
    """
    Get simplified 5-day weather forecast.
    Provider is determined by the 'forecast_provider' app setting
    ('nws' or 'open_meteo'). Each day entry includes an icon_url.
    """
    try:
        lat, lon = await get_location_from_db(db)

        forecast = await forecast_service.get_forecast_simple(lat=lat, lon=lon)
        if not forecast:
            logger.warning("Forecast fetch returned no data")
            raise HTTPException(status_code=503, detail="Could not fetch forecast data")

        provider = await get_forecast_provider(db)

        # NWS always returns US units — convert if needed
        if units == "metric" and isinstance(forecast_service, NWSForecastService):
            forecast = convert_nws_simple_forecast_to_metric(forecast)

        # Enrich each day entry with an icon URL
        enriched = []
        for day in forecast:
            day = dict(day)
            day["icon_url"] = get_icon_url(
                wmo_code=day.get("wmo_code"),
                is_daytime=True,
                nws_icon_url=day.get("icon") if isinstance(day.get("icon"), str) else None,
            )
            enriched.append(day)

        return {"provider": provider, "units": units, "forecast": enriched}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"get_forecast failed: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.get("/forecast/hourly/")
async def get_hourly_forecast(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
    forecast_service: Union[NWSForecastService, OpenMeteoForecastService] = Depends(get_forecast_service),
    units: str = Depends(get_units_dep),
):
    """
    Get 48-hour hourly forecast.
    Each period includes an icon_url sourced from Basmilius Meteocons (MIT).
    """
    try:
        hourly = await forecast_service.get_hourly_forecast()
        if not hourly:
            logger.warning("Hourly forecast fetch returned no data")
            raise HTTPException(status_code=503, detail="Could not fetch hourly forecast data")

        provider = await get_forecast_provider(db)

        if units == "metric" and isinstance(forecast_service, NWSForecastService):
            hourly = convert_nws_hourly_to_metric(hourly)

        enriched = []
        for period in hourly:
            period = dict(period)
            period["icon_url"] = get_icon_url(
                wmo_code=period.get("wmo_code"),
                is_daytime=period.get("is_daytime", True),
                nws_icon_url=period.get("icon") if isinstance(period.get("icon"), str) else None,
            )
            enriched.append(period)

        return {"provider": provider, "units": units, "hourly": enriched}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"get_hourly_forecast failed: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.get("/rain-forecast/")
async def get_rain_forecast(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
    forecast_service: Union[NWSForecastService, OpenMeteoForecastService] = Depends(get_forecast_service),
):
    """Get information about when rain is expected based on hourly forecast."""
    try:
        provider  = await get_forecast_provider(db)
        units     = await get_unit_system(db)
        rain_info = await forecast_service.get_rain_forecast()
        return {"provider": provider, "units": units, **rain_info}
    except Exception as e:
        logger.error(f"get_rain_forecast failed: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


# ---------------------------------------------------------------------------
# Provider info  (useful for admin UI / debugging)
# ---------------------------------------------------------------------------

@router.get("/forecast/provider/")
async def get_forecast_provider_info(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """
    Return the active forecast provider and available options.
    Useful for settings UI to show which provider is currently active.
    """
    try:
        active = await get_forecast_provider(db)
        units  = await get_unit_system(db)
        labels = get_unit_labels(units)
        return {
            "active_provider": active,
            "available_providers": list(_VALID_PROVIDERS),
            "units": units,
            "unit_labels": {
                "temperature": labels.temperature,
                "wind_speed":  labels.wind_speed,
                "pressure":    labels.pressure,
                "rain":        labels.rain,
            },
            "icon_attribution": {
                "name":    "Meteocons",
                "author":  "Bas Milius",
                "licence": "MIT",
                "url":     "https://github.com/basmilius/weather-icons",
            },
        }
    except Exception as e:
        logger.error(f"get_forecast_provider_info failed: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _is_daytime_now() -> bool:
    """Rough daytime check (6 AM – 8 PM local time) used when no WMO code available."""
    hour = datetime.now().hour
    return 6 <= hour < 20