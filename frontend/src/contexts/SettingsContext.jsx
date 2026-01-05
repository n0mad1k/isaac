import React, { createContext, useContext, useState, useEffect } from 'react'
import { getSettings } from '../services/api'

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await getSettings()
      setSettings(response.data.settings)
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshSettings = () => fetchSettings()

  // Helper to get a setting value with default fallback
  const getSetting = (key, defaultValue = '') => {
    return settings[key]?.value ?? defaultValue
  }

  // Time formatting helper
  const formatTime = (timeStr) => {
    if (!timeStr) return ''
    const format = getSetting('time_format', '12h')

    // Parse time string (HH:MM or HH:MM:SS)
    const parts = timeStr.split(':')
    if (parts.length < 2) return timeStr

    let hours = parseInt(parts[0], 10)
    const minutes = parts[1]

    if (format === '24h') {
      return `${hours.toString().padStart(2, '0')}:${minutes}`
    } else {
      // 12-hour format
      const ampm = hours >= 12 ? 'PM' : 'AM'
      hours = hours % 12 || 12
      return `${hours}:${minutes} ${ampm}`
    }
  }

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings, getSetting, formatTime }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
