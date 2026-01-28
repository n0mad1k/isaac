import React, { useState, useEffect } from 'react'
import {
  Target, Plus, Edit, Trash2, ChevronDown, ChevronUp, Check, Clock,
  AlertTriangle, Calendar, X, Play, History
} from 'lucide-react'
import {
  getMemberTraining, createMemberTraining, updateMemberTraining, deleteMemberTraining,
  logTrainingSession, getTrainingHistory
} from '../../services/api'

const TRAINING_CATEGORIES = [
  { value: 'SHOOTING', label: 'Shooting' },
  { value: 'MEDICAL', label: 'Medical' },
  { value: 'COMMS', label: 'Communications' },
  { value: 'NAVIGATION', label: 'Navigation' },
  { value: 'FITNESS', label: 'Fitness' },
  { value: 'DRIVING', label: 'Driving' },
  { value: 'OTHER', label: 'Other' }
]

function MemberTrainingTab({ member, onUpdate }) {
  const [training, setTraining] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddTraining, setShowAddTraining] = useState(false)
  const [editingTraining, setEditingTraining] = useState(null)
  const [showLogSession, setShowLogSession] = useState(null)
  const [showHistory, setShowHistory] = useState(null)
  const [trainingHistory, setTrainingHistory] = useState({})
  const [sortBy, setSortBy] = useState('overdue') // overdue, recent, alpha

  const loadTraining = async () => {
    try {
      setLoading(true)
      const res = await getMemberTraining(member.id)
      setTraining(res.data)
    } catch (err) {
      setError(err.userMessage || 'Failed to load training')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTraining()
  }, [member.id])

  const loadHistory = async (trainingId) => {
    try {
      const res = await getTrainingHistory(member.id, trainingId)
      setTrainingHistory(prev => ({ ...prev, [trainingId]: res.data }))
    } catch (err) {
      console.error('Failed to load history:', err)
    }
  }

  const handleShowHistory = async (trainingId) => {
    if (showHistory === trainingId) {
      setShowHistory(null)
    } else {
      setShowHistory(trainingId)
      if (!trainingHistory[trainingId]) {
        await loadHistory(trainingId)
      }
    }
  }

  const handleDeleteTraining = async (trainingId) => {
    if (!confirm('Delete this training item?')) return
    try {
      await deleteMemberTraining(member.id, trainingId)
      await loadTraining()
    } catch (err) {
      setError(err.userMessage || 'Failed to delete training')
    }
  }

  const handleQuickLog = async (trainingId) => {
    try {
      await logTrainingSession(member.id, trainingId, { notes: 'Quick log' })
      await loadTraining()
    } catch (err) {
      setError(err.userMessage || 'Failed to log session')
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    })
  }

  const getDaysSince = (dateStr) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    const today = new Date()
    return Math.floor((today - date) / (1000 * 60 * 60 * 24))
  }

  const getDaysColor = (days) => {
    if (days === null) return 'text-gray-400'
    if (days <= 30) return 'text-green-400'
    if (days <= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getOverdueStatus = (item) => {
    if (!item.next_due) return null
    const due = new Date(item.next_due)
    const today = new Date()
    const daysUntil = Math.ceil((due - today) / (1000 * 60 * 60 * 24))
    if (daysUntil < 0) return { label: `${Math.abs(daysUntil)} days overdue`, color: 'text-red-400 bg-red-900/50' }
    if (daysUntil <= 7) return { label: `Due in ${daysUntil} days`, color: 'text-yellow-400 bg-yellow-900/50' }
    return null
  }

  // Sort training items
  const sortedTraining = [...training].sort((a, b) => {
    if (sortBy === 'overdue') {
      // Overdue first, then by next_due, then by last_trained
      const aOverdue = a.next_due && new Date(a.next_due) < new Date() ? 1 : 0
      const bOverdue = b.next_due && new Date(b.next_due) < new Date() ? 1 : 0
      if (aOverdue !== bOverdue) return bOverdue - aOverdue

      const aDaysSince = getDaysSince(a.last_trained)
      const bDaysSince = getDaysSince(b.last_trained)
      if (aDaysSince === null && bDaysSince === null) return 0
      if (aDaysSince === null) return -1
      if (bDaysSince === null) return 1
      return bDaysSince - aDaysSince
    }
    if (sortBy === 'recent') {
      const aDate = a.last_trained ? new Date(a.last_trained) : new Date(0)
      const bDate = b.last_trained ? new Date(b.last_trained) : new Date(0)
      return bDate - aDate
    }
    return a.name.localeCompare(b.name)
  })

  if (loading) {
    return <div className="text-center text-gray-400 py-8">Loading training...</div>
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm"
          >
            <option value="overdue">Most Overdue</option>
            <option value="recent">Recently Trained</option>
            <option value="alpha">Alphabetical</option>
          </select>
          <span className="text-sm text-gray-400">{training.length} items</span>
        </div>
        <button
          onClick={() => setShowAddTraining(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-farm-green text-white rounded hover:bg-green-600 text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Training
        </button>
      </div>

      {/* Training List */}
      {sortedTraining.length === 0 ? (
        <div className="bg-gray-700 rounded-lg p-8 text-center text-gray-400">
          <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No training items tracked</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedTraining.map(item => {
            const daysSince = getDaysSince(item.last_trained)
            const overdueStatus = getOverdueStatus(item)

            return (
              <div key={item.id} className="bg-gray-700 rounded-lg overflow-hidden">
                {/* Training Header */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Target className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.name}</span>
                        <span className="px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded text-xs">
                          {item.category}
                        </span>
                        {overdueStatus && (
                          <span className={`px-2 py-0.5 rounded text-xs ${overdueStatus.color}`}>
                            {overdueStatus.label}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400 flex items-center gap-3 mt-1">
                        <span className={getDaysColor(daysSince)}>
                          {daysSince !== null ? (
                            daysSince === 0 ? 'Trained today' : `${daysSince} days ago`
                          ) : 'Never trained'}
                        </span>
                        <span>Sessions: {item.total_sessions || 0}</span>
                        {item.frequency_days && (
                          <span>Every {item.frequency_days} days</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleQuickLog(item.id)}
                      className="p-1.5 text-green-400 hover:text-green-300 bg-green-900/30 rounded"
                      title="Log Training Session"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowLogSession(item)}
                      className="p-1.5 text-gray-400 hover:text-white"
                      title="Log with Details"
                    >
                      <Calendar className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleShowHistory(item.id)}
                      className="p-1.5 text-gray-400 hover:text-white"
                      title="View History"
                    >
                      <History className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingTraining(item)}
                      className="p-1.5 text-gray-400 hover:text-white"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTraining(item.id)}
                      className="p-1.5 text-gray-400 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* History Panel */}
                {showHistory === item.id && (
                  <div className="border-t border-gray-600 p-4 bg-gray-800">
                    <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                      <History className="w-4 h-4" />
                      Training History
                    </h4>
                    {trainingHistory[item.id]?.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {trainingHistory[item.id].map(log => (
                          <div key={log.id} className="text-sm border-l-2 border-gray-600 pl-3">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400">{formatDate(log.trained_at)}</span>
                              {log.duration_minutes && (
                                <span className="text-gray-500">({log.duration_minutes} min)</span>
                              )}
                            </div>
                            {log.notes && <p className="text-gray-300">{log.notes}</p>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">No training history</p>
                    )}
                  </div>
                )}

                {item.description && (
                  <div className="px-4 pb-4 text-sm text-gray-400">
                    {item.description}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit Training Modal */}
      {(showAddTraining || editingTraining) && (
        <TrainingModal
          training={editingTraining}
          memberId={member.id}
          onClose={() => { setShowAddTraining(false); setEditingTraining(null) }}
          onSave={async () => {
            setShowAddTraining(false)
            setEditingTraining(null)
            await loadTraining()
          }}
        />
      )}

      {/* Log Session Modal */}
      {showLogSession && (
        <LogSessionModal
          training={showLogSession}
          memberId={member.id}
          onClose={() => setShowLogSession(null)}
          onSave={async () => {
            setShowLogSession(null)
            await loadTraining()
          }}
        />
      )}
    </div>
  )
}

// Training Modal Component
function TrainingModal({ training, memberId, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: training?.name || '',
    category: training?.category || 'OTHER',
    description: training?.description || '',
    frequency_days: training?.frequency_days || '',
    notes: training?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const data = {
        ...formData,
        frequency_days: formData.frequency_days ? parseInt(formData.frequency_days) : null,
      }
      if (training) {
        await updateMemberTraining(memberId, training.id, data)
      } else {
        await createMemberTraining(memberId, data)
      }
      onSave()
    } catch (err) {
      setError(err.userMessage || 'Failed to save training')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="font-semibold">{training ? 'Edit Training' : 'Add Training'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Pistol Shooting, TCCC Medical"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              >
                {TRAINING_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Frequency (days)</label>
              <input
                type="number"
                value={formData.frequency_days}
                onChange={(e) => setFormData({ ...formData, frequency_days: e.target.value })}
                placeholder="Optional"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              placeholder="Details about the training"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-farm-green text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : training ? 'Save Changes' : 'Add Training'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Log Session Modal Component
function LogSessionModal({ training, memberId, onClose, onSave }) {
  const [formData, setFormData] = useState({
    trained_at: new Date().toISOString().split('T')[0],
    duration_minutes: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const data = {
        trained_at: formData.trained_at ? new Date(formData.trained_at).toISOString() : null,
        duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : null,
        notes: formData.notes || null,
      }
      await logTrainingSession(memberId, training.id, data)
      onSave()
    } catch (err) {
      setError(err.userMessage || 'Failed to log session')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="font-semibold">Log Training Session</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
              {error}
            </div>
          )}
          <div className="text-center pb-2">
            <span className="text-lg font-medium">{training.name}</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Date</label>
              <input
                type="date"
                value={formData.trained_at}
                onChange={(e) => setFormData({ ...formData, trained_at: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Duration (min)</label>
              <input
                type="number"
                value={formData.duration_minutes}
                onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                placeholder="Optional"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="What was practiced, performance notes, etc."
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-farm-green text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Log Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default MemberTrainingTab
