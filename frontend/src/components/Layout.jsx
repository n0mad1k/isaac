import React, { useEffect, useState, useRef } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Home, Leaf, PawPrint, ListTodo, Calendar, Sprout, Settings, Car, Wrench, Fence, Package, Menu, X, LogOut, User } from 'lucide-react'
import { getSettings } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

function Layout() {
  const [refreshInterval, setRefreshInterval] = useState(0) // 0 = disabled
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const intervalRef = useRef(null)
  const { user, logout, isAdmin } = useAuth()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

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

  // Check if any modal or form is open (to pause refresh)
  const isModalOpen = () => {
    // Check for any fixed overlay (modals use fixed positioning with bg-black/50)
    const modals = document.querySelectorAll('.fixed.inset-0')
    return modals.length > 0
  }

  // Set up page refresh timer
  useEffect(() => {
    if (refreshInterval > 0) {
      // Clear existing intervals
      if (intervalRef.current) clearInterval(intervalRef.current)

      // Set refresh timer
      intervalRef.current = setInterval(() => {
        // Don't refresh if a modal/form is open
        if (isModalOpen()) {
          return
        }
        window.location.reload()
      }, refreshInterval)

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }
  }, [refreshInterval])

  const navItems = [
    { to: '/', icon: Home, label: 'Dash' },
    { to: '/todo', icon: ListTodo, label: 'To Do' },
    { to: '/calendar', icon: Calendar, label: 'Calendar' },
    { to: '/plants', icon: Leaf, label: 'Plants' },
    { to: '/seeds', icon: Sprout, label: 'Seeds' },
    { to: '/animals', icon: PawPrint, label: 'Animals' },
    { to: '/home-maintenance', icon: Home, label: 'Home' },
    { to: '/vehicles', icon: Car, label: 'Vehicles' },
    { to: '/equipment', icon: Wrench, label: 'Equip' },
    { to: '/farm-areas', icon: Fence, label: 'Farm' },
    { to: '/production', icon: Package, label: 'Prod' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ]

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col md:flex-row">
      {/* Mobile Header with Menu Button - fixed positioning for reliable scroll behavior */}
      <header className="md:hidden bg-gray-800 px-4 py-3 flex items-center justify-between fixed top-0 left-0 right-0 z-50">
        <NavLink to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="text-2xl">🌾</span>
          <span className="text-lg font-semibold text-farm-green">Isaac</span>
        </NavLink>
        <div className="flex items-center gap-2">
          {user && (
            <span className="text-xs text-gray-400 hidden sm:block">
              {user.display_name || user.username}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg bg-gray-700 text-gray-400 hover:text-red-400 transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-gray-700 text-white"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Dropdown Menu - fixed to work with fixed header */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed top-14 left-0 right-0 bg-gray-800 border-b border-gray-700 z-40 max-h-[70vh] overflow-y-auto">
          <nav className="grid grid-cols-4 gap-1 p-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center p-3 rounded-lg transition-colors ${
                    isActive
                      ? 'text-farm-green bg-gray-700'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`
                }
              >
                <item.icon className="w-5 h-5 mb-1" />
                <span className="text-xs">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      )}

      {/* Desktop Sidebar - Hidden on mobile */}
      <aside className="hidden md:flex w-20 bg-gray-800 flex-col items-center py-4 flex-shrink-0">
        <NavLink to="/" className="mb-8 hover:opacity-80 transition-opacity">
          <span className="text-2xl">🌾</span>
        </NavLink>
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

        {/* User info and logout */}
        {user && (
          <div className="mt-auto pt-4 border-t border-gray-700 flex flex-col items-center gap-2">
            <div className="text-center">
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center mb-1">
                <User className="w-4 h-4 text-gray-400" />
              </div>
              <span className="text-xs text-gray-400 block truncate max-w-[60px]">
                {user.display_name || user.username}
              </span>
              <span className="text-[10px] text-gray-500 capitalize">
                {user.role}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-gray-700 transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </aside>

      {/* Main content - pt-20 on mobile for fixed header clearance */}
      <main className="flex-1 overflow-auto p-3 pt-20 md:p-4 md:pt-4 lg:p-6">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
