import React, { createContext, useContext, useState, useEffect } from 'react'
import { getSettings } from '../services/api'
import { useAuth } from './AuthContext'

const SettingsContext = createContext(null)

/**
 * Initialize theme before React hydration to prevent flash
 * This runs immediately when the script loads
 */
function getInitialTheme() {
  // First check localStorage
  const savedTheme = localStorage.getItem('isaac-theme')
  if (savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme
  }

  // Then check system preference
  if (typeof window !== 'undefined' && window.matchMedia) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    return prefersDark ? 'dark' : 'light'
  }

  // Default to dark
  return 'dark'
}

export function SettingsProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState(getInitialTheme)

  // Apply theme using data-theme attribute on HTML element
  useEffect(() => {
    const html = document.documentElement

    // Set data-theme attribute (used by our token system)
    html.setAttribute('data-theme', theme)

    // Also set class for any Tailwind dark: prefixes that might be in use
    html.classList.remove('light', 'dark')
    html.classList.add(theme)

    // Persist to localStorage
    localStorage.setItem('isaac-theme', theme)
  }, [theme])

  // Listen for system theme changes (if no localStorage preference)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = (e) => {
      // Only auto-switch if user hasn't explicitly set a preference
      const savedTheme = localStorage.getItem('isaac-theme')
      if (!savedTheme) {
        setTheme(e.matches ? 'dark' : 'light')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // Sync theme from settings when loaded (backend setting takes precedence)
  useEffect(() => {
    if (settings.theme?.value && settings.theme.value !== theme) {
      setTheme(settings.theme.value)
    }
  }, [settings.theme?.value])

  useEffect(() => {
    // Only fetch settings when authenticated
    if (isAuthenticated) {
      fetchSettings()
    } else {
      setSettings({})
      setLoading(false)
    }
  }, [isAuthenticated])

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

  // Toggle between light and dark theme
  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  // Get the configured timezone (defaults to America/New_York)
  const getTimezone = () => getSetting('timezone', 'America/New_York')

  // Time formatting helper (for HH:MM strings)
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

  // Format a Date object in the configured timezone (default: mm/dd/yyyy)
  const formatDate = (date, options = {}) => {
    if (!date) return ''
    const tz = getTimezone()
    const dateObj = date instanceof Date ? date : new Date(date)
    if (isNaN(dateObj.getTime())) return ''

    // Default to mm/dd/yyyy format
    const defaultOptions = {
      timeZone: tz,
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      ...options
    }

    try {
      return new Intl.DateTimeFormat('en-US', defaultOptions).format(dateObj)
    } catch (e) {
      // Fallback if timezone is invalid
      return new Intl.DateTimeFormat('en-US', { ...defaultOptions, timeZone: 'America/New_York' }).format(dateObj)
    }
  }

  // Format date as YYYY-MM-DD in configured timezone
  const formatDateISO = (date) => {
    if (!date) return ''
    const tz = getTimezone()
    const dateObj = date instanceof Date ? date : new Date(date)
    if (isNaN(dateObj.getTime())) return ''

    try {
      const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
      return formatter.format(dateObj)
    } catch (e) {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(dateObj)
    }
  }

  // Format datetime with both date and time in configured timezone
  const formatDateTime = (date, options = {}) => {
    if (!date) return ''
    const tz = getTimezone()
    const dateObj = date instanceof Date ? date : new Date(date)
    if (isNaN(dateObj.getTime())) return ''
    const timeFormat = getSetting('time_format', '12h')

    const defaultOptions = {
      timeZone: tz,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: timeFormat === '12h',
      ...options
    }

    try {
      return new Intl.DateTimeFormat('en-US', defaultOptions).format(dateObj)
    } catch (e) {
      return new Intl.DateTimeFormat('en-US', { ...defaultOptions, timeZone: 'America/New_York' }).format(dateObj)
    }
  }

  // Get current date/time in configured timezone as a Date-like object
  // Returns { year, month, day, hours, minutes, seconds, dayOfWeek }
  const getNow = () => {
    const tz = getTimezone()
    const now = new Date()

    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        weekday: 'short'
      }).formatToParts(now)

      const getValue = (type) => parts.find(p => p.type === type)?.value
      return {
        year: parseInt(getValue('year'), 10),
        month: parseInt(getValue('month'), 10),
        day: parseInt(getValue('day'), 10),
        hours: parseInt(getValue('hour'), 10),
        minutes: parseInt(getValue('minute'), 10),
        seconds: parseInt(getValue('second'), 10),
        dayOfWeek: getValue('weekday'),
        date: now // original Date object for calculations
      }
    } catch (e) {
      return {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        hours: now.getHours(),
        minutes: now.getMinutes(),
        seconds: now.getSeconds(),
        dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()],
        date: now
      }
    }
  }

  // Get today's date string (YYYY-MM-DD) in configured timezone
  const getTodayISO = () => formatDateISO(new Date())

  return (
    <SettingsContext.Provider value={{
      settings,
      loading,
      refreshSettings,
      getSetting,
      formatTime,
      formatDate,
      formatDateISO,
      formatDateTime,
      getNow,
      getTodayISO,
      getTimezone,
      theme,
      setTheme,
      toggleTheme,
      isDark: theme === 'dark',
      isLight: theme === 'light'
    }}>
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
