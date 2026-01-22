import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Leaf, PawPrint, ListTodo, AlertTriangle, Clock, Archive, Check, Circle, ArrowUp, ChevronDown, ChevronUp, Wrench, MapPin } from 'lucide-react'
import { getDashboard, getAnimals, getSettings, completeTask, toggleBacklog } from '../services/api'
import WeatherWidget from '../components/WeatherWidget'
import SunMoonWidget from '../components/SunMoonWidget'
import TaskList from '../components/TaskList'
import AlertBanner from '../components/AlertBanner'
import StorageAlertWidget from '../components/StorageAlertWidget'
import StatsCard from '../components/StatsCard'
import ColdProtectionWidget from '../components/ColdProtectionWidget'
import AnimalFeedWidget from '../components/AnimalFeedWidget'
import BibleVerse from '../components/BibleVerse'
import { useSettings } from '../contexts/SettingsContext'

function Dashboard() {
  const { getTimezone, getSetting } = useSettings()
  const [data, setData] = useState(null)
  const [animals, setAnimals] = useState([])
  const [hideCompleted, setHideCompleted] = useState(false)
  const [backlogCollapsed, setBacklogCollapsed] = useState(false)
  const [userToggledBacklog, setUserToggledBacklog] = useState(false)
  const [needsMoreSpace, setNeedsMoreSpace] = useState(false)
  const [acknowledgedAdvisories, setAcknowledgedAdvisories] = useState([])
  const taskListRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const containerRef = useRef(null)
  const rightColumnRef = useRef(null)
  const mainGridRef = useRef(null)

  // Format time in configured timezone
  const formatTimeInTz = (date, options) => {
    const tz = getTimezone()
    const timeFormat = getSetting('time_format', '12h')
    try {
      return new Intl.DateTimeFormat('en-US', { timeZone: tz, ...options }).format(date)
    } catch (e) {
      return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', ...options }).format(date)
    }
  }

  const fetchData = useCallback(async () => {
    try {
      const [dashboardRes, animalsRes, settingsRes] = await Promise.all([
        getDashboard(),
        getAnimals(),
        getSettings()
      ])
      setData(dashboardRes.data)
      setAnimals(animalsRes.data)
      // Check hide_completed_today setting
      const hideCompletedSetting = settingsRes.data?.settings?.hide_completed_today?.value
      setHideCompleted(hideCompletedSetting === 'true')
      setError(null)
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
      setError('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    // Refresh every 5 minutes (internal refresh)
    const interval = setInterval(fetchData, 5 * 60 * 1000)

    // Listen for external refresh requests from Layout
    const handleExternalRefresh = () => {
      console.log('Dashboard refresh triggered')
      fetchData()
    }
    window.addEventListener('dashboard-refresh', handleExternalRefresh)

    return () => {
      clearInterval(interval)
      window.removeEventListener('dashboard-refresh', handleExternalRefresh)
    }
  }, [fetchData])

  useEffect(() => {
    // Update clock every second
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto-collapse backlog when page would need to scroll
  useEffect(() => {
    const checkIfNeedsSpace = () => {
      if (!mainGridRef.current) return
      const grid = mainGridRef.current
      // Check if the grid content exceeds its container (causes scrolling)
      const isOverflowing = grid.scrollHeight > grid.clientHeight + 10
      setNeedsMoreSpace(isOverflowing)
      // Auto-collapse if overflowing and user hasn't manually toggled
      if (isOverflowing && !userToggledBacklog && !backlogCollapsed) {
        setBacklogCollapsed(true)
      }
    }
    // Check after render and on resize
    const timer = setTimeout(checkIfNeedsSpace, 150)
    window.addEventListener('resize', checkIfNeedsSpace)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', checkIfNeedsSpace)
    }
  }, [data, userToggledBacklog, backlogCollapsed])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 mx-auto"
               style={{ borderBottom: '2px solid var(--accent-primary)' }}></div>
          <p className="mt-4" style={{ color: 'var(--text-muted)' }}>Loading Isaac...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center" style={{ color: 'var(--error)' }}>
          <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
          <p>{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 rounded-lg transition-all"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--text-primary)',
              boxShadow: '0 2px 8px var(--btn-glow)'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-2 md:gap-3 h-full md:h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] overflow-hidden">
      {/* Header with Date/Time, Bible Verse, and Stats */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-2 lg:gap-4 flex-shrink-0">
        {/* Top row on mobile: Date/Time and Stats */}
        <div className="flex items-start justify-between gap-2 lg:contents">
          {/* Left - Date/Time (using configured timezone) */}
          <div className="flex-shrink-0 min-w-0">
            <h1 className="text-lg sm:text-xl md:text-xl lg:text-2xl font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>
              {formatTimeInTz(currentTime, { weekday: 'short', month: 'short', day: 'numeric' })}
            </h1>
            <div className="text-xl sm:text-2xl md:text-2xl lg:text-3xl font-mono" style={{ color: 'var(--color-text-primary)' }}>
              {formatTimeInTz(currentTime, { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s*(AM|PM)$/i, '')}
              <span className="text-sm sm:text-lg md:text-base lg:text-xl">:{formatTimeInTz(currentTime, { second: '2-digit' })} {formatTimeInTz(currentTime, { hour: 'numeric', hour12: true }).match(/(AM|PM)/i)?.[0] || ''}</span>
            </div>
          </div>

          {/* Stats - 2x2 grid on mobile, row on desktop */}
          <div className="grid grid-cols-2 gap-1 sm:flex sm:gap-2 flex-shrink-0 lg:order-3">
            <StatsCard
              title="Plants"
              value={data?.stats?.total_plants || 0}
              icon={Leaf}
              color="green"
            />
            <StatsCard
              title="Animals"
              value={data?.stats?.total_animals || 0}
              icon={PawPrint}
              color="blue"
            />
            <StatsCard
              title="Tasks"
              value={data?.stats?.tasks_today || 0}
              icon={ListTodo}
              color="yellow"
            />
            <StatsCard
              title="Overdue"
              value={data?.stats?.tasks_overdue || 0}
              icon={Clock}
              color={data?.stats?.tasks_overdue > 0 ? 'red' : 'green'}
            />
          </div>
        </div>

        {/* Bible Verse - Full width below on mobile, center on desktop */}
        <div className="w-full lg:flex-1 lg:order-2">
          <BibleVerse />
        </div>
      </div>

      {/* Alerts - Priority positioning */}
      <AlertBanner alerts={data?.alerts} onDismiss={fetchData} acknowledgedAdvisories={acknowledgedAdvisories} />

      {/* Storage Alert - Only shows when storage is low/critical */}
      <StorageAlertWidget />

      {/* Cold Protection Widget - Priority positioning right after alerts */}
      <ColdProtectionWidget onAcknowledge={setAcknowledgedAdvisories} />

      {/* Main Grid */}
      <div ref={mainGridRef} className="grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-3 flex-1 min-h-0 overflow-auto">
        {/* Left Column - natural sizes, scrolls if needed */}
        <div className="flex flex-col gap-2 md:gap-3 md:pr-2">
          <WeatherWidget weather={data?.weather} />
          <SunMoonWidget data={data?.sun_moon} />
          <AnimalFeedWidget animals={animals} />
        </div>

        {/* Right Column - natural sizes, scrolls if needed */}
        <div ref={rightColumnRef} className="flex flex-col gap-2 md:gap-3 md:pr-2">
          <div ref={taskListRef}>
            <TaskList
              title="Today's Schedule"
              tasks={hideCompleted
                ? data?.tasks_today?.filter(t => !t.is_completed)
                : data?.tasks_today}
              onTaskToggle={fetchData}
              showTimeAndLocation={true}
            />
          </div>

          {/* Backlog Widget */}
          {data?.backlog_tasks && data.backlog_tasks.length > 0 && (
            <div className="rounded-xl overflow-hidden"
                 style={{
                   backgroundColor: 'var(--color-bg-surface)',
                   border: '1px solid var(--color-border-default)'
                 }}>
              <button
                onClick={() => {
                  setBacklogCollapsed(!backlogCollapsed)
                  setUserToggledBacklog(true)
                }}
                className="w-full p-2 px-3 flex items-center justify-between transition-colors"
                style={{ backgroundColor: 'transparent' }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-surface-hover)'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div className="flex items-center gap-2">
                  <Archive className="w-4 h-4" style={{ color: 'var(--color-gold-600)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Backlog</span>
                  <span className="text-xs font-normal" style={{ color: 'var(--color-text-muted)' }}>({data.backlog_tasks.length})</span>
                </div>
                {backlogCollapsed ? (
                  <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-gold-600)' }} />
                ) : (
                  <ChevronUp className="w-4 h-4" style={{ color: 'var(--color-gold-600)' }} />
                )}
              </button>
              {!backlogCollapsed && (
                <div className="px-3 pb-3 space-y-1.5 max-h-64 overflow-y-auto">
                  {data.backlog_tasks.map(task => (
                    <div
                      key={task.id}
                      className="p-2 rounded-lg"
                      style={{
                        backgroundColor: 'var(--color-bg-surface-soft)',
                        borderLeft: '3px solid var(--color-border-default)'
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            try {
                              await completeTask(task.id)
                              fetchData()
                            } catch (err) {
                              console.error('Failed to complete task:', err)
                            }
                          }}
                          className="flex-shrink-0 focus:outline-none"
                          title="Complete"
                        >
                          <Circle className="w-4 h-4 hover:opacity-80" style={{ color: 'var(--color-text-secondary)' }} />
                        </button>
                        <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                          {task.title}
                        </span>
                        {/* Location badge */}
                        {task.linked_location && (
                          <span className="text-xs px-1.5 py-0.5 rounded flex items-center gap-0.5 flex-shrink-0" style={{ backgroundColor: 'var(--color-bg-surface-muted)', color: 'var(--color-text-primary)' }}>
                            <MapPin className="w-3 h-3" />
                            {task.linked_location}
                          </span>
                        )}
                        {/* Vehicle/Equipment badge */}
                        {task.linked_entity && (
                          <span className="text-xs px-1.5 py-0.5 rounded flex items-center gap-0.5 flex-shrink-0" style={{ backgroundColor: 'var(--color-gold-700)', color: 'var(--color-text-inverse)' }}>
                            <Wrench className="w-3 h-3" />
                            {task.linked_entity}
                          </span>
                        )}
                        <div className="flex-1" />
                        <button
                          onClick={async () => {
                            try {
                              await toggleBacklog(task.id)
                              fetchData()
                            } catch (err) {
                              console.error('Failed to move to today:', err)
                            }
                          }}
                          className="flex-shrink-0 px-1.5 py-0.5 text-xs rounded flex items-center gap-1"
                          style={{ backgroundColor: 'var(--color-bg-surface-muted)', color: 'var(--color-text-primary)' }}
                          title="Move to Today"
                        >
                          <ArrowUp className="w-3 h-3" />
                          Today
                        </button>
                      </div>
                      {/* Description (shows animal names for grouped tasks) */}
                      {task.description && (
                        <p className="text-xs mt-1 ml-6 truncate" style={{ color: 'var(--color-text-muted)' }}>
                          {task.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
