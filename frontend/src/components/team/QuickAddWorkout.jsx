import React, { useState, useEffect } from 'react'
import { X, Dumbbell } from 'lucide-react'
import { logWorkout, getWorkoutTypes } from '../../services/api'

function QuickAddWorkout({ members, onClose, onSuccess, defaultMemberId }) {
  const [selectedMemberId, setSelectedMemberId] = useState(defaultMemberId || '')
  const [workoutTypes, setWorkoutTypes] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Form fields
  const [workoutType, setWorkoutType] = useState('')
  const [workoutDate, setWorkoutDate] = useState(new Date().toISOString().slice(0, 16))
  const [durationMinutes, setDurationMinutes] = useState('')
  const [distanceMiles, setDistanceMiles] = useState('')
  const [weightCarried, setWeightCarried] = useState('')
  const [rpe, setRpe] = useState('')
  const [notes, setNotes] = useState('')

  // Load workout types
  useEffect(() => {
    const loadTypes = async () => {
      try {
        const res = await getWorkoutTypes()
        setWorkoutTypes(res.data)
      } catch (err) {
        console.error('Failed to load workout types:', err)
      }
    }
    loadTypes()
  }, [])

  const handleSubmit = async () => {
    if (!selectedMemberId) {
      setError('Please select a team member')
      return
    }
    if (!workoutType) {
      setError('Please select a workout type')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const data = {
        workout_type: workoutType,
        workout_date: workoutDate,
        ...(durationMinutes && { duration_minutes: parseInt(durationMinutes) }),
        ...(distanceMiles && { distance_miles: parseFloat(distanceMiles) }),
        ...(weightCarried && { weight_carried_lbs: parseFloat(weightCarried) }),
        ...(rpe && { rpe: parseInt(rpe) }),
        ...(notes && { notes })
      }

      await logWorkout(selectedMemberId, data)
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error('Failed to log workout:', err)
      setError(err.userMessage || 'Failed to log workout')
    } finally {
      setSubmitting(false)
    }
  }

  // Show distance/weight fields based on workout type
  const isCardio = ['RUN', 'RUCK', 'SWIM', 'BIKE', 'ROW'].includes(workoutType)
  const isRuck = workoutType === 'RUCK'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-[95vw] sm:max-w-md">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-semibold text-white">Log Workout</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
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
            <label className="block text-sm text-gray-400 mb-1">Team Member *</label>
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
            >
              <option value="">Select member...</option>
              {members.filter(m => m.is_active !== false).map(m => (
                <option key={m.id} value={m.id}>
                  {m.nickname || m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Workout Type */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Workout Type *</label>
            <select
              value={workoutType}
              onChange={(e) => setWorkoutType(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
            >
              <option value="">Select type...</option>
              {workoutTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date/Time */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Date & Time</label>
            <input
              type="datetime-local"
              value={workoutDate}
              onChange={(e) => setWorkoutDate(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Duration (minutes)</label>
            <input
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              placeholder="45"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
            />
          </div>

          {/* Distance (for cardio) */}
          {isCardio && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Distance (miles)</label>
              <input
                type="number"
                step="0.1"
                value={distanceMiles}
                onChange={(e) => setDistanceMiles(e.target.value)}
                placeholder="3.5"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
          )}

          {/* Weight Carried (for ruck) */}
          {isRuck && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Weight Carried (lbs)</label>
              <input
                type="number"
                step="1"
                value={weightCarried}
                onChange={(e) => setWeightCarried(e.target.value)}
                placeholder="45"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
          )}

          {/* RPE */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">RPE (1-10)</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setRpe(num.toString())}
                  className={`flex-1 py-1.5 text-sm rounded ${
                    rpe === num.toString()
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-4 border-t border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedMemberId || !workoutType}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-500 disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Log Workout'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default QuickAddWorkout
