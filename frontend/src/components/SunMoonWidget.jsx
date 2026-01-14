import React, { useState, useEffect } from 'react'
import { Sun, Moon, Sunrise, Sunset, Clock } from 'lucide-react'

function SunMoonWidget({ data, className = '' }) {
  const [timeUntilNext, setTimeUntilNext] = useState('')

  useEffect(() => {
    if (!data) return

    const calculateTimeUntil = () => {
      const now = new Date()

      // Parse times like "7:21 AM" or "5:35 PM"
      const parseTime = (timeStr) => {
        if (!timeStr) return null
        const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i)
        if (!match) return null
        let hours = parseInt(match[1], 10)
        const minutes = parseInt(match[2], 10)
        const ampm = match[3].toUpperCase()
        if (ampm === 'PM' && hours !== 12) hours += 12
        if (ampm === 'AM' && hours === 12) hours = 0
        const result = new Date(now)
        result.setHours(hours, minutes, 0, 0)
        return result
      }

      // Use API's civil twilight times (first_light/last_light) if available, else fallback to sunrise/sunset
      const firstLightTime = parseTime(data.first_light) || parseTime(data.sunrise)
      const lastLightTime = parseTime(data.last_light) || parseTime(data.sunset)
      const sunriseTime = parseTime(data.sunrise)

      if (!firstLightTime || !lastLightTime) return

      let targetTime, label
      if (data.is_daytime) {
        // It's daytime, show time until sunset
        targetTime = lastLightTime
        label = 'Sunset'
      } else {
        // It's nighttime, show time until sunrise
        if (now < firstLightTime) {
          targetTime = firstLightTime
          label = 'Sunrise'
        } else if (sunriseTime && now < sunriseTime) {
          // After first light but before sunrise
          targetTime = sunriseTime
          label = 'Sunrise'
        } else {
          // After sunset, next sunrise is tomorrow
          const tomorrowLight = new Date(firstLightTime)
          tomorrowLight.setDate(tomorrowLight.getDate() + 1)
          targetTime = tomorrowLight
          label = 'Sunrise'
        }
      }

      const diffMs = targetTime - now
      if (diffMs <= 0) return

      const totalMinutes = Math.floor(diffMs / (1000 * 60))
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60

      if (hours > 0) {
        setTimeUntilNext(`${label} in ${hours}h ${minutes}m`)
      } else {
        setTimeUntilNext(`${label} in ${minutes}m`)
      }
    }

    calculateTimeUntil()
    const interval = setInterval(calculateTimeUntil, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [data])

  if (!data) return null

  return (
    <div
      className={`rounded-lg p-3 flex flex-col justify-center ${className}`}
      style={{
        backgroundColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#374151' : '#f0e2d3',
        border: '1px solid var(--color-border-default)'
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Sun Section */}
        <div className="flex flex-wrap items-center gap-3">
          {data.is_daytime ? (
            <Sun className="w-5 h-5" style={{ color: 'var(--color-warning-500)' }} />
          ) : (
            <Moon className="w-5 h-5" style={{ color: 'var(--color-info-500)' }} />
          )}
          {/* Sunrise (civil dawn - when you can see outside) */}
          <div className="flex items-center gap-1.5" title="Sunrise - when you can see outside">
            <Sunrise className="w-4 h-4" style={{ color: 'var(--color-badge-orange-bg)' }} />
            <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{data.sunrise}</span>
          </div>
          {/* Sunset (civil dusk - when it goes dark) */}
          <div className="flex items-center gap-1.5" title="Sunset - when it goes dark">
            <Sunset className="w-4 h-4" style={{ color: 'var(--color-error-500)' }} />
            <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{data.sunset}</span>
          </div>
          {/* Countdown */}
          {timeUntilNext && (
            <span className="text-sm font-medium flex items-center gap-1" style={{ color: 'var(--color-warning-600)' }}>
              <Clock className="w-4 h-4" />
              {timeUntilNext}
            </span>
          )}
        </div>

        {/* Moon Section */}
        <div className="flex items-center gap-2">
          <span className="text-xl">{data.moon_emoji}</span>
          <div className="text-right">
            <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{data.moon_phase}</div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Illumination {data.moon_illumination}%</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SunMoonWidget
