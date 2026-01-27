import React, { useState, useEffect } from 'react'
import {
  Calendar, ThumbsUp, ThumbsDown, AlertTriangle, Users, User, Settings,
  Plus, Check, ChevronDown, ChevronUp, RefreshCw, X
} from 'lucide-react'
import { getWeekObservations, getCurrentAAR, createAAR, updateAAR, getAARs, createObservation } from '../../services/api'

function WeeklyAARView({ settings, members }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentAAR, setCurrentAAR] = useState(null)
  const [weekObservations, setWeekObservations] = useState([])
  const [pastAARs, setPastAARs] = useState([])
  const [expandedAAR, setExpandedAAR] = useState(null)
  const [editMode, setEditMode] = useState(false)

  // Quick add observation state
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAddType, setQuickAddType] = useState('went_well')
  const [quickAddMember, setQuickAddMember] = useState('')
  const [quickAddContent, setQuickAddContent] = useState('')
  const [quickAddScope, setQuickAddScope] = useState('team')
  const [quickAddSubmitting, setQuickAddSubmitting] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    summary_notes: '',
    action_items: []
  })
  const [newActionItem, setNewActionItem] = useState({ item: '', assigned_to: '' })
  const [saving, setSaving] = useState(false)

  // Get Monday of current week
  const getMondayOfWeek = (date) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.setDate(diff))
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString()
  }

  // Load data function
  const loadData = async () => {
    setLoading(true)
    try {
      const monday = getMondayOfWeek(new Date())
      const dateStr = monday.toISOString().split('T')[0]

      const [aarRes, obsRes, pastRes] = await Promise.all([
        getCurrentAAR(),
        getWeekObservations(dateStr),
        getAARs({ limit: 5 })
      ])

      setCurrentAAR(aarRes.data)
      setWeekObservations(obsRes.data)
      setPastAARs(pastRes.data.filter(a => a.week_start !== aarRes.data?.week_start))

      if (aarRes.data.exists) {
        setFormData({
          summary_notes: aarRes.data.summary_notes || '',
          action_items: aarRes.data.action_items || []
        })
      }
    } catch (err) {
      console.error('Failed to load AAR data:', err)
      setError(err.userMessage || 'Failed to load AAR data')
    } finally {
      setLoading(false)
    }
  }

  // Load data on mount
  useEffect(() => {
    loadData()
  }, [])

  // Handle quick add observation
  const handleQuickAddSubmit = async () => {
    if (!quickAddMember || !quickAddContent.trim()) return

    setQuickAddSubmitting(true)
    try {
      await createObservation(quickAddMember, {
        observation_type: quickAddType,
        content: quickAddContent.trim(),
        scope: quickAddScope
      })
      setQuickAddContent('')
      setShowQuickAdd(false)
      await loadData()
    } catch (err) {
      console.error('Failed to add observation:', err)
    } finally {
      setQuickAddSubmitting(false)
    }
  }

  // Group observations by scope and type
  const groupedObservations = {
    individual: { went_well: [], needs_improvement: [] },
    team: { went_well: [], needs_improvement: [] },
    operations: { went_well: [], needs_improvement: [] }
  }

  weekObservations.forEach(obs => {
    if (groupedObservations[obs.scope]) {
      groupedObservations[obs.scope][obs.observation_type].push(obs)
    }
  })

  const scopeInfo = {
    individual: { icon: User, label: 'Individual', color: 'blue' },
    team: { icon: Users, label: 'Team', color: 'purple' },
    operations: { icon: Settings, label: 'Operations', color: 'orange' }
  }

  // Handle create/update AAR
  const handleSave = async () => {
    setSaving(true)
    try {
      const monday = getMondayOfWeek(new Date())

      if (currentAAR?.exists) {
        await updateAAR(currentAAR.id, formData)
      } else {
        await createAAR({
          week_start: monday.toISOString(),
          ...formData
        })
      }

      // Reload data
      const aarRes = await getCurrentAAR()
      setCurrentAAR(aarRes.data)
      setEditMode(false)
    } catch (err) {
      console.error('Failed to save AAR:', err)
      setError(err.userMessage || 'Failed to save AAR')
    } finally {
      setSaving(false)
    }
  }

  // Handle mark AAR complete
  const handleComplete = async () => {
    if (!currentAAR?.exists) return
    setSaving(true)
    try {
      await updateAAR(currentAAR.id, { is_completed: true })
      const aarRes = await getCurrentAAR()
      setCurrentAAR(aarRes.data)
    } catch (err) {
      console.error('Failed to complete AAR:', err)
    } finally {
      setSaving(false)
    }
  }

  // Handle add action item
  const handleAddActionItem = () => {
    if (!newActionItem.item.trim()) return
    setFormData(prev => ({
      ...prev,
      action_items: [...prev.action_items, { ...newActionItem, completed: false }]
    }))
    setNewActionItem({ item: '', assigned_to: '' })
  }

  // Handle toggle action item complete
  const handleToggleActionItem = (index) => {
    setFormData(prev => ({
      ...prev,
      action_items: prev.action_items.map((item, i) =>
        i === index ? { ...item, completed: !item.completed } : item
      )
    }))
  }

  // Handle remove action item
  const handleRemoveActionItem = (index) => {
    setFormData(prev => ({
      ...prev,
      action_items: prev.action_items.filter((_, i) => i !== index)
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-farm-green" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-200">
        {error}
      </div>
    )
  }

  const monday = getMondayOfWeek(new Date())
  const weekNum = Math.ceil((((new Date() - new Date(new Date().getFullYear(), 0, 1)) / 86400000) + 1) / 7)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-farm-green" />
            Weekly After Action Review
          </h3>
          <p className="text-sm text-gray-400">
            Week {weekNum} · {formatDate(monday)} - {formatDate(new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000))}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowQuickAdd(true)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
          >
            <Plus className="w-4 h-4" />
            Add Observation
          </button>
          {currentAAR?.exists && !currentAAR.is_completed && (
            <button
              onClick={handleComplete}
              disabled={saving}
              className="flex items-center gap-2 px-3 py-2 bg-farm-green text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              Mark Complete
            </button>
          )}
          {currentAAR?.is_completed && (
            <span className="px-3 py-1 bg-green-900/50 text-green-300 rounded text-sm">
              Completed
            </span>
          )}
        </div>
      </div>

      {/* Observations Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(scopeInfo).map(([scope, info]) => {
          const Icon = info.icon
          const obs = groupedObservations[scope]
          return (
            <div key={scope} className="bg-gray-700 rounded-lg p-4">
              <h4 className={`font-medium mb-3 flex items-center gap-2 text-${info.color}-400`}>
                <Icon className="w-4 h-4" />
                {info.label}
              </h4>
              <div className="space-y-4">
                {/* Went Well */}
                <div>
                  <div className="text-sm text-green-400 mb-1 flex items-center gap-1">
                    <ThumbsUp className="w-3 h-3" />
                    Went Well ({obs.went_well.length})
                  </div>
                  {obs.went_well.length > 0 ? (
                    <ul className="text-sm space-y-1">
                      {obs.went_well.map(o => (
                        <li key={o.id} className="text-gray-300">
                          • {o.content}
                          <span className="text-gray-500 text-xs ml-1">- {o.member_name}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">None reported</p>
                  )}
                </div>

                {/* Needs Improvement */}
                <div>
                  <div className="text-sm text-yellow-400 mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Needs Improvement ({obs.needs_improvement.length})
                  </div>
                  {obs.needs_improvement.length > 0 ? (
                    <ul className="text-sm space-y-1">
                      {obs.needs_improvement.map(o => (
                        <li key={o.id} className="text-gray-300">
                          • {o.content}
                          <span className="text-gray-500 text-xs ml-1">- {o.member_name}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">None reported</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* AAR Notes & Action Items */}
      <div className="bg-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium">Summary & Action Items</h4>
          {!editMode && !currentAAR?.is_completed && (
            <button
              onClick={() => setEditMode(true)}
              className="text-sm text-farm-green hover:text-green-400"
            >
              Edit
            </button>
          )}
        </div>

        {editMode ? (
          <div className="space-y-4">
            {/* Summary Notes */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Summary Notes</label>
              <textarea
                value={formData.summary_notes}
                onChange={e => setFormData(prev => ({ ...prev, summary_notes: e.target.value }))}
                rows={4}
                className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                placeholder="Key takeaways from this week's review..."
              />
            </div>

            {/* Action Items */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Action Items</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newActionItem.item}
                  onChange={e => setNewActionItem(prev => ({ ...prev, item: e.target.value }))}
                  placeholder="Action item..."
                  className="flex-1 bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm"
                  onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddActionItem())}
                />
                <select
                  value={newActionItem.assigned_to}
                  onChange={e => setNewActionItem(prev => ({ ...prev, assigned_to: e.target.value }))}
                  className="bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm"
                >
                  <option value="">Unassigned</option>
                  {members.map(m => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddActionItem}
                  className="px-3 py-2 bg-gray-600 rounded hover:bg-gray-500"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                {formData.action_items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-gray-600/50 rounded px-3 py-2">
                    <button
                      type="button"
                      onClick={() => handleToggleActionItem(idx)}
                      className={`w-5 h-5 rounded border ${
                        item.completed
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-500'
                      } flex items-center justify-center`}
                    >
                      {item.completed && <Check className="w-3 h-3" />}
                    </button>
                    <span className={`flex-1 ${item.completed ? 'line-through text-gray-500' : ''}`}>
                      {item.item}
                    </span>
                    {item.assigned_to && (
                      <span className="text-xs text-gray-400 bg-gray-600 px-2 py-0.5 rounded">
                        {item.assigned_to}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveActionItem(idx)}
                      className="text-gray-400 hover:text-red-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditMode(false)}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-farm-green text-white rounded hover:bg-green-600 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Display mode */}
            {formData.summary_notes ? (
              <p className="text-gray-300 mb-4 whitespace-pre-wrap">{formData.summary_notes}</p>
            ) : (
              <p className="text-gray-500 mb-4 italic">No summary notes yet</p>
            )}

            {formData.action_items.length > 0 ? (
              <div className="space-y-2">
                <h5 className="text-sm text-gray-400 mb-2">Action Items ({formData.action_items.filter(i => !i.completed).length} pending)</h5>
                {formData.action_items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    {item.completed ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <div className="w-4 h-4 rounded border border-gray-500" />
                    )}
                    <span className={item.completed ? 'line-through text-gray-500' : ''}>
                      {item.item}
                    </span>
                    {item.assigned_to && (
                      <span className="text-xs text-gray-400">({item.assigned_to})</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm italic">No action items</p>
            )}
          </div>
        )}
      </div>

      {/* Past AARs */}
      {pastAARs.length > 0 && (
        <div>
          <h4 className="font-medium mb-3 text-gray-400">Previous AARs</h4>
          <div className="space-y-2">
            {pastAARs.map(aar => (
              <div key={aar.id} className="bg-gray-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedAAR(expandedAAR === aar.id ? null : aar.id)}
                  className="w-full p-3 text-left flex items-center justify-between hover:bg-gray-600/50"
                >
                  <div>
                    <span className="font-medium">Week {aar.week_number || '?'}</span>
                    <span className="text-gray-400 text-sm ml-2">{formatDate(aar.week_start)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {aar.is_completed && (
                      <span className="text-xs text-green-400">Completed</span>
                    )}
                    {expandedAAR === aar.id ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>
                {expandedAAR === aar.id && (
                  <div className="p-3 border-t border-gray-600">
                    {aar.summary_notes && (
                      <p className="text-sm text-gray-300 mb-2">{aar.summary_notes}</p>
                    )}
                    {aar.action_items && aar.action_items.length > 0 && (
                      <div className="text-sm">
                        <p className="text-gray-400 mb-1">Action Items:</p>
                        <ul className="space-y-1">
                          {aar.action_items.map((item, idx) => (
                            <li key={idx} className="flex items-center gap-2">
                              {item.completed ? (
                                <Check className="w-3 h-3 text-green-500" />
                              ) : (
                                <div className="w-3 h-3 rounded-full border border-gray-500" />
                              )}
                              <span className={item.completed ? 'line-through text-gray-500' : 'text-gray-300'}>
                                {item.item}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Add Observation Modal */}
      {showQuickAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add Observation</h3>

            {/* Type Selection */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setQuickAddType('went_well')}
                className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                  quickAddType === 'went_well'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                <ThumbsUp className="w-4 h-4" />
                Went Well
              </button>
              <button
                onClick={() => setQuickAddType('needs_improvement')}
                className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                  quickAddType === 'needs_improvement'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                <ThumbsDown className="w-4 h-4" />
                Needs Improvement
              </button>
            </div>

            {/* Scope Selection */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">Scope</label>
              <div className="flex gap-2">
                {[
                  { value: 'individual', label: 'Individual', icon: User },
                  { value: 'team', label: 'Team', icon: Users },
                  { value: 'operations', label: 'Operations', icon: Settings }
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setQuickAddScope(value)}
                    className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1 text-sm transition-colors ${
                      quickAddScope === value
                        ? 'bg-farm-green text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Member Selection */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">Who are you?</label>
              <select
                value={quickAddMember}
                onChange={(e) => setQuickAddMember(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              >
                <option value="">Select member...</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.nickname || m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Content */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">
                {quickAddType === 'went_well' ? 'What went well?' : 'What needs improvement?'}
              </label>
              <textarea
                value={quickAddContent}
                onChange={(e) => setQuickAddContent(e.target.value)}
                placeholder="Enter your observation..."
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white resize-none"
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowQuickAdd(false)
                  setQuickAddContent('')
                }}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleQuickAddSubmit}
                disabled={!quickAddMember || !quickAddContent.trim() || quickAddSubmitting}
                className="px-4 py-2 bg-farm-green text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {quickAddSubmitting ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WeeklyAARView
