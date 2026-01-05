import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, Check, Trash2, Pencil, RefreshCw, Clock, CheckSquare } from 'lucide-react'
import { getCalendarMonth, getCalendarWeek, createTask, updateTask, deleteTask, completeTask, uncompleteTask, syncCalendar } from '../services/api'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, addMonths, subMonths, addDays, subDays, startOfWeek, addWeeks, subWeeks, isSameDay } from 'date-fns'

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
      } else {
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

  // Sync calendar on initial load
  useEffect(() => {
    const initialSync = async () => {
      try {
        await syncCalendar()
      } catch (error) {
        console.log('Calendar sync skipped:', error.message)
      }
    }
    initialSync()
  }, [])

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

  const handleSaveEvent = async (eventData) => {
    try {
      if (editingEvent) {
        await updateTask(editingEvent.id, eventData)
      } else {
        await createTask(eventData)
      }
      setShowEventModal(false)
      setEditingEvent(null)
      await fetchCalendarData()
      if (selectedDate) {
        const dateKey = format(selectedDate, 'yyyy-MM-dd')
        setSelectedDayEvents(events[dateKey] || [])
      }
    } catch (error) {
      console.error('Failed to save event:', error)
      alert('Failed to save event')
    }
  }

  const handleDeleteEvent = async (eventId) => {
    if (!confirm('Delete this event?')) return
    try {
      await deleteTask(eventId)
      await fetchCalendarData()
      if (selectedDate) {
        const updatedEvents = selectedDayEvents.filter(e => e.id !== eventId)
        setSelectedDayEvents(updatedEvents)
      }
    } catch (error) {
      console.error('Failed to delete event:', error)
      alert('Failed to delete event')
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
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarIcon className="w-7 h-7 text-blue-500" />
          Calendar
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Switcher */}
          <div className="flex bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setView('day')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                view === 'day' ? 'bg-farm-green text-white' : 'text-gray-300 hover:text-white'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setView('week')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                view === 'week' ? 'bg-farm-green text-white' : 'text-gray-300 hover:text-white'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setView('month')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                view === 'month' ? 'bg-farm-green text-white' : 'text-gray-300 hover:text-white'
              }`}
            >
              Month
            </button>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 bg-cyan-700 hover:bg-cyan-600 rounded-lg transition-colors disabled:opacity-50"
            title="Sync with phone calendar"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
          <button
            onClick={() => handleAddEvent(new Date())}
            className="flex items-center gap-2 px-4 py-2 bg-farm-green hover:bg-farm-green-light rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Event
          </button>
          <button
            onClick={goToToday}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between bg-gray-800 rounded-xl p-4">
        <button
          onClick={goToPrev}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-semibold">{getNavTitle()}</h2>
        <button
          onClick={goToNext}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Calendar Views */}
      {loading ? (
        <div className="flex items-center justify-center h-64 bg-gray-800 rounded-xl">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-farm-green"></div>
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
        />
      )}

      {/* Event Modal */}
      {showEventModal && (
        <EventModal
          event={editingEvent}
          defaultDate={selectedDate}
          onClose={() => { setShowEventModal(false); setEditingEvent(null) }}
          onSave={handleSaveEvent}
        />
      )}
    </div>
  )
}


// Month View Component
function MonthView({ currentDate, events, selectedDate, onDayClick, onAddEvent }) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startDay = monthStart.getDay()
  const paddedDays = [...Array(startDay).fill(null), ...days]

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center text-gray-400 text-sm font-medium py-2">
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
              className={`h-20 p-2 rounded-lg border transition-colors cursor-pointer ${
                isSelected
                  ? 'border-farm-green bg-farm-green/20'
                  : isCurrentDay
                  ? 'border-farm-green bg-farm-green/10'
                  : 'border-gray-700 hover:border-gray-600 hover:bg-gray-700/50'
              }`}
            >
              <div className={`text-sm font-medium mb-1 ${
                isCurrentDay ? 'text-farm-green' : 'text-gray-300'
              }`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5 overflow-hidden">
                {dayEvents.slice(0, 2).map((event, i) => (
                  <div
                    key={i}
                    className={`text-xs truncate px-1 rounded ${
                      event.is_completed
                        ? 'bg-gray-700 text-gray-500 line-through'
                        : event.task_type === 'todo'
                        ? 'bg-blue-900/30 text-blue-300 border border-dashed border-blue-600'
                        : 'bg-farm-green/20 text-farm-green'
                    }`}
                  >
                    {event.due_time && <span className="opacity-75">{event.due_time} </span>}
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-xs text-gray-500 px-1">
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


// Week View Component
function WeekView({ currentDate, currentTime, events, scrollRef, onEventClick, onAddEvent, onToggleComplete }) {
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
    <div className="bg-gray-800 rounded-xl overflow-hidden">
      {/* Day Headers */}
      <div className="grid grid-cols-8 border-b border-gray-700">
        <div className="p-2 text-center text-gray-500 text-sm">Time</div>
        {weekDays.map((day) => (
          <div
            key={format(day, 'yyyy-MM-dd')}
            className={`p-2 text-center border-l border-gray-700 ${
              isToday(day) ? 'bg-farm-green/10' : ''
            }`}
          >
            <div className="text-gray-400 text-xs">{format(day, 'EEE')}</div>
            <div className={`text-lg font-semibold ${isToday(day) ? 'text-farm-green' : 'text-white'}`}>
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* All-day events section */}
      <div className="grid grid-cols-8 border-b border-gray-700 min-h-[40px]">
        <div className="p-2 text-xs text-gray-500 flex items-center justify-center">All day</div>
        {weekDays.map((day) => {
          const { allDay } = getEventsForDay(day)
          return (
            <div
              key={`allday-${format(day, 'yyyy-MM-dd')}`}
              className="p-1 border-l border-gray-700 space-y-1"
            >
              {allDay.map((event) => (
                <EventChip
                  key={event.id}
                  event={event}
                  onClick={() => onEventClick(event)}
                  onToggle={() => onToggleComplete(event)}
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
          <div className="border-r border-gray-700">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-[60px] border-b border-gray-700 text-xs text-gray-500 text-right pr-2 pt-1"
              >
                {format(new Date().setHours(hour, 0), 'h a')}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day) => {
            const { timed } = getEventsForDay(day)
            const isTodayColumn = isToday(day)
            return (
              <div
                key={`grid-${format(day, 'yyyy-MM-dd')}`}
                className={`relative border-l border-gray-700 ${isTodayColumn ? 'bg-farm-green/5' : ''}`}
                onClick={() => onAddEvent(day)}
              >
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="h-[60px] border-b border-gray-700 hover:bg-gray-700/30 cursor-pointer"
                  />
                ))}
                {/* Current time indicator - only show on today's column */}
                {isTodayColumn && <CurrentTimeIndicator currentTime={currentTime} />}
                {/* Render timed events */}
                {timed.map((event) => {
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
                      className={`absolute left-1 right-1 rounded px-1 py-0.5 text-xs cursor-pointer overflow-hidden ${
                        event.is_completed
                          ? 'bg-gray-700 text-gray-500'
                          : event.task_type === 'todo'
                          ? 'bg-blue-900/50 text-blue-200 border border-dashed border-blue-500'
                          : 'bg-farm-green/70 text-white'
                      }`}
                      style={{
                        top: `${top}px`,
                        minHeight: `${Math.max(duration, 20)}px`,
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
                        {event.due_time}{event.end_time ? ` - ${event.end_time}` : ''}
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
function DayView({ currentDate, currentTime, events, scrollRef, onEventClick, onAddEvent, onToggleComplete }) {
  const dateKey = format(currentDate, 'yyyy-MM-dd')
  const dayEvents = events[dateKey] || []
  const allDayEvents = dayEvents.filter(e => !e.due_time)
  const timedEvents = dayEvents.filter(e => e.due_time)
  const isTodayView = isToday(currentDate)

  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden">
      {/* All-day events section */}
      {allDayEvents.length > 0 && (
        <div className="p-3 border-b border-gray-700">
          <div className="text-xs text-gray-500 mb-2">All day</div>
          <div className="space-y-2">
            {allDayEvents.map((event) => (
              <EventChip
                key={event.id}
                event={event}
                onClick={() => onEventClick(event)}
                onToggle={() => onToggleComplete(event)}
                expanded
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
              className="flex h-[60px] border-b border-gray-700 hover:bg-gray-700/30 cursor-pointer"
              onClick={() => onAddEvent(currentDate)}
            >
              <div className="w-16 text-xs text-gray-500 text-right pr-3 pt-1 flex-shrink-0">
                {format(new Date().setHours(hour, 0), 'h a')}
              </div>
              <div className="flex-1 border-l border-gray-700" />
            </div>
          ))}

          {/* Current time indicator - only show when viewing today */}
          {isTodayView && (
            <div
              className="absolute left-16 right-0 z-10 pointer-events-none"
              style={{ top: `${currentTime.getHours() * 60 + currentTime.getMinutes()}px` }}
            >
              <div className="absolute -left-1.5 -top-1.5 w-3 h-3 bg-red-500 rounded-full" />
              <div className="h-0.5 bg-red-500 shadow-sm" />
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
                className={`absolute left-20 right-2 rounded px-2 py-1 cursor-pointer ${
                  event.is_completed
                    ? 'bg-gray-700 text-gray-500'
                    : event.task_type === 'todo'
                    ? 'bg-blue-900/50 text-blue-200 border border-dashed border-blue-500'
                    : 'bg-farm-green/70 text-white'
                }`}
                style={{
                  top: `${top}px`,
                  minHeight: `${Math.max(duration, 30)}px`,
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
                    {event.due_time}{event.end_time ? ` - ${event.end_time}` : ''}
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
function EventChip({ event, onClick, onToggle, expanded = false }) {
  return (
    <div
      className={`rounded px-2 py-1 cursor-pointer ${
        expanded ? 'flex items-center justify-between' : 'text-xs truncate'
      } ${
        event.is_completed
          ? 'bg-gray-700 text-gray-500'
          : event.task_type === 'todo'
          ? 'bg-blue-900/50 text-blue-200 border border-dashed border-blue-500'
          : 'bg-farm-green/70 text-white'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 min-w-0">
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
              {event.due_time}{event.end_time ? ` - ${event.end_time}` : ''}
            </div>
          )}
        </div>
      </div>
      {expanded && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle() }}
          className={`p-1 rounded ${event.is_completed ? 'bg-gray-600' : 'bg-farm-green/50 hover:bg-farm-green'}`}
        >
          <Check className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}


// Day Detail Panel Component
function DayDetailPanel({ selectedDate, events, onAddEvent, onEditEvent, onDeleteEvent, onToggleComplete }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">
          {format(selectedDate, 'EEEE, MMMM d')}
        </h3>
        <button
          onClick={onAddEvent}
          className="p-2 bg-farm-green hover:bg-farm-green-light rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {events.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          No events for this day
        </p>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div
              key={event.id}
              className={`p-3 rounded-lg ${
                event.is_completed ? 'bg-gray-700/50' : 'bg-gray-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {event.task_type === 'todo' ? (
                      <CheckSquare className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    ) : (
                      <CalendarIcon className="w-4 h-4 text-farm-green flex-shrink-0" />
                    )}
                    <p className={`font-medium truncate ${
                      event.is_completed ? 'text-gray-500 line-through' : 'text-white'
                    }`}>
                      {event.title}
                    </p>
                  </div>
                  {event.due_time && (
                    <span className="text-xs text-gray-400 ml-6">
                      {event.due_time}{event.end_time ? ` - ${event.end_time}` : ''}
                    </span>
                  )}
                  {event.category && (
                    <span className="text-xs text-gray-400 capitalize ml-2">
                      • {event.category}
                    </span>
                  )}
                  {event.description && (
                    <p className="text-sm text-gray-400 mt-1 ml-6 line-clamp-2">
                      {event.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => onToggleComplete(event)}
                    className={`p-1.5 rounded transition-colors ${
                      event.is_completed
                        ? 'bg-gray-600 hover:bg-gray-500'
                        : 'bg-farm-green/50 hover:bg-farm-green'
                    }`}
                    title={event.is_completed ? 'Mark incomplete' : 'Mark complete'}
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onEditEvent(event)}
                    className="p-1.5 bg-gray-600 hover:bg-gray-500 rounded transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDeleteEvent(event.id)}
                    className="p-1.5 bg-red-900/50 hover:bg-red-800 rounded text-red-300 transition-colors"
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


// Event Form Modal
function EventModal({ event, defaultDate, onClose, onSave }) {
  const [formData, setFormData] = useState({
    title: event?.title || '',
    description: event?.description || '',
    due_date: event?.due_date || (defaultDate ? format(defaultDate, 'yyyy-MM-dd') : ''),
    due_time: event?.due_time || '',
    end_time: event?.end_time || '',
    location: event?.location || '',
    category: event?.category || 'other',
    priority: event?.priority || 2,
    task_type: event?.task_type || 'event',
  })
  const [saving, setSaving] = useState(false)
  const [isAllDay, setIsAllDay] = useState(!event?.due_time)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const dataToSave = {
        ...formData,
        due_time: isAllDay ? null : formData.due_time || null,
        end_time: isAllDay ? null : formData.end_time || null,
      }
      await onSave(dataToSave)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-800">
          <h2 className="text-lg font-semibold">
            {event ? 'Edit Event' : 'Add Event'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Type Toggle */}
          <div className="flex bg-gray-700 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, task_type: 'event' })}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                formData.task_type === 'event' ? 'bg-farm-green text-white' : 'text-gray-300'
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
              Event
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, task_type: 'todo' })}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                formData.task_type === 'todo' ? 'bg-blue-600 text-white' : 'text-gray-300'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              Reminder
            </button>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Event title"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Date *</label>
            <input
              type="date"
              required
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          {/* All Day Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isAllDay}
              onChange={(e) => setIsAllDay(e.target.checked)}
              className="w-4 h-4 rounded bg-gray-700 border-gray-600"
            />
            <span className="text-sm text-gray-300">All day</span>
          </label>

          {/* Time fields - only show if not all day */}
          {!isAllDay && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Start Time</label>
                <input
                  type="time"
                  value={formData.due_time}
                  onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">End Time</label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
            </div>
          )}

          {/* Location */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Vet clinic, Farm, Home"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              >
                {TASK_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              >
                <option value={1}>High</option>
                <option value={2}>Medium</option>
                <option value={3}>Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="Optional notes or description"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : (event ? 'Update' : 'Add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CalendarPage
