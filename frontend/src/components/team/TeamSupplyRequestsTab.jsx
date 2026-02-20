import React, { useState, useEffect } from 'react'
import {
  Package, Plus, ExternalLink, Trash2, Edit, X, Check, User,
  AlertTriangle, DollarSign, Clock, CheckCircle, XCircle, ShoppingCart,
  Filter, RefreshCw
} from 'lucide-react'
import {
  getAllMemberSupplyRequests, updateMemberSupplyRequest, deleteMemberSupplyRequest
} from '../../services/api'

function TeamSupplyRequestsTab({ members }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [requests, setRequests] = useState([])
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterMember, setFilterMember] = useState('all')
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})

  const priorityOptions = [
    { value: 'low', label: 'Low', color: 'bg-surface-muted' },
    { value: 'medium', label: 'Medium', color: 'bg-blue-500' },
    { value: 'high', label: 'High', color: 'bg-yellow-500' },
    { value: 'urgent', label: 'Urgent', color: 'bg-red-500' }
  ]

  const statusOptions = [
    { value: 'pending', label: 'Pending', icon: Clock, color: 'text-yellow-500', bgColor: 'bg-yellow-500/20' },
    { value: 'approved', label: 'Approved', icon: Check, color: 'text-green-500', bgColor: 'bg-green-500/20' },
    { value: 'purchased', label: 'Ordered', icon: ShoppingCart, color: 'text-blue-500', bgColor: 'bg-blue-500/20' },
    { value: 'delivered', label: 'Delivered', icon: CheckCircle, color: 'text-green-400', bgColor: 'bg-green-400/20' },
    { value: 'denied', label: 'Denied', icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-500/20' }
  ]

  useEffect(() => {
    loadRequests()
  }, [])

  const loadRequests = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getAllMemberSupplyRequests()
      setRequests(res.data)
    } catch (err) {
      console.error('Failed to load supply requests:', err)
      setError(err.userMessage || 'Failed to load supply requests')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (request, newStatus) => {
    try {
      await updateMemberSupplyRequest(request.id, { status: newStatus })
      loadRequests()
    } catch (err) {
      console.error('Failed to update status:', err)
      setError(err.userMessage || 'Failed to update status')
    }
  }

  const handleEdit = (request) => {
    setEditingId(request.id)
    setEditData({
      admin_notes: request.admin_notes || '',
      status: request.status
    })
  }

  const handleSaveEdit = async (requestId) => {
    try {
      await updateMemberSupplyRequest(requestId, editData)
      setEditingId(null)
      setEditData({})
      loadRequests()
    } catch (err) {
      console.error('Failed to save:', err)
      setError(err.userMessage || 'Failed to save changes')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this supply request?')) return
    try {
      await deleteMemberSupplyRequest(id)
      loadRequests()
    } catch (err) {
      console.error('Failed to delete supply request:', err)
      setError(err.userMessage || 'Failed to delete supply request')
    }
  }

  const formatPrice = (price) => {
    if (!price) return null
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price)
  }

  const getStatusInfo = (status) => {
    return statusOptions.find(s => s.value === status) || statusOptions[0]
  }

  const getPriorityInfo = (priority) => {
    return priorityOptions.find(p => p.value === priority) || priorityOptions[1]
  }

  // Filter requests
  const filteredRequests = requests.filter(req => {
    if (filterStatus !== 'all' && req.status !== filterStatus) return false
    if (filterPriority !== 'all' && req.priority !== filterPriority) return false
    if (filterMember !== 'all' && req.member_id !== parseInt(filterMember)) return false
    return true
  })

  // Group by status for summary
  const statusCounts = statusOptions.reduce((acc, status) => {
    acc[status.value] = requests.filter(r => r.status === status.value).length
    return acc
  }, {})

  // Calculate totals
  const pendingTotal = requests
    .filter(r => r.status === 'pending' || r.status === 'approved')
    .reduce((sum, r) => sum + (r.total_price || 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <Package className="w-5 h-5" />
            Supply Requests ({requests.length})
          </h3>
          <p className="text-sm text-muted mt-1">
            Track and manage all team member supply requests
          </p>
        </div>
        <button
          onClick={loadRequests}
          className="p-2 text-muted hover:text-white rounded hover:bg-surface-soft"
          title="Refresh"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statusOptions.map(status => {
          const StatusIcon = status.icon
          const count = statusCounts[status.value] || 0
          return (
            <button
              key={status.value}
              onClick={() => setFilterStatus(filterStatus === status.value ? 'all' : status.value)}
              className={`p-3 rounded-lg text-center transition-colors ${
                filterStatus === status.value
                  ? status.bgColor + ' ring-2 ring-white/30'
                  : 'bg-surface-soft/50 hover:bg-surface-soft'
              }`}
            >
              <StatusIcon className={`w-5 h-5 mx-auto ${status.color}`} />
              <div className="text-xl font-bold mt-1">{count}</div>
              <div className="text-xs text-muted">{status.label}</div>
            </button>
          )
        })}
      </div>

      {/* Pending Total */}
      {pendingTotal > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-yellow-400">
            <DollarSign className="w-5 h-5" />
            <span>Pending/Approved Total</span>
          </div>
          <span className="text-xl font-bold text-yellow-400">{formatPrice(pendingTotal)}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-600/20 border border-red-500 rounded text-red-400">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-muted" />

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 bg-surface-soft border border rounded text-sm"
        >
          <option value="all">All Status</option>
          {statusOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="px-3 py-1.5 bg-surface-soft border border rounded text-sm"
        >
          <option value="all">All Priority</option>
          {priorityOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <select
          value={filterMember}
          onChange={(e) => setFilterMember(e.target.value)}
          className="px-3 py-1.5 bg-surface-soft border border rounded text-sm"
        >
          <option value="all">All Members</option>
          {members.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        {(filterStatus !== 'all' || filterPriority !== 'all' || filterMember !== 'all') && (
          <button
            onClick={() => { setFilterStatus('all'); setFilterPriority('all'); setFilterMember('all'); }}
            className="text-sm text-muted hover:text-white"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="text-center py-8 text-muted bg-surface-soft/50 rounded-lg">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No supply requests found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map(request => {
            const statusInfo = getStatusInfo(request.status)
            const priorityInfo = getPriorityInfo(request.priority)
            const StatusIcon = statusInfo.icon
            const isEditing = editingId === request.id

            return (
              <div key={request.id} className="bg-surface-soft rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Member Name */}
                    <div className="flex items-center gap-2 text-sm text-muted mb-1">
                      <User className="w-4 h-4" />
                      <span>{request.member_name || 'Unknown'}</span>
                    </div>

                    {/* Item Info */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-white">{request.item_name}</h4>
                      {request.quantity > 1 && (
                        <span className="text-sm text-muted">x{request.quantity}</span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-xs text-white ${priorityInfo.color}`}>
                        {priorityInfo.label}
                      </span>
                    </div>

                    {request.description && (
                      <p className="text-sm text-muted mt-1">{request.description}</p>
                    )}

                    {request.reason && (
                      <p className="text-sm text-muted mt-1 italic">Reason: {request.reason}</p>
                    )}

                    <div className="flex items-center gap-4 mt-2 text-sm flex-wrap">
                      {/* Status - clickable dropdown when not editing */}
                      {!isEditing ? (
                        <select
                          value={request.status}
                          onChange={(e) => handleStatusChange(request, e.target.value)}
                          className={`px-2 py-1 rounded text-sm bg-surface-hover border border-strong ${statusInfo.color}`}
                        >
                          {statusOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : (
                        <select
                          value={editData.status}
                          onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                          className="px-2 py-1 rounded text-sm bg-surface-hover border border-strong"
                        >
                          {statusOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      )}

                      {request.price && (
                        <span className="flex items-center gap-1 text-muted">
                          <DollarSign className="w-4 h-4" />
                          {formatPrice(request.price)}
                          {request.quantity > 1 && (
                            <span className="text-xs">({formatPrice(request.total_price)} total)</span>
                          )}
                        </span>
                      )}

                      {request.category && (
                        <span className="px-2 py-0.5 bg-surface-hover rounded text-secondary text-xs">
                          {request.category}
                        </span>
                      )}

                      {request.vendor && (
                        <span className="text-muted text-xs">From: {request.vendor}</span>
                      )}
                    </div>

                    {request.link && /^https?:\/\//i.test(request.link) && (
                      <a
                        href={request.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 mt-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View Product
                      </a>
                    )}

                    {/* Admin Notes */}
                    {isEditing ? (
                      <div className="mt-3">
                        <label className="block text-sm text-muted mb-1">Admin Notes</label>
                        <textarea
                          value={editData.admin_notes}
                          onChange={(e) => setEditData({ ...editData, admin_notes: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 bg-surface-hover border border-strong rounded text-white text-sm"
                          placeholder="Add notes about this request..."
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleSaveEdit(request.id)}
                            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => { setEditingId(null); setEditData({}); }}
                            className="px-3 py-1 bg-surface-hover text-white rounded text-sm hover:bg-surface-muted"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : request.admin_notes && (
                      <div className="mt-2 p-2 bg-surface-hover rounded text-sm">
                        <span className="text-muted">Admin notes: </span>
                        <span className="text-secondary">{request.admin_notes}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {!isEditing && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(request)}
                        className="p-1.5 text-muted hover:text-white"
                        title="Edit Notes"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(request.id)}
                        className="p-1.5 text-muted hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="text-xs text-muted mt-2">
                  Requested {new Date(request.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default TeamSupplyRequestsTab
