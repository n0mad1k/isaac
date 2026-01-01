import React, { useState, useEffect } from 'react'
import {
  Plus, Search, Leaf, Droplets, Sun, Snowflake, ChevronDown, ChevronUp,
  Thermometer, MapPin, Calendar, Clock, Scissors, Apple, AlertTriangle,
  Info, X, Tag as TagIcon, Pencil
} from 'lucide-react'
import {
  getPlants, createPlant, updatePlant, addPlantCareLog, getPlantTags, createPlantTag
} from '../services/api'

function Plants() {
  const [plants, setPlants] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingPlant, setEditingPlant] = useState(null)
  const [expandedPlant, setExpandedPlant] = useState(null)
  const [search, setSearch] = useState('')
  const [filterTag, setFilterTag] = useState('all')
  const [filterSpecial, setFilterSpecial] = useState('all')
  const [editDateModal, setEditDateModal] = useState(null) // { plantId, field, currentDate }

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
      fetchData() // Refresh to show updated last watered/fertilized
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
          onClick={() => { setEditingPlant(null); setShowForm(true) }}
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
        <div className="space-y-3">
          {filteredPlants.map((plant) => (
            <div
              key={plant.id}
              className="bg-gray-800 rounded-xl overflow-hidden"
            >
              {/* Card Header: Name - Tags - Description - Age - Min Temp - Emojis */}
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-750"
                onClick={() => setExpandedPlant(expandedPlant === plant.id ? null : plant.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-semibold text-lg">{plant.name}</h3>

                    {/* Tags */}
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

                  {/* Brief description line */}
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

                {/* Right side: Status icons and chevron */}
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
                  {expandedPlant === plant.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {expandedPlant === plant.id && (
                <div className="px-4 pb-4 border-t border-gray-700 pt-4 space-y-4">

                  {/* Basic Info Row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {plant.latin_name && (
                      <div>
                        <span className="text-gray-500">Latin Name</span>
                        <p className="text-gray-300 italic">{plant.latin_name}</p>
                      </div>
                    )}
                    {plant.variety && (
                      <div>
                        <span className="text-gray-500">Variety</span>
                        <p className="text-gray-300">{plant.variety}</p>
                      </div>
                    )}
                    {plant.location && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div>
                          <span className="text-gray-500">Location</span>
                          <p className="text-gray-300">{plant.location}</p>
                        </div>
                      </div>
                    )}
                    {plant.source && (
                      <div>
                        <span className="text-gray-500">Source</span>
                        <p className="text-gray-300">{plant.source}</p>
                      </div>
                    )}
                  </div>

                  {/* Growing Requirements */}
                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Growing Requirements</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      {plant.grow_zones && (
                        <div>
                          <span className="text-gray-500">Zones</span>
                          <p className="text-gray-300">{plant.grow_zones}</p>
                        </div>
                      )}
                      {plant.sun_requirement && (
                        <div>
                          <span className="text-gray-500">Sun</span>
                          <p className="text-gray-300">{getSunLabel(plant.sun_requirement)}</p>
                        </div>
                      )}
                      {plant.soil_requirements && (
                        <div>
                          <span className="text-gray-500">Soil</span>
                          <p className="text-gray-300">{plant.soil_requirements}</p>
                        </div>
                      )}
                      {plant.plant_spacing && (
                        <div>
                          <span className="text-gray-500">Spacing</span>
                          <p className="text-gray-300">{plant.plant_spacing}</p>
                        </div>
                      )}
                      {plant.size_full_grown && (
                        <div>
                          <span className="text-gray-500">Mature Size</span>
                          <p className="text-gray-300">{plant.size_full_grown}</p>
                        </div>
                      )}
                      {plant.growth_rate && (
                        <div>
                          <span className="text-gray-500">Growth Rate</span>
                          <p className="text-gray-300">{getGrowthRateLabel(plant.growth_rate)}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Temperature Tolerances */}
                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Temperature & Tolerance</h4>
                    <div className="flex flex-wrap gap-2">
                      {plant.frost_sensitive && (
                        <span className="px-2 py-1 bg-blue-900/30 text-blue-300 rounded text-xs flex items-center gap-1">
                          <Snowflake className="w-3 h-3" /> Frost Sensitive
                        </span>
                      )}
                      {plant.min_temp && (
                        <span className="px-2 py-1 bg-blue-900/30 text-blue-300 rounded text-xs">
                          Min Temp: {plant.min_temp}°F
                        </span>
                      )}
                      {plant.needs_cover_below_temp && (
                        <span className="px-2 py-1 bg-indigo-900/30 text-indigo-300 rounded text-xs">
                          Cover below {plant.needs_cover_below_temp}°F
                        </span>
                      )}
                      {plant.heat_tolerant && (
                        <span className="px-2 py-1 bg-orange-900/30 text-orange-300 rounded text-xs">
                          Heat Tolerant
                        </span>
                      )}
                      {plant.needs_shade_above_temp && (
                        <span className="px-2 py-1 bg-red-900/30 text-red-300 rounded text-xs">
                          Shade above {plant.needs_shade_above_temp}°F
                        </span>
                      )}
                      {plant.drought_tolerant && (
                        <span className="px-2 py-1 bg-yellow-900/30 text-yellow-300 rounded text-xs">
                          Drought Tolerant
                        </span>
                      )}
                      {plant.salt_tolerant && (
                        <span className="px-2 py-1 bg-cyan-900/30 text-cyan-300 rounded text-xs">
                          Salt Tolerant
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Care Schedule */}
                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Care Schedule</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      {/* Watering */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-cyan-400">
                          <Droplets className="w-4 h-4" />
                          <span>Watering</span>
                        </div>
                        {plant.water_days_current_season && (
                          <p className="text-gray-400">Every {plant.water_days_current_season} days (this season)</p>
                        )}
                        <div className="flex items-center gap-1 text-gray-500 text-xs">
                          <span>Last: {plant.last_watered ? formatDate(plant.last_watered) : 'Never'}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditDateModal({ plantId: plant.id, field: 'last_watered', label: 'Last Watered', currentDate: plant.last_watered }) }}
                            className="p-0.5 hover:bg-gray-700 rounded"
                            title="Edit date"
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

                      {/* Fertilizing */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-green-400">
                          <Leaf className="w-4 h-4" />
                          <span>Fertilizing</span>
                        </div>
                        {plant.fertilize_days_current_season && (
                          <p className="text-gray-400">Every {plant.fertilize_days_current_season} days</p>
                        )}
                        <div className="flex items-center gap-1 text-gray-500 text-xs">
                          <span>Last: {plant.last_fertilized ? formatDate(plant.last_fertilized) : 'Never'}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditDateModal({ plantId: plant.id, field: 'last_fertilized', label: 'Last Fertilized', currentDate: plant.last_fertilized }) }}
                            className="p-0.5 hover:bg-gray-700 rounded"
                            title="Edit date"
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

                      {/* Pruning */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-amber-400">
                          <Scissors className="w-4 h-4" />
                          <span>Pruning</span>
                        </div>
                        {plant.prune_frequency && (
                          <p className="text-gray-400">{plant.prune_frequency}</p>
                        )}
                        {plant.prune_months && (
                          <p className="text-gray-500 text-xs">Months: {plant.prune_months}</p>
                        )}
                        <div className="flex items-center gap-1 text-gray-500 text-xs">
                          <span>Last: {plant.last_pruned ? formatDate(plant.last_pruned) : 'Never'}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditDateModal({ plantId: plant.id, field: 'last_pruned', label: 'Last Pruned', currentDate: plant.last_pruned }) }}
                            className="p-0.5 hover:bg-gray-700 rounded"
                            title="Edit date"
                          >
                            <Pencil className="w-3 h-3 text-gray-500 hover:text-amber-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Production & Harvest */}
                  {(plant.produces_months || plant.harvest_frequency || plant.how_to_harvest) && (
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <h4 className="text-sm font-medium text-gray-400 mb-2">Production & Harvest</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        {plant.produces_months && (
                          <div>
                            <span className="text-gray-500">Produces</span>
                            <p className="text-gray-300">{plant.produces_months}</p>
                          </div>
                        )}
                        {plant.harvest_frequency && (
                          <div>
                            <span className="text-gray-500">Harvest Frequency</span>
                            <p className="text-gray-300">{plant.harvest_frequency}</p>
                          </div>
                        )}
                        {plant.how_to_harvest && (
                          <div className="col-span-full">
                            <span className="text-gray-500">How to Harvest</span>
                            <p className="text-gray-300">{plant.how_to_harvest}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Uses & Propagation */}
                  {(plant.uses || plant.propagation_methods) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {plant.uses && (
                        <div>
                          <span className="text-gray-500">Uses</span>
                          <p className="text-gray-300">{plant.uses}</p>
                        </div>
                      )}
                      {plant.propagation_methods && (
                        <div>
                          <span className="text-gray-500">Propagation</span>
                          <p className="text-gray-300">{plant.propagation_methods}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Warnings */}
                  {(plant.known_hazards || plant.special_considerations) && (
                    <div className="bg-red-900/20 border border-red-900/30 rounded-lg p-3">
                      <h4 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Warnings & Considerations
                      </h4>
                      <div className="space-y-2 text-sm">
                        {plant.known_hazards && (
                          <div>
                            <span className="text-red-400">Hazards:</span>
                            <p className="text-gray-300">{plant.known_hazards}</p>
                          </div>
                        )}
                        {plant.special_considerations && (
                          <div>
                            <span className="text-amber-400">Special Considerations:</span>
                            <p className="text-gray-300">{plant.special_considerations}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {plant.notes && (
                    <div className="text-sm">
                      <span className="text-gray-500">Notes</span>
                      <p className="text-gray-300 mt-1">{plant.notes}</p>
                    </div>
                  )}

                  {/* All Tags */}
                  {plant.tags && plant.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {plant.tags.map(tag => (
                        <span key={tag.id} className={`px-2 py-1 rounded-full text-xs ${getTagColor(tag.color)}`}>
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Care Actions */}
                  <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-700">
                    <button
                      onClick={(e) => { e.stopPropagation(); logCare(plant.id, 'watered') }}
                      className="flex items-center gap-1 px-3 py-2 bg-blue-900/50 hover:bg-blue-800/50 rounded-lg text-sm transition-colors"
                    >
                      <Droplets className="w-4 h-4" />
                      Water
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); logCare(plant.id, 'fertilized') }}
                      className="flex items-center gap-1 px-3 py-2 bg-green-900/50 hover:bg-green-800/50 rounded-lg text-sm transition-colors"
                    >
                      <Leaf className="w-4 h-4" />
                      Fertilize
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); logCare(plant.id, 'pruned') }}
                      className="flex items-center gap-1 px-3 py-2 bg-amber-900/50 hover:bg-amber-800/50 rounded-lg text-sm transition-colors"
                    >
                      <Scissors className="w-4 h-4" />
                      Prune
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); logCare(plant.id, 'harvested') }}
                      className="flex items-center gap-1 px-3 py-2 bg-purple-900/50 hover:bg-purple-800/50 rounded-lg text-sm transition-colors"
                    >
                      <Apple className="w-4 h-4" />
                      Harvest
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); logCare(plant.id, 'treated') }}
                      className="flex items-center gap-1 px-3 py-2 bg-red-900/50 hover:bg-red-800/50 rounded-lg text-sm transition-colors"
                    >
                      Treat
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingPlant(plant); setShowForm(true) }}
                      className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Plant Modal */}
      {showForm && (
        <PlantFormModal
          plant={editingPlant}
          tags={tags}
          onClose={() => { setShowForm(false); setEditingPlant(null) }}
          onSave={() => { setShowForm(false); setEditingPlant(null); fetchData() }}
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


// Plant Form Modal Component
function PlantFormModal({ plant, tags, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: plant?.name || '',
    latin_name: plant?.latin_name || '',
    variety: plant?.variety || '',
    description: plant?.description || '',
    location: plant?.location || '',
    source: plant?.source || '',
    grow_zones: plant?.grow_zones || '',
    sun_requirement: plant?.sun_requirement || 'full_sun',
    soil_requirements: plant?.soil_requirements || '',
    plant_spacing: plant?.plant_spacing || '',
    size_full_grown: plant?.size_full_grown || '',
    growth_rate: plant?.growth_rate || 'moderate',
    min_temp: plant?.min_temp || '',
    frost_sensitive: plant?.frost_sensitive || false,
    needs_cover_below_temp: plant?.needs_cover_below_temp || '',
    heat_tolerant: plant?.heat_tolerant ?? true,
    drought_tolerant: plant?.drought_tolerant || false,
    salt_tolerant: plant?.salt_tolerant || false,
    needs_shade_above_temp: plant?.needs_shade_above_temp || '',
    water_schedule: plant?.water_schedule || '',
    fertilize_schedule: plant?.fertilize_schedule || '',
    prune_frequency: plant?.prune_frequency || '',
    prune_months: plant?.prune_months || '',
    produces_months: plant?.produces_months || '',
    harvest_frequency: plant?.harvest_frequency || '',
    how_to_harvest: plant?.how_to_harvest || '',
    uses: plant?.uses || '',
    propagation_methods: plant?.propagation_methods || '',
    known_hazards: plant?.known_hazards || '',
    special_considerations: plant?.special_considerations || '',
    notes: plant?.notes || '',
    tag_ids: plant?.tags?.map(t => t.id) || [],
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

      if (plant) {
        await updatePlant(plant.id, data)
      } else {
        await createPlant(data)
      }
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
      emerald: 'bg-emerald-900/50 text-emerald-300 border-emerald-700',
      amber: 'bg-amber-900/50 text-amber-300 border-amber-700',
      orange: 'bg-orange-900/50 text-orange-300 border-orange-700',
      red: 'bg-red-900/50 text-red-300 border-red-700',
      yellow: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
      pink: 'bg-pink-900/50 text-pink-300 border-pink-700',
      lime: 'bg-lime-900/50 text-lime-300 border-lime-700',
      teal: 'bg-teal-900/50 text-teal-300 border-teal-700',
      rose: 'bg-rose-900/50 text-rose-300 border-rose-700',
      fuchsia: 'bg-fuchsia-900/50 text-fuchsia-300 border-fuchsia-700',
      gray: 'bg-gray-700 text-gray-300 border-gray-600',
    }
    return colors[color] || colors.gray
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-800 p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{plant ? 'Edit Plant' : 'Add New Plant'}</h2>
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
                <label className="block text-sm text-gray-400 mb-1">Source</label>
                <input
                  type="text"
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  placeholder="Where purchased/obtained"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g., North orchard, Row 3"
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

          {/* Growing Requirements */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Growing Requirements</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Grow Zones</label>
                <input
                  type="text"
                  value={formData.grow_zones}
                  onChange={(e) => setFormData({ ...formData, grow_zones: e.target.value })}
                  placeholder="e.g., 9-11"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Sun Requirement</label>
                <select
                  value={formData.sun_requirement}
                  onChange={(e) => setFormData({ ...formData, sun_requirement: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                >
                  <option value="full_sun">Full Sun</option>
                  <option value="partial_sun">Partial Sun</option>
                  <option value="partial_shade">Partial Shade</option>
                  <option value="full_shade">Full Shade</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Growth Rate</label>
                <select
                  value={formData.growth_rate}
                  onChange={(e) => setFormData({ ...formData, growth_rate: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                >
                  <option value="slow">Slow</option>
                  <option value="moderate">Moderate</option>
                  <option value="fast">Fast</option>
                  <option value="very_fast">Very Fast</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Soil Requirements</label>
                <input
                  type="text"
                  value={formData.soil_requirements}
                  onChange={(e) => setFormData({ ...formData, soil_requirements: e.target.value })}
                  placeholder="e.g., Well-drained, acidic"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Plant Spacing</label>
                <input
                  type="text"
                  value={formData.plant_spacing}
                  onChange={(e) => setFormData({ ...formData, plant_spacing: e.target.value })}
                  placeholder="e.g., 15-20 feet apart"
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

          {/* Temperature Tolerances */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Temperature & Tolerance</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Water Schedule</label>
                <input
                  type="text"
                  value={formData.water_schedule}
                  onChange={(e) => setFormData({ ...formData, water_schedule: e.target.value })}
                  placeholder="summer:3,winter:10,spring:5,fall:7"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
                <p className="text-xs text-gray-500 mt-1">Days between watering per season</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Fertilize Schedule</label>
                <input
                  type="text"
                  value={formData.fertilize_schedule}
                  onChange={(e) => setFormData({ ...formData, fertilize_schedule: e.target.value })}
                  placeholder="spring:30,summer:45,fall:60,winter:0"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
                <p className="text-xs text-gray-500 mt-1">Days between fertilizing (0=none)</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Prune Frequency</label>
                <input
                  type="text"
                  value={formData.prune_frequency}
                  onChange={(e) => setFormData({ ...formData, prune_frequency: e.target.value })}
                  placeholder="e.g., Yearly after fruiting"
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

          {/* Production */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Production & Harvest</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Produces Months</label>
                <input
                  type="text"
                  value={formData.produces_months}
                  onChange={(e) => setFormData({ ...formData, produces_months: e.target.value })}
                  placeholder="e.g., Jun-Aug"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Harvest Frequency</label>
                <input
                  type="text"
                  value={formData.harvest_frequency}
                  onChange={(e) => setFormData({ ...formData, harvest_frequency: e.target.value })}
                  placeholder="e.g., Weekly during season"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div className="col-span-2">
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

          {/* Uses & Propagation */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Uses & Propagation</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Uses</label>
                <textarea
                  value={formData.uses}
                  onChange={(e) => setFormData({ ...formData, uses: e.target.value })}
                  placeholder="e.g., Fresh eating, jams, baking"
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Propagation Methods</label>
                <textarea
                  value={formData.propagation_methods}
                  onChange={(e) => setFormData({ ...formData, propagation_methods: e.target.value })}
                  placeholder="e.g., Cuttings, grafting, seed"
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
            </div>
          </div>

          {/* Warnings */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Warnings & Special Considerations</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Known Hazards</label>
                <textarea
                  value={formData.known_hazards}
                  onChange={(e) => setFormData({ ...formData, known_hazards: e.target.value })}
                  placeholder="e.g., Thorns, toxic to pets"
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Special Considerations</label>
                <textarea
                  value={formData.special_considerations}
                  onChange={(e) => setFormData({ ...formData, special_considerations: e.target.value })}
                  placeholder="e.g., Needs hand pollination"
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
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
              {saving ? 'Saving...' : (plant ? 'Update Plant' : 'Add Plant')}
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
      // Convert to ISO datetime string
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
