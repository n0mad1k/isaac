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

function WeatherWidget({ weather }) {
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
    if (weather.rain_today > 0 || weather.rain_rate > 0) {
      return <CloudRain className="w-16 h-16 text-blue-400" />
    }
    if (weather.humidity > 80) {
      return <Cloud className="w-16 h-16 text-gray-400" />
    }
    return <Sun className="w-16 h-16 text-yellow-400" />
  }

  const getConditionText = () => {
    if (weather.rain_rate > 0) return 'Raining'
    if (weather.rain_today > 0) return 'Rainy'
    if (weather.humidity > 80) return 'Cloudy'
    if (weather.temperature > 90) return 'Hot'
    if (weather.temperature < 50) return 'Cool'
    return 'Clear'
  }

  const getForecastIcon = (forecast) => {
    const text = forecast.toLowerCase()
    if (text.includes('thunder') || text.includes('storm')) {
      return <CloudLightning className="w-6 h-6 text-yellow-400" />
    }
    if (text.includes('snow') || text.includes('sleet')) {
      return <CloudSnow className="w-6 h-6 text-blue-200" />
    }
    if (text.includes('rain') || text.includes('shower')) {
      return <CloudRain className="w-6 h-6 text-blue-400" />
    }
    if (text.includes('cloud') || text.includes('overcast')) {
      return <Cloud className="w-6 h-6 text-gray-400" />
    }
    if (text.includes('wind')) {
      return <Wind className="w-6 h-6 text-gray-300" />
    }
    return <Sun className="w-6 h-6 text-yellow-400" />
  }

  return (
    <div className="bg-gradient-to-br from-blue-900 to-gray-800 rounded-xl p-6 shadow-lg">
      <h2 className="text-lg font-semibold text-gray-300 mb-4">Current Weather</h2>

      <div className="flex items-center justify-between">
        {/* Main temp and icon */}
        <div className="flex items-center gap-4">
          {getWeatherIcon()}
          <div>
            <div className="text-5xl font-bold">
              {Math.round(weather.temperature)}°
            </div>
            <div className="text-gray-400">{getConditionText()}</div>
          </div>
        </div>

        {/* High/Low */}
        <div className="text-right">
          <div className="flex items-center gap-2 text-red-400">
            <TrendingUp className="w-4 h-4" />
            <span className="text-lg font-semibold">
              {weather.temp_high_today ? Math.round(weather.temp_high_today) : '--'}°
            </span>
          </div>
          <div className="flex items-center gap-2 text-blue-400">
            <TrendingDown className="w-4 h-4" />
            <span className="text-lg font-semibold">
              {weather.temp_low_today ? Math.round(weather.temp_low_today) : '--'}°
            </span>
          </div>
        </div>
      </div>

      {/* Weather details */}
      <div className="grid grid-cols-4 gap-4 mt-6 pt-4 border-t border-gray-700">
        <div className="text-center">
          <Thermometer className="w-5 h-5 mx-auto text-orange-400" />
          <div className="text-sm text-gray-400 mt-1">Feels Like</div>
          <div className="font-semibold">{Math.round(weather.feels_like)}°</div>
        </div>
        <div className="text-center">
          <Droplets className="w-5 h-5 mx-auto text-blue-400" />
          <div className="text-sm text-gray-400 mt-1">Humidity</div>
          <div className="font-semibold">{weather.humidity}%</div>
        </div>
        <div className="text-center">
          <Wind className="w-5 h-5 mx-auto text-gray-400" />
          <div className="text-sm text-gray-400 mt-1">Wind</div>
          <div className="font-semibold">
            {Math.round(weather.wind_speed)} mph {weather.wind_direction}
          </div>
        </div>
        <div className="text-center">
          <CloudRain className="w-5 h-5 mx-auto text-blue-400" />
          <div className="text-sm text-gray-400 mt-1">Rain Today</div>
          <div className="font-semibold">{weather.rain_today?.toFixed(2) || '0'}"</div>
        </div>
      </div>

      {/* UV Index if high */}
      {weather.uv_index >= 6 && (
        <div className="mt-4 p-3 bg-orange-900/50 rounded-lg text-orange-300 text-sm">
          High UV Index: {weather.uv_index} - Wear sunscreen!
        </div>
      )}

      {/* 5-Day Forecast */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">5-Day Forecast</h3>
        {forecastLoading ? (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-24 bg-gray-700 rounded-lg h-28 animate-pulse"></div>
            ))}
          </div>
        ) : forecast ? (
          <div className="grid grid-cols-5 gap-2">
            {forecast.map((day, index) => (
              <div
                key={index}
                className="bg-gray-700/50 rounded-lg p-2 text-center min-w-0"
              >
                <div className="text-xs text-gray-400 font-medium truncate">{day.name}</div>
                <div className="my-1 flex justify-center">
                  {getForecastIcon(day.forecast)}
                </div>
                <div className="flex justify-center gap-1 text-sm">
                  {day.high && (
                    <span className="text-red-400 font-semibold">{day.high}°</span>
                  )}
                  {day.low && (
                    <span className="text-blue-400">{day.low}°</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1 leading-tight line-clamp-2" title={day.forecast}>
                  {day.forecast}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500 text-center py-4">
            Forecast unavailable
          </div>
        )}
      </div>

      {/* Last updated */}
      <div className="text-xs text-gray-500 mt-4 text-right">
        Updated:{' '}
        {weather.reading_time
          ? new Date(weather.reading_time).toLocaleTimeString()
          : 'Unknown'}
      </div>
    </div>
  )
}

export default WeatherWidget
