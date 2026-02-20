import React, { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle, Circle, Plus, Trash2, Edit2, X, GripVertical,
  RotateCcw, Clock, ChevronDown, ChevronUp, Copy, AlertTriangle,
  ListOrdered, Settings, History, Archive, Inbox, Languages
} from 'lucide-react'
import {
  getWorkerStandardTasks, createWorkerStandardTask, updateWorkerStandardTask,
  deleteWorkerStandardTask, reorderWorkerStandardTasks,
  getCurrentWorkerVisit, getWorkerVisits, addWorkerVisitTask,
  updateWorkerVisitTask, deleteWorkerVisitTask, reorderWorkerVisitTasks,
  completeWorkerVisit, duplicateWorkerVisit, toggleWorkerVisitTaskBacklog
} from '../../services/api'

// UI translations for different languages
const UI_TRANSLATIONS = {
  es: {
    visitTasks: 'Tareas de Visita',
    standardTasks: 'Tareas Estándar',
    standardTasksEveryVisit: 'Tareas Estándar (Cada Visita)',
    standardTasksDesc: 'Estas tareas se agregan automáticamente a cada visita. Reordena para establecer prioridad.',
    addStandardTask: 'Agregar tarea estándar...',
    currentVisit: 'Visita Actual',
    completeVisit: 'Completar Visita',
    done: 'hechas',
    completeInOrder: 'Completa las tareas en orden de arriba a abajo',
    noTasksYet: 'No hay tareas aún. Agrega tareas estándar o tareas únicas abajo.',
    standard: 'Estándar',
    thisVisit: 'Esta Visita',
    doNext: 'SIGUIENTE',
    moveToBacklog: 'Mover a pendientes',
    backlog: 'Pendientes',
    moveToActive: 'Mover a activas',
    completed: 'Completadas',
    addTaskThisVisit: 'Agregar tarea solo para esta visita:',
    exampleTask: 'ej., Limpiar horno profundo...',
    showVisitHistory: 'Mostrar Historial de Visitas',
    hideVisitHistory: 'Ocultar Historial de Visitas',
    duplicate: 'Duplicar',
    tasksCompleted: 'tareas completadas',
    more: 'más',
    original: 'Original',
    translated: 'Traducido'
  }
}

function WorkerVisitTasksTab({ worker }) {
  const [loading, setLoading] = useState(true)
  const [standardTasks, setStandardTasks] = useState([])
  const [currentVisit, setCurrentVisit] = useState(null)
  const [visitHistory, setVisitHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [showStandardSettings, setShowStandardSettings] = useState(false)
  const [editingStandardTask, setEditingStandardTask] = useState(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newOneOffTitle, setNewOneOffTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [draggedTaskId, setDraggedTaskId] = useState(null)
  const [showBacklog, setShowBacklog] = useState(true)
  const [showOriginal, setShowOriginal] = useState(false) // Toggle for showing original English text

  // Check if worker has a non-English language (translation is active)
  const isTranslated = worker?.language && worker.language !== 'en'

  // Get translation for a UI string
  const t = (key, fallback) => {
    if (!isTranslated || showOriginal) return fallback
    const lang = worker?.language
    return UI_TRANSLATIONS[lang]?.[key] || fallback
  }

  // Helper to get task title based on translation toggle
  const getTaskTitle = (task) => {
    if (showOriginal && task.original_title) {
      return task.original_title
    }
    return task.title
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [stdRes, visitRes, historyRes] = await Promise.all([
        getWorkerStandardTasks(worker.id),
        getCurrentWorkerVisit(worker.id),
        getWorkerVisits(worker.id, { limit: 10, include_completed: true })
      ])
      setStandardTasks(stdRes.data || [])
      setCurrentVisit(visitRes.data)
      // Exclude current visit from history
      const history = (historyRes.data || []).filter(v => v.id !== visitRes.data?.id)
      setVisitHistory(history)
    } catch (err) {
      console.error('Failed to load worker visit data:', err)
    } finally {
      setLoading(false)
    }
  }, [worker.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
  }

  // Standard task management
  const handleAddStandardTask = async () => {
    if (!newTaskTitle.trim() || saving) return
    setSaving(true)
    try {
      const maxOrder = Math.max(0, ...standardTasks.map(t => t.sort_order))
      await createWorkerStandardTask(worker.id, {
        title: newTaskTitle.trim(),
        sort_order: maxOrder + 1
      })
      setNewTaskTitle('')
      await loadData()
    } catch (err) {
      console.error('Failed to add standard task:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateStandardTask = async () => {
    if (!editingStandardTask?.title?.trim() || saving) return
    setSaving(true)
    try {
      await updateWorkerStandardTask(worker.id, editingStandardTask.id, {
        title: editingStandardTask.title,
        description: editingStandardTask.description
      })
      setEditingStandardTask(null)
      await loadData()
    } catch (err) {
      console.error('Failed to update standard task:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteStandardTask = async (taskId) => {
    if (saving) return
    setSaving(true)
    try {
      await deleteWorkerStandardTask(worker.id, taskId)
      await loadData()
    } catch (err) {
      console.error('Failed to delete standard task:', err)
    } finally {
      setSaving(false)
    }
  }

  // Visit task management
  const handleAddOneOffTask = async () => {
    if (!newOneOffTitle.trim() || !currentVisit || saving) return
    setSaving(true)
    try {
      const maxOrder = Math.max(0, ...currentVisit.tasks.map(t => t.sort_order))
      await addWorkerVisitTask(worker.id, currentVisit.id, {
        title: newOneOffTitle.trim(),
        sort_order: maxOrder + 1
      })
      setNewOneOffTitle('')
      await loadData()
    } catch (err) {
      console.error('Failed to add one-off task:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleTaskComplete = async (task) => {
    if (!currentVisit || saving) return
    setSaving(true)
    try {
      await updateWorkerVisitTask(worker.id, currentVisit.id, task.id, {
        is_completed: !task.is_completed
      })
      await loadData()
    } catch (err) {
      console.error('Failed to toggle task:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteVisitTask = async (taskId) => {
    if (!currentVisit || saving) return
    setSaving(true)
    try {
      await deleteWorkerVisitTask(worker.id, currentVisit.id, taskId)
      await loadData()
    } catch (err) {
      console.error('Failed to delete task:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleCompleteVisit = async () => {
    if (!currentVisit || saving) return
    if (!confirm('Complete this visit? Standard tasks will reset for the next visit.')) return
    setSaving(true)
    try {
      await completeWorkerVisit(worker.id, currentVisit.id)
      await loadData()
    } catch (err) {
      console.error('Failed to complete visit:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDuplicateVisit = async (visitId) => {
    if (saving) return
    setSaving(true)
    try {
      await duplicateWorkerVisit(worker.id, visitId)
      await loadData()
    } catch (err) {
      console.error('Failed to duplicate visit:', err)
    } finally {
      setSaving(false)
    }
  }

  // Toggle backlog status
  const handleToggleBacklog = async (task) => {
    if (!currentVisit || saving) return
    setSaving(true)
    try {
      await toggleWorkerVisitTaskBacklog(worker.id, currentVisit.id, task.id)
      await loadData()
    } catch (err) {
      console.error('Failed to toggle backlog:', err)
    } finally {
      setSaving(false)
    }
  }

  // Drag and drop for reordering
  const handleDragStart = (taskId) => {
    setDraggedTaskId(taskId)
  }

  const handleDragOver = (e, targetTaskId) => {
    e.preventDefault()
    if (draggedTaskId === targetTaskId) return
  }

  const handleDrop = async (e, targetTaskId) => {
    e.preventDefault()
    if (!draggedTaskId || draggedTaskId === targetTaskId || !currentVisit) return

    const tasks = [...currentVisit.tasks]
    const draggedIdx = tasks.findIndex(t => t.id === draggedTaskId)
    const targetIdx = tasks.findIndex(t => t.id === targetTaskId)

    if (draggedIdx === -1 || targetIdx === -1) return

    // Reorder
    const [draggedTask] = tasks.splice(draggedIdx, 1)
    tasks.splice(targetIdx, 0, draggedTask)

    // Update local state immediately for responsiveness
    setCurrentVisit({ ...currentVisit, tasks })
    setDraggedTaskId(null)

    // Save to backend
    try {
      await reorderWorkerVisitTasks(worker.id, currentVisit.id, tasks.map(t => t.id))
    } catch (err) {
      console.error('Failed to reorder tasks:', err)
      await loadData() // Reload on error
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    )
  }

  // Separate tasks into active, backlog, and completed
  const allIncompleteTasks = currentVisit?.tasks?.filter(t => !t.is_completed) || []
  const activeTasks = allIncompleteTasks.filter(t => !t.is_backlog)
  const backlogTasks = allIncompleteTasks.filter(t => t.is_backlog)
  const completedTasks = currentVisit?.tasks?.filter(t => t.is_completed) || []
  const allTasksComplete = activeTasks.length === 0 && backlogTasks.length === 0 && completedTasks.length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <ListOrdered className="w-5 h-5" />
          {t('visitTasks', 'Visit Tasks')}
        </h3>
        <div className="flex items-center gap-2">
          {/* Translation toggle - only show if worker language is not English */}
          {isTranslated && (
            <button
              onClick={() => setShowOriginal(!showOriginal)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-sm ${
                showOriginal
                  ? 'bg-blue-600 text-white hover:bg-blue-500'
                  : 'bg-surface-soft text-secondary hover:bg-surface-hover'
              }`}
              title={showOriginal ? 'Showing original English' : 'Showing translated text'}
            >
              <Languages className="w-4 h-4" />
              {showOriginal ? t('original', 'Original') : t('translated', 'Translated')}
            </button>
          )}
          <button
            onClick={() => setShowStandardSettings(!showStandardSettings)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-soft text-secondary rounded-lg hover:bg-surface-hover transition-colors text-sm"
          >
            <Settings className="w-4 h-4" />
            {t('standardTasks', 'Standard Tasks')}
          </button>
        </div>
      </div>

      {/* Standard Tasks Settings */}
      {showStandardSettings && (
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
              {t('standardTasksEveryVisit', 'Standard Tasks (Every Visit)')}
            </h4>
            <button
              onClick={() => setShowStandardSettings(false)}
              className="p-1 text-muted hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-muted mb-4">
            {t('standardTasksDesc', 'These tasks are automatically added to each visit. Reorder to set priority.')}
          </p>

          <div className="space-y-2 mb-4">
            {standardTasks.map((task, idx) => (
              <div
                key={task.id}
                className="flex items-center gap-2 p-2 bg-surface rounded-lg"
              >
                <span className="w-6 h-6 flex items-center justify-center text-sm font-medium text-muted bg-surface-soft rounded">
                  {idx + 1}
                </span>
                {editingStandardTask?.id === task.id ? (
                  <>
                    <input
                      type="text"
                      value={editingStandardTask.title}
                      onChange={(e) => setEditingStandardTask({ ...editingStandardTask, title: e.target.value })}
                      className="flex-1 bg-surface-soft border border rounded px-2 py-1 text-sm focus:outline-none focus:border-farm-green"
                      autoFocus
                    />
                    <button
                      onClick={handleUpdateStandardTask}
                      className="p-1 text-green-400 hover:text-green-300"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingStandardTask(null)}
                      className="p-1 text-muted hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm" style={{ color: 'var(--color-text-primary)' }}>
                      {getTaskTitle(task)}
                    </span>
                    <button
                      onClick={() => setEditingStandardTask(task)}
                      className="p-1 text-muted hover:text-white"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteStandardTask(task.id)}
                      className="p-1 text-muted hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddStandardTask()}
              placeholder={t('addStandardTask', 'Add standard task...')}
              className="flex-1 bg-surface border border-subtle rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-farm-green"
            />
            <button
              onClick={handleAddStandardTask}
              disabled={!newTaskTitle.trim() || saving}
              className="px-3 py-2 bg-farm-green text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Current Visit */}
      {currentVisit && (
        <div className="rounded-xl" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="p-4 border-b border-subtle">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {t('currentVisit', 'Current Visit')}
                </h4>
                <p className="text-sm text-muted">{formatDate(currentVisit.visit_date)}</p>
              </div>
              <div className="flex items-center gap-2">
                {allTasksComplete ? (
                  <button
                    onClick={handleCompleteVisit}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors text-sm"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {t('completeVisit', 'Complete Visit')}
                  </button>
                ) : (
                  <span className="text-sm text-muted">
                    {completedTasks.length}/{currentVisit.tasks?.length || 0} {t('done', 'done')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Task List with Order Indicator */}
          <div className="p-4">
            {/* "Complete in Order" Notice */}
            <div className="flex items-center gap-2 mb-4 p-3 bg-amber-100 dark:bg-yellow-900/30 border border-amber-400 dark:border-yellow-700/50 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-yellow-500 flex-shrink-0" />
              <span className="text-sm text-amber-800 dark:text-yellow-100 font-medium">
                {t('completeInOrder', 'Complete tasks in order from top to bottom')}
              </span>
            </div>

            {activeTasks.length === 0 && backlogTasks.length === 0 && completedTasks.length === 0 ? (
              <div className="text-center py-8 text-muted">
                {t('noTasksYet', 'No tasks yet. Add standard tasks or one-off tasks below.')}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Active tasks with order numbers */}
                {activeTasks.map((task, idx) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => handleDragStart(task.id)}
                    onDragOver={(e) => handleDragOver(e, task.id)}
                    onDrop={(e) => handleDrop(e, task.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      idx === 0 ? 'bg-green-900/20 border border-green-700/50' : 'bg-surface'
                    } ${draggedTaskId === task.id ? 'opacity-50' : ''}`}
                  >
                    <GripVertical className="w-4 h-4 text-muted cursor-grab flex-shrink-0" />
                    <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold flex-shrink-0 ${
                      idx === 0 ? 'bg-green-600 text-white' : 'bg-surface-soft text-secondary'
                    }`}>
                      {idx + 1}
                    </div>
                    <button
                      onClick={() => handleToggleTaskComplete(task)}
                      className="flex-shrink-0"
                    >
                      <Circle className={`w-5 h-5 ${idx === 0 ? 'text-green-400 hover:text-green-300' : 'text-muted hover:text-green-400'}`} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {getTaskTitle(task)}
                      </span>
                      {task.is_standard && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded">
                          {t('standard', 'Standard')}
                        </span>
                      )}
                      {!task.is_standard && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 bg-purple-900/50 text-purple-300 rounded">
                          {t('thisVisit', 'This Visit')}
                        </span>
                      )}
                      {idx === 0 && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 bg-green-600 text-white rounded">
                          {t('doNext', 'DO NEXT')}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleToggleBacklog(task)}
                      className="p-1 text-muted hover:text-yellow-400 flex-shrink-0"
                      title={t('moveToBacklog', 'Move to backlog')}
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                    {!task.is_standard && (
                      <button
                        onClick={() => handleDeleteVisitTask(task.id)}
                        className="p-1 text-muted hover:text-red-400 flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}

                {/* Backlog section */}
                {(backlogTasks.length > 0 || showBacklog) && (
                  <div className="pt-3 mt-3 border-t border-subtle">
                    <button
                      onClick={() => setShowBacklog(!showBacklog)}
                      className="flex items-center gap-2 text-sm text-muted hover:text-white w-full"
                    >
                      <Archive className="w-4 h-4 text-yellow-500" />
                      {t('backlog', 'Backlog')} ({backlogTasks.length})
                      {showBacklog ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
                    </button>
                    {showBacklog && backlogTasks.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {backlogTasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-center gap-3 p-3 rounded-lg bg-surface/50"
                          >
                            <div className="w-4" />
                            <div className="w-7" />
                            <button
                              onClick={() => handleToggleTaskComplete(task)}
                              className="flex-shrink-0"
                            >
                              <Circle className="w-5 h-5 text-muted hover:text-green-400" />
                            </button>
                            <div className="flex-1 min-w-0">
                              <span className="text-secondary">{getTaskTitle(task)}</span>
                              {task.is_standard && (
                                <span className="ml-2 text-xs px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded">
                                  {t('standard', 'Standard')}
                                </span>
                              )}
                              {!task.is_standard && (
                                <span className="ml-2 text-xs px-1.5 py-0.5 bg-purple-900/50 text-purple-300 rounded">
                                  {t('thisVisit', 'This Visit')}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => handleToggleBacklog(task)}
                              className="p-1 text-muted hover:text-green-400 flex-shrink-0"
                              title={t('moveToActive', 'Move to active')}
                            >
                              <Inbox className="w-4 h-4" />
                            </button>
                            {!task.is_standard && (
                              <button
                                onClick={() => handleDeleteVisitTask(task.id)}
                                className="p-1 text-muted hover:text-red-400 flex-shrink-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Completed tasks */}
                {completedTasks.length > 0 && (
                  <div className="pt-3 mt-3 border-t border-subtle">
                    <p className="text-sm text-muted mb-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      {t('completed', 'Completed')} ({completedTasks.length})
                    </p>
                    {completedTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 p-2 rounded-lg bg-surface/50 opacity-60"
                      >
                        <div className="w-4" />
                        <div className="w-7" />
                        <button
                          onClick={() => handleToggleTaskComplete(task)}
                          className="flex-shrink-0"
                        >
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        </button>
                        <span className="line-through text-muted">{getTaskTitle(task)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Add One-Off Task */}
            <div className="mt-4 pt-4 border-t border-subtle">
              <label className="block text-sm text-muted mb-2">{t('addTaskThisVisit', 'Add task for this visit only:')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newOneOffTitle}
                  onChange={(e) => setNewOneOffTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddOneOffTask()}
                  placeholder={t('exampleTask', 'e.g., Deep clean oven...')}
                  className="flex-1 bg-surface border border-subtle rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-farm-green"
                />
                <button
                  onClick={handleAddOneOffTask}
                  disabled={!newOneOffTitle.trim() || saving}
                  className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visit History */}
      <div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2 text-sm text-muted hover:text-white"
        >
          <History className="w-4 h-4" />
          {showHistory ? t('hideVisitHistory', 'Hide Visit History') : t('showVisitHistory', 'Show Visit History')} ({visitHistory.length})
          {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showHistory && visitHistory.length > 0 && (
          <div className="mt-3 space-y-3">
            {visitHistory.map((visit) => (
              <div
                key={visit.id}
                className="rounded-lg p-3"
                style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {formatDate(visit.visit_date)}
                    </span>
                    {visit.status === 'completed' && (
                      <span className="text-xs px-1.5 py-0.5 bg-green-900/50 text-green-300 rounded">
                        {t('completed', 'Completed')}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDuplicateVisit(visit.id)}
                    className="flex items-center gap-1 text-sm text-muted hover:text-white"
                    title={t('duplicate', 'Duplicate')}
                  >
                    <Copy className="w-4 h-4" />
                    {t('duplicate', 'Duplicate')}
                  </button>
                </div>
                <div className="text-sm text-muted">
                  {visit.completed_count}/{visit.task_count} {t('tasksCompleted', 'tasks completed')}
                </div>
                {visit.tasks && visit.tasks.length > 0 && (
                  <div className="mt-2 text-xs text-muted space-y-0.5">
                    {visit.tasks.slice(0, 5).map((task, idx) => (
                      <div key={task.id} className="flex items-center gap-1">
                        {task.is_completed ? (
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        ) : (
                          <Circle className="w-3 h-3 text-muted" />
                        )}
                        <span className={task.is_completed ? 'line-through' : ''}>
                          {getTaskTitle(task)}
                        </span>
                      </div>
                    ))}
                    {visit.tasks.length > 5 && (
                      <div className="text-muted">+{visit.tasks.length - 5} {t('more', 'more')}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default WorkerVisitTasksTab
