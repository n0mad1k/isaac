import React, { useEffect, useState, useRef } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { Home, Leaf, PawPrint, ListTodo, Calendar, Sprout, Settings, RefreshCw, Car, Wrench, Fence } from 'lucide-react'
import { getSettings } from '../services/api'

function Layout() {
  const [refreshInterval, setRefreshInterval] = useState(0) // 0 = disabled
  const [lastRefresh, setLastRefresh] = useState(Date.now())
  const [countdown, setCountdown] = useState(0)
  const location = useLocation()
  const intervalRef = useRef(null)
  const countdownRef = useRef(null)

  // Fetch refresh interval from settings
  useEffect(() => {
    const fetchRefreshSetting = async () => {
      try {
        const response = await getSettings()
        const settings = response.data.settings
        const interval = parseInt(settings?.dashboard_refresh_interval?.value || '0')
        // Value is in minutes, convert to milliseconds (if value > 0)
        if (interval > 0) {
          setRefreshInterval(interval * 60 * 1000) // minutes to ms
          setCountdown(interval * 60) // countdown in seconds
        }
      } catch (error) {
        console.error('Failed to fetch refresh settings:', error)
      }
    }
    fetchRefreshSetting()
  }, [])

  // Set up page refresh timer
  useEffect(() => {
    if (refreshInterval > 0) {
      // Clear existing intervals
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)

      // Set countdown timer (updates every second)
      setCountdown(refreshInterval / 1000)
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            return refreshInterval / 1000
          }
          return prev - 1
        })
      }, 1000)

      // Set refresh timer
      intervalRef.current = setInterval(() => {
        window.location.reload()
      }, refreshInterval)

      setLastRefresh(Date.now())

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
        if (countdownRef.current) clearInterval(countdownRef.current)
      }
    }
  }, [refreshInterval])

  // Reset timer when navigating (optional - keeps timer running continuously)
  // Uncomment below if you want timer to reset on navigation
  // useEffect(() => {
  //   if (refreshInterval > 0) {
  //     setCountdown(refreshInterval / 1000)
  //   }
  // }, [location.pathname])

  const formatCountdown = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`
    }
    return `${secs}s`
  }

  const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/todo', icon: ListTodo, label: 'To Do' },
    { to: '/calendar', icon: Calendar, label: 'Calendar' },
    { to: '/plants', icon: Leaf, label: 'Plants' },
    { to: '/seeds', icon: Sprout, label: 'Seeds' },
    { to: '/animals', icon: PawPrint, label: 'Animals' },
    { to: '/home-maintenance', icon: Home, label: 'Maint' },
    { to: '/vehicles', icon: Car, label: 'Vehicles' },
    { to: '/equipment', icon: Wrench, label: 'Equip' },
    { to: '/farm-areas', icon: Fence, label: 'Farm' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ]

  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      {/* Sidebar - Always visible */}
      <aside className="w-20 bg-gray-800 flex flex-col items-center py-4 flex-shrink-0">
        <div className="mb-8">
          <span className="text-2xl">🌾</span>
        </div>
        <nav className="flex flex-col gap-2 flex-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-colors ${
                  isActive
                    ? 'text-farm-green bg-gray-700'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`
              }
            >
              <item.icon className="w-6 h-6 mb-1" />
              <span className="text-xs">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Auto-refresh indicator */}
        {refreshInterval > 0 && (
          <div className="mt-auto mb-2 flex flex-col items-center text-gray-500">
            <RefreshCw className="w-4 h-4 mb-1 animate-pulse" />
            <span className="text-xs">{formatCountdown(countdown)}</span>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
