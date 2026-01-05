import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns'

function Calendar({ events, onMonthChange }) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date())

  const prevMonth = () => {
    const newMonth = subMonths(currentMonth, 1)
    setCurrentMonth(newMonth)
    if (onMonthChange) {
      onMonthChange(newMonth.getFullYear(), newMonth.getMonth() + 1)
    }
  }

  const nextMonth = () => {
    const newMonth = addMonths(currentMonth, 1)
    setCurrentMonth(newMonth)
    if (onMonthChange) {
      onMonthChange(newMonth.getFullYear(), newMonth.getMonth() + 1)
    }
  }

  const renderHeader = () => (
    <div className="flex items-center justify-between mb-4">
      <button
        onClick={prevMonth}
        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <h2 className="text-xl font-semibold">
        {format(currentMonth, 'MMMM yyyy')}
      </h2>
      <button
        onClick={nextMonth}
        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  )

  const renderDays = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return (
      <div className="grid grid-cols-7 mb-2">
        {days.map((day) => (
          <div
            key={day}
            className="text-center text-sm font-medium text-gray-500 py-2"
          >
            {day}
          </div>
        ))}
      </div>
    )
  }

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart)
    const endDate = endOfWeek(monthEnd)

    const today = new Date()
    const rows = []
    let days = []
    let day = startDate

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const dateStr = format(day, 'yyyy-MM-dd')
        const dayEvents = events?.filter(
          (e) => format(new Date(e.date), 'yyyy-MM-dd') === dateStr
        )
        const isToday = isSameDay(day, today)
        const isCurrentMonth = isSameMonth(day, monthStart)

        days.push(
          <div
            key={day.toString()}
            className={`min-h-[80px] p-1 border border-gray-700 ${
              !isCurrentMonth ? 'bg-gray-900/50' : 'bg-gray-800/50'
            } ${isToday ? 'ring-2 ring-farm-green' : ''}`}
          >
            <div
              className={`text-sm font-medium mb-1 ${
                !isCurrentMonth
                  ? 'text-gray-600'
                  : isToday
                  ? 'text-farm-green'
                  : 'text-gray-400'
              }`}
            >
              {format(day, 'd')}
            </div>
            <div className="space-y-1">
              {dayEvents?.slice(0, 3).map((event) => (
                <div
                  key={event.id}
                  className={`text-xs truncate px-1 py-0.5 rounded ${
                    event.is_completed
                      ? 'bg-gray-700 text-gray-500 line-through'
                      : event.priority === 1
                      ? 'bg-red-900/60 text-red-300'
                      : event.priority === 2
                      ? 'bg-yellow-900/60 text-yellow-300'
                      : 'bg-blue-900/60 text-blue-300'
                  }`}
                >
                  {event.title}
                </div>
              ))}
              {dayEvents?.length > 3 && (
                <div className="text-xs text-gray-500 px-1">
                  +{dayEvents.length - 3} more
                </div>
              )}
            </div>
          </div>
        )
        day = addDays(day, 1)
      }
      rows.push(
        <div key={day.toString()} className="grid grid-cols-7">
          {days}
        </div>
      )
      days = []
    }

    return <div className="space-y-0">{rows}</div>
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      {renderHeader()}
      {renderDays()}
      {renderCells()}
    </div>
  )
}

export default Calendar
