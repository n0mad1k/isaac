import React, { useState } from 'react'
import { Plus, ThumbsUp, AlertTriangle, User, Users, Settings, X } from 'lucide-react'
import { createObservation } from '../../services/api'

function MemberObservationsTab({ member, observations, onUpdate }) {
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    observation_type: 'went_well',
    scope: 'individual',
    content: '',
    linked_value: '',
    linked_goal_category: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.content.trim()) {
      setError('Content is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await createObservation(member.id, formData)
      setFormData({
        observation_type: 'went_well',
        scope: 'individual',
        content: '',
        linked_value: '',
        linked_goal_category: ''
      })
      setShowForm(false)
      onUpdate()
    } catch (err) {
      setError(err.userMessage || 'Failed to add observation')
    } finally {
      setSaving(false)
    }
  }

  // Group observations by week
  const groupedObservations = observations.reduce((groups, obs) => {
    const weekKey = obs.week_start || 'unknown'
    if (!groups[weekKey]) {
      groups[weekKey] = { went_well: [], needs_improvement: [] }
    }
    groups[weekKey][obs.observation_type].push(obs)
    return groups
  }, {})

  const scopeIcons = {
    individual: User,
    team: Users,
    operations: Settings
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Weekly Observations</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-3 py-2 bg-farm-green text-white rounded hover:bg-green-600 text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Observation
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-700 rounded-lg p-4 space-y-4">
          {error && (
            <div className="p-2 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
              {error}
            </div>
          )}

          {/* Type Selection */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="type"
                checked={formData.observation_type === 'went_well'}
                onChange={() => setFormData(prev => ({ ...prev, observation_type: 'went_well' }))}
                className="text-green-500"
              />
              <ThumbsUp className="w-4 h-4 text-green-400" />
              <span className="text-green-400">Went Well</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="type"
                checked={formData.observation_type === 'needs_improvement'}
                onChange={() => setFormData(prev => ({ ...prev, observation_type: 'needs_improvement' }))}
                className="text-yellow-500"
              />
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-400">Needs Improvement</span>
            </label>
          </div>

          {/* Scope Selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Scope</label>
            <div className="flex gap-4">
              {['individual', 'team', 'operations'].map(scope => {
                const Icon = scopeIcons[scope]
                return (
                  <label key={scope} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="scope"
                      checked={formData.scope === scope}
                      onChange={() => setFormData(prev => ({ ...prev, scope }))}
                      className="text-farm-green"
                    />
                    <Icon className="w-4 h-4" />
                    <span className="capitalize">{scope}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Observation</label>
            <textarea
              value={formData.content}
              onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
              rows={3}
              className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
              placeholder={formData.observation_type === 'went_well'
                ? "What went well this week..."
                : "What needs improvement..."
              }
              required
            />
          </div>

          {/* Optional Links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Related Goal Category (optional)</label>
              <select
                value={formData.linked_goal_category}
                onChange={e => setFormData(prev => ({ ...prev, linked_goal_category: e.target.value }))}
                className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
              >
                <option value="">None</option>
                <option value="professional">Professional</option>
                <option value="personal">Personal</option>
                <option value="readiness">Readiness</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Related Value (optional)</label>
              <input
                type="text"
                value={formData.linked_value}
                onChange={e => setFormData(prev => ({ ...prev, linked_value: e.target.value }))}
                placeholder="e.g., Faith, Service"
                className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-farm-green text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add Observation'}
            </button>
          </div>
        </form>
      )}

      {/* Observations List */}
      {Object.keys(groupedObservations).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(groupedObservations)
            .sort((a, b) => new Date(b[0]) - new Date(a[0]))
            .map(([weekStart, weekObs]) => (
              <div key={weekStart} className="bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium mb-3 text-gray-400 text-sm">
                  Week of {formatDate(weekStart)}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Went Well */}
                  <div>
                    <h5 className="text-sm font-medium text-green-400 mb-2 flex items-center gap-1">
                      <ThumbsUp className="w-4 h-4" />
                      What Went Well ({weekObs.went_well.length})
                    </h5>
                    {weekObs.went_well.length > 0 ? (
                      <div className="space-y-2">
                        {weekObs.went_well.map(obs => {
                          const ScopeIcon = scopeIcons[obs.scope]
                          return (
                            <div key={obs.id} className="bg-green-900/20 border border-green-800/30 rounded p-2 text-sm">
                              <div className="flex items-start gap-2">
                                <ScopeIcon className="w-4 h-4 text-gray-400 mt-0.5" />
                                <div className="flex-1">
                                  <p className="text-gray-200">{obs.content}</p>
                                  {(obs.linked_value || obs.linked_goal_category) && (
                                    <div className="mt-1 text-xs text-gray-400">
                                      {obs.linked_goal_category && <span className="mr-2">#{obs.linked_goal_category}</span>}
                                      {obs.linked_value && <span>#{obs.linked_value}</span>}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No entries</p>
                    )}
                  </div>

                  {/* Needs Improvement */}
                  <div>
                    <h5 className="text-sm font-medium text-yellow-400 mb-2 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      Needs Improvement ({weekObs.needs_improvement.length})
                    </h5>
                    {weekObs.needs_improvement.length > 0 ? (
                      <div className="space-y-2">
                        {weekObs.needs_improvement.map(obs => {
                          const ScopeIcon = scopeIcons[obs.scope]
                          return (
                            <div key={obs.id} className="bg-yellow-900/20 border border-yellow-800/30 rounded p-2 text-sm">
                              <div className="flex items-start gap-2">
                                <ScopeIcon className="w-4 h-4 text-gray-400 mt-0.5" />
                                <div className="flex-1">
                                  <p className="text-gray-200">{obs.content}</p>
                                  {(obs.linked_value || obs.linked_goal_category) && (
                                    <div className="mt-1 text-xs text-gray-400">
                                      {obs.linked_goal_category && <span className="mr-2">#{obs.linked_goal_category}</span>}
                                      {obs.linked_value && <span>#{obs.linked_value}</span>}
                                    </div>
                                  )}
                                  {obs.discussed_in_aar && (
                                    <div className="mt-1 text-xs text-blue-400">
                                      Discussed in AAR
                                      {obs.action_item && ` - Action: ${obs.action_item}`}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No entries</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400">
          <ThumbsUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No observations recorded yet</p>
          <p className="text-sm">Track what went well and what needs improvement each week</p>
        </div>
      )}
    </div>
  )
}

export default MemberObservationsTab
