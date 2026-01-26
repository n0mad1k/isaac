import React, { useState, useEffect, useCallback } from 'react'
import { Car, Plus, Check, X, Wrench, ChevronDown, ChevronUp, Gauge, Clock, Edit, Calendar, CalendarPlus } from 'lucide-react'
import { getVehicles, createVehicle, updateVehicle, deleteVehicle, getVehicleMaintenance, createVehicleMaintenance, updateVehicleMaintenance, completeVehicleMaintenance, deleteVehicleMaintenance, getVehicleTypes, getTasksByEntity, completeTask, deleteTask } from '../services/api'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import EventModal from '../components/EventModal'
import MottoDisplay from '../components/MottoDisplay'
import { useSettings } from '../contexts/SettingsContext'

const TYPE_ICONS = {
  car: '🚗',
  truck: '🛻',
  tractor: '🚜',
  motorcycle: '🏍️',
  atv: '🏎️',
  utv: '🚙',
}

// Vehicle types that track hours instead of miles
const HOURS_BASED_TYPES = ['tractor', 'atv', 'utv']

const usesHours = (type) => HOURS_BASED_TYPES.includes(type)

function Vehicles() {
  const { formatTime } = useSettings()
  const [vehicles, setVehicles] = useState([])
  const [vehicleTypes, setVehicleTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState(null)
  const [expandedVehicle, setExpandedVehicle] = useState(null)
  const [maintenanceTasks, setMaintenanceTasks] = useState({})
  const [showAddMaintenance, setShowAddMaintenance] = useState(null)
  const [editingMaintenance, setEditingMaintenance] = useState(null)
  const [completeModal, setCompleteModal] = useState(null)
  const [showReminderFor, setShowReminderFor] = useState(null)
  const [linkedTasks, setLinkedTasks] = useState({})

  const [formData, setFormData] = useState({
    name: '',
    type: 'car',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    vin: '',
    license_plate: '',
    current_mileage: '',
    current_hours: '',
    notes: '',
  })

  const [maintFormData, setMaintFormData] = useState({
    name: '',
    frequency_miles: '',
    frequency_hours: '',
    frequency_days: '',
    last_completed: '',
    last_mileage: '',
    last_hours: '',
    manual_due_date: '',
    notes: '',
    reminder_alerts: null,
  })

  const [completeData, setCompleteData] = useState({
    mileage_at: '',
    hours_at: '',
    cost: '',
    notes: '',
  })

  const fetchData = useCallback(async () => {
    try {
      const [vehiclesRes, typesRes] = await Promise.all([
        getVehicles(),
        getVehicleTypes()
      ])
      setVehicles(vehiclesRes.data)
      setVehicleTypes(typesRes.data)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch vehicles:', err)
      setError('Failed to load vehicles')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const fetchMaintenance = async (vehicleId) => {
    try {
      const [maintRes, tasksRes] = await Promise.all([
        getVehicleMaintenance(vehicleId),
        getTasksByEntity('vehicle', vehicleId)
      ])
      setMaintenanceTasks(prev => ({ ...prev, [vehicleId]: maintRes.data }))
      setLinkedTasks(prev => ({ ...prev, [vehicleId]: tasksRes.data }))
    } catch (err) {
      console.error('Failed to fetch maintenance:', err)
    }
  }

  const handleCompleteLinkedTask = async (taskId, vehicleId) => {
    try {
      await completeTask(taskId)
      fetchMaintenance(vehicleId)
    } catch (err) {
      console.error('Failed to complete task:', err)
    }
  }

  const handleDeleteLinkedTask = async (taskId, vehicleId) => {
    if (!confirm('Delete this reminder?')) return
    try {
      await deleteTask(taskId)
      fetchMaintenance(vehicleId)
    } catch (err) {
      console.error('Failed to delete task:', err)
    }
  }

  const handleExpand = (vehicleId) => {
    if (expandedVehicle === vehicleId) {
      setExpandedVehicle(null)
    } else {
      setExpandedVehicle(vehicleId)
      if (!maintenanceTasks[vehicleId]) {
        fetchMaintenance(vehicleId)
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const submitData = {
        ...formData,
        current_mileage: formData.current_mileage ? parseInt(formData.current_mileage) : 0,
        current_hours: formData.current_hours ? parseFloat(formData.current_hours) : 0,
      }
      if (editingVehicle) {
        await updateVehicle(editingVehicle.id, submitData)
      } else {
        await createVehicle(submitData)
      }
      setShowAddForm(false)
      setEditingVehicle(null)
      resetForm()
      fetchData()
    } catch (err) {
      console.error('Failed to save vehicle:', err)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this vehicle and all its maintenance records?')) return
    try {
      await deleteVehicle(id)
      fetchData()
    } catch (err) {
      console.error('Failed to delete vehicle:', err)
    }
  }

  const handleAddMaintenance = async (e) => {
    e.preventDefault()
    try {
      const vehicleId = showAddMaintenance.vehicleId
      const submitData = {
        name: maintFormData.name,
        frequency_miles: maintFormData.frequency_miles ? parseInt(maintFormData.frequency_miles) : null,
        frequency_hours: maintFormData.frequency_hours ? parseInt(maintFormData.frequency_hours) : null,
        frequency_days: maintFormData.frequency_days ? parseInt(maintFormData.frequency_days) : null,
        last_completed: maintFormData.last_completed ? new Date(maintFormData.last_completed).toISOString() : null,
        last_mileage: maintFormData.last_mileage ? parseInt(maintFormData.last_mileage) : null,
        last_hours: maintFormData.last_hours ? parseInt(maintFormData.last_hours) : null,
        manual_due_date: maintFormData.manual_due_date ? new Date(maintFormData.manual_due_date).toISOString() : null,
        notes: maintFormData.notes || null,
        reminder_alerts: maintFormData.reminder_alerts || null,
      }

      if (editingMaintenance) {
        await updateVehicleMaintenance(editingMaintenance.id, submitData)
      } else {
        await createVehicleMaintenance(vehicleId, submitData)
      }

      setShowAddMaintenance(null)
      setEditingMaintenance(null)
      setMaintFormData({ name: '', frequency_miles: '', frequency_hours: '', frequency_days: '', last_completed: '', last_mileage: '', last_hours: '', manual_due_date: '', notes: '', reminder_alerts: null })
      fetchMaintenance(vehicleId)
      fetchData()
    } catch (err) {
      console.error('Failed to save maintenance:', err)
    }
  }

  const startEditMaintenance = (task, vehicleId, vehicleType) => {
    setEditingMaintenance(task)
    setMaintFormData({
      name: task.name,
      frequency_miles: task.frequency_miles?.toString() || '',
      frequency_hours: task.frequency_hours?.toString() || '',
      frequency_days: task.frequency_days?.toString() || '',
      last_completed: task.last_completed ? format(new Date(task.last_completed), 'yyyy-MM-dd') : '',
      last_mileage: task.last_mileage?.toString() || '',
      last_hours: task.last_hours?.toString() || '',
      manual_due_date: task.manual_due_date ? format(new Date(task.manual_due_date), 'yyyy-MM-dd') : '',
      notes: task.notes || '',
      reminder_alerts: task.reminder_alerts || null,
    })
    setShowAddMaintenance({ vehicleId, vehicleType })
  }

  const handleComplete = async () => {
    if (!completeModal) return
    try {
      await completeVehicleMaintenance(completeModal.id, {
        mileage_at: completeData.mileage_at ? parseInt(completeData.mileage_at) : null,
        hours_at: completeData.hours_at ? parseInt(completeData.hours_at) : null,
        cost: completeData.cost ? parseFloat(completeData.cost) : null,
        notes: completeData.notes || null,
      })
      setCompleteModal(null)
      setCompleteData({ mileage_at: '', hours_at: '', cost: '', notes: '' })
      fetchMaintenance(completeModal.vehicle_id)
      fetchData()
    } catch (err) {
      console.error('Failed to complete maintenance:', err)
    }
  }

  const handleDeleteMaintenance = async (taskId, vehicleId) => {
    if (!confirm('Delete this maintenance task?')) return
    try {
      await deleteVehicleMaintenance(taskId)
      fetchMaintenance(vehicleId)
      fetchData()
    } catch (err) {
      console.error('Failed to delete maintenance:', err)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'car',
      make: '',
      model: '',
      year: new Date().getFullYear(),
      vin: '',
      license_plate: '',
      current_mileage: '',
      current_hours: '',
      notes: '',
    })
  }

  const startEdit = (vehicle) => {
    setEditingVehicle(vehicle)
    setFormData({
      name: vehicle.name,
      type: vehicle.type,
      make: vehicle.make || '',
      model: vehicle.model || '',
      year: vehicle.year || new Date().getFullYear(),
      vin: vehicle.vin || '',
      license_plate: vehicle.license_plate || '',
      current_mileage: vehicle.current_mileage?.toString() || '',
      current_hours: vehicle.current_hours?.toString() || '',
      notes: vehicle.notes || '',
    })
    setShowAddForm(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-farm-green"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-shrink-0">
          <Car className="w-8 h-8 text-farm-green" />
          <h1 className="text-2xl font-bold">Vehicles</h1>
        </div>
        <MottoDisplay />
        <button
          onClick={() => { setShowAddForm(true); setEditingVehicle(null); resetForm(); }}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-farm-green text-white rounded-lg hover:bg-farm-green-light"
        >
          <Plus className="w-5 h-5" />
          Add Vehicle
        </button>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Vehicles Grid */}
      <div className="space-y-4">
        {vehicles.map(vehicle => (
          <div key={vehicle.id} className="bg-gray-800 rounded-lg overflow-hidden">
            {/* Vehicle Header */}
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-700/50"
              onClick={() => handleExpand(vehicle.id)}
            >
              <div className="flex items-center gap-4">
                <span className="text-3xl">{TYPE_ICONS[vehicle.type] || '🚗'}</span>
                <div>
                  <div className="font-bold text-lg">{vehicle.name}</div>
                  <div className="text-gray-400 text-sm">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="flex items-center gap-2 text-sm">
                    {usesHours(vehicle.type) ? (
                      <>
                        <Clock className="w-4 h-4" />
                        <span>{vehicle.current_hours?.toLocaleString() || 0} hrs</span>
                      </>
                    ) : (
                      <>
                        <Gauge className="w-4 h-4" />
                        <span>{vehicle.current_mileage?.toLocaleString() || 0} mi</span>
                      </>
                    )}
                  </div>
                  {vehicle.overdue_count > 0 && (
                    <div className="text-red-400 text-sm">{vehicle.overdue_count} overdue</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); startEdit(vehicle); }}
                    className="p-2 text-blue-400 hover:bg-blue-400/20 rounded-lg"
                  >
                    <Wrench className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowReminderFor(vehicle); }}
                    className="p-2 text-cyan-400 hover:bg-cyan-400/20 rounded-lg"
                    title="Add Reminder"
                  >
                    <CalendarPlus className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(vehicle.id); }}
                    className="p-2 text-red-400 hover:bg-red-400/20 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  {expandedVehicle === vehicle.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>
            </div>

            {/* Maintenance Tasks */}
            {expandedVehicle === vehicle.id && (
              <div className="border-t border-gray-700 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Maintenance Schedule</h3>
                  <button
                    onClick={() => setShowAddMaintenance({ vehicleId: vehicle.id, vehicleType: vehicle.type })}
                    className="text-sm px-3 py-1 bg-gray-700 rounded-lg hover:bg-gray-600"
                  >
                    + Add Task
                  </button>
                </div>

                {maintenanceTasks[vehicle.id]?.length > 0 ? (
                  <div className="space-y-2">
                    {maintenanceTasks[vehicle.id].map(task => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${
                              task.status === 'overdue' ? 'bg-red-400' :
                              task.status === 'due_soon' ? 'bg-yellow-400' : 'bg-green-400'
                            }`}></span>
                            <span className="font-medium">{task.name}</span>
                          </div>
                          <div className="text-sm text-gray-400 mt-1">
                            {usesHours(vehicle.type)
                              ? task.frequency_hours && `Every ${task.frequency_hours} hrs`
                              : task.frequency_miles && `Every ${task.frequency_miles.toLocaleString()} mi`
                            }
                            {task.frequency_days && ` | Every ${task.frequency_days} days`}
                            {task.next_due_date && (
                              <span className="ml-2 text-cyan-400">
                                | Due: {format(new Date(task.next_due_date), 'MMM d, yyyy')}
                              </span>
                            )}
                            {task.last_completed && (
                              <span className="ml-2">
                                | Last: {formatDistanceToNow(new Date(task.last_completed), { addSuffix: true })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => startEditMaintenance(task, vehicle.id, vehicle.type)}
                            className="p-2 text-blue-400 hover:bg-blue-400/20 rounded-lg"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setCompleteModal({ ...task, vehicleType: vehicle.type })
                              setCompleteData({
                                mileage_at: vehicle.current_mileage?.toString() || '',
                                hours_at: vehicle.current_hours?.toString() || '',
                                cost: '',
                                notes: '',
                              })
                            }}
                            className="p-2 text-green-400 hover:bg-green-400/20 rounded-lg"
                            title="Complete"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteMaintenance(task.id, vehicle.id)}
                            className="p-2 text-red-400 hover:bg-red-400/20 rounded-lg"
                            title="Delete"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">No maintenance tasks. Add one to track service intervals.</p>
                )}

                {/* Linked Reminders */}
                {linkedTasks[vehicle.id]?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <CalendarPlus className="w-4 h-4 text-cyan-400" />
                      Reminders ({linkedTasks[vehicle.id].length})
                    </h4>
                    <div className="space-y-2">
                      {linkedTasks[vehicle.id].map(task => (
                        <div
                          key={task.id}
                          className={`flex items-center justify-between p-2 rounded-lg text-sm ${
                            task.is_completed ? 'bg-gray-700/30 opacity-60' : 'bg-cyan-900/30'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className={task.is_completed ? 'line-through text-gray-400' : ''}>
                                {task.title}
                              </span>
                              {task.is_completed && (
                                <span className="text-xs text-green-400">Done</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              {task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : 'No due date'}
                              {task.due_time && ` at ${formatTime(task.due_time)}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {!task.is_completed && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCompleteLinkedTask(task.id, vehicle.id); }}
                                className="p-1 text-green-400 hover:bg-green-400/20 rounded"
                                title="Complete"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteLinkedTask(task.id, vehicle.id); }}
                              className="p-1 text-red-400 hover:bg-red-400/20 rounded"
                              title="Delete"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {vehicles.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-400">
            <Car className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No vehicles yet. Add one to get started!</p>
          </div>
        )}
      </div>

      {/* Add/Edit Vehicle Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  placeholder="e.g., 2020 Ford F-150"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  >
                    {vehicleTypes.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Year</label>
                  <input
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                    className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Make</label>
                  <input
                    type="text"
                    value={formData.make}
                    onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                    className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Model</label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  />
                </div>
              </div>
              <div>
                {usesHours(formData.type) ? (
                  <>
                    <label className="block text-sm text-gray-400 mb-1">Current Hours</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.current_hours}
                      onChange={(e) => setFormData({ ...formData, current_hours: e.target.value.replace(/[^0-9.]/g, '') })}
                      className="w-full bg-gray-700 rounded-lg px-4 py-2"
                      placeholder="0"
                    />
                  </>
                ) : (
                  <>
                    <label className="block text-sm text-gray-400 mb-1">Current Mileage</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.current_mileage}
                      onChange={(e) => setFormData({ ...formData, current_mileage: e.target.value.replace(/[^0-9]/g, '') })}
                      className="w-full bg-gray-700 rounded-lg px-4 py-2"
                      placeholder="0"
                    />
                  </>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">VIN/Serial</label>
                <input
                  type="text"
                  value={formData.vin}
                  onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  rows={2}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setEditingVehicle(null); }}
                  className="flex-1 px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-farm-green text-white rounded-lg hover:bg-farm-green-light"
                >
                  {editingVehicle ? 'Update' : 'Add Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Maintenance Modal */}
      {showAddMaintenance && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingMaintenance ? 'Edit Maintenance Task' : 'Add Maintenance Task'}
            </h2>
            <form onSubmit={handleAddMaintenance} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Task Name</label>
                <input
                  type="text"
                  value={maintFormData.name}
                  onChange={(e) => setMaintFormData({ ...maintFormData, name: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  placeholder="e.g., Oil Change"
                  required
                />
              </div>
              {usesHours(showAddMaintenance.vehicleType) ? (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Every X Hours (recurring)</label>
                  <input
                    type="number"
                    value={maintFormData.frequency_hours}
                    onChange={(e) => setMaintFormData({ ...maintFormData, frequency_hours: e.target.value })}
                    className="w-full bg-gray-700 rounded-lg px-4 py-2"
                    placeholder="e.g., 100"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Every X Miles (recurring)</label>
                  <input
                    type="number"
                    value={maintFormData.frequency_miles}
                    onChange={(e) => setMaintFormData({ ...maintFormData, frequency_miles: e.target.value })}
                    className="w-full bg-gray-700 rounded-lg px-4 py-2"
                    placeholder="e.g., 5000"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Every X Days (recurring)</label>
                <input
                  type="number"
                  value={maintFormData.frequency_days}
                  onChange={(e) => setMaintFormData({ ...maintFormData, frequency_days: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  placeholder="e.g., 180"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Last Completed (optional)
                </label>
                <input
                  type="date"
                  value={maintFormData.last_completed}
                  onChange={(e) => setMaintFormData({ ...maintFormData, last_completed: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">When was this last done? Next due will be calculated from here.</p>
              </div>
              {usesHours(showAddMaintenance.vehicleType) ? (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Hours at Last Service</label>
                  <input
                    type="number"
                    value={maintFormData.last_hours}
                    onChange={(e) => setMaintFormData({ ...maintFormData, last_hours: e.target.value })}
                    className="w-full bg-gray-700 rounded-lg px-4 py-2"
                    placeholder="e.g., 150"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Mileage at Last Service</label>
                  <input
                    type="number"
                    value={maintFormData.last_mileage}
                    onChange={(e) => setMaintFormData({ ...maintFormData, last_mileage: e.target.value })}
                    className="w-full bg-gray-700 rounded-lg px-4 py-2"
                    placeholder="e.g., 45000"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Manual Due Date (one-time override)
                </label>
                <input
                  type="date"
                  value={maintFormData.manual_due_date}
                  onChange={(e) => setMaintFormData({ ...maintFormData, manual_due_date: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Set a specific date. After completing, it will use recurring schedule if set, otherwise clear.
                </p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <textarea
                  value={maintFormData.notes}
                  onChange={(e) => setMaintFormData({ ...maintFormData, notes: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  rows={2}
                />
              </div>
              {/* Alerts Section */}
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
                    const isSelected = (maintFormData.reminder_alerts || []).includes(opt.value)
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          const current = maintFormData.reminder_alerts || []
                          const newAlerts = isSelected
                            ? current.filter(v => v !== opt.value)
                            : [...current, opt.value].sort((a, b) => b - a)
                          setMaintFormData({ ...maintFormData, reminder_alerts: newAlerts.length > 0 ? newAlerts : null })
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
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMaintenance(null)
                    setEditingMaintenance(null)
                    setMaintFormData({ name: '', frequency_miles: '', frequency_hours: '', frequency_days: '', last_completed: '', last_mileage: '', last_hours: '', manual_due_date: '', notes: '', reminder_alerts: null })
                  }}
                  className="flex-1 px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-farm-green text-white rounded-lg hover:bg-farm-green-light"
                >
                  {editingMaintenance ? 'Update Task' : 'Add Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Maintenance Modal */}
      {completeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Complete: {completeModal.name}</h2>
            <div className="space-y-4">
              <div>
                {usesHours(completeModal.vehicleType) ? (
                  <>
                    <label className="block text-sm text-gray-400 mb-1">Current Hours</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={completeData.hours_at}
                      onChange={(e) => setCompleteData({ ...completeData, hours_at: e.target.value.replace(/[^0-9.]/g, '') })}
                      className="w-full bg-gray-700 rounded-lg px-4 py-2"
                      placeholder="Current hours"
                    />
                  </>
                ) : (
                  <>
                    <label className="block text-sm text-gray-400 mb-1">Current Mileage</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={completeData.mileage_at}
                      onChange={(e) => setCompleteData({ ...completeData, mileage_at: e.target.value.replace(/[^0-9]/g, '') })}
                      className="w-full bg-gray-700 rounded-lg px-4 py-2"
                      placeholder="Current mileage"
                    />
                  </>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Cost</label>
                <input
                  type="number"
                  step="0.01"
                  value={completeData.cost}
                  onChange={(e) => setCompleteData({ ...completeData, cost: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <textarea
                  value={completeData.notes}
                  onChange={(e) => setCompleteData({ ...completeData, notes: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  rows={2}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setCompleteModal(null)}
                  className="flex-1 px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleComplete}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500"
                >
                  Complete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Reminder Modal */}
      {showReminderFor && (
        <EventModal
          preselectedEntity={{ type: 'vehicle', id: showReminderFor.id, name: `${showReminderFor.year} ${showReminderFor.make} ${showReminderFor.model}` }}
          onClose={() => setShowReminderFor(null)}
          onSaved={() => {
            fetchMaintenance(showReminderFor.id)
            setShowReminderFor(null)
          }}
        />
      )}
    </div>
  )
}

export default Vehicles
