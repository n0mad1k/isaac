import React, { useState, useEffect } from 'react'
import { Calendar as CalendarIcon, CheckSquare, X, User, Trash2, Users, ChevronDown, Check, Repeat } from 'lucide-react'
import { format } from 'date-fns'
import { createTask, updateTask, deleteTask, deleteTaskOccurrence, editTaskOccurrence, getAnimals, getPlants, getVehicles, getEquipment, getFarmAreas, getWorkers, getUsers, getTeamMembers } from '../services/api'

const TASK_CATEGORIES = [
  { value: 'plant_care', label: 'Plant Care' },
  { value: 'animal_care', label: 'Animal Care' },
  { value: 'garden', label: 'Garden' },
  { value: 'home_maintenance', label: 'Home Maintenance' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'custom', label: 'Custom' },
  { value: 'other', label: 'Other' },
]

/**
 * Reusable Event/Reminder Modal
 *
 * Props:
 * - event: existing event to edit (null for new)
 * - defaultDate: default date to use (Date object)
 * - preselectedEntity: { type: 'animal'|'plant'|'vehicle'|'equipment'|'farm_area', id: number, name: string }
 * - defaultWorkerId: if set, pre-assign task to this worker (for WorkerTasks page)
 * - forWorkerTask: if true, hide alerts and farmhand visibility options (worker tasks mode)
 * - onClose: callback when modal closes
 * - onSaved: callback when event is saved (receives saved data)
 * - onDeleted: callback when event is deleted (optional)
 */
const RECURRENCE_OPTIONS = [
  { value: 'once', label: 'One-time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'custom_weekly', label: 'Specific Days' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
  { value: 'custom', label: 'Custom (every X days)' },
]

const DAY_OPTIONS = [
  { value: 0, label: 'Mon' },
  { value: 1, label: 'Tue' },
  { value: 2, label: 'Wed' },
  { value: 3, label: 'Thu' },
  { value: 4, label: 'Fri' },
  { value: 5, label: 'Sat' },
  { value: 6, label: 'Sun' },
]

/**
 * Choice modal for recurring events: "This occurrence only" vs "All occurrences"
 */
export function RecurrenceChoiceModal({ action, onChoice, onCancel }) {
  const isDelete = action === 'delete'
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={onCancel}>
      <div className="bg-gray-800 rounded-xl w-full max-w-[95vw] sm:max-w-sm p-4 sm:p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <Repeat className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-white">
            {isDelete ? 'Delete Recurring Event' : 'Edit Recurring Event'}
          </h3>
        </div>
        <p className="text-sm text-gray-300 mb-5">
          This is a recurring event. What would you like to {isDelete ? 'delete' : 'edit'}?
        </p>
        <div className="space-y-2">
          <button
            onClick={() => onChoice('this')}
            className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition-colors"
          >
            <div className="font-medium text-white">This occurrence only</div>
            <div className="text-xs text-gray-400 mt-0.5">Only affects the selected date</div>
          </button>
          <button
            onClick={() => onChoice('all')}
            className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition-colors"
          >
            <div className="font-medium text-white">All occurrences</div>
            <div className="text-xs text-gray-400 mt-0.5">{isDelete ? 'Deletes the entire series' : 'Edits every occurrence'}</div>
          </button>
          <button
            onClick={onCancel}
            className="w-full px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors mt-2"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}


function EventModal({ event, defaultDate, projectedDate, preselectedEntity, defaultWorkerId, forWorkerTask, onClose, onSaved, onDeleted }) {
  const [formData, setFormData] = useState({
    title: event?.title || '',
    description: event?.description || '',
    due_date: event?.due_date || (defaultDate ? format(defaultDate, 'yyyy-MM-dd') : ''),
    end_date: event?.end_date || '',  // End date for multi-day events
    due_time: event?.due_time || '',
    end_time: event?.end_time || '',
    location: event?.location || '',
    category: event?.category || 'other',
    priority: event?.priority || 2,
    task_type: event?.task_type || 'todo',
    is_backlog: event?.is_backlog || false,
    visible_to_farmhands: event?.visible_to_farmhands || false,
    reminder_alerts: event?.reminder_alerts || null, // null = use default from settings
    recurrence: event?.recurrence || 'once',
    recurrence_interval: event?.recurrence_interval || null,
    recurrence_days_of_week: event?.recurrence_days_of_week || [],
    animal_id: event?.animal_id || (preselectedEntity?.type === 'animal' ? preselectedEntity.id : null),
    plant_id: event?.plant_id || (preselectedEntity?.type === 'plant' ? preselectedEntity.id : null),
    vehicle_id: event?.vehicle_id || (preselectedEntity?.type === 'vehicle' ? preselectedEntity.id : null),
    equipment_id: event?.equipment_id || (preselectedEntity?.type === 'equipment' ? preselectedEntity.id : null),
    farm_area_id: event?.farm_area_id || (preselectedEntity?.type === 'farm_area' ? preselectedEntity.id : null),
    assigned_to_worker_id: event?.assigned_to_worker_id || defaultWorkerId || null,
    assigned_to_user_id: event?.assigned_to_user_id || null,
    assigned_to_member_id: event?.assigned_to_member_id || null,
    assigned_member_ids: event?.assigned_member_ids || [],
  })
  const [isMultiDay, setIsMultiDay] = useState(!!event?.end_date && event.end_date !== event.due_date)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isAllDay, setIsAllDay] = useState(!event?.due_time)
  const [hasDate, setHasDate] = useState(!!event?.due_date || !!defaultDate)
  const [entities, setEntities] = useState({ animals: [], plants: [], vehicles: [], equipment: [], farmAreas: [], workers: [], users: [], members: [] })
  const [entitiesLoading, setEntitiesLoading] = useState(true)
  const [showMemberDropdown, setShowMemberDropdown] = useState(false)
  const [recurrenceAction, setRecurrenceAction] = useState(null) // 'edit' or 'delete' — shows RecurrenceChoiceModal
  const [pendingSaveData, setPendingSaveData] = useState(null) // Holds data while waiting for recurrence choice
  const [linkType, setLinkType] = useState(
    preselectedEntity?.type ||
    (event?.animal_id ? 'animal' :
    event?.plant_id ? 'plant' :
    event?.vehicle_id ? 'vehicle' :
    event?.equipment_id ? 'equipment' :
    event?.farm_area_id ? 'farm_area' : 'none')
  )

  // Fetch entities for linking and workers for assignment
  useEffect(() => {
    const fetchEntities = async () => {
      setEntitiesLoading(true)
      try {
        // For worker tasks, we only need workers (no assignment dropdown shown, no entity linking)
        if (forWorkerTask) {
          setEntitiesLoading(false)
          return
        }

        // Always fetch workers, users, and team members for assignment dropdown
        // Only fetch other entities if no preselectedEntity
        const promises = [
          getWorkers().catch(() => ({ data: [] })),
          getUsers().catch(() => ({ data: [] })),  // Fetch system users too
          getTeamMembers().catch(() => ({ data: [] })),  // Fetch team members for multi-assignment
        ]

        if (!preselectedEntity) {
          promises.push(
            getAnimals().catch(() => ({ data: [] })),
            getPlants().catch(() => ({ data: [] })),
            getVehicles().catch(() => ({ data: [] })),
            getEquipment().catch(() => ({ data: [] })),
            getFarmAreas().catch(() => ({ data: [] })),
          )
        }

        const results = await Promise.all(promises)

        if (preselectedEntity) {
          setEntities(prev => ({
            ...prev,
            workers: Array.isArray(results[0]?.data) ? results[0].data : [],
            users: Array.isArray(results[1]?.data) ? results[1].data : [],
            members: Array.isArray(results[2]?.data) ? results[2].data : [],
          }))
        } else {
          setEntities({
            workers: Array.isArray(results[0]?.data) ? results[0].data : [],
            users: Array.isArray(results[1]?.data) ? results[1].data : [],
            members: Array.isArray(results[2]?.data) ? results[2].data : [],
            animals: Array.isArray(results[3]?.data) ? results[3].data : [],
            plants: Array.isArray(results[4]?.data) ? results[4].data : [],
            vehicles: Array.isArray(results[5]?.data) ? results[5].data : [],
            equipment: Array.isArray(results[6]?.data) ? results[6].data : [],
            farmAreas: Array.isArray(results[7]?.data) ? results[7].data : [],
          })
        }
      } catch (error) {
        console.error('Failed to fetch entities:', error)
      } finally {
        setEntitiesLoading(false)
      }
    }
    fetchEntities()
  }, [preselectedEntity, forWorkerTask])

  const isRecurring = event && event.recurrence && event.recurrence !== 'once'

  const handleDelete = async () => {
    if (!event?.id) return

    // For recurring events, show choice modal instead of confirm
    if (isRecurring) {
      setRecurrenceAction('delete')
      return
    }

    if (!window.confirm('Delete this event?')) return
    await executeDelete('all')
  }

  const executeDelete = async (choice) => {
    setDeleting(true)
    try {
      if (choice === 'this') {
        // Delete only this occurrence
        const occurrenceDate = projectedDate || event.due_date
        await deleteTaskOccurrence(event.id, occurrenceDate)
      } else {
        // Delete entire series
        await deleteTask(event.id)
      }
      if (onDeleted) onDeleted(event.id)
      onClose()
    } catch (error) {
      console.error('Failed to delete:', error)
      if (error.response?.status !== 401) {
        alert('Failed to delete event: ' + (error.response?.data?.detail || error.message))
      }
    } finally {
      setDeleting(false)
      setRecurrenceAction(null)
    }
  }

  const buildSaveData = () => {
    return {
      ...formData,
      due_date: hasDate ? formData.due_date || null : null,
      // Only include end_date if multi-day is enabled and has a value
      end_date: (hasDate && isMultiDay && formData.end_date) ? formData.end_date : null,
      due_time: (hasDate && !isAllDay) ? formData.due_time || null : null,
      end_time: (hasDate && !isAllDay) ? formData.end_time || null : null,
      is_backlog: formData.task_type === 'todo' ? formData.is_backlog : false,
      visible_to_farmhands: formData.visible_to_farmhands,
      reminder_alerts: formData.reminder_alerts || null,
      // Recurrence
      recurrence: formData.recurrence || 'once',
      recurrence_interval: formData.recurrence === 'custom' && formData.recurrence_interval ? parseInt(formData.recurrence_interval) : null,
      recurrence_days_of_week: formData.recurrence === 'custom_weekly' && formData.recurrence_days_of_week?.length > 0 ? formData.recurrence_days_of_week : null,
      // Clear all entity links except the selected type
      animal_id: linkType === 'animal' ? formData.animal_id : null,
      plant_id: linkType === 'plant' ? formData.plant_id : null,
      vehicle_id: linkType === 'vehicle' ? formData.vehicle_id : null,
      equipment_id: linkType === 'equipment' ? formData.equipment_id : null,
      farm_area_id: linkType === 'farm_area' ? formData.farm_area_id : null,
      // Assignment
      assigned_to_worker_id: formData.assigned_to_worker_id || null,
      assigned_to_user_id: formData.assigned_to_user_id || null,
      assigned_to_member_id: formData.assigned_to_member_id || null,
      assigned_member_ids: formData.assigned_member_ids?.length > 0 ? formData.assigned_member_ids : null,
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate: alerts require a date
    const hasDateSet = formData.task_type === 'event' ? !!formData.due_date : hasDate
    if (formData.reminder_alerts && formData.reminder_alerts.length > 0 && !hasDateSet) {
      alert('Email alerts require a due date. Please set a date or remove the alerts.')
      return
    }

    const dataToSave = buildSaveData()

    // For existing recurring events, show choice modal
    if (event && isRecurring) {
      setPendingSaveData(dataToSave)
      setRecurrenceAction('edit')
      return
    }

    await executeSave(dataToSave, 'all')
  }

  const executeSave = async (dataToSave, choice) => {
    setSaving(true)
    try {
      if (choice === 'this' && event) {
        // Edit only this occurrence - create a one-off task with overrides
        const occurrenceDate = projectedDate || event.due_date
        await editTaskOccurrence(event.id, {
          date: occurrenceDate,  // Original date (will be added to exceptions)
          new_date: dataToSave.due_date,  // New date for the one-off task (may be rescheduled)
          title: dataToSave.title,
          description: dataToSave.description,
          task_type: dataToSave.task_type,
          category: dataToSave.category,
          due_time: dataToSave.due_time,
          end_time: dataToSave.end_time,
          location: dataToSave.location,
          priority: dataToSave.priority,
        })
      } else if (event) {
        // Update all occurrences - use original_due_date if this is a projected occurrence
        // to preserve the series start date (otherwise editing a future occurrence would
        // move the entire series forward, removing past occurrences)
        const saveData = { ...dataToSave }
        if (event.original_due_date) {
          saveData.due_date = event.original_due_date
        }
        await updateTask(event.id, saveData)
      } else {
        await createTask(dataToSave)
      }

      if (onSaved) onSaved(dataToSave)
      onClose()
    } catch (error) {
      console.error('Failed to save:', error)
      // Don't show alert for 401 - the interceptor handles redirect
      if (error.response?.status !== 401) {
        alert(error.userMessage || 'Failed to save event')
      }
    } finally {
      setSaving(false)
      setRecurrenceAction(null)
      setPendingSaveData(null)
    }
  }

  const handleRecurrenceChoice = (choice) => {
    if (recurrenceAction === 'delete') {
      executeDelete(choice)
    } else if (recurrenceAction === 'edit' && pendingSaveData) {
      executeSave(pendingSaveData, choice)
    }
  }

  return (
    <>
    {recurrenceAction && (
      <RecurrenceChoiceModal
        action={recurrenceAction}
        onChoice={handleRecurrenceChoice}
        onCancel={() => { setRecurrenceAction(null); setPendingSaveData(null) }}
      />
    )}
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl w-full max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 sm:p-6 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-800">
          <h2 className="text-lg font-semibold">
            {event ? 'Edit' : 'Add'} {formData.task_type === 'event' ? 'Event' : 'Reminder'}
            {preselectedEntity && (
              <span className="text-sm font-normal text-gray-400 ml-2">
                for {preselectedEntity.name}
              </span>
            )}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4" id="event-form">
          {/* Type Toggle */}
          <div className="flex bg-gray-700 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, task_type: 'event' })}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                formData.task_type === 'event' ? 'bg-farm-green text-white' : 'text-gray-300'
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
              Event
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, task_type: 'todo' })}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                formData.task_type === 'todo' ? 'bg-blue-600 text-white' : 'text-gray-300'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              Reminder
            </button>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Event title"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          {/* Options for reminders */}
          {formData.task_type === 'todo' && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasDate}
                  onChange={(e) => setHasDate(e.target.checked)}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600"
                />
                <span className="text-sm text-gray-300">Has a due date</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_backlog}
                  onChange={(e) => setFormData({ ...formData, is_backlog: e.target.checked })}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600"
                />
                <span className="text-sm text-gray-300">Add to backlog (not due today)</span>
              </label>
            </div>
          )}

          {/* Visible to farm hands checkbox - hide for worker tasks */}
          {!forWorkerTask && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.visible_to_farmhands}
                onChange={(e) => setFormData({ ...formData, visible_to_farmhands: e.target.checked })}
                className="w-4 h-4 rounded bg-gray-700 border-gray-600"
              />
              <span className="text-sm text-gray-300">Visible to farm hand accounts</span>
            </label>
          )}

          {/* Date field - required for events, optional for reminders */}
          {(formData.task_type === 'event' || hasDate) && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                {isMultiDay ? 'Start Date' : 'Date'} {formData.task_type === 'event' ? '*' : ''}
                <span className="text-xs text-gray-500 ml-2">(MM/DD/YYYY)</span>
              </label>
              <input
                type="date"
                required={formData.task_type === 'event'}
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green [&::-webkit-calendar-picker-indicator]:invert"
              />
            </div>
          )}

          {/* Multi-day toggle - only for events with a date */}
          {formData.task_type === 'event' && (formData.task_type === 'event' || hasDate) && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isMultiDay}
                onChange={(e) => {
                  setIsMultiDay(e.target.checked)
                  if (!e.target.checked) {
                    setFormData({ ...formData, end_date: '' })
                  }
                }}
                className="w-4 h-4 rounded bg-gray-700 border-gray-600"
              />
              <span className="text-sm text-gray-300">Multi-day event</span>
            </label>
          )}

          {/* End date for multi-day events */}
          {isMultiDay && (formData.task_type === 'event' || hasDate) && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                End Date *
                <span className="text-xs text-gray-500 ml-2">(MM/DD/YYYY)</span>
              </label>
              <input
                type="date"
                required
                value={formData.end_date}
                min={formData.due_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green [&::-webkit-calendar-picker-indicator]:invert"
              />
            </div>
          )}

          {/* All Day Toggle - only show if has date */}
          {(formData.task_type === 'event' || hasDate) && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAllDay}
                onChange={(e) => setIsAllDay(e.target.checked)}
                className="w-4 h-4 rounded bg-gray-700 border-gray-600"
              />
              <span className="text-sm text-gray-300">All day</span>
            </label>
          )}

          {/* Time fields - only show if has date and not all day */}
          {(formData.task_type === 'event' || hasDate) && !isAllDay && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Start Time</label>
                <input
                  type="time"
                  value={formData.due_time}
                  onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">End Time</label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
            </div>
          )}

          {/* Location */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Vet clinic, Farm, Home"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              >
                {TASK_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              >
                <option value={1}>High</option>
                <option value={2}>Medium</option>
                <option value={3}>Low</option>
              </select>
            </div>
          </div>

          {/* Recurrence - only show if has date */}
          {(formData.task_type === 'event' || hasDate) && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Repeat</label>
                <select
                  value={formData.recurrence}
                  onChange={(e) => setFormData({ ...formData, recurrence: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                >
                  {RECURRENCE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              {formData.recurrence === 'custom' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Repeat every (days)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.recurrence_interval || ''}
                    onChange={(e) => setFormData({ ...formData, recurrence_interval: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="e.g., 14"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
              )}
              {formData.recurrence === 'custom_weekly' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Select days</label>
                  <div className="flex gap-1.5">
                    {DAY_OPTIONS.map(day => {
                      const selected = (formData.recurrence_days_of_week || []).includes(day.value)
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => {
                            const current = formData.recurrence_days_of_week || []
                            const updated = selected
                              ? current.filter(d => d !== day.value)
                              : [...current, day.value].sort((a, b) => a - b)
                            setFormData({ ...formData, recurrence_days_of_week: updated })
                          }}
                          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                            selected
                              ? 'bg-farm-green text-white'
                              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          }`}
                        >
                          {day.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="Optional notes or description"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          {/* Alerts Section - hide for worker tasks */}
          {!forWorkerTask && (
            <div className="space-y-2 pt-3 border-t border-gray-700">
              <label className="block text-sm text-gray-400 mb-2">Alerts (optional)</label>
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
                      className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-cyan-600/30 border border-cyan-500 text-cyan-300'
                          : 'bg-gray-700/50 border border-gray-600 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Entity Linking Section - only show if no preselected entity and not for worker tasks */}
          {!preselectedEntity && !forWorkerTask && (
            <div className="space-y-3 pt-3 border-t border-gray-700">
              <label className="block text-sm text-gray-400">Link to (optional)</label>
              {entitiesLoading ? (
                <div className="text-sm text-gray-500">Loading...</div>
              ) : (
                <>
                  <select
                    value={linkType}
                    onChange={(e) => {
                      setLinkType(e.target.value)
                      setFormData({
                        ...formData,
                        animal_id: null,
                        plant_id: null,
                        vehicle_id: null,
                        equipment_id: null,
                        farm_area_id: null,
                      })
                    }}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  >
                    <option value="none">None</option>
                    <option value="animal">Animal</option>
                    <option value="plant">Plant</option>
                    <option value="vehicle">Vehicle</option>
                    <option value="equipment">Equipment</option>
                    <option value="farm_area">Farm Area</option>
                  </select>

                  {linkType === 'animal' && Array.isArray(entities.animals) && entities.animals.length > 0 && (
                    <select
                      value={formData.animal_id || ''}
                      onChange={(e) => setFormData({ ...formData, animal_id: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                    >
                      <option value="">Select an animal...</option>
                      {entities.animals.map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.animal_type})</option>
                      ))}
                    </select>
                  )}

                  {linkType === 'plant' && Array.isArray(entities.plants) && entities.plants.length > 0 && (
                    <select
                      value={formData.plant_id || ''}
                      onChange={(e) => setFormData({ ...formData, plant_id: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                    >
                      <option value="">Select a plant...</option>
                      {entities.plants.map(p => (
                        <option key={p.id} value={p.id}>{p.name}{p.location ? ` (${p.location})` : ''}</option>
                      ))}
                    </select>
                  )}

                  {linkType === 'vehicle' && Array.isArray(entities.vehicles) && entities.vehicles.length > 0 && (
                    <select
                      value={formData.vehicle_id || ''}
                      onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                    >
                      <option value="">Select a vehicle...</option>
                      {entities.vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.year} {v.make} {v.model}</option>
                      ))}
                    </select>
                  )}

                  {linkType === 'equipment' && Array.isArray(entities.equipment) && entities.equipment.length > 0 && (
                    <select
                      value={formData.equipment_id || ''}
                      onChange={(e) => setFormData({ ...formData, equipment_id: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                    >
                      <option value="">Select equipment...</option>
                      {entities.equipment.map(eq => (
                        <option key={eq.id} value={eq.id}>{eq.name}</option>
                      ))}
                    </select>
                  )}

                  {linkType === 'farm_area' && Array.isArray(entities.farmAreas) && entities.farmAreas.length > 0 && (
                    <select
                      value={formData.farm_area_id || ''}
                      onChange={(e) => setFormData({ ...formData, farm_area_id: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                    >
                      <option value="">Select a farm area...</option>
                      {entities.farmAreas.map(fa => (
                        <option key={fa.id} value={fa.id}>{fa.name}</option>
                      ))}
                    </select>
                  )}
                </>
              )}
            </div>
          )}

          {/* Show linked entity info if preselected */}
          {preselectedEntity && (
            <div className="pt-3 border-t border-gray-700">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span>Linked to:</span>
                <span className="px-2 py-1 bg-gray-700 rounded text-white">
                  {preselectedEntity.name}
                </span>
              </div>
            </div>
          )}

          {/* Assignment Section - hide when already in worker task mode */}
          {!forWorkerTask && !entitiesLoading && (
            <div className="space-y-2 pt-3 border-t border-gray-700">
              <label className="block text-sm text-gray-400 flex items-center gap-2">
                <User className="w-4 h-4" />
                Assign To (optional)
              </label>
              {/* Team Members Multi-Select Dropdown */}
              {Array.isArray(entities.members) && entities.members.filter(m => m.is_active !== false).length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowMemberDropdown(!showMemberDropdown)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green text-left flex items-center justify-between"
                  >
                    <span className={!(formData.assigned_member_ids?.length > 0) ? 'text-gray-400' : ''}>
                      {!(formData.assigned_member_ids?.length > 0)
                        ? 'Select team members...'
                        : formData.assigned_member_ids.length === 1
                          ? (() => { const m = entities.members.find(m => m.id === formData.assigned_member_ids[0]); return m ? (m.nickname || m.name) : '1 member selected' })()
                          : `${formData.assigned_member_ids.length} members selected`}
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${showMemberDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {showMemberDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {entities.members.filter(m => m.is_active !== false).map(m => {
                        const isSelected = formData.assigned_member_ids?.includes(m.id) || false
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              const currentIds = formData.assigned_member_ids || []
                              const newIds = isSelected
                                ? currentIds.filter(id => id !== m.id)
                                : [...currentIds, m.id]
                              setFormData({ ...formData, assigned_member_ids: newIds })
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-gray-600 flex items-center gap-2"
                          >
                            <div className={`w-4 h-4 border rounded flex items-center justify-center ${isSelected ? 'bg-farm-green border-farm-green' : 'border-gray-500'}`}>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span>{m.nickname || m.name}{m.role_title ? ` (${m.role_title})` : ''}</span>
                          </button>
                        )
                      })}
                      {formData.assigned_member_ids?.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, assigned_member_ids: [] })}
                          className="w-full px-3 py-2 text-left text-red-400 hover:bg-gray-600 border-t border-gray-600"
                        >
                          Clear selection
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              {/* Workers Single Select (legacy) */}
              {Array.isArray(entities.workers) && entities.workers.length > 0 && (
                <select
                  value={formData.assigned_to_worker_id || ''}
                  onChange={(e) => setFormData({ ...formData, assigned_to_worker_id: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                >
                  <option value="">No worker assigned</option>
                  {entities.workers.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name}{w.role ? ` (${w.role})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-700">
            {/* Delete button - only show when editing an existing event */}
            {event && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-colors disabled:opacity-50 touch-manipulation flex items-center justify-center gap-2"
                style={{ minHeight: '48px' }}
                title="Delete this event"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className={`${event ? '' : 'flex-1'} px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || deleting}
              onClick={(e) => {
                // Ensure form submits on touch devices
                const form = document.getElementById('event-form')
                if (form && !form.checkValidity()) {
                  form.reportValidity()
                  e.preventDefault()
                }
              }}
              className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors disabled:opacity-50 touch-manipulation"
              style={{ minHeight: '48px' }}
            >
              {saving ? 'Saving...' : (event ? 'Update' : 'Add')}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  )
}

export default EventModal
