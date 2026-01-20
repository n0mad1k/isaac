import React, { useState, useEffect, useCallback } from 'react'
import { Fence, Plus, Check, X, Wrench, ChevronDown, ChevronUp, Leaf, PawPrint, Edit, Calendar, Clock, CalendarPlus, Home, Warehouse, TreeDeciduous, Droplets, Bird, Dog, Rabbit, Beef, Car, Box, Bed, Bath, CookingPot, Sofa, Briefcase, DoorOpen, Settings } from 'lucide-react'
import { getFarmAreas, getFarmArea, createFarmArea, updateFarmArea, deleteFarmArea, getFarmAreaMaintenance, createFarmAreaMaintenance, updateFarmAreaMaintenance, completeFarmAreaMaintenance, deleteFarmAreaMaintenance, getFarmAreaTypes, getTasksByEntity, completeTask, deleteTask } from '../services/api'
import { format, formatDistanceToNow } from 'date-fns'
import EventModal from '../components/EventModal'
import { useSettings } from '../contexts/SettingsContext'

// Helper to render area type icon
const getAreaTypeIcon = (type) => {
  const IconComponent = TYPE_ICON_COMPONENTS[type] || Settings
  return <IconComponent className="w-6 h-6" style={{ color: 'var(--color-text-muted)' }} />
}

// Area type icons mapped to Lucide components
const TYPE_ICON_COMPONENTS = {
  // Buildings
  house: Home,
  barn: Warehouse,
  pole_barn: Warehouse,
  workshop: Wrench,
  greenhouse: Leaf,
  shed: Home,
  garage: Car,
  storage: Box,
  // Indoor/Rooms
  bedroom: Bed,
  bathroom: Bath,
  kitchen: CookingPot,
  living_room: Sofa,
  office: Briefcase,
  laundry: Home,
  closet: DoorOpen,
  attic: Home,
  basement: Home,
  // Outdoor/Growing
  garden: Leaf,
  nursery: Leaf,
  food_forest: TreeDeciduous,
  orchard: TreeDeciduous,
  pasture: Leaf,
  yard: Leaf,
  front_yard: Leaf,
  back_yard: Leaf,
  side_yard: Leaf,
  // Water
  pond: Droplets,
  pool: Droplets,
  // Animal Housing
  chicken_coop: Bird,
  rabbit_hutch: Rabbit,
  dog_kennel: Dog,
  stall: Beef,
  pen: Beef,
  apiary: Leaf,
  // Other
  driveway: Home,
  deck: Home,
  patio: Home,
  porch: DoorOpen,
  fence: Fence,
  custom: Settings,
}

function FarmAreas() {
  const { formatTime } = useSettings()
  const [areas, setAreas] = useState([])
  const [areaTypes, setAreaTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingArea, setEditingArea] = useState(null)
  const [expandedArea, setExpandedArea] = useState(null)
  const [areaDetails, setAreaDetails] = useState({})
  const [maintenanceTasks, setMaintenanceTasks] = useState({})
  const [showAddMaintenance, setShowAddMaintenance] = useState(null)
  const [editingMaintenance, setEditingMaintenance] = useState(null)
  const [completeModal, setCompleteModal] = useState(null)
  const [showReminderFor, setShowReminderFor] = useState(null)
  const [linkedTasks, setLinkedTasks] = useState({})
  const [editingLinkedTask, setEditingLinkedTask] = useState(null) // { task, areaId }

  const [formData, setFormData] = useState({
    name: '',
    type: 'garden',
    custom_type: '',
    parent_id: '',
    description: '',
    location_notes: '',
    size_acres: '',
    size_sqft: '',
    soil_type: '',
    irrigation_type: '',
    notes: '',
  })

  const [maintFormData, setMaintFormData] = useState({
    name: '',
    frequency_days: 30,
    frequency_label: 'Monthly',
    last_completed: '',
    manual_due_date: '',
    seasonal: false,
    active_months: '',
    notes: '',
    reminder_alerts: null,
  })

  const [completeData, setCompleteData] = useState({
    cost: '',
    notes: '',
  })

  const frequencyOptions = [
    { days: 7, label: 'Weekly' },
    { days: 14, label: 'Every 2 weeks' },
    { days: 30, label: 'Monthly' },
    { days: 90, label: 'Quarterly' },
    { days: 180, label: 'Every 6 months' },
    { days: 365, label: 'Annually' },
  ]

  const fetchData = useCallback(async () => {
    try {
      const [areasRes, typesRes] = await Promise.all([
        getFarmAreas(),
        getFarmAreaTypes()
      ])
      setAreas(areasRes.data)
      setAreaTypes(typesRes.data)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch farm areas:', err)
      setError('Failed to load farm areas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const fetchAreaDetails = async (areaId) => {
    try {
      const [detailRes, maintRes, tasksRes] = await Promise.all([
        getFarmArea(areaId),
        getFarmAreaMaintenance(areaId),
        getTasksByEntity('farm_area', areaId)
      ])
      setAreaDetails(prev => ({ ...prev, [areaId]: detailRes.data }))
      setMaintenanceTasks(prev => ({ ...prev, [areaId]: maintRes.data }))
      setLinkedTasks(prev => ({ ...prev, [areaId]: tasksRes.data }))
    } catch (err) {
      console.error('Failed to fetch area details:', err)
    }
  }

  const handleExpand = (areaId) => {
    if (expandedArea === areaId) {
      setExpandedArea(null)
    } else {
      setExpandedArea(areaId)
      if (!areaDetails[areaId]) {
        fetchAreaDetails(areaId)
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const data = {
        ...formData,
        parent_id: formData.parent_id ? parseInt(formData.parent_id) : null,
        size_acres: formData.size_acres ? parseFloat(formData.size_acres) : null,
        size_sqft: formData.size_sqft ? parseFloat(formData.size_sqft) : null,
      }
      if (editingArea) {
        await updateFarmArea(editingArea.id, data)
      } else {
        await createFarmArea(data)
      }
      setShowAddForm(false)
      setEditingArea(null)
      resetForm()
      fetchData()
    } catch (err) {
      console.error('Failed to save area:', err)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this area? Plants and animals will be unlinked but not deleted.')) return
    try {
      await deleteFarmArea(id)
      fetchData()
    } catch (err) {
      console.error('Failed to delete area:', err)
    }
  }

  const handleAddMaintenance = async (e) => {
    e.preventDefault()
    try {
      const areaId = showAddMaintenance
      const data = {
        ...maintFormData,
        last_completed: maintFormData.last_completed ? new Date(maintFormData.last_completed).toISOString() : null,
        manual_due_date: maintFormData.manual_due_date ? new Date(maintFormData.manual_due_date).toISOString() : null,
      }
      if (editingMaintenance) {
        await updateFarmAreaMaintenance(editingMaintenance.id, data)
      } else {
        await createFarmAreaMaintenance(areaId, data)
      }
      setShowAddMaintenance(null)
      setEditingMaintenance(null)
      setMaintFormData({ name: '', frequency_days: 30, frequency_label: 'Monthly', last_completed: '', manual_due_date: '', seasonal: false, active_months: '', notes: '', reminder_alerts: null })
      fetchAreaDetails(areaId)
      fetchData()
    } catch (err) {
      console.error('Failed to save maintenance:', err)
    }
  }

  const startEditMaintenance = (task, areaId) => {
    setEditingMaintenance(task)
    setMaintFormData({
      name: task.name,
      frequency_days: task.frequency_days,
      frequency_label: task.frequency_label || '',
      last_completed: task.last_completed ? format(new Date(task.last_completed), 'yyyy-MM-dd') : '',
      manual_due_date: task.manual_due_date ? format(new Date(task.manual_due_date), 'yyyy-MM-dd') : '',
      seasonal: task.seasonal || false,
      active_months: task.active_months || '',
      notes: task.notes || '',
      reminder_alerts: task.reminder_alerts || null,
    })
    setShowAddMaintenance(areaId)
  }

  const handleComplete = async () => {
    if (!completeModal) return
    try {
      await completeFarmAreaMaintenance(completeModal.id, {
        cost: completeData.cost ? parseFloat(completeData.cost) : null,
        notes: completeData.notes || null,
      })
      setCompleteModal(null)
      setCompleteData({ cost: '', notes: '' })
      fetchAreaDetails(completeModal.area_id)
      fetchData()
    } catch (err) {
      console.error('Failed to complete maintenance:', err)
    }
  }

  const handleDeleteMaintenance = async (taskId, areaId) => {
    if (!confirm('Delete this maintenance task?')) return
    try {
      await deleteFarmAreaMaintenance(taskId)
      fetchAreaDetails(areaId)
      fetchData()
    } catch (err) {
      console.error('Failed to delete maintenance:', err)
    }
  }

  const handleCompleteLinkedTask = async (taskId, areaId) => {
    try {
      await completeTask(taskId)
      fetchAreaDetails(areaId)
    } catch (err) {
      console.error('Failed to complete task:', err)
    }
  }

  const handleDeleteLinkedTask = async (taskId, areaId) => {
    if (!confirm('Delete this reminder?')) return
    try {
      await deleteTask(taskId)
      fetchAreaDetails(areaId)
    } catch (err) {
      console.error('Failed to delete task:', err)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'garden',
      custom_type: '',
      description: '',
      location_notes: '',
      size_acres: '',
      size_sqft: '',
      soil_type: '',
      irrigation_type: '',
      notes: '',
    })
  }

  const startEdit = (area) => {
    setEditingArea(area)
    setFormData({
      name: area.name,
      type: area.type,
      custom_type: area.custom_type || '',
      description: area.description || '',
      location_notes: area.location_notes || '',
      size_acres: area.size_acres?.toString() || '',
      size_sqft: area.size_sqft?.toString() || '',
      soil_type: area.soil_type || '',
      irrigation_type: area.irrigation_type || '',
      notes: area.notes || '',
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Fence className="w-8 h-8 text-farm-green" />
          <h1 className="text-2xl font-bold">Farm Areas</h1>
        </div>
        <button
          onClick={() => { setShowAddForm(true); setEditingArea(null); resetForm(); }}
          className="flex items-center gap-2 px-4 py-2 bg-farm-green text-white rounded-lg hover:bg-farm-green-light"
        >
          <Plus className="w-5 h-5" />
          Add Area
        </button>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Areas Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {areas.map(area => (
          <div key={area.id} className="bg-gray-800 rounded-lg overflow-hidden">
            {/* Area Header */}
            <div
              className="p-4 cursor-pointer hover:bg-gray-700/50"
              onClick={() => handleExpand(area.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span>{getAreaTypeIcon(area.type)}</span>
                  <div>
                    <div className="font-bold text-lg">{area.is_sub_location ? `↳ ${area.name}` : area.name}</div>
                    <div className="text-gray-400 text-sm">
                      {area.is_sub_location && <span className="text-cyan-400">{area.full_path.split(' > ')[0]} &gt; </span>}
                      {area.display_type}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-3 text-sm">
                    {area.maintenance_count > 0 && (
                      <div className={`flex items-center gap-1 ${area.overdue_count > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        <Wrench className="w-3 h-3" /> {area.maintenance_count}{area.overdue_count > 0 && <span className="text-red-400 ml-1">({area.overdue_count} overdue)</span>}
                      </div>
                    )}
                    {area.plant_count > 0 && (
                      <div className="flex items-center gap-1 text-green-400">
                        <Leaf className="w-3 h-3" /> {area.plant_count}
                      </div>
                    )}
                    {area.animal_count > 0 && (
                      <div className="flex items-center gap-1 text-blue-400">
                        <PawPrint className="w-3 h-3" /> {area.animal_count}
                      </div>
                    )}
                  </div>
                  {expandedArea === area.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>
              {area.size_acres && (
                <div className="text-gray-400 text-sm mt-1">{area.size_acres} acres</div>
              )}
            </div>

            {/* Area Details */}
            {expandedArea === area.id && (
              <div className="border-t border-gray-700 p-4 space-y-4">
                {/* Plants in Area */}
                {areaDetails[area.id]?.plants?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-2">
                      <Leaf className="w-4 h-4" /> Plants ({areaDetails[area.id].plants.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {areaDetails[area.id].plants.map(plant => (
                        <span key={plant.id} className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                          {plant.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Animals in Area */}
                {areaDetails[area.id]?.animals?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
                      <PawPrint className="w-4 h-4" /> Animals ({areaDetails[area.id].animals.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {areaDetails[area.id].animals.map(animal => (
                        <span key={animal.id} className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                          {animal.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Maintenance Tasks */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">Maintenance Tasks</h4>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); startEdit(area); }}
                        className="text-xs px-2 py-1 bg-blue-600/30 text-blue-400 rounded hover:bg-blue-600/50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(area.id); }}
                        className="text-xs px-2 py-1 bg-red-600/30 text-red-400 rounded hover:bg-red-600/50"
                      >
                        Delete
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowReminderFor(area); }}
                        className="text-xs px-2 py-1 bg-cyan-600/30 text-cyan-400 rounded hover:bg-cyan-600/50 flex items-center gap-1"
                        title="Add Reminder"
                      >
                        <CalendarPlus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowAddMaintenance(area.id); }}
                        className="text-xs px-2 py-1 bg-gray-600 rounded hover:bg-gray-500"
                      >
                        + Task
                      </button>
                    </div>
                  </div>

                  {maintenanceTasks[area.id]?.length > 0 ? (
                    <div className="space-y-2">
                      {maintenanceTasks[area.id].map(task => (
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
                              {task.seasonal && (
                                <span className="text-xs text-purple-400">({task.active_months})</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              {task.frequency_label || `Every ${task.frequency_days} days`}
                              {task.last_completed && (
                                <span className="ml-2">
                                  | Last: {formatDistanceToNow(new Date(task.last_completed), { addSuffix: true })}
                                </span>
                              )}
                              {(task.next_due_date || task.manual_due_date) && (
                                <span className={`ml-2 ${task.status === 'overdue' ? 'text-red-400' : task.status === 'due_soon' ? 'text-yellow-400' : ''}`}>
                                  | Due: {format(new Date(task.next_due_date || task.manual_due_date), 'MMM d')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); startEditMaintenance(task, area.id); }}
                              className="p-1 text-blue-400 hover:bg-blue-400/20 rounded"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setCompleteModal(task)
                                setCompleteData({ cost: '', notes: '' })
                              }}
                              className="p-1 text-green-400 hover:bg-green-400/20 rounded"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteMaintenance(task.id, area.id); }}
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
                </div>

                {/* Linked Reminders */}
                {linkedTasks[area.id]?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <CalendarPlus className="w-4 h-4 text-cyan-400" />
                      Reminders ({linkedTasks[area.id].length})
                    </h4>
                    <div className="space-y-2">
                      {linkedTasks[area.id].map(task => (
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
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setEditingLinkedTask({ task, areaId: area.id }); }}
                                  className="p-1 text-blue-400 hover:bg-blue-400/20 rounded"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleCompleteLinkedTask(task.id, area.id); }}
                                  className="p-1 text-green-400 hover:bg-green-400/20 rounded"
                                  title="Complete"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteLinkedTask(task.id, area.id); }}
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

      {areas.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-400">
          <Fence className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No farm areas yet. Add one to get started!</p>
        </div>
      )}

      {/* Add/Edit Area Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingArea ? 'Edit Area' : 'Add Farm Area'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Parent Location (optional)</label>
                  <select
                    value={formData.parent_id}
                    onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                    className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  >
                    <option value="">No parent (top level)</option>
                    {areas.filter(a => !a.parent_id && a.id !== editingArea?.id).map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Create sub-location (e.g., House &gt; Bedroom)</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  >
                    {areaTypes.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                {formData.type === 'custom' && (
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Size (acres)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.size_acres}
                    onChange={(e) => setFormData({ ...formData, size_acres: e.target.value })}
                    className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">or Size (sqft)</label>
                  <input
                    type="number"
                    value={formData.size_sqft}
                    onChange={(e) => setFormData({ ...formData, size_sqft: e.target.value })}
                    className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Location Notes</label>
                <input
                  type="text"
                  value={formData.location_notes}
                  onChange={(e) => setFormData({ ...formData, location_notes: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  placeholder="e.g., Behind the barn"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Soil Type</label>
                  <input
                    type="text"
                    value={formData.soil_type}
                    onChange={(e) => setFormData({ ...formData, soil_type: e.target.value })}
                    className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Irrigation</label>
                  <input
                    type="text"
                    value={formData.irrigation_type}
                    onChange={(e) => setFormData({ ...formData, irrigation_type: e.target.value })}
                    className="w-full bg-gray-700 rounded-lg px-4 py-2"
                    placeholder="e.g., Drip, Sprinkler"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  rows={2}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setEditingArea(null); }}
                  className="flex-1 px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-farm-green text-white rounded-lg hover:bg-farm-green-light"
                >
                  {editingArea ? 'Update' : 'Add'}
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
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Frequency</label>
                <select
                  value={maintFormData.frequency_days}
                  onChange={(e) => {
                    const opt = frequencyOptions.find(o => o.days === parseInt(e.target.value))
                    setMaintFormData({
                      ...maintFormData,
                      frequency_days: parseInt(e.target.value),
                      frequency_label: opt?.label || ''
                    })
                  }}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                >
                  {frequencyOptions.map(opt => (
                    <option key={opt.days} value={opt.days}>{opt.label}</option>
                  ))}
                </select>
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
                <p className="text-xs text-gray-500 mt-1">Set a specific due date. Clears after completion.</p>
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
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={maintFormData.seasonal}
                  onChange={(e) => setMaintFormData({ ...maintFormData, seasonal: e.target.checked })}
                  className="w-4 h-4"
                />
                <label className="text-sm text-gray-400">Seasonal only</label>
              </div>
              {maintFormData.seasonal && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Active Months (e.g., Mar-Oct)</label>
                  <input
                    type="text"
                    value={maintFormData.active_months}
                    onChange={(e) => setMaintFormData({ ...maintFormData, active_months: e.target.value })}
                    className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  />
                </div>
              )}
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
                  onClick={() => { setShowAddMaintenance(null); setEditingMaintenance(null); setMaintFormData({ name: '', frequency_days: 30, frequency_label: 'Monthly', last_completed: '', manual_due_date: '', seasonal: false, active_months: '', notes: '', reminder_alerts: null }); }}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Complete: {completeModal.name}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Cost (optional)</label>
                <input
                  type="number"
                  step="0.01"
                  value={completeData.cost}
                  onChange={(e) => setCompleteData({ ...completeData, cost: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
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
          preselectedEntity={{ type: 'farm_area', id: showReminderFor.id, name: showReminderFor.name }}
          onClose={() => setShowReminderFor(null)}
          onSaved={() => {
            fetchAreaDetails(showReminderFor.id)
            setShowReminderFor(null)
          }}
        />
      )}

      {/* Edit Linked Task Modal */}
      {editingLinkedTask && (
        <EventModal
          editingTask={editingLinkedTask.task}
          onClose={() => setEditingLinkedTask(null)}
          onSaved={() => {
            fetchAreaDetails(editingLinkedTask.areaId)
            setEditingLinkedTask(null)
          }}
        />
      )}
    </div>
  )
}

export default FarmAreas
