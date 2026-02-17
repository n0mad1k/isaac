import React, { useState, useEffect } from 'react'
import {
  Shield, Plus, Edit, Trash2, ChevronDown, ChevronUp, Check, Clock,
  AlertTriangle, Package, Wrench, AlertCircle, Calendar, X, RefreshCw,
  Minus
} from 'lucide-react'
import {
  getMemberGear, createMemberGear, updateMemberGear, deleteMemberGear,
  getGearMaintenance, createGearMaintenance, updateGearMaintenance, deleteGearMaintenance, completeGearMaintenance,
  getGearContents, createGearContents, updateGearContents, deleteGearContents
} from '../../services/api'

const GEAR_CATEGORIES = [
  'FIREARM', 'BAG', 'MEDICAL', 'COMMS', 'OPTICS', 'CLOTHING', 'TOOLS', 'ELECTRONICS', 'OTHER'
]

const GEAR_STATUSES = [
  { value: 'SERVICEABLE', label: 'Serviceable', color: 'bg-green-900/50 text-green-300' },
  { value: 'NEEDS_MAINTENANCE', label: 'Needs Maintenance', color: 'bg-yellow-900/50 text-yellow-300' },
  { value: 'NEEDS_REPAIR', label: 'Needs Repair', color: 'bg-orange-900/50 text-orange-300' },
  { value: 'OUT_OF_SERVICE', label: 'Out of Service', color: 'bg-red-900/50 text-red-300' }
]

const CONTENT_STATUSES = [
  { value: 'GOOD', label: 'Good', color: 'bg-green-900/50 text-green-300' },
  { value: 'LOW', label: 'Low', color: 'bg-yellow-900/50 text-yellow-300' },
  { value: 'EXPIRED', label: 'Expired', color: 'bg-red-900/50 text-red-300' },
  { value: 'MISSING', label: 'Missing', color: 'bg-gray-900/50 text-gray-300' },
  { value: 'NEEDS_REPLACEMENT', label: 'Needs Replacement', color: 'bg-orange-900/50 text-orange-300' }
]

function MemberGearTab({ member, onUpdate }) {
  const [gear, setGear] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedGear, setExpandedGear] = useState(null)
  const [showAddGear, setShowAddGear] = useState(false)
  const [editingGear, setEditingGear] = useState(null)
  const [showAddMaint, setShowAddMaint] = useState(null)
  const [showAddContent, setShowAddContent] = useState(null)
  const [editingContent, setEditingContent] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')

  // Gear maintenance and contents state
  const [gearMaintenance, setGearMaintenance] = useState({})
  const [gearContents, setGearContents] = useState({})

  const loadGear = async () => {
    try {
      setLoading(true)
      const res = await getMemberGear(member.id)
      setGear(res.data)
    } catch (err) {
      setError(err.userMessage || 'Failed to load gear')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGear()
  }, [member.id])

  const loadGearDetails = async (gearId) => {
    try {
      const [maintRes, contentRes] = await Promise.all([
        getGearMaintenance(member.id, gearId),
        getGearContents(member.id, gearId)
      ])
      setGearMaintenance(prev => ({ ...prev, [gearId]: maintRes.data }))
      setGearContents(prev => ({ ...prev, [gearId]: contentRes.data }))
    } catch (err) {
      console.error('Failed to load gear details:', err)
    }
  }

  const handleExpandGear = async (gearId) => {
    if (expandedGear === gearId) {
      setExpandedGear(null)
    } else {
      setExpandedGear(gearId)
      if (!gearMaintenance[gearId] && !gearContents[gearId]) {
        await loadGearDetails(gearId)
      }
    }
  }

  const handleDeleteGear = async (gearId) => {
    if (!confirm('Delete this gear item?')) return
    try {
      await deleteMemberGear(member.id, gearId)
      await loadGear()
    } catch (err) {
      setError(err.userMessage || 'Failed to delete gear')
    }
  }

  const handleCompleteMaintenance = async (gearId, maintId) => {
    try {
      await completeGearMaintenance(member.id, gearId, maintId, { action: 'Completed' })
      await loadGearDetails(gearId)
    } catch (err) {
      setError(err.userMessage || 'Failed to complete maintenance')
    }
  }

  const handleDeleteMaintenance = async (gearId, maintId) => {
    if (!confirm('Delete this maintenance schedule?')) return
    try {
      await deleteGearMaintenance(member.id, gearId, maintId)
      await loadGearDetails(gearId)
    } catch (err) {
      setError(err.userMessage || 'Failed to delete maintenance')
    }
  }

  const handleDeleteContent = async (gearId, contentId) => {
    if (!confirm('Delete this content item?')) return
    try {
      await deleteGearContents(member.id, gearId, contentId)
      await loadGearDetails(gearId)
    } catch (err) {
      setError(err.userMessage || 'Failed to delete content')
    }
  }

  const handleReplenishContent = async (gearId, content) => {
    try {
      // Calculate new expiration date based on typical shelf life (default 1 year)
      const today = new Date()
      const newExpDate = new Date(today.setFullYear(today.getFullYear() + 1))

      await updateGearContents(member.id, gearId, content.id, {
        status: 'GOOD',
        last_checked: new Date().toISOString(),
        expiration_date: content.expiration_date ? newExpDate.toISOString() : null,
      })
      await loadGearDetails(gearId)
    } catch (err) {
      setError(err.userMessage || 'Failed to replenish content')
    }
  }

  const handleQuantityChange = async (gearId, content, delta) => {
    const newQty = Math.max(0, (content.quantity || 0) + delta)
    // Determine new status based on quantity
    let newStatus = content.status
    if (newQty === 0) {
      newStatus = 'MISSING'
    } else if (content.min_quantity && newQty < content.min_quantity) {
      newStatus = 'LOW'
    } else if (content.status === 'MISSING' || content.status === 'LOW') {
      newStatus = 'GOOD'
    }

    try {
      await updateGearContents(member.id, gearId, content.id, {
        quantity: newQty,
        status: newStatus,
      })
      await loadGearDetails(gearId)
    } catch (err) {
      setError(err.userMessage || 'Failed to update quantity')
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    })
  }

  const getDueDateClass = (dateStr) => {
    if (!dateStr) return ''
    const due = new Date(dateStr)
    const today = new Date()
    const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return 'text-red-400'
    if (diffDays <= 7) return 'text-yellow-400'
    return 'text-green-400'
  }

  const getStatusBadge = (status) => {
    const statusObj = GEAR_STATUSES.find(s => s.value === status)
    return statusObj ? (
      <span className={`px-2 py-1 rounded text-xs ${statusObj.color}`}>
        {statusObj.label}
      </span>
    ) : status
  }

  const filteredGear = statusFilter === 'all'
    ? gear
    : statusFilter === 'attention'
      ? gear.filter(g => g.status !== 'SERVICEABLE')
      : gear.filter(g => g.status === statusFilter)

  if (loading) {
    return <div className="text-center text-gray-400 py-8">Loading gear...</div>
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm"
          >
            <option value="all">All Gear</option>
            <option value="attention">Needs Attention</option>
            {GEAR_STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <span className="text-sm text-gray-400">{filteredGear.length} items</span>
        </div>
        <button
          onClick={() => setShowAddGear(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-farm-green text-white rounded hover:bg-green-600 text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Gear
        </button>
      </div>

      {/* Gear List */}
      {filteredGear.length === 0 ? (
        <div className="bg-gray-700 rounded-lg p-8 text-center text-gray-400">
          <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No gear assigned</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredGear.map(item => (
            <div key={item.id} className="bg-gray-700 rounded-lg overflow-hidden">
              {/* Gear Header */}
              <div
                className="p-4 cursor-pointer flex items-start gap-2 hover:bg-gray-600/50"
                onClick={() => handleExpandGear(item.id)}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Shield className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{item.name}</span>
                      {getStatusBadge(item.status)}
                    </div>
                    <div className="text-sm text-gray-400 break-words">
                      {item.category}
                      {item.make && ` - ${item.make}`}
                      {item.model && ` ${item.model}`}
                      {item.caliber && ` (${item.caliber})`}
                    </div>
                    {/* Gear notes */}
                    {item.notes && (
                      <div className="text-xs text-gray-500 italic mt-1 break-words">{item.notes}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingGear(item) }}
                    className="p-1 text-gray-400 hover:text-white"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteGear(item.id) }}
                    className="p-1 text-gray-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {expandedGear === item.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {expandedGear === item.id && (
                <div className="border-t border-gray-600 p-4 space-y-4">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {item.serial_number && (
                      <div>
                        <span className="text-gray-400">S/N:</span>
                        <span className="ml-2">{item.serial_number}</span>
                      </div>
                    )}
                    {item.location && (
                      <div>
                        <span className="text-gray-400">Location:</span>
                        <span className="ml-2">{item.location}</span>
                      </div>
                    )}
                    {item.assigned_date && (
                      <div>
                        <span className="text-gray-400">Assigned:</span>
                        <span className="ml-2">{formatDate(item.assigned_date)}</span>
                      </div>
                    )}
                  </div>

                  {/* Maintenance Schedules */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <Wrench className="w-4 h-4" />
                        Maintenance Schedules
                      </h4>
                      <button
                        onClick={() => setShowAddMaint(item.id)}
                        className="text-sm text-farm-green hover:text-green-400 flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" /> Add
                      </button>
                    </div>
                    {gearMaintenance[item.id]?.length > 0 ? (
                      <div className="space-y-2">
                        {gearMaintenance[item.id].map(maint => (
                          <div key={maint.id} className="bg-gray-800 rounded p-3 flex items-center justify-between">
                            <div>
                              <div className="font-medium text-sm">{maint.name}</div>
                              <div className="text-xs text-gray-400">
                                {maint.frequency_days && `Every ${maint.frequency_days} days`}
                                {maint.frequency_rounds && ` / ${maint.frequency_rounds} rounds`}
                              </div>
                              {maint.due_date && (
                                <div className={`text-xs ${getDueDateClass(maint.due_date)}`}>
                                  Due: {formatDate(maint.due_date)}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleCompleteMaintenance(item.id, maint.id)}
                                className="p-1 text-green-400 hover:text-green-300"
                                title="Mark Complete"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteMaintenance(item.id, maint.id)}
                                className="p-1 text-gray-400 hover:text-red-400"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">No maintenance schedules</p>
                    )}
                  </div>

                  {/* Contents (for containers) */}
                  {item.is_container && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium flex items-center gap-2">
                          <Package className="w-4 h-4" />
                          Contents
                        </h4>
                        <button
                          onClick={() => setShowAddContent(item.id)}
                          className="text-sm text-farm-green hover:text-green-400 flex items-center gap-1"
                        >
                          <Plus className="w-4 h-4" /> Add
                        </button>
                      </div>
                      {gearContents[item.id]?.length > 0 ? (
                        <div className="space-y-2">
                          {gearContents[item.id].map(content => {
                            const statusObj = CONTENT_STATUSES.find(s => s.value === content.status)
                            const needsAttention = content.status !== 'GOOD'
                            return (
                              <div key={content.id} className={`bg-gray-800 rounded p-3 flex items-center justify-between ${needsAttention ? 'border-l-2 border-yellow-500' : ''}`}>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-sm">{content.item_name}</span>
                                    {statusObj && (
                                      <span className={`px-2 py-0.5 rounded text-xs ${statusObj.color}`}>
                                        {statusObj.label}
                                      </span>
                                    )}
                                    {content.battery_type && (
                                      <span className="px-1.5 py-0.5 rounded text-xs bg-blue-900/50 text-blue-300">
                                        {content.battery_type}
                                      </span>
                                    )}
                                    {content.needs_cleaning && (
                                      <span className="px-1.5 py-0.5 rounded text-xs bg-orange-900/50 text-orange-300">
                                        Needs Clean
                                      </span>
                                    )}
                                    {content.needs_recharge && (
                                      <span className="px-1.5 py-0.5 rounded text-xs bg-yellow-900/50 text-yellow-300">
                                        Needs Charge
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-400 flex items-center gap-2">
                                    {content.category && <span>{content.category}</span>}
                                    {content.category && <span>·</span>}
                                    <span className="flex items-center gap-1">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleQuantityChange(item.id, content, -1) }}
                                        className="p-0.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white"
                                        title="Decrease quantity"
                                      >
                                        <Minus className="w-3 h-3" />
                                      </button>
                                      <span className="min-w-[1.5rem] text-center">{content.quantity}</span>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleQuantityChange(item.id, content, 1) }}
                                        className="p-0.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white"
                                        title="Increase quantity"
                                      >
                                        <Plus className="w-3 h-3" />
                                      </button>
                                    </span>
                                    {content.min_quantity && <span>(min: {content.min_quantity})</span>}
                                  </div>
                                  {/* Show individual unit expirations or single expiration */}
                                  {content.units && content.units.length > 0 ? (
                                    <div className="text-xs space-y-0.5">
                                      {content.units.map((unit, idx) => (
                                        <div key={idx} className={unit.expiration_date ? getDueDateClass(unit.expiration_date) : 'text-gray-500'}>
                                          #{idx + 1}: {unit.expiration_date ? formatDate(unit.expiration_date) : 'No exp'}
                                          {unit.lot_number && ` (${unit.lot_number})`}
                                        </div>
                                      ))}
                                    </div>
                                  ) : content.expiration_date && (
                                    <div className={`text-xs ${getDueDateClass(content.expiration_date)}`}>
                                      Expires: {formatDate(content.expiration_date)}
                                    </div>
                                  )}
                                  {/* Show notes if present */}
                                  {content.notes && (
                                    <div className="text-xs text-gray-500 mt-1 italic">
                                      {content.notes}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleReplenishContent(item.id, content)}
                                    className="p-1 text-green-400 hover:text-green-300"
                                    title="Mark Replenished/Replaced"
                                  >
                                    <RefreshCw className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setEditingContent({ gearId: item.id, content })}
                                    className="p-1 text-gray-400 hover:text-white"
                                    title="Edit"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteContent(item.id, content.id)}
                                    className="p-1 text-gray-400 hover:text-red-400"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">No contents tracked</p>
                      )}
                    </div>
                  )}

                  {item.notes && (
                    <div className="text-sm text-gray-400">
                      <span className="font-medium text-gray-300">Notes:</span> {item.notes}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Gear Modal */}
      {(showAddGear || editingGear) && (
        <GearModal
          gear={editingGear}
          memberId={member.id}
          onClose={() => { setShowAddGear(false); setEditingGear(null) }}
          onSave={async () => {
            setShowAddGear(false)
            setEditingGear(null)
            await loadGear()
          }}
        />
      )}

      {/* Add Maintenance Modal */}
      {showAddMaint && (
        <MaintenanceModal
          memberId={member.id}
          gearId={showAddMaint}
          onClose={() => setShowAddMaint(null)}
          onSave={async () => {
            setShowAddMaint(null)
            await loadGearDetails(showAddMaint)
          }}
        />
      )}

      {/* Add Content Modal */}
      {showAddContent && (
        <ContentModal
          memberId={member.id}
          gearId={showAddContent}
          onClose={() => setShowAddContent(null)}
          onSave={async () => {
            const gearId = showAddContent
            setShowAddContent(null)
            await loadGearDetails(gearId)
          }}
        />
      )}

      {/* Edit Content Modal */}
      {editingContent && (
        <EditContentModal
          memberId={member.id}
          gearId={editingContent.gearId}
          content={editingContent.content}
          onClose={() => setEditingContent(null)}
          onSave={async () => {
            const gearId = editingContent.gearId
            setEditingContent(null)
            await loadGearDetails(gearId)
          }}
        />
      )}
    </div>
  )
}

// Gear Modal Component
function GearModal({ gear, memberId, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: gear?.name || '',
    category: gear?.category || 'OTHER',
    subcategory: gear?.subcategory || '',
    serial_number: gear?.serial_number || '',
    make: gear?.make || '',
    model: gear?.model || '',
    caliber: gear?.caliber || '',
    color: gear?.color || '',
    status: gear?.status || 'SERVICEABLE',
    location: gear?.location || '',
    is_container: gear?.is_container || false,
    requires_cleaning: gear?.requires_cleaning || false,
    requires_charging: gear?.requires_charging || false,
    has_expirables: gear?.has_expirables || false,
    notes: gear?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (gear) {
        await updateMemberGear(memberId, gear.id, formData)
      } else {
        await createMemberGear(memberId, formData)
      }
      onSave()
    } catch (err) {
      setError(err.userMessage || 'Failed to save gear')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="font-semibold">{gear ? 'Edit Gear' : 'Add Gear'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => {
                  const newCat = e.target.value
                  // Auto-set is_container for BAG category
                  setFormData({ ...formData, category: newCat, is_container: newCat === 'BAG' ? true : formData.is_container })
                }}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              >
                {GEAR_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              >
                {GEAR_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Make</label>
              <input
                type="text"
                value={formData.make}
                onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Model</label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Serial Number</label>
              <input
                type="text"
                value={formData.serial_number}
                onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Caliber</label>
              <input
                type="text"
                value={formData.caliber}
                onChange={(e) => setFormData({ ...formData, caliber: e.target.value })}
                placeholder="For firearms"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Color</label>
              <input
                type="text"
                value={formData.color || ''}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                placeholder="e.g., Black, OD Green, Coyote"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Location</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Where is it stored?"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.is_container}
                onChange={(e) => setFormData({ ...formData, is_container: e.target.checked })}
                className="rounded"
              />
              Can Hold Contents
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.requires_cleaning}
                onChange={(e) => setFormData({ ...formData, requires_cleaning: e.target.checked })}
                className="rounded"
              />
              Requires Cleaning
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.requires_charging}
                onChange={(e) => setFormData({ ...formData, requires_charging: e.target.checked })}
                className="rounded"
              />
              Requires Charging
            </label>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-farm-green text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : gear ? 'Save Changes' : 'Add Gear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Maintenance Modal Component
function MaintenanceModal({ memberId, gearId, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    frequency_days: '',
    frequency_rounds: '',
    next_due_date: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const data = {
        ...formData,
        frequency_days: formData.frequency_days ? parseInt(formData.frequency_days) : null,
        frequency_rounds: formData.frequency_rounds ? parseInt(formData.frequency_rounds) : null,
        next_due_date: formData.next_due_date || null,
      }
      await createGearMaintenance(memberId, gearId, data)
      onSave()
    } catch (err) {
      setError(err.userMessage || 'Failed to save maintenance schedule')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-[95vw] sm:max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="font-semibold">Add Maintenance Schedule</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Cleaning, Lubrication"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Every X Days</label>
              <input
                type="number"
                value={formData.frequency_days}
                onChange={(e) => setFormData({ ...formData, frequency_days: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Every X Rounds</label>
              <input
                type="number"
                value={formData.frequency_rounds}
                onChange={(e) => setFormData({ ...formData, frequency_rounds: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Next Due Date</label>
            <input
              type="date"
              value={formData.next_due_date}
              onChange={(e) => setFormData({ ...formData, next_due_date: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-farm-green text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Edit Content Modal Component
function EditContentModal({ memberId, gearId, content, onClose, onSave }) {
  const [formData, setFormData] = useState({
    item_name: content.item_name || '',
    category: content.category || '',
    quantity: content.quantity || 1,
    min_quantity: content.min_quantity || '',
    expiration_date: content.expiration_date ? content.expiration_date.split('T')[0] : '',
    expiration_alert_days: content.expiration_alert_days || 30,
    status: content.status || 'GOOD',
    battery_type: content.battery_type || '',
    needs_cleaning: content.needs_cleaning || false,
    needs_recharge: content.needs_recharge || false,
    notes: content.notes || '',
  })
  const [units, setUnits] = useState(content.units || [])
  const [trackIndividual, setTrackIndividual] = useState((content.units || []).length > 0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Sync units array with quantity when tracking individually
  const handleQuantityChange = (newQty) => {
    const qty = parseInt(newQty) || 0
    setFormData({ ...formData, quantity: newQty })
    if (trackIndividual && qty > 0) {
      const newUnits = [...units]
      while (newUnits.length < qty) {
        newUnits.push({ expiration_date: '', lot_number: '', notes: '' })
      }
      while (newUnits.length > qty) {
        newUnits.pop()
      }
      setUnits(newUnits)
    }
  }

  const handleToggleIndividual = (enabled) => {
    setTrackIndividual(enabled)
    if (enabled) {
      const qty = parseInt(formData.quantity) || 1
      const newUnits = []
      for (let i = 0; i < qty; i++) {
        newUnits.push({
          expiration_date: units[i]?.expiration_date || formData.expiration_date || '',
          lot_number: units[i]?.lot_number || '',
          notes: units[i]?.notes || ''
        })
      }
      setUnits(newUnits)
    }
  }

  const handleUnitChange = (index, field, value) => {
    const newUnits = [...units]
    newUnits[index] = { ...newUnits[index], [field]: value }
    setUnits(newUnits)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const data = {
        ...formData,
        quantity: parseInt(formData.quantity) || 1,
        min_quantity: formData.min_quantity ? parseInt(formData.min_quantity) : null,
        expiration_date: !trackIndividual && formData.expiration_date ? new Date(formData.expiration_date).toISOString() : null,
        units: trackIndividual ? units.map(u => ({
          ...u,
          expiration_date: u.expiration_date || null
        })) : [],
        last_checked: new Date().toISOString(),
      }
      await updateGearContents(memberId, gearId, content.id, data)
      onSave()
    } catch (err) {
      setError(err.userMessage || 'Failed to update content')
    } finally {
      setSaving(false)
    }
  }

  const handleReplenish = async () => {
    setSaving(true)
    setError(null)
    try {
      // Set status to GOOD and update expiration if present
      const today = new Date()
      const newExpDate = formData.expiration_date
        ? new Date(today.setFullYear(today.getFullYear() + 1))
        : null

      const data = {
        status: 'GOOD',
        last_checked: new Date().toISOString(),
        expiration_date: newExpDate ? newExpDate.toISOString() : null,
      }
      await updateGearContents(memberId, gearId, content.id, data)
      onSave()
    } catch (err) {
      setError(err.userMessage || 'Failed to replenish')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-[95vw] sm:max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="font-semibold">Edit Content Item</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Item Name *</label>
            <input
              type="text"
              value={formData.item_name}
              onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Category</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              >
                {CONTENT_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Quantity</label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                min="0"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Min Quantity</label>
              <input
                type="number"
                value={formData.min_quantity}
                onChange={(e) => setFormData({ ...formData, min_quantity: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              />
            </div>
          </div>

          {/* Individual Unit Tracking Toggle */}
          {parseInt(formData.quantity) > 1 && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={trackIndividual}
                onChange={(e) => handleToggleIndividual(e.target.checked)}
                className="rounded"
              />
              Track individual expirations (e.g., different lot numbers)
            </label>
          )}

          {/* Individual Units Section */}
          {trackIndividual && units.length > 0 ? (
            <div className="border border-gray-600 rounded-lg p-3 space-y-3">
              <div className="text-sm font-medium text-gray-300">Individual Units</div>
              {units.map((unit, idx) => (
                <div key={idx} className="bg-gray-700/50 rounded p-2 space-y-2">
                  <div className="text-xs text-gray-400">Unit {idx + 1}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Expiration</label>
                      <input
                        type="date"
                        value={unit.expiration_date || ''}
                        onChange={(e) => handleUnitChange(idx, 'expiration_date', e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Lot #</label>
                      <input
                        type="text"
                        value={unit.lot_number || ''}
                        onChange={(e) => handleUnitChange(idx, 'lot_number', e.target.value)}
                        placeholder="Optional"
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Expiration Date</label>
                <input
                  type="date"
                  value={formData.expiration_date}
                  onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Alert Days Before</label>
                <input
                  type="number"
                  value={formData.expiration_alert_days}
                  onChange={(e) => setFormData({ ...formData, expiration_alert_days: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                />
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Battery Type</label>
            <input
              type="text"
              value={formData.battery_type}
              onChange={(e) => setFormData({ ...formData, battery_type: e.target.value })}
              placeholder="AA, AAA, CR123A, 18650, etc."
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
            />
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={formData.needs_cleaning}
                onChange={(e) => setFormData({ ...formData, needs_cleaning: e.target.checked })}
                className="rounded border-gray-600"
              />
              <span className="text-gray-300">Needs Cleaning</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={formData.needs_recharge}
                onChange={(e) => setFormData({ ...formData, needs_recharge: e.target.checked })}
                className="rounded border-gray-600"
              />
              <span className="text-gray-300">Needs Recharge</span>
            </label>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
            />
          </div>
          <div className="flex justify-between pt-4">
            <button
              type="button"
              onClick={handleReplenish}
              disabled={saving}
              className="px-4 py-2 bg-green-700 text-white rounded hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Replenished
            </button>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-farm-green text-white rounded hover:bg-green-600 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// Content Modal Component
function ContentModal({ memberId, gearId, onClose, onSave }) {
  const [formData, setFormData] = useState({
    item_name: '',
    category: '',
    quantity: 1,
    min_quantity: '',
    expiration_date: '',
    expiration_alert_days: 30,
    status: 'GOOD',
    battery_type: '',
    needs_cleaning: false,
    needs_recharge: false,
    notes: '',
  })
  const [units, setUnits] = useState([])
  const [trackIndividual, setTrackIndividual] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Sync units array with quantity when tracking individually
  const handleQuantityChange = (newQty) => {
    const qty = parseInt(newQty) || 0
    setFormData({ ...formData, quantity: newQty })
    if (trackIndividual && qty > 0) {
      const newUnits = [...units]
      while (newUnits.length < qty) {
        newUnits.push({ expiration_date: '', lot_number: '', notes: '' })
      }
      while (newUnits.length > qty) {
        newUnits.pop()
      }
      setUnits(newUnits)
    }
  }

  const handleToggleIndividual = (enabled) => {
    setTrackIndividual(enabled)
    if (enabled) {
      const qty = parseInt(formData.quantity) || 1
      const newUnits = []
      for (let i = 0; i < qty; i++) {
        newUnits.push({
          expiration_date: units[i]?.expiration_date || formData.expiration_date || '',
          lot_number: units[i]?.lot_number || '',
          notes: units[i]?.notes || ''
        })
      }
      setUnits(newUnits)
    }
  }

  const handleUnitChange = (index, field, value) => {
    const newUnits = [...units]
    newUnits[index] = { ...newUnits[index], [field]: value }
    setUnits(newUnits)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const data = {
        ...formData,
        quantity: parseInt(formData.quantity) || 1,
        min_quantity: formData.min_quantity ? parseInt(formData.min_quantity) : null,
        expiration_date: !trackIndividual && formData.expiration_date ? new Date(formData.expiration_date).toISOString() : null,
        units: trackIndividual ? units.map(u => ({
          ...u,
          expiration_date: u.expiration_date || null
        })) : [],
        last_checked: new Date().toISOString(),
      }
      await createGearContents(memberId, gearId, data)
      onSave()
    } catch (err) {
      setError(err.userMessage || 'Failed to save content')
    } finally {
      setSaving(false)
    }
  }

  const qty = parseInt(formData.quantity) || 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-sm sm:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="font-semibold">Add Content Item</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Item Name *</label>
            <input
              type="text"
              value={formData.item_name}
              onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
              placeholder="e.g., TQ CAT Gen 7, MRE"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Category</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Medical, Food, etc."
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              >
                {CONTENT_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Quantity</label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                min="1"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Min Quantity</label>
              <input
                type="number"
                value={formData.min_quantity}
                onChange={(e) => setFormData({ ...formData, min_quantity: e.target.value })}
                placeholder="Alert threshold"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              />
            </div>
          </div>

          {/* Individual Unit Tracking Toggle */}
          {qty > 1 && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={trackIndividual}
                onChange={(e) => handleToggleIndividual(e.target.checked)}
                className="rounded border-gray-600"
              />
              Track individual expirations (e.g., different lot numbers)
            </label>
          )}

          {/* Individual Units Section */}
          {trackIndividual && units.length > 0 ? (
            <div className="border border-gray-600 rounded-lg p-3 space-y-3">
              <div className="text-sm font-medium text-gray-300">Individual Units</div>
              {units.map((unit, idx) => (
                <div key={idx} className="bg-gray-700/50 rounded p-2 space-y-2">
                  <div className="text-xs text-gray-400">Unit {idx + 1}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Expiration</label>
                      <input
                        type="date"
                        value={unit.expiration_date || ''}
                        onChange={(e) => handleUnitChange(idx, 'expiration_date', e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Lot #</label>
                      <input
                        type="text"
                        value={unit.lot_number || ''}
                        onChange={(e) => handleUnitChange(idx, 'lot_number', e.target.value)}
                        placeholder="Optional"
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Alert Days Before</label>
                  <input
                    type="number"
                    value={formData.expiration_alert_days}
                    onChange={(e) => setFormData({ ...formData, expiration_alert_days: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Expiration Date</label>
                <input
                  type="date"
                  value={formData.expiration_date}
                  onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Alert Days Before</label>
                <input
                  type="number"
                  value={formData.expiration_alert_days}
                  onChange={(e) => setFormData({ ...formData, expiration_alert_days: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Battery Type</label>
            <input
              type="text"
              value={formData.battery_type}
              onChange={(e) => setFormData({ ...formData, battery_type: e.target.value })}
              placeholder="AA, AAA, CR123A, 18650, etc."
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
            />
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={formData.needs_cleaning}
                onChange={(e) => setFormData({ ...formData, needs_cleaning: e.target.checked })}
                className="rounded border-gray-600"
              />
              <span className="text-gray-300">Needs Cleaning</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={formData.needs_recharge}
                onChange={(e) => setFormData({ ...formData, needs_recharge: e.target.checked })}
                className="rounded border-gray-600"
              />
              <span className="text-gray-300">Needs Recharge</span>
            </label>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-farm-green text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default MemberGearTab
