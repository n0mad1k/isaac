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
        className="p-2 hover:bg-surface-soft rounded-lg transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <h2 className="text-xl font-semibold">
        {format(currentMonth, 'MMMM yyyy')}
      </h2>
      <button
        onClick={nextMonth}
        className="p-2 hover:bg-surface-soft rounded-lg transition-colors"
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
            className="text-center text-xs sm:text-sm font-medium text-muted py-1 sm:py-2"
          >
            <span className="sm:hidden">{day.substring(0, 1)}</span>
            <span className="hidden sm:inline">{day}</span>
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
            className={`min-h-[60px] sm:min-h-[80px] p-0.5 sm:p-1 border border-subtle ${
              !isCurrentMonth ? 'bg-surface-app/50' : 'bg-surface/50'
            } ${isToday ? 'ring-2 ring-farm-green' : ''}`}
          >
            <div
              className={`text-sm font-medium mb-1 ${
                !isCurrentMonth
                  ? 'text-muted'
                  : isToday
                  ? 'text-farm-green'
                  : 'text-muted'
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
                      ? 'bg-surface-soft text-muted line-through'
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
                <div className="text-xs text-muted px-1">
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
    <div className="bg-surface rounded-xl p-2 sm:p-4 overflow-x-auto">
      <div className="min-w-[280px]">
        {renderHeader()}
        {renderDays()}
        {renderCells()}
      </div>
    </div>
  )
}

export default Calendar
