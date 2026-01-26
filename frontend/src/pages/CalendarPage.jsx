import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, Check, Trash2, Pencil, RefreshCw, Clock, CheckSquare, MapPin, Wrench } from 'lucide-react'
import { getCalendarMonth, getCalendarWeek, createTask, updateTask, deleteTask, completeTask, uncompleteTask, syncCalendar } from '../services/api'
import EventModal from '../components/EventModal'
import MottoDisplay from '../components/MottoDisplay'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, addMonths, subMonths, addDays, subDays, startOfWeek, addWeeks, subWeeks, isSameDay } from 'date-fns'
import { useSettings } from '../contexts/SettingsContext'

// Task categories
const TASK_CATEGORIES = [
  { value: 'garden', label: 'Garden' },
  { value: 'livestock', label: 'Livestock' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'household', label: 'Household' },
  { value: 'other', label: 'Other' },
]

// Hours for day/week view
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function CalendarPage() {
  const { formatTime } = useSettings()
  const [view, setView] = useState('week') // 'month', 'week', 'day'
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState({})
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [selectedDayEvents, setSelectedDayEvents] = useState([])
  const scrollRef = useRef(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update current time every minute for the time indicator
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute
    return () => clearInterval(timer)
  }, [])

  const fetchCalendarData = useCallback(async () => {
    setLoading(true)
    try {
      if (view === 'week') {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
        const response = await getCalendarWeek(
          weekStart.getFullYear(),
          weekStart.getMonth() + 1,
          weekStart.getDate()
        )
        setEvents(response.data.tasks || {})
      } else if (view === 'day') {
        // Day view: fetch just that day using week endpoint (more efficient than month)
        const response = await getCalendarWeek(
          currentDate.getFullYear(),
          currentDate.getMonth() + 1,
          currentDate.getDate()
        )
        // Filter to just the current day
        const dateKey = format(currentDate, 'yyyy-MM-dd')
        const dayEvents = response.data.tasks?.[dateKey] || []
        setEvents({ [dateKey]: dayEvents })
      } else {
        // Month view
        const year = currentDate.getFullYear()
        const month = currentDate.getMonth() + 1
        const response = await getCalendarMonth(year, month)
        setEvents(response.data.tasks || {})
      }
    } catch (error) {
      console.error('Failed to fetch calendar data:', error)
    } finally {
      setLoading(false)
    }
  }, [currentDate, view])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await syncCalendar()
      await fetchCalendarData()
    } catch (error) {
      console.error('Failed to sync calendar:', error)
    } finally {
      setSyncing(false)
    }
  }

  // Note: Removed auto-sync on page load - bidirectional CalDAV sync is slow (~75s)
  // Users can click Sync button when needed. Tasks sync individually when created/updated.

  useEffect(() => {
    fetchCalendarData()
  }, [fetchCalendarData])

  // Auto-scroll to current hour on week/day view
  useEffect(() => {
    if ((view === 'week' || view === 'day') && scrollRef.current && !loading) {
      const currentHour = new Date().getHours()
      const scrollPosition = Math.max(0, (currentHour - 1) * 60) // 60px per hour
      scrollRef.current.scrollTop = scrollPosition
    }
  }, [view, loading])

  // Navigation handlers
  const goToPrev = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1))
    else if (view === 'week') setCurrentDate(subWeeks(currentDate, 1))
    else setCurrentDate(subDays(currentDate, 1))
  }

  const goToNext = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1))
    else if (view === 'week') setCurrentDate(addWeeks(currentDate, 1))
    else setCurrentDate(addDays(currentDate, 1))
  }

  const goToToday = () => setCurrentDate(new Date())

  const handleDayClick = (day) => {
    const dateKey = format(day, 'yyyy-MM-dd')
    const dayEvents = events[dateKey] || []
    setSelectedDate(day)
    setSelectedDayEvents(dayEvents)
  }

  const handleAddEvent = (date = null) => {
    if (date) setSelectedDate(date)
    setEditingEvent(null)
    setShowEventModal(true)
  }

  const handleEditEvent = (event) => {
    setEditingEvent(event)
    setShowEventModal(true)
  }

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Delete this event?')) return
    try {
      await deleteTask(eventId)
      await fetchCalendarData()
      if (selectedDate) {
        const updatedEvents = selectedDayEvents.filter(e => e.id !== eventId)
        setSelectedDayEvents(updatedEvents)
      }
    } catch (error) {
      console.error('Failed to delete event:', error)
      window.alert('Failed to delete event: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleToggleComplete = async (event) => {
    try {
      if (event.is_completed) {
        await uncompleteTask(event.id)
      } else {
        await completeTask(event.id)
      }
      await fetchCalendarData()
      if (selectedDate) {
        setSelectedDayEvents(prev => prev.map(e =>
          e.id === event.id ? { ...e, is_completed: !e.is_completed } : e
        ))
      }
    } catch (error) {
      console.error('Failed to toggle event:', error)
    }
  }

  // Get navigation title based on view
  const getNavTitle = () => {
    if (view === 'month') return format(currentDate, 'MMMM yyyy')
    if (view === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
      const weekEnd = addDays(weekStart, 6)
      if (weekStart.getMonth() === weekEnd.getMonth()) {
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'd, yyyy')}`
      }
      return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`
    }
    return format(currentDate, 'EEEE, MMMM d, yyyy')
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2 flex-shrink-0" style={{ color: 'var(--color-text-primary)' }}>
          <CalendarIcon className="w-7 h-7" style={{ color: 'var(--color-teal-600)' }} />
          Calendar
        </h1>
        <MottoDisplay />
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          {/* View Switcher */}
          <div className="flex rounded-lg p-1" style={{ backgroundColor: 'var(--color-bg-surface-muted)' }}>
            <button
              onClick={() => setView('day')}
              className="px-3 py-1 rounded text-sm transition-colors"
              style={{
                backgroundColor: view === 'day' ? 'var(--color-green-600)' : 'transparent',
                color: view === 'day' ? '#ffffff' : 'var(--color-text-secondary)'
              }}
            >
              Day
            </button>
            <button
              onClick={() => setView('week')}
              className="px-3 py-1 rounded text-sm transition-colors"
              style={{
                backgroundColor: view === 'week' ? 'var(--color-green-600)' : 'transparent',
                color: view === 'week' ? '#ffffff' : 'var(--color-text-secondary)'
              }}
            >
              Week
            </button>
            <button
              onClick={() => setView('month')}
              className="px-3 py-1 rounded text-sm transition-colors"
              style={{
                backgroundColor: view === 'month' ? 'var(--color-green-600)' : 'transparent',
                color: view === 'month' ? '#ffffff' : 'var(--color-text-secondary)'
              }}
            >
              Month
            </button>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-teal-600)', color: '#ffffff' }}
            title="Sync with phone calendar"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
          <button
            onClick={() => handleAddEvent(new Date())}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
            style={{ backgroundColor: 'var(--color-green-600)', color: '#ffffff' }}
          >
            <Plus className="w-5 h-5" />
            Add Event
          </button>
          <button
            onClick={goToToday}
            className="px-4 py-2 rounded-lg transition-colors"
            style={{ backgroundColor: 'var(--color-bg-surface-muted)', color: 'var(--color-text-primary)' }}
          >
            Today
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <button
          onClick={goToPrev}
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'var(--color-text-primary)' }}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>{getNavTitle()}</h2>
        <button
          onClick={goToNext}
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'var(--color-text-primary)' }}
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Calendar Views */}
      {loading ? (
        <div className="flex items-center justify-center h-64 rounded-xl" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--color-green-600)' }}></div>
        </div>
      ) : (
        <>
          {view === 'month' && (
            <MonthView
              currentDate={currentDate}
              events={events}
              selectedDate={selectedDate}
              onDayClick={handleDayClick}
              onAddEvent={handleAddEvent}
              formatTime={formatTime}
            />
          )}
          {view === 'week' && (
            <WeekView
              currentDate={currentDate}
              currentTime={currentTime}
              events={events}
              scrollRef={scrollRef}
              onEventClick={handleEditEvent}
              onAddEvent={handleAddEvent}
              onToggleComplete={handleToggleComplete}
              formatTime={formatTime}
            />
          )}
          {view === 'day' && (
            <DayView
              currentDate={currentDate}
              currentTime={currentTime}
              events={events}
              scrollRef={scrollRef}
              onEventClick={handleEditEvent}
              onAddEvent={handleAddEvent}
              onToggleComplete={handleToggleComplete}
              formatTime={formatTime}
            />
          )}
        </>
      )}

      {/* Day Detail Panel - Only show for month view */}
      {view === 'month' && selectedDate && (
        <DayDetailPanel
          selectedDate={selectedDate}
          events={selectedDayEvents}
          onAddEvent={() => handleAddEvent()}
          onEditEvent={handleEditEvent}
          onDeleteEvent={handleDeleteEvent}
          onToggleComplete={handleToggleComplete}
          formatTime={formatTime}
        />
      )}

      {/* Event Modal */}
      {showEventModal && (
        <EventModal
          event={editingEvent}
          defaultDate={selectedDate}
          onClose={() => { setShowEventModal(false); setEditingEvent(null) }}
          onSaved={() => {
            fetchCalendarData()
            if (selectedDate) {
              const dateKey = format(selectedDate, 'yyyy-MM-dd')
              setSelectedDayEvents(events[dateKey] || [])
            }
          }}
          onDeleted={(deletedId) => {
            fetchCalendarData()
            if (selectedDate) {
              setSelectedDayEvents(prev => prev.filter(e => e.id !== deletedId))
            }
          }}
        />
      )}
    </div>
  )
}


// Month View Component
function MonthView({ currentDate, events, selectedDate, onDayClick, onAddEvent, formatTime }) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startDay = monthStart.getDay()
  const paddedDays = [...Array(startDay).fill(null), ...days]

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center text-sm font-medium py-2" style={{ color: 'var(--color-text-muted)' }}>
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7 gap-2">
        {paddedDays.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="h-20" />
          }

          const dateKey = format(day, 'yyyy-MM-dd')
          const dayEvents = events[dateKey] || []
          const isCurrentDay = isToday(day)
          const isSelected = selectedDate && format(selectedDate, 'yyyy-MM-dd') === dateKey

          return (
            <div
              key={dateKey}
              onClick={() => onDayClick(day)}
              className="h-20 p-2 rounded-lg border transition-colors cursor-pointer"
              style={{
                borderColor: isSelected || isCurrentDay ? 'var(--color-green-600)' : 'var(--color-border-subtle)',
                backgroundColor: isSelected ? 'var(--color-green-100)' : isCurrentDay ? 'var(--color-green-100)' : 'var(--color-bg-surface-soft)'
              }}
            >
              <div className="text-sm font-medium mb-1" style={{ color: isCurrentDay ? 'var(--color-green-700)' : 'var(--color-text-primary)' }}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5 overflow-hidden">
                {dayEvents.slice(0, 2).map((event, i) => (
                  <div
                    key={`${event.id}-${i}`}
                    className="text-xs truncate px-1 rounded"
                    style={{
                      backgroundColor: event.is_completed ? 'var(--color-bg-surface-muted)' :
                        event.task_type === 'todo' ? 'var(--color-info-bg)' :
                        event.is_multi_day ? 'var(--color-badge-purple-bg)' : 'var(--color-green-600)',
                      color: event.is_completed ? 'var(--color-text-muted)' :
                        event.task_type === 'todo' ? 'var(--color-info-700)' : '#ffffff',
                      textDecoration: event.is_completed ? 'line-through' : 'none',
                      border: event.task_type === 'todo' ? '1px dashed var(--color-info-600)' : 'none',
                      borderRadius: event.is_multi_day ? (
                        event.is_span_start && event.is_span_end ? '4px' :
                        event.is_span_start ? '4px 0 0 4px' :
                        event.is_span_end ? '0 4px 4px 0' : '0'
                      ) : '4px'
                    }}
                  >
                    {event.is_multi_day && !event.is_span_start ? (
                      <span className="opacity-50">↳</span>
                    ) : event.due_time ? (
                      <span className="opacity-75">{formatTime(event.due_time)} </span>
                    ) : null}
                    {event.title}
                    {event.is_multi_day && event.is_span_start && !event.is_span_end && (
                      <span className="opacity-50"> →</span>
                    )}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-xs px-1" style={{ color: 'var(--color-text-muted)' }}>
                    +{dayEvents.length - 2}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


// Current Time Indicator Component
function CurrentTimeIndicator({ currentTime }) {
  const hours = currentTime.getHours()
  const minutes = currentTime.getMinutes()
  const topPosition = hours * 60 + minutes // 60px per hour

  return (
    <div
      className="absolute left-0 right-0 z-10 pointer-events-none"
      style={{ top: `${topPosition}px` }}
    >
      {/* Red dot at start of line */}
      <div className="absolute -left-1.5 -top-1.5 w-3 h-3 bg-red-500 rounded-full" />
      {/* Red line */}
      <div className="h-0.5 bg-red-500 shadow-sm" />
    </div>
  )
}


// Helper function to calculate positions for overlapping events
function calculateEventPositions(events) {
  if (!events || events.length === 0) return []

  // Convert events to time ranges (in minutes from midnight)
  const eventsWithTime = events.map(event => {
    const [startH, startM] = (event.due_time || '00:00').split(':').map(Number)
    const startMinutes = startH * 60 + startM
    let endMinutes = startMinutes + 60 // Default 1 hour
    if (event.end_time) {
      const [endH, endM] = event.end_time.split(':').map(Number)
      endMinutes = endH * 60 + endM
    }
    return { event, start: startMinutes, end: endMinutes }
  })

  // Sort by start time, then by duration (longer events first)
  eventsWithTime.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start
    return (b.end - b.start) - (a.end - a.start)
  })

  // Find overlapping groups and assign columns
  const result = []

  for (let i = 0; i < eventsWithTime.length; i++) {
    const item = eventsWithTime[i]

    // Find all events that overlap with this one
    const overlapping = eventsWithTime.filter(other =>
      other.start < item.end && other.end > item.start
    )

    // Sort overlapping events by start time to assign consistent columns
    overlapping.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start
      return (b.end - b.start) - (a.end - a.start)
    })

    // Find this event's position in the overlapping group
    const column = overlapping.findIndex(e => e.event.id === item.event.id)
    const totalColumns = overlapping.length

    result.push({
      event: item.event,
      column: column >= 0 ? column : 0,
      totalColumns
    })
  }

  return result
}


// Week View Component
function WeekView({ currentDate, currentTime, events, scrollRef, onEventClick, onAddEvent, onToggleComplete, formatTime }) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // Get all-day events and timed events for a day
  const getEventsForDay = (day) => {
    const dateKey = format(day, 'yyyy-MM-dd')
    const dayEvents = events[dateKey] || []
    const allDay = dayEvents.filter(e => !e.due_time)
    const timed = dayEvents.filter(e => e.due_time)
    return { allDay, timed }
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
      {/* Day Headers */}
      <div className="grid grid-cols-8" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
        <div className="p-2 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>Time</div>
        {weekDays.map((day) => (
          <div
            key={format(day, 'yyyy-MM-dd')}
            className="p-2 text-center"
            style={{
              borderLeft: '1px solid var(--color-border-subtle)',
              backgroundColor: isToday(day) ? 'var(--color-green-100)' : 'transparent'
            }}
          >
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{format(day, 'EEE')}</div>
            <div className="text-lg font-semibold" style={{ color: isToday(day) ? 'var(--color-green-700)' : 'var(--color-text-primary)' }}>
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* All-day events section */}
      <div className="grid grid-cols-8 min-h-[40px]" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
        <div className="p-2 text-xs flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}>All day</div>
        {weekDays.map((day) => {
          const { allDay } = getEventsForDay(day)
          return (
            <div
              key={`allday-${format(day, 'yyyy-MM-dd')}`}
              className="p-1 space-y-1"
              style={{ borderLeft: '1px solid var(--color-border-subtle)' }}
            >
              {allDay.map((event) => (
                <EventChip
                  key={`${event.id}-${format(day, 'yyyy-MM-dd')}`}
                  event={event}
                  onClick={() => onEventClick(event)}
                  onToggle={() => onToggleComplete(event)}
                  formatTime={formatTime}
                  isMultiDay={event.is_multi_day}
                  isSpanStart={event.is_span_start}
                  isSpanEnd={event.is_span_end}
                />
              ))}
            </div>
          )
        })}
      </div>

      {/* Time grid */}
      <div
        ref={scrollRef}
        className="overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 350px)' }}
      >
        <div className="grid grid-cols-8">
          {/* Time column */}
          <div style={{ borderRight: '1px solid var(--color-border-subtle)' }}>
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-[60px] text-xs text-right pr-2 pt-1"
                style={{ borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-muted)' }}
              >
                {formatTime(`${hour.toString().padStart(2, '0')}:00`)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day) => {
            const { timed } = getEventsForDay(day)
            const isTodayColumn = isToday(day)

            // Calculate overlapping event positions
            const eventsWithPosition = calculateEventPositions(timed)

            return (
              <div
                key={`grid-${format(day, 'yyyy-MM-dd')}`}
                className="relative cursor-pointer"
                style={{
                  borderLeft: '1px solid var(--color-border-subtle)',
                  backgroundColor: isTodayColumn ? 'var(--color-green-100)' : 'transparent'
                }}
                onClick={() => onAddEvent(day)}
              >
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="h-[60px] cursor-pointer"
                    style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                  />
                ))}
                {/* Current time indicator - only show on today's column */}
                {isTodayColumn && <CurrentTimeIndicator currentTime={currentTime} />}
                {/* Render timed events */}
                {eventsWithPosition.map(({ event, column, totalColumns }) => {
                  const [hours, minutes] = (event.due_time || '00:00').split(':').map(Number)
                  const top = hours * 60 + minutes
                  const duration = event.end_time
                    ? (() => {
                        const [endH, endM] = event.end_time.split(':').map(Number)
                        return (endH * 60 + endM) - top
                      })()
                    : 60
                  // Subtract 2px to create visual gap between back-to-back events
                  const displayHeight = Math.max(duration - 2, 18)
                  // Calculate width and left position for overlapping events
                  const widthPercent = (100 / totalColumns) - 2
                  const leftPercent = (column * (100 / totalColumns)) + 1
                  return (
                    <div
                      key={event.id}
                      className="absolute rounded px-1 text-xs cursor-pointer overflow-hidden"
                      style={{
                        top: `${top}px`,
                        height: `${displayHeight}px`,
                        left: `${leftPercent}%`,
                        width: `${widthPercent}%`,
                        backgroundColor: event.is_completed ? 'var(--color-bg-surface-muted)' :
                          event.task_type === 'todo' ? 'var(--color-info-bg)' : 'var(--color-green-600)',
                        color: event.is_completed ? 'var(--color-text-muted)' :
                          event.task_type === 'todo' ? 'var(--color-info-700)' : '#ffffff',
                        border: event.task_type === 'todo' ? '1px dashed var(--color-info-600)' : 'none'
                      }}
                      onClick={(e) => { e.stopPropagation(); onEventClick(event) }}
                    >
                      <div className="flex items-center gap-1">
                        {event.task_type === 'todo' ? (
                          <CheckSquare className="w-3 h-3 flex-shrink-0" />
                        ) : (
                          <Clock className="w-3 h-3 flex-shrink-0" />
                        )}
                        <span className={`truncate ${event.is_completed ? 'line-through' : ''}`}>
                          {event.title}
                        </span>
                      </div>
                      <div className="text-[10px] opacity-75 mt-0.5">
                        {formatTime(event.due_time)}{event.end_time ? ` - ${formatTime(event.end_time)}` : ''}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}


// Day View Component
function DayView({ currentDate, currentTime, events, scrollRef, onEventClick, onAddEvent, onToggleComplete, formatTime }) {
  const dateKey = format(currentDate, 'yyyy-MM-dd')
  const dayEvents = events[dateKey] || []
  const allDayEvents = dayEvents.filter(e => !e.due_time)
  const timedEvents = dayEvents.filter(e => e.due_time)
  const isTodayView = isToday(currentDate)

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
      {/* All-day events section */}
      {allDayEvents.length > 0 && (
        <div className="p-3" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>All day</div>
          <div className="space-y-2">
            {allDayEvents.map((event) => (
              <EventChip
                key={event.id}
                event={event}
                onClick={() => onEventClick(event)}
                onToggle={() => onToggleComplete(event)}
                expanded
                formatTime={formatTime}
              />
            ))}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div
        ref={scrollRef}
        className="overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 350px)' }}
      >
        <div className="relative">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="flex h-[60px] cursor-pointer"
              style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
              onClick={() => onAddEvent(currentDate)}
            >
              <div className="w-16 text-xs text-right pr-3 pt-1 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                {formatTime(`${hour.toString().padStart(2, '0')}:00`)}
              </div>
              <div className="flex-1" style={{ borderLeft: '1px solid var(--color-border-subtle)' }} />
            </div>
          ))}

          {/* Current time indicator - only show when viewing today */}
          {isTodayView && (
            <div
              className="absolute left-16 right-0 z-10 pointer-events-none"
              style={{ top: `${currentTime.getHours() * 60 + currentTime.getMinutes()}px` }}
            >
              <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--color-error-600)' }} />
              <div className="h-0.5 shadow-sm" style={{ backgroundColor: 'var(--color-error-600)' }} />
            </div>
          )}

          {/* Render timed events */}
          {timedEvents.map((event) => {
            const [hours, minutes] = (event.due_time || '00:00').split(':').map(Number)
            const top = hours * 60 + minutes
            const duration = event.end_time
              ? (() => {
                  const [endH, endM] = event.end_time.split(':').map(Number)
                  return (endH * 60 + endM) - top
                })()
              : 60
            return (
              <div
                key={event.id}
                className="absolute left-20 right-2 rounded px-2 py-1 cursor-pointer"
                style={{
                  top: `${top}px`,
                  minHeight: `${Math.max(duration, 30)}px`,
                  backgroundColor: event.is_completed ? 'var(--color-bg-surface-muted)' :
                    event.task_type === 'todo' ? 'var(--color-info-bg)' : 'var(--color-green-600)',
                  color: event.is_completed ? 'var(--color-text-muted)' :
                    event.task_type === 'todo' ? 'var(--color-info-700)' : '#ffffff',
                  border: event.task_type === 'todo' ? '1px dashed var(--color-info-600)' : 'none'
                }}
                onClick={(e) => { e.stopPropagation(); onEventClick(event) }}
              >
                <div className="flex items-center gap-2">
                  {event.task_type === 'todo' ? (
                    <CheckSquare className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 flex-shrink-0" />
                  )}
                  <span className={`font-medium ${event.is_completed ? 'line-through' : ''}`}>
                    {event.title}
                  </span>
                  <span className="text-xs opacity-75">
                    {formatTime(event.due_time)}{event.end_time ? ` - ${formatTime(event.end_time)}` : ''}
                  </span>
                </div>
                {event.location && (
                  <div className="text-xs opacity-75 mt-1">{event.location}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}


// Event Chip Component
function EventChip({ event, onClick, onToggle, expanded = false, formatTime, isMultiDay = false, isSpanStart = true, isSpanEnd = true }) {
  // Determine rounding based on multi-day span position
  const getRounding = () => {
    if (!isMultiDay) return 'rounded'
    if (isSpanStart && isSpanEnd) return 'rounded'
    if (isSpanStart) return 'rounded-l'
    if (isSpanEnd) return 'rounded-r'
    return ''
  }

  const getChipStyles = () => {
    if (event.is_completed) {
      return { backgroundColor: 'var(--color-bg-surface-muted)', color: 'var(--color-text-muted)' }
    }
    if (event.task_type === 'todo') {
      return { backgroundColor: 'var(--color-info-bg)', color: 'var(--color-info-700)', border: '1px dashed var(--color-info-600)' }
    }
    if (isMultiDay) {
      return { backgroundColor: 'var(--color-badge-purple-bg)', color: 'var(--color-text-primary)' }
    }
    return { backgroundColor: 'var(--color-green-600)', color: '#ffffff' }
  }

  return (
    <div
      className={`${getRounding()} px-2 py-1 cursor-pointer ${expanded ? 'flex items-center justify-between' : 'text-xs truncate'}`}
      style={getChipStyles()}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 min-w-0 flex-wrap">
        {event.task_type === 'todo' ? (
          <CheckSquare className="w-3 h-3 flex-shrink-0" />
        ) : (
          <CalendarIcon className="w-3 h-3 flex-shrink-0" />
        )}
        <div className="min-w-0">
          <span className={`truncate ${event.is_completed ? 'line-through' : ''}`}>
            {event.title}
          </span>
          {expanded && event.due_time && (
            <div className="text-xs opacity-75">
              {formatTime(event.due_time)}{event.end_time ? ` - ${formatTime(event.end_time)}` : ''}
            </div>
          )}
        </div>
        {/* Show badges in expanded mode only */}
        {expanded && event.linked_location && (
          <span className="text-[10px] flex items-center gap-0.5 px-1 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: 'var(--color-badge-purple-bg)', color: 'var(--color-text-secondary)' }}>
            <MapPin className="w-2.5 h-2.5" />
            {event.linked_location}
          </span>
        )}
        {expanded && event.linked_entity && (
          <span className="text-[10px] flex items-center gap-0.5 px-1 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: 'var(--color-gold-100)', color: 'var(--color-gold-700)' }}>
            <Wrench className="w-2.5 h-2.5" />
            {event.linked_entity}
          </span>
        )}
      </div>
      {expanded && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle() }}
          className="p-1 rounded"
          style={{ backgroundColor: event.is_completed ? 'var(--color-bg-surface-active)' : 'var(--color-green-600)' }}
        >
          <Check className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}


// Day Detail Panel Component
function DayDetailPanel({ selectedDate, events, onAddEvent, onEditEvent, onDeleteEvent, onToggleComplete, formatTime }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {format(selectedDate, 'EEEE, MMMM d')}
        </h3>
        <button
          onClick={onAddEvent}
          className="p-2 rounded-lg transition-colors"
          style={{ backgroundColor: 'var(--color-green-600)', color: '#ffffff' }}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {events.length === 0 ? (
        <p className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
          No events for this day
        </p>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div
              key={event.id}
              className="p-3 rounded-lg"
              style={{ backgroundColor: event.is_completed ? 'var(--color-bg-surface-soft)' : 'var(--color-bg-surface-muted)' }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {event.task_type === 'todo' ? (
                      <CheckSquare className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-info-600)' }} />
                    ) : (
                      <CalendarIcon className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-green-600)' }} />
                    )}
                    <p className="font-medium truncate" style={{
                      color: event.is_completed ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                      textDecoration: event.is_completed ? 'line-through' : 'none'
                    }}>
                      {event.title}
                    </p>
                    {/* Location badge (purple) */}
                    {event.linked_location && (
                      <span className="text-xs flex items-center gap-0.5 px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: 'var(--color-badge-purple-bg)', color: 'var(--color-text-secondary)' }}>
                        <MapPin className="w-3 h-3" />
                        {event.linked_location}
                      </span>
                    )}
                    {/* Vehicle/Equipment badge (orange) */}
                    {event.linked_entity && (
                      <span className="text-xs flex items-center gap-0.5 px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: 'var(--color-gold-100)', color: 'var(--color-gold-700)' }}>
                        <Wrench className="w-3 h-3" />
                        {event.linked_entity}
                      </span>
                    )}
                  </div>
                  {event.due_time && (
                    <span className="text-xs ml-6" style={{ color: 'var(--color-text-muted)' }}>
                      {formatTime(event.due_time)}{event.end_time ? ` - ${formatTime(event.end_time)}` : ''}
                    </span>
                  )}
                  {event.category && (
                    <span className="text-xs capitalize ml-2" style={{ color: 'var(--color-text-muted)' }}>
                      • {event.category}
                    </span>
                  )}
                  {event.description && (
                    <p className="text-sm mt-1 ml-6 line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>
                      {event.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => onToggleComplete(event)}
                    className="p-1.5 rounded transition-colors"
                    style={{ backgroundColor: event.is_completed ? 'var(--color-bg-surface-active)' : 'var(--color-green-600)', color: '#ffffff' }}
                    title={event.is_completed ? 'Mark incomplete' : 'Mark complete'}
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onEditEvent(event)}
                    className="p-1.5 rounded transition-colors"
                    style={{ backgroundColor: 'var(--color-bg-surface-active)', color: 'var(--color-text-primary)' }}
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDeleteEvent(event.id)}
                    className="p-1.5 rounded transition-colors"
                    style={{ backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error-600)' }}
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default CalendarPage
