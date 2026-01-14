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
    <SettingsContext.Provider value={{
      settings,
      loading,
      refreshSettings,
      getSetting,
      formatTime,
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
