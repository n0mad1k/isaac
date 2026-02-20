import React, { useState, useEffect, useCallback, useRef } from 'react'
import { AlertTriangle, Clock, Archive, Check, Circle, ArrowUp, ChevronDown, ChevronUp, Wrench, MapPin, User } from 'lucide-react'
import { getDashboard, getAnimals, getSettings, completeTask, toggleBacklog, getWorkers, getWorkerTasks, getTeamMembers, getMemberTasks } from '../services/api'
import WeatherWidget from '../components/WeatherWidget'
import SunMoonWidget from '../components/SunMoonWidget'
import TaskList from '../components/TaskList'
import AlertBanner from '../components/AlertBanner'
import StorageAlertWidget from '../components/StorageAlertWidget'
import ColdProtectionWidget from '../components/ColdProtectionWidget'
import AnimalFeedWidget from '../components/AnimalFeedWidget'
import BudgetWidget from '../components/BudgetWidget'
import BibleVerse from '../components/BibleVerse'
import MottoDisplay from '../components/MottoDisplay'
import { useSettings } from '../contexts/SettingsContext'

function Dashboard() {
  const { getTimezone, getSetting } = useSettings()
  const [data, setData] = useState(null)
  const [animals, setAnimals] = useState([])
  const [hideCompleted, setHideCompleted] = useState(false)
  const [workers, setWorkers] = useState([])
  const [selectedWorkerId, setSelectedWorkerId] = useState(null)
  const [workerTasks, setWorkerTasks] = useState(null)
  const [members, setMembers] = useState([])
  const [selectedMemberId, setSelectedMemberId] = useState(null)
  const [memberTasks, setMemberTasks] = useState(null)
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

  // Retry wrapper for API calls
  const fetchWithRetry = async (fetchFn, maxRetries = 2) => {
    let lastError
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fetchFn()
      } catch (err) {
        lastError = err
        if (attempt < maxRetries) {
          // Wait before retry: 500ms, then 1000ms
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
          console.log(`Retrying request (attempt ${attempt + 2}/${maxRetries + 1})...`)
        }
      }
    }
    throw lastError
  }

  const fetchData = useCallback(async () => {
    try {
      // Use Promise.allSettled to handle partial failures gracefully
      const [dashboardResult, animalsResult, settingsResult] = await Promise.allSettled([
        fetchWithRetry(() => getDashboard()),
        fetchWithRetry(() => getAnimals()),
        fetchWithRetry(() => getSettings())
      ])

      // Dashboard is required - if it fails, show error
      if (dashboardResult.status === 'rejected') {
        console.error('Dashboard fetch failed:', dashboardResult.reason)
        setError('Failed to load dashboard data. Please refresh.')
        return
      }

      setData(dashboardResult.value.data)

      // Animals and settings are optional - use cached/default if they fail
      if (animalsResult.status === 'fulfilled') {
        setAnimals(animalsResult.value.data)
      } else {
        console.warn('Animals fetch failed, using cached data:', animalsResult.reason)
      }

      if (settingsResult.status === 'fulfilled') {
        const hideCompletedSetting = settingsResult.value.data?.settings?.hide_completed_today?.value
        setHideCompleted(hideCompletedSetting === 'true')
      } else {
        console.warn('Settings fetch failed, using cached data:', settingsResult.reason)
      }

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

  // Fetch workers and team members for dropdown
  useEffect(() => {
    const fetchWorkersData = async () => {
      try {
        const response = await getWorkers()
        setWorkers(response.data || [])
      } catch (err) {
        console.error('Failed to fetch workers:', err)
      }
    }
    const fetchMembersData = async () => {
      try {
        const response = await getTeamMembers()
        setMembers((response.data || []).filter(m => m.is_active !== false))
      } catch (err) {
        console.error('Failed to fetch team members:', err)
      }
    }
    fetchWorkersData()
    fetchMembersData()
  }, [])

  // Fetch worker tasks when a worker is selected
  useEffect(() => {
    if (!selectedWorkerId) {
      setWorkerTasks(null)
      return
    }
    const fetchWorkerTasksData = async () => {
      try {
        const response = await getWorkerTasks(selectedWorkerId, { include_completed: !hideCompleted })
        setWorkerTasks(response.data || [])
      } catch (err) {
        console.error('Failed to fetch worker tasks:', err)
        setWorkerTasks([])
      }
    }
    fetchWorkerTasksData()
  }, [selectedWorkerId, hideCompleted])

  // Fetch member tasks when a member is selected
  useEffect(() => {
    if (!selectedMemberId) {
      setMemberTasks(null)
      return
    }
    const fetchMemberTasksData = async () => {
      try {
        const response = await getMemberTasks(selectedMemberId, { include_completed: !hideCompleted })
        setMemberTasks(response.data || [])
      } catch (err) {
        console.error('Failed to fetch member tasks:', err)
        setMemberTasks([])
      }
    }
    fetchMemberTasksData()
  }, [selectedMemberId, hideCompleted])

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
    <div ref={containerRef} className="flex flex-col gap-2 md:gap-3 min-h-0 h-auto md:h-full overflow-auto md:overflow-hidden">
      {/* Header Row: Date/Time, Motto, Budget Ticker */}
      <div className="flex items-start justify-between gap-2 sm:gap-4 flex-shrink-0">
        {/* Left - Date/Time */}
        <div className="flex-shrink-0 min-w-0">
          <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>
            {formatTimeInTz(currentTime, { weekday: 'short', month: 'short', day: 'numeric' })}
          </h1>
          <div className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-mono" style={{ color: 'var(--color-text-primary)' }}>
            {(() => {
              const is12h = getSetting('time_format', '12h') === '12h'
              const timeStr = formatTimeInTz(currentTime, { hour: 'numeric', minute: '2-digit', hour12: is12h })
              const ampm = is12h ? (formatTimeInTz(currentTime, { hour: 'numeric', hour12: true }).match(/(AM|PM)/i)?.[0] || '') : ''
              return (
                <>
                  {timeStr.replace(/\s*(AM|PM)$/i, '')}
                  <span className="text-sm sm:text-lg md:text-base lg:text-xl">:{formatTimeInTz(currentTime, { second: '2-digit' })} {ampm}</span>
                </>
              )
            })()}
          </div>
        </div>

        {/* Motto - fills remaining space, wraps if needed */}
        <MottoDisplay className="py-1" />

        {/* Right - Budget Ticker */}
        <BudgetWidget className="flex-shrink-0 hidden md:flex" />
      </div>

      {/* Bible Verse - its own row */}
      <BibleVerse />

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
          <div ref={taskListRef} className="flex flex-col max-h-[50vh] md:max-h-[60vh]">
            {/* Worker/Member filter dropdown - mobile-friendly */}
            {(workers.length > 0 || members.length > 0) && (
              <div className="mb-2 flex items-center gap-2">
                <User className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-secondary)' }} />
                <select
                  value={selectedWorkerId ? `worker:${selectedWorkerId}` : selectedMemberId ? `member:${selectedMemberId}` : ''}
                  onChange={(e) => {
                    const value = e.target.value
                    if (!value) {
                      setSelectedWorkerId(null)
                      setSelectedMemberId(null)
                    } else if (value.startsWith('worker:')) {
                      setSelectedWorkerId(parseInt(value.split(':')[1]))
                      setSelectedMemberId(null)
                    } else if (value.startsWith('member:')) {
                      setSelectedMemberId(parseInt(value.split(':')[1]))
                      setSelectedWorkerId(null)
                    }
                  }}
                  className="flex-1 text-sm md:text-sm text-base rounded-lg px-3 py-2 md:px-2 md:py-1 min-h-[44px] md:min-h-0"
                  style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border-default)'
                  }}
                >
                  <option value="">Today's Schedule</option>
                  {members.length > 0 && (
                    <optgroup label="Team Members">
                      {members.map(member => (
                        <option key={`member:${member.id}`} value={`member:${member.id}`}>
                          {member.nickname || member.name}'s Reminders
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {workers.length > 0 && (
                    <optgroup label="Workers">
                      {workers.map(worker => (
                        <option key={`worker:${worker.id}`} value={`worker:${worker.id}`}>
                          {worker.name}'s Tasks
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            )}
            <TaskList
              title={selectedWorkerId
                ? `${workers.find(w => w.id === selectedWorkerId)?.name || 'Worker'}'s Tasks`
                : selectedMemberId
                  ? `${members.find(m => m.id === selectedMemberId)?.nickname || members.find(m => m.id === selectedMemberId)?.name || 'Member'}'s Reminders`
                  : "Today's Schedule"}
              tasks={selectedWorkerId
                ? (hideCompleted ? workerTasks?.filter(t => !t.is_completed) : workerTasks)
                : selectedMemberId
                  ? (hideCompleted ? memberTasks?.filter(t => !t.is_completed) : memberTasks)
                  : (hideCompleted ? data?.tasks_today?.filter(t => !t.is_completed) : data?.tasks_today)}
              onTaskToggle={() => {
                fetchData()
                if (selectedWorkerId) {
                  getWorkerTasks(selectedWorkerId, { include_completed: !hideCompleted })
                    .then(res => setWorkerTasks(res.data || []))
                }
                if (selectedMemberId) {
                  getMemberTasks(selectedMemberId, { include_completed: !hideCompleted })
                    .then(res => setMemberTasks(res.data || []))
                }
              }}
              showTimeAndLocation={true}
              fillContainer={true}
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
                      <div className="flex items-center gap-2 flex-wrap">
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
                        {/* Assigned member badge */}
                        {(task.assigned_member_names?.length > 0 || task.assigned_to_member_name) && (
                          <span className="text-xs px-1.5 py-0.5 rounded flex items-center gap-0.5 flex-shrink-0" style={{ backgroundColor: 'var(--color-bg-surface-muted)', color: 'var(--color-text-primary)' }}>
                            <User className="w-3 h-3" />
                            {task.assigned_member_names?.length > 0 ? task.assigned_member_names.join(', ') : task.assigned_to_member_name}
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
