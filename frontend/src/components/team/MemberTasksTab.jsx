import React, { useState, useEffect } from 'react'
import {
  CheckCircle, Circle, Clock, AlertTriangle, ChevronDown, ChevronUp,
  Calendar, ListTodo, Edit, Trash2, Archive, Play, MoreVertical, Check, X, User, Bell
} from 'lucide-react'
import { getMemberTasks, getMemberBacklog, updateTask, deleteTask, completeTask, getTeamMembers, getAnimals, getPlants, getVehicles, getEquipment, getFarmAreas } from '../../services/api'

// Alert options matching ToDo.jsx
const ALERT_OPTIONS = [
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
]

function MemberTasksTab({ member, onUpdate }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tasks, setTasks] = useState([])
  const [backlogTasks, setBacklogTasks] = useState([])
  const [showCompleted, setShowCompleted] = useState(false)
  const [showBacklog, setShowBacklog] = useState(true)
  const [editingTask, setEditingTask] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [teamMembers, setTeamMembers] = useState([])
  const [isAllDay, setIsAllDay] = useState(true)
  const [selectedAlerts, setSelectedAlerts] = useState([])
  const [selectedRecurrence, setSelectedRecurrence] = useState('once')
  const [customInterval, setCustomInterval] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState([])
  const [showMemberDropdown, setShowMemberDropdown] = useState(false)
  const [linkType, setLinkType] = useState('none')
  const [linkEntities, setLinkEntities] = useState({ animals: [], plants: [], vehicles: [], equipment: [], farmAreas: [] })

  useEffect(() => {
    loadTasks()
    loadTeamMembers()
    loadLinkEntities()
  }, [member.id])

  const loadTeamMembers = async () => {
    try {
      const res = await getTeamMembers()
      setTeamMembers(res.data || [])
    } catch (err) {
      console.error('Failed to load team members:', err)
    }
  }

  const loadLinkEntities = async () => {
    try {
      const [animals, plants, vehicles, equipment, farmAreas] = await Promise.all([
        getAnimals().then(r => r.data || []).catch(() => []),
        getPlants().then(r => r.data || []).catch(() => []),
        getVehicles().then(r => r.data || []).catch(() => []),
        getEquipment().then(r => r.data || []).catch(() => []),
        getFarmAreas().then(r => r.data || []).catch(() => []),
      ])
      setLinkEntities({ animals, plants, vehicles, equipment, farmAreas })
    } catch (err) {
      console.error('Failed to load link entities:', err)
    }
  }

  const loadTasks = async () => {
    setLoading(true)
    setError(null)
    try {
      const [tasksRes, backlogRes] = await Promise.all([
        getMemberTasks(member.id, { include_completed: showCompleted }),
        getMemberBacklog(member.id)
      ])
      setTasks(tasksRes.data.filter(t => !t.is_backlog))
      setBacklogTasks(backlogRes.data)
    } catch (err) {
      console.error('Failed to load tasks:', err)
      setError(err.userMessage || 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!loading) {
      loadTasks()
    }
  }, [showCompleted])

  // Handle task actions
  const handleComplete = async (task) => {
    try {
      await completeTask(task.id)
      await loadTasks()
      if (onUpdate) onUpdate()
    } catch (err) {
      console.error('Failed to complete task:', err)
    }
    setOpenMenuId(null)
  }

  const handleToggleBacklog = async (task) => {
    try {
      await updateTask(task.id, { is_backlog: !task.is_backlog })
      await loadTasks()
      if (onUpdate) onUpdate()
    } catch (err) {
      console.error('Failed to update task:', err)
    }
    setOpenMenuId(null)
  }

  const handleToggleInProgress = async (task) => {
    try {
      await updateTask(task.id, { is_in_progress: !task.is_in_progress })
      await loadTasks()
      if (onUpdate) onUpdate()
    } catch (err) {
      console.error('Failed to update task:', err)
    }
    setOpenMenuId(null)
  }

  const handleDelete = async (task) => {
    if (!confirm(`Delete task "${task.title}"? This cannot be undone.`)) return
    try {
      await deleteTask(task.id)
      await loadTasks()
      if (onUpdate) onUpdate()
    } catch (err) {
      console.error('Failed to delete task:', err)
    }
    setOpenMenuId(null)
  }

  const handleEdit = (task) => {
    setEditingTask(task)
    setIsAllDay(!task.due_time)
    setSelectedAlerts(task.alerts || [])
    setSelectedRecurrence(task.recurrence || 'once')
    setCustomInterval(task.recurrence_interval ? String(task.recurrence_interval) : '')
    // Support both new multi-select and legacy single select
    setSelectedMemberIds(
      task.assigned_member_ids?.length > 0
        ? task.assigned_member_ids
        : task.assigned_to_member_id ? [task.assigned_to_member_id] : []
    )
    // Set link type based on existing entity links
    if (task.animal_id) setLinkType('animal')
    else if (task.plant_id) setLinkType('plant')
    else if (task.vehicle_id) setLinkType('vehicle')
    else if (task.equipment_id) setLinkType('equipment')
    else if (task.farm_area_id) setLinkType('farm_area')
    else setLinkType('none')
    setOpenMenuId(null)
  }

  const closeEditModal = () => {
    setEditingTask(null)
    setSelectedAlerts([])
    setSelectedRecurrence('once')
    setCustomInterval('')
    setIsAllDay(true)
    setSelectedMemberIds([])
    setShowMemberDropdown(false)
    setLinkType('none')
  }

  const handleSaveEdit = async () => {
    try {
      await updateTask(editingTask.id, {
        title: editingTask.title,
        description: editingTask.description,
        priority: editingTask.priority,
        due_date: editingTask.due_date || null,
        due_time: isAllDay ? null : (editingTask.due_time || null),
        category: editingTask.category || 'custom',
        location: editingTask.location || null,
        is_backlog: editingTask.is_backlog || false,
        visible_to_farmhands: editingTask.visible_to_farmhands || false,
        assigned_member_ids: selectedMemberIds.length > 0 ? selectedMemberIds : [],
        alerts: selectedAlerts.length > 0 ? selectedAlerts : null,
        recurrence: selectedRecurrence,
        recurrence_interval: selectedRecurrence === 'custom' ? parseInt(customInterval) || null : null,
        animal_id: linkType === 'animal' ? editingTask.animal_id : null,
        plant_id: linkType === 'plant' ? editingTask.plant_id : null,
        vehicle_id: linkType === 'vehicle' ? editingTask.vehicle_id : null,
        equipment_id: linkType === 'equipment' ? editingTask.equipment_id : null,
        farm_area_id: linkType === 'farm_area' ? editingTask.farm_area_id : null,
      })
      closeEditModal()
      setSelectedAlerts([])
      setIsAllDay(true)
      await loadTasks()
      if (onUpdate) onUpdate()
    } catch (err) {
      console.error('Failed to update task:', err)
    }
  }

  const getPriorityBadge = (priority) => {
    const colors = {
      1: 'bg-red-600 text-white',
      2: 'bg-yellow-600 text-white',
      3: 'bg-blue-600 text-white'
    }
    const labels = { 1: 'High', 2: 'Medium', 3: 'Low' }
    return (
      <span className={`px-2 py-0.5 rounded text-xs ${colors[priority] || colors[2]}`}>
        {labels[priority] || 'Medium'}
      </span>
    )
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'No due date'
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const TaskCard = ({ task, isBacklog = false }) => {
    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !task.is_completed
    const menuOpen = openMenuId === task.id

    return (
      <div className={`bg-gray-700 rounded-lg p-3 ${task.is_completed ? 'opacity-60' : ''}`}>
        <div className="flex items-start gap-3">
          {/* Status icon - clickable to complete */}
          <button
            onClick={() => !task.is_completed && handleComplete(task)}
            disabled={task.is_completed}
            className="mt-0.5 flex-shrink-0"
            title={task.is_completed ? 'Completed' : 'Mark complete'}
          >
            {task.is_completed ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : task.is_in_progress ? (
              <Clock className="w-5 h-5 text-yellow-500 hover:text-green-400" />
            ) : (
              <Circle className="w-5 h-5 text-gray-400 hover:text-green-400" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <span className={`font-medium ${task.is_completed ? 'line-through text-gray-400' : 'text-white'}`}>
                {task.title}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                {getPriorityBadge(task.priority)}
                {/* Action menu */}
                <div className="relative">
                  <button
                    onClick={() => setOpenMenuId(menuOpen ? null : task.id)}
                    className="p-1 text-gray-400 hover:text-white rounded"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {menuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setOpenMenuId(null)}
                      />
                      <div className="absolute right-0 mt-1 w-40 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50 py-1">
                        {!task.is_completed && (
                          <>
                            <button
                              onClick={() => handleComplete(task)}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2"
                            >
                              <Check className="w-4 h-4 text-green-400" />
                              Complete
                            </button>
                            <button
                              onClick={() => handleToggleInProgress(task)}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2"
                            >
                              <Clock className="w-4 h-4 text-yellow-400" />
                              {task.is_in_progress ? 'Not Started' : 'In Progress'}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleToggleBacklog(task)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2"
                        >
                          {isBacklog ? (
                            <>
                              <Play className="w-4 h-4 text-blue-400" />
                              Make Active
                            </>
                          ) : (
                            <>
                              <Archive className="w-4 h-4 text-purple-400" />
                              Send to Backlog
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleEdit(task)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2"
                        >
                          <Edit className="w-4 h-4 text-gray-400" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(task)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2 text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {task.description && (
              <p className="text-sm text-gray-400 mt-1 line-clamp-2">{task.description}</p>
            )}

            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-400' : ''}`}>
                <Calendar className="w-3 h-3" />
                {formatDate(task.due_date)}
              </span>
              {task.due_time && <span>{task.due_time}</span>}
              {task.category && (
                <span className="px-1.5 py-0.5 bg-gray-600 rounded">
                  {task.category.replace('_', ' ')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-400">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
        <p>{error}</p>
      </div>
    )
  }

  const activeTasks = tasks.filter(t => !t.is_completed)
  const completedTasks = tasks.filter(t => t.is_completed)

  return (
    <div className="space-y-6">
      {/* Active Tasks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <ListTodo className="w-5 h-5" />
            Active Tasks ({activeTasks.length})
          </h3>
        </div>

        {activeTasks.length === 0 ? (
          <div className="text-center py-6 text-gray-400 bg-gray-700/50 rounded-lg">
            No active tasks assigned
          </div>
        ) : (
          <div className="space-y-2">
            {activeTasks.map(task => (
              <TaskCard key={task.id} task={task} isBacklog={false} />
            ))}
          </div>
        )}
      </div>

      {/* Backlog Section */}
      <div>
        <button
          onClick={() => setShowBacklog(!showBacklog)}
          className="flex items-center justify-between w-full mb-3 text-left"
        >
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <Archive className="w-5 h-5" />
            Backlog ({backlogTasks.length})
          </h3>
          {showBacklog ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {showBacklog && (
          backlogTasks.length === 0 ? (
            <div className="text-center py-6 text-gray-400 bg-gray-700/50 rounded-lg">
              No backlog tasks assigned
            </div>
          ) : (
            <div className="space-y-2">
              {backlogTasks.map(task => (
                <TaskCard key={task.id} task={task} isBacklog={true} />
              ))}
            </div>
          )
        )}
      </div>

      {/* Completed Tasks */}
      <div>
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
        >
          {showCompleted ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {showCompleted ? 'Hide' : 'Show'} Completed Tasks ({completedTasks.length})
        </button>

        {showCompleted && completedTasks.length > 0 && (
          <div className="space-y-2 mt-3">
            {completedTasks.map(task => (
              <TaskCard key={task.id} task={task} isBacklog={false} />
            ))}
          </div>
        )}
      </div>

      {/* Edit Task Modal */}
      {editingTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-xl font-semibold">Edit Task</h3>
              <button onClick={() => closeEditModal()} className="p-1 hover:bg-gray-700 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Title *</label>
                <input
                  type="text"
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea
                  value={editingTask.description || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                  rows={2}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Location</label>
                <input
                  type="text"
                  value={editingTask.location || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, location: e.target.value })}
                  placeholder="e.g., Vet clinic, Farm, Home"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              {/* Link to entity */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Link to (optional)</label>
                <select
                  value={linkType}
                  onChange={(e) => {
                    setLinkType(e.target.value)
                    // Clear previous entity IDs when changing type
                    setEditingTask(prev => ({
                      ...prev,
                      animal_id: null,
                      plant_id: null,
                      vehicle_id: null,
                      equipment_id: null,
                      farm_area_id: null,
                    }))
                  }}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-farm-green"
                >
                  <option value="none">None</option>
                  <option value="animal">Animal</option>
                  <option value="plant">Plant</option>
                  <option value="vehicle">Vehicle</option>
                  <option value="equipment">Equipment</option>
                  <option value="farm_area">Farm Area</option>
                </select>
              </div>
              {linkType === 'animal' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Select Animal</label>
                  <select
                    value={editingTask.animal_id || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, animal_id: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-farm-green"
                  >
                    <option value="">Choose animal...</option>
                    {linkEntities.animals.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {linkType === 'plant' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Select Plant</label>
                  <select
                    value={editingTask.plant_id || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, plant_id: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-farm-green"
                  >
                    <option value="">Choose plant...</option>
                    {linkEntities.plants.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {linkType === 'vehicle' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Select Vehicle</label>
                  <select
                    value={editingTask.vehicle_id || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, vehicle_id: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-farm-green"
                  >
                    <option value="">Choose vehicle...</option>
                    {linkEntities.vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.year ? `${v.year} ` : ''}{v.make} {v.model}</option>
                    ))}
                  </select>
                </div>
              )}
              {linkType === 'equipment' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Select Equipment</label>
                  <select
                    value={editingTask.equipment_id || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, equipment_id: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-farm-green"
                  >
                    <option value="">Choose equipment...</option>
                    {linkEntities.equipment.map(eq => (
                      <option key={eq.id} value={eq.id}>{eq.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {linkType === 'farm_area' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Select Farm Area</label>
                  <select
                    value={editingTask.farm_area_id || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, farm_area_id: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-farm-green"
                  >
                    <option value="">Choose farm area...</option>
                    {linkEntities.farmAreas.map(fa => (
                      <option key={fa.id} value={fa.id}>{fa.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Category</label>
                  <select
                    value={editingTask.category || 'custom'}
                    onChange={(e) => setEditingTask({ ...editingTask, category: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-farm-green"
                  >
                    <option value="custom">Custom</option>
                    <option value="plant_care">Plant Care</option>
                    <option value="animal_care">Animal Care</option>
                    <option value="home_maintenance">Home Maintenance</option>
                    <option value="garden">Garden</option>
                    <option value="equipment">Equipment</option>
                    <option value="seasonal">Seasonal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Priority</label>
                  <select
                    value={editingTask.priority || 2}
                    onChange={(e) => setEditingTask({ ...editingTask, priority: parseInt(e.target.value) })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-farm-green"
                  >
                    <option value={1}>High</option>
                    <option value={2}>Medium</option>
                    <option value={3}>Low</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Due Date (optional)</label>
                <input
                  type="date"
                  value={editingTask.due_date?.split('T')[0] || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, due_date: e.target.value || null })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400">
                  <input
                    type="checkbox"
                    checked={isAllDay}
                    onChange={(e) => setIsAllDay(e.target.checked)}
                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-farm-green focus:ring-farm-green"
                  />
                  All day (no specific time)
                </label>
              </div>
              {!isAllDay && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Time</label>
                  <input
                    type="time"
                    value={editingTask.due_time || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, due_time: e.target.value || null })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Recurrence</label>
                <select
                  value={selectedRecurrence}
                  onChange={(e) => setSelectedRecurrence(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-farm-green"
                >
                  <option value="once">One-time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Annually</option>
                  <option value="custom">Custom (every X days)</option>
                </select>
              </div>
              {selectedRecurrence === 'custom' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Repeat every (days)</label>
                  <input
                    type="number"
                    min="1"
                    value={customInterval}
                    onChange={(e) => setCustomInterval(e.target.value)}
                    placeholder="e.g., 14"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
              )}
              {/* Assignment - Multi-select */}
              <div className="relative">
                <label className="block text-sm text-gray-400 mb-1 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Assign To
                </label>
                <button
                  type="button"
                  onClick={() => setShowMemberDropdown(!showMemberDropdown)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-farm-green flex items-center justify-between"
                >
                  <span className={selectedMemberIds.length === 0 ? 'text-gray-400' : ''}>
                    {selectedMemberIds.length === 0
                      ? 'Not assigned'
                      : selectedMemberIds.length === 1
                        ? teamMembers.find(m => m.id === selectedMemberIds[0])?.nickname ||
                          teamMembers.find(m => m.id === selectedMemberIds[0])?.name ||
                          '1 member'
                        : `${selectedMemberIds.length} members`
                    }
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showMemberDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showMemberDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowMemberDropdown(false)}
                    />
                    <div className="absolute z-50 mt-1 w-full bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {/* Clear selection option */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMemberIds([])
                          setShowMemberDropdown(false)
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 text-gray-400"
                      >
                        Clear selection
                      </button>
                      <div className="border-t border-gray-700" />
                      {teamMembers.filter(m => m.is_active !== false).map(m => {
                        const isSelected = selectedMemberIds.includes(m.id)
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setSelectedMemberIds(prev =>
                                isSelected
                                  ? prev.filter(id => id !== m.id)
                                  : [...prev, m.id]
                              )
                            }}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2 ${
                              isSelected ? 'bg-gray-700/50' : ''
                            }`}
                          >
                            <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                              isSelected ? 'bg-farm-green border-farm-green' : 'border-gray-500'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span>{m.nickname || m.name}{m.role_title ? ` (${m.role_title})` : ''}</span>
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
              {/* Options */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400">
                  <input
                    type="checkbox"
                    checked={editingTask.is_backlog || false}
                    onChange={(e) => setEditingTask({ ...editingTask, is_backlog: e.target.checked })}
                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-farm-green focus:ring-farm-green"
                  />
                  In Backlog
                  <span className="text-xs text-gray-500">(won't appear in Today's Schedule)</span>
                </label>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400">
                  <input
                    type="checkbox"
                    checked={editingTask.visible_to_farmhands || false}
                    onChange={(e) => setEditingTask({ ...editingTask, visible_to_farmhands: e.target.checked })}
                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-cyan-500 focus:ring-cyan-500"
                  />
                  Visible to Farm Hands
                  <span className="text-xs text-gray-500">(show this task to farm hand accounts)</span>
                </label>
              </div>
              {/* Alerts */}
              <div>
                <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Alerts (optional)
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALERT_OPTIONS.map(opt => {
                    const isSelected = selectedAlerts.includes(opt.value)
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setSelectedAlerts(prev =>
                            isSelected
                              ? prev.filter(v => v !== opt.value)
                              : [...prev, opt.value].sort((a, b) => b - a)
                          )
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
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-700">
              <button
                onClick={() => closeEditModal()}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-farm-green text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MemberTasksTab
