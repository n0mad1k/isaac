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
  CalendarDays,
  Clock,
  Archive,
  ArrowUp,
  MapPin,
  Wrench,
  User,
  BarChart3,
  TrendingUp,
  Flame,
  Target,
  ChevronDown,
  Check,
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
  toggleBacklog,
  syncCalendar,
  getSettings,
  getWorkers,
  getTaskMetrics,
  getTeamMembers,
} from '../services/api'
import { format, isAfter, startOfDay, parseISO, addDays, endOfWeek, endOfMonth, isWithinInterval, isSameDay, isToday, isTomorrow } from 'date-fns'
import { useSettings } from '../contexts/SettingsContext'
import MottoDisplay from '../components/MottoDisplay'

function ToDo() {
  const { formatTime } = useSettings()

  // Check if a todo is overdue
  const isOverdue = (todo) => {
    if (!todo.due_date || todo.is_completed) return false
    const now = new Date()
    const today = startOfDay(now)
    const dueDate = startOfDay(parseISO(todo.due_date))
    // If due date is in the past, it's overdue
    if (isAfter(today, dueDate)) return true
    // If due date is today and has a due_time, check if time has passed
    if (isSameDay(today, dueDate) && todo.due_time) {
      const [hours, minutes] = todo.due_time.split(':').map(Number)
      const dueDateTime = new Date(dueDate)
      dueDateTime.setHours(hours, minutes, 0, 0)
      return isAfter(now, dueDateTime)
    }
    return false
  }
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingTodo, setEditingTodo] = useState(null)
  const [view, setView] = useState('today')  // Default to 'today' tab
  const [hideCompleted, setHideCompleted] = useState(false)
  const [selectedRecurrence, setSelectedRecurrence] = useState('once')
  const [customInterval, setCustomInterval] = useState('')
  const [selectedAlerts, setSelectedAlerts] = useState([])
  const [displayLimit, setDisplayLimit] = useState(20)  // For "All" tab pagination
  const [workers, setWorkers] = useState([])
  const [members, setMembers] = useState([])
  const [selectedWorkerId, setSelectedWorkerId] = useState(null)
  const [selectedMemberIds, setSelectedMemberIds] = useState([])  // Multi-select for team members
  const [showMemberDropdown, setShowMemberDropdown] = useState(false)  // Dropdown visibility
  const [isAllDay, setIsAllDay] = useState(true)  // Default to all-day (no time)
  const [metrics, setMetrics] = useState(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const INITIAL_DISPLAY_LIMIT = 20
  const LOAD_MORE_COUNT = 20

  // Filter todos based on view
  const filterTodosByView = (allTodos) => {
    const today = startOfDay(new Date())
    const tomorrow = addDays(today, 1)
    const weekEnd = endOfWeek(today, { weekStartsOn: 0 })
    const monthEnd = endOfMonth(today)

    return allTodos.filter(todo => {
      // Filter to only show todos, not events
      if (todo.task_type === 'event' || todo.task_type === 'EVENT') return false

      // Backlog view shows only backlog items
      if (view === 'backlog') {
        return todo.is_backlog === true
      }

      // All other views exclude backlog items
      if (todo.is_backlog) return false

      // For dateless completed tasks, only show if completed today
      if (!todo.due_date && todo.is_completed) {
        if (!todo.completed_at) return false
        const completedDate = startOfDay(parseISO(todo.completed_at))
        if (!isSameDay(completedDate, today)) return false
      }

      // Always include overdue items in all views except 'all'
      if (isOverdue(todo) && view !== 'all') return true

      // Treat dateless items as due today
      const dueDate = todo.due_date ? startOfDay(parseISO(todo.due_date)) : today

      switch (view) {
        case 'today':
          return isSameDay(dueDate, today)
        case 'upcoming':
          // Today and tomorrow
          return isSameDay(dueDate, today) || isSameDay(dueDate, tomorrow)
        case 'week':
          return isWithinInterval(dueDate, { start: today, end: weekEnd })
        case 'month':
          return isWithinInterval(dueDate, { start: today, end: monthEnd })
        case 'overdue':
          return isOverdue(todo)
        case 'all':
        default:
          return true  // Show all tasks (completed filtered upstream based on setting)
      }
    })
  }

  const fetchTodos = async () => {
    setLoading(true)
    try {
      // Fetch settings, tasks, workers, and team members
      const [settingsRes, response, workersRes, membersRes] = await Promise.all([
        getSettings(),
        getTasks(),  // Get all tasks (both completed and incomplete)
        getWorkers().catch(() => ({ data: [] })),
        getTeamMembers().catch(() => ({ data: [] }))
      ])

      // Set workers and members for dropdown
      setWorkers(workersRes.data || [])
      setMembers(membersRes.data || [])

      // Check hide_completed_today setting
      const hideCompletedSetting = settingsRes.data?.settings?.hide_completed_today?.value
      setHideCompleted(hideCompletedSetting === 'true')

      let allTodos = response.data

      // If hide completed is enabled, filter out completed tasks
      if (hideCompletedSetting === 'true') {
        allTodos = allTodos.filter(t => !t.is_completed)
      }

      const filteredTodos = filterTodosByView(allTodos)
      setTodos(filteredTodos)
    } catch (error) {
      console.error('Failed to fetch to dos:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (view === 'metrics') {
      fetchMetrics()
    } else {
      fetchTodos()
    }
  }, [view])

  const fetchMetrics = async () => {
    setMetricsLoading(true)
    try {
      const response = await getTaskMetrics()
      setMetrics(response.data)
    } catch (error) {
      console.error('Failed to fetch metrics:', error)
    } finally {
      setMetricsLoading(false)
    }
  }

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
    setSelectedRecurrence(todo.recurrence || 'once')
    setCustomInterval(todo.recurrence_interval?.toString() || '')
    setSelectedAlerts(todo.reminder_alerts || [])
    setSelectedWorkerId(todo.assigned_to_worker_id || null)
    // Use assigned_member_ids array, or fall back to legacy single member
    setSelectedMemberIds(
      todo.assigned_member_ids?.length > 0
        ? todo.assigned_member_ids
        : todo.assigned_to_member_id
          ? [todo.assigned_to_member_id]
          : []
    )
    setIsAllDay(!todo.due_time)  // Set based on whether existing todo has a time
    setShowForm(true)
  }

  const handleBacklog = async (todo) => {
    try {
      await toggleBacklog(todo.id)
      fetchTodos()
    } catch (error) {
      console.error('Failed to toggle backlog:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const dueDate = formData.get('due_date') || null

    // Validate: alerts require a date
    if (selectedAlerts.length > 0 && !dueDate) {
      alert('Email alerts require a due date. Please set a date or remove the alerts.')
      return
    }

    const todoData = {
      title: formData.get('title'),
      description: formData.get('description'),
      category: formData.get('category'),
      due_date: dueDate,
      due_time: isAllDay ? null : (formData.get('due_time') || null),  // Only include time if not all-day
      priority: parseInt(formData.get('priority')) || 2,
      recurrence: selectedRecurrence,
      recurrence_interval: selectedRecurrence === 'custom' && customInterval ? parseInt(customInterval) : null,
      task_type: 'todo',  // Always create as todo from this page
      is_backlog: formData.get('is_backlog') === 'on',
      visible_to_farmhands: formData.get('visible_to_farmhands') === 'on',
      reminder_alerts: selectedAlerts.length > 0 ? selectedAlerts : null,
      assigned_to_worker_id: selectedWorkerId || null,
      assigned_member_ids: selectedMemberIds.length > 0 ? selectedMemberIds : null,
    }

    try {
      if (editingTodo) {
        await updateTask(editingTodo.id, todoData)
      } else {
        await createTask(todoData)
      }
      setShowForm(false)
      setEditingTodo(null)
      setSelectedAlerts([])
      setSelectedWorkerId(null)
      setSelectedMemberIds([])
      setShowMemberDropdown(false)
      fetchTodos()
    } catch (error) {
      console.error('Failed to save to do:', error)
      // Don't show alert for 401 - the interceptor handles redirect
      if (error.response?.status !== 401) {
        alert(error.userMessage || 'Failed to save. Please try again.')
      }
    }
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingTodo(null)
    setSelectedRecurrence('once')
    setCustomInterval('')
    setSelectedAlerts([])
    setSelectedWorkerId(null)
    setSelectedMemberIds([])
    setShowMemberDropdown(false)
    setIsAllDay(true)  // Reset to default
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
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2 flex-shrink-0">
          <ListTodo className="w-7 h-7 text-yellow-500" />
          To Do
        </h1>
        <MottoDisplay />
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 bg-cyan-700 hover:bg-cyan-600 text-white rounded-lg transition-colors disabled:opacity-50"
            title="Sync with phone"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add To Do
          </button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'upcoming', label: 'Upcoming', icon: Clock, description: 'Today & Tomorrow' },
          { key: 'today', label: 'Today', icon: Calendar },
          { key: 'week', label: 'This Week', icon: CalendarDays },
          { key: 'month', label: 'This Month', icon: CalendarDays },
          { key: 'all', label: 'All', icon: ListTodo },
          { key: 'backlog', label: 'Backlog', icon: Archive, description: 'Parked items' },
          { key: 'overdue', label: 'Overdue', icon: AlertCircle },
          { key: 'metrics', label: 'Metrics', icon: BarChart3, description: 'Productivity stats' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setView(tab.key); setDisplayLimit(INITIAL_DISPLAY_LIMIT); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              view === tab.key
                ? 'bg-farm-green text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
            title={tab.description}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Metrics View */}
      {view === 'metrics' ? (
        metricsLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-farm-green"></div>
          </div>
        ) : metrics ? (
          <div className="space-y-4">
            {/* Key Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <Target className="w-8 h-8 mx-auto mb-2 text-green-400" />
                <div className="text-3xl font-bold text-green-400">{metrics.completed_today}</div>
                <div className="text-sm text-gray-400">Completed Today</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <Flame className="w-8 h-8 mx-auto mb-2 text-orange-400" />
                <div className="text-3xl font-bold text-orange-400">{metrics.completion_streak}</div>
                <div className="text-sm text-gray-400">Day Streak</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-blue-400" />
                <div className="text-3xl font-bold text-blue-400">{metrics.avg_per_day}</div>
                <div className="text-sm text-gray-400">Avg/Day This Week</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <Clock className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
                <div className="text-3xl font-bold text-yellow-400">{metrics.total_pending}</div>
                <div className="text-sm text-gray-400">Pending Tasks</div>
              </div>
            </div>

            {/* Period Stats */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-cyan-400" />
                Completion Summary
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-2xl font-bold">{metrics.completed_today}</div>
                  <div className="text-sm text-gray-400">Today</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{metrics.completed_this_week}</div>
                  <div className="text-sm text-gray-400">This Week</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{metrics.completed_this_month}</div>
                  <div className="text-sm text-gray-400">This Month</div>
                </div>
              </div>
            </div>

            {/* Health Indicators */}
            <div className="grid grid-cols-2 gap-3">
              <div className={`rounded-lg p-4 ${metrics.overdue_count > 0 ? 'bg-red-900/30 border border-red-500/50' : 'bg-green-900/30 border border-green-500/50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className={`w-5 h-5 ${metrics.overdue_count > 0 ? 'text-red-400' : 'text-green-400'}`} />
                  <span className="font-semibold">Overdue</span>
                </div>
                <div className={`text-2xl font-bold ${metrics.overdue_count > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {metrics.overdue_count}
                </div>
                <div className="text-sm text-gray-400">
                  {metrics.overdue_count === 0 ? 'All caught up!' : 'tasks need attention'}
                </div>
              </div>
              <div className="bg-amber-900/30 border border-amber-500/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Archive className="w-5 h-5 text-amber-400" />
                  <span className="font-semibold">Backlog</span>
                </div>
                <div className="text-2xl font-bold text-amber-400">{metrics.backlog_count}</div>
                <div className="text-sm text-gray-400">parked for later</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500 bg-gray-800 rounded-xl">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Unable to load metrics</p>
          </div>
        )
      ) : (
      /* To Do List */
      todos.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-gray-800 rounded-xl">
          <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>
            {view === 'overdue'
              ? 'No overdue to dos!'
              : view === 'backlog'
              ? 'No items in backlog.'
              : 'No to dos found.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {(view === 'all' ? todos.slice(0, displayLimit) : todos).map((todo) => (
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3
                      className={`font-medium ${
                        todo.is_completed ? 'line-through text-gray-500' : ''
                      }`}
                    >
                      {todo.title}
                    </h3>
                    {/* Location badge (purple) */}
                    {todo.linked_location && (
                      <span className="text-xs text-purple-400 flex items-center gap-0.5 bg-purple-900/30 px-1.5 py-0.5 rounded flex-shrink-0">
                        <MapPin className="w-3 h-3" />
                        {todo.linked_location}
                      </span>
                    )}
                    {/* Vehicle/Equipment badge (orange) */}
                    {todo.linked_entity && (
                      <span className="text-xs text-orange-400 flex items-center gap-0.5 bg-orange-900/30 px-1.5 py-0.5 rounded flex-shrink-0">
                        <Wrench className="w-3 h-3" />
                        {todo.linked_entity}
                      </span>
                    )}
                    {/* Overdue badge */}
                    {isOverdue(todo) && (
                      <span className="px-1.5 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded uppercase flex-shrink-0">
                        Overdue
                      </span>
                    )}
                    {/* Member assignment badge (multi-member or single) */}
                    {(todo.assigned_member_names?.length > 0 || todo.assigned_to_member_name) && (
                      <span className="text-xs flex items-center gap-0.5 px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: 'var(--color-bg-surface-muted)', color: 'var(--color-text-primary)' }}>
                        <User className="w-3 h-3" />
                        {todo.assigned_member_names?.length > 0
                          ? todo.assigned_member_names.join(', ')
                          : todo.assigned_to_member_name}
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
                        {format(parseISO(todo.due_date), 'MMM d, yyyy')}
                      </span>
                    )}
                    {todo.due_time && <span>🕐 {formatTime(todo.due_time)}</span>}
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
                  {/* Backlog toggle button */}
                  <button
                    onClick={() => handleBacklog(todo)}
                    className={`p-2 rounded-lg transition-colors ${
                      todo.is_backlog
                        ? 'text-farm-green hover:text-green-400 hover:bg-gray-700'
                        : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700'
                    }`}
                    title={todo.is_backlog ? 'Move to Today' : 'Move to Backlog'}
                  >
                    {todo.is_backlog ? <ArrowUp className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                  </button>
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
          {/* Load More button for All tab */}
          {view === 'all' && todos.length > displayLimit && (
            <button
              onClick={() => setDisplayLimit(prev => prev + LOAD_MORE_COUNT)}
              className="w-full py-3 mt-4 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
            >
              Load More ({todos.length - displayLimit} remaining)
            </button>
          )}
        </div>
      )
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
            <form onSubmit={handleSubmit} className="space-y-4" id="todo-form">
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
              <div>
                <label className="block text-sm text-gray-400 mb-1">Due Date (optional)</label>
                <input
                  type="date"
                  name="due_date"
                  defaultValue={editingTodo?.due_date || ''}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400">
                  <input
                    type="checkbox"
                    checked={isAllDay}
                    onChange={(e) => setIsAllDay(e.target.checked)}
                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-farm-green focus:ring-farm-green"
                  />
                  All day (no specific time)
                </label>
              </div>
              {!isAllDay && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Time</label>
                  <input
                    type="time"
                    name="due_time"
                    defaultValue={editingTodo?.due_time || ''}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Recurrence</label>
                <select
                  value={selectedRecurrence}
                  onChange={(e) => setSelectedRecurrence(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                >
                  <option value="once">One-time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Annually</option>
                  <option value="custom">Custom (every X days)</option>
                </select>
              </div>
              {selectedRecurrence === 'custom' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Repeat every (days)</label>
                  <input
                    type="number"
                    min="1"
                    value={customInterval}
                    onChange={(e) => setCustomInterval(e.target.value)}
                    placeholder="e.g., 14"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
              )}
              <div>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400">
                  <input
                    type="checkbox"
                    name="is_backlog"
                    defaultChecked={editingTodo?.is_backlog || false}
                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-farm-green focus:ring-farm-green"
                  />
                  Add to Backlog
                  <span className="text-xs text-gray-500">(won't appear in Today's Schedule)</span>
                </label>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400">
                  <input
                    type="checkbox"
                    name="visible_to_farmhands"
                    defaultChecked={editingTodo?.visible_to_farmhands || false}
                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-cyan-500 focus:ring-cyan-500"
                  />
                  Visible to Farm Hands
                  <span className="text-xs text-gray-500">(show this task to farm hand accounts)</span>
                </label>
              </div>
              {/* Alerts */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Alerts (optional)</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 0, label: 'At time' },
                    { value: 5, label: '5 min' },
                    { value: 10, label: '10 min' },
                    { value: 15, label: '15 min' },
                    { value: 30, label: '30 min' },
                    { value: 60, label: '1 hr' },
                    { value: 120, label: '2 hrs' },
                    { value: 1440, label: '1 day' },
                    { value: 2880, label: '2 days' },
                    { value: 10080, label: '1 week' },
                  ].map(opt => {
                    const isSelected = selectedAlerts.includes(opt.value)
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setSelectedAlerts(prev =>
                            isSelected
                              ? prev.filter(v => v !== opt.value)
                              : [...prev, opt.value].sort((a, b) => b - a)
                          )
                        }}
                        className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-cyan-600/30 border border-cyan-500 text-cyan-300'
                            : 'bg-gray-700/50 border border-gray-600 text-gray-400 hover:border-gray-500'
                        }`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              {/* Assign To (Team Members - Multi-select, Workers - Single select) */}
              {(members.length > 0 || workers.length > 0) && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Assign To (optional)
                  </label>
                  {/* Team Members Multi-Select */}
                  {members.filter(m => m.is_active !== false).length > 0 && (
                    <div className="relative mb-2">
                      <button
                        type="button"
                        onClick={() => setShowMemberDropdown(!showMemberDropdown)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green text-left flex items-center justify-between"
                      >
                        <span className={selectedMemberIds.length === 0 ? 'text-gray-400' : ''}>
                          {selectedMemberIds.length === 0
                            ? 'Select team members...'
                            : selectedMemberIds.length === 1
                              ? members.find(m => m.id === selectedMemberIds[0])?.nickname || members.find(m => m.id === selectedMemberIds[0])?.name
                              : `${selectedMemberIds.length} members selected`}
                        </span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${showMemberDropdown ? 'rotate-180' : ''}`} />
                      </button>
                      {showMemberDropdown && (
                        <div className="absolute z-50 w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {members.filter(m => m.is_active !== false).map(m => {
                            const isSelected = selectedMemberIds.includes(m.id)
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedMemberIds(selectedMemberIds.filter(id => id !== m.id))
                                  } else {
                                    setSelectedMemberIds([...selectedMemberIds, m.id])
                                  }
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-gray-600 flex items-center gap-2"
                              >
                                <div className={`w-4 h-4 border rounded flex items-center justify-center ${isSelected ? 'bg-farm-green border-farm-green' : 'border-gray-500'}`}>
                                  {isSelected && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <span>{m.nickname || m.name}{m.role_title ? ` (${m.role_title})` : ''}</span>
                              </button>
                            )
                          })}
                          {selectedMemberIds.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setSelectedMemberIds([])}
                              className="w-full px-3 py-2 text-left text-red-400 hover:bg-gray-600 border-t border-gray-600"
                            >
                              Clear selection
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Workers Single Select (legacy) */}
                  {workers.length > 0 && (
                    <select
                      value={selectedWorkerId || ''}
                      onChange={(e) => setSelectedWorkerId(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                    >
                      <option value="">No worker assigned</option>
                      {workers.map(w => (
                        <option key={w.id} value={w.id}>
                          {w.name}{w.role ? ` (${w.role})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
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
                  onClick={(e) => {
                    // Ensure form submits on touch devices
                    const form = document.getElementById('todo-form')
                    if (form && !form.checkValidity()) {
                      form.reportValidity()
                      e.preventDefault()
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors touch-manipulation"
                  style={{ minHeight: '48px' }}
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
