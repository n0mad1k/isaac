import React, { useState } from 'react'
import { Calendar as CalendarIcon, Clock, MapPin, Tag, Flag, Repeat, Users, Link2, X, Pencil, Check, Trash2, CheckSquare } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useSettings } from '../contexts/SettingsContext'
import { completeTask, uncompleteTask, deleteTask, deleteTaskOccurrence } from '../services/api'
import { RecurrenceChoiceModal } from './EventModal'

const CATEGORY_LABELS = {
  plant_care: 'Plant Care',
  animal_care: 'Animal Care',
  home_maintenance: 'Home Maintenance',
  garden: 'Garden',
  equipment: 'Equipment',
  fitness: 'Fitness',
  seasonal: 'Seasonal',
  custom: 'Custom',
  other: 'Other',
}

const PRIORITY_CONFIG = {
  1: { label: 'High', color: 'var(--color-error-600)', bg: 'var(--color-error-bg)' },
  2: { label: 'Medium', color: 'var(--color-gold-700)', bg: 'var(--color-gold-100)' },
  3: { label: 'Low', color: 'var(--color-text-muted)', bg: 'var(--color-bg-surface-muted)' },
}

const RECURRENCE_LABELS = {
  once: 'One-time',
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  custom_weekly: 'Specific Days',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  biannually: 'Bi-annually',
  annually: 'Annually',
  custom: 'Custom',
}

const DAY_ABBREVS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * Read-only event detail view modal.
 * Opens when clicking an event on the calendar. Has Edit/Complete/Delete actions.
 */
export default function EventViewModal({ event, onClose, onEdit, onCompleted, onDeleted }) {
  const { formatDate, formatTime } = useSettings()
  const [showRecurrenceChoice, setShowRecurrenceChoice] = useState(false)
  const [completing, setCompleting] = useState(false)

  if (!event) return null

  const priority = PRIORITY_CONFIG[event.priority] || PRIORITY_CONFIG[2]
  const categoryLabel = CATEGORY_LABELS[event.category] || event.category
  const recurrenceLabel = event.recurrence === 'custom_weekly' && event.recurrence_days_of_week?.length > 0
    ? event.recurrence_days_of_week.map(d => DAY_ABBREVS[d]).join('/')
    : (RECURRENCE_LABELS[event.recurrence] || event.recurrence)
  const isRecurring = event.is_recurring && event.recurrence && event.recurrence !== 'once'
  const isTodo = event.task_type === 'todo'

  // Debug logging - remove after fix
  console.log('[EventViewModal Debug]', {
    id: event?.id,
    title: event?.title,
    recurrence: event?.recurrence,
    is_recurring: event?.is_recurring,
    isRecurringResult: isRecurring
  })

  const handleComplete = async () => {
    if (event.is_care_projection) return
    setCompleting(true)
    try {
      if (event.is_completed) {
        await uncompleteTask(event.id)
      } else {
        await completeTask(event.id)
      }
      onCompleted?.()
      onClose()
    } catch (error) {
      console.error('Failed to toggle complete:', error)
    } finally {
      setCompleting(false)
    }
  }

  const handleDelete = () => {
    if (event.is_care_projection) return
    if (isRecurring) {
      setShowRecurrenceChoice(true)
      return
    }
    if (!window.confirm('Delete this event?')) return
    performDelete()
  }

  const performDelete = async () => {
    try {
      await deleteTask(event.id)
      onDeleted?.(event.id)
      onClose()
    } catch (error) {
      console.error('Failed to delete:', error)
      window.alert('Failed to delete event')
    }
  }

  const handleRecurrenceDeleteChoice = async (choice) => {
    setShowRecurrenceChoice(false)
    try {
      if (choice === 'this') {
        await deleteTaskOccurrence(event.id, event.due_date)
      } else {
        await deleteTask(event.id)
      }
      onDeleted?.(event.id)
      onClose()
    } catch (error) {
      console.error('Failed to delete:', error)
      window.alert('Failed to delete event')
    }
  }

  const handleEdit = () => {
    onEdit(event)
  }

  // Format the date display
  const getDateDisplay = () => {
    if (!event.due_date) return null
    const dateStr = formatDate(event.due_date)
    if (event.end_date && event.end_date !== event.due_date) {
      return `${dateStr} — ${formatDate(event.end_date)}`
    }
    return dateStr
  }

  // Format time display
  const getTimeDisplay = () => {
    if (!event.due_time) return null
    const start = formatTime(event.due_time)
    if (event.end_time) {
      return `${start} – ${formatTime(event.end_time)}`
    }
    return start
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <div
          className="rounded-xl w-full max-w-[95vw] sm:max-w-lg max-h-[90vh] flex flex-col"
          style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-4 sm:p-5 pb-3" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
            <div className="flex-1 min-w-0 pr-3">
              <div className="flex items-center gap-2 mb-1">
                {isTodo ? (
                  <CheckSquare className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-info-600)' }} />
                ) : (
                  <CalendarIcon className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-green-600)' }} />
                )}
                <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                  {isTodo ? 'Reminder' : 'Event'}
                </span>
              </div>
              <h2
                className="text-xl font-bold leading-tight"
                style={{
                  color: event.is_completed ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                  textDecoration: event.is_completed ? 'line-through' : 'none'
                }}
              >
                {event.title}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors flex-shrink-0"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Date & Time */}
            {(event.due_date || event.due_time) && (
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                <div>
                  {getDateDisplay() && (
                    <div className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {getDateDisplay()}
                    </div>
                  )}
                  {getTimeDisplay() && (
                    <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {getTimeDisplay()}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Location */}
            {(event.location || event.linked_location) && (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                <div style={{ color: 'var(--color-text-primary)' }}>
                  {event.location || event.linked_location}
                </div>
              </div>
            )}

            {/* Category & Priority */}
            <div className="flex items-center gap-3">
              <Tag className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
              <div className="flex items-center gap-2 flex-wrap">
                {event.category && (
                  <span
                    className="text-xs font-medium px-2.5 py-1 rounded-full capitalize"
                    style={{ backgroundColor: 'var(--color-bg-surface-muted)', color: 'var(--color-text-secondary)' }}
                  >
                    {categoryLabel}
                  </span>
                )}
                <span
                  className="text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1"
                  style={{ backgroundColor: priority.bg, color: priority.color }}
                >
                  <Flag className="w-3 h-3" />
                  {priority.label}
                </span>
              </div>
            </div>

            {/* Recurrence */}
            {isRecurring && (
              <div className="flex items-center gap-3">
                <Repeat className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                <span style={{ color: 'var(--color-text-primary)' }}>
                  {recurrenceLabel}
                  {event.recurrence === 'custom' && event.recurrence_interval && (
                    <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {' '}(every {event.recurrence_interval} days)
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* Assigned Members */}
            {(event.assigned_member_names?.length > 0 || event.assigned_to_member_name) && (
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                <span style={{ color: 'var(--color-text-primary)' }}>
                  {event.assigned_member_names?.length > 0
                    ? event.assigned_member_names.join(', ')
                    : event.assigned_to_member_name}
                </span>
              </div>
            )}

            {/* Linked Entity */}
            {event.linked_entity && (
              <div className="flex items-center gap-3">
                <Link2 className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                <span style={{ color: 'var(--color-text-primary)' }}>{event.linked_entity}</span>
              </div>
            )}

            {/* Description - Full, prominent display */}
            {event.description && (
              <div
                className="rounded-lg p-4 mt-2"
                style={{ backgroundColor: 'var(--color-bg-surface-muted)', border: '1px solid var(--color-border-subtle)' }}
              >
                <div className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-muted)' }}>
                  Description
                </div>
                <div
                  className="text-sm leading-relaxed whitespace-pre-wrap"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {event.description}
                </div>
              </div>
            )}

            {/* Completion note */}
            {event.completion_note && (
              <div
                className="rounded-lg p-4"
                style={{ backgroundColor: 'var(--color-green-100)', border: '1px solid var(--color-green-600)' }}
              >
                <div className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--color-green-700)' }}>
                  Completion Note
                </div>
                <div className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                  {event.completion_note}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          {!event.is_care_projection && (
            <div
              className="flex items-center gap-2 p-4"
              style={{ borderTop: '1px solid var(--color-border-subtle)' }}
            >
              <button
                onClick={handleEdit}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors flex-1 justify-center font-medium"
                style={{ backgroundColor: 'var(--color-bg-surface-muted)', color: 'var(--color-text-primary)' }}
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={handleComplete}
                disabled={completing}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors flex-1 justify-center font-medium"
                style={{
                  backgroundColor: event.is_completed ? 'var(--color-bg-surface-active)' : 'var(--color-green-600)',
                  color: '#ffffff',
                  opacity: completing ? 0.6 : 1,
                }}
              >
                <Check className="w-4 h-4" />
                {event.is_completed ? 'Undo' : 'Complete'}
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors justify-center font-medium"
                style={{ backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error-600)' }}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Recurrence delete choice */}
      {showRecurrenceChoice && (
        <RecurrenceChoiceModal
          action="delete"
          onChoice={handleRecurrenceDeleteChoice}
          onCancel={() => setShowRecurrenceChoice(false)}
        />
      )}
    </>
  )
}
