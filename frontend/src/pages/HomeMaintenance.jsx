import React, { useState, useEffect, useCallback } from 'react'
import { Home, Plus, Check, Clock, AlertTriangle, ChevronDown, ChevronUp, X, Wrench, Calendar, Droplets, Zap, Wind, Flame, Car, Waves, ShieldCheck, Settings, Snowflake, Fan, Thermometer, Trash2, Lightbulb, Gauge, Box, Shirt, Server } from 'lucide-react'
import { getHomeMaintenance, createHomeMaintenance, updateHomeMaintenance, deleteHomeMaintenance, completeHomeMaintenance, getHomeMaintenanceCategories } from '../services/api'
import MottoDisplay from '../components/MottoDisplay'
import { format, formatDistanceToNow } from 'date-fns'

// Available icons for category selection - using CSS variable compatible styles
const AVAILABLE_ICONS = {
  Waves: { icon: Waves, label: 'Pool/Water', colorVar: '--color-teal-600', bgColorVar: '--color-teal-100' },
  Wind: { icon: Wind, label: 'A/C / HVAC', colorVar: '--color-info-600', bgColorVar: '--color-info-bg' },
  Flame: { icon: Flame, label: 'Heating / Water Heater', colorVar: '--color-warning-600', bgColorVar: '--color-warning-bg' },
  Car: { icon: Car, label: 'Garage / Vehicles', colorVar: '--color-text-secondary', bgColorVar: '--color-bg-surface-muted' },
  Droplets: { icon: Droplets, label: 'Plumbing', colorVar: '--color-teal-600', bgColorVar: '--color-teal-100' },
  Zap: { icon: Zap, label: 'Electrical', colorVar: '--color-gold-600', bgColorVar: '--color-gold-100' },
  ShieldCheck: { icon: ShieldCheck, label: 'Safety', colorVar: '--color-error-600', bgColorVar: '--color-error-bg' },
  Snowflake: { icon: Snowflake, label: 'Refrigerator/Freezer', colorVar: '--color-info-600', bgColorVar: '--color-info-bg' },
  Fan: { icon: Fan, label: 'Ventilation', colorVar: '--color-text-muted', bgColorVar: '--color-bg-surface-muted' },
  Thermometer: { icon: Thermometer, label: 'Temperature', colorVar: '--color-warning-600', bgColorVar: '--color-warning-bg' },
  Trash2: { icon: Trash2, label: 'Waste / Septic', colorVar: '--color-gold-700', bgColorVar: '--color-gold-100' },
  Shirt: { icon: Shirt, label: 'Laundry', colorVar: '--color-info-600', bgColorVar: '--color-info-bg' },
  Lightbulb: { icon: Lightbulb, label: 'Lighting', colorVar: '--color-gold-500', bgColorVar: '--color-gold-100' },
  Gauge: { icon: Gauge, label: 'Meters / Gauges', colorVar: '--color-green-600', bgColorVar: '--color-green-100' },
  Home: { icon: Home, label: 'General Home', colorVar: '--color-green-600', bgColorVar: '--color-green-100' },
  Box: { icon: Box, label: 'Storage', colorVar: '--color-text-muted', bgColorVar: '--color-bg-surface-muted' },
  Server: { icon: Server, label: 'Appliances', colorVar: '--color-badge-purple-bg', bgColorVar: '--color-bg-surface-muted' },
  Wrench: { icon: Wrench, label: 'Tools / General', colorVar: '--color-text-muted', bgColorVar: '--color-bg-surface-muted' },
  Settings: { icon: Settings, label: 'General', colorVar: '--color-text-muted', bgColorVar: '--color-bg-surface-muted' },
}

const STATUS_COLORS = {
  ok: '--color-success-600',
  due_soon: '--color-warning-600',
  overdue: '--color-error-600',
  unknown: '--color-text-muted',
}

function HomeMaintenance() {
  const [tasks, setTasks] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [collapsedCategories, setCollapsedCategories] = useState(new Set())
  const [completeModal, setCompleteModal] = useState(null)
  const [completeNotes, setCompleteNotes] = useState('')
  const [completeCost, setCompleteCost] = useState('')
  const [useCustomFreq, setUseCustomFreq] = useState(false)
  const [customFreqDays, setCustomFreqDays] = useState('')
  const [useCustomCategory, setUseCustomCategory] = useState(false)
  const [customCategoryName, setCustomCategoryName] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    category_icon: '',  // Stores the icon for the category
    description: '',
    frequency_days: 30,
    frequency_label: 'Monthly',
    last_completed: '',
    manual_due_date: '',
    notes: '',
    reminder_alerts: null,
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
    { days: 'custom', label: 'Custom...' },
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
      const freqDays = useCustomFreq ? parseInt(customFreqDays) : formData.frequency_days
      const freqLabel = useCustomFreq ? `Every ${customFreqDays} days` : formData.frequency_label

      const data = {
        name: formData.name,
        category: formData.category,
        area_icon: formData.category_icon || null,  // Store icon in area_icon field on backend
        description: formData.description || null,
        frequency_days: freqDays || null,
        frequency_label: freqLabel,
        last_completed: formData.last_completed ? new Date(formData.last_completed).toISOString() : null,
        manual_due_date: formData.manual_due_date ? new Date(formData.manual_due_date).toISOString() : null,
        notes: formData.notes || null,
        reminder_alerts: formData.reminder_alerts || null,
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
      category: '',
      category_icon: '',
      description: '',
      frequency_days: 30,
      frequency_label: 'Monthly',
      last_completed: '',
      manual_due_date: '',
      notes: '',
      reminder_alerts: null,
    })
    setUseCustomFreq(false)
    setCustomFreqDays('')
    setUseCustomCategory(false)
    setCustomCategoryName('')
  }

  const startEdit = (task) => {
    setEditingTask(task)
    // Check if frequency is a custom value
    const isCustomFreq = !frequencyOptions.slice(0, -1).some(opt => opt.days === task.frequency_days)
    setUseCustomFreq(isCustomFreq)
    if (isCustomFreq) {
      setCustomFreqDays(task.frequency_days?.toString() || '')
    }
    // Check if category is a custom value (not in categories list)
    const isCustomCat = task.category && !categories.some(cat => cat.value === task.category)
    setUseCustomCategory(isCustomCat)
    if (isCustomCat) {
      setCustomCategoryName(task.category)
    }
    setFormData({
      name: task.name,
      category: task.category,
      category_icon: task.area_icon || '',  // Backend stores in area_icon field
      description: task.description || '',
      frequency_days: isCustomFreq ? 30 : task.frequency_days,
      frequency_label: task.frequency_label || '',
      last_completed: task.last_completed ? format(new Date(task.last_completed), 'yyyy-MM-dd') : '',
      manual_due_date: task.manual_due_date ? format(new Date(task.manual_due_date), 'yyyy-MM-dd') : '',
      notes: task.notes || '',
      reminder_alerts: task.reminder_alerts || null,
    })
    setShowAddForm(true)
  }

  // Group tasks by category (fall back to "Uncategorized" if no category set)
  const groupedTasks = tasks.reduce((acc, task) => {
    const category = task.category || 'uncategorized'
    if (!acc[category]) acc[category] = []
    acc[category].push(task)
    return acc
  }, {})

  // Sort categories: ones with overdue first, then due_soon, then alphabetically
  const sortedCategories = Object.keys(groupedTasks).sort((a, b) => {
    const aOverdue = groupedTasks[a].filter(t => t.status === 'overdue').length
    const bOverdue = groupedTasks[b].filter(t => t.status === 'overdue').length
    const aDueSoon = groupedTasks[a].filter(t => t.status === 'due_soon').length
    const bDueSoon = groupedTasks[b].filter(t => t.status === 'due_soon').length

    if (aOverdue !== bOverdue) return bOverdue - aOverdue
    if (aDueSoon !== bDueSoon) return bDueSoon - aDueSoon
    return a.localeCompare(b)
  })

  // Count status for each category
  const getCategoryStats = (categoryTasks) => {
    const overdue = categoryTasks.filter(t => t.status === 'overdue').length
    const dueSoon = categoryTasks.filter(t => t.status === 'due_soon').length
    return { overdue, dueSoon, total: categoryTasks.length }
  }

  // Get icon and color for a category - checks saved icon first, then falls back to auto-detect
  const getCategoryConfig = (category, savedIcon = null) => {
    // If a saved icon exists, use it
    if (savedIcon && AVAILABLE_ICONS[savedIcon]) {
      const iconConfig = AVAILABLE_ICONS[savedIcon]
      return {
        icon: iconConfig.icon,
        colorVar: iconConfig.colorVar,
        bgColorVar: iconConfig.bgColorVar
      }
    }
    // Check for keyword matches in category name
    const catLower = category.toLowerCase()
    if (catLower.includes('pool') || catLower.includes('water')) return { icon: Waves, colorVar: '--color-teal-600', bgColorVar: '--color-teal-100' }
    if (catLower.includes('hvac') || catLower.includes('a/c') || catLower.includes('air')) return { icon: Wind, colorVar: '--color-info-600', bgColorVar: '--color-info-bg' }
    if (catLower.includes('heat') || catLower.includes('water heater')) return { icon: Flame, colorVar: '--color-warning-600', bgColorVar: '--color-warning-bg' }
    if (catLower.includes('garage') || catLower.includes('vehicle')) return { icon: Car, colorVar: '--color-text-secondary', bgColorVar: '--color-bg-surface-muted' }
    if (catLower.includes('plumb')) return { icon: Droplets, colorVar: '--color-teal-600', bgColorVar: '--color-teal-100' }
    if (catLower.includes('electric')) return { icon: Zap, colorVar: '--color-gold-600', bgColorVar: '--color-gold-100' }
    if (catLower.includes('safety') || catLower.includes('smoke') || catLower.includes('fire')) return { icon: ShieldCheck, colorVar: '--color-error-600', bgColorVar: '--color-error-bg' }
    if (catLower.includes('appliance') || catLower.includes('dishwasher') || catLower.includes('fridge')) return { icon: Server, colorVar: '--color-text-secondary', bgColorVar: '--color-bg-surface-muted' }
    if (catLower.includes('exterior') || catLower.includes('roof') || catLower.includes('gutter')) return { icon: Home, colorVar: '--color-green-600', bgColorVar: '--color-green-100' }
    if (catLower.includes('septic') || catLower.includes('waste')) return { icon: Trash2, colorVar: '--color-gold-700', bgColorVar: '--color-gold-100' }
    if (catLower.includes('laundry')) return { icon: Shirt, colorVar: '--color-info-600', bgColorVar: '--color-info-bg' }
    // Default
    return { icon: Wrench, colorVar: '--color-text-muted', bgColorVar: '--color-bg-surface-muted' }
  }

  // Get the first task's saved icon for a category group
  const getCategorySavedIcon = (categoryTasks) => {
    const taskWithIcon = categoryTasks.find(t => t.area_icon)
    return taskWithIcon?.area_icon || null
  }

  // Format category name for display
  const formatCategoryName = (category) => {
    return category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--color-green-600)' }}></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Home className="w-8 h-8" style={{ color: 'var(--color-green-600)' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Home Maintenance</h1>
        </div>
        <MottoDisplay className="" />
        <button
          onClick={() => { setShowAddForm(true); setEditingTask(null); resetForm(); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
          style={{ backgroundColor: 'var(--color-green-600)', color: '#ffffff' }}
        >
          <Plus className="w-5 h-5" />
          Add Task
        </button>
      </div>

      {error && (
        <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--color-error-bg)', border: '1px solid var(--color-error-600)', color: 'var(--color-error-600)' }}>
          {error}
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{tasks.length}</div>
          <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Total Tasks</div>
        </div>
        <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="text-2xl font-bold" style={{ color: 'var(--color-success-600)' }}>
            {tasks.filter(t => t.status === 'ok').length}
          </div>
          <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Up to Date</div>
        </div>
        <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="text-2xl font-bold" style={{ color: 'var(--color-warning-600)' }}>
            {tasks.filter(t => t.status === 'due_soon').length}
          </div>
          <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Due Soon</div>
        </div>
        <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="text-2xl font-bold" style={{ color: 'var(--color-error-600)' }}>
            {tasks.filter(t => t.status === 'overdue').length}
          </div>
          <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Overdue</div>
        </div>
      </div>

      {/* Tasks by Category */}
      <div className="space-y-3">
        {sortedCategories.map((category) => {
          const categoryTasks = groupedTasks[category]
          const stats = getCategoryStats(categoryTasks)
          const isExpanded = !collapsedCategories.has(category)
          const savedIcon = getCategorySavedIcon(categoryTasks)
          const categoryConfig = getCategoryConfig(category, savedIcon)
          const CategoryIcon = categoryConfig.icon

          const toggleCategory = () => {
            const newCollapsed = new Set(collapsedCategories)
            if (newCollapsed.has(category)) {
              newCollapsed.delete(category)
            } else {
              newCollapsed.add(category)
            }
            setCollapsedCategories(newCollapsed)
          }

          return (
            <div key={category} className="rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
              {/* Category Header */}
              <button
                onClick={toggleCategory}
                className="w-full flex items-center justify-between p-4"
                style={{ color: 'var(--color-text-primary)' }}
              >
                <div className="flex items-center gap-3">
                  <span className="p-2 rounded-lg" style={{ backgroundColor: `var(${categoryConfig.bgColorVar})`, color: `var(${categoryConfig.colorVar})`, border: `1px solid var(${categoryConfig.colorVar})` }}>
                    <CategoryIcon className="w-5 h-5" />
                  </span>
                  <span className="font-medium text-lg">{formatCategoryName(category)}</span>
                  <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>({stats.total} tasks)</span>
                  {stats.overdue > 0 && (
                    <span className="px-2 py-0.5 text-sm rounded-full" style={{ backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error-600)' }}>
                      {stats.overdue} overdue
                    </span>
                  )}
                  {stats.dueSoon > 0 && stats.overdue === 0 && (
                    <span className="px-2 py-0.5 text-sm rounded-full" style={{ backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning-600)' }}>
                      {stats.dueSoon} due soon
                    </span>
                  )}
                </div>
                {isExpanded ? <ChevronUp className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} /> : <ChevronDown className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />}
              </button>

              {/* Tasks List */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                  {categoryTasks.map(task => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-4"
                      style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{
                            backgroundColor: task.status === 'overdue' ? 'var(--color-error-600)' :
                              task.status === 'due_soon' ? 'var(--color-warning-600)' : 'var(--color-success-600)'
                          }}></span>
                          <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{task.name}</span>
                        </div>
                        <div className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                          {task.frequency_label || (task.frequency_days ? `Every ${task.frequency_days} days` : 'One-time')}
                          {task.last_completed && (
                            <span className="ml-2">
                              | Last: {formatDistanceToNow(new Date(task.last_completed), { addSuffix: true })}
                            </span>
                          )}
                          {task.next_due && (
                            <span className="ml-2" style={{ color: `var(${STATUS_COLORS[task.status]})` }}>
                              | Next: {format(new Date(task.next_due), 'MMM d')}
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <div className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>{task.description}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCompleteModal(task)}
                          className="p-2 rounded-lg transition-colors"
                          style={{ color: 'var(--color-success-600)' }}
                          title="Mark Complete"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => startEdit(task)}
                          className="p-2 rounded-lg transition-colors"
                          style={{ color: 'var(--color-info-600)' }}
                          title="Edit"
                        >
                          <Wrench className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="p-2 rounded-lg transition-colors"
                          style={{ color: 'var(--color-error-600)' }}
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
          <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
            <Home className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No maintenance tasks yet. Add one to get started!</p>
          </div>
        )}
      </div>

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              {editingTask ? 'Edit Task' : 'Add Maintenance Task'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Task Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg px-4 py-2"
                  style={{ backgroundColor: 'var(--color-input-bg)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
                  required
                  placeholder="e.g., Replace filter, Check pressure"
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Category <span style={{ color: 'var(--color-error-600)' }}>*</span></label>
                <select
                  value={useCustomCategory ? 'custom' : formData.category}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      setUseCustomCategory(true)
                      setCustomCategoryName('')
                      setFormData({ ...formData, category: '' })
                    } else {
                      setUseCustomCategory(false)
                      setFormData({ ...formData, category: e.target.value })
                    }
                  }}
                  className="w-full rounded-lg px-4 py-2"
                  style={{ backgroundColor: 'var(--color-input-bg)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
                  required={!useCustomCategory}
                >
                  <option value="">Select a category...</option>
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                  <option value="custom">+ Add New Category</option>
                </select>
                {useCustomCategory && (
                  <input
                    type="text"
                    value={customCategoryName}
                    onChange={(e) => {
                      const value = e.target.value.toLowerCase().replace(/\s+/g, '_')
                      setCustomCategoryName(e.target.value)
                      setFormData({ ...formData, category: value })
                    }}
                    className="w-full rounded-lg px-4 py-2 mt-2"
                    style={{ backgroundColor: 'var(--color-input-bg)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
                    placeholder="Enter new category name..."
                    required
                  />
                )}
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Category Icon</label>
                <div className="grid grid-cols-6 gap-2">
                  {Object.entries(AVAILABLE_ICONS).map(([name, config]) => {
                    const IconComponent = config.icon
                    const isSelected = formData.category_icon === name
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setFormData({ ...formData, category_icon: isSelected ? '' : name })}
                        className="p-2 rounded-lg border-2 transition-all"
                        style={{
                          borderColor: isSelected ? 'var(--color-green-600)' : 'var(--color-border-default)',
                          backgroundColor: isSelected ? 'var(--color-green-100)' : 'transparent',
                          color: isSelected ? `var(${config.colorVar})` : 'var(--color-text-muted)'
                        }}
                        title={config.label}
                      >
                        <IconComponent className="w-5 h-5 mx-auto" />
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Select an icon for this category (optional, auto-detected if not set)</p>
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Frequency</label>
                <select
                  value={useCustomFreq ? 'custom' : formData.frequency_days}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      setUseCustomFreq(true)
                    } else {
                      setUseCustomFreq(false)
                      const opt = frequencyOptions.find(o => o.days === parseInt(e.target.value))
                      setFormData({
                        ...formData,
                        frequency_days: parseInt(e.target.value),
                        frequency_label: opt?.label || ''
                      })
                    }
                  }}
                  className="w-full rounded-lg px-4 py-2"
                  style={{ backgroundColor: 'var(--color-input-bg)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
                >
                  {frequencyOptions.map(opt => (
                    <option key={opt.days} value={opt.days}>{opt.label}</option>
                  ))}
                </select>
                {useCustomFreq && (
                  <div className="mt-2">
                    <input
                      type="number"
                      value={customFreqDays}
                      onChange={(e) => setCustomFreqDays(e.target.value)}
                      className="w-full rounded-lg px-4 py-2"
                      style={{ backgroundColor: 'var(--color-input-bg)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
                      placeholder="Number of days"
                      min="1"
                      max="3650"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm mb-1 flex items-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
                  <Calendar className="w-4 h-4" />
                  Manual Due Date (optional)
                </label>
                <input
                  type="date"
                  value={formData.manual_due_date}
                  onChange={(e) => setFormData({ ...formData, manual_due_date: e.target.value })}
                  className="w-full rounded-lg px-4 py-2"
                  style={{ backgroundColor: 'var(--color-input-bg)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Set a specific due date. Clears after completion.</p>
              </div>
              <div>
                <label className="block text-sm mb-1 flex items-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
                  <Clock className="w-4 h-4" />
                  Last Completed (optional)
                </label>
                <input
                  type="date"
                  value={formData.last_completed}
                  onChange={(e) => setFormData({ ...formData, last_completed: e.target.value })}
                  className="w-full rounded-lg px-4 py-2"
                  style={{ backgroundColor: 'var(--color-input-bg)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>When was this last done? Next due will be calculated from here.</p>
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-lg px-4 py-2"
                  style={{ backgroundColor: 'var(--color-input-bg)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-lg px-4 py-2"
                  style={{ backgroundColor: 'var(--color-input-bg)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
                  rows={2}
                />
              </div>
              {/* Alerts Section */}
              <div className="space-y-2 pt-3" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                <label className="block text-sm mb-2" style={{ color: 'var(--color-text-muted)' }}>Alerts (optional)</label>
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
                    const isSelected = (formData.reminder_alerts || []).includes(opt.value)
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          const current = formData.reminder_alerts || []
                          const newAlerts = isSelected
                            ? current.filter(v => v !== opt.value)
                            : [...current, opt.value].sort((a, b) => b - a)
                          setFormData({ ...formData, reminder_alerts: newAlerts.length > 0 ? newAlerts : null })
                        }}
                        className="px-2 py-1 rounded text-xs font-medium transition-all"
                        style={{
                          backgroundColor: isSelected ? 'var(--color-teal-100)' : 'var(--color-bg-surface-muted)',
                          border: isSelected ? '1px solid var(--color-teal-600)' : '1px solid var(--color-border-default)',
                          color: isSelected ? 'var(--color-teal-700)' : 'var(--color-text-muted)'
                        }}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setEditingTask(null); resetForm(); }}
                  className="flex-1 px-4 py-2 rounded-lg transition-colors"
                  style={{ backgroundColor: 'var(--color-bg-surface-muted)', color: 'var(--color-text-primary)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-lg transition-colors"
                  style={{ backgroundColor: 'var(--color-green-600)', color: '#ffffff' }}
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
          <div className="rounded-lg p-6 w-full max-w-md" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>Complete: {completeModal.name}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Notes (optional)</label>
                <textarea
                  value={completeNotes}
                  onChange={(e) => setCompleteNotes(e.target.value)}
                  className="w-full rounded-lg px-4 py-2"
                  style={{ backgroundColor: 'var(--color-input-bg)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
                  rows={2}
                  placeholder="Any notes about the work done..."
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Cost (optional)</label>
                <input
                  type="number"
                  step="0.01"
                  value={completeCost}
                  onChange={(e) => setCompleteCost(e.target.value)}
                  className="w-full rounded-lg px-4 py-2"
                  style={{ backgroundColor: 'var(--color-input-bg)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
                  placeholder="0.00"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setCompleteModal(null); setCompleteNotes(''); setCompleteCost(''); }}
                  className="flex-1 px-4 py-2 rounded-lg transition-colors"
                  style={{ backgroundColor: 'var(--color-bg-surface-muted)', color: 'var(--color-text-primary)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleComplete}
                  className="flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                  style={{ backgroundColor: 'var(--color-success-600)', color: '#ffffff' }}
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
