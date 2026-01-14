"""
Weather API Routes
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel

from models.database import get_db
from models.weather import WeatherReading, WeatherAlert, AlertSeverity
from services.weather import WeatherService, NWSForecastService


router = APIRouter(prefix="/weather", tags=["Weather"])


# Pydantic Schemas
class WeatherSummary(BaseModel):
    temperature: Optional[float]
    feels_like: Optional[float]
    humidity: Optional[int]
    wind_speed: Optional[float]
    wind_gust: Optional[float]
    wind_direction: Optional[str]
    rain_today: Optional[float]
    rain_rate: Optional[float]
    uv_index: Optional[int]
    pressure: Optional[float]
    soil_moisture: Optional[int]
    reading_time: Optional[str]


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


# Initialize weather services
weather_service = WeatherService()
forecast_service = NWSForecastService()


# Routes
@router.get("/current/", response_model=WeatherSummary)
async def get_current_weather(db: AsyncSession = Depends(get_db)):
    """Get current weather conditions from most recent reading"""
    reading = await weather_service.get_latest_reading(db)
    if not reading:
        raise HTTPException(status_code=404, detail="No weather data available")

    return weather_service.get_weather_summary(reading)


@router.get("/current/raw/", response_model=WeatherReadingResponse)
async def get_current_weather_raw(db: AsyncSession = Depends(get_db)):
    """Get current weather reading with all fields"""
    reading = await weather_service.get_latest_reading(db)
    if not reading:
        raise HTTPException(status_code=404, detail="No weather data available")
    return reading


@router.post("/refresh/")
async def refresh_weather(db: AsyncSession = Depends(get_db)):
    """Manually trigger a weather data fetch"""
    data = await weather_service.fetch_current_weather()
    if not data:
        raise HTTPException(status_code=503, detail="Could not fetch weather data")

    reading = await weather_service.save_reading(db, data)
    await weather_service.check_alerts(db, reading)

    return {
        "message": "Weather data refreshed",
        "temperature": reading.temp_outdoor,
        "humidity": reading.humidity_outdoor,
    }


@router.get("/soil-moisture/")
async def get_soil_moisture(db: AsyncSession = Depends(get_db)):
    """Get current soil moisture status and watering recommendation"""
    from services.weather import get_soil_moisture_status
    return await get_soil_moisture_status(db)


@router.get("/history/", response_model=List[WeatherReadingResponse])
async def get_weather_history(
    hours: int = Query(default=24, le=168),  # Max 1 week
    db: AsyncSession = Depends(get_db),
):
    """Get weather readings for the past X hours"""
    start = datetime.utcnow() - timedelta(hours=hours)
    readings = await weather_service.get_readings_range(db, start, datetime.utcnow())
    return readings


@router.get("/history/daily/")
async def get_daily_summary(
    days: int = Query(default=7, le=30),
    db: AsyncSession = Depends(get_db),
):
    """Get daily weather summaries (high, low, rain)"""
    summaries = []
    today = datetime.utcnow().date()

    for i in range(days):
        target_date = today - timedelta(days=i)
        start = datetime.combine(target_date, datetime.min.time())
        end = datetime.combine(target_date, datetime.max.time())

        result = await db.execute(
            select(WeatherReading)
            .where(WeatherReading.reading_time >= start)
            .where(WeatherReading.reading_time <= end)
        )
        readings = result.scalars().all()

        if readings:
            temps = [r.temp_outdoor for r in readings if r.temp_outdoor is not None]
            rain_totals = [r.rain_daily for r in readings if r.rain_daily is not None]

            summaries.append({
                "date": target_date.isoformat(),
                "high": max(temps) if temps else None,
                "low": min(temps) if temps else None,
                "rain": max(rain_totals) if rain_totals else 0,
                "readings_count": len(readings),
            })
        else:
            summaries.append({
                "date": target_date.isoformat(),
                "high": None,
                "low": None,
                "rain": None,
                "readings_count": 0,
            })

    return summaries


# Alerts
@router.get("/alerts/", response_model=List[WeatherAlertResponse])
async def get_weather_alerts(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
):
    """Get weather alerts"""
    query = select(WeatherAlert)

    if active_only:
        query = query.where(WeatherAlert.is_active == True)

    query = query.order_by(desc(WeatherAlert.created_at)).limit(50)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/alerts/{alert_id}/acknowledge/")
async def acknowledge_alert(alert_id: int, db: AsyncSession = Depends(get_db)):
    """Acknowledge a weather alert"""
    result = await db.execute(
        select(WeatherAlert).where(WeatherAlert.id == alert_id)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.is_acknowledged = True
    alert.acknowledged_at = datetime.utcnow()
    await db.commit()
    return {"message": "Alert acknowledged"}


@router.post("/alerts/{alert_id}/dismiss/")
async def dismiss_alert(alert_id: int, db: AsyncSession = Depends(get_db)):
    """Dismiss (deactivate) a weather alert"""
    result = await db.execute(
        select(WeatherAlert).where(WeatherAlert.id == alert_id)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.is_active = False
    await db.commit()
    return {"message": "Alert dismissed"}


@router.get("/stats/")
async def get_weather_stats(db: AsyncSession = Depends(get_db)):
    """Get weather statistics for the current month"""
    today = datetime.utcnow()
    month_start = datetime(today.year, today.month, 1)

    result = await db.execute(
        select(WeatherReading)
        .where(WeatherReading.reading_time >= month_start)
    )
    readings = result.scalars().all()

    if not readings:
        return {
            "month": today.strftime("%B %Y"),
            "readings_count": 0,
            "stats": None,
        }

    temps = [r.temp_outdoor for r in readings if r.temp_outdoor is not None]
    rain_totals = [r.rain_monthly for r in readings if r.rain_monthly is not None]

    return {
        "month": today.strftime("%B %Y"),
        "readings_count": len(readings),
        "stats": {
            "temp_high": max(temps) if temps else None,
            "temp_low": min(temps) if temps else None,
            "temp_avg": sum(temps) / len(temps) if temps else None,
            "total_rain": max(rain_totals) if rain_totals else 0,
        },
    }


# Forecast (NWS)
@router.get("/forecast/")
async def get_forecast():
    """Get 5-day weather forecast from National Weather Service"""
    forecast = await forecast_service.get_forecast_simple()
    if not forecast:
        raise HTTPException(status_code=503, detail="Could not fetch forecast data")
    return {"forecast": forecast}
