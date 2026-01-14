import React, { useState, useEffect } from 'react'
import {
  Sun,
  Cloud,
  CloudRain,
  Wind,
  Droplets,
  Thermometer,
  TrendingUp,
  TrendingDown,
  CloudSnow,
  CloudLightning,
} from 'lucide-react'
import { getWeatherForecast } from '../services/api'

function WeatherWidget({ weather, className = '' }) {
  const [forecast, setForecast] = useState(null)
  const [forecastLoading, setForecastLoading] = useState(true)

  useEffect(() => {
    const fetchForecast = async () => {
      try {
        const response = await getWeatherForecast()
        setForecast(response.data.forecast)
      } catch (error) {
        console.error('Failed to fetch forecast:', error)
      } finally {
        setForecastLoading(false)
      }
    }
    fetchForecast()

    // Listen for dashboard refresh events to update forecast
    const handleRefresh = () => fetchForecast()
    window.addEventListener('dashboard-refresh', handleRefresh)

    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [])

  if (!weather) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 animate-pulse">
        <div className="h-8 bg-gray-700 rounded w-1/2 mb-4"></div>
        <div className="h-16 bg-gray-700 rounded w-full"></div>
      </div>
    )
  }

  const getWeatherIcon = () => {
    // All icons black for e-reader style
    if (weather.rain_rate > 0 || weather.rain_today >= 0.1) {
      return <CloudRain className="w-16 h-16" style={{ color: '#1a1a1a' }} />
    }
    if (weather.humidity > 80) {
      return <Cloud className="w-16 h-16" style={{ color: '#1a1a1a' }} />
    }
    return <Sun className="w-16 h-16" style={{ color: '#1a1a1a' }} />
  }

  const getConditionText = () => {
    // "Raining" = actively raining right now
    if (weather.rain_rate > 0) return 'Raining'
    // "Rainy" = significant rain today (> 0.1")
    if (weather.rain_today >= 0.1) return 'Rainy'
    if (weather.humidity > 80) return 'Cloudy'
    if (weather.temperature > 95) return 'Extreme Heat'
    if (weather.temperature > 90) return 'Hot'
    if (weather.temperature > 80) return 'Warm'
    if (weather.temperature < 32) return 'Freezing'
    if (weather.temperature < 45) return 'Cold'
    if (weather.temperature < 55) return 'Cool'
    return 'Clear'
  }

  // Temperature-based color - black for light mode (e-reader style), colors for dark mode
  const getTempColor = (temp) => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    if (!isDark) return '#1a1a1a'  // Black text for light mode (e-reader style)
    // Colors only for dark mode
    if (temp >= 90) return '#dc2626'  // red-600 - very hot
    if (temp >= 70) return '#ef4444'  // red-500 - warm/hot
    if (temp >= 55) return '#f97316'  // orange-500 - mild
    if (temp >= 45) return '#67e8f9'  // cyan-300 - cool
    if (temp >= 35) return '#22d3ee'  // cyan-400 - cold
    if (temp >= 32) return '#38bdf8'  // sky-400 - near freezing
    return '#3b82f6'                   // blue-500 - freezing
  }

  // Static background color
  const getWidgetBackground = () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    return isDark ? '#374151' : '#f0e2d3'
  }

  const getForecastIcon = (forecast) => {
    // All icons black for e-reader style
    const text = forecast.toLowerCase()
    if (text.includes('thunder') || text.includes('storm')) {
      return <CloudLightning className="w-6 h-6" style={{ color: '#1a1a1a' }} />
    }
    if (text.includes('snow') || text.includes('sleet')) {
      return <CloudSnow className="w-6 h-6" style={{ color: '#1a1a1a' }} />
    }
    if (text.includes('rain') || text.includes('shower')) {
      return <CloudRain className="w-6 h-6" style={{ color: '#1a1a1a' }} />
    }
    if (text.includes('cloud') || text.includes('overcast')) {
      return <Cloud className="w-6 h-6" style={{ color: '#1a1a1a' }} />
    }
    if (text.includes('wind')) {
      return <Wind className="w-6 h-6" style={{ color: '#1a1a1a' }} />
    }
    return <Sun className="w-6 h-6" style={{ color: '#1a1a1a' }} />
  }

  return (
    <div className={`rounded-xl p-4 shadow-lg flex flex-col overflow-hidden ${className}`}
         style={{
           background: getWidgetBackground(),
           border: '1px solid #a17f66'
         }}>
      <div className="flex items-center justify-between">
        {/* Main temp and icon */}
        <div className="flex items-center gap-3">
          <div className="scale-75 origin-left">{getWeatherIcon()}</div>
          <div>
            <div className="text-4xl font-bold" style={{ color: getTempColor(weather.temperature) }}>
              {Math.round(weather.temperature)}°
            </div>
            <div className="text-sm" style={{ color: '#1a1a1a' }}>{getConditionText()}</div>
          </div>
        </div>

        {/* High/Low with temperature colors */}
        <div className="text-right">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" style={{ color: weather.temp_high_today ? getTempColor(weather.temp_high_today) : 'var(--error)' }} />
            <span className="font-semibold" style={{ color: weather.temp_high_today ? getTempColor(weather.temp_high_today) : 'var(--text-muted)' }}>
              {weather.temp_high_today ? Math.round(weather.temp_high_today) : '--'}°
            </span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingDown className="w-3 h-3" style={{ color: weather.temp_low_today ? getTempColor(weather.temp_low_today) : 'var(--info)' }} />
            <span className="font-semibold" style={{ color: weather.temp_low_today ? getTempColor(weather.temp_low_today) : 'var(--text-muted)' }}>
              {weather.temp_low_today ? Math.round(weather.temp_low_today) : '--'}°
            </span>
          </div>
        </div>
      </div>

      {/* Weather details - grid for mobile responsiveness */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 text-sm"
           style={{ borderTop: '1px solid #a17f66' }}>
        <div className="flex items-center gap-1.5">
          <Thermometer className="w-4 h-4 flex-shrink-0" style={{ color: '#1a1a1a' }} />
          <span style={{ color: '#1a1a1a' }}>Feels</span>
          <span className="font-semibold" style={{ color: '#1a1a1a' }}>{Math.round(weather.feels_like)}°</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Droplets className="w-4 h-4 flex-shrink-0" style={{ color: '#1a1a1a' }} />
          <span style={{ color: '#1a1a1a' }}>Humidity</span>
          <span className="font-semibold" style={{ color: '#1a1a1a' }}>{weather.humidity}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Wind className="w-4 h-4 flex-shrink-0" style={{ color: '#1a1a1a' }} />
          <span style={{ color: '#1a1a1a' }}>Wind</span>
          <span className="font-semibold" style={{ color: '#1a1a1a' }}>{Math.round(weather.wind_speed)} {weather.wind_direction}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CloudRain className="w-4 h-4 flex-shrink-0" style={{ color: '#1a1a1a' }} />
          <span style={{ color: '#1a1a1a' }}>Rain</span>
          <span className="font-semibold" style={{ color: '#1a1a1a' }}>{weather.rain_today?.toFixed(2) || '0'}"</span>
        </div>
      </div>

      {/* UV Index if high */}
      {weather.uv_index >= 6 && (
        <div className="mt-2 p-2 rounded-lg text-xs bg-amber-900/50 text-amber-300">
          High UV: {weather.uv_index} - Wear sunscreen!
        </div>
      )}

      {/* 5-Day Forecast */}
      <div className="mt-2 pt-2" style={{ borderTop: '1px solid #a17f66' }}>
        <h3 className="text-xs font-semibold mb-2" style={{ color: '#1a1a1a' }}>5-Day Forecast</h3>
        {forecastLoading ? (
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex-1 h-24 rounded animate-pulse" style={{ backgroundColor: 'transparent' }}></div>
            ))}
          </div>
        ) : forecast ? (
          <div className="grid grid-cols-5 gap-1">
            {forecast.map((day, index) => (
              <div
                key={index}
                className="rounded p-2 text-center flex flex-col justify-between"
                style={{ backgroundColor: 'transparent' }}
              >
                <div className="text-xs font-medium truncate" style={{ color: '#1a1a1a' }}>{day.name}</div>
                <div className="my-1 flex justify-center items-center">
                  {getForecastIcon(day.forecast)}
                </div>
                <div className="flex justify-center gap-1 text-sm">
                  {day.high && (
                    <span className="font-semibold" style={{ color: getTempColor(day.high) }}>{day.high}°</span>
                  )}
                  {day.low && (
                    <span style={{ color: getTempColor(day.low) }}>{day.low}°</span>
                  )}
                </div>
                <div className="text-[10px] leading-tight line-clamp-2 mt-1"
                     style={{ color: '#1a1a1a' }}
                     title={day.forecast}>
                  {day.forecast}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-center py-2" style={{ color: '#1a1a1a' }}>
            Forecast unavailable
          </div>
        )}
      </div>

      {/* Last updated */}
      <div className="text-[10px] mt-1 text-right flex-shrink-0" style={{ color: '#1a1a1a' }}>
        Updated:{' '}
        {weather.reading_time
          ? new Date(weather.reading_time).toLocaleTimeString()
          : 'Unknown'}
      </div>
    </div>
  )
}

export default WeatherWidget
