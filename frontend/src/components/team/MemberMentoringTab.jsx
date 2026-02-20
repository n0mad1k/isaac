import React, { useState } from 'react'
import {
  Plus, Brain, Target, User, Briefcase, Heart, Shield,
  ChevronDown, ChevronUp, CheckCircle, Clock, X, Edit
} from 'lucide-react'
import { createMentoringSession, updateMentoringSession } from '../../services/api'

function MemberMentoringTab({ member, sessions, settings, onUpdate }) {
  const [showForm, setShowForm] = useState(false)
  const [editingSession, setEditingSession] = useState(null)
  const [expandedSession, setExpandedSession] = useState(null)
  const [showArchived, setShowArchived] = useState(false)

  // Separate archived and recent sessions
  const recentSessions = sessions.filter(s => !s.is_archived)
  const archivedSessions = sessions.filter(s => s.is_archived)

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    })
  }

  // Session form component
  const SessionForm = ({ session, onClose, onSave }) => {
    const [formData, setFormData] = useState({
      session_date: session?.session_date ? new Date(session.session_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      week_number: session?.week_number || getWeekNumber(new Date()),
      previous_goals_met: session?.previous_goals_met || null,
      previous_goals_review: session?.previous_goals_review || '',
      professional_goals: session?.professional_goals || [],
      personal_goals: session?.personal_goals || [],
      readiness_goals: session?.readiness_goals || [],
      values_assessment: session?.values_assessment || {},
      positive_observations: session?.positive_observations || '',
      areas_for_improvement: session?.areas_for_improvement || '',
      mentor_notes: session?.mentor_notes || '',
      member_notes: session?.member_notes || '',
      action_items: session?.action_items || [],
    })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    // Temporary inputs
    const [newGoals, setNewGoals] = useState({ professional: '', personal: '', readiness: '' })
    const [newActionItem, setNewActionItem] = useState('')

    function getWeekNumber(date) {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
      const dayNum = d.getUTCDay() || 7
      d.setUTCDate(d.getUTCDate() + 4 - dayNum)
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
      return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
    }

    const handleAddGoal = (category) => {
      const goal = newGoals[category]
      if (!goal.trim()) return
      setFormData(prev => ({
        ...prev,
        [`${category}_goals`]: [...prev[`${category}_goals`], { goal, status: 'pending', notes: '' }]
      }))
      setNewGoals(prev => ({ ...prev, [category]: '' }))
    }

    const handleRemoveGoal = (category, index) => {
      setFormData(prev => ({
        ...prev,
        [`${category}_goals`]: prev[`${category}_goals`].filter((_, i) => i !== index)
      }))
    }

    const handleValueRating = (valueName, rating) => {
      setFormData(prev => ({
        ...prev,
        values_assessment: {
          ...prev.values_assessment,
          [valueName]: { ...prev.values_assessment[valueName], rating }
        }
      }))
    }

    const handleValueNotes = (valueName, notes) => {
      setFormData(prev => ({
        ...prev,
        values_assessment: {
          ...prev.values_assessment,
          [valueName]: { ...prev.values_assessment[valueName], notes }
        }
      }))
    }

    const handleAddActionItem = () => {
      if (!newActionItem.trim()) return
      setFormData(prev => ({
        ...prev,
        action_items: [...prev.action_items, { item: newActionItem, due: null, completed: false }]
      }))
      setNewActionItem('')
    }

    const handleSubmit = async () => {
      setSaving(true)
      setError(null)
      try {
        const data = {
          ...formData,
          session_date: new Date(formData.session_date).toISOString(),
        }

        if (session) {
          await updateMentoringSession(member.id, session.id, data)
        } else {
          await createMentoringSession(member.id, data)
        }
        onSave()
        onClose()
      } catch (err) {
        setError(err.userMessage || 'Failed to save session')
      } finally {
        setSaving(false)
      }
    }

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-surface rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-subtle">
            <h3 className="font-semibold text-lg">
              {session ? 'Edit Mentoring Session' : 'New Mentoring Session'} - {member.name}
            </h3>
            <button onClick={onClose} className="text-muted hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {error && (
              <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
                {error}
              </div>
            )}

            {/* Session Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted mb-1">Session Date</label>
                <input
                  type="date"
                  value={formData.session_date}
                  onChange={e => setFormData(prev => ({ ...prev, session_date: e.target.value }))}
                  className="w-full bg-surface-soft border border rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Week Number</label>
                <input
                  type="number"
                  value={formData.week_number}
                  onChange={e => setFormData(prev => ({ ...prev, week_number: parseInt(e.target.value) }))}
                  className="w-full bg-surface-soft border border rounded px-3 py-2 text-white"
                />
              </div>
            </div>

            {/* Previous Goals Review */}
            {sessions.length > 0 && (
              <div className="bg-surface-soft rounded-lg p-4">
                <h4 className="font-medium mb-3">Previous Goals Review</h4>
                <div className="mb-3">
                  <label className="block text-sm text-muted mb-1">Did member meet previous goals?</label>
                  <div className="flex gap-4">
                    {['YES', 'PARTIAL', 'NO'].map(option => (
                      <label key={option} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="previous_goals_met"
                          checked={formData.previous_goals_met === option}
                          onChange={() => setFormData(prev => ({ ...prev, previous_goals_met: option }))}
                          className="text-farm-green"
                        />
                        <span className="text-sm">{option}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-muted mb-1">Notes on Previous Goals</label>
                  <textarea
                    value={formData.previous_goals_review}
                    onChange={e => setFormData(prev => ({ ...prev, previous_goals_review: e.target.value }))}
                    rows={2}
                    className="w-full bg-surface-hover border border-strong rounded px-3 py-2 text-white"
                  />
                </div>
              </div>
            )}

            {/* Goals - Three Categories */}
            <div className="space-y-4">
              <h4 className="font-medium">Goals for This Week</h4>

              {/* Professional Goals */}
              <div className="bg-surface-soft rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase className="w-4 h-4 text-blue-400" />
                  <span className="font-medium">Professional Goals</span>
                  <span className="text-xs text-muted">(career, leadership, job skills)</span>
                </div>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newGoals.professional}
                    onChange={e => setNewGoals(prev => ({ ...prev, professional: e.target.value }))}
                    placeholder="Add professional goal..."
                    className="flex-1 bg-surface-hover border border-strong rounded px-3 py-2 text-white text-sm"
                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddGoal('professional'))}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddGoal('professional')}
                    className="px-3 py-2 bg-surface-hover rounded hover:bg-surface-muted"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1">
                  {formData.professional_goals.map((g, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm bg-surface-hover/50 rounded px-2 py-1">
                      <span className="flex-1">{g.goal}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveGoal('professional', idx)}
                        className="text-muted hover:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Personal Goals */}
              <div className="bg-surface-soft rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-4 h-4 text-pink-400" />
                  <span className="font-medium">Personal Goals</span>
                  <span className="text-xs text-muted">(family, health, spiritual, hobbies)</span>
                </div>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newGoals.personal}
                    onChange={e => setNewGoals(prev => ({ ...prev, personal: e.target.value }))}
                    placeholder="Add personal goal..."
                    className="flex-1 bg-surface-hover border border-strong rounded px-3 py-2 text-white text-sm"
                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddGoal('personal'))}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddGoal('personal')}
                    className="px-3 py-2 bg-surface-hover rounded hover:bg-surface-muted"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1">
                  {formData.personal_goals.map((g, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm bg-surface-hover/50 rounded px-2 py-1">
                      <span className="flex-1">{g.goal}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveGoal('personal', idx)}
                        className="text-muted hover:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Readiness Goals */}
              <div className="bg-surface-soft rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-green-400" />
                  <span className="font-medium">Readiness Goals</span>
                  <span className="text-xs text-muted">(training, fitness, certifications)</span>
                </div>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newGoals.readiness}
                    onChange={e => setNewGoals(prev => ({ ...prev, readiness: e.target.value }))}
                    placeholder="Add readiness goal..."
                    className="flex-1 bg-surface-hover border border-strong rounded px-3 py-2 text-white text-sm"
                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddGoal('readiness'))}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddGoal('readiness')}
                    className="px-3 py-2 bg-surface-hover rounded hover:bg-surface-muted"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1">
                  {formData.readiness_goals.map((g, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm bg-surface-hover/50 rounded px-2 py-1">
                      <span className="flex-1">{g.goal}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveGoal('readiness', idx)}
                        className="text-muted hover:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Values Assessment */}
            {settings?.team_values && settings.team_values.length > 0 && (
              <div className="bg-surface-soft rounded-lg p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4 text-farm-green" />
                  Values Alignment Assessment
                </h4>
                <div className="space-y-4">
                  {settings.team_values.map(value => (
                    <div key={value.name} className="border-b border pb-4 last:border-0 last:pb-0">
                      <div className="font-medium mb-1">{value.name}</div>
                      <p className="text-xs text-muted mb-2">{value.description}</p>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm text-muted">Rating:</span>
                        {[1, 2, 3, 4, 5].map(rating => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => handleValueRating(value.name, rating)}
                            className={`w-8 h-8 rounded ${
                              formData.values_assessment[value.name]?.rating === rating
                                ? 'bg-farm-green text-white'
                                : 'bg-surface-hover hover:bg-surface-muted'
                            }`}
                          >
                            {rating}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        placeholder="Notes..."
                        value={formData.values_assessment[value.name]?.notes || ''}
                        onChange={e => handleValueNotes(value.name, e.target.value)}
                        className="w-full bg-surface-hover border border-strong rounded px-3 py-1 text-white text-sm"
                      />
                      {value.questions && value.questions.length > 0 && (
                        <div className="mt-2 text-xs text-muted">
                          <p className="mb-1">Questions to consider:</p>
                          <ul className="list-disc list-inside">
                            {value.questions.map((q, idx) => (
                              <li key={idx}>{q}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Observations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted mb-1">Positive Observations</label>
                <textarea
                  value={formData.positive_observations}
                  onChange={e => setFormData(prev => ({ ...prev, positive_observations: e.target.value }))}
                  rows={3}
                  className="w-full bg-surface-soft border border rounded px-3 py-2 text-white"
                  placeholder="Things going well..."
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Areas for Improvement</label>
                <textarea
                  value={formData.areas_for_improvement}
                  onChange={e => setFormData(prev => ({ ...prev, areas_for_improvement: e.target.value }))}
                  rows={3}
                  className="w-full bg-surface-soft border border rounded px-3 py-2 text-white"
                  placeholder="Areas needing work..."
                />
              </div>
            </div>

            {/* Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted mb-1">Mentor Notes (Private)</label>
                <textarea
                  value={formData.mentor_notes}
                  onChange={e => setFormData(prev => ({ ...prev, mentor_notes: e.target.value }))}
                  rows={3}
                  className="w-full bg-surface-soft border border rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Member Notes/Response</label>
                <textarea
                  value={formData.member_notes}
                  onChange={e => setFormData(prev => ({ ...prev, member_notes: e.target.value }))}
                  rows={3}
                  className="w-full bg-surface-soft border border rounded px-3 py-2 text-white"
                />
              </div>
            </div>

            {/* Action Items */}
            <div className="bg-surface-soft rounded-lg p-4">
              <h4 className="font-medium mb-2">Action Items</h4>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newActionItem}
                  onChange={e => setNewActionItem(e.target.value)}
                  placeholder="Add action item..."
                  className="flex-1 bg-surface-hover border border-strong rounded px-3 py-2 text-white text-sm"
                  onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddActionItem())}
                />
                <button
                  type="button"
                  onClick={handleAddActionItem}
                  className="px-3 py-2 bg-surface-hover rounded hover:bg-surface-muted"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1">
                {formData.action_items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm bg-surface-hover/50 rounded px-2 py-1">
                    <span className="flex-1">{item.item}</span>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        action_items: prev.action_items.filter((_, i) => i !== idx)
                      }))}
                      className="text-muted hover:text-red-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 p-4 border-t border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-muted hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-4 py-2 bg-farm-green text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Session'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Session Card Component
  const SessionCard = ({ session, isExpanded, onToggle }) => (
    <div className="bg-surface-soft rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 text-left flex items-center justify-between hover:bg-surface-hover/50"
      >
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-sm text-muted">Week</div>
            <div className="text-xl font-bold">{session.week_number || '?'}</div>
          </div>
          <div>
            <div className="font-medium">{formatDate(session.session_date)}</div>
            <div className="text-sm text-muted">
              {session.professional_goals?.length || 0} prof · {session.personal_goals?.length || 0} personal · {session.readiness_goals?.length || 0} readiness goals
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session.previous_goals_met && (
            <span className={`px-2 py-1 rounded text-xs ${
              session.previous_goals_met === 'YES' ? 'bg-green-900/50 text-green-300' :
              session.previous_goals_met === 'PARTIAL' ? 'bg-yellow-900/50 text-yellow-300' :
              'bg-red-900/50 text-red-300'
            }`}>
              {session.previous_goals_met}
            </span>
          )}
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {isExpanded && (
        <div className="p-4 border-t border space-y-4">
          {/* Goals */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h5 className="text-sm font-medium text-blue-400 mb-2 flex items-center gap-1">
                <Briefcase className="w-4 h-4" /> Professional
              </h5>
              {session.professional_goals?.length > 0 ? (
                <ul className="text-sm space-y-1">
                  {session.professional_goals.map((g, idx) => (
                    <li key={idx} className="flex items-start gap-1">
                      <CheckCircle className="w-4 h-4 text-muted mt-0.5" />
                      <span>{g.goal}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No goals set</p>
              )}
            </div>
            <div>
              <h5 className="text-sm font-medium text-pink-400 mb-2 flex items-center gap-1">
                <Heart className="w-4 h-4" /> Personal
              </h5>
              {session.personal_goals?.length > 0 ? (
                <ul className="text-sm space-y-1">
                  {session.personal_goals.map((g, idx) => (
                    <li key={idx} className="flex items-start gap-1">
                      <CheckCircle className="w-4 h-4 text-muted mt-0.5" />
                      <span>{g.goal}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No goals set</p>
              )}
            </div>
            <div>
              <h5 className="text-sm font-medium text-green-400 mb-2 flex items-center gap-1">
                <Shield className="w-4 h-4" /> Readiness
              </h5>
              {session.readiness_goals?.length > 0 ? (
                <ul className="text-sm space-y-1">
                  {session.readiness_goals.map((g, idx) => (
                    <li key={idx} className="flex items-start gap-1">
                      <CheckCircle className="w-4 h-4 text-muted mt-0.5" />
                      <span>{g.goal}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No goals set</p>
              )}
            </div>
          </div>

          {/* Values Assessment */}
          {session.values_assessment && Object.keys(session.values_assessment).length > 0 && (
            <div>
              <h5 className="text-sm font-medium mb-2">Values Assessment</h5>
              <div className="flex flex-wrap gap-4">
                {Object.entries(session.values_assessment).map(([name, data]) => (
                  <div key={name} className="bg-surface-hover/50 rounded px-3 py-2">
                    <span className="font-medium">{name}:</span>
                    <span className="ml-2 text-farm-green">{data.rating}/5</span>
                    {data.notes && <span className="ml-2 text-muted text-sm">- {data.notes}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Observations */}
          {(session.positive_observations || session.areas_for_improvement) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {session.positive_observations && (
                <div>
                  <h5 className="text-sm font-medium text-green-400 mb-1">Positives</h5>
                  <p className="text-sm text-secondary">{session.positive_observations}</p>
                </div>
              )}
              {session.areas_for_improvement && (
                <div>
                  <h5 className="text-sm font-medium text-yellow-400 mb-1">Areas to Improve</h5>
                  <p className="text-sm text-secondary">{session.areas_for_improvement}</p>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border">
            <button
              onClick={() => {
                setEditingSession(session)
                setShowForm(true)
              }}
              className="px-3 py-1 text-sm bg-surface-hover rounded hover:bg-surface-muted flex items-center gap-1"
            >
              <Edit className="w-4 h-4" /> Edit
            </button>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Brain className="w-5 h-5 text-farm-green" />
          Mentoring Sessions
        </h3>
        <button
          onClick={() => {
            setEditingSession(null)
            setShowForm(true)
          }}
          className="flex items-center gap-2 px-3 py-2 bg-farm-green text-white rounded hover:bg-green-600 text-sm"
        >
          <Plus className="w-4 h-4" />
          New Session
        </button>
      </div>

      {/* Recent Sessions */}
      {recentSessions.length > 0 ? (
        <div className="space-y-3">
          {recentSessions.map(session => (
            <SessionCard
              key={session.id}
              session={session}
              isExpanded={expandedSession === session.id}
              onToggle={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted">
          <Brain className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No mentoring sessions yet</p>
          <p className="text-sm">Start tracking weekly progress by creating a session</p>
        </div>
      )}

      {/* Archived Sessions */}
      {archivedSessions.length > 0 && (
        <div>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-sm text-muted hover:text-white"
          >
            {showArchived ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showArchived ? 'Hide' : 'Show'} Archived ({archivedSessions.length})
          </button>
          {showArchived && (
            <div className="mt-2 space-y-2 opacity-70">
              {archivedSessions.map(session => (
                <SessionCard
                  key={session.id}
                  session={session}
                  isExpanded={expandedSession === session.id}
                  onToggle={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Session Form Modal */}
      {showForm && (
        <SessionForm
          session={editingSession}
          onClose={() => {
            setShowForm(false)
            setEditingSession(null)
          }}
          onSave={onUpdate}
        />
      )}
    </div>
  )
}

export default MemberMentoringTab
