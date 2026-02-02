import React, { useState, useEffect, useCallback } from 'react'
import { Wrench, Plus, Check, X, ChevronDown, ChevronUp, Clock, Edit, Calendar, MapPin, CalendarPlus, Tractor, Leaf, Droplets, Wheat, Hammer, Zap, Flame, Wind, Plug, Snowflake, Home, Settings } from 'lucide-react'
import { getEquipment, createEquipment, updateEquipment, deleteEquipment, getEquipmentMaintenance, createEquipmentMaintenance, updateEquipmentMaintenance, completeEquipmentMaintenance, deleteEquipmentMaintenance, getEquipmentTypes, getFarmAreas, getTasksByEntity, completeTask, deleteTask } from '../services/api'
import { format, formatDistanceToNow } from 'date-fns'
import EventModal from '../components/EventModal'
import MottoDisplay from '../components/MottoDisplay'
import { useSettings } from '../contexts/SettingsContext'

// Helper to render equipment type icon
const getTypeIcon = (type) => {
  const IconComponent = TYPE_ICON_COMPONENTS[type] || Settings
  return <IconComponent className="w-6 h-6" style={{ color: 'var(--color-text-muted)' }} />
}

// Equipment type icons mapped to Lucide components
const TYPE_ICON_COMPONENTS = {
  // Farm Equipment
  tractor: Tractor,
  mower: Leaf,
  chainsaw: Wrench,
  brush_hog: Wheat,
  tiller: Leaf,
  cultivator: Leaf,
  seeder: Wheat,
  sprayer: Droplets,
  spreader: Wheat,
  baler: Wheat,
  loader: Tractor,
  backhoe: Tractor,
  post_driver: Hammer,
  auger: Wrench,
  chipper: Wrench,
  log_splitter: Wrench,
  fence_charger: Zap,
  water_pump: Droplets,
  irrigation: Droplets,
  // Power Equipment
  generator: Zap,
  pressure_washer: Droplets,
  welder: Flame,
  air_compressor: Wind,
  // Tools
  power_tools: Plug,
  hand_tools: Wrench,
  // Home Equipment
  hvac: Snowflake,
  water_heater: Flame,
  water_softener: Droplets,
  well_pump: Droplets,
  septic: Home,
  appliance: Home,
  grill: Flame,
  pool_spa: Droplets,
  lawn_equipment: Leaf,
  snow_equipment: Snowflake,
  other: Settings,
}

// Location select component with farm areas dropdown + custom option + sub-location
function LocationSelect({ value, subValue, onChange, onSubChange, farmAreas, editing = true, label = "Location" }) {
  const [isCustom, setIsCustom] = useState(false)
  const [customValue, setCustomValue] = useState('')

  // Check if current value matches a farm area
  const matchingArea = farmAreas.find(a => a.name === value)
  const showCustomInput = isCustom || (value && !matchingArea)

  useEffect(() => {
    // If value doesn't match any farm area, it's a custom value
    if (value && !farmAreas.find(a => a.name === value)) {
      setIsCustom(true)
      setCustomValue(value)
    }
  }, [value, farmAreas])

  const handleSelectChange = (e) => {
    const selected = e.target.value
    if (selected === '__custom__') {
      setIsCustom(true)
      setCustomValue('')
    } else {
      setIsCustom(false)
      setCustomValue('')
      onChange(selected)
    }
  }

  const handleCustomChange = (e) => {
    const newValue = e.target.value
    setCustomValue(newValue)
    onChange(newValue)
  }

  if (!editing) {
    const displayLocation = [value, subValue].filter(Boolean).join(' > ')
    return (
      <div>
        <label className="block text-xs text-gray-500 mb-1">{label}</label>
        <div className="text-sm text-gray-300">{displayLocation || '-'}</div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div>
        {label && <label className="block text-sm text-gray-400 mb-1">{label}</label>}
        {showCustomInput ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={customValue}
              onChange={handleCustomChange}
              placeholder="Enter custom location"
              className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
            <button
              type="button"
              onClick={() => { setIsCustom(false); setCustomValue(''); onChange('') }}
              className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 rounded"
              title="Use dropdown"
            >
              ↓
            </button>
          </div>
        ) : (
          <select
            value={value || ''}
            onChange={handleSelectChange}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
          >
            <option value="">No location</option>
            {farmAreas.map(area => (
              <option key={area.id} value={area.name}>
                {area.is_sub_location ? `↳ ${area.name}` : area.name}
              </option>
            ))}
            <option value="__custom__">+ Custom location...</option>
          </select>
        )}
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">Sub-location</label>
        <input
          type="text"
          value={subValue || ''}
          onChange={(e) => onSubChange(e.target.value)}
          placeholder="e.g., Shelf 3, West wall"
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
        />
      </div>
    </div>
  )
}

function Equipment() {
  const { formatTime } = useSettings()
  const [equipment, setEquipment] = useState([])
  const [equipmentTypes, setEquipmentTypes] = useState([])
  const [farmAreas, setFarmAreas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingEquipment, setEditingEquipment] = useState(null)
  const [expandedEquipment, setExpandedEquipment] = useState(null)
  const [maintenanceTasks, setMaintenanceTasks] = useState({})
  const [showAddMaintenance, setShowAddMaintenance] = useState(null)
  const [editingMaintenance, setEditingMaintenance] = useState(null)
  const [completeModal, setCompleteModal] = useState(null)
  const [showReminderFor, setShowReminderFor] = useState(null)
  const [linkedTasks, setLinkedTasks] = useState({})

  const [formData, setFormData] = useState({
    name: '',
    type: 'other',
    custom_type: '',
    make: '',
    model: '',
    year: '',
    serial_number: '',
    current_hours: '',
    location: '',
    sub_location: '',
    notes: '',
  })

  const [maintFormData, setMaintFormData] = useState({
    name: '',
    frequency_hours: '',
    frequency_days: '',
    last_completed: '',
    last_hours: '',
    manual_due_date: '',
    notes: '',
    reminder_alerts: null,
  })

  const [completeData, setCompleteData] = useState({
    hours_at: '',
    cost: '',
    notes: '',
  })

  const fetchData = useCallback(async () => {
    try {
      const [equipRes, typesRes, areasRes] = await Promise.all([
        getEquipment(),
        getEquipmentTypes(),
        getFarmAreas()
      ])
      setEquipment(equipRes.data)
      setEquipmentTypes(typesRes.data)
      setFarmAreas(areasRes.data || [])
      setError(null)
    } catch (err) {
      console.error('Failed to fetch equipment:', err)
      setError('Failed to load equipment')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const fetchMaintenance = async (equipmentId) => {
    try {
      const [maintRes, tasksRes] = await Promise.all([
        getEquipmentMaintenance(equipmentId),
        getTasksByEntity('equipment', equipmentId)
      ])
      setMaintenanceTasks(prev => ({ ...prev, [equipmentId]: maintRes.data }))
      setLinkedTasks(prev => ({ ...prev, [equipmentId]: tasksRes.data }))
    } catch (err) {
      console.error('Failed to fetch maintenance:', err)
    }
  }

  const handleCompleteLinkedTask = async (taskId, equipmentId) => {
    try {
      await completeTask(taskId)
      fetchMaintenance(equipmentId)
    } catch (err) {
      console.error('Failed to complete task:', err)
    }
  }

  const handleDeleteLinkedTask = async (taskId, equipmentId) => {
    if (!confirm('Delete this reminder?')) return
    try {
      await deleteTask(taskId)
      fetchMaintenance(equipmentId)
    } catch (err) {
      console.error('Failed to delete task:', err)
    }
  }

  const handleExpand = (equipmentId) => {
    if (expandedEquipment === equipmentId) {
      setExpandedEquipment(null)
    } else {
      setExpandedEquipment(equipmentId)
      if (!maintenanceTasks[equipmentId]) {
        fetchMaintenance(equipmentId)
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const data = {
        ...formData,
        year: formData.year ? parseInt(formData.year) : null,
        current_hours: formData.current_hours ? parseFloat(formData.current_hours) : 0,
      }
      if (editingEquipment) {
        await updateEquipment(editingEquipment.id, data)
      } else {
        await createEquipment(data)
      }
      setShowAddForm(false)
      setEditingEquipment(null)
      resetForm()
      fetchData()
    } catch (err) {
      console.error('Failed to save equipment:', err)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this equipment and all its maintenance records?')) return
    try {
      await deleteEquipment(id)
      fetchData()
    } catch (err) {
      console.error('Failed to delete equipment:', err)
    }
  }

  const handleAddMaintenance = async (e) => {
    e.preventDefault()
    try {
      const equipmentId = showAddMaintenance
      const data = {
        name: maintFormData.name,
        frequency_hours: maintFormData.frequency_hours ? parseInt(maintFormData.frequency_hours) : null,
        frequency_days: maintFormData.frequency_days ? parseInt(maintFormData.frequency_days) : null,
        last_completed: maintFormData.last_completed ? new Date(maintFormData.last_completed).toISOString() : null,
        last_hours: maintFormData.last_hours ? parseInt(maintFormData.last_hours) : null,
        manual_due_date: maintFormData.manual_due_date ? new Date(maintFormData.manual_due_date).toISOString() : null,
        notes: maintFormData.notes || null,
        reminder_alerts: maintFormData.reminder_alerts || null,
      }
      if (editingMaintenance) {
        await updateEquipmentMaintenance(editingMaintenance.id, data)
      } else {
        await createEquipmentMaintenance(equipmentId, data)
      }
      setShowAddMaintenance(null)
      setEditingMaintenance(null)
      setMaintFormData({ name: '', frequency_hours: '', frequency_days: '', last_completed: '', last_hours: '', manual_due_date: '', notes: '', reminder_alerts: null })
      fetchMaintenance(equipmentId)
      fetchData()
    } catch (err) {
      console.error('Failed to save maintenance:', err)
    }
  }

  const startEditMaintenance = (task, equipmentId) => {
    setEditingMaintenance(task)
    setMaintFormData({
      name: task.name,
      frequency_hours: task.frequency_hours?.toString() || '',
      frequency_days: task.frequency_days?.toString() || '',
      last_completed: task.last_completed ? format(new Date(task.last_completed), 'yyyy-MM-dd') : '',
      last_hours: task.last_hours?.toString() || '',
      manual_due_date: task.manual_due_date ? format(new Date(task.manual_due_date), 'yyyy-MM-dd') : '',
      notes: task.notes || '',
      reminder_alerts: task.reminder_alerts || null,
    })
    setShowAddMaintenance(equipmentId)
  }

  const handleComplete = async () => {
    if (!completeModal) return
    try {
      await completeEquipmentMaintenance(completeModal.id, {
        hours_at: completeData.hours_at ? parseInt(completeData.hours_at) : null,
        cost: completeData.cost ? parseFloat(completeData.cost) : null,
        notes: completeData.notes || null,
      })
      setCompleteModal(null)
      setCompleteData({ hours_at: '', cost: '', notes: '' })
      fetchMaintenance(completeModal.equipment_id)
      fetchData()
    } catch (err) {
      console.error('Failed to complete maintenance:', err)
    }
  }

  const handleDeleteMaintenance = async (taskId, equipmentId) => {
    if (!confirm('Delete this maintenance task?')) return
    try {
      await deleteEquipmentMaintenance(taskId)
      fetchMaintenance(equipmentId)
      fetchData()
    } catch (err) {
      console.error('Failed to delete maintenance:', err)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'other',
      custom_type: '',
      make: '',
      model: '',
      year: '',
      serial_number: '',
      current_hours: '',
      location: '',
      sub_location: '',
      notes: '',
    })
  }

  const startEdit = (equip) => {
    setEditingEquipment(equip)
    setFormData({
      name: equip.name,
      type: equip.type,
      custom_type: equip.custom_type || '',
      make: equip.make || '',
      model: equip.model || '',
      year: equip.year?.toString() || '',
      serial_number: equip.serial_number || '',
      current_hours: equip.current_hours?.toString() || '',
      location: equip.location || '',
      sub_location: equip.sub_location || '',
      notes: equip.notes || '',
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 flex-shrink-0">
          <Wrench className="w-8 h-8 text-farm-green" />
          <h1 className="text-2xl font-bold">Equipment & Tools</h1>
        </div>
        <MottoDisplay />
        <button
          onClick={() => { setShowAddForm(true); setEditingEquipment(null); resetForm(); }}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-farm-green text-white rounded-lg hover:bg-farm-green-light"
        >
          <Plus className="w-5 h-5" />
          Add Equipment
        </button>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Equipment Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {equipment.map(equip => (
          <div key={equip.id} className="bg-gray-800 rounded-lg overflow-hidden">
            {/* Equipment Header */}
            <div
              className="p-4 cursor-pointer hover:bg-gray-700/50"
              onClick={() => handleExpand(equip.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span>{getTypeIcon(equip.type)}</span>
                  <div>
                    <div className="font-bold">{equip.name}</div>
                    <div className="text-gray-400 text-sm">{equip.display_type}</div>
                  </div>
                </div>
                {expandedEquipment === equip.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{equip.current_hours || 0} hours</span>
                  </div>
                  {equip.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      <span>{equip.location}</span>
                    </div>
                  )}
                </div>
                {equip.overdue_count > 0 && (
                  <span className="text-red-400 text-sm">{equip.overdue_count} overdue</span>
                )}
              </div>
            </div>

            {/* Maintenance Tasks */}
            {expandedEquipment === equip.id && (
              <div className="border-t border-gray-700 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">Maintenance</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); startEdit(equip); }}
                      className="text-xs px-2 py-1 bg-blue-600/30 text-blue-400 rounded hover:bg-blue-600/50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(equip.id); }}
                      className="text-xs px-2 py-1 bg-red-600/30 text-red-400 rounded hover:bg-red-600/50"
                    >
                      Delete
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowReminderFor(equip); }}
                      className="text-xs px-2 py-1 bg-cyan-600/30 text-cyan-400 rounded hover:bg-cyan-600/50 flex items-center gap-1"
                      title="Add Reminder"
                    >
                      <CalendarPlus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowAddMaintenance(equip.id); }}
                      className="text-xs px-2 py-1 bg-gray-600 rounded hover:bg-gray-500"
                    >
                      + Task
                    </button>
                  </div>
                </div>

                {maintenanceTasks[equip.id]?.length > 0 ? (
                  <div className="space-y-2">
                    {maintenanceTasks[equip.id].map(task => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-2 bg-gray-700/50 rounded-lg text-sm"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${
                              task.status === 'overdue' ? 'bg-red-400' :
                              task.status === 'due_soon' ? 'bg-yellow-400' : 'bg-green-400'
                            }`}></span>
                            <span>{task.name}</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {task.frequency_hours && `Every ${task.frequency_hours} hrs`}
                            {task.frequency_days && ` | Every ${task.frequency_days} days`}
                            {(task.next_due_date || task.manual_due_date) && (
                              <span className={`ml-2 ${task.status === 'overdue' ? 'text-red-400' : task.status === 'due_soon' ? 'text-yellow-400' : ''}`}>
                                | Due: {format(new Date(task.next_due_date || task.manual_due_date), 'MM/dd/yyyy')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); startEditMaintenance(task, equip.id); }}
                            className="p-1 text-blue-400 hover:bg-blue-400/20 rounded"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setCompleteModal(task)
                              setCompleteData({ hours_at: equip.current_hours?.toString() || '', cost: '', notes: '' })
                            }}
                            className="p-1 text-green-400 hover:bg-green-400/20 rounded"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteMaintenance(task.id, equip.id); }}
                            className="p-1 text-red-400 hover:bg-red-400/20 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-xs">No maintenance tasks</p>
                )}

                {/* Linked Reminders */}
                {linkedTasks[equip.id]?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <CalendarPlus className="w-4 h-4 text-cyan-400" />
                      Reminders ({linkedTasks[equip.id].length})
                    </h4>
                    <div className="space-y-2">
                      {linkedTasks[equip.id].map(task => (
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
                              {task.due_date ? format(new Date(task.due_date), 'MM/dd/yyyy') : 'No due date'}
                              {task.due_time && ` at ${formatTime(task.due_time)}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {!task.is_completed && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCompleteLinkedTask(task.id, equip.id); }}
                                className="p-1 text-green-400 hover:bg-green-400/20 rounded"
                                title="Complete"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteLinkedTask(task.id, equip.id); }}
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
      </div>

      {equipment.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-400">
          <Wrench className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No equipment yet. Add one to get started!</p>
        </div>
      )}

      {/* Add/Edit Equipment Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingEquipment ? 'Edit Equipment' : 'Add Equipment'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  >
                    {equipmentTypes.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                {formData.type === 'other' && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Custom Type</label>
                    <input
                      type="text"
                      value={formData.custom_type}
                      onChange={(e) => setFormData({ ...formData, custom_type: e.target.value })}
                      className="w-full bg-gray-700 rounded-lg px-4 py-2"
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <label className="block text-sm text-gray-400 mb-1">Current Hours</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={formData.current_hours}
                  onChange={(e) => setFormData({ ...formData, current_hours: e.target.value.replace(/[^0-9.]/g, '') })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Serial Number</label>
                <input
                  type="text"
                  value={formData.serial_number}
                  onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                />
              </div>
              <LocationSelect
                value={formData.location}
                subValue={formData.sub_location}
                onChange={(value) => setFormData({ ...formData, location: value })}
                onSubChange={(value) => setFormData({ ...formData, sub_location: value })}
                farmAreas={farmAreas}
                editing={true}
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setEditingEquipment(null); }}
                  className="flex-1 px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-farm-green text-white rounded-lg hover:bg-farm-green-light"
                >
                  {editingEquipment ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Maintenance Modal */}
      {showAddMaintenance && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
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
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Every X Hours</label>
                <input
                  type="number"
                  value={maintFormData.frequency_hours}
                  onChange={(e) => setMaintFormData({ ...maintFormData, frequency_hours: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Every X Days</label>
                <input
                  type="number"
                  value={maintFormData.frequency_days}
                  onChange={(e) => setMaintFormData({ ...maintFormData, frequency_days: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Manual Due Date (optional)
                </label>
                <input
                  type="date"
                  value={maintFormData.manual_due_date}
                  onChange={(e) => setMaintFormData({ ...maintFormData, manual_due_date: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">Set a specific due date. Clears after completion if recurring.</p>
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
              <div>
                <label className="block text-sm text-gray-400 mb-1">Hours at Last Service</label>
                <input
                  type="number"
                  value={maintFormData.last_hours}
                  onChange={(e) => setMaintFormData({ ...maintFormData, last_hours: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  placeholder="Hours when last done"
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
                  onClick={() => { setShowAddMaintenance(null); setEditingMaintenance(null); setMaintFormData({ name: '', frequency_hours: '', frequency_days: '', last_completed: '', last_hours: '', manual_due_date: '', notes: '', reminder_alerts: null }); }}
                  className="flex-1 px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-farm-green text-white rounded-lg hover:bg-farm-green-light"
                >
                  {editingMaintenance ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Modal */}
      {completeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-[95vw] sm:max-w-md">
            <h2 className="text-xl font-bold mb-4">Complete: {completeModal.name}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Hours</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={completeData.hours_at}
                  onChange={(e) => setCompleteData({ ...completeData, hours_at: e.target.value.replace(/[^0-9.]/g, '') })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  placeholder="Current hours"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Cost</label>
                <input
                  type="number"
                  step="0.01"
                  value={completeData.cost}
                  onChange={(e) => setCompleteData({ ...completeData, cost: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
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
          preselectedEntity={{ type: 'equipment', id: showReminderFor.id, name: showReminderFor.name }}
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

export default Equipment
