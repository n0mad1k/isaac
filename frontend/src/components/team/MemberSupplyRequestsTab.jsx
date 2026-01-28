import React, { useState, useEffect } from 'react'
import {
  Package, Plus, ExternalLink, Trash2, Edit, X, Check,
  AlertTriangle, DollarSign, Clock, CheckCircle, XCircle, ShoppingCart
} from 'lucide-react'
import {
  getMemberSupplyRequests, createMemberSupplyRequest,
  updateMemberSupplyRequest, deleteMemberSupplyRequest
} from '../../services/api'

function MemberSupplyRequestsTab({ member, onUpdate }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [requests, setRequests] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    item_name: '',
    description: '',
    category: '',
    quantity: 1,
    link: '',
    price: '',
    vendor: '',
    priority: 'medium',
    reason: ''
  })

  const priorityOptions = [
    { value: 'low', label: 'Low', color: 'bg-gray-500' },
    { value: 'medium', label: 'Medium', color: 'bg-blue-500' },
    { value: 'high', label: 'High', color: 'bg-yellow-500' },
    { value: 'urgent', label: 'Urgent', color: 'bg-red-500' }
  ]

  const statusOptions = [
    { value: 'pending', label: 'Pending', icon: Clock, color: 'text-yellow-500' },
    { value: 'approved', label: 'Approved', icon: Check, color: 'text-green-500' },
    { value: 'purchased', label: 'Ordered', icon: ShoppingCart, color: 'text-blue-500' },
    { value: 'delivered', label: 'Delivered', icon: CheckCircle, color: 'text-green-400' },
    { value: 'denied', label: 'Denied', icon: XCircle, color: 'text-red-500' }
  ]

  useEffect(() => {
    loadRequests()
  }, [member.id])

  const loadRequests = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getMemberSupplyRequests(member.id)
      setRequests(res.data)
    } catch (err) {
      console.error('Failed to load supply requests:', err)
      setError(err.userMessage || 'Failed to load supply requests')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      item_name: '',
      description: '',
      category: '',
      quantity: 1,
      link: '',
      price: '',
      vendor: '',
      priority: 'medium',
      reason: ''
    })
    setEditingId(null)
    setShowForm(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const data = {
        ...formData,
        price: formData.price ? parseFloat(formData.price) : null,
        quantity: parseInt(formData.quantity) || 1
      }

      if (editingId) {
        await updateMemberSupplyRequest(editingId, data)
      } else {
        await createMemberSupplyRequest(member.id, data)
      }

      loadRequests()
      resetForm()
    } catch (err) {
      console.error('Failed to save supply request:', err)
      setError(err.userMessage || 'Failed to save supply request')
    }
  }

  const handleEdit = (request) => {
    setFormData({
      item_name: request.item_name || '',
      description: request.description || '',
      category: request.category || '',
      quantity: request.quantity || 1,
      link: request.link || '',
      price: request.price || '',
      vendor: request.vendor || '',
      priority: request.priority || 'medium',
      reason: request.reason || ''
    })
    setEditingId(request.id)
    setShowForm(true)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <Package className="w-5 h-5" />
          Supply Requests ({requests.length})
        </h3>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700"
        >
          <Plus className="w-4 h-4" />
          Request Item
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-600/20 border border-red-500 rounded text-red-400">
          {error}
        </div>
      )}

      {/* Request Form */}
      {showForm && (
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-white">
              {editingId ? 'Edit Request' : 'New Supply Request'}
            </h4>
            <button onClick={resetForm} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Item Name *</label>
                <input
                  type="text"
                  value={formData.item_name}
                  onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                  placeholder="What do you need?"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                  placeholder="e.g., Gear, Medical, Equipment"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                >
                  {priorityOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Estimated Price</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Vendor</label>
                <input
                  type="text"
                  value={formData.vendor}
                  onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                  placeholder="Where to buy"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Product Link</label>
              <input
                type="url"
                value={formData.link}
                onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                placeholder="Specific details, model, size, etc."
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Reason Needed</label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                placeholder="Why do you need this?"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                {editingId ? 'Update' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Requests List */}
      {requests.length === 0 ? (
        <div className="text-center py-8 text-gray-400 bg-gray-700/50 rounded-lg">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No supply requests yet</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 text-green-500 hover:text-green-400"
          >
            Request your first item
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(request => {
            const statusInfo = getStatusInfo(request.status)
            const priorityInfo = getPriorityInfo(request.priority)
            const StatusIcon = statusInfo.icon

            return (
              <div key={request.id} className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-white">{request.item_name}</h4>
                      {request.quantity > 1 && (
                        <span className="text-sm text-gray-400">x{request.quantity}</span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-xs text-white ${priorityInfo.color}`}>
                        {priorityInfo.label}
                      </span>
                    </div>

                    {request.description && (
                      <p className="text-sm text-gray-400 mt-1">{request.description}</p>
                    )}

                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className={`flex items-center gap-1 ${statusInfo.color}`}>
                        <StatusIcon className="w-4 h-4" />
                        {statusInfo.label}
                      </span>

                      {request.price && (
                        <span className="flex items-center gap-1 text-gray-400">
                          <DollarSign className="w-4 h-4" />
                          {formatPrice(request.price)}
                          {request.quantity > 1 && (
                            <span className="text-xs">({formatPrice(request.total_price)} total)</span>
                          )}
                        </span>
                      )}

                      {request.category && (
                        <span className="px-2 py-0.5 bg-gray-600 rounded text-gray-300">
                          {request.category}
                        </span>
                      )}
                    </div>

                    {request.link && (
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

                    {request.admin_notes && (
                      <div className="mt-2 p-2 bg-gray-600 rounded text-sm">
                        <span className="text-gray-400">Admin notes: </span>
                        <span className="text-gray-300">{request.admin_notes}</span>
                      </div>
                    )}
                  </div>

                  {request.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(request)}
                        className="p-1.5 text-gray-400 hover:text-white"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(request.id)}
                        className="p-1.5 text-gray-400 hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="text-xs text-gray-500 mt-2">
                  Requested {new Date(request.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                  {request.vendor && ` | From: ${request.vendor}`}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default MemberSupplyRequestsTab
