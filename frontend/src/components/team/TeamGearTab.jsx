import React, { useState, useEffect } from 'react'
import {
  Package, Plus, Edit2, Trash2, User, UserMinus, RefreshCw,
  ChevronDown, ChevronRight, Shield, AlertCircle, Search, Filter
} from 'lucide-react'
import {
  getTeamGear, createPoolGear, updateTeamGear, deleteTeamGear, assignGear
} from '../../services/api'

const GEAR_CATEGORIES = [
  { value: 'FIREARM', label: 'Firearm' },
  { value: 'BAG', label: 'Bag' },
  { value: 'MEDICAL', label: 'Medical' },
  { value: 'COMMS', label: 'Communications' },
  { value: 'OPTICS', label: 'Optics' },
  { value: 'CLOTHING', label: 'Clothing' },
  { value: 'TOOLS', label: 'Tools' },
  { value: 'ELECTRONICS', label: 'Electronics' },
  { value: 'OTHER', label: 'Other' },
]

const GEAR_STATUS = [
  { value: 'SERVICEABLE', label: 'Serviceable', color: 'bg-green-500' },
  { value: 'NEEDS_MAINTENANCE', label: 'Needs Maintenance', color: 'bg-yellow-500' },
  { value: 'NEEDS_REPAIR', label: 'Needs Repair', color: 'bg-orange-500' },
  { value: 'OUT_OF_SERVICE', label: 'Out of Service', color: 'bg-red-500' },
]

function TeamGearTab({ members, onRefresh }) {
  const [gear, setGear] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterAssignment, setFilterAssignment] = useState('all') // all, assigned, unassigned
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingGear, setEditingGear] = useState(null)
  const [assigningGear, setAssigningGear] = useState(null)
  const [expandedCategories, setExpandedCategories] = useState({})

  useEffect(() => {
    loadGear()
  }, [])

  const loadGear = async () => {
    try {
      setLoading(true)
      const res = await getTeamGear()
      setGear(res.data || [])
      setError(null)
    } catch (err) {
      setError(err.userMessage || 'Failed to load gear')
    } finally {
      setLoading(false)
    }
  }

  // Filter gear based on search and filters
  const filteredGear = gear.filter(item => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        item.name?.toLowerCase().includes(q) ||
        item.make?.toLowerCase().includes(q) ||
        item.model?.toLowerCase().includes(q) ||
        item.serial_number?.toLowerCase().includes(q) ||
        item.color?.toLowerCase().includes(q) ||
        item.member?.name?.toLowerCase().includes(q) ||
        item.member?.nickname?.toLowerCase().includes(q)
      if (!matchesSearch) return false
    }
    if (filterCategory && item.category !== filterCategory) return false
    if (filterStatus && item.status !== filterStatus) return false
    if (filterAssignment === 'assigned' && !item.member_id) return false
    if (filterAssignment === 'unassigned' && item.member_id) return false
    return true
  })

  // Group by category
  const groupedGear = filteredGear.reduce((acc, item) => {
    const cat = item.category || 'OTHER'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  const toggleCategory = (cat) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  const getStatusColor = (status) => {
    const found = GEAR_STATUS.find(s => s.value === status)
    return found?.color || 'bg-gray-500'
  }

  const getStatusLabel = (status) => {
    const found = GEAR_STATUS.find(s => s.value === status)
    return found?.label || status
  }

  const handleDeleteGear = async (gearId) => {
    if (!confirm('Delete this gear item?')) return
    try {
      await deleteTeamGear(gearId)
      await loadGear()
    } catch (err) {
      setError(err.userMessage || 'Failed to delete gear')
    }
  }

  const handleAssign = async (gearId, memberId) => {
    try {
      await assignGear(gearId, memberId)
      await loadGear()
      setAssigningGear(null)
    } catch (err) {
      setError(err.userMessage || 'Failed to assign gear')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-farm-green" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-6 h-6 text-farm-green" />
          <h2 className="text-xl font-semibold">Team Gear Inventory</h2>
          <span className="text-sm text-gray-400">({gear.length} items)</span>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3 py-2 bg-farm-green text-white rounded-lg hover:bg-green-600"
        >
          <Plus className="w-4 h-4" />
          Add Gear
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-gray-700/50 rounded-lg p-3">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search gear..."
              className="w-full pl-9 pr-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
            />
          </div>
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
        >
          <option value="">All Categories</option>
          {GEAR_CATEGORIES.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
        >
          <option value="">All Status</option>
          {GEAR_STATUS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={filterAssignment}
          onChange={(e) => setFilterAssignment(e.target.value)}
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
        >
          <option value="all">All Gear</option>
          <option value="assigned">Assigned Only</option>
          <option value="unassigned">Pool (Unassigned)</option>
        </select>
        <button
          onClick={loadGear}
          className="p-2 text-gray-400 hover:text-white rounded hover:bg-gray-600"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-700/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-white">{gear.length}</div>
          <div className="text-xs text-gray-400">Total Items</div>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-400">{gear.filter(g => g.member_id).length}</div>
          <div className="text-xs text-gray-400">Assigned</div>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-purple-400">{gear.filter(g => !g.member_id).length}</div>
          <div className="text-xs text-gray-400">Pool</div>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-yellow-400">
            {gear.filter(g => g.status === 'NEEDS_MAINTENANCE' || g.status === 'NEEDS_REPAIR').length}
          </div>
          <div className="text-xs text-gray-400">Needs Attention</div>
        </div>
      </div>

      {/* Gear List by Category */}
      <div className="space-y-2">
        {Object.keys(groupedGear).sort().map(category => {
          const items = groupedGear[category]
          const isExpanded = expandedCategories[category] !== false // default expanded
          const catLabel = GEAR_CATEGORIES.find(c => c.value === category)?.label || category

          return (
            <div key={category} className="bg-gray-700/30 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-700/50"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <Shield className="w-5 h-5 text-farm-green" />
                  <span className="font-medium">{catLabel}</span>
                  <span className="text-sm text-gray-400">({items.length})</span>
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-3 space-y-2">
                  {items.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between bg-gray-800 rounded-lg p-3 group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`w-2 h-2 rounded-full ${getStatusColor(item.status)}`} />
                          <span className="font-medium">{item.name}</span>
                          {item.make && item.model && (
                            <span className="text-sm text-gray-400">{item.make} {item.model}</span>
                          )}
                          {item.color && (
                            <span className="text-xs px-2 py-0.5 bg-gray-600 rounded">{item.color}</span>
                          )}
                          {item.serial_number && (
                            <span className="text-xs text-gray-500">S/N: {item.serial_number}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm">
                          {item.member ? (
                            <span className="flex items-center gap-1 text-green-400">
                              <User className="w-3 h-3" />
                              {item.member.nickname || item.member.name}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-purple-400">
                              <Package className="w-3 h-3" />
                              Pool (Unassigned)
                            </span>
                          )}
                          {item.location && (
                            <span className="text-gray-500">@ {item.location}</span>
                          )}
                          <span className="text-gray-500">{getStatusLabel(item.status)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setAssigningGear(item)}
                          className="p-1.5 text-gray-400 hover:text-purple-400 rounded hover:bg-gray-700"
                          title={item.member_id ? 'Reassign' : 'Assign to member'}
                        >
                          {item.member_id ? <UserMinus className="w-4 h-4" /> : <User className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => setEditingGear(item)}
                          className="p-1.5 text-gray-400 hover:text-blue-400 rounded hover:bg-gray-700"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteGear(item.id)}
                          className="p-1.5 text-gray-400 hover:text-red-400 rounded hover:bg-gray-700"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {Object.keys(groupedGear).length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No gear found matching your filters
          </div>
        )}
      </div>

      {/* Add/Edit Gear Modal */}
      {(showAddModal || editingGear) && (
        <GearFormModal
          gear={editingGear}
          onClose={() => {
            setShowAddModal(false)
            setEditingGear(null)
          }}
          onSave={async (data) => {
            if (editingGear) {
              await updateTeamGear(editingGear.id, data)
            } else {
              await createPoolGear(data)
            }
            await loadGear()
            setShowAddModal(false)
            setEditingGear(null)
          }}
        />
      )}

      {/* Assign Gear Modal */}
      {assigningGear && (
        <AssignGearModal
          gear={assigningGear}
          members={members}
          onClose={() => setAssigningGear(null)}
          onAssign={handleAssign}
        />
      )}
    </div>
  )
}

// Gear Form Modal
function GearFormModal({ gear, onClose, onSave }) {
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
      await onSave(formData)
    } catch (err) {
      setError(err.userMessage || 'Failed to save gear')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">
          {gear ? 'Edit Gear' : 'Add Gear to Pool'}
        </h3>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded p-2 text-red-200 text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
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
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
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
                {GEAR_STATUS.map(s => (
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
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                placeholder="e.g., Black, OD Green"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              />
            </div>
            <div>
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

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !formData.name}
              className="px-4 py-2 bg-farm-green text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : gear ? 'Update' : 'Add to Pool'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Assign Gear Modal
function AssignGearModal({ gear, members, onClose, onAssign }) {
  const [selectedMember, setSelectedMember] = useState(gear.member_id || '')
  const [assigning, setAssigning] = useState(false)

  const handleAssign = async () => {
    setAssigning(true)
    await onAssign(gear.id, selectedMember || null)
    setAssigning(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">
          {gear.member_id ? 'Reassign Gear' : 'Assign Gear'}
        </h3>

        <div className="mb-4">
          <div className="text-sm text-gray-400 mb-2">Gear Item:</div>
          <div className="font-medium">{gear.name}</div>
          {gear.make && gear.model && (
            <div className="text-sm text-gray-400">{gear.make} {gear.model}</div>
          )}
        </div>

        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-1">Assign To</label>
          <select
            value={selectedMember}
            onChange={(e) => setSelectedMember(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
          >
            <option value="">Pool (Unassigned)</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>
                {m.nickname || m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={assigning}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-500 disabled:opacity-50"
          >
            {assigning ? 'Assigning...' : selectedMember ? 'Assign' : 'Move to Pool'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default TeamGearTab
