import React, { useState, useEffect } from 'react'
import {
  Plus,
  ListTodo,
  Calendar,
  AlertCircle,
  CheckCircle,
  Filter,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'
import {
  getTasks,
  getTodaysTasks,
  getUpcomingTasks,
  getOverdueTasks,
  createTask,
  updateTask,
  deleteTask,
  completeTask,
  uncompleteTask,
} from '../services/api'
import { format } from 'date-fns'

function Tasks() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [view, setView] = useState('today')

  const fetchTasks = async () => {
    setLoading(true)
    try {
      let response
      switch (view) {
        case 'today':
          response = await getTodaysTasks()
          break
        case 'upcoming':
          response = await getUpcomingTasks(14)
          break
        case 'overdue':
          response = await getOverdueTasks()
          break
        default:
          response = await getTasks({ completed: false })
      }
      setTasks(response.data)
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [view])

  const handleToggle = async (task) => {
    try {
      if (task.is_completed) {
        await uncompleteTask(task.id)
      } else {
        await completeTask(task.id)
      }
      fetchTasks()
    } catch (error) {
      console.error('Failed to toggle task:', error)
    }
  }

  const handleDelete = async (task) => {
    if (confirm(`Delete "${task.title}"? This cannot be undone.`)) {
      try {
        await deleteTask(task.id)
        fetchTasks()
      } catch (error) {
        console.error('Failed to delete task:', error)
      }
    }
  }

  const handleEdit = (task) => {
    setEditingTask(task)
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const taskData = {
      title: formData.get('title'),
      description: formData.get('description'),
      category: formData.get('category'),
      due_date: formData.get('due_date') || null,
      due_time: formData.get('due_time') || null,
      priority: parseInt(formData.get('priority')) || 2,
      recurrence: formData.get('recurrence'),
      notify_email: formData.get('notify_email') === 'on',
    }

    try {
      if (editingTask) {
        await updateTask(editingTask.id, taskData)
      } else {
        await createTask(taskData)
      }
      setShowForm(false)
      setEditingTask(null)
      fetchTasks()
    } catch (error) {
      console.error('Failed to save task:', error)
    }
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingTask(null)
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 1:
        return 'border-l-red-500'
      case 2:
        return 'border-l-yellow-500'
      case 3:
        return 'border-l-blue-500'
      default:
        return 'border-l-gray-500'
    }
  }

  const getCategoryIcon = (category) => {
    const icons = {
      plant_care: '🌱',
      animal_care: '🐴',
      home_maintenance: '🏠',
      garden: '🌻',
      equipment: '🔧',
      seasonal: '📅',
      custom: '📋',
    }
    return icons[category] || '📋'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-farm-green"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ListTodo className="w-7 h-7 text-yellow-500" />
          Tasks & Reminders
        </h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-farm-green hover:bg-farm-green-light rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Task
        </button>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'today', label: "Today's Tasks", icon: Calendar },
          { key: 'upcoming', label: 'Upcoming', icon: ListTodo },
          { key: 'overdue', label: 'Overdue', icon: AlertCircle },
          { key: 'all', label: 'All Tasks', icon: Filter },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              view === tab.key
                ? 'bg-farm-green text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Task List */}
      {tasks.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-gray-800 rounded-xl">
          <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>
            {view === 'today'
              ? 'No tasks for today!'
              : view === 'overdue'
              ? 'No overdue tasks!'
              : 'No tasks found.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`bg-gray-800 rounded-lg p-4 border-l-4 transition-all hover:bg-gray-750 ${getPriorityColor(
                task.priority
              )} ${task.is_completed ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start gap-4">
                {/* Checkbox */}
                <button
                  onClick={() => handleToggle(task)}
                  className="mt-1 flex-shrink-0"
                >
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      task.is_completed
                        ? 'bg-green-500 border-green-500'
                        : 'border-gray-500 hover:border-green-400'
                    }`}
                  >
                    {task.is_completed && (
                      <CheckCircle className="w-4 h-4 text-white" />
                    )}
                  </div>
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {getCategoryIcon(task.category)}
                    </span>
                    <h3
                      className={`font-medium ${
                        task.is_completed ? 'line-through text-gray-500' : ''
                      }`}
                    >
                      {task.title}
                    </h3>
                  </div>
                  {task.description && (
                    <p className="text-sm text-gray-400 mt-1">
                      {task.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    {task.due_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(task.due_date), 'MMM d, yyyy')}
                      </span>
                    )}
                    {task.due_time && <span>🕐 {task.due_time}</span>}
                    {task.recurrence && task.recurrence !== 'once' && (
                      <span className="capitalize text-blue-400">
                        🔄 {task.recurrence}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {task.priority === 1 && (
                    <span className="px-2 py-1 bg-red-900/50 text-red-300 text-xs rounded">
                      High
                    </span>
                  )}
                  {task.priority === 2 && (
                    <span className="px-2 py-1 bg-yellow-900/50 text-yellow-300 text-xs rounded">
                      Medium
                    </span>
                  )}
                  {task.priority === 3 && (
                    <span className="px-2 py-1 bg-blue-900/50 text-blue-300 text-xs rounded">
                      Low
                    </span>
                  )}
                  <button
                    onClick={() => handleEdit(task)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(task)}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
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

      {/* Add/Edit Task Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                {editingTask ? 'Edit Task' : 'Add New Task'}
              </h2>
              <button
                onClick={closeForm}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Title *</label>
                <input
                  type="text"
                  name="title"
                  required
                  defaultValue={editingTask?.title || ''}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={editingTask?.description || ''}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Category</label>
                  <select
                    name="category"
                    defaultValue={editingTask?.category || 'custom'}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  >
                    <option value="custom">Custom</option>
                    <option value="plant_care">Plant Care</option>
                    <option value="animal_care">Animal Care</option>
                    <option value="home_maintenance">Home Maintenance</option>
                    <option value="garden">Garden</option>
                    <option value="equipment">Equipment</option>
                    <option value="seasonal">Seasonal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Priority</label>
                  <select
                    name="priority"
                    defaultValue={editingTask?.priority || 2}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  >
                    <option value="1">High</option>
                    <option value="2">Medium</option>
                    <option value="3">Low</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Due Date</label>
                  <input
                    type="date"
                    name="due_date"
                    defaultValue={editingTask?.due_date || ''}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Time</label>
                  <input
                    type="time"
                    name="due_time"
                    defaultValue={editingTask?.due_time || ''}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Recurrence</label>
                <select
                  name="recurrence"
                  defaultValue={editingTask?.recurrence || 'once'}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                >
                  <option value="once">One-time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Annually</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="notify_email"
                  id="notify_email"
                  defaultChecked={editingTask?.notify_email ?? true}
                  className="w-4 h-4"
                />
                <label htmlFor="notify_email" className="text-sm">
                  Send email reminder
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light rounded-lg transition-colors"
                >
                  {editingTask ? 'Save Changes' : 'Add Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Tasks
