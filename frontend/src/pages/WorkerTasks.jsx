import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { ClipboardList, Plus, Check, X, AlertCircle, ChevronDown, ChevronUp, Edit, User, Phone, Mail, Trash2, Ban, Link, Unlink, ShoppingCart, Package, StickyNote, Play, RotateCcw, CheckCircle, Circle, Brush, Wheat, Wrench, TreeDeciduous, Hammer, ArrowUp, ArrowDown, Archive, Inbox } from 'lucide-react'
import { getWorkers, getWorker, createWorker, updateWorker, deleteWorker, getWorkerTasks, completeWorkerTask, uncompleteWorkerTask, blockWorkerTask, unblockWorkerTask, updateWorkerNote, startWorkerTask, stopWorkerTask, getAssignableTasks, assignTaskToWorker, unassignTaskFromWorker, reorderWorkerTasks, toggleWorkerTaskBacklog, getWorkerSupplyRequests, createSupplyRequest, updateSupplyRequest, deleteSupplyRequest } from '../services/api'
import { format } from 'date-fns'
import { formatPhoneNumber, displayPhone } from '../services/formatPhone'
import { useSettings } from '../contexts/SettingsContext'
import EventModal from '../components/EventModal'
import MottoDisplay from '../components/MottoDisplay'
import enTranslations from '../locales/en.json'
import esTranslations from '../locales/es.json'

const translations = { en: enTranslations, es: esTranslations }

// Role icons mapped to Lucide components
const ROLE_ICON_COMPONENTS = {
  maid: Brush,
  'farm hand': Wheat,
  contractor: Wrench,
  landscaper: TreeDeciduous,
  handyman: Hammer,
  helper: User,
}

function WorkerTasks() {
  const { formatTime } = useSettings()
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedWorker, setSelectedWorker] = useState(null)
  const [workerTasks, setWorkerTasks] = useState([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [showAddWorker, setShowAddWorker] = useState(false)
  const [editingWorker, setEditingWorker] = useState(null)
  const [expandedTask, setExpandedTask] = useState(null)
  const [completeModal, setCompleteModal] = useState(null)
  const [blockModal, setBlockModal] = useState(null)
  const [includeCompleted, setIncludeCompleted] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignableTasks, setAssignableTasks] = useState([])
  const [assignableLoading, setAssignableLoading] = useState(false)

  const [workerFormData, setWorkerFormData] = useState({
    name: '',
    role: '',
    phone: '',
    email: '',
    notes: '',
    language: 'en',
  })

  const [showEventModal, setShowEventModal] = useState(false)
  const [editingTask, setEditingTask] = useState(null)

  const [completeNote, setCompleteNote] = useState('')
  const [blockReason, setBlockReason] = useState('')
  const [noteModal, setNoteModal] = useState(null)
  const [workerNoteText, setWorkerNoteText] = useState('')

  // Backlog state
  const [showBacklog, setShowBacklog] = useState(true)

  // Supply request state
  const [supplyRequests, setSupplyRequests] = useState([])
  const [showSupplyModal, setShowSupplyModal] = useState(false)
  const [supplyFormData, setSupplyFormData] = useState({ item_name: '', quantity: 1, notes: '' })
  const [viewMode, setViewMode] = useState('tasks') // 'tasks' or 'supplies'
  const [editingSupplyRequest, setEditingSupplyRequest] = useState(null)

  // Translation helper - uses selected worker's language
  const lang = selectedWorker?.language || 'en'
  const t = useMemo(() => {
    const strings = translations[lang]?.workerTasks || translations.en.workerTasks
    return (key) => {
      const keys = key.split('.')
      let value = strings
      for (const k of keys) {
        value = value?.[k]
      }
      return value || key
    }
  }, [lang])

  const fetchWorkers = useCallback(async () => {
    try {
      const response = await getWorkers()
      setWorkers(response.data)
      setError(null)
      // Auto-select first worker if none selected
      if (response.data.length > 0 && !selectedWorker) {
        setSelectedWorker(response.data[0])
      }
    } catch (err) {
      console.error('Failed to fetch workers:', err)
      setError('Failed to load workers')
    } finally {
      setLoading(false)
    }
  }, [selectedWorker])

  const fetchWorkerTasks = useCallback(async (workerId) => {
    if (!workerId) return
    setTasksLoading(true)
    try {
      const response = await getWorkerTasks(workerId, { include_completed: includeCompleted })
      setWorkerTasks(response.data)
    } catch (err) {
      console.error('Failed to fetch worker tasks:', err)
    } finally {
      setTasksLoading(false)
    }
  }, [includeCompleted])

  const fetchSupplyRequests = useCallback(async (workerId) => {
    if (!workerId) return
    try {
      const response = await getWorkerSupplyRequests(workerId, { include_completed: includeCompleted })
      setSupplyRequests(response.data)
    } catch (err) {
      console.error('Failed to fetch supply requests:', err)
    }
  }, [includeCompleted])

  useEffect(() => {
    fetchWorkers()
  }, [])

  useEffect(() => {
    if (selectedWorker) {
      fetchWorkerTasks(selectedWorker.id)
      fetchSupplyRequests(selectedWorker.id)
    }
  }, [selectedWorker, includeCompleted, fetchWorkerTasks, fetchSupplyRequests])

  const handleAddWorker = async (e) => {
    e.preventDefault()
    try {
      if (editingWorker) {
        await updateWorker(editingWorker.id, workerFormData)
      } else {
        const response = await createWorker(workerFormData)
        setSelectedWorker(response.data)
      }
      setShowAddWorker(false)
      setEditingWorker(null)
      resetWorkerForm()
      fetchWorkers()
    } catch (err) {
      console.error('Failed to save worker:', err)
    }
  }

  const handleDeleteWorker = async (workerId) => {
    if (!confirm('Deactivate this worker? Their assigned tasks will remain but can be reassigned.')) return
    try {
      await deleteWorker(workerId)
      if (selectedWorker?.id === workerId) {
        setSelectedWorker(null)
        setWorkerTasks([])
      }
      fetchWorkers()
    } catch (err) {
      console.error('Failed to delete worker:', err)
    }
  }

  const handleTaskSaved = () => {
    // Refresh tasks after EventModal saves
    setEditingTask(null)
    if (selectedWorker) {
      fetchWorkerTasks(selectedWorker.id)
      fetchWorkers()
    }
  }

  const handleEditTask = (task) => {
    setEditingTask(task)
    setShowEventModal(true)
  }

  const handleCompleteTask = async () => {
    if (!completeModal || !selectedWorker) return
    try {
      await completeWorkerTask(selectedWorker.id, completeModal.id, completeNote || null)
      setCompleteModal(null)
      setCompleteNote('')
      fetchWorkerTasks(selectedWorker.id)
      fetchWorkers()
    } catch (err) {
      console.error('Failed to complete task:', err)
    }
  }

  const handleBlockTask = async () => {
    if (!blockModal || !selectedWorker || !blockReason.trim()) return
    try {
      await blockWorkerTask(selectedWorker.id, blockModal.id, blockReason)
      setBlockModal(null)
      setBlockReason('')
      fetchWorkerTasks(selectedWorker.id)
    } catch (err) {
      console.error('Failed to block task:', err)
    }
  }

  const handleUnblockTask = async (taskId) => {
    if (!selectedWorker) return
    try {
      await unblockWorkerTask(selectedWorker.id, taskId)
      fetchWorkerTasks(selectedWorker.id)
    } catch (err) {
      console.error('Failed to unblock task:', err)
    }
  }

  const openAssignModal = async () => {
    setAssignableLoading(true)
    setShowAssignModal(true)
    try {
      const response = await getAssignableTasks()
      setAssignableTasks(response.data)
    } catch (err) {
      console.error('Failed to fetch assignable tasks:', err)
    } finally {
      setAssignableLoading(false)
    }
  }

  const handleAssignTask = async (taskId) => {
    if (!selectedWorker) return
    try {
      await assignTaskToWorker(selectedWorker.id, taskId)
      // Remove from assignable list
      setAssignableTasks(prev => prev.filter(t => t.id !== taskId))
      fetchWorkerTasks(selectedWorker.id)
      fetchWorkers()
    } catch (err) {
      console.error('Failed to assign task:', err)
    }
  }

  const handleUnassignTask = async (taskId) => {
    if (!selectedWorker) return
    try {
      await unassignTaskFromWorker(selectedWorker.id, taskId)
      fetchWorkerTasks(selectedWorker.id)
      fetchWorkers()
    } catch (err) {
      console.error('Failed to unassign task:', err)
    }
  }

  const openNoteModal = (task) => {
    setNoteModal(task)
    setWorkerNoteText(task.worker_note || '')
  }

  const handleSaveNote = async () => {
    if (!noteModal || !selectedWorker) return
    try {
      await updateWorkerNote(selectedWorker.id, noteModal.id, workerNoteText)
      setNoteModal(null)
      setWorkerNoteText('')
      fetchWorkerTasks(selectedWorker.id)
    } catch (err) {
      console.error('Failed to save note:', err)
    }
  }

  const handleStartTask = async (taskId) => {
    if (!selectedWorker) return
    try {
      await startWorkerTask(selectedWorker.id, taskId)
      fetchWorkerTasks(selectedWorker.id)
    } catch (err) {
      console.error('Failed to start task:', err)
    }
  }

  const handleRevertTask = async (taskId) => {
    if (!selectedWorker) return
    try {
      await stopWorkerTask(selectedWorker.id, taskId)
      fetchWorkerTasks(selectedWorker.id)
    } catch (err) {
      console.error('Failed to revert task:', err)
    }
  }

  const handleQuickComplete = async (taskId, e) => {
    e.stopPropagation()
    if (!selectedWorker) return
    try {
      await completeWorkerTask(selectedWorker.id, taskId)
      fetchWorkerTasks(selectedWorker.id)
    } catch (err) {
      console.error('Failed to complete task:', err)
    }
  }

  const handleToggleBacklog = async (taskId) => {
    if (!selectedWorker) return
    try {
      await toggleWorkerTaskBacklog(selectedWorker.id, taskId)
      fetchWorkerTasks(selectedWorker.id)
    } catch (err) {
      console.error('Failed to toggle backlog:', err)
    }
  }

  const handleMoveTask = async (taskId, direction, isBacklog) => {
    if (!selectedWorker) return
    const list = workerTasks.filter(t => (t.is_backlog || false) === isBacklog && !t.is_completed)
    const idx = list.findIndex(t => t.id === taskId)
    if (idx === -1) return
    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= list.length) return

    const reordered = [...list]
    const [moved] = reordered.splice(idx, 1)
    reordered.splice(newIdx, 0, moved)

    // Optimistic UI update
    const taskIds = reordered.map(t => t.id)
    const updatedTasks = workerTasks.map(t => {
      const orderIdx = taskIds.indexOf(t.id)
      if (orderIdx !== -1) return { ...t, sort_order: orderIdx }
      return t
    })
    setWorkerTasks(updatedTasks)

    try {
      await reorderWorkerTasks(selectedWorker.id, taskIds)
    } catch (err) {
      console.error('Failed to reorder tasks:', err)
      fetchWorkerTasks(selectedWorker.id) // Revert on error
    }
  }

  const handleUncompleteTask = async (taskId) => {
    if (!selectedWorker) return
    try {
      await uncompleteWorkerTask(selectedWorker.id, taskId)
      fetchWorkerTasks(selectedWorker.id)
    } catch (err) {
      console.error('Failed to uncomplete task:', err)
    }
  }

  const handleAddSupplyRequest = async (e) => {
    e.preventDefault()
    if (!selectedWorker || !supplyFormData.item_name.trim()) return
    try {
      await createSupplyRequest({
        worker_id: selectedWorker.id,
        item_name: supplyFormData.item_name.trim(),
        quantity: supplyFormData.quantity || 1,
        notes: supplyFormData.notes?.trim() || null
      })
      setShowSupplyModal(false)
      setSupplyFormData({ item_name: '', quantity: 1, notes: '' })
      fetchSupplyRequests(selectedWorker.id)
    } catch (err) {
      console.error('Failed to create supply request:', err)
    }
  }

  const handleDeleteSupplyRequest = async (requestId) => {
    if (!confirm('Delete this supply request?')) return
    try {
      await deleteSupplyRequest(requestId)
      fetchSupplyRequests(selectedWorker.id)
    } catch (err) {
      console.error('Failed to delete supply request:', err)
    }
  }

  const handleUpdateSupplyStatus = async (requestId, newStatus) => {
    try {
      await updateSupplyRequest(requestId, { status: newStatus })
      fetchSupplyRequests(selectedWorker.id)
    } catch (err) {
      console.error('Failed to update supply request status:', err)
    }
  }

  const handleEditSupplyRequest = async (e) => {
    e.preventDefault()
    if (!editingSupplyRequest || !supplyFormData.item_name.trim()) return
    try {
      await updateSupplyRequest(editingSupplyRequest.id, {
        item_name: supplyFormData.item_name.trim(),
        quantity: supplyFormData.quantity || 1,
        notes: supplyFormData.notes?.trim() || null
      })
      setEditingSupplyRequest(null)
      setShowSupplyModal(false)
      setSupplyFormData({ item_name: '', quantity: 1, notes: '' })
      fetchSupplyRequests(selectedWorker.id)
    } catch (err) {
      console.error('Failed to update supply request:', err)
    }
  }

  const startEditSupplyRequest = (request) => {
    setEditingSupplyRequest(request)
    setSupplyFormData({
      item_name: request.item_name,
      quantity: request.quantity,
      notes: request.notes || ''
    })
    setShowSupplyModal(true)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-amber-900/50 text-amber-300 border-amber-500/50'
      case 'approved': return 'bg-blue-900/50 text-blue-300 border-blue-500/50'
      case 'purchased': return 'bg-purple-900/50 text-purple-300 border-purple-500/50'
      case 'delivered': return 'bg-green-900/50 text-green-300 border-green-500/50'
      case 'denied': return 'bg-red-900/50 text-red-300 border-red-500/50'
      default: return 'bg-gray-700 text-gray-300 border-gray-500/50'
    }
  }

  // Status label now uses translation - pass t function
  const getStatusLabel = (status, t) => {
    return t(`supply.status.${status}`) || status
  }

  const startEditWorker = (worker) => {
    setEditingWorker(worker)
    setWorkerFormData({
      name: worker.name,
      role: worker.role || '',
      phone: worker.phone || '',
      email: worker.email || '',
      notes: worker.notes || '',
      language: worker.language || 'en',
    })
    setShowAddWorker(true)
  }

  const resetWorkerForm = () => {
    setWorkerFormData({
      name: '',
      role: '',
      phone: '',
      email: '',
      notes: '',
      language: 'en',
    })
  }


  const getRoleIcon = (role, size = 'text-base') => {
    const iconClass = size === 'text-3xl' ? 'w-8 h-8' : 'w-5 h-5'
    const iconStyle = { color: 'var(--color-text-muted)' }
    if (!role) return <User className={`inline ${iconClass}`} style={iconStyle} />
    const normalized = role.toLowerCase()
    const IconComponent = ROLE_ICON_COMPONENTS[normalized] || User
    return <IconComponent className={`inline ${iconClass}`} style={iconStyle} />
  }

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 1: return { label: 'High', class: 'text-red-400' }
      case 2: return { label: 'Medium', class: 'text-yellow-400' }
      case 3: return { label: 'Low', class: 'text-green-400' }
      default: return { label: 'Medium', class: 'text-yellow-400' }
    }
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
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-shrink-0">
          <ClipboardList className="w-8 h-8 text-farm-green" />
          <h1 className="text-2xl font-bold">{t('pageTitle')}</h1>
        </div>
        <MottoDisplay />
        {/* Spacer to balance the layout */}
        <div className="w-32 flex-shrink-0"></div>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Worker Tabs */}
      <div className="flex flex-wrap gap-2 pb-2 border-b border-gray-700">
        {workers.map(worker => (
          <button
            key={worker.id}
            onClick={() => setSelectedWorker(worker)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              selectedWorker?.id === worker.id
                ? 'bg-farm-green text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <span>{getRoleIcon(worker.role)}</span>
            <span>{worker.name}</span>
            {worker.task_count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                selectedWorker?.id === worker.id ? 'bg-white/20' : 'bg-gray-600'
              }`}>
                {worker.task_count}
              </span>
            )}
          </button>
        ))}
        <button
          onClick={() => { setShowAddWorker(true); setEditingWorker(null); resetWorkerForm(); }}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-farm-green hover:text-farm-green"
        >
          <Plus className="w-4 h-4" />
          {t('addWorker')}
        </button>
      </div>

      {/* Selected Worker Content */}
      {selectedWorker ? (
        <div className="space-y-4">
          {/* Worker Info Bar */}
          <div className="flex items-center justify-between bg-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-4">
              <span className="text-3xl">{getRoleIcon(selectedWorker.role, 'text-3xl')}</span>
              <div>
                <h2 className="text-xl font-bold">{selectedWorker.name}</h2>
                <p className="text-gray-400 text-sm">{selectedWorker.role || 'No role specified'}</p>
              </div>
              {selectedWorker.phone && (
                <div className="flex items-center gap-1 text-sm text-gray-400">
                  <Phone className="w-4 h-4" />
                  {displayPhone(selectedWorker.phone)}
                </div>
              )}
              {selectedWorker.email && (
                <div className="flex items-center gap-1 text-sm text-gray-400">
                  <Mail className="w-4 h-4" />
                  {selectedWorker.email}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => startEditWorker(selectedWorker)}
                className="p-2 rounded-lg"
                style={{ color: 'var(--color-blue-600)' }}
                title="Edit Worker"
              >
                <Edit className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleDeleteWorker(selectedWorker.id)}
                className="p-2 text-red-400 hover:bg-red-400/20 rounded-lg"
                title="Deactivate Worker"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex gap-2 bg-gray-800 rounded-lg p-1 w-fit">
            <button
              onClick={() => setViewMode('tasks')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                viewMode === 'tasks' ? 'bg-farm-green text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              {t('tasks')}
              {workerTasks.length > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  viewMode === 'tasks' ? 'bg-white/20' : 'bg-gray-600'
                }`}>
                  {workerTasks.filter(task => !task.is_completed).length}
                </span>
              )}
            </button>
            <button
              onClick={() => setViewMode('supplies')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                viewMode === 'supplies' ? 'bg-farm-green text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              {t('supplyRequests')}
              {supplyRequests.length > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  viewMode === 'supplies' ? 'bg-white/20' : 'bg-gray-600'
                }`}>
                  {supplyRequests.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>
          </div>

          {/* Tasks Header */}
          {viewMode === 'tasks' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold">{t('tasksFor')} {selectedWorker.name}</h3>
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <input
                  type="checkbox"
                  checked={includeCompleted}
                  onChange={(e) => setIncludeCompleted(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                {t('showCompleted')}
              </label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={openAssignModal}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
              >
                <Link className="w-4 h-4" />
                {t('assignExisting')}
              </button>
              <button
                onClick={() => setShowEventModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-farm-green text-white rounded-lg hover:bg-farm-green-light"
              >
                <Plus className="w-4 h-4" />
                {t('newTask')}
              </button>
            </div>
          </div>
          )}

          {/* Tasks List */}
          {viewMode === 'tasks' && (
          <>
          {tasksLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-farm-green"></div>
            </div>
          ) : workerTasks.length > 0 ? (
            <>
            {/* Active Tasks */}
            {(() => {
              const activeTasks = workerTasks.filter(t => !(t.is_backlog)).sort((a, b) => {
                if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1
                return (a.sort_order ?? 999) - (b.sort_order ?? 999)
              })
              const backlogTasks = workerTasks.filter(t => t.is_backlog).sort((a, b) => {
                if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1
                return (a.sort_order ?? 999) - (b.sort_order ?? 999)
              })
              return (
                <>
                <div className="space-y-2">
                  {activeTasks.length > 0 ? activeTasks.map((task, idx) => {
                    const activeIncomplete = activeTasks.filter(t => !t.is_completed)
                    const taskIdxInList = activeIncomplete.findIndex(t => t.id === task.id)
                    return (
                    <div
                      key={task.id}
                      className={`bg-gray-800 rounded-lg overflow-hidden ${
                        task.is_completed ? 'opacity-60' : task.is_blocked ? 'border-l-4 border-orange-500' : ''
                      }`}
                    >
                      {/* Task Header */}
                      <div
                        className="p-4 cursor-pointer hover:bg-gray-700/50"
                        onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {/* Reorder buttons */}
                            {!task.is_completed && (
                              <div className="flex flex-col gap-0.5">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleMoveTask(task.id, 'up', false); }}
                                  disabled={taskIdxInList <= 0}
                                  className="p-0.5 text-gray-500 hover:text-white disabled:opacity-20"
                                  title="Move up"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleMoveTask(task.id, 'down', false); }}
                                  disabled={taskIdxInList >= activeIncomplete.length - 1 || taskIdxInList === -1}
                                  className="p-0.5 text-gray-500 hover:text-white disabled:opacity-20"
                                  title="Move down"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                            {/* Quick complete checkbox */}
                            {task.is_completed ? (
                              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            ) : task.is_blocked ? (
                              <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center">
                                <Ban className="w-4 h-4 text-orange-400" />
                              </div>
                            ) : (
                              <button
                                onClick={(e) => handleQuickComplete(task.id, e)}
                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors hover:border-green-400 hover:bg-green-500/10 ${
                                  task.is_in_progress ? 'border-blue-400' : 'border-gray-500'
                                }`}
                                title="Complete task"
                              >
                                {task.is_in_progress && <Play className="w-3 h-3 text-blue-400" />}
                              </button>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={task.is_completed ? 'line-through text-gray-400' : ''}>
                                  {task.title}
                                </span>
                                {task.is_in_progress && (
                                  <span className="px-1.5 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">{t('task.inProgress')}</span>
                                )}
                                {task.is_blocked && (
                                  <span className="px-1.5 py-0.5 text-xs bg-orange-500/20 text-orange-400 rounded">{t('task.blocked')}</span>
                                )}
                              </div>
                              {task.worker_note && expandedTask !== task.id && (
                                <div className="text-xs text-purple-400 mt-0.5 truncate">
                                  <StickyNote className="w-3 h-3 inline mr-1" />
                                  {task.worker_note}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {task.due_date && (
                              <span className="text-sm text-gray-400">
                                {format(new Date(task.due_date), 'MM/dd/yyyy')}
                                {task.due_time && ` ${formatTime(task.due_time)}`}
                              </span>
                            )}
                            {expandedTask === task.id ? (
                              <ChevronUp className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Task Details */}
                      {expandedTask === task.id && (
                        <div className="border-t border-gray-700 p-4 space-y-3">
                          {task.description && (
                            <p className="text-gray-300 text-sm">{task.description}</p>
                          )}

                          <div className="flex flex-wrap gap-4 text-sm">
                            <span className={getPriorityLabel(task.priority).class}>
                              {getPriorityLabel(task.priority).label} Priority
                            </span>
                            {task.category && (
                              <span className="text-gray-400">Category: {task.category}</span>
                            )}
                          </div>

                          {task.is_blocked && task.blocked_reason && (
                            <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-3">
                              <div className="flex items-center gap-2 text-orange-400 mb-1">
                                <AlertCircle className="w-4 h-4" />
                                <span className="font-medium">Blocked</span>
                              </div>
                              <p className="text-sm text-gray-300">{task.blocked_reason}</p>
                            </div>
                          )}

                          {task.is_completed && task.completion_note && (
                            <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3">
                              <div className="flex items-center gap-2 text-green-400 mb-1">
                                <Check className="w-4 h-4" />
                                <span className="font-medium">Completion Note</span>
                              </div>
                              <p className="text-sm text-gray-300">{task.completion_note}</p>
                            </div>
                          )}

                          {task.worker_note && (
                            <div className="bg-purple-500/20 border border-purple-500/50 rounded-lg p-3">
                              <div className="flex items-center gap-2 text-purple-400 mb-1">
                                <StickyNote className="w-4 h-4" />
                                <span className="font-medium">Worker Note</span>
                              </div>
                              <p className="text-sm text-gray-300">{task.worker_note}</p>
                            </div>
                          )}

                          {!task.is_completed && (
                            <div className="flex flex-wrap gap-2 pt-2">
                              {task.is_blocked ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleUnblockTask(task.id); }}
                                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
                                >
                                  <X className="w-4 h-4" />
                                  {t('task.clearBlock')}
                                </button>
                              ) : (
                                <>
                                  {!task.is_in_progress ? (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleStartTask(task.id); }}
                                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
                                    >
                                      <Play className="w-4 h-4" />
                                      {t('task.start')}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleRevertTask(task.id); }}
                                      className="flex items-center gap-2 px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500"
                                    >
                                      <RotateCcw className="w-4 h-4" />
                                      {t('task.revert')}
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setCompleteModal(task); }}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500"
                                  >
                                    <Check className="w-4 h-4" />
                                    {t('task.complete')}
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setBlockModal(task); }}
                                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500"
                                  >
                                    <Ban className="w-4 h-4" />
                                    {t('task.cannotComplete')}
                                  </button>
                                </>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleToggleBacklog(task.id); }}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500"
                                title="Move to backlog"
                              >
                                <Archive className="w-4 h-4" />
                                Backlog
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEditTask(task); }}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
                                title={t('task.edit')}
                              >
                                <Edit className="w-4 h-4" />
                                {t('task.edit')}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleUnassignTask(task.id); }}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500"
                                title={t('task.unassign')}
                              >
                                <Unlink className="w-4 h-4" />
                                {t('task.unassign')}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); openNoteModal(task); }}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500"
                                title={task.worker_note ? t('task.editNote') : t('task.addNote')}
                              >
                                <StickyNote className="w-4 h-4" />
                                {task.worker_note ? t('task.editNote') : t('task.addNote')}
                              </button>
                            </div>
                          )}

                          {/* Actions for completed tasks */}
                          {task.is_completed && (
                            <div className="flex flex-wrap gap-2 pt-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleUncompleteTask(task.id); }}
                                className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-500"
                              >
                                <RotateCcw className="w-4 h-4" />
                                {t('task.markIncomplete')}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEditTask(task); }}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
                                title={t('task.edit')}
                              >
                                <Edit className="w-4 h-4" />
                                {t('task.edit')}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}) : (
                    <div className="text-center py-6 text-gray-500 text-sm">
                      No active tasks
                    </div>
                  )}
                </div>

                {/* Backlog Section */}
                {backlogTasks.length > 0 && (
                  <div className="mt-4">
                    <button
                      onClick={() => setShowBacklog(!showBacklog)}
                      className="flex items-center gap-2 text-gray-400 hover:text-white mb-2"
                    >
                      <Archive className="w-4 h-4" />
                      <span className="font-medium">Backlog ({backlogTasks.filter(t => !t.is_completed).length})</span>
                      {showBacklog ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {showBacklog && (
                      <div className="space-y-2 border-l-2 border-gray-700 pl-3">
                        {backlogTasks.map((task, idx) => {
                          const backlogIncomplete = backlogTasks.filter(t => !t.is_completed)
                          const taskIdxInList = backlogIncomplete.findIndex(t => t.id === task.id)
                          return (
                          <div
                            key={task.id}
                            className={`bg-gray-800/60 rounded-lg overflow-hidden ${
                              task.is_completed ? 'opacity-60' : task.is_blocked ? 'border-l-4 border-orange-500' : ''
                            }`}
                          >
                            <div
                              className="p-3 cursor-pointer hover:bg-gray-700/50"
                              onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  {/* Reorder buttons */}
                                  {!task.is_completed && (
                                    <div className="flex flex-col gap-0.5">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleMoveTask(task.id, 'up', true); }}
                                        disabled={taskIdxInList <= 0}
                                        className="p-0.5 text-gray-500 hover:text-white disabled:opacity-20"
                                        title="Move up"
                                      >
                                        <ArrowUp className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleMoveTask(task.id, 'down', true); }}
                                        disabled={taskIdxInList >= backlogIncomplete.length - 1 || taskIdxInList === -1}
                                        className="p-0.5 text-gray-500 hover:text-white disabled:opacity-20"
                                        title="Move down"
                                      >
                                        <ArrowDown className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                  {task.is_completed ? (
                                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                                      <Check className="w-3 h-3 text-white" />
                                    </div>
                                  ) : (
                                    <button
                                      onClick={(e) => handleQuickComplete(task.id, e)}
                                      className="w-5 h-5 rounded-full border-2 border-gray-500 flex items-center justify-center transition-colors hover:border-green-400"
                                      title="Complete task"
                                    />
                                  )}
                                  <span className={`text-sm ${task.is_completed ? 'line-through text-gray-400' : ''}`}>
                                    {task.title}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {!task.is_completed && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleToggleBacklog(task.id); }}
                                      className="p-1 text-gray-500 hover:text-blue-400"
                                      title="Move to active"
                                    >
                                      <Inbox className="w-4 h-4" />
                                    </button>
                                  )}
                                  {expandedTask === task.id ? (
                                    <ChevronUp className="w-4 h-4 text-gray-400" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                  )}
                                </div>
                              </div>
                            </div>
                            {expandedTask === task.id && (
                              <div className="border-t border-gray-700 p-3 space-y-2">
                                {task.description && (
                                  <p className="text-gray-300 text-sm">{task.description}</p>
                                )}
                                <div className="flex flex-wrap gap-2">
                                  {!task.is_completed && (
                                    <>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleToggleBacklog(task.id); }}
                                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-500"
                                      >
                                        <Inbox className="w-3.5 h-3.5" />
                                        Move to Active
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleEditTask(task); }}
                                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-600 rounded hover:bg-gray-500"
                                      >
                                        <Edit className="w-3.5 h-3.5" />
                                        Edit
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleUnassignTask(task.id); }}
                                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-600 rounded hover:bg-gray-500"
                                      >
                                        <Unlink className="w-3.5 h-3.5" />
                                        Unassign
                                      </button>
                                    </>
                                  )}
                                  {task.is_completed && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleUncompleteTask(task.id); }}
                                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-500"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                      Mark Incomplete
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )})}
                      </div>
                    )}
                  </div>
                )}
                </>
              )
            })()}
            </>
          ) : (
            <div className="text-center py-12 text-gray-400 bg-gray-800 rounded-lg">
              <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('noTasks')} {selectedWorker.name}</p>
              <button
                onClick={() => setShowEventModal(true)}
                className="mt-4 px-4 py-2 bg-farm-green text-white rounded-lg hover:bg-farm-green-light"
              >
                {t('addFirstTask')}
              </button>
            </div>
          )}
          </>
          )}

          {/* Supply Requests Section */}
          {viewMode === 'supplies' && (
          <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold">{t('supply.requestsFrom')} {selectedWorker.name}</h3>
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <input
                  type="checkbox"
                  checked={includeCompleted}
                  onChange={(e) => setIncludeCompleted(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                {t('showCompleted')}
              </label>
            </div>
            <button
              onClick={() => setShowSupplyModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-farm-green text-white rounded-lg hover:bg-farm-green-light"
            >
              <Plus className="w-4 h-4" />
              {t('supply.requestSupply')}
            </button>
          </div>

          {supplyRequests.length > 0 ? (
            <div className="space-y-2">
              {supplyRequests.map(request => (
                <div
                  key={request.id}
                  className={`bg-gray-800 rounded-lg p-4 ${
                    request.status === 'delivered' || request.status === 'denied' ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Package className="w-5 h-5 text-gray-400" />
                      <div>
                        <span className="font-medium">{request.item_name}</span>
                        {request.quantity > 1 && (
                          <span className="ml-2 text-gray-400">x{request.quantity}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 text-xs rounded border ${getStatusColor(request.status)}`}>
                        {getStatusLabel(request.status, t)}
                      </span>
                    </div>
                  </div>
                  {request.notes && (
                    <p className="mt-2 text-sm text-gray-400 pl-8">{request.notes}</p>
                  )}
                  {request.admin_notes && (
                    <div className="mt-2 pl-8 text-sm">
                      <span className="text-blue-400">Note: </span>
                      <span className="text-gray-300">{request.admin_notes}</span>
                    </div>
                  )}
                  <div className="mt-2 pl-8 text-xs text-gray-500">
                    {t('supply.requested')} {format(new Date(request.created_at), 'MM/dd/yyyy')}
                  </div>
                  {/* Action buttons based on status */}
                  <div className="mt-3 flex flex-wrap gap-2 pl-8">
                    {request.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleUpdateSupplyStatus(request.id, 'approved')}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500"
                        >
                          <Check className="w-3 h-3" />
                          {t('supply.approve')}
                        </button>
                        <button
                          onClick={() => handleUpdateSupplyStatus(request.id, 'denied')}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-500"
                        >
                          <X className="w-3 h-3" />
                          {t('supply.deny')}
                        </button>
                      </>
                    )}
                    {request.status === 'approved' && (
                      <>
                        <button
                          onClick={() => handleUpdateSupplyStatus(request.id, 'purchased')}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-500"
                        >
                          <ShoppingCart className="w-3 h-3" />
                          {t('supply.markPurchased')}
                        </button>
                        <button
                          onClick={() => handleUpdateSupplyStatus(request.id, 'pending')}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-600 rounded-lg hover:bg-gray-500"
                        >
                          <RotateCcw className="w-3 h-3" />
                          {t('supply.backToPending')}
                        </button>
                      </>
                    )}
                    {request.status === 'purchased' && (
                      <>
                        <button
                          onClick={() => handleUpdateSupplyStatus(request.id, 'delivered')}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-500"
                        >
                          <Check className="w-3 h-3" />
                          {t('supply.markDelivered')}
                        </button>
                        <button
                          onClick={() => handleUpdateSupplyStatus(request.id, 'approved')}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-600 rounded-lg hover:bg-gray-500"
                        >
                          <RotateCcw className="w-3 h-3" />
                          {t('supply.backToApproved')}
                        </button>
                      </>
                    )}
                    {request.status === 'delivered' && (
                      <button
                        onClick={() => handleUpdateSupplyStatus(request.id, 'purchased')}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-600 rounded-lg hover:bg-gray-500"
                      >
                        <RotateCcw className="w-3 h-3" />
                        {t('supply.backToPurchased')}
                      </button>
                    )}
                    {request.status === 'denied' && (
                      <button
                        onClick={() => handleUpdateSupplyStatus(request.id, 'pending')}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-600 rounded-lg hover:bg-gray-500"
                      >
                        <RotateCcw className="w-3 h-3" />
                        {t('supply.reopen')}
                      </button>
                    )}
                    {/* Edit and delete - available for all statuses */}
                    <button
                      onClick={() => startEditSupplyRequest(request)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-600 rounded-lg hover:bg-gray-500"
                    >
                      <Edit className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteSupplyRequest(request.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-600 rounded-lg hover:bg-gray-500 text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 bg-gray-800 rounded-lg">
              <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('supply.noRequests')} {selectedWorker.name}</p>
              <button
                onClick={() => setShowSupplyModal(true)}
                className="mt-4 px-4 py-2 bg-farm-green text-white rounded-lg hover:bg-farm-green-light"
              >
                {t('supply.requestFirst')}
              </button>
            </div>
          )}
          </>
          )}
        </div>
      ) : workers.length === 0 ? (
        <div className="text-center py-12 rounded-lg" style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)' }}>
          <User className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-text-muted)', opacity: 0.5 }} />
          <p>No workers yet. Add one to get started!</p>
          <button
            onClick={() => { setShowAddWorker(true); setEditingWorker(null); resetWorkerForm(); }}
            className="mt-4 px-4 py-2 bg-farm-green text-white rounded-lg hover:bg-farm-green-light"
          >
            Add Your First Worker
          </button>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400 bg-gray-800 rounded-lg">
          <p>{t('selectWorker')}</p>
        </div>
      )}

      {/* Add/Edit Worker Modal */}
      {showAddWorker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingWorker ? t('worker.editWorker') : t('worker.addWorker')}
            </h2>
            <form onSubmit={handleAddWorker} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('worker.name')}</label>
                <input
                  type="text"
                  value={workerFormData.name}
                  onChange={(e) => setWorkerFormData({ ...workerFormData, name: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  placeholder={t('worker.namePlaceholder')}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('worker.role')}</label>
                <input
                  type="text"
                  value={workerFormData.role}
                  onChange={(e) => setWorkerFormData({ ...workerFormData, role: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  placeholder={t('worker.rolePlaceholder')}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">{t('worker.phone')}</label>
                  <input
                    type="tel"
                    value={workerFormData.phone}
                    onChange={(e) => setWorkerFormData({ ...workerFormData, phone: formatPhoneNumber(e.target.value) })}
                    placeholder="(000)000-0000"
                    className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">{t('worker.email')}</label>
                  <input
                    type="email"
                    value={workerFormData.email}
                    onChange={(e) => setWorkerFormData({ ...workerFormData, email: e.target.value })}
                    className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('worker.notes')}</label>
                <textarea
                  value={workerFormData.notes}
                  onChange={(e) => setWorkerFormData({ ...workerFormData, notes: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  rows={2}
                  placeholder={t('worker.notesPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('worker.language')}</label>
                <select
                  value={workerFormData.language}
                  onChange={(e) => setWorkerFormData({ ...workerFormData, language: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                >
                  <option value="en">English</option>
                  <option value="es">Español (Spanish)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">{t('worker.languageHint')}</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowAddWorker(false); setEditingWorker(null); }}
                  className="flex-1 px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500"
                >
                  {t('modal.cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-farm-green text-white rounded-lg hover:bg-farm-green-light"
                >
                  {editingWorker ? t('worker.update') : t('worker.add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Event Modal for creating/editing tasks */}
      {showEventModal && selectedWorker && (
        <EventModal
          event={editingTask}
          defaultDate={new Date()}
          defaultWorkerId={selectedWorker.id}
          forWorkerTask={true}
          onClose={() => { setShowEventModal(false); setEditingTask(null); }}
          onSaved={handleTaskSaved}
        />
      )}

      {/* Complete Task Modal */}
      {completeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">{t('modal.completeTask')}</h2>
            <p className="text-gray-300 mb-4">{completeModal.title}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('modal.completionNoteOptional')}</label>
                <textarea
                  value={completeNote}
                  onChange={(e) => setCompleteNote(e.target.value)}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  rows={2}
                  placeholder={t('modal.completionNotePlaceholder')}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setCompleteModal(null); setCompleteNote(''); }}
                  className="flex-1 px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500"
                >
                  {t('modal.cancel')}
                </button>
                <button
                  onClick={handleCompleteTask}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500"
                >
                  {t('task.complete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Block Task Modal */}
      {blockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-orange-400" />
              {t('modal.cannotCompleteTask')}
            </h2>
            <p className="text-gray-300 mb-4">{blockModal.title}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('modal.reasonRequired')}</label>
                <textarea
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  rows={3}
                  placeholder={t('modal.reasonPlaceholder')}
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setBlockModal(null); setBlockReason(''); }}
                  className="flex-1 px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500"
                >
                  {t('modal.cancel')}
                </button>
                <button
                  onClick={handleBlockTask}
                  disabled={!blockReason.trim()}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('modal.markBlocked')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Existing Task Modal */}
      {showAssignModal && selectedWorker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                Assign Task to {selectedWorker.name}
              </h2>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-1 text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Select an existing task to assign to this worker. Assigned tasks will only appear here and won't show on the dashboard or calendar.
            </p>
            <div className="flex-1 overflow-y-auto">
              {assignableLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-farm-green"></div>
                </div>
              ) : assignableTasks.length > 0 ? (
                <div className="space-y-2">
                  {assignableTasks.map(task => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between bg-gray-700 rounded-lg p-3 hover:bg-gray-600"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{task.title}</div>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          {task.due_date && <span>{task.due_date}</span>}
                          {task.category && <span className="px-2 py-0.5 bg-gray-600 rounded text-xs">{task.category}</span>}
                          {task.task_type && <span className="px-2 py-0.5 bg-blue-600/30 rounded text-xs">{task.task_type}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleAssignTask(task.id)}
                        className="ml-3 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        Assign
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No unassigned tasks available</p>
                  <p className="text-sm mt-2">Create a new task or unassign one from another worker</p>
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700">
              <button
                onClick={() => setShowAssignModal(false)}
                className="w-full px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supply Request Modal (Create or Edit) */}
      {showSupplyModal && selectedWorker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-farm-green" />
              {editingSupplyRequest ? t('supply.editRequest') : t('supply.requestSupply')}
            </h2>
            <form onSubmit={editingSupplyRequest ? handleEditSupplyRequest : handleAddSupplyRequest} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('supply.itemNeeded')}</label>
                <input
                  type="text"
                  value={supplyFormData.item_name}
                  onChange={(e) => setSupplyFormData({ ...supplyFormData, item_name: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  placeholder={t('supply.itemPlaceholder')}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('supply.quantity')}</label>
                <input
                  type="number"
                  min="1"
                  value={supplyFormData.quantity}
                  onChange={(e) => setSupplyFormData({ ...supplyFormData, quantity: parseInt(e.target.value) || 1 })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('supply.notesOptional')}</label>
                <textarea
                  value={supplyFormData.notes}
                  onChange={(e) => setSupplyFormData({ ...supplyFormData, notes: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  rows={2}
                  placeholder={t('supply.notesPlaceholder')}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowSupplyModal(false); setEditingSupplyRequest(null); setSupplyFormData({ item_name: '', quantity: 1, notes: '' }); }}
                  className="flex-1 px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500"
                >
                  {t('modal.cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-farm-green text-white rounded-lg hover:bg-farm-green-light"
                >
                  {editingSupplyRequest ? t('supply.saveChanges') : t('supply.submitRequest')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Worker Note Modal */}
      {noteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <StickyNote className="w-6 h-6 text-purple-400" />
              {noteModal.worker_note ? 'Edit Note' : 'Add Note'}
            </h2>
            <p className="text-gray-300 mb-4">{noteModal.title}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Your Note</label>
                <textarea
                  value={workerNoteText}
                  onChange={(e) => setWorkerNoteText(e.target.value)}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2"
                  rows={4}
                  placeholder="e.g., Started cleaning, waiting for supplies, needs follow-up..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setNoteModal(null); setWorkerNoteText(''); }}
                  className="flex-1 px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNote}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500"
                >
                  Save Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WorkerTasks
