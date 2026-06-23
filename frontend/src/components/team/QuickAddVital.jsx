import React, { useState, useEffect } from 'react'
import { X, Heart } from 'lucide-react'
import { logVital, getVitalTypes } from '../../services/api'

function QuickAddVital({ members, onClose, onSuccess, defaultMemberId }) {
  const [selectedMemberId, setSelectedMemberId] = useState(defaultMemberId || '')
  const [vitalTypes, setVitalTypes] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Form fields
  const [vitalType, setVitalType] = useState('')
  const [value, setValue] = useState('')
  const [valueSecondary, setValueSecondary] = useState('')
  const [notes, setNotes] = useState('')

  // Load vital types
  useEffect(() => {
    const loadTypes = async () => {
      try {
        const res = await getVitalTypes()
        setVitalTypes(res.data)
      } catch (err) {
        console.error('Failed to load vital types:', err)
      }
    }
    loadTypes()
  }, [])

  const handleSubmit = async () => {
    if (!selectedMemberId) {
      setError('Please select a team member')
      return
    }
    if (!vitalType) {
      setError('Please select a vital type')
      return
    }
    if (!value) {
      setError('Please enter a value')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const data = {
        vital_type: vitalType,
        value: parseFloat(value),
        ...(valueSecondary && { value_secondary: parseFloat(valueSecondary) }),
        ...(notes && { notes })
      }

      await logVital(selectedMemberId, data)
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error('Failed to log vital:', err)
      setError(err.userMessage || 'Failed to log vital')
    } finally {
      setSubmitting(false)
    }
  }

  // Check if BP (needs secondary value)
  const isBP = vitalType === 'blood_pressure'

  // Get the selected vital type info for label/placeholder
  const selectedVitalInfo = vitalTypes.find(v => v.value === vitalType)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-lg w-full max-w-[95vw] sm:max-w-md">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-subtle flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-400" />
            <h2 className="text-lg font-semibold text-white">Log Vital</h2>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-200 text-sm">
              {error}
            </div>
          )}

          {/* Member Selection */}
          <div>
            <label className="block text-sm text-muted mb-1">Team Member *</label>
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="w-full bg-surface-soft border border rounded px-3 py-2 text-white"
            >
              <option value="">Select member...</option>
              {members.filter(m => m.is_active !== false).map(m => (
                <option key={m.id} value={m.id}>
                  {m.nickname || m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Vital Type */}
          <div>
            <label className="block text-sm text-muted mb-1">Vital Type *</label>
            <select
              value={vitalType}
              onChange={(e) => {
                setVitalType(e.target.value)
                setValue('')
                setValueSecondary('')
              }}
              className="w-full bg-surface-soft border border rounded px-3 py-2 text-white"
            >
              <option value="">Select vital type...</option>
              {vitalTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Value */}
          {vitalType && (
            <>
              {isBP ? (
                <div>
                  <label className="block text-sm text-muted mb-1">Blood Pressure (mmHg) *</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder="120"
                      className="flex-1 bg-surface-soft border border rounded px-3 py-2 text-white"
                    />
                    <span className="text-muted">/</span>
                    <input
                      type="number"
                      value={valueSecondary}
                      onChange={(e) => setValueSecondary(e.target.value)}
                      placeholder="80"
                      className="flex-1 bg-surface-soft border border rounded px-3 py-2 text-white"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm text-muted mb-1">
                    Value ({selectedVitalInfo?.unit || ''}) *
                  </label>
                  <input
                    type="number"
                    step={selectedVitalInfo?.step || 1}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={selectedVitalInfo?.placeholder || ''}
                    className="w-full bg-surface-soft border border rounded px-3 py-2 text-white"
                  />
                </div>
              )}
            </>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm text-muted mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
              className="w-full bg-surface-soft border border rounded px-3 py-2 text-white"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-4 border-t border-subtle flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-muted hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedMemberId || !vitalType || !value || (isBP && !valueSecondary)}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-500 disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Log Vital'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default QuickAddVital
