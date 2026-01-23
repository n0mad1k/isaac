import React, { useState, useEffect, useRef } from 'react'
import { MoreVertical, Keyboard, MessageSquarePlus, RotateCcw, X, Send, Loader2, Plus, Calendar, Bell, CheckSquare } from 'lucide-react'
import { checkFeedbackEnabled, submitFeedback, toggleKeyboard as toggleKeyboardApi, createTask } from '../services/api'

/**
 * Floating Action Menu - Expandable button with keyboard, feedback, and hard refresh options
 * Shows as a single button that expands to reveal available actions
 */
function FloatingActionMenu({ showKeyboard = false, showHardRefresh = true }) {
  const [expanded, setExpanded] = useState(false)
  const [feedbackEnabled, setFeedbackEnabled] = useState(false)
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const [quickAddModalOpen, setQuickAddModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)
  const menuRef = useRef(null)

  // Form state for feedback
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [feedbackType, setFeedbackType] = useState('feature')
  const [submittedBy, setSubmittedBy] = useState('')

  // Form state for quick add
  const [quickTitle, setQuickTitle] = useState('')
  const [quickType, setQuickType] = useState('todo')
  const [quickDueDate, setQuickDueDate] = useState('')
  const [quickDueTime, setQuickDueTime] = useState('')
  const [quickIsBacklog, setQuickIsBacklog] = useState(false)

  // Check if feedback is enabled
  useEffect(() => {
    const checkEnabled = async () => {
      try {
        const response = await checkFeedbackEnabled()
        setFeedbackEnabled(response.data.enabled)
      } catch (e) {
        setFeedbackEnabled(false)
      }
    }
    checkEnabled()
  }, [])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setExpanded(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [])

  const handleToggleKeyboard = async () => {
    try {
      await toggleKeyboardApi()
      setExpanded(false)
    } catch (err) {
      console.error('Keyboard toggle failed:', err)
    }
  }

  const handleHardRefresh = () => {
    setExpanded(false)
    if ('caches' in window) {
      caches.keys().then(names => names.forEach(name => caches.delete(name)))
    }
    window.location.reload(true)
  }

  const handleOpenFeedback = () => {
    setExpanded(false)
    setFeedbackModalOpen(true)
  }

  const handleOpenQuickAdd = () => {
    setExpanded(false)
    setQuickAddModalOpen(true)
    // Set default due date to today
    const today = new Date().toISOString().split('T')[0]
    setQuickDueDate(today)
  }

  const handleSubmitQuickAdd = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const taskData = {
        title: quickTitle,
        task_type: quickType,
        due_date: quickDueDate || null,
        due_time: quickDueTime || null,
        is_backlog: quickIsBacklog,
        notify_email: quickType === 'reminder',
        reminder_alerts: quickType === 'reminder' ? [0, 60] : null,  // Alert at time and 1 hour before
      }
      await createTask(taskData)
      setSubmitted(true)
      setQuickTitle('')
      setQuickType('todo')
      setQuickDueDate('')
      setQuickDueTime('')
      setQuickIsBacklog(false)
      setTimeout(() => {
        setQuickAddModalOpen(false)
        setSubmitted(false)
      }, 1500)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create task')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitFeedback = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await submitFeedback({
        title,
        description,
        feedback_type: feedbackType,
        submitted_by: submittedBy || null
      })
      setSubmitted(true)
      setTitle('')
      setDescription('')
      setFeedbackType('feature')
      setSubmittedBy('')
      setTimeout(() => {
        setFeedbackModalOpen(false)
        setSubmitted(false)
      }, 2000)
    } catch (e) {
      setError(e.userMessage || 'Failed to submit feedback')
    } finally {
      setLoading(false)
    }
  }

  // Count available actions (Quick Add is always available)
  const actionCount = [true, showKeyboard, feedbackEnabled, showHardRefresh].filter(Boolean).length

  return (
    <>
      <div ref={menuRef} className="fixed bottom-6 right-6 z-50">
        {/* Expanded action buttons */}
        {expanded && (
          <div className="absolute bottom-16 right-0 flex flex-col gap-3 items-end">
            {/* Quick Add - always shown */}
            <button
              onClick={handleOpenQuickAdd}
              className="flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105 touch-manipulation"
              style={{
                backgroundColor: 'var(--color-green-600)',
                border: '2px solid var(--color-green-700)',
                color: 'white'
              }}
              title="Quick Add Task/Reminder"
            >
              <Plus className="w-5 h-5" />
              <span className="text-sm font-medium">Quick Add</span>
            </button>
            {showHardRefresh && (
              <button
                onClick={handleHardRefresh}
                className="flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105 touch-manipulation"
                style={{
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '2px solid var(--color-border-default)',
                  color: 'var(--color-text-primary)'
                }}
                title="Hard Refresh"
              >
                <RotateCcw className="w-5 h-5" />
                <span className="text-sm font-medium">Refresh</span>
              </button>
            )}
            {feedbackEnabled && (
              <button
                onClick={handleOpenFeedback}
                className="flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105 touch-manipulation"
                style={{
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '2px solid var(--color-border-default)',
                  color: 'var(--color-text-primary)'
                }}
                title="Submit Feedback"
              >
                <MessageSquarePlus className="w-5 h-5" />
                <span className="text-sm font-medium">Feedback</span>
              </button>
            )}
            {showKeyboard && (
              <button
                onClick={handleToggleKeyboard}
                className="flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105 touch-manipulation"
                style={{
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '2px solid var(--color-border-default)',
                  color: 'var(--color-text-primary)'
                }}
                title="Toggle Keyboard"
              >
                <Keyboard className="w-5 h-5" />
                <span className="text-sm font-medium">Keyboard</span>
              </button>
            )}
          </div>
        )}

        {/* Main toggle button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-4 rounded-full shadow-lg transition-all duration-200 active:scale-95 touch-manipulation"
          style={{
            backgroundColor: expanded ? 'var(--color-green-700)' : 'var(--color-nav-bg)',
            border: '2px solid var(--color-border-strong)',
            color: 'var(--color-text-inverse)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            minWidth: '56px',
            minHeight: '56px'
          }}
          title={expanded ? 'Close menu' : 'Open actions menu'}
        >
          {expanded ? (
            <X className="w-6 h-6" />
          ) : (
            <MoreVertical className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Quick Add Modal */}
      {quickAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
          <div
            className="relative w-full max-w-md rounded-xl shadow-2xl p-6"
            style={{ backgroundColor: 'var(--color-bg-surface)' }}
          >
            {/* Close button */}
            <button
              onClick={() => setQuickAddModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded hover:bg-gray-700"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <X className="w-5 h-5" />
            </button>

            {submitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                     style={{ backgroundColor: 'var(--color-success-bg)' }}>
                  <CheckSquare className="w-8 h-8" style={{ color: 'var(--color-success-600)' }} />
                </div>
                <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  Created!
                </h3>
                <p style={{ color: 'var(--color-text-secondary)' }}>
                  Your {quickType} has been added.
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                  Quick Add
                </h2>

                {error && (
                  <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error-600)' }}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmitQuickAdd} className="space-y-4">
                  {/* Type selector */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setQuickType('todo')}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition-colors ${
                        quickType === 'todo' ? 'border-green-500 bg-green-500/20' : 'border-gray-600'
                      }`}
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      <CheckSquare className="w-4 h-4" />
                      <span className="text-sm">Task</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickType('reminder')}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition-colors ${
                        quickType === 'reminder' ? 'border-yellow-500 bg-yellow-500/20' : 'border-gray-600'
                      }`}
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      <Bell className="w-4 h-4" />
                      <span className="text-sm">Reminder</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickType('event')}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition-colors ${
                        quickType === 'event' ? 'border-blue-500 bg-blue-500/20' : 'border-gray-600'
                      }`}
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">Event</span>
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                      Title *
                    </label>
                    <input
                      type="text"
                      value={quickTitle}
                      onChange={(e) => setQuickTitle(e.target.value)}
                      placeholder="What needs to be done?"
                      required
                      minLength={2}
                      autoFocus
                      className="w-full px-3 py-2 rounded-lg"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        border: '1px solid var(--color-border-default)',
                        color: 'var(--color-text-primary)'
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={quickDueDate}
                        onChange={(e) => setQuickDueDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg"
                        style={{
                          backgroundColor: 'var(--color-input-bg)',
                          border: '1px solid var(--color-border-default)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                        Time {quickType === 'reminder' && '*'}
                      </label>
                      <input
                        type="time"
                        value={quickDueTime}
                        onChange={(e) => setQuickDueTime(e.target.value)}
                        required={quickType === 'reminder'}
                        className="w-full px-3 py-2 rounded-lg"
                        style={{
                          backgroundColor: 'var(--color-input-bg)',
                          border: '1px solid var(--color-border-default)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                  </div>

                  {quickType === 'todo' && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={quickIsBacklog}
                        onChange={(e) => setQuickIsBacklog(e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        Add to backlog (no due date pressure)
                      </span>
                    </label>
                  )}

                  <button
                    type="submit"
                    disabled={loading || quickTitle.length < 2}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--color-green-600)',
                      color: 'white'
                    }}
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Plus className="w-5 h-5" />
                    )}
                    {loading ? 'Creating...' : `Add ${quickType.charAt(0).toUpperCase() + quickType.slice(1)}`}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {feedbackModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
          <div
            className="relative w-full max-w-md rounded-xl shadow-2xl p-6"
            style={{ backgroundColor: 'var(--color-bg-surface)' }}
          >
            {/* Close button */}
            <button
              onClick={() => setFeedbackModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded hover:bg-gray-700"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <X className="w-5 h-5" />
            </button>

            {submitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                     style={{ backgroundColor: 'var(--color-success-bg)' }}>
                  <MessageSquarePlus className="w-8 h-8" style={{ color: 'var(--color-success-600)' }} />
                </div>
                <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  Thank You!
                </h3>
                <p style={{ color: 'var(--color-text-secondary)' }}>
                  Your feedback has been submitted.
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                  Submit Feedback
                </h2>

                {error && (
                  <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error-600)' }}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmitFeedback} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                      Type
                    </label>
                    <select
                      value={feedbackType}
                      onChange={(e) => setFeedbackType(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        border: '1px solid var(--color-border-default)',
                        color: 'var(--color-text-primary)'
                      }}
                    >
                      <option value="feature">Feature Request</option>
                      <option value="bug">Bug Report</option>
                      <option value="improvement">Improvement</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                      Title *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Brief summary..."
                      required
                      minLength={3}
                      className="w-full px-3 py-2 rounded-lg"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        border: '1px solid var(--color-border-default)',
                        color: 'var(--color-text-primary)'
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="More details (optional)..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg resize-none"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        border: '1px solid var(--color-border-default)',
                        color: 'var(--color-text-primary)'
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                      Your Name (optional)
                    </label>
                    <input
                      type="text"
                      value={submittedBy}
                      onChange={(e) => setSubmittedBy(e.target.value)}
                      placeholder="Anonymous"
                      className="w-full px-3 py-2 rounded-lg"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        border: '1px solid var(--color-border-default)',
                        color: 'var(--color-text-primary)'
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || title.length < 3}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--color-green-600)',
                      color: 'white'
                    }}
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                    {loading ? 'Submitting...' : 'Submit Feedback'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default FloatingActionMenu
