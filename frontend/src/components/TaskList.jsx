import React, { useState } from 'react'
import { Check, Circle, AlertCircle, MapPin, Clock, ChevronDown, ChevronUp, Wrench, User } from 'lucide-react'
import { completeTask, uncompleteTask } from '../services/api'
import { isAfter, startOfDay, parseISO, isSameDay } from 'date-fns'
import { useSettings } from '../contexts/SettingsContext'

function TaskList({ tasks, title, onTaskToggle, showDate = false, showTimeAndLocation = false, maxVisibleCompleted = 10, className = '', fillContainer = false }) {
  const [showAllCompleted, setShowAllCompleted] = useState(false)
  const { formatTime } = useSettings()

  const isOverdue = (task) => {
    // Events don't show as overdue - they're time-based, not action-based
    if (task.task_type === 'event') return false
    if (!task.due_date || task.is_completed) return false
    const now = new Date()
    const today = startOfDay(now)
    const dueDate = startOfDay(parseISO(task.due_date))
    // If due date is in the past, it's overdue
    if (isAfter(today, dueDate)) return true
    // If due date is today and has a due_time, check if time has passed
    if (isSameDay(today, dueDate) && task.due_time) {
      const [hours, minutes] = task.due_time.split(':').map(Number)
      const dueDateTime = new Date(dueDate)
      dueDateTime.setHours(hours, minutes, 0, 0)
      return isAfter(now, dueDateTime)
    }
    return false
  }

  const getPriorityStyles = (priority) => {
    return {
      borderLeft: '3px solid var(--color-border-default)',
      backgroundColor: 'var(--color-bg-surface-soft)'
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

  // Container styles based on fillContainer prop
  const containerStyle = {
    backgroundColor: 'var(--color-bg-surface)',
    border: '1px solid var(--color-border-default)'
  }

  const containerClasses = fillContainer
    ? `rounded-xl p-4 flex flex-col min-h-0 flex-1 ${className}`
    : `rounded-xl p-4 ${className}`

  if (!tasks || tasks.length === 0) {
    return (
      <div className={containerClasses} style={containerStyle}>
        <h2 className="text-base font-semibold mb-3 flex-shrink-0" style={{ color: 'var(--color-text-primary)' }}>{title}</h2>
        <div className="text-center py-4 flex-1 flex flex-col items-center justify-center" style={{ color: 'var(--color-text-muted)' }}>
          <Check className="w-8 h-8 mx-auto mb-1 opacity-50" />
          <p className="text-sm">No tasks!</p>
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

  const renderTask = (task) => {
    // Events get special styling, tasks use priority-based styling
    const taskStyles = task.task_type === 'event'
      ? { borderLeft: '4px solid var(--color-teal-600)', backgroundColor: 'var(--color-bg-surface-muted)' }
      : getPriorityStyles(task.priority)

    return (
      <div
        key={task.id}
        className={`p-3 rounded-lg transition-all hover:scale-[1.01] ${task.is_completed ? 'opacity-60' : ''}`}
        style={taskStyles}
      >
        {/* Main line: checkbox, icon, title, time, location */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleToggle(task)}
            className={`flex-shrink-0 focus:outline-none ${task.task_type === 'event' ? 'cursor-default' : ''}`}
            disabled={task.task_type === 'event'}
          >
            {task.is_completed ? (
              <Check className="w-5 h-5" style={{ color: 'var(--color-success-600)' }} />
            ) : (
              <Circle className={`w-5 h-5 hover:opacity-80`}
                      style={{ color: task.task_type === 'event' ? 'var(--color-text-muted)' : 'var(--color-text-secondary)' }} />
            )}
          </button>
          <span
            className={`font-medium ${task.is_completed ? 'line-through' : ''}`}
            style={{ color: task.is_completed ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}
          >
            {task.title}
          </span>
          {/* Linked location (farm area) */}
          {task.linked_location && (
            <span className="text-xs flex items-center gap-0.5 px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--color-bg-surface-muted)', color: 'var(--color-text-primary)' }}>
              <MapPin className="w-3 h-3" />
              {task.linked_location}
            </span>
          )}
          {/* Linked entity (vehicle/equipment) */}
          {task.linked_entity && (
            <span className="text-xs flex items-center gap-0.5 px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--color-gold-700)', color: 'var(--color-text-inverse)' }}>
              <Wrench className="w-3 h-3" />
              {task.linked_entity}
            </span>
          )}
          {/* Overdue badge */}
          {isOverdue(task) && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded uppercase" style={{ backgroundColor: 'var(--color-error-600)', color: 'var(--color-text-inverse)' }}>
              Overdue
            </span>
          )}
          {/* Time on same line */}
          {(task.due_time || task.end_time) && (
            <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
              <Clock className="w-3 h-3" />
              {formatTime(task.due_time)}{task.end_time && ` - ${formatTime(task.end_time)}`}
            </span>
          )}
          {/* Location on same line */}
          {task.location && (
            <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
              <MapPin className="w-3 h-3" />
              {task.location}
            </span>
          )}
          {/* Assigned member */}
          {(task.assigned_member_names?.length > 0 || task.assigned_to_member_name) && (
            <span className="text-xs flex items-center gap-0.5 px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--color-bg-surface-muted)', color: 'var(--color-text-primary)' }}>
              <User className="w-3 h-3" />
              {task.assigned_member_names?.length > 0
                ? task.assigned_member_names.join(', ')
                : task.assigned_to_member_name}
            </span>
          )}
          {/* Priority indicator */}
          {task.priority === 1 && !task.is_completed && (
            <AlertCircle className="w-4 h-4 flex-shrink-0 ml-auto" style={{ color: 'var(--color-error-600)' }} />
          )}
        </div>
        {/* Second line: notes/description if available */}
        {task.description && (
          <p className="text-sm mt-1 ml-7 truncate" style={{ color: 'var(--color-text-muted)' }}>
            {task.description}
          </p>
        )}
      </div>
    )
  }

  // Scrollable area classes for fillContainer mode
  const listClasses = fillContainer
    ? "space-y-2 flex-1 overflow-y-auto min-h-0"
    : "space-y-2"

  return (
    <div className={containerClasses} style={containerStyle}>
      <h2 className="text-base font-semibold mb-3 flex-shrink-0" style={{ color: 'var(--color-text-primary)' }}>{title}</h2>
      <div className={listClasses}>
        {/* Render incomplete tasks first */}
        {incompleteTasks.map(renderTask)}

        {/* Render visible completed tasks */}
        {visibleCompletedTasks.map(renderTask)}

        {/* Show collapsed completed count or expand/collapse button */}
        {hasExcessCompleted && (
          <button
            onClick={() => setShowAllCompleted(!showAllCompleted)}
            className="w-full py-2 px-4 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
            style={{
              backgroundColor: 'var(--color-bg-surface-muted)',
              color: 'var(--color-text-primary)'
            }}
          >
            {showAllCompleted ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Show less
              </>
            ) : (
              <>
                <Check className="w-4 h-4" style={{ color: 'var(--color-success-600)' }} />
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
