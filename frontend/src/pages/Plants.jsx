import React, { useState, useEffect } from 'react'
import {
  Plus, Search, Leaf, Droplets, Sun, Snowflake, ChevronDown, ChevronUp,
  Thermometer, MapPin, Calendar, Clock, Scissors, Apple, AlertTriangle,
  Info, X, Tag as TagIcon, Pencil, Save, Package, Copy, CalendarPlus,
  CloudRain, Sprout
} from 'lucide-react'
import {
  getPlants, createPlant, updatePlant, deletePlant, addPlantCareLog, getPlantTags, createPlantTag,
  recordPlantHarvest, searchPlantImport, previewPlantImport, importPlant, getFarmAreas, getWaterOverview,
  uploadPlantPhoto, deletePlantPhoto, getPlantPhotoUrl, createSale
} from '../services/api'
import { Download, ExternalLink, Loader2, Camera, Trash2, Upload, Clipboard, DollarSign } from 'lucide-react'
import EventModal from '../components/EventModal'
import MottoDisplay from '../components/MottoDisplay'

// Inline editable field component
function EditableField({ label, value, field, type = 'text', options, onChange, placeholder, rows = 3, editing = true, displayValue }) {
  const inputClass = "w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
  const readOnlyClass = "text-sm text-gray-300"

  // Read-only mode
  if (!editing) {
    if (type === 'checkbox') {
      return (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-300">{label}:</span>
          <span className={value ? "text-green-400" : "text-red-400"}>{value ? "Yes" : "No"}</span>
        </div>
      )
    }

    if (type === 'select' && options) {
      const selectedOption = options.find(opt => opt.value === value)
      const display = displayValue || selectedOption?.label || value || '-'
      return (
        <div>
          <label className="block text-xs text-gray-500 mb-1">{label}</label>
          <div className={readOnlyClass}>{display}</div>
        </div>
      )
    }

    if (type === 'textarea' && value) {
      return (
        <div>
          <label className="block text-xs text-gray-500 mb-1">{label}</label>
          <div className="text-sm text-gray-300 whitespace-pre-wrap max-h-[200px] overflow-y-auto bg-gray-750 rounded p-2">
            {value}
          </div>
        </div>
      )
    }

    // Simple text display
    if (!value && !displayValue) return null
    return (
      <div>
        <label className="block text-xs text-gray-500 mb-1">{label}</label>
        <div className={readOnlyClass}>{displayValue || value}</div>
      </div>
    )
  }

  // Edit mode
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
    // Calculate dynamic rows based on content length
    const contentRows = value ? Math.max(rows, Math.min(12, Math.ceil(value.length / 80))) : rows
    return (
      <div>
        <label className="block text-xs text-gray-500 mb-1">{label}</label>
        <textarea
          value={value || ''}
          onChange={(e) => onChange(field, e.target.value)}
          placeholder={placeholder}
          rows={contentRows}
          className={`${inputClass} resize-y min-h-[60px] max-h-[300px]`}
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

// Scrollable text display for read-only long text
function ScrollableText({ label, value, maxHeight = "150px" }) {
  if (!value) return null
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <div
        className="bg-gray-900/50 rounded p-2 text-sm text-gray-300 whitespace-pre-wrap overflow-y-auto"
        style={{ maxHeight }}
      >
        {value}
      </div>
    </div>
  )
}

// Location select component with farm areas dropdown + custom option + sub-location
function LocationSelect({ value, subValue, onChange, onSubChange, farmAreas, editing = true, label = "Location" }) {
  const [isCustom, setIsCustom] = useState(false)
  const [customValue, setCustomValue] = useState('')

  // Check if current value matches a farm area
  const matchingArea = farmAreas.find(a => a.name === value)
  const showCustomInput = isCustom || (value && !matchingArea)

  useEffect(() => {
    // If value doesn't match any farm area, it's a custom value
    if (value && !farmAreas.find(a => a.name === value)) {
      setIsCustom(true)
      setCustomValue(value)
    }
  }, [value, farmAreas])

  const handleSelectChange = (e) => {
    const selected = e.target.value
    if (selected === '__custom__') {
      setIsCustom(true)
      setCustomValue('')
    } else {
      setIsCustom(false)
      setCustomValue('')
      onChange(selected)
    }
  }

  const handleCustomChange = (e) => {
    const newValue = e.target.value
    setCustomValue(newValue)
    onChange(newValue)
  }

  if (!editing) {
    const displayLocation = [value, subValue].filter(Boolean).join(' > ')
    return (
      <div>
        <label className="block text-xs text-gray-500 mb-1">{label}</label>
        <div className="text-sm text-gray-300">{displayLocation || '-'}</div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div>
        <label className="block text-xs text-gray-500 mb-1">{label}</label>
        {showCustomInput ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={customValue}
              onChange={handleCustomChange}
              placeholder="Enter custom location"
              className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
            />
            <button
              type="button"
              onClick={() => { setIsCustom(false); setCustomValue(''); onChange('') }}
              className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 rounded"
              title="Use dropdown"
            >
              ↓
            </button>
          </div>
        ) : (
          <select
            value={value || ''}
            onChange={handleSelectChange}
            className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
          >
            <option value="">No location</option>
            {farmAreas.map(area => (
              <option key={area.id} value={area.name}>
                {area.is_sub_location ? `↳ ${area.name}` : area.name}
              </option>
            ))}
            <option value="__custom__">+ Custom location...</option>
          </select>
        )}
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Sub-location</label>
        <input
          type="text"
          value={subValue || ''}
          onChange={(e) => onSubChange(e.target.value)}
          placeholder="e.g., Row 3, Bed A, 3rd paddock"
          className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      </div>
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

const MOISTURE_OPTIONS = [
  { value: '', label: 'Not Set' },
  { value: 'dry', label: 'Drought Tolerant' },
  { value: 'dry_moist', label: 'Low Water' },
  { value: 'moist', label: 'Average' },
  { value: 'moist_wet', label: 'High Water' },
  { value: 'wet', label: 'Bog/Aquatic' },
]

const GROWTH_STAGES = [
  { value: 'seed', label: 'Seed', color: 'bg-blue-600', icon: '🌰' },
  { value: 'seedling', label: 'Seedling', color: 'bg-emerald-600', icon: '🌱' },
  { value: 'transplanted', label: 'Transplanted', color: 'bg-yellow-600', icon: '🪴' },
  { value: 'vegetative', label: 'Vegetative', color: 'bg-green-600', icon: '🌿' },
  { value: 'flowering', label: 'Flowering', color: 'bg-pink-600', icon: '🌸' },
  { value: 'fruiting', label: 'Fruiting', color: 'bg-orange-600', icon: '🍅' },
  { value: 'harvesting', label: 'Harvesting', color: 'bg-red-600', icon: '🧺' },
  { value: 'dormant', label: 'Dormant', color: 'bg-gray-600', icon: '💤' },
]

function Plants() {
  const [plants, setPlants] = useState([])
  const [tags, setTags] = useState([])
  const [farmAreas, setFarmAreas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [duplicatePlant, setDuplicatePlant] = useState(null) // plant to duplicate
  const [expandedPlant, setExpandedPlant] = useState(null)
  const [search, setSearch] = useState('')
  const [filterTag, setFilterTag] = useState('all')
  const [filterSpecial, setFilterSpecial] = useState('all')
  const [groupByLocation, setGroupByLocation] = useState(true)
  const [collapsedLocations, setCollapsedLocations] = useState({})
  const [editDateModal, setEditDateModal] = useState(null)
  const [showHarvestForm, setShowHarvestForm] = useState(null) // plant object or null
  const [showSellForm, setShowSellForm] = useState(null) // plant object or null
  const [showImportModal, setShowImportModal] = useState(false)
  const [showReminderFor, setShowReminderFor] = useState(null) // plant object for reminder modal
  const [waterOverview, setWaterOverview] = useState(null)
  const [showWaterOverview, setShowWaterOverview] = useState(false)
  const [waterOverviewDays, setWaterOverviewDays] = useState(7)

  const fetchWaterOverview = async (days = waterOverviewDays) => {
    try {
      const res = await getWaterOverview(days)
      setWaterOverview(res.data)
    } catch (error) {
      console.error('Failed to fetch water overview:', error)
    }
  }

  const fetchData = async () => {
    try {
      const [plantsRes, tagsRes, areasRes] = await Promise.all([
        getPlants(),
        getPlantTags(),
        getFarmAreas()
      ])
      setPlants(plantsRes.data || [])
      setTags(tagsRes.data || [])
      setFarmAreas(areasRes.data || [])
    } catch (error) {
      console.error('Failed to fetch plants:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    fetchWaterOverview()
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
    if (filterSpecial === 'needs_water') matchesSpecial = plant.next_watering && new Date(plant.next_watering) <= new Date() && !plant.sprinkler_enabled
    if (filterSpecial === 'needs_fertilizer') matchesSpecial = plant.next_fertilizing && new Date(plant.next_fertilizing) <= new Date()

    return matchesSearch && matchesTag && matchesSpecial
  })

  // Group plants by location
  const plantsByLocation = filteredPlants.reduce((acc, plant) => {
    const location = plant.location || 'No Location'
    if (!acc[location]) acc[location] = []
    acc[location].push(plant)
    return acc
  }, {})

  // Sort locations alphabetically, but put "No Location" at the end
  const sortedLocations = Object.keys(plantsByLocation).sort((a, b) => {
    if (a === 'No Location') return 1
    if (b === 'No Location') return -1
    return a.localeCompare(b)
  })

  const toggleLocationCollapse = (location) => {
    setCollapsedLocations(prev => ({
      ...prev,
      [location]: !prev[location]
    }))
  }

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

  const handleDelete = async (plantId, plantName) => {
    if (!confirm(`Are you sure you want to remove ${plantName}? This action cannot be undone.`)) return
    try {
      await deletePlant(plantId)
      setExpandedPlant(null)
      fetchData()
    } catch (error) {
      console.error('Failed to delete plant:', error)
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

  const handleHarvest = async (data) => {
    try {
      await recordPlantHarvest(data)
      setShowHarvestForm(null)
      fetchData()
    } catch (error) {
      console.error('Failed to record harvest:', error)
      alert('Failed to record harvest')
    }
  }

  const handleSellPlant = async (data) => {
    try {
      await createSale(data)
      setShowSellForm(null)
      fetchData()
    } catch (error) {
      console.error('Failed to record sale:', error)
      alert('Failed to record sale')
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
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
    needsWater: plants.filter(p => p.next_watering && new Date(p.next_watering) <= new Date() && !p.sprinkler_enabled).length,
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
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2 flex-shrink-0">
          <Leaf className="w-7 h-7 text-green-500" />
          Plants & Trees
        </h1>
        <MottoDisplay />
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <Download className="w-5 h-5" />
            Import
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Plant
          </button>
        </div>
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

      {/* Water Overview */}
      <div className="bg-gray-800 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowWaterOverview(!showWaterOverview)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-750 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-cyan-400" />
            <span className="font-semibold">Water Overview</span>
            {waterOverview && (
              <span className="text-sm text-gray-400">
                — {waterOverview.rain?.total_inches || 0}" rain, {waterOverview.watering_activity?.total_watered || 0} watered, {waterOverview.plant_status?.needs_water_now || 0} need water
              </span>
            )}
          </div>
          {showWaterOverview ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>

        {showWaterOverview && waterOverview && (
          <div className="px-4 pb-4 space-y-4 border-t border-gray-700">
            {/* Period selector */}
            <div className="flex items-center gap-2 pt-3">
              <span className="text-xs text-gray-500">Period:</span>
              {[7, 14, 30].map(d => (
                <button
                  key={d}
                  onClick={() => { setWaterOverviewDays(d); fetchWaterOverview(d) }}
                  className={`px-2 py-1 rounded text-xs ${
                    waterOverviewDays === d ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>

            {/* Top summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-cyan-400">{waterOverview.rain?.total_inches || 0}"</div>
                <div className="text-xs text-gray-400">Total Rain</div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold flex items-center justify-center gap-1">
                  <span className="text-cyan-400">{waterOverview.rain?.rain_days || 0}</span>
                  <span className="text-gray-500 text-sm">rain</span>
                  <span className="text-gray-600 mx-0.5">/</span>
                  <span className="text-amber-400">{waterOverview.rain?.dry_days || 0}</span>
                  <span className="text-gray-500 text-sm">dry</span>
                </div>
                <div className="text-xs text-gray-400">Days ({waterOverviewDays}d period)</div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-green-400">{waterOverview.watering_activity?.total_watered || 0}</div>
                <div className="text-xs text-gray-400">Plants Watered</div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-yellow-400">{waterOverview.watering_activity?.total_skipped || 0}</div>
                <div className="text-xs text-gray-400">Waterings Skipped</div>
              </div>
            </div>

            {/* Current Rain & Soil Moisture */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Current Rain */}
              <div className="bg-gray-700/30 rounded-lg p-3">
                <div className="text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1">
                  <CloudRain className="w-3.5 h-3.5" /> CURRENT RAIN
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500">Rate:</span> <span className="text-gray-300">{waterOverview.rain?.current?.rain_rate || 0} in/hr</span></div>
                  <div><span className="text-gray-500">Today:</span> <span className="text-gray-300">{waterOverview.rain?.current?.rain_daily || 0}"</span></div>
                  <div><span className="text-gray-500">Week:</span> <span className="text-gray-300">{waterOverview.rain?.current?.rain_weekly || 0}"</span></div>
                  <div><span className="text-gray-500">Month:</span> <span className="text-gray-300">{waterOverview.rain?.current?.rain_monthly || 0}"</span></div>
                </div>
              </div>

              {/* Soil Moisture */}
              <div className="bg-gray-700/30 rounded-lg p-3">
                <div className="text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1">
                  <Sprout className="w-3.5 h-3.5" /> SOIL MOISTURE
                </div>
                {waterOverview.soil_moisture ? (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {waterOverview.soil_moisture.map(s => (
                      <div key={s.sensor}>
                        <span className="text-gray-500">Sensor {s.sensor}:</span>{' '}
                        <span className={s.moisture_pct > 50 ? 'text-cyan-400' : s.moisture_pct > 25 ? 'text-green-400' : 'text-yellow-400'}>
                          {s.moisture_pct}%
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">No soil sensors detected</div>
                )}
              </div>
            </div>

            {/* Smart Watering Tracking */}
            <div className="bg-gray-700/30 rounded-lg p-3">
              <div className="text-xs font-semibold text-gray-300 mb-2">SMART WATERING TRACKING</div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Rain-tracked:</span>{' '}
                  <span className="text-cyan-400">{waterOverview.plant_status?.rain_tracked || 0} plants</span>
                </div>
                <div>
                  <span className="text-gray-500">Sprinkler:</span>{' '}
                  <span className="text-blue-400">{waterOverview.plant_status?.sprinkler_tracked || 0} plants</span>
                </div>
                <div>
                  <span className="text-gray-500">With schedule:</span>{' '}
                  <span className="text-green-400">{waterOverview.plant_status?.with_schedule || 0} plants</span>
                </div>
              </div>
              {/* Skip reasons */}
              {waterOverview.watering_activity?.skip_reasons && Object.keys(waterOverview.watering_activity.skip_reasons).length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-600">
                  <div className="text-xs text-gray-500 mb-1">Skip reasons:</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(waterOverview.watering_activity.skip_reasons).map(([reason, count]) => (
                      <span key={reason} className="text-xs bg-gray-800 rounded px-2 py-0.5 text-gray-400">
                        {reason}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Daily Rain Chart (simple bar representation) */}
            {waterOverview.rain?.by_day && waterOverview.rain.by_day.length > 0 && (
              <div className="bg-gray-700/30 rounded-lg p-3">
                <div className="text-xs font-semibold text-gray-300 mb-2">DAILY RAIN ({waterOverviewDays}d)</div>
                <div className="flex items-end gap-1 h-16">
                  {waterOverview.rain.by_day.slice().reverse().map((day, i) => {
                    const maxRain = Math.max(...waterOverview.rain.by_day.map(d => d.rain_inches), 0.1)
                    const height = Math.max(2, (day.rain_inches / maxRain) * 100)
                    return (
                      <div
                        key={i}
                        className="flex-1 bg-cyan-500 rounded-t opacity-80 hover:opacity-100 transition-opacity relative group"
                        style={{ height: `${height}%` }}
                        title={`${formatDate(day.date)}: ${day.rain_inches}"`}
                      >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-900 text-xs text-gray-300 px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                          {formatDate(day.date)}: {day.rain_inches}"
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Needs Water List */}
            {waterOverview.plant_status?.needs_water_list?.length > 0 && (
              <div className="bg-gray-700/30 rounded-lg p-3">
                <div className="text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                  NEEDS WATER NOW ({waterOverview.plant_status.needs_water_now})
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {waterOverview.plant_status.needs_water_list.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-sm bg-gray-800 rounded px-2 py-1">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-300">{p.name}</span>
                        {p.location && <span className="text-xs text-gray-500">{p.location}</span>}
                      </div>
                      <span className={`text-xs ${p.days_overdue > 3 ? 'text-red-400' : 'text-yellow-400'}`}>
                        {p.days_overdue}d overdue
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-0">
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
        <button
          onClick={() => setGroupByLocation(!groupByLocation)}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            groupByLocation
              ? 'bg-farm-green text-white'
              : 'bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <MapPin className="w-4 h-4" />
          Group by Location
        </button>
      </div>

      {/* Plant List */}
      {filteredPlants.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Leaf className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No plants found. Add your first plant!</p>
        </div>
      ) : groupByLocation ? (
        // Grouped by location view
        <div className="space-y-4">
          {sortedLocations.map((location) => (
            <div key={location} className="bg-gray-800/50 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleLocationCollapse(location)}
                className="w-full px-4 py-3 flex items-center justify-between bg-gray-800 hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-farm-green" />
                  <span className="font-medium">{location}</span>
                  <span className="text-sm text-gray-400">({plantsByLocation[location].length} plants)</span>
                </div>
                {collapsedLocations[location] ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                )}
              </button>
              {!collapsedLocations[location] && (
                <div className="p-2 space-y-1">
                  {plantsByLocation[location].map((plant) => (
                    <PlantCard
                      key={plant.id}
                      plant={plant}
                      tags={tags}
                      farmAreas={farmAreas}
                      expanded={expandedPlant === plant.id}
                      onToggle={() => setExpandedPlant(expandedPlant === plant.id ? null : plant.id)}
                      onLogCare={logCare}
                      onEditDate={setEditDateModal}
                      onDelete={() => handleDelete(plant.id, plant.name)}
                      onSave={fetchData}
                      onHarvest={(plant) => setShowHarvestForm(plant)}
                      onSellPlant={(plant) => setShowSellForm(plant)}
                      onImport={(plant) => setShowImportModal(plant)}
                      onDuplicate={(plant) => setDuplicatePlant(plant)}
                      onAddReminder={(plant) => setShowReminderFor(plant)}
                      getTagColor={getTagColor}
                      formatDate={formatDate}
                      formatRelativeDate={formatRelativeDate}
                      getSunLabel={getSunLabel}
                      getGrowthRateLabel={getGrowthRateLabel}
                      onRefresh={fetchData}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        // Flat list view
        <div className="space-y-1">
          {filteredPlants.map((plant) => (
            <PlantCard
              key={plant.id}
              plant={plant}
              tags={tags}
              farmAreas={farmAreas}
              expanded={expandedPlant === plant.id}
              onToggle={() => setExpandedPlant(expandedPlant === plant.id ? null : plant.id)}
              onLogCare={logCare}
              onEditDate={setEditDateModal}
              onDelete={() => handleDelete(plant.id, plant.name)}
              onSave={fetchData}
              onHarvest={(plant) => setShowHarvestForm(plant)}
              onSellPlant={(plant) => setShowSellForm(plant)}
              onImport={(plant) => setShowImportModal(plant)}
              onDuplicate={(plant) => setDuplicatePlant(plant)}
              onAddReminder={(plant) => setShowReminderFor(plant)}
              getTagColor={getTagColor}
              formatDate={formatDate}
              formatRelativeDate={formatRelativeDate}
              getSunLabel={getSunLabel}
              getGrowthRateLabel={getGrowthRateLabel}
              onRefresh={fetchData}
            />
          ))}
        </div>
      )}

      {/* Add Plant Modal (for new plants) */}
      {showForm && (
        <PlantFormModal
          tags={tags}
          farmAreas={farmAreas}
          onClose={() => setShowForm(false)}
          onSave={() => { setShowForm(false); fetchData() }}
        />
      )}

      {/* Duplicate Plant Modal */}
      {duplicatePlant && (
        <PlantFormModal
          tags={tags}
          farmAreas={farmAreas}
          initialData={duplicatePlant}
          onClose={() => setDuplicatePlant(null)}
          onSave={() => { setDuplicatePlant(null); fetchData() }}
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

      {/* Harvest Modal */}
      {showHarvestForm && (
        <HarvestFormModal
          plant={showHarvestForm}
          onClose={() => setShowHarvestForm(null)}
          onSave={handleHarvest}
        />
      )}

      {/* Sell Plant Modal */}
      {showSellForm && (
        <SellPlantModal
          plant={showSellForm}
          onClose={() => setShowSellForm(null)}
          onSave={handleSellPlant}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => { setShowImportModal(false); fetchData() }}
          tags={tags}
          farmAreas={farmAreas}
          existingPlant={typeof showImportModal === 'object' ? showImportModal : null}
        />
      )}

      {/* Add Reminder Modal */}
      {showReminderFor && (
        <EventModal
          preselectedEntity={{ type: 'plant', id: showReminderFor.id, name: showReminderFor.name }}
          onClose={() => setShowReminderFor(null)}
          onSaved={() => setShowReminderFor(null)}
        />
      )}
    </div>
  )
}


// Plant Card Component with inline editing
function PlantCard({
  plant, tags, farmAreas, expanded, onToggle, onLogCare, onEditDate, onDelete, onSave, onHarvest, onSellPlant, onImport, onDuplicate, onAddReminder,
  getTagColor, formatDate, formatRelativeDate, getSunLabel, getGrowthRateLabel, onRefresh
}) {
  const [editData, setEditData] = useState(null)
  const [saving, setSaving] = useState(false)
  const [lastPlantUpdate, setLastPlantUpdate] = useState(plant.updated_at)
  const [isEditing, setIsEditing] = useState(false)

  // Reset editData and exit edit mode when plant data is updated (e.g., after import)
  useEffect(() => {
    if (plant.updated_at !== lastPlantUpdate) {
      setLastPlantUpdate(plant.updated_at)
      setEditData(null) // Force re-initialization
      setIsEditing(false)
    }
  }, [plant.updated_at, lastPlantUpdate])

  // Exit edit mode when card is collapsed
  useEffect(() => {
    if (!expanded) {
      setIsEditing(false)
    }
  }, [expanded])

  // Initialize edit data when expanded
  useEffect(() => {
    if (expanded && !editData) {
      setEditData({
        name: plant.name || '',
        latin_name: plant.latin_name || '',
        variety: plant.variety || '',
        description: plant.description || '',
        location: plant.location || '',
        sub_location: plant.sub_location || '',
        source: plant.source || '',
        grow_zones: plant.grow_zones || '',
        plant_zone: plant.plant_zone || '',
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
        moisture_preference: plant.moisture_preference || '',
        water_schedule: plant.water_schedule || '',
        receives_rain: plant.receives_rain || false,
        rain_threshold_inches: plant.rain_threshold_inches || 0.25,
        sprinkler_enabled: plant.sprinkler_enabled || false,
        sprinkler_schedule: plant.sprinkler_schedule || '',
        fertilize_schedule: plant.fertilize_schedule || '',
        prune_frequency: plant.prune_frequency || '',
        prune_months: plant.prune_months || '',
        produces_months: plant.produces_months || '',
        harvest_frequency: plant.harvest_frequency || '',
        how_to_harvest: plant.how_to_harvest || '',
        uses: plant.uses || '',
        propagation_methods: plant.propagation_methods || '',
        cultivation_details: plant.cultivation_details || '',
        known_hazards: plant.known_hazards || '',
        special_considerations: plant.special_considerations || '',
        notes: plant.notes || '',
        references: plant.references || '',
        tag_ids: plant.tags?.map(t => t.id) || [],
        growth_stage: plant.growth_stage || '',
        seed_id: plant.seed_id || null,
        date_sown: plant.date_sown || '',
        date_germinated: plant.date_germinated || '',
        date_transplanted: plant.date_transplanted || '',
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
      // Convert empty strings to null for optional fields
      const cleanData = {}
      for (const [key, value] of Object.entries(editData)) {
        cleanData[key] = value === '' ? null : value
      }
      const data = {
        ...cleanData,
        min_temp: cleanData.min_temp ? parseFloat(cleanData.min_temp) : null,
        needs_cover_below_temp: cleanData.needs_cover_below_temp ? parseFloat(cleanData.needs_cover_below_temp) : null,
        needs_shade_above_temp: cleanData.needs_shade_above_temp ? parseFloat(cleanData.needs_shade_above_temp) : null,
      }
      await updatePlant(plant.id, data)
      setIsEditing(false)
      if (onSave) onSave()
    } catch (error) {
      console.error('Failed to save:', error)
      alert('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleAdvanceStage = async (newStage) => {
    try {
      const stageData = { growth_stage: newStage }
      // Set lifecycle dates based on stage transition
      const now = new Date().toISOString()
      if (newStage === 'seed' && !plant.date_sown) stageData.date_sown = now
      if (newStage === 'seedling' && !plant.date_germinated) stageData.date_germinated = now
      if (newStage === 'transplanted' && !plant.date_transplanted) stageData.date_transplanted = now
      await updatePlant(plant.id, stageData)
      setEditData(prev => ({ ...prev, growth_stage: newStage }))
      if (onSave) onSave()
    } catch (error) {
      console.error('Failed to update stage:', error)
    }
  }

  const handleCancel = () => {
    // Reset editData to original plant values
    setEditData({
      name: plant.name || '',
      latin_name: plant.latin_name || '',
      variety: plant.variety || '',
      description: plant.description || '',
      location: plant.location || '',
      sub_location: plant.sub_location || '',
      source: plant.source || '',
      grow_zones: plant.grow_zones || '',
      plant_zone: plant.plant_zone || '',
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
      moisture_preference: plant.moisture_preference || '',
      water_schedule: plant.water_schedule || '',
      fertilize_schedule: plant.fertilize_schedule || '',
      prune_frequency: plant.prune_frequency || '',
      prune_months: plant.prune_months || '',
      produces_months: plant.produces_months || '',
      harvest_frequency: plant.harvest_frequency || '',
      how_to_harvest: plant.how_to_harvest || '',
      uses: plant.uses || '',
      propagation_methods: plant.propagation_methods || '',
      cultivation_details: plant.cultivation_details || '',
      known_hazards: plant.known_hazards || '',
      special_considerations: plant.special_considerations || '',
      notes: plant.notes || '',
      references: plant.references || '',
      tag_ids: plant.tags?.map(t => t.id) || [],
      growth_stage: plant.growth_stage || '',
      seed_id: plant.seed_id || null,
      date_sown: plant.date_sown || '',
      date_germinated: plant.date_germinated || '',
      date_transplanted: plant.date_transplanted || '',
    })
    setIsEditing(false)
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
            {plant.photo_path ? (
              <img
                src={getPlantPhotoUrl(plant.photo_path)}
                alt={plant.name}
                className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0">
                <Leaf className="w-5 h-5 text-gray-500" />
              </div>
            )}
            <h3 className="font-semibold text-lg">{plant.name}</h3>
            {plant.growth_stage && (
              <span className={`text-xs px-2 py-0.5 rounded-full text-white ${
                { seed: 'bg-blue-600', seedling: 'bg-emerald-600', transplanted: 'bg-yellow-600', vegetative: 'bg-green-600', flowering: 'bg-pink-600', fruiting: 'bg-orange-600', harvesting: 'bg-red-600', dormant: 'bg-gray-600' }[plant.growth_stage] || 'bg-gray-600'
              }`}>
                {plant.growth_stage}
              </span>
            )}
            {plant.seed_name && (
              <span className="text-xs text-gray-500">from: {plant.seed_name}</span>
            )}
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
            {plant.location && (
              <span className="text-cyan-400 text-sm whitespace-nowrap flex items-center gap-1">
                <MapPin className="w-3 h-3" />{plant.location}
              </span>
            )}
            {plant.age_years && (
              <span className="text-green-400 text-sm whitespace-nowrap">{plant.age_years} yrs old</span>
            )}
            {plant.min_temp && (
              <span className="text-blue-400 text-sm whitespace-nowrap">Min: {plant.min_temp}°F</span>
            )}
          </div>
          {plant.description && (
            <p className="text-sm text-gray-400 mt-1 line-clamp-2">{plant.description}</p>
          )}
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
            {plant.next_watering && new Date(plant.next_watering) <= new Date() && !plant.sprinkler_enabled && (
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
          {/* Action Buttons - Edit/Save/Cancel, Quick actions, Delete */}
          <div className="flex gap-2 flex-wrap">
            {isEditing ? (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); handleSave() }}
                  disabled={saving}
                  className="px-3 py-1.5 bg-farm-green hover:bg-farm-green-light rounded text-sm text-white transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  <Save className="w-3 h-3" /> {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleCancel() }}
                  className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-sm text-white transition-colors flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Cancel
                </button>
              </>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setIsEditing(true) }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm text-white transition-colors flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" /> Edit
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onLogCare(plant.id, 'watered') }}
              className="px-3 py-1.5 bg-cyan-900/50 hover:bg-cyan-800/50 rounded text-sm text-white transition-colors flex items-center gap-1"
            >
              <Droplets className="w-3 h-3" /> Water
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onLogCare(plant.id, 'fertilized') }}
              className="px-3 py-1.5 bg-green-900/50 hover:bg-green-800/50 rounded text-sm text-white transition-colors flex items-center gap-1"
            >
              <Leaf className="w-3 h-3" /> Fertilize
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onLogCare(plant.id, 'pruned') }}
              className="px-3 py-1.5 bg-amber-900/50 hover:bg-amber-800/50 rounded text-sm text-white transition-colors flex items-center gap-1"
            >
              <Scissors className="w-3 h-3" /> Prune
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onHarvest(plant) }}
              className="px-3 py-1.5 bg-purple-900/50 hover:bg-purple-800/50 rounded text-sm text-white transition-colors flex items-center gap-1"
            >
              <Apple className="w-3 h-3" /> Harvest
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onSellPlant(plant) }}
              className="px-3 py-1.5 bg-emerald-900/50 hover:bg-emerald-800/50 rounded text-sm text-white transition-colors flex items-center gap-1"
            >
              <DollarSign className="w-3 h-3" /> Sell
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onImport(plant) }}
              className="px-3 py-1.5 bg-blue-900/50 hover:bg-blue-800/50 rounded text-sm text-white transition-colors flex items-center gap-1"
            >
              <Download className="w-3 h-3" /> Import Data
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate(plant) }}
              className="px-3 py-1.5 bg-gray-600/50 hover:bg-gray-600 rounded text-sm text-white transition-colors flex items-center gap-1"
            >
              <Copy className="w-3 h-3" /> Duplicate
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onAddReminder(plant) }}
              className="px-3 py-1.5 bg-cyan-600/50 hover:bg-cyan-600 rounded text-sm text-white transition-colors flex items-center gap-1"
            >
              <CalendarPlus className="w-3 h-3" /> Add Reminder
            </button>
            {!isEditing && (
              <select
                value={editData?.growth_stage || plant.growth_stage || ''}
                onChange={(e) => { e.stopPropagation(); if (e.target.value) handleAdvanceStage(e.target.value) }}
                onClick={(e) => e.stopPropagation()}
                className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                title="Set growth stage"
              >
                <option value="">Stage...</option>
                {GROWTH_STAGES.map(s => (
                  <option key={s.value} value={s.value}>{s.icon} {s.label}</option>
                ))}
              </select>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="px-3 py-1.5 bg-red-600/50 hover:bg-red-600 rounded text-sm text-white transition-colors flex items-center gap-1 ml-auto"
            >
              <X className="w-3 h-3" /> Delete
            </button>
          </div>

          {/* Plant Photo */}
          {(plant.photo_path || isEditing) && (
            <div className="relative">
              {plant.photo_path ? (
                <div className="relative group">
                  <img
                    src={getPlantPhotoUrl(plant.photo_path)}
                    alt={plant.name}
                    className="w-full max-h-48 object-contain rounded-lg bg-gray-800"
                  />
                  {isEditing && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        try {
                          await deletePlantPhoto(plant.id)
                          onRefresh()
                        } catch (err) { console.error('Failed to delete photo:', err) }
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-red-600/80 hover:bg-red-600 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove photo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : isEditing && (
                <div className="flex gap-2">
                  <label className="flex-1 flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-green-500 transition-colors">
                    <Camera className="w-8 h-8 text-gray-500 mb-2" />
                    <span className="text-sm text-gray-500">Upload Photo</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files[0]
                        if (!file) return
                        const formData = new FormData()
                        formData.append('file', file)
                        try {
                          await uploadPlantPhoto(plant.id, formData)
                          onRefresh()
                        } catch (err) { console.error('Failed to upload photo:', err) }
                      }}
                    />
                  </label>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation()
                      try {
                        const clipboardItems = await navigator.clipboard.read()
                        for (const item of clipboardItems) {
                          for (const type of item.types) {
                            if (type.startsWith('image/')) {
                              const blob = await item.getType(type)
                              const ext = type.split('/')[1] || 'png'
                              const file = new File([blob], `pasted-image.${ext}`, { type })
                              const formData = new FormData()
                              formData.append('file', file)
                              await uploadPlantPhoto(plant.id, formData)
                              onRefresh()
                              return
                            }
                          }
                        }
                      } catch (err) { console.error('Failed to paste image:', err) }
                    }}
                    className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-gray-600 rounded-lg hover:border-blue-500 transition-colors"
                    title="Paste image from clipboard"
                  >
                    <Clipboard className="w-8 h-8 text-gray-500 mb-2" />
                    <span className="text-sm text-gray-500">Paste</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Basic Info - Editable */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <EditableField label="Name" value={editData.name} field="name" onChange={handleFieldChange} editing={isEditing} />
            <EditableField label="Latin Name" value={editData.latin_name} field="latin_name" onChange={handleFieldChange} placeholder="Genus species" editing={isEditing} />
            <EditableField label="Variety" value={editData.variety} field="variety" onChange={handleFieldChange} editing={isEditing} />
            <LocationSelect
              value={editData.location}
              subValue={editData.sub_location}
              onChange={(value) => handleFieldChange('location', value)}
              onSubChange={(value) => handleFieldChange('sub_location', value)}
              farmAreas={farmAreas}
              editing={isEditing}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <EditableField label="Description" value={editData.description} field="description" type="textarea" onChange={handleFieldChange} editing={isEditing} />
            <EditableField label="Source" value={editData.source} field="source" onChange={handleFieldChange} placeholder="Where purchased" editing={isEditing} />
          </div>

          {/* Lifecycle Progress */}
          {(plant.growth_stage || plant.seed_id) && (
            <div className="bg-gray-900/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-400">Growth Lifecycle</h4>
                {plant.seed_name && (
                  <span className="text-xs text-gray-500">Seed: {plant.seed_name}</span>
                )}
              </div>
              <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
                {GROWTH_STAGES.map((stage, idx) => {
                  const currentIdx = GROWTH_STAGES.findIndex(s => s.value === (editData.growth_stage || plant.growth_stage))
                  const isActive = stage.value === (editData.growth_stage || plant.growth_stage)
                  const isPast = currentIdx >= 0 && idx < currentIdx
                  const isFuture = currentIdx >= 0 && idx > currentIdx
                  return (
                    <div key={stage.value} className="flex items-center flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); if (!isEditing) handleAdvanceStage(stage.value) }}
                        disabled={isEditing}
                        className={`flex flex-col items-center px-2 py-1.5 rounded transition-all ${
                          isActive ? `${stage.color} text-white ring-2 ring-white/30` :
                          isPast ? 'bg-gray-700 text-gray-300' :
                          'bg-gray-800 text-gray-600'
                        } ${!isEditing ? 'hover:ring-1 hover:ring-gray-400 cursor-pointer' : 'cursor-default'}`}
                        title={isEditing ? 'Save or cancel edit first' : `Set stage: ${stage.label}`}
                      >
                        <span className="text-sm">{stage.icon}</span>
                        <span className="text-[10px] mt-0.5 whitespace-nowrap">{stage.label}</span>
                      </button>
                      {idx < GROWTH_STAGES.length - 1 && (
                        <div className={`w-3 h-0.5 ${isPast ? 'bg-gray-500' : 'bg-gray-800'}`} />
                      )}
                    </div>
                  )
                })}
              </div>
              {/* Lifecycle dates */}
              <div className="flex gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                {plant.date_sown && <span>Sown: {formatDate(plant.date_sown)}</span>}
                {plant.date_germinated && <span>Germinated: {formatDate(plant.date_germinated)}</span>}
                {plant.date_transplanted && <span>Transplanted: {formatDate(plant.date_transplanted)}</span>}
              </div>
            </div>
          )}

          {/* Growing Requirements */}
          <div className="bg-gray-900/50 rounded-lg p-3">
            <h4 className="text-sm font-medium text-gray-400 mb-3">Growing Requirements</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <EditableField label="Hardiness Zones (species)" value={editData.grow_zones} field="grow_zones" onChange={handleFieldChange} placeholder="e.g., 9-11" editing={isEditing} />
              <EditableField label="This Plant's Zone (override)" value={editData.plant_zone} field="plant_zone" type="select" options={[{value: '', label: 'Use global zone'}, ...['1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a','7b','8a','8b','9a','9b','10a','10b','11a','11b','12a','12b','13a','13b'].map(z => ({value: z, label: `Zone ${z}`}))]} onChange={handleFieldChange} editing={isEditing} />
              <EditableField label="Sun Requirement" value={editData.sun_requirement} field="sun_requirement" type="select" options={SUN_OPTIONS} onChange={handleFieldChange} editing={isEditing} />
              <EditableField label="Growth Rate" value={editData.growth_rate} field="growth_rate" type="select" options={GROWTH_RATE_OPTIONS} onChange={handleFieldChange} editing={isEditing} />
              <EditableField label="Soil Requirements" value={editData.soil_requirements} field="soil_requirements" onChange={handleFieldChange} placeholder="e.g., Well-drained" editing={isEditing} />
              <EditableField label="Plant Spacing" value={editData.plant_spacing} field="plant_spacing" onChange={handleFieldChange} placeholder="e.g., 15-20 feet" editing={isEditing} />
              <EditableField label="Size Full Grown" value={editData.size_full_grown} field="size_full_grown" onChange={handleFieldChange} placeholder="e.g., 20-30 ft" editing={isEditing} />
            </div>
          </div>

          {/* Temperature & Tolerance */}
          <div className="bg-gray-900/50 rounded-lg p-3">
            <h4 className="text-sm font-medium text-gray-400 mb-3">Temperature & Tolerance</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <EditableField label="Min Temp (°F)" value={editData.min_temp} field="min_temp" type="number" onChange={handleFieldChange} editing={isEditing} />
              <EditableField label="Cover Below (°F)" value={editData.needs_cover_below_temp} field="needs_cover_below_temp" type="number" onChange={handleFieldChange} editing={isEditing} />
              <EditableField label="Shade Above (°F)" value={editData.needs_shade_above_temp} field="needs_shade_above_temp" type="number" onChange={handleFieldChange} editing={isEditing} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <EditableField label="Frost Sensitive" value={editData.frost_sensitive} field="frost_sensitive" type="checkbox" onChange={handleFieldChange} editing={isEditing} />
              <EditableField label="Heat Tolerant" value={editData.heat_tolerant} field="heat_tolerant" type="checkbox" onChange={handleFieldChange} editing={isEditing} />
              <EditableField label="Drought Tolerant" value={editData.drought_tolerant} field="drought_tolerant" type="checkbox" onChange={handleFieldChange} editing={isEditing} />
              <EditableField label="Salt Tolerant" value={editData.salt_tolerant} field="salt_tolerant" type="checkbox" onChange={handleFieldChange} editing={isEditing} />
            </div>
          </div>

          {/* Care Schedule */}
          <div className="bg-gray-900/50 rounded-lg p-3">
            <h4 className="text-sm font-medium text-gray-400 mb-3">Care Schedule</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <EditableField
                  label="Moisture Preference"
                  value={editData.moisture_preference}
                  field="moisture_preference"
                  type="select"
                  options={[
                    { value: '', label: 'Not Set (defaults to Average)' },
                    { value: 'dry', label: 'Drought Tolerant (cacti, succulents)' },
                    { value: 'dry_moist', label: 'Low Water (Mediterranean, natives)' },
                    { value: 'moist', label: 'Average' },
                    { value: 'moist_wet', label: 'High Water (tropicals, veggies)' },
                    { value: 'wet', label: 'Bog/Aquatic' },
                  ]}
                  onChange={handleFieldChange}
                  editing={isEditing}
                />
                {isEditing && <p className="text-xs text-gray-500 mt-1">Auto-calculates watering schedule based on your zone</p>}
              </div>
              <div>
                <EditableField label="Water Schedule Override" value={editData.water_schedule} field="water_schedule" onChange={handleFieldChange} placeholder="summer:3,winter:10" editing={isEditing} />
                {isEditing && <p className="text-xs text-gray-500 mt-1">Optional: override auto-calculated schedule</p>}
              </div>
              <div>
                <EditableField label="Fertilize Schedule" value={editData.fertilize_schedule} field="fertilize_schedule" onChange={handleFieldChange} placeholder="spring:30,summer:45" editing={isEditing} />
                {isEditing && <p className="text-xs text-gray-500 mt-1">Days between fertilizing (0=none)</p>}
              </div>
              <EditableField label="Prune Frequency" value={editData.prune_frequency} field="prune_frequency" onChange={handleFieldChange} placeholder="e.g., Yearly after fruiting" editing={isEditing} />
              <EditableField label="Prune Months" value={editData.prune_months} field="prune_months" onChange={handleFieldChange} placeholder="e.g., Feb-Mar" editing={isEditing} />
            </div>

            {/* Auto Watering Settings */}
            {isEditing && (
              <div className="mt-4 p-3 bg-cyan-900/20 rounded-lg border border-cyan-700/30">
                <h5 className="text-xs font-medium text-cyan-400 mb-2 flex items-center gap-1">
                  <Droplets className="w-3 h-3" />
                  Automatic Watering
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`rain-${plant.id}`}
                      checked={editData.receives_rain}
                      onChange={(e) => handleFieldChange('receives_rain', e.target.checked)}
                      className="rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                    />
                    <label htmlFor={`rain-${plant.id}`} className="text-sm text-gray-300">Receives Rain</label>
                  </div>
                  {editData.receives_rain && (
                    <div>
                      <label className="text-xs text-gray-400">Rain Threshold (in)</label>
                      <input
                        type="number"
                        step="0.05"
                        value={editData.rain_threshold_inches}
                        onChange={(e) => handleFieldChange('rain_threshold_inches', parseFloat(e.target.value) || 0.25)}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`sprinkler-${plant.id}`}
                      checked={editData.sprinkler_enabled}
                      onChange={(e) => handleFieldChange('sprinkler_enabled', e.target.checked)}
                      className="rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                    />
                    <label htmlFor={`sprinkler-${plant.id}`} className="text-sm text-gray-300">Sprinkler Coverage</label>
                  </div>
                  {editData.sprinkler_enabled && (
                    <div>
                      <label className="text-xs text-gray-400">Sprinkler Schedule</label>
                      <input
                        type="text"
                        value={editData.sprinkler_schedule}
                        onChange={(e) => handleFieldChange('sprinkler_schedule', e.target.value)}
                        placeholder="days:0,2,4;time:06:00"
                        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">Mon=0, Sun=6. e.g., days:0,2,4;time:06:00</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Show auto-watering status when not editing */}
            {!isEditing && (editData.receives_rain || editData.sprinkler_enabled) && (
              <div className="mt-3 p-2 bg-cyan-900/20 rounded border border-cyan-700/30">
                <div className="flex items-center gap-2 text-xs text-cyan-400">
                  <Droplets className="w-3 h-3" />
                  <span>Auto-watering:</span>
                  {editData.receives_rain && <span className="bg-cyan-700/30 px-1.5 py-0.5 rounded">Rain ({editData.rain_threshold_inches}" min)</span>}
                  {editData.sprinkler_enabled && <span className="bg-cyan-700/30 px-1.5 py-0.5 rounded">Sprinkler</span>}
                </div>
              </div>
            )}

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
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-400">Production & Harvest</h4>
              <button
                onClick={(e) => { e.stopPropagation(); onHarvest(plant) }}
                className="px-3 py-1 bg-green-700 hover:bg-green-600 text-white text-sm rounded-lg flex items-center gap-1 transition-colors"
              >
                <Package className="w-3 h-3" />
                Record Harvest
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <EditableField label="Produces Months" value={editData.produces_months} field="produces_months" onChange={handleFieldChange} placeholder="e.g., Jun-Aug" editing={isEditing} />
              <EditableField label="Harvest Frequency" value={editData.harvest_frequency} field="harvest_frequency" onChange={handleFieldChange} placeholder="e.g., Weekly" editing={isEditing} />
              <EditableField label="How to Harvest" value={editData.how_to_harvest} field="how_to_harvest" type="textarea" onChange={handleFieldChange} editing={isEditing} />
            </div>
          </div>

          {/* Uses & Propagation */}
          <div className="space-y-3">
            <EditableField label="Uses" value={editData.uses} field="uses" type="textarea" onChange={handleFieldChange} placeholder="e.g., Fresh eating, jams" rows={4} editing={isEditing} />
            <EditableField label="Propagation Methods" value={editData.propagation_methods} field="propagation_methods" type="textarea" onChange={handleFieldChange} placeholder="e.g., Cuttings, grafting" editing={isEditing} />
            <EditableField label="Cultivation Details" value={editData.cultivation_details} field="cultivation_details" type="textarea" onChange={handleFieldChange} placeholder="Growing conditions, care tips, etc." rows={4} editing={isEditing} />
          </div>

          {/* Warnings */}
          <div className="bg-red-900/20 border border-red-900/30 rounded-lg p-3">
            <h4 className="text-sm font-medium text-red-400 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Warnings & Considerations
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <EditableField label="Known Hazards" value={editData.known_hazards} field="known_hazards" type="textarea" onChange={handleFieldChange} placeholder="e.g., Thorns, toxic to pets" editing={isEditing} />
              <EditableField label="Special Considerations" value={editData.special_considerations} field="special_considerations" type="textarea" onChange={handleFieldChange} placeholder="e.g., Needs hand pollination" editing={isEditing} />
            </div>
          </div>

          {/* Notes & References */}
          <EditableField label="Notes" value={editData.notes} field="notes" type="textarea" onChange={handleFieldChange} rows={3} editing={isEditing} />
          <EditableField label="References" value={editData.references} field="references" type="textarea" onChange={handleFieldChange} rows={5} editing={isEditing} />

          {/* Tags */}
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-2">Tags</h4>
            <div className="flex flex-wrap gap-2">
              {isEditing ? (
                tags.map(tag => (
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
                ))
              ) : (
                plant.tags && plant.tags.length > 0 ? (
                  plant.tags.map(tag => (
                    <span
                      key={tag.id}
                      className={`px-3 py-1 rounded-full text-sm ${getTagColor(tag.color)}`}
                    >
                      {tag.name}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-500 text-sm">No tags</span>
                )
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}


// Plant Form Modal Component (for adding new plants or duplicating)
function PlantFormModal({ tags, farmAreas, onClose, onSave, initialData = null }) {
  const [formData, setFormData] = useState({
    name: initialData?.name ? `${initialData.name} (Copy)` : '',
    latin_name: initialData?.latin_name || '',
    variety: initialData?.variety || '',
    description: initialData?.description || '',
    location: initialData?.location || '',
    sub_location: initialData?.sub_location || '',
    source: initialData?.source || '',
    grow_zones: initialData?.grow_zones || '',
    plant_zone: initialData?.plant_zone || '',
    sun_requirement: initialData?.sun_requirement || 'full_sun',
    soil_requirements: initialData?.soil_requirements || '',
    plant_spacing: initialData?.plant_spacing || '',
    size_full_grown: initialData?.size_full_grown || '',
    growth_rate: initialData?.growth_rate || 'moderate',
    min_temp: initialData?.min_temp || '',
    frost_sensitive: initialData?.frost_sensitive || false,
    needs_cover_below_temp: initialData?.needs_cover_below_temp || '',
    heat_tolerant: initialData?.heat_tolerant ?? true,
    drought_tolerant: initialData?.drought_tolerant || false,
    salt_tolerant: initialData?.salt_tolerant || false,
    needs_shade_above_temp: initialData?.needs_shade_above_temp || '',
    moisture_preference: initialData?.moisture_preference || '',
    water_schedule: initialData?.water_schedule || '',
    receives_rain: initialData?.receives_rain || false,
    rain_threshold_inches: initialData?.rain_threshold_inches || 0.25,
    sprinkler_enabled: initialData?.sprinkler_enabled || false,
    sprinkler_schedule: initialData?.sprinkler_schedule || '',
    fertilize_schedule: initialData?.fertilize_schedule || '',
    prune_frequency: initialData?.prune_frequency || '',
    prune_months: initialData?.prune_months || '',
    produces_months: initialData?.produces_months || '',
    harvest_frequency: initialData?.harvest_frequency || '',
    how_to_harvest: initialData?.how_to_harvest || '',
    uses: initialData?.uses || '',
    propagation_methods: initialData?.propagation_methods || '',
    cultivation_details: initialData?.cultivation_details || '',
    known_hazards: initialData?.known_hazards || '',
    special_considerations: initialData?.special_considerations || '',
    notes: initialData?.notes || '',
    references: initialData?.references || '',
    tag_ids: initialData?.tags?.map(t => t.id) || [],
  })

  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      // Convert empty strings to null for optional fields
      const cleanData = {}
      for (const [key, value] of Object.entries(formData)) {
        cleanData[key] = value === '' ? null : value
      }
      const data = {
        ...cleanData,
        min_temp: cleanData.min_temp ? parseFloat(cleanData.min_temp) : null,
        needs_cover_below_temp: cleanData.needs_cover_below_temp ? parseFloat(cleanData.needs_cover_below_temp) : null,
        needs_shade_above_temp: cleanData.needs_shade_above_temp ? parseFloat(cleanData.needs_shade_above_temp) : null,
      }
      await createPlant(data)
      onSave()
    } catch (error) {
      console.error('Failed to save plant:', error)
      // Don't show alert for 401 - the interceptor handles redirect
      if (error.response?.status !== 401) {
        alert(error.userMessage || 'Failed to save plant. Please try again.')
      }
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
      <div className="bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-800 p-4 border-b border-gray-700 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold">{initialData ? 'Duplicate Plant' : 'Add New Plant'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6" id="plant-form">
          {/* Basic Info */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Basic Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  placeholder="Genus species"
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
                <LocationSelect
                  value={formData.location}
                  subValue={formData.sub_location}
                  onChange={(value) => setFormData({ ...formData, location: value })}
                  onSubChange={(value) => setFormData({ ...formData, sub_location: value })}
                  farmAreas={farmAreas}
                  editing={true}
                  label=""
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Source</label>
                <input
                  type="text"
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  placeholder="Where purchased"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm text-gray-400 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
          </div>

          {/* Growing Requirements */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Growing Requirements</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Hardiness Zones (species)</label>
                <input
                  type="text"
                  value={formData.grow_zones}
                  onChange={(e) => setFormData({ ...formData, grow_zones: e.target.value })}
                  placeholder="e.g., 9-11"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">This Plant's Zone (override)</label>
                <select
                  value={formData.plant_zone}
                  onChange={(e) => setFormData({ ...formData, plant_zone: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                >
                  <option value="">Use global zone</option>
                  {['1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a','7b','8a','8b','9a','9b','10a','10b','11a','11b','12a','12b','13a','13b'].map(z => (
                    <option key={z} value={z}>Zone {z}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Sun Requirement</label>
                <select
                  value={formData.sun_requirement}
                  onChange={(e) => setFormData({ ...formData, sun_requirement: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                >
                  {SUN_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Growth Rate</label>
                <select
                  value={formData.growth_rate}
                  onChange={(e) => setFormData({ ...formData, growth_rate: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                >
                  {GROWTH_RATE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Soil Requirements</label>
                <input
                  type="text"
                  value={formData.soil_requirements}
                  onChange={(e) => setFormData({ ...formData, soil_requirements: e.target.value })}
                  placeholder="e.g., Well-drained, loamy"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Plant Spacing</label>
                <input
                  type="text"
                  value={formData.plant_spacing}
                  onChange={(e) => setFormData({ ...formData, plant_spacing: e.target.value })}
                  placeholder="e.g., 15-20 feet"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Size Full Grown</label>
                <input
                  type="text"
                  value={formData.size_full_grown}
                  onChange={(e) => setFormData({ ...formData, size_full_grown: e.target.value })}
                  placeholder="e.g., 20-30 ft tall"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
            </div>
          </div>

          {/* Temperature & Tolerance */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Temperature & Tolerance</h3>
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
              <div>
                <label className="block text-sm text-gray-400 mb-1">Cover Below (°F)</label>
                <input
                  type="number"
                  value={formData.needs_cover_below_temp}
                  onChange={(e) => setFormData({ ...formData, needs_cover_below_temp: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Shade Above (°F)</label>
                <input
                  type="number"
                  value={formData.needs_shade_above_temp}
                  onChange={(e) => setFormData({ ...formData, needs_shade_above_temp: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-3">
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
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.salt_tolerant}
                  onChange={(e) => setFormData({ ...formData, salt_tolerant: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm">Salt Tolerant</span>
              </label>
            </div>
          </div>

          {/* Care Schedule */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Care Schedule</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Moisture Preference</label>
                <select
                  value={formData.moisture_preference}
                  onChange={(e) => setFormData({ ...formData, moisture_preference: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                >
                  {MOISTURE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Water Schedule Override</label>
                <input
                  type="text"
                  placeholder="summer:3,winter:10"
                  value={formData.water_schedule}
                  onChange={(e) => setFormData({ ...formData, water_schedule: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Fertilize Schedule</label>
                <input
                  type="text"
                  placeholder="spring:30,summer:45"
                  value={formData.fertilize_schedule}
                  onChange={(e) => setFormData({ ...formData, fertilize_schedule: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Prune Frequency</label>
                <input
                  type="text"
                  placeholder="e.g., Yearly after fruiting"
                  value={formData.prune_frequency}
                  onChange={(e) => setFormData({ ...formData, prune_frequency: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Prune Months</label>
                <input
                  type="text"
                  placeholder="e.g., Feb-Mar"
                  value={formData.prune_months}
                  onChange={(e) => setFormData({ ...formData, prune_months: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
            </div>
          </div>

          {/* Auto Watering */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Automatic Watering</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.receives_rain}
                    onChange={(e) => setFormData({ ...formData, receives_rain: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Receives Rain</span>
                </label>
                {formData.receives_rain && (
                  <div className="mt-2">
                    <label className="block text-xs text-gray-400 mb-1">Rain Threshold (inches)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={formData.rain_threshold_inches}
                      onChange={(e) => setFormData({ ...formData, rain_threshold_inches: parseFloat(e.target.value) || 0.25 })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.sprinkler_enabled}
                    onChange={(e) => setFormData({ ...formData, sprinkler_enabled: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Sprinkler Coverage</span>
                </label>
                {formData.sprinkler_enabled && (
                  <div className="mt-2">
                    <label className="block text-xs text-gray-400 mb-1">Sprinkler Schedule</label>
                    <input
                      type="text"
                      value={formData.sprinkler_schedule}
                      onChange={(e) => setFormData({ ...formData, sprinkler_schedule: e.target.value })}
                      placeholder="days:0,2,4;time:06:00"
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                    />
                    <p className="text-xs text-gray-500 mt-1">Mon=0, Sun=6</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Production & Harvest */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Production & Harvest</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Produces Months</label>
                <input
                  type="text"
                  placeholder="e.g., Jun-Aug"
                  value={formData.produces_months}
                  onChange={(e) => setFormData({ ...formData, produces_months: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Harvest Frequency</label>
                <input
                  type="text"
                  placeholder="e.g., Weekly"
                  value={formData.harvest_frequency}
                  onChange={(e) => setFormData({ ...formData, harvest_frequency: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div className="sm:col-span-2 md:col-span-1">
                <label className="block text-sm text-gray-400 mb-1">How to Harvest</label>
                <textarea
                  value={formData.how_to_harvest}
                  onChange={(e) => setFormData({ ...formData, how_to_harvest: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
            </div>
          </div>

          {/* Uses & Info */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Uses & Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Uses</label>
                <textarea
                  value={formData.uses}
                  onChange={(e) => setFormData({ ...formData, uses: e.target.value })}
                  rows={3}
                  placeholder="e.g., Edible fruit, medicinal"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Propagation Methods</label>
                <textarea
                  value={formData.propagation_methods}
                  onChange={(e) => setFormData({ ...formData, propagation_methods: e.target.value })}
                  rows={3}
                  placeholder="e.g., Seed, cuttings, grafting"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-400 mb-1">Cultivation Details</label>
                <textarea
                  value={formData.cultivation_details}
                  onChange={(e) => setFormData({ ...formData, cultivation_details: e.target.value })}
                  rows={3}
                  placeholder="Growing conditions, care tips, etc."
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
            </div>
          </div>

          {/* Warnings */}
          <div>
            <h3 className="text-sm font-medium text-red-400 mb-3">Warnings & Considerations</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Known Hazards</label>
                <textarea
                  value={formData.known_hazards}
                  onChange={(e) => setFormData({ ...formData, known_hazards: e.target.value })}
                  rows={2}
                  placeholder="e.g., Thorns, toxic to pets"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Special Considerations</label>
                <textarea
                  value={formData.special_considerations}
                  onChange={(e) => setFormData({ ...formData, special_considerations: e.target.value })}
                  rows={2}
                  placeholder="e.g., Needs hand pollination"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
            </div>
          </div>

          {/* Notes & References */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Notes & References</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">References</label>
                <textarea
                  value={formData.references}
                  onChange={(e) => setFormData({ ...formData, references: e.target.value })}
                  rows={3}
                  placeholder="Source URLs and bibliography"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
            </div>
          </div>

          {/* Tags */}
          {tags && tags.length > 0 && (
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
          )}

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
              disabled={saving || !formData.name.trim()}
              onClick={(e) => {
                // Ensure form submits on touch devices
                const form = document.getElementById('plant-form')
                if (form && !form.checkValidity()) {
                  form.reportValidity()
                  e.preventDefault()
                }
              }}
              className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors disabled:opacity-50 touch-manipulation"
              style={{ minHeight: '48px' }}
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
              className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


// Harvest Form Modal - record plant harvests
function HarvestFormModal({ plant, onClose, onSave }) {
  const [formData, setFormData] = useState({
    plant_id: plant.id,
    harvest_date: new Date().toISOString().split('T')[0],
    quantity: '',
    unit: 'lbs',
    quality: 'good',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.quantity) {
      alert('Please enter a quantity')
      return
    }
    setSaving(true)
    try {
      await onSave({
        ...formData,
        quantity: parseFloat(formData.quantity),
      })
    } catch (error) {
      console.error('Failed to save harvest:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Package className="w-5 h-5 text-green-500" />
              Record Harvest
            </h2>
            <p className="text-sm text-gray-400">{plant.name} {plant.variety && `(${plant.variety})`}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Harvest Date</label>
            <input
              type="date"
              value={formData.harvest_date}
              onChange={(e) => setFormData({ ...formData, harvest_date: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Quantity *</label>
              <input
                type="number"
                step="0.1"
                required
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                placeholder="Amount harvested"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Unit</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              >
                <option value="lbs">Pounds (lbs)</option>
                <option value="oz">Ounces (oz)</option>
                <option value="kg">Kilograms (kg)</option>
                <option value="count">Count</option>
                <option value="bunches">Bunches</option>
                <option value="pints">Pints</option>
                <option value="quarts">Quarts</option>
                <option value="gallons">Gallons</option>
                <option value="bushels">Bushels</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Quality</label>
            <select
              value={formData.quality}
              onChange={(e) => setFormData({ ...formData, quality: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            >
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Any notes about this harvest..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div className="flex gap-3 pt-2">
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
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Record Harvest'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Sell Plant Modal - record selling a whole plant or tree
function SellPlantModal({ plant, onClose, onSave }) {
  const [formData, setFormData] = useState({
    category: 'plant',
    item_name: plant.name + (plant.variety ? ` (${plant.variety})` : ''),
    description: '',
    quantity: '1',
    unit: 'each',
    unit_price: '',
    sale_date: new Date().toISOString().split('T')[0],
    plant_id: plant.id,
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.unit_price) {
      alert('Please enter a price')
      return
    }
    setSaving(true)
    try {
      await onSave({
        ...formData,
        quantity: parseFloat(formData.quantity),
        unit_price: parseFloat(formData.unit_price),
      })
    } catch (error) {
      console.error('Failed to record sale:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              Sell Plant
            </h2>
            <p className="text-sm text-gray-400">{plant.name} {plant.variety && `(${plant.variety})`}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Item Name</label>
            <input
              type="text"
              value={formData.item_name}
              onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Sale Date</label>
            <input
              type="date"
              value={formData.sale_date}
              onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Quantity</label>
              <input
                type="number"
                step="1"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Price Each *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.unit_price}
                onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                placeholder="$0.00"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              placeholder="Buyer name, details, etc."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div className="flex gap-3 pt-2">
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
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Record Sale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Import Modal - import plant data from PFAF/Permapeople URLs
function ImportModal({ onClose, onSuccess, tags, farmAreas, existingPlant = null }) {
  const [url, setUrl] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [step, setStep] = useState('fetch') // 'fetch' or 'edit'

  // Track which fields have imported data and whether to use them
  const [importedData, setImportedData] = useState({})
  const [useImported, setUseImported] = useState({})

  // Form data for editing
  const [formData, setFormData] = useState({
    name: '',
    latin_name: '',
    variety: '',
    description: '',
    location: '',
    sub_location: '',
    source: '',
    grow_zones: '',
    plant_zone: '',
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
    moisture_preference: '',
    water_schedule: '',
    receives_rain: false,
    rain_threshold_inches: 0.25,
    sprinkler_enabled: false,
    sprinkler_schedule: '',
    fertilize_schedule: '',
    prune_frequency: '',
    prune_months: '',
    produces_months: '',
    harvest_frequency: '',
    how_to_harvest: '',
    uses: '',
    propagation_methods: '',
    cultivation_details: '',
    known_hazards: '',
    special_considerations: '',
    notes: '',
    references: '',
    tag_ids: [],
  })

  // If importing to existing plant, pre-populate with existing data
  useEffect(() => {
    if (existingPlant) {
      setFormData({
        name: existingPlant.name || '',
        latin_name: existingPlant.latin_name || '',
        variety: existingPlant.variety || '',
        description: existingPlant.description || '',
        location: existingPlant.location || '',
        sub_location: existingPlant.sub_location || '',
        source: existingPlant.source || '',
        grow_zones: existingPlant.grow_zones || '',
        plant_zone: existingPlant.plant_zone || '',
        sun_requirement: existingPlant.sun_requirement || 'full_sun',
        soil_requirements: existingPlant.soil_requirements || '',
        plant_spacing: existingPlant.plant_spacing || '',
        size_full_grown: existingPlant.size_full_grown || '',
        growth_rate: existingPlant.growth_rate || 'moderate',
        min_temp: existingPlant.min_temp || '',
        frost_sensitive: existingPlant.frost_sensitive || false,
        needs_cover_below_temp: existingPlant.needs_cover_below_temp || '',
        heat_tolerant: existingPlant.heat_tolerant ?? true,
        drought_tolerant: existingPlant.drought_tolerant || false,
        salt_tolerant: existingPlant.salt_tolerant || false,
        needs_shade_above_temp: existingPlant.needs_shade_above_temp || '',
        moisture_preference: existingPlant.moisture_preference || '',
        water_schedule: existingPlant.water_schedule || '',
        receives_rain: existingPlant.receives_rain || false,
        rain_threshold_inches: existingPlant.rain_threshold_inches || 0.25,
        sprinkler_enabled: existingPlant.sprinkler_enabled || false,
        sprinkler_schedule: existingPlant.sprinkler_schedule || '',
        fertilize_schedule: existingPlant.fertilize_schedule || '',
        prune_frequency: existingPlant.prune_frequency || '',
        prune_months: existingPlant.prune_months || '',
        produces_months: existingPlant.produces_months || '',
        harvest_frequency: existingPlant.harvest_frequency || '',
        how_to_harvest: existingPlant.how_to_harvest || '',
        uses: existingPlant.uses || '',
        propagation_methods: existingPlant.propagation_methods || '',
        cultivation_details: existingPlant.cultivation_details || '',
        known_hazards: existingPlant.known_hazards || '',
        special_considerations: existingPlant.special_considerations || '',
        notes: existingPlant.notes || '',
        references: existingPlant.references || '',
        tag_ids: existingPlant.tags?.map(t => t.id) || [],
      })
    }
  }, [existingPlant])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    setSearchResults([])
    try {
      const response = await searchPlantImport(searchQuery.trim())
      setSearchResults(response.data.results || [])
    } catch (err) {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleSearchResultClick = (result) => {
    setUrl(result.url)
    setSearchResults([])
  }

  const handleFetch = async () => {
    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

    setFetching(true)
    setError(null)

    try {
      const response = await previewPlantImport(url)
      const fetched = response.data.data || response.data

      // Store imported data separately
      setImportedData(fetched)

      // For existing plants, let user choose which fields to overwrite
      // For new plants, use all imported data by default
      const newUseImported = {}
      Object.keys(fetched).forEach(key => {
        if (fetched[key] !== null && fetched[key] !== undefined && fetched[key] !== '') {
          // For existing plants, default to NOT overwriting non-empty fields
          if (existingPlant) {
            const existingValue = formData[key]
            const isEmpty = !existingValue || existingValue === '' || existingValue === 'full_sun' || existingValue === 'moderate'
            newUseImported[key] = isEmpty
          } else {
            newUseImported[key] = true
          }
        }
      })
      setUseImported(newUseImported)

      // Apply imported data based on useImported flags
      setFormData(prev => {
        const merged = { ...prev }
        Object.keys(fetched).forEach(key => {
          if (fetched[key] !== null && fetched[key] !== undefined && fetched[key] !== '') {
            if (newUseImported[key]) {
              merged[key] = fetched[key]
            }
          }
        })
        return merged
      })

      setStep('edit')
    } catch (err) {
      console.error('Fetch failed:', err)
      setError(err.response?.data?.detail || 'Failed to fetch plant data. Check the URL and try again.')
    } finally {
      setFetching(false)
    }
  }

  // Toggle whether to use imported value for a field
  const toggleUseImported = (field) => {
    setUseImported(prev => {
      const newValue = !prev[field]
      // Also update formData accordingly
      if (newValue && importedData[field]) {
        setFormData(fd => ({ ...fd, [field]: importedData[field] }))
      }
      return { ...prev, [field]: newValue }
    })
  }

  // Check if a field has imported data available
  const hasImportedData = (field) => {
    return importedData[field] !== null && importedData[field] !== undefined && importedData[field] !== ''
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Plant name is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Convert empty strings to null for optional fields
      const cleanData = {}
      for (const [key, value] of Object.entries(formData)) {
        cleanData[key] = value === '' ? null : value
      }
      const data = {
        ...cleanData,
        min_temp: cleanData.min_temp ? parseFloat(cleanData.min_temp) : null,
        needs_cover_below_temp: cleanData.needs_cover_below_temp ? parseFloat(cleanData.needs_cover_below_temp) : null,
        needs_shade_above_temp: cleanData.needs_shade_above_temp ? parseFloat(cleanData.needs_shade_above_temp) : null,
      }

      if (existingPlant) {
        await updatePlant(existingPlant.id, data)
      } else {
        // Pass image_url from import data so backend downloads the photo
        if (importedData?.image_url) {
          data.image_url = importedData.image_url
        }
        await createPlant(data)
      }
      onSuccess()
    } catch (err) {
      console.error('Save failed:', err)
      setError(err.response?.data?.detail || 'Failed to save plant. Please try again.')
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
      amber: 'bg-amber-900/50 text-amber-300 border-amber-700',
      gray: 'bg-gray-700 text-gray-300 border-gray-600',
    }
    return colors[color] || colors.gray
  }

  // Fetch step - search and enter URL
  if (step === 'fetch') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-gray-800 rounded-xl w-full max-w-xl" onClick={e => e.stopPropagation()}>
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Download className="w-5 h-5 text-green-500" />
                {existingPlant ? `Import Data to ${existingPlant.name}` : 'Import Plant Data'}
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Import from{' '}
                <a href="https://www.picturethisai.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">picturethisai.com</a>,{' '}
                <a href="https://pfaf.org" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">pfaf.org</a>,{' '}
                <a href="https://gardenia.net" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">gardenia.net</a>, or{' '}
                <a href="https://growables.org" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">growables.org</a>
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Search Plants */}
            <div className="bg-gray-900/50 rounded-lg p-3">
              <label className="block text-sm text-gray-400 mb-2">Search Plants</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search by plant name (e.g., Lemon, Tomato, Oak)"
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSearch}
                  disabled={!searchQuery.trim() || searching}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Search
                </button>
              </div>
              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                  {searchResults.map((result, i) => (
                    <button
                      key={i}
                      onClick={() => handleSearchResultClick(result)}
                      className="w-full text-left px-3 py-2 bg-gray-700/50 hover:bg-gray-600 rounded-lg flex items-center gap-3 transition-colors"
                    >
                      {result.image_url && (
                        <img src={result.image_url + '?x-oss-process=image/resize,l_40'} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm text-white truncate">{result.common_name}</div>
                        <div className="text-xs text-gray-400 italic truncate">{result.latin_name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {searching && (
                <p className="text-xs text-gray-500 mt-2">Searching...</p>
              )}
            </div>

            {/* URL Input */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Plant URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://picturethisai.com/wiki/... or https://pfaf.org/... or https://gardenia.net/..."
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-gray-700 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { setStep('edit'); setError(null) }}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
            >
              Skip - Enter Manually
            </button>
            <button
              onClick={handleFetch}
              disabled={fetching || !url.trim()}
              className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {fetching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Fetching...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Fetch Data
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Edit step - full form with imported data
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-gray-800 p-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {existingPlant ? `Update ${existingPlant.name}` : 'Add New Plant'}
            </h2>
            <p className="text-sm text-gray-400">Review and edit the imported data</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setStep('fetch'); setError(null) }}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
            >
              Back
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Error */}
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Imported Photo Preview */}
          {importedData?.image_url && (
            <div className="bg-gray-900/50 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-2">Photo (will be imported)</p>
              <img
                src={importedData.image_url}
                alt={importedData.name || 'Plant'}
                className="w-full max-h-48 object-cover rounded-lg"
              />
            </div>
          )}

          {/* Import Field Selector - shows when importing to existing plant */}
          {existingPlant && Object.keys(importedData).length > 0 && (
            <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-300 mb-2">Select Fields to Import</h3>
              <p className="text-xs text-gray-400 mb-3">Check the fields you want to overwrite with imported data:</p>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                {Object.keys(importedData).filter(key =>
                  importedData[key] !== null && importedData[key] !== undefined && importedData[key] !== '' && key !== 'tag_ids'
                ).map(field => {
                  const existingValue = existingPlant[field]
                  const hasExisting = existingValue && existingValue !== '' && existingValue !== 'full_sun' && existingValue !== 'moderate'
                  const fieldLabel = field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                  return (
                    <label key={field} className={`flex items-center gap-2 text-xs p-1.5 rounded cursor-pointer ${
                      hasExisting ? 'bg-amber-900/30 border border-amber-700/50' : 'bg-gray-700/50'
                    }`}>
                      <input
                        type="checkbox"
                        checked={useImported[field] || false}
                        onChange={() => toggleUseImported(field)}
                        className="w-3 h-3"
                      />
                      <span className={hasExisting ? 'text-amber-200' : 'text-gray-300'}>
                        {fieldLabel}
                        {hasExisting && ' *'}
                      </span>
                    </label>
                  )
                })}
              </div>
              <p className="text-xs text-amber-400 mt-2">* Fields with existing data (will be overwritten if checked)</p>
            </div>
          )}

          {/* Basic Info */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Basic Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  placeholder="Genus species"
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
                <LocationSelect
                  value={formData.location}
                  subValue={formData.sub_location}
                  onChange={(value) => setFormData({ ...formData, location: value })}
                  onSubChange={(value) => setFormData({ ...formData, sub_location: value })}
                  farmAreas={farmAreas}
                  editing={true}
                  label=""
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Source</label>
                <input
                  type="text"
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  placeholder="Where purchased"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm text-gray-400 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
          </div>

          {/* Growing Requirements */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Growing Requirements</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Hardiness Zones (species)</label>
                <input
                  type="text"
                  value={formData.grow_zones}
                  onChange={(e) => setFormData({ ...formData, grow_zones: e.target.value })}
                  placeholder="e.g., 9-11"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">This Plant's Zone (override)</label>
                <select
                  value={formData.plant_zone}
                  onChange={(e) => setFormData({ ...formData, plant_zone: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                >
                  <option value="">Use global zone</option>
                  {['1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a','7b','8a','8b','9a','9b','10a','10b','11a','11b','12a','12b','13a','13b'].map(z => (
                    <option key={z} value={z}>Zone {z}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Sun Requirement</label>
                <select
                  value={formData.sun_requirement}
                  onChange={(e) => setFormData({ ...formData, sun_requirement: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                >
                  {SUN_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Growth Rate</label>
                <select
                  value={formData.growth_rate}
                  onChange={(e) => setFormData({ ...formData, growth_rate: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                >
                  {GROWTH_RATE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Soil Requirements</label>
                <input
                  type="text"
                  value={formData.soil_requirements}
                  onChange={(e) => setFormData({ ...formData, soil_requirements: e.target.value })}
                  placeholder="e.g., Well-drained, loamy"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Plant Spacing</label>
                <input
                  type="text"
                  value={formData.plant_spacing}
                  onChange={(e) => setFormData({ ...formData, plant_spacing: e.target.value })}
                  placeholder="e.g., 15-20 feet"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Size Full Grown</label>
                <input
                  type="text"
                  value={formData.size_full_grown}
                  onChange={(e) => setFormData({ ...formData, size_full_grown: e.target.value })}
                  placeholder="e.g., 20-30 ft tall"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
            </div>
          </div>

          {/* Temperature & Tolerance */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Temperature & Tolerance</h3>
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
              <div>
                <label className="block text-sm text-gray-400 mb-1">Cover Below (°F)</label>
                <input
                  type="number"
                  value={formData.needs_cover_below_temp}
                  onChange={(e) => setFormData({ ...formData, needs_cover_below_temp: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Shade Above (°F)</label>
                <input
                  type="number"
                  value={formData.needs_shade_above_temp}
                  onChange={(e) => setFormData({ ...formData, needs_shade_above_temp: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-3">
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
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.salt_tolerant}
                  onChange={(e) => setFormData({ ...formData, salt_tolerant: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm">Salt Tolerant</span>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Moisture Preference</label>
                <select
                  value={formData.moisture_preference}
                  onChange={(e) => setFormData({ ...formData, moisture_preference: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                >
                  {MOISTURE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Care Schedule */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Care Schedule</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Water Schedule</label>
                <input
                  type="text"
                  value={formData.water_schedule}
                  onChange={(e) => setFormData({ ...formData, water_schedule: e.target.value })}
                  placeholder="e.g., Weekly"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Fertilize Schedule</label>
                <input
                  type="text"
                  value={formData.fertilize_schedule}
                  onChange={(e) => setFormData({ ...formData, fertilize_schedule: e.target.value })}
                  placeholder="e.g., Monthly"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Prune Frequency</label>
                <input
                  type="text"
                  value={formData.prune_frequency}
                  onChange={(e) => setFormData({ ...formData, prune_frequency: e.target.value })}
                  placeholder="e.g., Annually"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Prune Months</label>
                <input
                  type="text"
                  value={formData.prune_months}
                  onChange={(e) => setFormData({ ...formData, prune_months: e.target.value })}
                  placeholder="e.g., Feb-Mar"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
            </div>
          </div>

          {/* Auto Watering */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Auto Watering</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.receives_rain}
                  onChange={(e) => setFormData({ ...formData, receives_rain: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm">Receives Rain</span>
              </label>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Rain Threshold (in)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.rain_threshold_inches}
                  onChange={(e) => setFormData({ ...formData, rain_threshold_inches: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.sprinkler_enabled}
                  onChange={(e) => setFormData({ ...formData, sprinkler_enabled: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm">Sprinkler Enabled</span>
              </label>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Sprinkler Schedule</label>
                <input
                  type="text"
                  value={formData.sprinkler_schedule}
                  onChange={(e) => setFormData({ ...formData, sprinkler_schedule: e.target.value })}
                  placeholder="e.g., Mon/Wed/Fri"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
            </div>
          </div>

          {/* Production & Harvest */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Production & Harvest</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Produces Months</label>
                <input
                  type="text"
                  value={formData.produces_months}
                  onChange={(e) => setFormData({ ...formData, produces_months: e.target.value })}
                  placeholder="e.g., Jun-Sep"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Harvest Frequency</label>
                <input
                  type="text"
                  value={formData.harvest_frequency}
                  onChange={(e) => setFormData({ ...formData, harvest_frequency: e.target.value })}
                  placeholder="e.g., Weekly"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div className="sm:col-span-2 md:col-span-1">
                <label className="block text-sm text-gray-400 mb-1">How to Harvest</label>
                <input
                  type="text"
                  value={formData.how_to_harvest}
                  onChange={(e) => setFormData({ ...formData, how_to_harvest: e.target.value })}
                  placeholder="Harvesting instructions"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
            </div>
          </div>

          {/* Uses & Info */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Uses & Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Uses</label>
                <textarea
                  value={formData.uses}
                  onChange={(e) => setFormData({ ...formData, uses: e.target.value })}
                  rows={3}
                  placeholder="e.g., Edible fruit, medicinal"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Propagation Methods</label>
                <textarea
                  value={formData.propagation_methods}
                  onChange={(e) => setFormData({ ...formData, propagation_methods: e.target.value })}
                  rows={3}
                  placeholder="e.g., Seed, cuttings, grafting"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-400 mb-1">Cultivation Details</label>
                <textarea
                  value={formData.cultivation_details}
                  onChange={(e) => setFormData({ ...formData, cultivation_details: e.target.value })}
                  rows={3}
                  placeholder="Growing conditions, care tips, etc."
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
            </div>
          </div>

          {/* Warnings */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Warnings</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Known Hazards</label>
                <textarea
                  value={formData.known_hazards}
                  onChange={(e) => setFormData({ ...formData, known_hazards: e.target.value })}
                  rows={2}
                  placeholder="e.g., Thorns, toxic to pets"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Special Considerations</label>
                <textarea
                  value={formData.special_considerations}
                  onChange={(e) => setFormData({ ...formData, special_considerations: e.target.value })}
                  rows={2}
                  placeholder="Any special care notes"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
            </div>
          </div>

          {/* Notes & References */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Notes & References</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">References</label>
                <textarea
                  value={formData.references}
                  onChange={(e) => setFormData({ ...formData, references: e.target.value })}
                  rows={2}
                  placeholder="Source URLs and bibliography"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green text-sm"
                />
              </div>
            </div>
          </div>

          {/* Tags */}
          {tags && tags.length > 0 && (
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
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !formData.name.trim()}
            className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              existingPlant ? 'Update Plant' : 'Add Plant'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Plants
