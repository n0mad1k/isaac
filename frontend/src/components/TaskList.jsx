import React, { useState } from 'react'
import { Check, Circle, AlertCircle, MapPin, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { completeTask, uncompleteTask } from '../services/api'
import { isAfter, startOfDay, parseISO } from 'date-fns'

function TaskList({ tasks, title, onTaskToggle, showDate = false, showTimeAndLocation = false, maxVisibleCompleted = 3 }) {
  const [showAllCompleted, setShowAllCompleted] = useState(false)

  const isOverdue = (task) => {
    // Events don't show as overdue - they're time-based, not action-based
    if (task.task_type === 'event') return false
    if (!task.due_date || task.is_completed) return false
    const today = startOfDay(new Date())
    const dueDate = startOfDay(parseISO(task.due_date))
    return isAfter(today, dueDate)
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 1:
        return 'border-l-red-500 bg-red-900/20'
      case 2:
        return 'border-l-yellow-500 bg-yellow-900/20'
      case 3:
        return 'border-l-blue-500 bg-blue-900/20'
      default:
        return 'border-l-gray-500 bg-gray-800'
    }
  }

  const handleToggle = async (task) => {
    // Don't allow toggling events - they auto-complete based on time
    if (task.task_type === 'event') return

    try {
      if (task.is_completed) {
        await uncompleteTask(task.id)
      } else {
        await completeTask(task.id)
      }
      if (onTaskToggle) onTaskToggle()
    } catch (error) {
      console.error('Failed to toggle task:', error)
    }
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-300 mb-4">{title}</h2>
        <div className="text-center py-8 text-gray-500">
          <Check className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No tasks! 🎉</p>
        </div>
      </div>
    )
  }

  // Separate completed and incomplete tasks
  const incompleteTasks = tasks.filter(t => !t.is_completed)
  const completedTasks = tasks.filter(t => t.is_completed)

  // Determine how many completed tasks to show
  const hasExcessCompleted = completedTasks.length > maxVisibleCompleted
  const visibleCompletedTasks = showAllCompleted
    ? completedTasks
    : completedTasks.slice(0, maxVisibleCompleted)
  const hiddenCompletedCount = completedTasks.length - maxVisibleCompleted

  const renderTask = (task) => (
    <div
      key={task.id}
      className={`p-3 rounded-lg border-l-4 transition-all hover:scale-[1.01] ${getPriorityColor(
        task.priority
      )} ${task.is_completed ? 'opacity-60' : ''}`}
    >
      {/* Main line: checkbox, icon, title, time, location */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleToggle(task)}
          className={`flex-shrink-0 focus:outline-none ${task.task_type === 'event' ? 'cursor-default' : ''}`}
          disabled={task.task_type === 'event'}
        >
          {task.is_completed ? (
            <Check className="w-5 h-5 text-green-500" />
          ) : (
            <Circle className={`w-5 h-5 ${task.task_type === 'event' ? 'text-gray-600' : 'text-gray-500 hover:text-green-400'}`} />
          )}
        </button>
        <span
          className={`font-medium ${
            task.is_completed ? 'line-through text-gray-500' : ''
          }`}
        >
          {task.title}
        </span>
        {/* Event badge */}
        {task.task_type === 'event' && !task.is_completed && (
          <span className="px-1.5 py-0.5 bg-green-700 text-white text-[10px] font-bold rounded uppercase">
            Event
          </span>
        )}
        {/* Overdue badge */}
        {isOverdue(task) && (
          <span className="px-1.5 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded uppercase">
            Overdue
          </span>
        )}
        {/* Time on same line */}
        {(task.due_time || task.end_time) && (
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {task.due_time}{task.end_time && ` - ${task.end_time}`}
          </span>
        )}
        {/* Location on same line */}
        {task.location && (
          <span className="text-xs text-cyan-400 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {task.location}
          </span>
        )}
        {/* Priority indicator */}
        {task.priority === 1 && !task.is_completed && (
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 ml-auto" />
        )}
      </div>
      {/* Second line: notes/description if available */}
      {task.description && (
        <p className="text-sm text-gray-400 mt-1 ml-7 truncate">
          {task.description}
        </p>
      )}
    </div>
  )

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-gray-300 mb-4">{title}</h2>
      <div className="space-y-3">
        {/* Render incomplete tasks first */}
        {incompleteTasks.map(renderTask)}

        {/* Render visible completed tasks */}
        {visibleCompletedTasks.map(renderTask)}

        {/* Show collapsed completed count or expand/collapse button */}
        {hasExcessCompleted && (
          <button
            onClick={() => setShowAllCompleted(!showAllCompleted)}
            className="w-full py-2 px-4 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-sm text-gray-400 flex items-center justify-center gap-2 transition-colors"
          >
            {showAllCompleted ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Show less
              </>
            ) : (
              <>
                <Check className="w-4 h-4 text-green-500" />
                {hiddenCompletedCount} more completed
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export default TaskList
