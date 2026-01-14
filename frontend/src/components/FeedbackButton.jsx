import React, { useState, useEffect } from 'react'
import { MessageSquarePlus, X, Send, Loader2 } from 'lucide-react'
import { checkFeedbackEnabled, submitFeedback } from '../services/api'

function FeedbackButton({ keyboardButtonVisible = false }) {
  const [enabled, setEnabled] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [feedbackType, setFeedbackType] = useState('feature')
  const [submittedBy, setSubmittedBy] = useState('')

  useEffect(() => {
    const checkEnabled = async () => {
      try {
        const response = await checkFeedbackEnabled()
        setEnabled(response.data.enabled)
      } catch (e) {
        // Feedback not available
        setEnabled(false)
      }
    }
    checkEnabled()
  }, [])

  const handleSubmit = async (e) => {
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
      // Reset form
      setTitle('')
      setDescription('')
      setFeedbackType('feature')
      setSubmittedBy('')
      // Close after delay
      setTimeout(() => {
        setModalOpen(false)
        setSubmitted(false)
      }, 2000)
    } catch (e) {
      setError(e.userMessage || 'Failed to submit feedback')
    } finally {
      setLoading(false)
    }
  }

  if (!enabled) return null

  return (
    <>
      {/* Floating button - positioned left of keyboard button if present */}
      <button
        onClick={() => setModalOpen(true)}
        className="fixed bottom-6 z-50 p-3 rounded-full shadow-lg transition-all hover:scale-110"
        style={{
          right: keyboardButtonVisible ? '96px' : '24px',
          background: 'linear-gradient(135deg, var(--color-green-600), var(--color-green-700))',
          color: 'white'
        }}
        title="Submit Feedback"
      >
        <MessageSquarePlus className="w-6 h-6" />
      </button>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
          <div
            className="relative w-full max-w-md rounded-xl shadow-2xl p-6"
            style={{ backgroundColor: 'var(--color-bg-surface)' }}
          >
            {/* Close button */}
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded hover:bg-gray-700"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <X className="w-5 h-5" />
            </button>

            {submitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                     style={{ backgroundColor: 'var(--color-success-bg)' }}>
                  <Send className="w-8 h-8" style={{ color: 'var(--color-success-500)' }} />
                </div>
                <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  Thank You!
                </h3>
                <p style={{ color: 'var(--color-text-muted)' }}>
                  Your feedback has been submitted.
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                  Submit Feedback
                </h2>
                <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
                  Help us improve! Share your ideas, report bugs, or suggest improvements.
                </p>

                {error && (
                  <div className="mb-4 p-3 rounded-lg text-sm"
                       style={{ backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error-500)' }}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Type selector */}
                  <div>
                    <label className="block text-sm font-medium mb-1"
                           style={{ color: 'var(--color-text-secondary)' }}>
                      Type
                    </label>
                    <select
                      value={feedbackType}
                      onChange={(e) => setFeedbackType(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        borderColor: 'var(--color-input-border)',
                        color: 'var(--color-input-text)'
                      }}
                    >
                      <option value="feature">Feature Request</option>
                      <option value="bug">Bug Report</option>
                      <option value="improvement">Improvement</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium mb-1"
                           style={{ color: 'var(--color-text-secondary)' }}>
                      Title *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      minLength={3}
                      maxLength={200}
                      placeholder="Brief summary..."
                      className="w-full px-3 py-2 rounded-lg border"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        borderColor: 'var(--color-input-border)',
                        color: 'var(--color-input-text)'
                      }}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium mb-1"
                           style={{ color: 'var(--color-text-secondary)' }}>
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      maxLength={2000}
                      placeholder="Provide more details..."
                      className="w-full px-3 py-2 rounded-lg border resize-none"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        borderColor: 'var(--color-input-border)',
                        color: 'var(--color-input-text)'
                      }}
                    />
                  </div>

                  {/* Name (optional) */}
                  <div>
                    <label className="block text-sm font-medium mb-1"
                           style={{ color: 'var(--color-text-secondary)' }}>
                      Your Name (optional)
                    </label>
                    <input
                      type="text"
                      value={submittedBy}
                      onChange={(e) => setSubmittedBy(e.target.value)}
                      maxLength={100}
                      placeholder="Anonymous"
                      className="w-full px-3 py-2 rounded-lg border"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        borderColor: 'var(--color-input-border)',
                        color: 'var(--color-input-text)'
                      }}
                    />
                  </div>

                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={loading || !title.trim()}
                    className="w-full py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--color-btn-primary-bg)',
                      color: 'var(--color-btn-primary-text)'
                    }}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Submit Feedback
                      </>
                    )}
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

export default FeedbackButton
