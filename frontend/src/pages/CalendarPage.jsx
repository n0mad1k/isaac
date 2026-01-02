import React, { useState, useEffect, useCallback } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, Check, Trash2, Pencil, RefreshCw } from 'lucide-react'
import { getCalendarMonth, createTask, updateTask, deleteTask, completeTask, uncompleteTask, syncCalendar } from '../services/api'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, addMonths, subMonths } from 'date-fns'

// Task categories
const TASK_CATEGORIES = [
  { value: 'garden', label: 'Garden' },
  { value: 'livestock', label: 'Livestock' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'household', label: 'Household' },
  { value: 'other', label: 'Other' },
]

function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState({})
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [selectedDayEvents, setSelectedDayEvents] = useState([])

  const fetchCalendarData = useCallback(async () => {
    setLoading(true)
    try {
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth() + 1
      const response = await getCalendarMonth(year, month)
      setEvents(response.data.tasks || {})
    } catch (error) {
      console.error('Failed to fetch calendar data:', error)
    } finally {
      setLoading(false)
    }
  }, [currentDate])

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
        // Silent fail - calendar sync might not be configured
        console.log('Calendar sync skipped:', error.message)
      }
    }
    initialSync()
  }, [])

  useEffect(() => {
    fetchCalendarData()
  }, [fetchCalendarData])

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Pad the beginning with empty cells for proper day alignment
  const startDay = monthStart.getDay()
  const paddedDays = [...Array(startDay).fill(null), ...days]

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1))
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1))
  const goToToday = () => setCurrentDate(new Date())

  const handleDayClick = (day) => {
    const dateKey = format(day, 'yyyy-MM-dd')
    const dayEvents = events[dateKey] || []
    setSelectedDate(day)
    setSelectedDayEvents(dayEvents)
  }

  const handleAddEvent = () => {
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
      // Refresh selected day events
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
        const dateKey = format(selectedDate, 'yyyy-MM-dd')
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
        const dateKey = format(selectedDate, 'yyyy-MM-dd')
        setSelectedDayEvents(prev => prev.map(e =>
          e.id === event.id ? { ...e, is_completed: !e.is_completed } : e
        ))
      }
    } catch (error) {
      console.error('Failed to toggle event:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarIcon className="w-7 h-7 text-blue-500" />
          Calendar
        </h1>
        <div className="flex items-center gap-2">
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
            onClick={() => { setSelectedDate(new Date()); handleAddEvent() }}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 space-y-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between bg-gray-800 rounded-xl p-4">
            <button
              onClick={prevMonth}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-semibold">
              {format(currentDate, 'MMMM yyyy')}
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

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
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-farm-green"></div>
              </div>
            ) : (
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
                      onClick={() => handleDayClick(day)}
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
                                : 'bg-farm-green/20 text-farm-green'
                            }`}
                          >
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
            )}
          </div>
        </div>

        {/* Day Detail Panel */}
        <div className="bg-gray-800 rounded-xl p-4">
          {selectedDate ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  {format(selectedDate, 'EEEE, MMMM d')}
                </h3>
                <button
                  onClick={handleAddEvent}
                  className="p-2 bg-farm-green hover:bg-farm-green-light rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {selectedDayEvents.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No events for this day
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedDayEvents.map((event) => (
                    <div
                      key={event.id}
                      className={`p-3 rounded-lg ${
                        event.is_completed ? 'bg-gray-700/50' : 'bg-gray-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium truncate ${
                            event.is_completed ? 'text-gray-500 line-through' : 'text-white'
                          }`}>
                            {event.title}
                          </p>
                          {event.category && (
                            <span className="text-xs text-gray-400 capitalize">
                              {event.category}
                            </span>
                          )}
                          {event.description && (
                            <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                              {event.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleToggleComplete(event)}
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
                            onClick={() => handleEditEvent(event)}
                            className="p-1.5 bg-gray-600 hover:bg-gray-500 rounded transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
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
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Click a day to view events</p>
            </div>
          )}
        </div>
      </div>

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
  })
  const [saving, setSaving] = useState(false)
  const [isAllDay, setIsAllDay] = useState(!event?.due_time)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const dataToSave = {
        ...formData,
        task_type: 'event',  // Calendar events are always type 'event'
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
            <span className="text-sm text-gray-300">All day event</span>
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
              {saving ? 'Saving...' : (event ? 'Update' : 'Add Event')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CalendarPage
