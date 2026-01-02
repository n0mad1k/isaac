import React, { useState, useEffect } from 'react'
import {
  Plus, Search, Leaf, Droplets, Sun, Snowflake, ChevronDown, ChevronUp,
  Thermometer, MapPin, Calendar, Clock, Scissors, Apple, AlertTriangle,
  Info, X, Tag as TagIcon, Pencil, Save
} from 'lucide-react'
import {
  getPlants, createPlant, updatePlant, addPlantCareLog, getPlantTags, createPlantTag
} from '../services/api'

// Inline editable field component
function EditableField({ label, value, field, type = 'text', options, onChange, placeholder }) {
  const inputClass = "w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500"

  if (type === 'select' && options) {
    return (
      <div>
        <label className="block text-xs text-gray-500 mb-1">{label}</label>
        <select
          value={value || ''}
          onChange={(e) => onChange(field, e.target.value)}
          className={inputClass}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    )
  }

  if (type === 'textarea') {
    return (
      <div>
        <label className="block text-xs text-gray-500 mb-1">{label}</label>
        <textarea
          value={value || ''}
          onChange={(e) => onChange(field, e.target.value)}
          placeholder={placeholder}
          rows={2}
          className={inputClass}
        />
      </div>
    )
  }

  if (type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value || false}
          onChange={(e) => onChange(field, e.target.checked)}
          className="w-4 h-4 rounded bg-gray-700 border-gray-600"
        />
        <span className="text-sm text-gray-300">{label}</span>
      </label>
    )
  }

  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(field, e.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
    </div>
  )
}

// Sun requirement options
const SUN_OPTIONS = [
  { value: 'full_sun', label: 'Full Sun' },
  { value: 'partial_sun', label: 'Partial Sun' },
  { value: 'partial_shade', label: 'Partial Shade' },
  { value: 'full_shade', label: 'Full Shade' },
]

const GROWTH_RATE_OPTIONS = [
  { value: 'slow', label: 'Slow' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'fast', label: 'Fast' },
  { value: 'very_fast', label: 'Very Fast' },
]

function Plants() {
  const [plants, setPlants] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expandedPlant, setExpandedPlant] = useState(null)
  const [search, setSearch] = useState('')
  const [filterTag, setFilterTag] = useState('all')
  const [filterSpecial, setFilterSpecial] = useState('all')
  const [editDateModal, setEditDateModal] = useState(null)

  const fetchData = async () => {
    try {
      const [plantsRes, tagsRes] = await Promise.all([
        getPlants(),
        getPlantTags()
      ])
      setPlants(plantsRes.data)
      setTags(tagsRes.data)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const filteredPlants = plants.filter((plant) => {
    const matchesSearch = plant.name.toLowerCase().includes(search.toLowerCase()) ||
      (plant.latin_name && plant.latin_name.toLowerCase().includes(search.toLowerCase()))

    let matchesTag = filterTag === 'all'
    if (!matchesTag && plant.tags) {
      matchesTag = plant.tags.some(t => t.name.toLowerCase() === filterTag.toLowerCase())
    }

    let matchesSpecial = filterSpecial === 'all'
    if (filterSpecial === 'frost_sensitive') matchesSpecial = plant.frost_sensitive
    if (filterSpecial === 'drought_tolerant') matchesSpecial = plant.drought_tolerant
    if (filterSpecial === 'needs_water') matchesSpecial = plant.next_watering && new Date(plant.next_watering) <= new Date()
    if (filterSpecial === 'needs_fertilizer') matchesSpecial = plant.next_fertilizing && new Date(plant.next_fertilizing) <= new Date()

    return matchesSearch && matchesTag && matchesSpecial
  })

  const getTagColor = (color) => {
    const colors = {
      green: 'bg-green-900/50 text-green-300',
      purple: 'bg-purple-900/50 text-purple-300',
      cyan: 'bg-cyan-900/50 text-cyan-300',
      emerald: 'bg-emerald-900/50 text-emerald-300',
      amber: 'bg-amber-900/50 text-amber-300',
      orange: 'bg-orange-900/50 text-orange-300',
      red: 'bg-red-900/50 text-red-300',
      yellow: 'bg-yellow-900/50 text-yellow-300',
      pink: 'bg-pink-900/50 text-pink-300',
      brown: 'bg-amber-900/50 text-amber-200',
      lime: 'bg-lime-900/50 text-lime-300',
      teal: 'bg-teal-900/50 text-teal-300',
      rose: 'bg-rose-900/50 text-rose-300',
      fuchsia: 'bg-fuchsia-900/50 text-fuchsia-300',
      gray: 'bg-gray-700 text-gray-300',
    }
    return colors[color] || colors.gray
  }

  const logCare = async (plantId, careType) => {
    try {
      await addPlantCareLog(plantId, { care_type: careType })
      fetchData()
    } catch (error) {
      console.error('Failed to log care:', error)
    }
  }

  const updateCareDate = async (plantId, field, dateValue) => {
    try {
      await updatePlant(plantId, { [field]: dateValue })
      setEditDateModal(null)
      fetchData()
    } catch (error) {
      console.error('Failed to update date:', error)
      alert('Failed to update date')
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatRelativeDate = (dateStr) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.round((date - now) / (1000 * 60 * 60 * 24))

    if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Tomorrow'
    return `In ${diffDays}d`
  }

  const getSunLabel = (sunReq) => {
    const labels = {
      full_sun: 'Full Sun',
      partial_sun: 'Partial Sun',
      partial_shade: 'Partial Shade',
      full_shade: 'Full Shade',
    }
    return labels[sunReq] || sunReq
  }

  const getGrowthRateLabel = (rate) => {
    const labels = {
      slow: 'Slow',
      moderate: 'Moderate',
      fast: 'Fast',
      very_fast: 'Very Fast',
    }
    return labels[rate] || rate
  }

  // Stats
  const stats = {
    total: plants.length,
    frostSensitive: plants.filter(p => p.frost_sensitive).length,
    needsWater: plants.filter(p => p.next_watering && new Date(p.next_watering) <= new Date()).length,
    needsFertilizer: plants.filter(p => p.next_fertilizing && new Date(p.next_fertilizing) <= new Date()).length,
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Leaf className="w-7 h-7 text-green-500" />
          Plants & Trees
        </h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-farm-green hover:bg-farm-green-light rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Plant
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-green-400">{stats.total}</div>
          <div className="text-sm text-gray-400">Total Plants</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-blue-400">{stats.frostSensitive}</div>
          <div className="text-sm text-gray-400">Frost Sensitive</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <div className={`text-2xl font-bold ${stats.needsWater > 0 ? 'text-cyan-400' : 'text-gray-500'}`}>
            {stats.needsWater}
          </div>
          <div className="text-sm text-gray-400">Need Water</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <div className={`text-2xl font-bold ${stats.needsFertilizer > 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
            {stats.needsFertilizer}
          </div>
          <div className="text-sm text-gray-400">Need Fertilizer</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search plants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
          />
        </div>
        <select
          value={filterTag}
          onChange={(e) => setFilterTag(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
        >
          <option value="all">All Tags</option>
          {tags.map(tag => (
            <option key={tag.id} value={tag.name}>{tag.name}</option>
          ))}
        </select>
        <select
          value={filterSpecial}
          onChange={(e) => setFilterSpecial(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
        >
          <option value="all">All Plants</option>
          <option value="frost_sensitive">Frost Sensitive</option>
          <option value="drought_tolerant">Drought Tolerant</option>
          <option value="needs_water">Needs Water Today</option>
          <option value="needs_fertilizer">Needs Fertilizer</option>
        </select>
      </div>

      {/* Plant List */}
      {filteredPlants.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Leaf className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No plants found. Add your first plant!</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filteredPlants.map((plant) => (
            <PlantCard
              key={plant.id}
              plant={plant}
              tags={tags}
              expanded={expandedPlant === plant.id}
              onToggle={() => setExpandedPlant(expandedPlant === plant.id ? null : plant.id)}
              onLogCare={logCare}
              onEditDate={setEditDateModal}
              onSave={fetchData}
              getTagColor={getTagColor}
              formatDate={formatDate}
              formatRelativeDate={formatRelativeDate}
              getSunLabel={getSunLabel}
              getGrowthRateLabel={getGrowthRateLabel}
            />
          ))}
        </div>
      )}

      {/* Add Plant Modal (only for new plants) */}
      {showForm && (
        <PlantFormModal
          tags={tags}
          onClose={() => setShowForm(false)}
          onSave={() => { setShowForm(false); fetchData() }}
        />
      )}

      {/* Edit Date Modal */}
      {editDateModal && (
        <EditDateModal
          label={editDateModal.label}
          currentDate={editDateModal.currentDate}
          onClose={() => setEditDateModal(null)}
          onSave={(date) => updateCareDate(editDateModal.plantId, editDateModal.field, date)}
        />
      )}
    </div>
  )
}


// Plant Card Component with inline editing
function PlantCard({
  plant, tags, expanded, onToggle, onLogCare, onEditDate, onSave,
  getTagColor, formatDate, formatRelativeDate, getSunLabel, getGrowthRateLabel
}) {
  const [editData, setEditData] = useState(null)
  const [saving, setSaving] = useState(false)

  // Initialize edit data when expanded
  useEffect(() => {
    if (expanded && !editData) {
      setEditData({
        name: plant.name || '',
        latin_name: plant.latin_name || '',
        variety: plant.variety || '',
        description: plant.description || '',
        location: plant.location || '',
        source: plant.source || '',
        grow_zones: plant.grow_zones || '',
        sun_requirement: plant.sun_requirement || 'full_sun',
        soil_requirements: plant.soil_requirements || '',
        plant_spacing: plant.plant_spacing || '',
        size_full_grown: plant.size_full_grown || '',
        growth_rate: plant.growth_rate || 'moderate',
        min_temp: plant.min_temp || '',
        frost_sensitive: plant.frost_sensitive || false,
        needs_cover_below_temp: plant.needs_cover_below_temp || '',
        heat_tolerant: plant.heat_tolerant ?? true,
        drought_tolerant: plant.drought_tolerant || false,
        salt_tolerant: plant.salt_tolerant || false,
        needs_shade_above_temp: plant.needs_shade_above_temp || '',
        water_schedule: plant.water_schedule || '',
        fertilize_schedule: plant.fertilize_schedule || '',
        prune_frequency: plant.prune_frequency || '',
        prune_months: plant.prune_months || '',
        produces_months: plant.produces_months || '',
        harvest_frequency: plant.harvest_frequency || '',
        how_to_harvest: plant.how_to_harvest || '',
        uses: plant.uses || '',
        propagation_methods: plant.propagation_methods || '',
        known_hazards: plant.known_hazards || '',
        special_considerations: plant.special_considerations || '',
        notes: plant.notes || '',
        tag_ids: plant.tags?.map(t => t.id) || [],
      })
    }
  }, [expanded, plant])

  const handleFieldChange = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }))
  }

  const toggleTag = (tagId) => {
    setEditData(prev => ({
      ...prev,
      tag_ids: prev.tag_ids.includes(tagId)
        ? prev.tag_ids.filter(id => id !== tagId)
        : [...prev.tag_ids, tagId]
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const data = {
        ...editData,
        min_temp: editData.min_temp ? parseFloat(editData.min_temp) : null,
        needs_cover_below_temp: editData.needs_cover_below_temp ? parseFloat(editData.needs_cover_below_temp) : null,
        needs_shade_above_temp: editData.needs_shade_above_temp ? parseFloat(editData.needs_shade_above_temp) : null,
      }
      await updatePlant(plant.id, data)
      if (onSave) onSave()
    } catch (error) {
      console.error('Failed to save:', error)
      alert('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      {/* Card Header */}
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-750"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-semibold text-lg">{plant.name}</h3>
            {plant.tags && plant.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {plant.tags.slice(0, 3).map(tag => (
                  <span key={tag.id} className={`px-2 py-0.5 rounded-full text-xs ${getTagColor(tag.color)}`}>
                    {tag.name}
                  </span>
                ))}
                {plant.tags.length > 3 && (
                  <span className="text-xs text-gray-500">+{plant.tags.length - 3}</span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
            {plant.description && (
              <span className="truncate max-w-[300px]">{plant.description}</span>
            )}
            {plant.age_years && (
              <span className="text-green-400 whitespace-nowrap">{plant.age_years} yrs old</span>
            )}
            {plant.min_temp && (
              <span className="text-blue-400 whitespace-nowrap">Min: {plant.min_temp}°F</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 ml-4">
          <div className="flex items-center gap-2">
            {plant.frost_sensitive && (
              <span title="Frost Sensitive" className="text-blue-400">
                <Snowflake className="w-4 h-4" />
              </span>
            )}
            {plant.drought_tolerant && (
              <span title="Drought Tolerant" className="text-yellow-400">
                <Sun className="w-4 h-4" />
              </span>
            )}
            {plant.heat_tolerant && (
              <span title="Heat Tolerant" className="text-orange-400">
                <Thermometer className="w-4 h-4" />
              </span>
            )}
            {plant.next_watering && new Date(plant.next_watering) <= new Date() && (
              <span title="Needs Water" className="text-cyan-400">
                <Droplets className="w-4 h-4" />
              </span>
            )}
            {plant.known_hazards && (
              <span title="Has Hazards" className="text-red-400">
                <AlertTriangle className="w-4 h-4" />
              </span>
            )}
          </div>
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded Details with Inline Editing */}
      {expanded && editData && (
        <div className="px-4 pb-4 border-t border-gray-700 pt-4 space-y-4">
          {/* Basic Info - Editable */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <EditableField label="Name" value={editData.name} field="name" onChange={handleFieldChange} />
            <EditableField label="Latin Name" value={editData.latin_name} field="latin_name" onChange={handleFieldChange} placeholder="Genus species" />
            <EditableField label="Variety" value={editData.variety} field="variety" onChange={handleFieldChange} />
            <EditableField label="Location" value={editData.location} field="location" onChange={handleFieldChange} placeholder="e.g., North orchard" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <EditableField label="Description" value={editData.description} field="description" type="textarea" onChange={handleFieldChange} />
            <EditableField label="Source" value={editData.source} field="source" onChange={handleFieldChange} placeholder="Where purchased" />
          </div>

          {/* Growing Requirements */}
          <div className="bg-gray-900/50 rounded-lg p-3">
            <h4 className="text-sm font-medium text-gray-400 mb-3">Growing Requirements</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <EditableField label="Grow Zones" value={editData.grow_zones} field="grow_zones" onChange={handleFieldChange} placeholder="e.g., 9-11" />
              <EditableField label="Sun Requirement" value={editData.sun_requirement} field="sun_requirement" type="select" options={SUN_OPTIONS} onChange={handleFieldChange} />
              <EditableField label="Growth Rate" value={editData.growth_rate} field="growth_rate" type="select" options={GROWTH_RATE_OPTIONS} onChange={handleFieldChange} />
              <EditableField label="Soil Requirements" value={editData.soil_requirements} field="soil_requirements" onChange={handleFieldChange} placeholder="e.g., Well-drained" />
              <EditableField label="Plant Spacing" value={editData.plant_spacing} field="plant_spacing" onChange={handleFieldChange} placeholder="e.g., 15-20 feet" />
              <EditableField label="Size Full Grown" value={editData.size_full_grown} field="size_full_grown" onChange={handleFieldChange} placeholder="e.g., 20-30 ft" />
            </div>
          </div>

          {/* Temperature & Tolerance */}
          <div className="bg-gray-900/50 rounded-lg p-3">
            <h4 className="text-sm font-medium text-gray-400 mb-3">Temperature & Tolerance</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <EditableField label="Min Temp (°F)" value={editData.min_temp} field="min_temp" type="number" onChange={handleFieldChange} />
              <EditableField label="Cover Below (°F)" value={editData.needs_cover_below_temp} field="needs_cover_below_temp" type="number" onChange={handleFieldChange} />
              <EditableField label="Shade Above (°F)" value={editData.needs_shade_above_temp} field="needs_shade_above_temp" type="number" onChange={handleFieldChange} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <EditableField label="Frost Sensitive" value={editData.frost_sensitive} field="frost_sensitive" type="checkbox" onChange={handleFieldChange} />
              <EditableField label="Heat Tolerant" value={editData.heat_tolerant} field="heat_tolerant" type="checkbox" onChange={handleFieldChange} />
              <EditableField label="Drought Tolerant" value={editData.drought_tolerant} field="drought_tolerant" type="checkbox" onChange={handleFieldChange} />
              <EditableField label="Salt Tolerant" value={editData.salt_tolerant} field="salt_tolerant" type="checkbox" onChange={handleFieldChange} />
            </div>
          </div>

          {/* Care Schedule */}
          <div className="bg-gray-900/50 rounded-lg p-3">
            <h4 className="text-sm font-medium text-gray-400 mb-3">Care Schedule</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <EditableField label="Water Schedule" value={editData.water_schedule} field="water_schedule" onChange={handleFieldChange} placeholder="summer:3,winter:10" />
                <p className="text-xs text-gray-500 mt-1">Days between watering per season</p>
              </div>
              <div>
                <EditableField label="Fertilize Schedule" value={editData.fertilize_schedule} field="fertilize_schedule" onChange={handleFieldChange} placeholder="spring:30,summer:45" />
                <p className="text-xs text-gray-500 mt-1">Days between fertilizing (0=none)</p>
              </div>
              <EditableField label="Prune Frequency" value={editData.prune_frequency} field="prune_frequency" onChange={handleFieldChange} placeholder="e.g., Yearly after fruiting" />
              <EditableField label="Prune Months" value={editData.prune_months} field="prune_months" onChange={handleFieldChange} placeholder="e.g., Feb-Mar" />
            </div>

            {/* Care Status Display */}
            <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-cyan-400">
                  <Droplets className="w-4 h-4" />
                  <span>Watering</span>
                </div>
                <div className="flex items-center gap-1 text-gray-500 text-xs">
                  <span>Last: {plant.last_watered ? formatDate(plant.last_watered) : 'Never'}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onEditDate({ plantId: plant.id, field: 'last_watered', label: 'Last Watered', currentDate: plant.last_watered }) }}
                    className="p-0.5 hover:bg-gray-700 rounded"
                  >
                    <Pencil className="w-3 h-3 text-gray-500 hover:text-cyan-400" />
                  </button>
                </div>
                {plant.next_watering && (
                  <p className={`text-xs ${new Date(plant.next_watering) <= new Date() ? 'text-cyan-400 font-medium' : 'text-gray-500'}`}>
                    Next: {formatRelativeDate(plant.next_watering)}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-green-400">
                  <Leaf className="w-4 h-4" />
                  <span>Fertilizing</span>
                </div>
                <div className="flex items-center gap-1 text-gray-500 text-xs">
                  <span>Last: {plant.last_fertilized ? formatDate(plant.last_fertilized) : 'Never'}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onEditDate({ plantId: plant.id, field: 'last_fertilized', label: 'Last Fertilized', currentDate: plant.last_fertilized }) }}
                    className="p-0.5 hover:bg-gray-700 rounded"
                  >
                    <Pencil className="w-3 h-3 text-gray-500 hover:text-green-400" />
                  </button>
                </div>
                {plant.next_fertilizing && (
                  <p className={`text-xs ${new Date(plant.next_fertilizing) <= new Date() ? 'text-green-400 font-medium' : 'text-gray-500'}`}>
                    Next: {formatRelativeDate(plant.next_fertilizing)}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-amber-400">
                  <Scissors className="w-4 h-4" />
                  <span>Pruning</span>
                </div>
                <div className="flex items-center gap-1 text-gray-500 text-xs">
                  <span>Last: {plant.last_pruned ? formatDate(plant.last_pruned) : 'Never'}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onEditDate({ plantId: plant.id, field: 'last_pruned', label: 'Last Pruned', currentDate: plant.last_pruned }) }}
                    className="p-0.5 hover:bg-gray-700 rounded"
                  >
                    <Pencil className="w-3 h-3 text-gray-500 hover:text-amber-400" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Production & Harvest */}
          <div className="bg-gray-900/50 rounded-lg p-3">
            <h4 className="text-sm font-medium text-gray-400 mb-3">Production & Harvest</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <EditableField label="Produces Months" value={editData.produces_months} field="produces_months" onChange={handleFieldChange} placeholder="e.g., Jun-Aug" />
              <EditableField label="Harvest Frequency" value={editData.harvest_frequency} field="harvest_frequency" onChange={handleFieldChange} placeholder="e.g., Weekly" />
              <EditableField label="How to Harvest" value={editData.how_to_harvest} field="how_to_harvest" type="textarea" onChange={handleFieldChange} />
            </div>
          </div>

          {/* Uses & Propagation */}
          <div className="grid grid-cols-2 gap-3">
            <EditableField label="Uses" value={editData.uses} field="uses" type="textarea" onChange={handleFieldChange} placeholder="e.g., Fresh eating, jams" />
            <EditableField label="Propagation Methods" value={editData.propagation_methods} field="propagation_methods" type="textarea" onChange={handleFieldChange} placeholder="e.g., Cuttings, grafting" />
          </div>

          {/* Warnings */}
          <div className="bg-red-900/20 border border-red-900/30 rounded-lg p-3">
            <h4 className="text-sm font-medium text-red-400 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Warnings & Considerations
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <EditableField label="Known Hazards" value={editData.known_hazards} field="known_hazards" type="textarea" onChange={handleFieldChange} placeholder="e.g., Thorns, toxic to pets" />
              <EditableField label="Special Considerations" value={editData.special_considerations} field="special_considerations" type="textarea" onChange={handleFieldChange} placeholder="e.g., Needs hand pollination" />
            </div>
          </div>

          {/* Notes */}
          <EditableField label="Notes" value={editData.notes} field="notes" type="textarea" onChange={handleFieldChange} />

          {/* Tags */}
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-2">Tags</h4>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`px-3 py-1 rounded-full text-sm border transition-all ${
                    editData.tag_ids.includes(tag.id)
                      ? getTagColor(tag.color) + ' border-2 border-white/30'
                      : 'bg-gray-700 text-gray-400 border-gray-600 hover:border-gray-500'
                  }`}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          {/* Care Actions & Save */}
          <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-700">
            <button
              onClick={(e) => { e.stopPropagation(); onLogCare(plant.id, 'watered') }}
              className="flex items-center gap-1 px-3 py-2 bg-blue-900/50 hover:bg-blue-800/50 rounded-lg text-sm transition-colors"
            >
              <Droplets className="w-4 h-4" />
              Water
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onLogCare(plant.id, 'fertilized') }}
              className="flex items-center gap-1 px-3 py-2 bg-green-900/50 hover:bg-green-800/50 rounded-lg text-sm transition-colors"
            >
              <Leaf className="w-4 h-4" />
              Fertilize
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onLogCare(plant.id, 'pruned') }}
              className="flex items-center gap-1 px-3 py-2 bg-amber-900/50 hover:bg-amber-800/50 rounded-lg text-sm transition-colors"
            >
              <Scissors className="w-4 h-4" />
              Prune
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onLogCare(plant.id, 'harvested') }}
              className="flex items-center gap-1 px-3 py-2 bg-purple-900/50 hover:bg-purple-800/50 rounded-lg text-sm transition-colors"
            >
              <Apple className="w-4 h-4" />
              Harvest
            </button>
            <div className="flex-1" />
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-farm-green hover:bg-farm-green-light rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


// Plant Form Modal Component (for adding new plants only)
function PlantFormModal({ tags, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    latin_name: '',
    variety: '',
    description: '',
    location: '',
    source: '',
    grow_zones: '',
    sun_requirement: 'full_sun',
    soil_requirements: '',
    plant_spacing: '',
    size_full_grown: '',
    growth_rate: 'moderate',
    min_temp: '',
    frost_sensitive: false,
    needs_cover_below_temp: '',
    heat_tolerant: true,
    drought_tolerant: false,
    salt_tolerant: false,
    needs_shade_above_temp: '',
    water_schedule: '',
    fertilize_schedule: '',
    prune_frequency: '',
    prune_months: '',
    produces_months: '',
    harvest_frequency: '',
    how_to_harvest: '',
    uses: '',
    propagation_methods: '',
    known_hazards: '',
    special_considerations: '',
    notes: '',
    tag_ids: [],
  })

  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const data = {
        ...formData,
        min_temp: formData.min_temp ? parseFloat(formData.min_temp) : null,
        needs_cover_below_temp: formData.needs_cover_below_temp ? parseFloat(formData.needs_cover_below_temp) : null,
        needs_shade_above_temp: formData.needs_shade_above_temp ? parseFloat(formData.needs_shade_above_temp) : null,
      }
      await createPlant(data)
      onSave()
    } catch (error) {
      console.error('Failed to save plant:', error)
    } finally {
      setSaving(false)
    }
  }

  const toggleTag = (tagId) => {
    setFormData(prev => ({
      ...prev,
      tag_ids: prev.tag_ids.includes(tagId)
        ? prev.tag_ids.filter(id => id !== tagId)
        : [...prev.tag_ids, tagId]
    }))
  }

  const getTagColor = (color) => {
    const colors = {
      green: 'bg-green-900/50 text-green-300 border-green-700',
      purple: 'bg-purple-900/50 text-purple-300 border-purple-700',
      cyan: 'bg-cyan-900/50 text-cyan-300 border-cyan-700',
      gray: 'bg-gray-700 text-gray-300 border-gray-600',
    }
    return colors[color] || colors.gray
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-800 p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Add New Plant</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Latin Name</label>
                <input
                  type="text"
                  value={formData.latin_name}
                  onChange={(e) => setFormData({ ...formData, latin_name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Variety</label>
                <input
                  type="text"
                  value={formData.variety}
                  onChange={(e) => setFormData({ ...formData, variety: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g., North orchard"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
            </div>
          </div>

          {/* Tags */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                    formData.tag_ids.includes(tag.id)
                      ? getTagColor(tag.color) + ' border-2'
                      : 'bg-gray-700 text-gray-400 border-gray-600 hover:border-gray-500'
                  }`}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          {/* Temperature */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Temperature Tolerance</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Min Temp (°F)</label>
                <input
                  type="number"
                  value={formData.min_temp}
                  onChange={(e) => setFormData({ ...formData, min_temp: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.frost_sensitive}
                  onChange={(e) => setFormData({ ...formData, frost_sensitive: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm">Frost Sensitive</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.heat_tolerant}
                  onChange={(e) => setFormData({ ...formData, heat_tolerant: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm">Heat Tolerant</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.drought_tolerant}
                  onChange={(e) => setFormData({ ...formData, drought_tolerant: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm">Drought Tolerant</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add Plant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


// Edit Date Modal Component
function EditDateModal({ label, currentDate, onClose, onSave }) {
  const [dateValue, setDateValue] = useState(() => {
    if (currentDate) {
      const d = new Date(currentDate)
      return d.toISOString().split('T')[0]
    }
    return new Date().toISOString().split('T')[0]
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const datetime = new Date(dateValue + 'T12:00:00').toISOString()
      await onSave(datetime)
    } finally {
      setSaving(false)
    }
  }

  const setToToday = () => {
    setDateValue(new Date().toISOString().split('T')[0])
  }

  const clearDate = async () => {
    setSaving(true)
    try {
      await onSave(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit {label}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Date</label>
            <input
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={setToToday}
              className="px-3 py-1.5 bg-cyan-900/50 hover:bg-cyan-800/50 rounded text-sm text-cyan-300 transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={clearDate}
              disabled={saving}
              className="px-3 py-1.5 bg-red-900/50 hover:bg-red-800/50 rounded text-sm text-red-300 transition-colors disabled:opacity-50"
            >
              Clear
            </button>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Plants
