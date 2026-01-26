import React, { useState, useEffect } from 'react'
import { Plus, Search, Sprout, ChevronDown, ChevronUp, Check, X, Save, Pencil, AlertTriangle } from 'lucide-react'
import { getSeeds, createSeed, updateSeed, deleteSeed, getSeedStats, getSeedCategories } from '../services/api'
import MottoDisplay from '../components/MottoDisplay'

// Reusable inline editable field component
function EditableField({ label, value, onChange, type = 'text', options = null, placeholder = '', rows = 1, editing = true }) {
  const readOnlyClass = "text-sm text-gray-300"

  // Read-only mode
  if (!editing) {
    if (type === 'checkbox') {
      return (
        <div className="flex items-center gap-2 bg-gray-900/30 rounded-lg p-3">
          <span className="text-sm text-gray-300">{label}:</span>
          <span className={value ? "text-green-400" : "text-red-400"}>{value ? "Yes" : "No"}</span>
        </div>
      )
    }

    if (type === 'select' && options) {
      const selectedOption = options.find(opt => opt.value === value)
      const display = selectedOption?.label || value || '-'
      return (
        <div className="bg-gray-900/30 rounded-lg p-3">
          <label className="text-xs text-gray-500 mb-1 block">{label}</label>
          <div className={readOnlyClass}>{display}</div>
        </div>
      )
    }

    if (type === 'textarea' && value) {
      return (
        <div className="bg-gray-900/30 rounded-lg p-3">
          <label className="text-xs text-gray-500 mb-1 block">{label}</label>
          <div className="text-sm text-gray-300 whitespace-pre-wrap max-h-[200px] overflow-y-auto">
            {value}
          </div>
        </div>
      )
    }

    // Simple text display
    if (!value) return null
    return (
      <div className="bg-gray-900/30 rounded-lg p-3">
        <label className="text-xs text-gray-500 mb-1 block">{label}</label>
        <div className={readOnlyClass}>{value}</div>
      </div>
    )
  }

  // Edit mode
  if (type === 'select' && options) {
    return (
      <div className="bg-gray-900/30 rounded-lg p-3">
        <label className="text-xs text-gray-500 mb-1 block">{label}</label>
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-farm-green"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    )
  }

  if (type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 bg-gray-900/30 rounded-lg p-3 cursor-pointer hover:bg-gray-900/50">
        <input
          type="checkbox"
          checked={value || false}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 rounded"
        />
        <span className="text-sm">{label}</span>
      </label>
    )
  }

  if (type === 'textarea') {
    return (
      <div className="bg-gray-900/30 rounded-lg p-3">
        <label className="text-xs text-gray-500 mb-1 block">{label}</label>
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-farm-green resize-none"
        />
      </div>
    )
  }

  return (
    <div className="bg-gray-900/30 rounded-lg p-3">
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-farm-green"
      />
    </div>
  )
}

// Seed Card component with inline editing
function SeedCard({ seed, categories, isExpanded, onToggle, onSave, onDelete }) {
  const [editData, setEditData] = useState(null)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Track seed updates to reset editData
  const [lastSeedUpdate, setLastSeedUpdate] = useState(seed.updated_at)

  // Reset editData when seed is updated externally
  useEffect(() => {
    if (seed.updated_at !== lastSeedUpdate) {
      setLastSeedUpdate(seed.updated_at)
      setEditData(null)
      setIsEditing(false)
    }
  }, [seed.updated_at, lastSeedUpdate])

  // Exit edit mode when card is collapsed
  useEffect(() => {
    if (!isExpanded) {
      setIsEditing(false)
    }
  }, [isExpanded])

  // Initialize edit data when expanded
  useEffect(() => {
    if (isExpanded && !editData) {
      setEditData({ ...seed })
    } else if (!isExpanded) {
      setEditData(null)
    }
  }, [isExpanded, seed])

  const handleFieldChange = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(seed.id, editData)
      setIsEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditData({ ...seed })
    setIsEditing(false)
  }

  const getCategoryColor = (category) => {
    const colors = {
      medicinal: 'bg-purple-900/50 text-purple-300',
      herb: 'bg-emerald-900/50 text-emerald-300',
      vegetable: 'bg-green-900/50 text-green-300',
      fruit: 'bg-red-900/50 text-red-300',
      flower: 'bg-pink-900/50 text-pink-300',
      native_florida: 'bg-cyan-900/50 text-cyan-300',
      vine: 'bg-lime-900/50 text-lime-300',
      shrub: 'bg-amber-900/50 text-amber-300',
      tree: 'bg-orange-900/50 text-orange-300',
      other: 'bg-gray-700 text-gray-300',
    }
    return colors[category] || colors.other
  }

  const sunOptions = [
    { value: 'full_sun', label: 'Full Sun' },
    { value: 'partial_sun', label: 'Partial Sun' },
    { value: 'partial_shade', label: 'Partial Shade' },
    { value: 'full_shade', label: 'Full Shade' },
  ]

  const waterOptions = [
    { value: 'low', label: 'Low' },
    { value: 'moderate', label: 'Moderate' },
    { value: 'high', label: 'High' },
  ]

  const getSunLabel = (req) => {
    const opt = sunOptions.find(o => o.value === req)
    return opt ? opt.label : req
  }

  const getWaterLabel = (req) => {
    const opt = waterOptions.find(o => o.value === req)
    return opt ? opt.label : req
  }

  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden">
      {/* Header - clickable to expand */}
      <div
        className="p-4 cursor-pointer hover:bg-gray-750"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-lg">{seed.name}</h3>
            <span className={`px-2 py-1 rounded-full text-xs ${getCategoryColor(seed.category)}`}>
              {seed.category?.replace('_', ' ')}
            </span>
            {seed.is_perennial ? (
              <span className="px-2 py-1 bg-emerald-900/30 text-emerald-300 rounded text-xs">Perennial</span>
            ) : (
              <span className="px-2 py-1 bg-amber-900/30 text-amber-300 rounded text-xs">Annual</span>
            )}
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>

        {seed.description && (
          <p className="text-sm text-gray-400 mt-1 line-clamp-2">{seed.description}</p>
        )}

        {/* Quick tags */}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {seed.is_perennial && <span title="Perennial" className="text-emerald-400">♾️</span>}
          {seed.medicinal_use && <span title="Medicinal">💊</span>}
          {seed.culinary_use && <span title="Culinary">🍳</span>}
          {seed.is_native && <span title="Native Florida">🌴</span>}
          {seed.attracts_pollinators && <span title="Pollinators">🐝</span>}
          {seed.drought_tolerant && <span title="Drought Tolerant">🏜️</span>}
          {seed.frost_sensitive && <span className="px-2 py-0.5 bg-blue-900/30 text-blue-300 rounded text-xs">Frost Sensitive</span>}
          {seed.heat_tolerant && <span className="px-2 py-0.5 bg-orange-900/30 text-orange-300 rounded text-xs">Heat Tolerant</span>}
          {seed.direct_sow && <span className="px-2 py-0.5 bg-green-900/30 text-green-300 rounded text-xs">Direct Sow</span>}
          {seed.special_requirements && (
            <span className="px-2 py-0.5 bg-yellow-900/30 text-yellow-300 rounded text-xs flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {seed.special_requirements}
            </span>
          )}
          {seed.grow_zones && (
            <span className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs">
              Zones {seed.grow_zones}
            </span>
          )}
        </div>
      </div>

      {/* Expanded content with inline editing */}
      {isExpanded && editData && (
        <div className="px-4 pb-4 border-t border-gray-700 pt-4 space-y-4">
          {/* Action Buttons - Edit/Save/Cancel and Delete */}
          <div className="flex gap-2 flex-wrap">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1.5 bg-farm-green hover:bg-farm-green-light rounded text-sm text-white transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  <Save className="w-3 h-3" /> {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={handleCancel}
                  className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-sm text-white transition-colors flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm text-white transition-colors flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" /> Edit
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(seed.id) }}
              className="px-3 py-1.5 bg-red-600/50 hover:bg-red-600 rounded text-sm text-white transition-colors flex items-center gap-1 ml-auto"
            >
              <X className="w-3 h-3" /> Delete
            </button>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <EditableField
              label="Name"
              value={editData.name}
              onChange={(v) => handleFieldChange('name', v)}
              editing={isEditing}
            />
            <EditableField
              label="Latin Name"
              value={editData.latin_name}
              onChange={(v) => handleFieldChange('latin_name', v)}
              placeholder="Genus species"
              editing={isEditing}
            />
            <EditableField
              label="Variety"
              value={editData.variety}
              onChange={(v) => handleFieldChange('variety', v)}
              editing={isEditing}
            />
            <EditableField
              label="Category"
              value={editData.category}
              onChange={(v) => handleFieldChange('category', v)}
              type="select"
              options={categories.map(c => ({ value: c.value, label: c.label }))}
              editing={isEditing}
            />
          </div>

          {/* Description */}
          <EditableField
            label="Description"
            value={editData.description}
            onChange={(v) => handleFieldChange('description', v)}
            type="textarea"
            rows={2}
            placeholder="Plant appearance, uses, characteristics..."
            editing={isEditing}
          />

          {/* Germination & Growth */}
          <h4 className="text-sm font-medium text-gray-400 pt-2">Germination & Growth</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <EditableField
              label="Germination Days"
              value={editData.days_to_germination}
              onChange={(v) => handleFieldChange('days_to_germination', v)}
              placeholder="e.g., 7-14 days"
              editing={isEditing}
            />
            <EditableField
              label="Days to Maturity"
              value={editData.days_to_maturity}
              onChange={(v) => handleFieldChange('days_to_maturity', v)}
              placeholder="e.g., 60-90 days"
              editing={isEditing}
            />
            <EditableField
              label="Optimal Germ Temp"
              value={editData.optimal_germ_temp}
              onChange={(v) => handleFieldChange('optimal_germ_temp', v)}
              placeholder="e.g., 70-85°F"
              editing={isEditing}
            />
            <EditableField
              label="Light to Germinate"
              value={editData.light_to_germinate}
              onChange={(v) => handleFieldChange('light_to_germinate', v)}
              placeholder="e.g., Light required"
              editing={isEditing}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <EditableField
              label="Grow Zones"
              value={editData.grow_zones}
              onChange={(v) => handleFieldChange('grow_zones', v)}
              placeholder="e.g., 8-11"
              editing={isEditing}
            />
            <EditableField
              label="Special Requirements"
              value={editData.special_requirements}
              onChange={(v) => handleFieldChange('special_requirements', v)}
              placeholder="e.g., Scarification, Cold stratification"
              editing={isEditing}
            />
          </div>

          {/* Planting Requirements */}
          <h4 className="text-sm font-medium text-gray-400 pt-2">Planting Requirements</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <EditableField
              label="Sow Depth"
              value={editData.planting_depth}
              onChange={(v) => handleFieldChange('planting_depth', v)}
              placeholder="e.g., 1/4 inch"
              editing={isEditing}
            />
            <EditableField
              label="Plant Spacing"
              value={editData.spacing}
              onChange={(v) => handleFieldChange('spacing', v)}
              placeholder="e.g., 12 inches"
              editing={isEditing}
            />
            <EditableField
              label="Soil Type"
              value={editData.soil_type}
              onChange={(v) => handleFieldChange('soil_type', v)}
              placeholder="e.g., Well-drained"
              editing={isEditing}
            />
            <EditableField
              label="pH Range"
              value={editData.ph_range}
              onChange={(v) => handleFieldChange('ph_range', v)}
              placeholder="e.g., 6.0-7.0"
              editing={isEditing}
            />
          </div>

          {/* Growing Conditions */}
          <h4 className="text-sm font-medium text-gray-400 pt-2">Growing Conditions</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <EditableField
              label="Sun Requirement"
              value={editData.sun_requirement}
              onChange={(v) => handleFieldChange('sun_requirement', v)}
              type="select"
              options={sunOptions}
              editing={isEditing}
            />
            <EditableField
              label="Water Needs"
              value={editData.water_requirement}
              onChange={(v) => handleFieldChange('water_requirement', v)}
              type="select"
              options={waterOptions}
              editing={isEditing}
            />
            <EditableField
              label="Height"
              value={editData.height}
              onChange={(v) => handleFieldChange('height', v)}
              placeholder="e.g., 24-36 in"
              editing={isEditing}
            />
            <EditableField
              label="Spread"
              value={editData.spread}
              onChange={(v) => handleFieldChange('spread', v)}
              placeholder="e.g., 12-18 in"
              editing={isEditing}
            />
          </div>

          {/* Sowing & Harvest Calendar */}
          <h4 className="text-sm font-medium text-gray-400 pt-2">Sowing & Harvest</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <EditableField
              label="When to Sow"
              value={editData.sow_months}
              onChange={(v) => handleFieldChange('sow_months', v)}
              placeholder="e.g., Jan-Mar, Sep-Nov"
              editing={isEditing}
            />
            <EditableField
              label="Harvest Time"
              value={editData.harvest_months}
              onChange={(v) => handleFieldChange('harvest_months', v)}
              placeholder="e.g., Apr-Jun"
              editing={isEditing}
            />
            <EditableField
              label="Spring Planting (9b)"
              value={editData.spring_planting}
              onChange={(v) => handleFieldChange('spring_planting', v)}
              placeholder="e.g., Feb-Apr"
              editing={isEditing}
            />
            <EditableField
              label="Fall Planting (9b)"
              value={editData.fall_planting}
              onChange={(v) => handleFieldChange('fall_planting', v)}
              placeholder="e.g., Sep-Nov"
              editing={isEditing}
            />
          </div>

          {/* Characteristics Flags */}
          <h4 className="text-sm font-medium text-gray-400 pt-2">Characteristics</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <EditableField
              label="Perennial"
              value={editData.is_perennial}
              onChange={(v) => handleFieldChange('is_perennial', v)}
              type="checkbox"
              editing={isEditing}
            />
            <EditableField
              label="Direct Sow"
              value={editData.direct_sow}
              onChange={(v) => handleFieldChange('direct_sow', v)}
              type="checkbox"
              editing={isEditing}
            />
            <EditableField
              label="Frost Sensitive"
              value={editData.frost_sensitive}
              onChange={(v) => handleFieldChange('frost_sensitive', v)}
              type="checkbox"
              editing={isEditing}
            />
            <EditableField
              label="Heat Tolerant"
              value={editData.heat_tolerant}
              onChange={(v) => handleFieldChange('heat_tolerant', v)}
              type="checkbox"
              editing={isEditing}
            />
            <EditableField
              label="Drought Tolerant"
              value={editData.drought_tolerant}
              onChange={(v) => handleFieldChange('drought_tolerant', v)}
              type="checkbox"
              editing={isEditing}
            />
            <EditableField
              label="Native Florida"
              value={editData.is_native}
              onChange={(v) => handleFieldChange('is_native', v)}
              type="checkbox"
              editing={isEditing}
            />
            <EditableField
              label="Pollinators"
              value={editData.attracts_pollinators}
              onChange={(v) => handleFieldChange('attracts_pollinators', v)}
              type="checkbox"
              editing={isEditing}
            />
            <EditableField
              label="Medicinal Use"
              value={editData.medicinal_use}
              onChange={(v) => handleFieldChange('medicinal_use', v)}
              type="checkbox"
              editing={isEditing}
            />
            <EditableField
              label="Culinary Use"
              value={editData.culinary_use}
              onChange={(v) => handleFieldChange('culinary_use', v)}
              type="checkbox"
              editing={isEditing}
            />
            <EditableField
              label="Ornamental Use"
              value={editData.ornamental_use}
              onChange={(v) => handleFieldChange('ornamental_use', v)}
              type="checkbox"
              editing={isEditing}
            />
          </div>

          {/* Notes */}
          <h4 className="text-sm font-medium text-gray-400 pt-2">Notes</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <EditableField
              label="Growing Notes"
              value={editData.growing_notes}
              onChange={(v) => handleFieldChange('growing_notes', v)}
              type="textarea"
              rows={2}
              editing={isEditing}
            />
            <EditableField
              label="Harvest Notes"
              value={editData.harvest_notes}
              onChange={(v) => handleFieldChange('harvest_notes', v)}
              type="textarea"
              rows={2}
              editing={isEditing}
            />
          </div>
          <EditableField
            label="Medicinal Notes"
            value={editData.medicinal_notes}
            onChange={(v) => handleFieldChange('medicinal_notes', v)}
            type="textarea"
            rows={2}
            editing={isEditing}
          />
          <EditableField
            label="General Notes"
            value={editData.notes}
            onChange={(v) => handleFieldChange('notes', v)}
            type="textarea"
            rows={2}
            editing={isEditing}
          />

        </div>
      )}
    </div>
  )
}

function Seeds() {
  const [seeds, setSeeds] = useState([])
  const [stats, setStats] = useState(null)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expandedSeed, setExpandedSeed] = useState(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const fetchSeeds = async () => {
    try {
      const params = {}
      if (search) params.search = search
      if (categoryFilter) params.category = categoryFilter
      const response = await getSeeds(params)
      setSeeds(response.data)
    } catch (error) {
      console.error('Failed to fetch seeds:', error)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await getSeedStats()
      setStats(response.data)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await getSeedCategories()
      setCategories(response.data.categories)
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchSeeds(), fetchStats(), fetchCategories()])
      setLoading(false)
    }
    loadData()
  }, [])

  useEffect(() => {
    fetchSeeds()
  }, [search, categoryFilter])

  const handleSave = async (id, data) => {
    try {
      await updateSeed(id, data)
      await fetchSeeds()
      await fetchStats()
    } catch (error) {
      console.error('Failed to save seed:', error)
      alert('Failed to save seed.')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Remove this seed from the catalog?')) return
    try {
      await deleteSeed(id)
      setExpandedSeed(null)
      fetchSeeds()
      fetchStats()
    } catch (error) {
      console.error('Failed to delete seed:', error)
    }
  }

  const handleAddNew = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const data = {
      name: formData.get('name'),
      latin_name: formData.get('latin_name') || null,
      variety: formData.get('variety') || null,
      category: formData.get('category'),
      quantity: formData.get('quantity') || null,
      source: formData.get('source') || null,
      days_to_germination: formData.get('days_to_germination') || null,
      days_to_maturity: formData.get('days_to_maturity') || null,
      planting_depth: formData.get('planting_depth') || null,
      spacing: formData.get('spacing') || null,
      row_spacing: formData.get('row_spacing') || null,
      optimal_germ_temp: formData.get('optimal_germ_temp') || null,
      sun_requirement: formData.get('sun_requirement'),
      light_to_germinate: formData.get('light_to_germinate') || null,
      water_requirement: formData.get('water_requirement'),
      soil_type: formData.get('soil_type') || null,
      ph_range: formData.get('ph_range') || null,
      grow_zones: formData.get('grow_zones') || null,
      spring_planting: formData.get('spring_planting') || null,
      fall_planting: formData.get('fall_planting') || null,
      sow_months: formData.get('sow_months') || null,
      harvest_months: formData.get('harvest_months') || null,
      indoor_start: formData.get('indoor_start') || null,
      direct_sow: formData.get('direct_sow') === 'on',
      frost_sensitive: formData.get('frost_sensitive') === 'on',
      heat_tolerant: formData.get('heat_tolerant') === 'on',
      drought_tolerant: formData.get('drought_tolerant') === 'on',
      height: formData.get('height') || null,
      spread: formData.get('spread') || null,
      is_perennial: formData.get('is_perennial') === 'on',
      is_native: formData.get('is_native') === 'on',
      attracts_pollinators: formData.get('attracts_pollinators') === 'on',
      culinary_use: formData.get('culinary_use') === 'on',
      medicinal_use: formData.get('medicinal_use') === 'on',
      ornamental_use: formData.get('ornamental_use') === 'on',
      special_requirements: formData.get('special_requirements') || null,
      description: formData.get('description') || null,
      growing_notes: formData.get('growing_notes') || null,
      harvest_notes: formData.get('harvest_notes') || null,
      medicinal_notes: formData.get('medicinal_notes') || null,
      notes: formData.get('notes') || null,
    }

    try {
      await createSeed(data)
      setShowForm(false)
      fetchSeeds()
      fetchStats()
    } catch (error) {
      console.error('Failed to add seed:', error)
      alert('Failed to add seed. It may already exist.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-farm-green"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Motto */}
      <MottoDisplay />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sprout className="w-7 h-7 text-green-500" />
          Seed Catalog
        </h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Seed
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-green-400">{stats.total}</div>
            <div className="text-sm text-gray-400">Total Seeds</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-purple-400">{stats.medicinal}</div>
            <div className="text-sm text-gray-400">Medicinal</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-cyan-400">{stats.native}</div>
            <div className="text-sm text-gray-400">Native Florida</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-amber-400">{stats.perennial}</div>
            <div className="text-sm text-gray-400">Perennial</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search seeds..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
      </div>

      {/* Seed List */}
      {seeds.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Sprout className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No seeds found. Add your first seed!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {seeds.map((seed) => (
            <SeedCard
              key={seed.id}
              seed={seed}
              categories={categories}
              isExpanded={expandedSeed === seed.id}
              onToggle={() => setExpandedSeed(expandedSeed === seed.id ? null : seed.id)}
              onSave={handleSave}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Add Seed Modal (only for new seeds) */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Add New Seed</h2>
            <form onSubmit={handleAddNew} className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Name *</label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Latin Name</label>
                  <input
                    type="text"
                    name="latin_name"
                    placeholder="Genus species"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Category</label>
                  <select
                    name="category"
                    defaultValue="other"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  >
                    {categories.map((cat) => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Variety</label>
                  <input
                    type="text"
                    name="variety"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Grow Zones</label>
                  <input
                    type="text"
                    name="grow_zones"
                    placeholder="e.g., 8-11"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="Plant appearance, uses, characteristics..."
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>

              {/* Growing Conditions */}
              <h3 className="text-lg font-medium pt-2 border-t border-gray-700">Growing Conditions</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Sun</label>
                  <select
                    name="sun_requirement"
                    defaultValue="full_sun"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  >
                    <option value="full_sun">Full Sun</option>
                    <option value="partial_sun">Partial Sun</option>
                    <option value="partial_shade">Partial Shade</option>
                    <option value="full_shade">Full Shade</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Water</label>
                  <select
                    name="water_requirement"
                    defaultValue="moderate"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  >
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              {/* Flags */}
              <h3 className="text-lg font-medium pt-2 border-t border-gray-700">Characteristics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="is_perennial" className="w-4 h-4" />
                  <span className="text-sm">Perennial</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="direct_sow" defaultChecked className="w-4 h-4" />
                  <span className="text-sm">Direct Sow</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="frost_sensitive" defaultChecked className="w-4 h-4" />
                  <span className="text-sm">Frost Sensitive</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="heat_tolerant" defaultChecked className="w-4 h-4" />
                  <span className="text-sm">Heat Tolerant</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="drought_tolerant" className="w-4 h-4" />
                  <span className="text-sm">Drought Tolerant</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="is_native" className="w-4 h-4" />
                  <span className="text-sm">Native Florida</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="attracts_pollinators" className="w-4 h-4" />
                  <span className="text-sm">Pollinators</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="medicinal_use" className="w-4 h-4" />
                  <span className="text-sm">Medicinal</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="culinary_use" className="w-4 h-4" />
                  <span className="text-sm">Culinary</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="ornamental_use" className="w-4 h-4" />
                  <span className="text-sm">Ornamental</span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors"
                >
                  Add Seed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Seeds
