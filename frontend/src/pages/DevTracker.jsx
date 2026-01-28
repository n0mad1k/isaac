import { useState, useEffect, useRef } from 'react'
import {
  Plus,
  Trash2,
  Check,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  RefreshCw,
  Edit2,
  X,
  Save,
  RotateCcw,
  TrendingUp,
  Calendar,
  ChevronDown,
  ChevronRight,
  Users,
  MessageSquarePlus,
  Download,
  ToggleLeft,
  ToggleRight,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Archive,
  Image,
  Upload,
  Clipboard,
} from 'lucide-react'
import * as api from '../services/api'
import { format, isToday, parseISO, startOfDay } from 'date-fns'

const PRIORITY_CONFIG = {
  critical: { label: 'Critical', color: 'bg-red-500', textColor: 'text-red-400', borderColor: 'border-red-500' },
  high: { label: 'High', color: 'bg-orange-500', textColor: 'text-orange-400', borderColor: 'border-orange-500' },
  medium: { label: 'Medium', color: 'bg-yellow-500', textColor: 'text-yellow-400', borderColor: 'border-yellow-500' },
  low: { label: 'Low', color: 'bg-gray-500', textColor: 'text-gray-400', borderColor: 'border-gray-500' },
}

function DevTracker() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newItem, setNewItem] = useState('')
  const [newPriority, setNewPriority] = useState('low')
  const [newRequiresCollab, setNewRequiresCollab] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editPriority, setEditPriority] = useState('medium')
  const [editRequiresCollab, setEditRequiresCollab] = useState(false)
  const [editFailNote, setEditFailNote] = useState('')
  const [editTestNotes, setEditTestNotes] = useState('')
  const [failModalItem, setFailModalItem] = useState(null)
  const [failComment, setFailComment] = useState('')
  const [failRequiresCollab, setFailRequiresCollab] = useState(false)
  const [deleteModalItem, setDeleteModalItem] = useState(null)
  const [expandedHistory, setExpandedHistory] = useState({})
  const [toImplementSort, setToImplementSort] = useState('priority-oldest') // priority-oldest, oldest, newest
  const [testingSort, setTestingSort] = useState('oldest') // oldest, newest
  const [verifiedSort, setVerifiedSort] = useState('newest') // newest, oldest
  const [metrics, setMetrics] = useState(null)
  const [expandedDays, setExpandedDays] = useState({}) // Track which day groups are expanded

  // Customer feedback state
  const [feedbackEnabled, setFeedbackEnabled] = useState(false)
  const [togglingFeedback, setTogglingFeedback] = useState(false)
  const [pullingFeedback, setPullingFeedback] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState(null)
  const [prodFeedback, setProdFeedback] = useState([])
  const [loadingProdFeedback, setLoadingProdFeedback] = useState(false)
  const [reviewingId, setReviewingId] = useState(null)
  const [reviewNote, setReviewNote] = useState('')
  const [reviewPriority, setReviewPriority] = useState('medium')
  const [feedbackCollapsed, setFeedbackCollapsed] = useState(false)
  const [deletingFeedbackId, setDeletingFeedbackId] = useState(null)
  const feedbackRefreshRef = useRef(null)

  // Image state
  const [uploadingImageFor, setUploadingImageFor] = useState(null)
  const [lightboxImage, setLightboxImage] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    loadData()
    loadFeedbackStatus()
    loadProdFeedback(false) // Silent load on initial page load

    // Auto-refresh prod feedback every 5 minutes
    feedbackRefreshRef.current = setInterval(() => {
      loadProdFeedback(false) // Silent auto-refresh
    }, 5 * 60 * 1000)

    return () => {
      if (feedbackRefreshRef.current) {
        clearInterval(feedbackRefreshRef.current)
      }
    }
  }, [])

  // Auto-dismiss feedback messages after 5 seconds
  useEffect(() => {
    if (feedbackMessage) {
      const timer = setTimeout(() => {
        setFeedbackMessage(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [feedbackMessage])

  const loadData = async () => {
    try {
      setLoading(true)
      const [itemsRes, metricsRes] = await Promise.all([
        api.getDevTrackerItems(),
        api.getDevTrackerMetrics().catch(() => ({ data: null }))
      ])
      setItems(itemsRes.data || [])
      setMetrics(metricsRes.data)
      setError(null)
    } catch (err) {
      console.error('Error loading dev tracker:', err)
      if (err.response?.status === 403) {
        setError('Dev Tracker is only available on dev instance')
      } else {
        setError(err.message || 'Failed to load data')
      }
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  // Load feedback status from production
  const loadFeedbackStatus = async () => {
    try {
      const response = await api.getProdFeedbackStatus()
      setFeedbackEnabled(response.data.enabled)
    } catch (err) {
      console.error('Failed to load feedback status:', err)
    }
  }

  // Load pending feedback from production
  const loadProdFeedback = async (showMessage = true) => {
    setLoadingProdFeedback(true)
    try {
      const response = await api.listProdFeedback()
      const feedback = response.data || []
      setProdFeedback(feedback)
      if (showMessage) {
        if (feedback.length > 0) {
          setFeedbackMessage({ type: 'info', text: `Found ${feedback.length} pending feedback item${feedback.length > 1 ? 's' : ''}` })
        } else {
          setFeedbackMessage({ type: 'success', text: 'No new feedback from production' })
        }
        // Auto-clear message after 3 seconds
        setTimeout(() => setFeedbackMessage(null), 3000)
      }
    } catch (err) {
      console.error('Failed to load prod feedback:', err)
      setFeedbackMessage({ type: 'error', text: 'Failed to check for feedback' })
    } finally {
      setLoadingProdFeedback(false)
    }
  }

  // Handle feedback review (approve/decline/kickback)
  const handleReviewFeedback = async (id, action) => {
    if ((action === 'decline' || action === 'kickback') && !reviewNote.trim()) {
      setFeedbackMessage({ type: 'error', text: `Please provide a note when ${action === 'decline' ? 'declining' : 'kicking back'} feedback` })
      return
    }

    setReviewingId(id)
    try {
      const response = await api.reviewFeedback(id, {
        action,
        note: reviewNote || null,
        priority: reviewPriority
      })
      setFeedbackMessage({ type: 'success', text: response.data.message })
      setReviewNote('')
      setReviewPriority('medium')
      loadProdFeedback(false)
      if (action === 'approve') {
        loadData() // Refresh dev tracker items
      }
    } catch (err) {
      setFeedbackMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to review feedback' })
    } finally {
      setReviewingId(null)
    }
  }

  // Delete feedback from production (no review, just remove)
  const handleDeleteFeedback = async (feedbackId) => {
    setDeletingFeedbackId(feedbackId)
    try {
      await api.deleteProdFeedback(feedbackId)
      setFeedbackMessage({ type: 'success', text: 'Feedback deleted' })
      loadProdFeedback(false)
    } catch (err) {
      setFeedbackMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to delete feedback' })
    } finally {
      setDeletingFeedbackId(null)
    }
  }

  // Toggle customer feedback on production
  const handleToggleFeedback = async () => {
    setTogglingFeedback(true)
    setFeedbackMessage(null)
    try {
      const response = await api.toggleFeedbackOnProd(!feedbackEnabled)
      setFeedbackEnabled(response.data.enabled)
      setFeedbackMessage({ type: 'success', text: `Feedback ${response.data.enabled ? 'enabled' : 'disabled'} on production` })
    } catch (err) {
      setFeedbackMessage({ type: 'error', text: err.userMessage || 'Failed to toggle feedback' })
    } finally {
      setTogglingFeedback(false)
    }
  }

  // Pull feedback from production into dev tracker
  const handlePullFeedback = async () => {
    setPullingFeedback(true)
    setFeedbackMessage(null)
    try {
      const response = await api.pullFeedbackFromProd()
      if (response.data.pulled > 0) {
        setFeedbackMessage({ type: 'success', text: `Pulled ${response.data.pulled} feedback items into dev tracker` })
        loadData() // Refresh to show new items
        loadProdFeedback(false) // Refresh prod feedback list
      } else {
        setFeedbackMessage({ type: 'info', text: response.data.message || 'No new feedback to pull' })
      }
    } catch (err) {
      setFeedbackMessage({ type: 'error', text: err.userMessage || 'Failed to pull feedback' })
    } finally {
      setPullingFeedback(false)
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newItem.trim()) return
    try {
      await api.createDevTrackerItem({
        title: newItem.trim(),
        item_type: 'feature',
        priority: newPriority,
        requires_collab: newRequiresCollab,
      })
      setNewItem('')
      setNewPriority('low')
      setNewRequiresCollab(false)
      await loadData()
    } catch (err) {
      console.error('Error adding item:', err)
      setError(err.response?.data?.detail || err.message || 'Failed to add item')
    }
  }

  const handleAddToBacklog = async () => {
    if (!newItem.trim()) return
    try {
      await api.createDevTrackerItem({
        title: newItem.trim(),
        item_type: 'feature',
        priority: newPriority,
        status: 'backlog',
        requires_collab: newRequiresCollab,
      })
      setNewItem('')
      setNewPriority('low')
      setNewRequiresCollab(false)
      await loadData()
    } catch (err) {
      console.error('Error adding to backlog:', err)
      setError(err.response?.data?.detail || err.message || 'Failed to add to backlog')
    }
  }

  const handleChangePriority = async (item, newPriority) => {
    try {
      await api.updateDevTrackerItem(item.id, { priority: newPriority })
      loadData()
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    }
  }

  const handleMoveToTesting = async (item) => {
    try {
      await api.updateDevTrackerItem(item.id, { status: 'testing' })
      loadData()
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    }
  }

  const handleMarkVerified = async (item) => {
    try {
      await api.updateDevTrackerItem(item.id, { status: 'verified' })
      loadData()
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    }
  }

  const handleKickBack = async (item) => {
    try {
      await api.updateDevTrackerItem(item.id, { status: 'pending' })
      loadData()
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    }
  }

  const handleMoveToBacklog = async (item) => {
    try {
      await api.updateDevTrackerItem(item.id, { status: 'backlog' })
      loadData()
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    }
  }

  const handleMoveFromBacklog = async (item) => {
    try {
      await api.updateDevTrackerItem(item.id, { status: 'pending' })
      loadData()
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    }
  }

  const handleOpenFailModal = (item) => {
    setFailModalItem(item)
    setFailComment('')
  }

  const handleCancelFail = () => {
    setFailModalItem(null)
    setFailComment('')
    setFailRequiresCollab(false)
  }

  const handleConfirmFail = async () => {
    if (!failComment.trim()) return
    try {
      // Store fail_note separately instead of appending to title
      await api.updateDevTrackerItem(failModalItem.id, {
        fail_note: failComment.trim(),
        status: 'pending',
        requires_collab: failRequiresCollab
      })
      setFailModalItem(null)
      setFailComment('')
      setFailRequiresCollab(false)
      loadData()
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    }
  }

  const handleReopenToTesting = async (item) => {
    try {
      await api.updateDevTrackerItem(item.id, { status: 'testing' })
      loadData()
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    }
  }

  const handleStartEdit = (item) => {
    setEditingId(item.id)
    setEditTitle(item.title)
    setEditPriority(item.priority || 'medium')
    setEditRequiresCollab(item.requires_collab || false)
    setEditFailNote(item.fail_note || '')
    setEditTestNotes(item.test_notes || '')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditTitle('')
    setEditPriority('medium')
    setEditRequiresCollab(false)
    setEditFailNote('')
    setEditTestNotes('')
  }

  const handleSaveEdit = async (item) => {
    if (!editTitle.trim()) return
    try {
      await api.updateDevTrackerItem(item.id, {
        title: editTitle.trim(),
        priority: editPriority,
        requires_collab: editRequiresCollab,
        fail_note: editFailNote.trim() || null,
        test_notes: editTestNotes.trim() || null
      })
      setEditingId(null)
      setEditTitle('')
      setEditPriority('medium')
      setEditRequiresCollab(false)
      setEditFailNote('')
      setEditTestNotes('')
      loadData()
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    }
  }

  const handleToggleCollab = async (item) => {
    try {
      await api.updateDevTrackerItem(item.id, { requires_collab: !item.requires_collab })
      loadData()
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    }
  }

  // Image handlers
  const handleImageUpload = async (itemId, file) => {
    if (!file) return
    setUploadingImageFor(itemId)
    try {
      await api.uploadDevTrackerImage(itemId, file)
      loadData()
    } catch (err) {
      console.error('Failed to upload image:', err)
      setError(err.response?.data?.detail || 'Failed to upload image')
    } finally {
      setUploadingImageFor(null)
    }
  }

  const handleDeleteImage = async (itemId, imageId) => {
    if (!window.confirm('Delete this image?')) return
    try {
      await api.deleteDevTrackerImage(itemId, imageId)
      loadData()
    } catch (err) {
      console.error('Failed to delete image:', err)
    }
  }

  const handleFileSelect = (itemId) => {
    // Create a temporary file input
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (file) handleImageUpload(itemId, file)
    }
    input.click()
  }

  const handlePasteImage = async (itemId) => {
    try {
      const clipboardItems = await navigator.clipboard.read()
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type)
            const ext = type.split('/')[1] || 'png'
            const file = new File([blob], `pasted-image.${ext}`, { type })
            await handleImageUpload(itemId, file)
            return
          }
        }
      }
      setError('No image found in clipboard')
    } catch (err) {
      console.error('Failed to paste image:', err)
      setError('Could not read clipboard. Try using the upload button instead.')
    }
  }

  const handleOpenDeleteModal = (item) => {
    setDeleteModalItem(item)
  }

  const handleCancelDelete = () => {
    setDeleteModalItem(null)
  }

  const handleConfirmDelete = async () => {
    if (!deleteModalItem) return
    try {
      await api.deleteDevTrackerItem(deleteModalItem.id)
      setDeleteModalItem(null)
      loadData()
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    }
  }

  // Split items into categories and sort appropriately
  // To Implement: priority first (critical→high→medium→low), then oldest first
  // Ready for Testing: oldest first (regardless of priority, so oldest items get tested first)
  // Verified: newest first (most recently completed at top)
  const safeItems = Array.isArray(items) ? items : []

  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }

  const sortByPriorityThenDateAsc = (a, b) => {
    try {
      // First sort by priority (critical first)
      const priorityA = priorityOrder[a?.priority] ?? 2
      const priorityB = priorityOrder[b?.priority] ?? 2
      if (priorityA !== priorityB) return priorityA - priorityB
      // Then by date (oldest first)
      const dateA = a?.created_at ? new Date(a.created_at).getTime() : 0
      const dateB = b?.created_at ? new Date(b.created_at).getTime() : 0
      return dateA - dateB
    } catch {
      return 0
    }
  }
  const sortByDateDesc = (a, b) => {
    try {
      const dateA = a?.created_at ? new Date(a.created_at).getTime() : 0
      const dateB = b?.created_at ? new Date(b.created_at).getTime() : 0
      return dateB - dateA
    } catch {
      return 0
    }
  }
  const sortByDateAsc = (a, b) => {
    try {
      const dateA = a?.created_at ? new Date(a.created_at).getTime() : 0
      const dateB = b?.created_at ? new Date(b.created_at).getTime() : 0
      return dateA - dateB
    } catch {
      return 0
    }
  }
  const toImplement = safeItems
    .filter(i => i?.status === 'pending' || i?.status === 'in_progress')
    .sort(toImplementSort === 'priority-oldest' ? sortByPriorityThenDateAsc :
          toImplementSort === 'oldest' ? sortByDateAsc : sortByDateDesc)
  const readyForTesting = safeItems
    .filter(i => i?.status === 'testing')
    .sort(testingSort === 'oldest' ? sortByDateAsc : sortByDateDesc)
  const verified = safeItems
    .filter(i => i?.status === 'verified' || i?.status === 'done')
    .sort(verifiedSort === 'newest' ? sortByDateDesc : sortByDateAsc)
  const backlog = safeItems
    .filter(i => i?.status === 'backlog')
    .sort(sortByPriorityThenDateAsc)

  // Inline image display + controls
  const renderItemImages = (item) => {
    const images = item.images || []
    const isUploading = uploadingImageFor === item.id
    return (
      <div className="mt-2">
        {/* Existing images */}
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {images.map((img) => (
              <div key={img.id} className="relative group/img">
                <img
                  src={api.getDevTrackerImageUrl(img.filename)}
                  alt={img.original_name || 'Attached image'}
                  className="w-20 h-20 object-cover rounded border border-gray-600 cursor-pointer hover:border-blue-400 transition-colors"
                  onClick={() => setLightboxImage({ ...img, itemId: item.id })}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteImage(item.id, img.id) }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                  title="Delete image"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
        {/* Upload/Paste buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleFileSelect(item.id)}
            disabled={isUploading}
            className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-500 hover:text-blue-400 hover:bg-gray-600/50 rounded transition-colors"
            title="Upload image"
          >
            {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Upload
          </button>
          <button
            onClick={() => handlePasteImage(item.id)}
            disabled={isUploading}
            className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-500 hover:text-blue-400 hover:bg-gray-600/50 rounded transition-colors"
            title="Paste image from clipboard"
          >
            <Clipboard className="w-3 h-3" />
            Paste
          </button>
          {images.length > 0 && (
            <span className="text-[10px] text-gray-600">{images.length} image{images.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    )
  }

  if (error && error.includes('only available on dev')) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-400">Dev Instance Only</h2>
          <p className="text-gray-400 mt-2">This feature is only available on the dev instance.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Dev Tracker</h1>
          <p className="text-gray-400 text-sm">Add items → I implement → You verify</p>
        </div>
      </div>

      {/* Customer Feedback Controls */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <MessageSquarePlus className="w-5 h-5 text-green-400" />
            <div>
              <h3 className="text-sm font-medium text-white">User Feedback</h3>
              <p className="text-xs text-gray-400">Collect feature requests from production users</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Check for feedback button - always visible */}
            <button
              onClick={loadProdFeedback}
              disabled={loadingProdFeedback}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors border bg-purple-600 hover:bg-purple-700 text-white border-purple-500"
              title="Check for new feedback from production"
            >
              {loadingProdFeedback ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Check Feedback
            </button>
            {/* Toggle feedback on prod */}
            <button
              onClick={handleToggleFeedback}
              disabled={togglingFeedback}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors border"
              style={{
                backgroundColor: feedbackEnabled ? 'var(--color-success-bg)' : 'var(--color-bg-surface-soft)',
                color: feedbackEnabled ? 'var(--color-success-600)' : 'var(--color-text-secondary)',
                borderColor: feedbackEnabled ? 'var(--color-success-500)' : 'var(--color-border-default)'
              }}
              title={feedbackEnabled ? 'Feedback enabled on production' : 'Feedback disabled on production'}
            >
              {togglingFeedback ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : feedbackEnabled ? (
                <ToggleRight className="w-4 h-4" />
              ) : (
                <ToggleLeft className="w-4 h-4" />
              )}
              {feedbackEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>

        {/* Feedback message */}
        {feedbackMessage && (
          <div className={`mt-3 px-4 py-3 rounded text-sm font-medium flex items-center justify-between ${
            feedbackMessage.type === 'success' ? 'bg-green-600 text-white' :
            feedbackMessage.type === 'error' ? 'bg-red-600 text-white' :
            'bg-blue-600 text-white'
          }`}>
            <span>{feedbackMessage.text}</span>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="ml-3 hover:opacity-70"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Pending feedback from production */}
        {prodFeedback.length > 0 && (
          <div className="mt-4 border-t border-gray-700 pt-4">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setFeedbackCollapsed(!feedbackCollapsed)}
                className="text-sm font-medium text-gray-300 flex items-center gap-2 hover:text-white"
              >
                {feedbackCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <MessageSquarePlus className="w-4 h-4 text-purple-400" />
                Pending Feedback from Production ({prodFeedback.length})
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePullFeedback}
                  disabled={pullingFeedback}
                  className="px-2 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded flex items-center gap-1 disabled:opacity-50"
                >
                  <Download className={`w-3 h-3 ${pullingFeedback ? 'animate-spin' : ''}`} />
                  Pull to Tracker
                </button>
              </div>
            </div>
            {!feedbackCollapsed && (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {prodFeedback.map(fb => (
                <div key={fb.id} className="p-4 rounded-lg border border-gray-700" style={{ backgroundColor: 'var(--color-bg-surface-soft)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{fb.title}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          fb.feedback_type === 'bug' ? 'bg-red-600' :
                          fb.feedback_type === 'feature' ? 'bg-blue-600' :
                          fb.feedback_type === 'improvement' ? 'bg-green-600' : 'bg-gray-600'
                        } text-white`}>
                          {fb.feedback_type}
                        </span>
                        {fb.status === 'kickback' && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-600 text-white">
                            Awaiting Response
                          </span>
                        )}
                      </div>
                      {fb.description && (
                        <p className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>{fb.description}</p>
                      )}
                      <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                        {fb.submitted_by || 'Anonymous'} · {new Date(fb.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  {/* Review actions */}
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <div className="flex flex-wrap gap-2 items-center">
                      {/* Priority selector for approve */}
                      <select
                        value={reviewPriority}
                        onChange={(e) => setReviewPriority(e.target.value)}
                        className="px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-white"
                      >
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>

                      <button
                        onClick={() => handleReviewFeedback(fb.id, 'approve')}
                        disabled={reviewingId === fb.id}
                        className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs disabled:opacity-50"
                        title="Approve and add to dev tracker"
                      >
                        {reviewingId === fb.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ThumbsUp className="w-3 h-3" />}
                        Approve
                      </button>

                      <button
                        onClick={() => handleReviewFeedback(fb.id, 'decline')}
                        disabled={reviewingId === fb.id || !reviewNote.trim()}
                        className="flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs disabled:opacity-50"
                        title="Decline - won't implement"
                      >
                        {reviewingId === fb.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ThumbsDown className="w-3 h-3" />}
                        Decline
                      </button>

                      <button
                        onClick={() => handleReviewFeedback(fb.id, 'kickback')}
                        disabled={reviewingId === fb.id || !reviewNote.trim()}
                        className="flex items-center gap-1 px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-xs disabled:opacity-50"
                        title="Request more info from user"
                      >
                        {reviewingId === fb.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageCircle className="w-3 h-3" />}
                        Kickback
                      </button>
                    </div>

                    {/* Note input for decline/kickback */}
                    <input
                      type="text"
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      placeholder="Add note (required for decline/kickback)..."
                      className="mt-2 w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500"
                    />

                    {/* Delete button */}
                    <div className="mt-2 pt-2 border-t border-gray-700 flex justify-end">
                      <button
                        onClick={() => handleDeleteFeedback(fb.id)}
                        disabled={deletingFeedbackId === fb.id}
                        className="flex items-center gap-1 px-3 py-1 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded text-xs transition-colors"
                        title="Delete feedback permanently"
                      >
                        {deletingFeedbackId === fb.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        )}
      </div>

      {error && !error.includes('only available') && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Add New Item */}
      <form onSubmit={handleAdd} className="flex gap-2 items-center">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add a feature request, bug fix, or improvement..."
          className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-farm-green"
        />
        <select
          value={newPriority}
          onChange={(e) => setNewPriority(e.target.value)}
          className={`px-3 py-3 bg-gray-800 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-farm-green ${PRIORITY_CONFIG[newPriority]?.borderColor || 'border-gray-700'}`}
        >
          <option value="critical">🔴 Critical</option>
          <option value="high">🟠 High</option>
          <option value="medium">🟡 Medium</option>
          <option value="low">⚪ Low</option>
        </select>
        <button
          type="button"
          onClick={() => setNewRequiresCollab(!newRequiresCollab)}
          className={`p-3 rounded-lg transition-colors ${
            newRequiresCollab
              ? 'bg-orange-500/30 text-orange-300 border border-orange-500'
              : 'bg-gray-800 text-gray-400 border border-gray-700 hover:text-orange-300 hover:border-orange-500/50'
          }`}
          title={newRequiresCollab ? 'Requires collaboration (click to disable)' : 'Mark as requiring collaboration'}
        >
          <Users className="w-5 h-5" />
        </button>
        <button
          type="submit"
          disabled={!newItem.trim()}
          className="px-4 py-3 bg-farm-green hover:bg-farm-green-dark text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          title="Add to pending"
        >
          <Plus className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={handleAddToBacklog}
          disabled={!newItem.trim()}
          className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          title="Send to backlog"
        >
          <Archive className="w-5 h-5" />
        </button>
      </form>

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-farm-green animate-spin" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* To Implement Column */}
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                To Implement ({toImplement.length})
              </h2>
              <select
                value={toImplementSort}
                onChange={(e) => setToImplementSort(e.target.value)}
                className="text-xs px-2 py-1 bg-gray-700 border border-gray-600 rounded text-gray-300"
              >
                <option value="priority-oldest">Priority → Oldest</option>
                <option value="oldest">Oldest First</option>
                <option value="newest">Newest First</option>
              </select>
            </div>
            <div className="space-y-2">
              {toImplement.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Nothing to implement</p>
              ) : (
                toImplement.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-start gap-2 p-3 rounded-lg group min-w-0 border-l-4 ${
                      item.priority === 'critical' ? 'bg-red-500/10 border-red-500' :
                      item.priority === 'high' ? 'bg-orange-500/10 border-orange-500' :
                      item.priority === 'low' ? 'bg-gray-700/50 border-gray-500' :
                      'bg-yellow-500/10 border-yellow-500'
                    }`}
                  >
                    {editingId === item.id ? (
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') handleCancelEdit()
                            }}
                            className="flex-1 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-farm-green"
                            autoFocus
                            placeholder="Title"
                          />
                          <select
                            value={editPriority}
                            onChange={(e) => setEditPriority(e.target.value)}
                            className="text-xs px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white"
                          >
                            <option value="critical">🔴 Critical</option>
                            <option value="high">🟠 High</option>
                            <option value="medium">🟡 Medium</option>
                            <option value="low">⚪ Low</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => setEditRequiresCollab(!editRequiresCollab)}
                            className={`p-1.5 rounded transition-colors ${
                              editRequiresCollab
                                ? 'bg-orange-500/30 text-orange-300'
                                : 'text-gray-400 hover:text-orange-300'
                            }`}
                            title={editRequiresCollab ? 'Requires collab (click to disable)' : 'Mark as requiring collab'}
                          >
                            <Users className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-xs text-gray-400">Fail Note</label>
                            <textarea
                              value={editFailNote}
                              onChange={(e) => setEditFailNote(e.target.value)}
                              className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-farm-green resize-none"
                              rows={2}
                              placeholder="Why did this fail?"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-gray-400">Test Notes</label>
                            <textarea
                              value={editTestNotes}
                              onChange={(e) => setEditTestNotes(e.target.value)}
                              className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-farm-green resize-none"
                              rows={2}
                              placeholder="How to test this"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={handleCancelEdit}
                            className="px-3 py-1 text-sm text-gray-400 hover:text-white hover:bg-gray-600 rounded"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveEdit(item)}
                            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <span className="text-xs px-1.5 py-0.5 bg-gray-600 text-gray-400 rounded font-mono shrink-0" title="Item ID">
                              #{item.id}
                            </span>
                            {(item.fail_note || item.fail_count > 0) && (
                              <span className="text-xs px-1.5 py-0.5 bg-red-500/30 text-red-300 rounded font-semibold shrink-0" title={item.fail_note || 'Previously failed'}>
                                FAILED{item.fail_count > 1 ? ` x${item.fail_count}` : ''}
                              </span>
                            )}
                            {item.requires_collab && (
                              <span className="text-xs px-1.5 py-0.5 bg-orange-500/30 text-orange-300 rounded font-semibold shrink-0" title="Requires step-by-step collaboration">
                                COLLAB
                              </span>
                            )}
                            <span className="text-gray-200 break-words whitespace-normal">{item.title}</span>
                          </div>
                          {item.fail_note && (
                            <p className="text-xs text-red-400 mt-1 ml-0 italic">
                              {item.fail_note}
                            </p>
                          )}
                          {item.fail_note_history && (() => {
                            try {
                              const history = JSON.parse(item.fail_note_history)
                              if (history.length === 0) return null
                              const isExpanded = expandedHistory[item.id]
                              return (
                                <div className="mt-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setExpandedHistory(prev => ({ ...prev, [item.id]: !prev[item.id] })) }}
                                    className="text-[10px] text-red-400/70 hover:text-red-300 underline"
                                  >
                                    {isExpanded ? 'Hide' : 'Show'} fail history ({history.length})
                                  </button>
                                  {isExpanded && (
                                    <div className="mt-1 space-y-1 border-l-2 border-red-500/30 pl-2">
                                      {history.map((entry, i) => (
                                        <div key={i} className="text-[10px] text-red-400/60">
                                          <span className="text-red-400/40">#{entry.attempt || i + 1}</span>
                                          {' '}{entry.note}
                                          {entry.date && <span className="text-gray-500 ml-1">({new Date(entry.date).toLocaleDateString()})</span>}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            } catch { return null }
                          })()}
                          {renderItemImages(item)}
                        </div>
                        <button
                          onClick={() => handleToggleCollab(item)}
                          className={`p-1.5 rounded md:opacity-0 md:group-hover:opacity-100 transition-all ${
                            item.requires_collab
                              ? 'text-orange-400 bg-orange-500/20'
                              : 'text-gray-400 hover:text-orange-400 hover:bg-gray-600'
                          }`}
                          title={item.requires_collab ? 'Remove collab requirement' : 'Mark as requiring collab'}
                        >
                          <Users className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleStartEdit(item)}
                          className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-600 rounded md:opacity-0 md:group-hover:opacity-100 transition-all"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMoveToTesting(item)}
                          className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-600 rounded md:opacity-0 md:group-hover:opacity-100 transition-all"
                          title="Move to Ready for Testing"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMoveToBacklog(item)}
                          className="p-1.5 text-gray-400 hover:text-purple-400 hover:bg-gray-600 rounded md:opacity-0 md:group-hover:opacity-100 transition-all"
                          title="Move to Backlog (work on later)"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDeleteModal(item)}
                          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-600 rounded md:opacity-0 md:group-hover:opacity-100 transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Ready for Testing Column */}
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                Ready for Testing ({readyForTesting.length})
              </h2>
              <select
                value={testingSort}
                onChange={(e) => setTestingSort(e.target.value)}
                className="text-xs px-2 py-1 bg-gray-700 border border-gray-600 rounded text-gray-300"
              >
                <option value="oldest">Oldest First</option>
                <option value="newest">Newest First</option>
              </select>
            </div>
            <div className="space-y-2">
              {readyForTesting.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Nothing to test yet</p>
              ) : (
                readyForTesting.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-start gap-2 p-3 rounded-lg group min-w-0 border-l-4 ${
                      item.priority === 'critical' ? 'bg-red-500/10 border-red-500' :
                      item.priority === 'high' ? 'bg-orange-500/10 border-orange-500' :
                      item.priority === 'low' ? 'bg-gray-700/50 border-gray-500' :
                      'bg-yellow-500/10 border-yellow-500'
                    }`}
                  >
                    <button
                      onClick={() => handleMarkVerified(item)}
                      className="p-1 text-gray-400 hover:text-green-400 rounded transition-colors"
                      title="Mark as verified"
                    >
                      <div className="w-5 h-5 border-2 border-current rounded flex items-center justify-center">
                      </div>
                    </button>
                    {editingId === item.id ? (
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') handleCancelEdit()
                            }}
                            className="flex-1 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-farm-green"
                            autoFocus
                            placeholder="Title"
                          />
                          <select
                            value={editPriority}
                            onChange={(e) => setEditPriority(e.target.value)}
                            className="text-xs px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white"
                          >
                            <option value="critical">🔴 Critical</option>
                            <option value="high">🟠 High</option>
                            <option value="medium">🟡 Medium</option>
                            <option value="low">⚪ Low</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => setEditRequiresCollab(!editRequiresCollab)}
                            className={`p-1.5 rounded transition-colors ${
                              editRequiresCollab
                                ? 'bg-orange-500/30 text-orange-300'
                                : 'text-gray-400 hover:text-orange-300'
                            }`}
                            title={editRequiresCollab ? 'Requires collab (click to disable)' : 'Mark as requiring collab'}
                          >
                            <Users className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-xs text-gray-400">Fail Note</label>
                            <textarea
                              value={editFailNote}
                              onChange={(e) => setEditFailNote(e.target.value)}
                              className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-farm-green resize-none"
                              rows={2}
                              placeholder="Why did this fail?"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-gray-400">Test Notes</label>
                            <textarea
                              value={editTestNotes}
                              onChange={(e) => setEditTestNotes(e.target.value)}
                              className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-farm-green resize-none"
                              rows={2}
                              placeholder="How to test this"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={handleCancelEdit}
                            className="px-3 py-1 text-sm text-gray-400 hover:text-white hover:bg-gray-600 rounded"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveEdit(item)}
                            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <span className="text-xs px-1.5 py-0.5 bg-gray-600 text-gray-400 rounded font-mono shrink-0" title="Item ID">
                              #{item.id}
                            </span>
                            <span className="text-gray-200 break-words whitespace-normal">{item.title}</span>
                          </div>
                          {item.test_notes && (
                            <p className="text-xs text-green-400 mt-1 ml-0 italic">
                              ✓ {item.test_notes}
                            </p>
                          )}
                          {renderItemImages(item)}
                        </div>
                        <button
                          onClick={() => handleOpenFailModal(item)}
                          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-600 rounded md:opacity-0 md:group-hover:opacity-100 transition-all shrink-0"
                          title="Mark as failed (requires comment)"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleStartEdit(item)}
                          className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-600 rounded md:opacity-0 md:group-hover:opacity-100 transition-all shrink-0"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDeleteModal(item)}
                          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-600 rounded md:opacity-0 md:group-hover:opacity-100 transition-all shrink-0"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Backlog Section */}
      {backlog.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
              Backlog ({backlog.length})
            </h2>
            <span className="text-xs text-gray-500">Items deferred for later</span>
          </div>
          <div className="space-y-2">
            {backlog.map((item) => (
              <div
                key={item.id}
                className={`flex items-start gap-2 p-3 rounded-lg group min-w-0 border-l-4 bg-purple-500/10 border-purple-500`}
              >
                <span className="text-xs px-1.5 py-0.5 bg-gray-600 text-gray-400 rounded font-mono shrink-0" title="Item ID">
                  #{item.id}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${PRIORITY_CONFIG[item.priority]?.color} text-white`}>
                  {item.priority}
                </span>
                <span className="flex-1 text-gray-300 break-words whitespace-normal min-w-0">{item.title}</span>
                <button
                  onClick={() => handleMoveFromBacklog(item)}
                  className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-600 rounded md:opacity-0 md:group-hover:opacity-100 transition-all"
                  title="Move back to To Implement"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleOpenDeleteModal(item)}
                  className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-600 rounded md:opacity-0 md:group-hover:opacity-100 transition-all"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics Section */}
      {metrics && (
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-farm-green" />
            <h2 className="text-lg font-semibold text-white">Productivity Metrics</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-400">{metrics.completed_today}</div>
              <div className="text-xs text-gray-400">Completed Today</div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-400">{metrics.completed_this_week}</div>
              <div className="text-xs text-gray-400">This Week</div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-purple-400">{metrics.completed_this_month}</div>
              <div className="text-xs text-gray-400">This Month</div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-yellow-400">{metrics.avg_items_per_day}</div>
              <div className="text-xs text-gray-400">Avg/Day</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2 text-center text-sm">
            <div className="text-red-400">
              <span className="font-semibold">{metrics.by_priority?.critical || 0}</span>
              <span className="text-xs text-gray-500 block">Critical</span>
            </div>
            <div className="text-orange-400">
              <span className="font-semibold">{metrics.by_priority?.high || 0}</span>
              <span className="text-xs text-gray-500 block">High</span>
            </div>
            <div className="text-yellow-400">
              <span className="font-semibold">{metrics.by_priority?.medium || 0}</span>
              <span className="text-xs text-gray-500 block">Medium</span>
            </div>
            <div className="text-gray-400">
              <span className="font-semibold">{metrics.by_priority?.low || 0}</span>
              <span className="text-xs text-gray-500 block">Low</span>
            </div>
          </div>
        </div>
      )}

      {/* Verified Section - Grouped by Day */}
      {verified.length > 0 && (() => {
        // Group verified items by day
        const groupedByDay = verified.reduce((acc, item) => {
          const dateKey = item.completed_at
            ? format(parseISO(item.completed_at), 'yyyy-MM-dd')
            : 'unknown'
          if (!acc[dateKey]) acc[dateKey] = []
          acc[dateKey].push(item)
          return acc
        }, {})

        // Sort days (newest first)
        const sortedDays = Object.keys(groupedByDay).sort((a, b) => b.localeCompare(a))

        return (
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                Verified ({verified.length})
              </h2>
            </div>
            <div className="space-y-2">
              {sortedDays.map((dateKey) => {
                const dayItems = groupedByDay[dateKey]
                const dateObj = dateKey !== 'unknown' ? parseISO(dateKey) : null
                const isTodayDate = dateObj && isToday(dateObj)
                const isExpanded = expandedDays[dateKey] ?? isTodayDate // Default: today expanded, others collapsed

                return (
                  <div key={dateKey} className="border border-gray-700 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedDays(prev => ({ ...prev, [dateKey]: !isExpanded }))}
                      className="w-full px-3 py-2 bg-gray-700/50 hover:bg-gray-700 flex items-center justify-between text-left"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className={`font-medium ${isTodayDate ? 'text-green-400' : 'text-gray-300'}`}>
                          {dateObj ? (isTodayDate ? 'Today' : format(dateObj, 'EEE, MMM d')) : 'Unknown'}
                        </span>
                        <span className="text-xs text-gray-500">({dayItems.length} items)</span>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 space-y-1.5">
                        {dayItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start gap-2 p-2 bg-gray-700/30 rounded group min-w-0"
                          >
                            <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                            <span className="text-xs px-1.5 py-0.5 bg-gray-600 text-gray-500 rounded font-mono shrink-0" title="Item ID">
                              #{item.id}
                            </span>
                            <span className="flex-1 text-sm text-gray-400 line-through break-words whitespace-normal min-w-0">{item.title}</span>
                            <button
                              onClick={() => handleReopenToTesting(item)}
                              className="p-1 text-gray-500 hover:text-blue-400 hover:bg-gray-600 rounded md:opacity-0 md:group-hover:opacity-100 transition-all"
                              title="Reopen to testing"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleOpenDeleteModal(item)}
                              className="p-1 text-gray-500 hover:text-red-400 hover:bg-gray-600 rounded md:opacity-0 md:group-hover:opacity-100 transition-all"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Fail Modal */}
      {failModalItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">Mark as Failed</h3>
            <p className="text-gray-400 text-sm mb-4">
              This will move the item back to implement with your failure comment appended.
            </p>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">What went wrong?</label>
              <input
                type="text"
                value={failComment}
                onChange={(e) => setFailComment(e.target.value)}
                className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="e.g., backend returns 500 error"
                autoFocus
              />
            </div>
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={failRequiresCollab}
                  onChange={(e) => setFailRequiresCollab(e.target.checked)}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-sm text-gray-300">Requires step-by-step collaboration</span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-6">
                Mark if Claude should work through this interactively with you instead of autonomously
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCancelFail}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmFail}
                disabled={!failComment.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Mark Failed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Item?</h3>
            <p className="text-gray-400 text-sm mb-4">
              "{deleteModalItem.title}"
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCancelDelete}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={api.getDevTrackerImageUrl(lightboxImage.filename)}
              alt={lightboxImage.original_name || 'Image'}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            <div className="absolute top-2 right-2 flex gap-2">
              <button
                onClick={() => handleDeleteImage(lightboxImage.itemId, lightboxImage.id)}
                className="p-2 bg-red-600 rounded-full text-white hover:bg-red-700"
                title="Delete image"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setLightboxImage(null)}
                className="p-2 bg-gray-700 rounded-full text-white hover:bg-gray-600"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {lightboxImage.original_name && (
              <div className="text-center mt-2 text-sm text-gray-400">
                {lightboxImage.original_name}
                {lightboxImage.file_size && (
                  <span className="ml-2 text-gray-500">
                    ({(lightboxImage.file_size / 1024).toFixed(0)} KB)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default DevTracker
