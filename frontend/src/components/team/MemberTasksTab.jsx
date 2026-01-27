import React, { useState, useEffect } from 'react'
import {
  CheckCircle, Circle, Clock, AlertTriangle, ChevronDown, ChevronUp,
  Calendar, ListTodo
} from 'lucide-react'
import { getMemberTasks, getMemberBacklog } from '../../services/api'

function MemberTasksTab({ member, onUpdate }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tasks, setTasks] = useState([])
  const [backlogTasks, setBacklogTasks] = useState([])
  const [showCompleted, setShowCompleted] = useState(false)
  const [showBacklog, setShowBacklog] = useState(true)

  useEffect(() => {
    loadTasks()
  }, [member.id])

  const loadTasks = async () => {
    setLoading(true)
    setError(null)
    try {
      const [tasksRes, backlogRes] = await Promise.all([
        getMemberTasks(member.id, { include_completed: showCompleted }),
        getMemberBacklog(member.id)
      ])
      setTasks(tasksRes.data.filter(t => !t.is_backlog))
      setBacklogTasks(backlogRes.data)
    } catch (err) {
      console.error('Failed to load tasks:', err)
      setError(err.userMessage || 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!loading) {
      loadTasks()
    }
  }, [showCompleted])

  const getPriorityBadge = (priority) => {
    const colors = {
      1: 'bg-red-600 text-white',
      2: 'bg-yellow-600 text-white',
      3: 'bg-blue-600 text-white'
    }
    const labels = { 1: 'High', 2: 'Medium', 3: 'Low' }
    return (
      <span className={`px-2 py-0.5 rounded text-xs ${colors[priority] || colors[2]}`}>
        {labels[priority] || 'Medium'}
      </span>
    )
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'No due date'
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const TaskCard = ({ task }) => {
    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !task.is_completed

    return (
      <div className={`bg-gray-700 rounded-lg p-3 ${task.is_completed ? 'opacity-60' : ''}`}>
        <div className="flex items-start gap-3">
          {task.is_completed ? (
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
          ) : task.is_in_progress ? (
            <Clock className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
          ) : (
            <Circle className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <span className={`font-medium ${task.is_completed ? 'line-through text-gray-400' : 'text-white'}`}>
                {task.title}
              </span>
              {getPriorityBadge(task.priority)}
            </div>

            {task.description && (
              <p className="text-sm text-gray-400 mt-1 line-clamp-2">{task.description}</p>
            )}

            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-400' : ''}`}>
                <Calendar className="w-3 h-3" />
                {formatDate(task.due_date)}
              </span>
              {task.due_time && <span>{task.due_time}</span>}
              {task.category && (
                <span className="px-1.5 py-0.5 bg-gray-600 rounded">
                  {task.category.replace('_', ' ')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-400">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
        <p>{error}</p>
      </div>
    )
  }

  const activeTasks = tasks.filter(t => !t.is_completed)
  const completedTasks = tasks.filter(t => t.is_completed)

  return (
    <div className="space-y-6">
      {/* Active Tasks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <ListTodo className="w-5 h-5" />
            Active Tasks ({activeTasks.length})
          </h3>
        </div>

        {activeTasks.length === 0 ? (
          <div className="text-center py-6 text-gray-400 bg-gray-700/50 rounded-lg">
            No active tasks assigned
          </div>
        ) : (
          <div className="space-y-2">
            {activeTasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>

      {/* Backlog Section */}
      <div>
        <button
          onClick={() => setShowBacklog(!showBacklog)}
          className="flex items-center justify-between w-full mb-3 text-left"
        >
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Backlog ({backlogTasks.length})
          </h3>
          {showBacklog ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {showBacklog && (
          backlogTasks.length === 0 ? (
            <div className="text-center py-6 text-gray-400 bg-gray-700/50 rounded-lg">
              No backlog tasks assigned
            </div>
          ) : (
            <div className="space-y-2">
              {backlogTasks.map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          )
        )}
      </div>

      {/* Completed Tasks */}
      <div>
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
        >
          {showCompleted ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {showCompleted ? 'Hide' : 'Show'} Completed Tasks ({completedTasks.length})
        </button>

        {showCompleted && completedTasks.length > 0 && (
          <div className="space-y-2 mt-3">
            {completedTasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default MemberTasksTab
