import React, { useState, useEffect } from 'react'
import {
  Shield, Plus, Edit, Trash2, ChevronDown, ChevronUp, Check, Clock,
  AlertTriangle, Package, Wrench, AlertCircle, Calendar, X
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

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString()
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
                className="p-4 cursor-pointer flex items-center justify-between hover:bg-gray-600/50"
                onClick={() => handleExpandGear(item.id)}
              >
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.name}</span>
                      {getStatusBadge(item.status)}
                      {item.is_container && (
                        <span className="px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded text-xs">Container</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-400">
                      {item.category}
                      {item.make && ` - ${item.make}`}
                      {item.model && ` ${item.model}`}
                      {item.caliber && ` (${item.caliber})`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
                            return (
                              <div key={content.id} className="bg-gray-800 rounded p-3 flex items-center justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{content.item_name}</span>
                                    {statusObj && (
                                      <span className={`px-2 py-0.5 rounded text-xs ${statusObj.color}`}>
                                        {statusObj.label}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    {content.category && `${content.category} · `}
                                    Qty: {content.quantity}
                                    {content.min_quantity && ` (min: ${content.min_quantity})`}
                                  </div>
                                  {content.expiration_date && (
                                    <div className={`text-xs ${getDueDateClass(content.expiration_date)}`}>
                                      Expires: {formatDate(content.expiration_date)}
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleDeleteContent(item.id, content.id)}
                                  className="p-1 text-gray-400 hover:text-red-400"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
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
      <div className="bg-gray-800 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="font-semibold">{gear ? 'Edit Gear' : 'Add Gear'}</h3>
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
          <div className="grid grid-cols-2 gap-4">
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
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
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
              Is Container (Go Bag)
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
      <div className="bg-gray-800 rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="font-semibold">Add Maintenance Schedule</h3>
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
          <div className="grid grid-cols-2 gap-4">
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
        quantity: parseInt(formData.quantity) || 1,
        min_quantity: formData.min_quantity ? parseInt(formData.min_quantity) : null,
        expiration_date: formData.expiration_date || null,
      }
      await createGearContents(memberId, gearId, data)
      onSave()
    } catch (err) {
      setError(err.userMessage || 'Failed to save content')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-md">
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
          <div className="grid grid-cols-2 gap-4">
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
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
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
          <div className="grid grid-cols-2 gap-4">
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
