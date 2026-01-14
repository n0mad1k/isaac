import React, { useState, useEffect } from 'react'
import { Calendar as CalendarIcon, CheckSquare, X, User } from 'lucide-react'
import { format } from 'date-fns'
import { createTask, updateTask, getAnimals, getPlants, getVehicles, getEquipment, getFarmAreas, getWorkers, getUsers } from '../services/api'

const TASK_CATEGORIES = [
  { value: 'plant_care', label: 'Plant Care' },
  { value: 'animal_care', label: 'Animal Care' },
  { value: 'garden', label: 'Garden' },
  { value: 'home_maintenance', label: 'Home Maintenance' },
  { value: 'equipment', label: 'Equipment' },
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
 */
function EventModal({ event, defaultDate, preselectedEntity, defaultWorkerId, forWorkerTask, onClose, onSaved }) {
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
    animal_id: event?.animal_id || (preselectedEntity?.type === 'animal' ? preselectedEntity.id : null),
    plant_id: event?.plant_id || (preselectedEntity?.type === 'plant' ? preselectedEntity.id : null),
    vehicle_id: event?.vehicle_id || (preselectedEntity?.type === 'vehicle' ? preselectedEntity.id : null),
    equipment_id: event?.equipment_id || (preselectedEntity?.type === 'equipment' ? preselectedEntity.id : null),
    farm_area_id: event?.farm_area_id || (preselectedEntity?.type === 'farm_area' ? preselectedEntity.id : null),
    assigned_to_worker_id: event?.assigned_to_worker_id || defaultWorkerId || null,
    assigned_to_user_id: event?.assigned_to_user_id || null,
  })
  const [isMultiDay, setIsMultiDay] = useState(!!event?.end_date && event.end_date !== event.due_date)
  const [saving, setSaving] = useState(false)
  const [isAllDay, setIsAllDay] = useState(!event?.due_time)
  const [hasDate, setHasDate] = useState(!!event?.due_date || !!defaultDate)
  const [entities, setEntities] = useState({ animals: [], plants: [], vehicles: [], equipment: [], farmAreas: [], workers: [], users: [] })
  const [entitiesLoading, setEntitiesLoading] = useState(true)
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

        // Always fetch workers and users for assignment dropdown
        // Only fetch other entities if no preselectedEntity
        const promises = [
          getWorkers().catch(() => ({ data: [] })),
          getUsers().catch(() => ({ data: [] })),  // Fetch system users too
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
          }))
        } else {
          setEntities({
            workers: Array.isArray(results[0]?.data) ? results[0].data : [],
            users: Array.isArray(results[1]?.data) ? results[1].data : [],
            animals: Array.isArray(results[2]?.data) ? results[2].data : [],
            plants: Array.isArray(results[3]?.data) ? results[3].data : [],
            vehicles: Array.isArray(results[4]?.data) ? results[4].data : [],
            equipment: Array.isArray(results[5]?.data) ? results[5].data : [],
            farmAreas: Array.isArray(results[6]?.data) ? results[6].data : [],
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

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate: alerts require a date
    const hasDateSet = formData.task_type === 'event' ? !!formData.due_date : hasDate
    if (formData.reminder_alerts && formData.reminder_alerts.length > 0 && !hasDateSet) {
      alert('Email alerts require a due date. Please set a date or remove the alerts.')
      return
    }

    setSaving(true)
    try {
      const dataToSave = {
        ...formData,
        due_date: hasDate ? formData.due_date || null : null,
        // Only include end_date if multi-day is enabled and has a value
        end_date: (hasDate && isMultiDay && formData.end_date) ? formData.end_date : null,
        due_time: (hasDate && !isAllDay) ? formData.due_time || null : null,
        end_time: (hasDate && !isAllDay) ? formData.end_time || null : null,
        is_backlog: formData.task_type === 'todo' ? formData.is_backlog : false,
        visible_to_farmhands: formData.visible_to_farmhands,
        reminder_alerts: formData.reminder_alerts || null,
        // Clear all entity links except the selected type
        animal_id: linkType === 'animal' ? formData.animal_id : null,
        plant_id: linkType === 'plant' ? formData.plant_id : null,
        vehicle_id: linkType === 'vehicle' ? formData.vehicle_id : null,
        equipment_id: linkType === 'equipment' ? formData.equipment_id : null,
        farm_area_id: linkType === 'farm_area' ? formData.farm_area_id : null,
        // Assignment
        assigned_to_worker_id: formData.assigned_to_worker_id || null,
        assigned_to_user_id: formData.assigned_to_user_id || null,
      }

      if (event) {
        await updateTask(event.id, dataToSave)
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
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-800">
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

        <form onSubmit={handleSubmit} className="p-4 space-y-4" id="event-form">
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
              </label>
              <input
                type="date"
                required={formData.task_type === 'event'}
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
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
              <label className="block text-sm text-gray-400 mb-1">End Date *</label>
              <input
                type="date"
                required
                value={formData.end_date}
                min={formData.due_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
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
            <div className="grid grid-cols-2 gap-4">
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

          <div className="grid grid-cols-2 gap-4">
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
            (Array.isArray(entities.workers) && entities.workers.length > 0) ||
            (Array.isArray(entities.users) && entities.users.length > 0)
          ) && (
            <div className="space-y-2 pt-3 border-t border-gray-700">
              <label className="block text-sm text-gray-400 flex items-center gap-2">
                <User className="w-4 h-4" />
                Assign To (optional)
              </label>
              <select
                value={
                  formData.assigned_to_worker_id ? `worker:${formData.assigned_to_worker_id}` :
                  formData.assigned_to_user_id ? `user:${formData.assigned_to_user_id}` : ''
                }
                onChange={(e) => {
                  const value = e.target.value
                  if (!value) {
                    setFormData({ ...formData, assigned_to_worker_id: null, assigned_to_user_id: null })
                  } else if (value.startsWith('worker:')) {
                    setFormData({ ...formData, assigned_to_worker_id: parseInt(value.split(':')[1]), assigned_to_user_id: null })
                  } else if (value.startsWith('user:')) {
                    setFormData({ ...formData, assigned_to_user_id: parseInt(value.split(':')[1]), assigned_to_worker_id: null })
                  }
                }}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              >
                <option value="">Not assigned</option>
                {Array.isArray(entities.workers) && entities.workers.length > 0 && (
                  <optgroup label="Workers">
                    {entities.workers.map(w => (
                      <option key={`worker:${w.id}`} value={`worker:${w.id}`}>
                        {w.name}{w.role ? ` (${w.role})` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
                {Array.isArray(entities.users) && entities.users.filter(u => u.email && u.is_active).length > 0 && (
                  <optgroup label="System Users">
                    {entities.users.filter(u => u.email && u.is_active).map(u => (
                      <option key={`user:${u.id}`} value={`user:${u.id}`}>
                        {u.display_name || u.username}{u.email ? ` (${u.email})` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
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
  )
}

export default EventModal
