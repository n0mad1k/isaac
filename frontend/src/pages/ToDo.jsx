import React, { useState, useEffect } from 'react'
import {
  Plus,
  ListTodo,
  Calendar,
  AlertCircle,
  CheckCircle,
  Pencil,
  Trash2,
  X,
  RefreshCw,
} from 'lucide-react'
import {
  getTasks,
  getUpcomingTasks,
  getOverdueTasks,
  createTask,
  updateTask,
  deleteTask,
  completeTask,
  uncompleteTask,
  syncCalendar,
} from '../services/api'
import { format, isAfter, startOfDay, parseISO } from 'date-fns'

function ToDo() {
  // Check if a todo is overdue
  const isOverdue = (todo) => {
    if (!todo.due_date || todo.is_completed) return false
    const today = startOfDay(new Date())
    const dueDate = startOfDay(parseISO(todo.due_date))
    return isAfter(today, dueDate)
  }
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingTodo, setEditingTodo] = useState(null)
  const [view, setView] = useState('all')  // Default to 'all' to show today + undated

  const fetchTodos = async () => {
    setLoading(true)
    try {
      let response
      switch (view) {
        case 'upcoming':
          response = await getUpcomingTasks(14)
          break
        case 'overdue':
          response = await getOverdueTasks()
          break
        case 'all':
        default:
          // Get all incomplete to dos (includes today and undated)
          response = await getTasks({ completed: false })
      }
      // Filter to only show todos, not events
      const todosOnly = response.data.filter(t => t.task_type !== 'event' && t.task_type !== 'EVENT')
      setTodos(todosOnly)
    } catch (error) {
      console.error('Failed to fetch to dos:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTodos()
  }, [view])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await syncCalendar()
      await fetchTodos()
    } catch (error) {
      console.error('Failed to sync:', error)
    } finally {
      setSyncing(false)
    }
  }

  const handleToggle = async (todo) => {
    try {
      if (todo.is_completed) {
        await uncompleteTask(todo.id)
      } else {
        await completeTask(todo.id)
      }
      fetchTodos()
    } catch (error) {
      console.error('Failed to toggle to do:', error)
    }
  }

  const handleDelete = async (todo) => {
    if (confirm(`Delete "${todo.title}"? This cannot be undone.`)) {
      try {
        await deleteTask(todo.id)
        fetchTodos()
      } catch (error) {
        console.error('Failed to delete to do:', error)
      }
    }
  }

  const handleEdit = (todo) => {
    setEditingTodo(todo)
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const todoData = {
      title: formData.get('title'),
      description: formData.get('description'),
      category: formData.get('category'),
      due_date: formData.get('due_date') || null,
      due_time: formData.get('due_time') || null,
      priority: parseInt(formData.get('priority')) || 2,
      recurrence: formData.get('recurrence'),
      task_type: 'todo',  // Always create as todo from this page
    }

    try {
      if (editingTodo) {
        await updateTask(editingTodo.id, todoData)
      } else {
        await createTask(todoData)
      }
      setShowForm(false)
      setEditingTodo(null)
      fetchTodos()
    } catch (error) {
      console.error('Failed to save to do:', error)
    }
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingTodo(null)
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
          To Do
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 bg-cyan-700 hover:bg-cyan-600 rounded-lg transition-colors disabled:opacity-50"
            title="Sync with phone"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-farm-green hover:bg-farm-green-light rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add To Do
          </button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: 'All To Dos', icon: ListTodo },
          { key: 'upcoming', label: 'Upcoming', icon: Calendar },
          { key: 'overdue', label: 'Overdue', icon: AlertCircle },
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

      {/* To Do List */}
      {todos.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-gray-800 rounded-xl">
          <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>
            {view === 'overdue'
              ? 'No overdue to dos!'
              : 'No to dos found.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {todos.map((todo) => (
            <div
              key={todo.id}
              className={`bg-gray-800 rounded-lg p-4 border-l-4 transition-all hover:bg-gray-750 ${getPriorityColor(
                todo.priority
              )} ${todo.is_completed ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start gap-4">
                {/* Checkbox */}
                <button
                  onClick={() => handleToggle(todo)}
                  className="mt-1 flex-shrink-0"
                >
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      todo.is_completed
                        ? 'bg-green-500 border-green-500'
                        : 'border-gray-500 hover:border-green-400'
                    }`}
                  >
                    {todo.is_completed && (
                      <CheckCircle className="w-4 h-4 text-white" />
                    )}
                  </div>
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3
                      className={`font-medium ${
                        todo.is_completed ? 'line-through text-gray-500' : ''
                      }`}
                    >
                      {todo.title}
                    </h3>
                    {/* Overdue badge */}
                    {isOverdue(todo) && (
                      <span className="px-1.5 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded uppercase flex-shrink-0">
                        Overdue
                      </span>
                    )}
                  </div>
                  {todo.description && (
                    <p className="text-sm text-gray-400 mt-1">
                      {todo.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    {todo.due_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(todo.due_date), 'MMM d, yyyy')}
                      </span>
                    )}
                    {todo.due_time && <span>🕐 {todo.due_time}</span>}
                    {todo.recurrence && todo.recurrence !== 'once' && (
                      <span className="capitalize text-blue-400">
                        🔄 {todo.recurrence}
                      </span>
                    )}
                    {!todo.due_date && (
                      <span className="text-gray-600 italic">No date set</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {todo.priority === 1 && (
                    <span className="px-2 py-1 bg-red-900/50 text-red-300 text-xs rounded">
                      High
                    </span>
                  )}
                  {todo.priority === 2 && (
                    <span className="px-2 py-1 bg-yellow-900/50 text-yellow-300 text-xs rounded">
                      Medium
                    </span>
                  )}
                  {todo.priority === 3 && (
                    <span className="px-2 py-1 bg-blue-900/50 text-blue-300 text-xs rounded">
                      Low
                    </span>
                  )}
                  <button
                    onClick={() => handleEdit(todo)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(todo)}
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

      {/* Add/Edit To Do Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                {editingTodo ? 'Edit To Do' : 'Add New To Do'}
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
                  defaultValue={editingTodo?.title || ''}
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
                  defaultValue={editingTodo?.description || ''}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Category</label>
                  <select
                    name="category"
                    defaultValue={editingTodo?.category || 'custom'}
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
                    defaultValue={editingTodo?.priority || 2}
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
                  <label className="block text-sm text-gray-400 mb-1">Due Date (optional)</label>
                  <input
                    type="date"
                    name="due_date"
                    defaultValue={editingTodo?.due_date || ''}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Time</label>
                  <input
                    type="time"
                    name="due_time"
                    defaultValue={editingTodo?.due_time || ''}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Recurrence</label>
                <select
                  name="recurrence"
                  defaultValue={editingTodo?.recurrence || 'once'}
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
                  {editingTodo ? 'Save Changes' : 'Add To Do'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ToDo
