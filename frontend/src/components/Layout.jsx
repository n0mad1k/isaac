import React, { useEffect, useState, useRef } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Home, Leaf, PawPrint, ListTodo, Calendar, Sprout, Settings, Car, Wrench, Fence, Package, Menu, X, LogOut, User, Bug, ChevronDown, ChevronUp, Users, ClipboardList, Keyboard, Wheat, LayoutDashboard, UsersRound } from 'lucide-react'
import { getSettings, getVersionInfo, toggleKeyboard as toggleKeyboardApi } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import FloatingActionMenu from './FloatingActionMenu'

function Layout() {
  const [refreshInterval, setRefreshInterval] = useState(0) // 0 = disabled
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isDevInstance, setIsDevInstance] = useState(false)
  const [workerTasksEnabled, setWorkerTasksEnabled] = useState(false)
  const [teamEnabled, setTeamEnabled] = useState(false)
  const [showKeyboardButton, setShowKeyboardButton] = useState(false)
  const [showHardRefreshButton, setShowHardRefreshButton] = useState(true)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const intervalRef = useRef(null)
  const userMenuRef = useRef(null)
  const desktopUserMenuRef = useRef(null)
  const { user, logout, isAdmin } = useAuth()

  // Auto-capitalize first letter of text inputs
  useEffect(() => {
    // Check if input should be capitalized
    const shouldCapitalize = (input) => {
      const type = input.getAttribute('type')
      // Skip email, password, URL, number, and search inputs
      if (['email', 'password', 'url', 'number', 'search'].includes(type)) return false
      // Skip inputs with data-no-capitalize attribute
      if (input.dataset.noCapitalize) return false
      return true
    }

    // Get the native value setter for React-controlled inputs
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set

    // Capitalize first letter - called on input event (as user types)
    const capitalizeFirstLetter = (e) => {
      const input = e.target
      if (!shouldCapitalize(input)) return
      // Only act when typing the first character (length becomes 1)
      // or when first char is lowercase
      const value = input.value
      if (value.length > 0 && value[0] !== value[0].toUpperCase() && /[a-z]/.test(value[0])) {
        const newValue = value.charAt(0).toUpperCase() + value.slice(1)
        const start = input.selectionStart
        const end = input.selectionEnd

        // Use native setter to properly trigger React's change detection
        const setter = input.tagName === 'TEXTAREA' ? nativeTextareaValueSetter : nativeInputValueSetter
        setter.call(input, newValue)

        // Dispatch input event for React
        const event = new Event('input', { bubbles: true })
        input.dispatchEvent(event)

        // Restore cursor position
        input.setSelectionRange(start, end)
      }
    }

    // Set autocapitalize attribute and attach event listener
    const setupInput = (input) => {
      if (!shouldCapitalize(input)) return

      // Set mobile keyboard hint
      if (!input.hasAttribute('autocapitalize')) {
        input.setAttribute('autocapitalize', 'words')
      }

      // Add input handler for capitalizing first letter (only once)
      if (!input.dataset.capitalizeSetup) {
        input.dataset.capitalizeSetup = 'true'
        // Use input event for immediate feedback as user types
        input.addEventListener('input', capitalizeFirstLetter, { capture: true })
      }
    }

    // Setup all existing inputs
    const setupAllInputs = () => {
      document.querySelectorAll('input[type="text"], input:not([type]), textarea').forEach(setupInput)
    }

    // Initial setup
    setupAllInputs()

    // Watch for dynamically added inputs (modals, forms that appear later)
    const observer = new MutationObserver(setupAllInputs)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [])

  // Update document title based on dev/prod status
  useEffect(() => {
    document.title = isDevInstance ? '[DEV] Isaac - Farm Assistant' : 'Isaac - Farm Assistant'
  }, [isDevInstance])

  const handleLogout = async () => {
    setUserMenuOpen(false)
    await logout()
    navigate('/login')
  }

  const handleUserManagement = () => {
    setUserMenuOpen(false)
    navigate('/settings', { state: { tab: 'users' } })
  }

  // Toggle on-screen keyboard via backend API (D-Bus to onboard)
  const toggleKeyboard = async () => {
    try {
      await toggleKeyboardApi()
    } catch (e) {
      console.log('Keyboard toggle failed:', e)
    }
  }

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const inMobileMenu = userMenuRef.current && userMenuRef.current.contains(event.target)
      const inDesktopMenu = desktopUserMenuRef.current && desktopUserMenuRef.current.contains(event.target)
      if (!inMobileMenu && !inDesktopMenu) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  // Fetch refresh interval from settings and check if dev instance
  useEffect(() => {
    const fetchRefreshSetting = async () => {
      try {
        const response = await getSettings()
        const settings = response.data.settings
        const interval = parseInt(settings?.dashboard_refresh_interval?.value || '0')
        // Value is in minutes, convert to milliseconds (if value > 0)
        if (interval > 0) {
          setRefreshInterval(interval * 60 * 1000) // minutes to ms
        }
        // Check worker tasks enabled
        const workerEnabled = settings?.worker_tasks_enabled?.value === 'true'
        setWorkerTasksEnabled(workerEnabled)
        // Check team enabled
        const teamIsEnabled = settings?.team_enabled?.value === 'true'
        setTeamEnabled(teamIsEnabled)
        // Check keyboard button enabled
        const keyboardEnabled = settings?.show_keyboard_button?.value === 'true'
        setShowKeyboardButton(keyboardEnabled)
        // Check hard refresh button enabled (defaults to true)
        const hardRefreshEnabled = settings?.show_hard_refresh_button?.value !== 'false'
        setShowHardRefreshButton(hardRefreshEnabled)
      } catch (error) {
        console.error('Failed to fetch settings:', error)
      }
    }
    const fetchVersionInfo = async () => {
      try {
        const response = await getVersionInfo()
        setIsDevInstance(response.data.is_dev_instance || false)
      } catch (error) {
        console.error('Failed to fetch version info:', error)
      }
    }
    fetchRefreshSetting()
    fetchVersionInfo()
  }, [])

  // Check if any modal or form is open (to pause refresh)
  const isModalOpen = () => {
    // Check for any fixed overlay (modals use fixed positioning with bg-black/50)
    const modals = document.querySelectorAll('.fixed.inset-0')
    return modals.length > 0
  }

  // Set up dashboard data refresh timer - ONLY on dashboard
  useEffect(() => {
    // Only auto-refresh on the dashboard page
    const isDashboard = location.pathname === '/'

    if (refreshInterval > 0 && isDashboard) {
      // Clear existing intervals
      if (intervalRef.current) clearInterval(intervalRef.current)

      // Set refresh timer - dispatch custom event instead of full page reload
      intervalRef.current = setInterval(() => {
        // Don't refresh if a modal/form is open
        if (isModalOpen()) {
          return
        }
        // Dispatch custom event for dashboard to refresh its data
        window.dispatchEvent(new CustomEvent('dashboard-refresh'))
      }, refreshInterval)

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    } else {
      // Clear interval when not on dashboard
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [refreshInterval, location.pathname])

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dash' },
    { to: '/todo', icon: ListTodo, label: 'To Do' },
    { to: '/calendar', icon: Calendar, label: 'Calendar' },
    // Worker Tasks only shows when enabled in settings
    ...(workerTasksEnabled ? [{ to: '/worker-tasks', icon: ClipboardList, label: 'Workers' }] : []),
    // Team shows when enabled in settings
    ...(teamEnabled ? [{ to: '/team', icon: UsersRound, label: 'Team' }] : []),
    { to: '/plants', icon: Leaf, label: 'Plants' },
    { to: '/seeds', icon: Sprout, label: 'Seeds' },
    { to: '/animals', icon: PawPrint, label: 'Animals' },
    { to: '/home-maintenance', icon: Home, label: 'Home' },
    { to: '/vehicles', icon: Car, label: 'Vehicles' },
    { to: '/equipment', icon: Wrench, label: 'Equip' },
    { to: '/farm-areas', icon: Fence, label: 'Farm' },
    { to: '/production', icon: Package, label: 'Prod' },
    // Dev tracker only shows on dev instance
    ...(isDevInstance ? [{ to: '/dev-tracker', icon: Bug, label: 'Dev' }] : []),
    { to: '/settings', icon: Settings, label: 'Settings' },
  ]

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Dev Instance Banner */}
      {isDevInstance && (
        <div className="bg-orange-600 text-white text-center py-1 text-sm font-medium z-[60]">
          Development Instance - Changes here don't affect production
        </div>
      )}


      {/* Content wrapper - flex container for sidebar + main */}
      <div className="flex-1 flex flex-col md:flex-row">
      {/* Desktop Sidebar - Compact, expandable */}
      <aside className="hidden md:flex w-16 flex-col items-center py-2 flex-shrink-0" style={{ backgroundColor: 'var(--color-nav-bg, #1f2937)' }}>
        <NavLink to="/" className="mb-2 hover:opacity-80 transition-opacity">
          <Wheat className="w-6 h-6" style={{ color: 'var(--accent-gold)' }} />
        </NavLink>
        <nav className="flex flex-col gap-1">
          {/* Core nav items - always visible */}
          {navItems.filter(item => !['/settings', '/dev-tracker'].includes(item.to)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center w-12 h-12 rounded-lg transition-colors ${
                  isActive
                    ? 'text-farm-green'
                    : 'hover:opacity-80'
                }`
              }
              style={({ isActive }) => ({
                backgroundColor: isActive ? 'var(--color-nav-item-bg-active)' : 'transparent',
                color: isActive ? 'var(--color-nav-item-text-active)' : 'var(--color-nav-item-text)'
              })}
              title={item.label}
            >
              <item.icon className="w-6 h-6" />
            </NavLink>
          ))}
        </nav>

        {/* Bottom section - Settings, Dev, User (expandable) */}
        <div className="pt-1 flex flex-col items-center" style={{ borderTop: '1px solid var(--color-border-strong)' }}>
          {/* Expanded options */}
          {mobileMenuOpen && (
            <>
              {isDevInstance && (
                <NavLink
                  to="/dev-tracker"
                  className={({ isActive }) =>
                    `flex items-center justify-center w-12 h-12 rounded-lg transition-colors ${
                      isActive ? 'text-farm-green' : 'hover:opacity-80'
                    }`
                  }
                  style={({ isActive }) => ({
                    backgroundColor: isActive ? 'var(--color-nav-item-bg-active)' : 'transparent',
                    color: isActive ? 'var(--color-nav-item-text-active)' : 'var(--color-nav-item-text)'
                  })}
                  title="Dev Tracker"
                >
                  <Bug className="w-6 h-6" />
                </NavLink>
              )}
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `flex items-center justify-center w-12 h-12 rounded-lg transition-colors ${
                    isActive ? 'text-farm-green' : 'hover:opacity-80'
                  }`
                }
                style={({ isActive }) => ({
                  backgroundColor: isActive ? 'var(--color-nav-item-bg-active)' : 'transparent',
                  color: isActive ? 'var(--color-nav-item-text-active)' : 'var(--color-nav-item-text)'
                })}
                title="Settings"
              >
                <Settings className="w-6 h-6" />
              </NavLink>
              {user && (
                <div className="relative" ref={desktopUserMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex flex-col items-center py-2 rounded-lg w-12 transition-colors hover:opacity-80"
                    style={{ color: 'var(--color-nav-item-text)' }}
                    title="User menu"
                  >
                    <User className="w-6 h-6 mb-1" />
                    <span className="text-[10px] leading-tight text-center max-w-[60px] truncate">
                      {user.display_name || user.username}
                    </span>
                  </button>
                  {userMenuOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-40 bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-1 z-50">
                      {isAdmin && (
                        <button
                          onClick={handleUserManagement}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                        >
                          <Users className="w-4 h-4" />
                          User Management
                        </button>
                      )}
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300"
                      >
                        <LogOut className="w-4 h-4" />
                        Log Out
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          {/* Expand button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="w-12 h-10 rounded-lg flex items-center justify-center hover:opacity-80"
            style={{ color: 'var(--color-nav-item-text)' }}
            title={mobileMenuOpen ? 'Less' : 'More'}
          >
            {mobileMenuOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </button>
        </div>
      </aside>

      {/* Main content - full width on mobile, no header clearance needed */}
      <main className="flex-1 overflow-auto p-3 md:p-4 lg:p-6">
        <Outlet />
      </main>
      </div>

      {/* Floating action menu with keyboard, feedback, and hard refresh options */}
      <FloatingActionMenu
        showKeyboard={showKeyboardButton}
        showHardRefresh={showHardRefreshButton}
        isDevInstance={isDevInstance}
        workerTasksEnabled={workerTasksEnabled}
      />
    </div>
  )
}

export default Layout
