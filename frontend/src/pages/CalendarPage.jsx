import React, { useState, useEffect, useCallback } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { getCalendarMonth } from '../services/api'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths } from 'date-fns'

function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState({})
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarIcon className="w-7 h-7 text-blue-500" />
          Calendar
        </h1>
        <button
          onClick={goToToday}
          className="px-4 py-2 bg-farm-green hover:bg-farm-green-light rounded-lg transition-colors"
        >
          Today
        </button>
      </div>

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

      {/* Calendar Grid */}
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
                return <div key={`empty-${index}`} className="h-24" />
              }

              const dateKey = format(day, 'yyyy-MM-dd')
              const dayEvents = events[dateKey] || []
              const isCurrentDay = isToday(day)

              return (
                <div
                  key={dateKey}
                  className={`h-24 p-2 rounded-lg border transition-colors ${
                    isCurrentDay
                      ? 'border-farm-green bg-farm-green/10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className={`text-sm font-medium mb-1 ${
                    isCurrentDay ? 'text-farm-green' : 'text-gray-300'
                  }`}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1 overflow-hidden">
                    {dayEvents.slice(0, 3).map((event, i) => (
                      <div
                        key={i}
                        className={`text-xs truncate px-1 py-0.5 rounded ${
                          event.is_completed
                            ? 'bg-gray-700 text-gray-500 line-through'
                            : 'bg-farm-green/20 text-farm-green'
                        }`}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-gray-500">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-sm text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-farm-green/20 border border-farm-green"></div>
          <span>Today</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-farm-green/20"></div>
          <span>Has tasks</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-gray-700"></div>
          <span>Completed</span>
        </div>
      </div>
    </div>
  )
}

export default CalendarPage
