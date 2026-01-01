import React from 'react'
import { Check, Circle, AlertCircle } from 'lucide-react'
import { completeTask, uncompleteTask } from '../services/api'

function TaskList({ tasks, title, onTaskToggle, showDate = false }) {
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

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'plant_care':
        return '🌱'
      case 'animal_care':
        return '🐴'
      case 'home_maintenance':
        return '🏠'
      case 'garden':
        return '🌻'
      case 'equipment':
        return '🔧'
      case 'seasonal':
        return '📅'
      default:
        return '📋'
    }
  }

  const handleToggle = async (task) => {
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

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-gray-300 mb-4">{title}</h2>
      <div className="space-y-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`p-4 rounded-lg border-l-4 transition-all hover:scale-[1.01] ${getPriorityColor(
              task.priority
            )} ${task.is_completed ? 'opacity-60' : ''}`}
          >
            <div className="flex items-start gap-3">
              <button
                onClick={() => handleToggle(task)}
                className="mt-1 flex-shrink-0 focus:outline-none"
              >
                {task.is_completed ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-500 hover:text-green-400" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span>{getCategoryIcon(task.category)}</span>
                  <span
                    className={`font-medium ${
                      task.is_completed ? 'line-through text-gray-500' : ''
                    }`}
                  >
                    {task.title}
                  </span>
                </div>
                {task.description && (
                  <p className="text-sm text-gray-400 mt-1 truncate">
                    {task.description}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  {showDate && task.date && (
                    <span>{new Date(task.date).toLocaleDateString()}</span>
                  )}
                  {task.due_time && <span>🕐 {task.due_time}</span>}
                </div>
              </div>
              {task.priority === 1 && !task.is_completed && (
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TaskList
