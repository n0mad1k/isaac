import React, { useState, useEffect, useCallback } from 'react'
import { Wrench, Plus, Check, X, ChevronDown, ChevronUp, Clock } from 'lucide-react'
import { getEquipment, createEquipment, updateEquipment, deleteEquipment, getEquipmentMaintenance, createEquipmentMaintenance, completeEquipmentMaintenance, deleteEquipmentMaintenance, getEquipmentTypes } from '../services/api'
import { formatDistanceToNow } from 'date-fns'

const TYPE_ICONS = {
  mower: '🌿',
  chainsaw: '🪚',
  generator: '⚡',
  pressure_washer: '💦',
  welder: '🔥',
  air_compressor: '💨',
  power_tools: '🔌',
  hand_tools: '🔧',
  other: '⚙️',
}

function Equipment() {
  const [equipment, setEquipment] = useState([])
  const [equipmentTypes, setEquipmentTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingEquipment, setEditingEquipment] = useState(null)
  const [expandedEquipment, setExpandedEquipment] = useState(null)
  const [maintenanceTasks, setMaintenanceTasks] = useState({})
  const [showAddMaintenance, setShowAddMaintenance] = useState(null)
  const [completeModal, setCompleteModal] = useState(null)

  const [formData, setFormData] = useState({
    name: '',
    type: 'other',
    custom_type: '',
    make: '',
    model: '',
    year: '',
    serial_number: '',
    current_hours: 0,
    notes: '',
  })

  const [maintFormData, setMaintFormData] = useState({
    name: '',
    frequency_hours: '',
    frequency_days: '',
    notes: '',
  })

  const [completeData, setCompleteData] = useState({
    hours_at: '',
    cost: '',
    notes: '',
  })

  const fetchData = useCallback(async () => {
    try {
      const [equipRes, typesRes] = await Promise.all([
        getEquipment(),
        getEquipmentTypes()
      ])
      setEquipment(equipRes.data)
      setEquipmentTypes(typesRes.data)
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
      const res = await getEquipmentMaintenance(equipmentId)
      setMaintenanceTasks(prev => ({ ...prev, [equipmentId]: res.data }))
    } catch (err) {
      console.error('Failed to fetch maintenance:', err)
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
      const data = { ...formData, year: formData.year ? parseInt(formData.year) : null }
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
      await createEquipmentMaintenance(showAddMaintenance, {
        ...maintFormData,
        frequency_hours: maintFormData.frequency_hours ? parseInt(maintFormData.frequency_hours) : null,
        frequency_days: maintFormData.frequency_days ? parseInt(maintFormData.frequency_days) : null,
      })
      setShowAddMaintenance(null)
      setMaintFormData({ name: '', frequency_hours: '', frequency_days: '', notes: '' })
      fetchMaintenance(showAddMaintenance)
      fetchData()
    } catch (err) {
      console.error('Failed to add maintenance:', err)
    }
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
      current_hours: 0,
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
      current_hours: equip.current_hours || 0,
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wrench className="w-8 h-8 text-farm-green" />
          <h1 className="text-2xl font-bold">Equipment & Tools</h1>
        </div>
        <button
          onClick={() => { setShowAddForm(true); setEditingEquipment(null); resetForm(); }}
          className="flex items-center gap-2 px-4 py-2 bg-farm-green rounded-lg hover:bg-farm-green-light"
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
                  <span className="text-2xl">{TYPE_ICONS[equip.type] || '⚙️'}</span>
                  <div>
                    <div className="font-bold">{equip.name}</div>
                    <div className="text-gray-400 text-sm">{equip.display_type}</div>
                  </div>
                </div>
                {expandedEquipment === equip.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span>{equip.current_hours || 0} hours</span>
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
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
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
              <div className="grid grid-cols-2 gap-4">
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
                <label className="block text-sm text-gray-400 mb-1">Current Hours</label>
                <input
                  type="number"
                  value={formData.current_hours}
                  onChange={(e) => setFormData({ ...formData, current_hours: parseInt(e.target.value) || 0 })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
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
                  className="flex-1 px-4 py-2 bg-farm-green rounded-lg hover:bg-farm-green-light"
                >
                  {editingEquipment ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Maintenance Modal */}
      {showAddMaintenance && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Maintenance Task</h2>
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
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddMaintenance(null)}
                  className="flex-1 px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-farm-green rounded-lg hover:bg-farm-green-light"
                >
                  Add
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
                <label className="block text-sm text-gray-400 mb-1">Hours</label>
                <input
                  type="number"
                  value={completeData.hours_at}
                  onChange={(e) => setCompleteData({ ...completeData, hours_at: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
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
                  className="flex-1 px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500"
                >
                  Complete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Equipment
