import React, { useState, useEffect, useCallback } from 'react'
import { Home, Plus, Check, Clock, AlertTriangle, ChevronDown, ChevronUp, X, Wrench, Calendar } from 'lucide-react'
import { getHomeMaintenance, createHomeMaintenance, updateHomeMaintenance, deleteHomeMaintenance, completeHomeMaintenance, getHomeMaintenanceCategories } from '../services/api'
import { format, formatDistanceToNow } from 'date-fns'

const CATEGORY_COLORS = {
  hvac: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  plumbing: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
  electrical: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  exterior: 'bg-green-500/20 text-green-400 border-green-500/50',
  appliances: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  pool: 'bg-sky-500/20 text-sky-400 border-sky-500/50',
  safety: 'bg-red-500/20 text-red-400 border-red-500/50',
  general: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
}

const STATUS_COLORS = {
  ok: 'text-green-400',
  due_soon: 'text-yellow-400',
  overdue: 'text-red-400',
  unknown: 'text-gray-400',
}

function HomeMaintenance() {
  const [tasks, setTasks] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [expandedCategory, setExpandedCategory] = useState(null)
  const [completeModal, setCompleteModal] = useState(null)
  const [completeNotes, setCompleteNotes] = useState('')
  const [completeCost, setCompleteCost] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    category: 'general',
    description: '',
    frequency_days: 30,
    frequency_label: 'Monthly',
    last_completed: '',
    manual_due_date: '',
    notes: '',
  })

  const frequencyOptions = [
    { days: 7, label: 'Weekly' },
    { days: 14, label: 'Every 2 weeks' },
    { days: 30, label: 'Monthly' },
    { days: 60, label: 'Every 2 months' },
    { days: 90, label: 'Quarterly' },
    { days: 180, label: 'Every 6 months' },
    { days: 365, label: 'Annually' },
    { days: 730, label: 'Every 2 years' },
    { days: 1095, label: 'Every 3 years' },
  ]

  const fetchData = useCallback(async () => {
    try {
      const [tasksRes, catsRes] = await Promise.all([
        getHomeMaintenance(),
        getHomeMaintenanceCategories()
      ])
      setTasks(tasksRes.data)
      setCategories(catsRes.data)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch home maintenance:', err)
      setError('Failed to load maintenance tasks')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const data = {
        ...formData,
        last_completed: formData.last_completed ? new Date(formData.last_completed).toISOString() : null,
        manual_due_date: formData.manual_due_date ? new Date(formData.manual_due_date).toISOString() : null,
      }
      if (editingTask) {
        await updateHomeMaintenance(editingTask.id, data)
      } else {
        await createHomeMaintenance(data)
      }
      setShowAddForm(false)
      setEditingTask(null)
      resetForm()
      fetchData()
    } catch (err) {
      console.error('Failed to save task:', err)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this maintenance task?')) return
    try {
      await deleteHomeMaintenance(id)
      fetchData()
    } catch (err) {
      console.error('Failed to delete task:', err)
    }
  }

  const handleComplete = async () => {
    if (!completeModal) return
    try {
      await completeHomeMaintenance(completeModal.id, {
        notes: completeNotes || null,
        cost: completeCost ? parseFloat(completeCost) : null,
      })
      setCompleteModal(null)
      setCompleteNotes('')
      setCompleteCost('')
      fetchData()
    } catch (err) {
      console.error('Failed to complete task:', err)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'general',
      description: '',
      frequency_days: 30,
      frequency_label: 'Monthly',
      last_completed: '',
      manual_due_date: '',
      notes: '',
    })
  }

  const startEdit = (task) => {
    setEditingTask(task)
    setFormData({
      name: task.name,
      category: task.category,
      description: task.description || '',
      frequency_days: task.frequency_days,
      frequency_label: task.frequency_label || '',
      last_completed: task.last_completed ? format(new Date(task.last_completed), 'yyyy-MM-dd') : '',
      manual_due_date: task.manual_due_date ? format(new Date(task.manual_due_date), 'yyyy-MM-dd') : '',
      notes: task.notes || '',
    })
    setShowAddForm(true)
  }

  // Group tasks by category
  const groupedTasks = tasks.reduce((acc, task) => {
    const cat = task.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(task)
    return acc
  }, {})

  // Count status for each category
  const getCategoryStats = (catTasks) => {
    const overdue = catTasks.filter(t => t.status === 'overdue').length
    const dueSoon = catTasks.filter(t => t.status === 'due_soon').length
    return { overdue, dueSoon, total: catTasks.length }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-farm-green"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Home className="w-8 h-8 text-farm-green" />
          <h1 className="text-2xl font-bold">Home Maintenance</h1>
        </div>
        <button
          onClick={() => { setShowAddForm(true); setEditingTask(null); resetForm(); }}
          className="flex items-center gap-2 px-4 py-2 bg-farm-green rounded-lg hover:bg-farm-green-light"
        >
          <Plus className="w-5 h-5" />
          Add Task
        </button>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-2xl font-bold">{tasks.length}</div>
          <div className="text-gray-400 text-sm">Total Tasks</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-400">
            {tasks.filter(t => t.status === 'ok').length}
          </div>
          <div className="text-gray-400 text-sm">Up to Date</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-400">
            {tasks.filter(t => t.status === 'due_soon').length}
          </div>
          <div className="text-gray-400 text-sm">Due Soon</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-400">
            {tasks.filter(t => t.status === 'overdue').length}
          </div>
          <div className="text-gray-400 text-sm">Overdue</div>
        </div>
      </div>

      {/* Tasks by Category */}
      <div className="space-y-3">
        {Object.entries(groupedTasks).map(([category, catTasks]) => {
          const stats = getCategoryStats(catTasks)
          const isExpanded = expandedCategory === category

          return (
            <div key={category} className="bg-gray-800 rounded-lg overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : category)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-700/50"
              >
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-sm border ${CATEGORY_COLORS[category] || CATEGORY_COLORS.general}`}>
                    {category.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className="text-gray-400">{stats.total} tasks</span>
                  {stats.overdue > 0 && (
                    <span className="text-red-400 text-sm">({stats.overdue} overdue)</span>
                  )}
                  {stats.dueSoon > 0 && stats.overdue === 0 && (
                    <span className="text-yellow-400 text-sm">({stats.dueSoon} due soon)</span>
                  )}
                </div>
                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>

              {/* Tasks List */}
              {isExpanded && (
                <div className="border-t border-gray-700">
                  {catTasks.map(task => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-4 border-b border-gray-700 last:border-0 hover:bg-gray-700/30"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            task.status === 'overdue' ? 'bg-red-400' :
                            task.status === 'due_soon' ? 'bg-yellow-400' : 'bg-green-400'
                          }`}></span>
                          <span className="font-medium">{task.name}</span>
                        </div>
                        <div className="text-sm text-gray-400 mt-1">
                          {task.frequency_label || `Every ${task.frequency_days} days`}
                          {task.last_completed && (
                            <span className="ml-2">
                              | Last: {formatDistanceToNow(new Date(task.last_completed), { addSuffix: true })}
                            </span>
                          )}
                          {task.next_due && (
                            <span className={`ml-2 ${STATUS_COLORS[task.status]}`}>
                              | Next: {format(new Date(task.next_due), 'MMM d')}
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <div className="text-sm text-gray-500 mt-1">{task.description}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCompleteModal(task)}
                          className="p-2 text-green-400 hover:bg-green-400/20 rounded-lg"
                          title="Mark Complete"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => startEdit(task)}
                          className="p-2 text-blue-400 hover:bg-blue-400/20 rounded-lg"
                          title="Edit"
                        >
                          <Wrench className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="p-2 text-red-400 hover:bg-red-400/20 rounded-lg"
                          title="Delete"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {tasks.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-400">
            <Home className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No maintenance tasks yet. Add one to get started!</p>
          </div>
        )}
      </div>

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingTask ? 'Edit Task' : 'Add Maintenance Task'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Task Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Frequency</label>
                <select
                  value={formData.frequency_days}
                  onChange={(e) => {
                    const opt = frequencyOptions.find(o => o.days === parseInt(e.target.value))
                    setFormData({
                      ...formData,
                      frequency_days: parseInt(e.target.value),
                      frequency_label: opt?.label || ''
                    })
                  }}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                >
                  {frequencyOptions.map(opt => (
                    <option key={opt.days} value={opt.days}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Manual Due Date (optional)
                </label>
                <input
                  type="date"
                  value={formData.manual_due_date}
                  onChange={(e) => setFormData({ ...formData, manual_due_date: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">Set a specific due date. Clears after completion.</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Last Completed (optional)
                </label>
                <input
                  type="date"
                  value={formData.last_completed}
                  onChange={(e) => setFormData({ ...formData, last_completed: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">When was this last done? Next due will be calculated from here.</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  rows={2}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setEditingTask(null); }}
                  className="flex-1 px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-farm-green rounded-lg hover:bg-farm-green-light"
                >
                  {editingTask ? 'Update' : 'Add Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Modal */}
      {completeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Complete: {completeModal.name}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes (optional)</label>
                <textarea
                  value={completeNotes}
                  onChange={(e) => setCompleteNotes(e.target.value)}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  rows={2}
                  placeholder="Any notes about the work done..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Cost (optional)</label>
                <input
                  type="number"
                  step="0.01"
                  value={completeCost}
                  onChange={(e) => setCompleteCost(e.target.value)}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  placeholder="0.00"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setCompleteModal(null); setCompleteNotes(''); setCompleteCost(''); }}
                  className="flex-1 px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleComplete}
                  className="flex-1 px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500 flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  Complete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default HomeMaintenance
