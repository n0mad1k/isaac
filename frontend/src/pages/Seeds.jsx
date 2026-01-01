import React, { useState, useEffect } from 'react'
import { Plus, Search, Sprout, Sun, Droplets, ChevronDown, ChevronUp, Leaf, Thermometer, MapPin } from 'lucide-react'
import { getSeeds, createSeed, updateSeed, deleteSeed, getSeedStats, getSeedCategories } from '../services/api'

function Seeds() {
  const [seeds, setSeeds] = useState([])
  const [stats, setStats] = useState(null)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingSeed, setEditingSeed] = useState(null)
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

  const getSunLabel = (req) => {
    const labels = {
      full_sun: 'Full Sun',
      partial_sun: 'Partial Sun',
      partial_shade: 'Partial Shade',
      full_shade: 'Full Shade',
    }
    return labels[req] || req
  }

  const getWaterLabel = (req) => {
    const labels = {
      low: 'Low',
      moderate: 'Moderate',
      high: 'High',
    }
    return labels[req] || req
  }

  const handleSubmit = async (e) => {
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
      if (editingSeed) {
        await updateSeed(editingSeed.id, data)
      } else {
        await createSeed(data)
      }
      setShowForm(false)
      setEditingSeed(null)
      fetchSeeds()
      fetchStats()
    } catch (error) {
      console.error('Failed to save seed:', error)
      alert('Failed to save seed. It may already exist.')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Remove this seed from the catalog?')) return
    try {
      await deleteSeed(id)
      fetchSeeds()
      fetchStats()
    } catch (error) {
      console.error('Failed to delete seed:', error)
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sprout className="w-7 h-7 text-green-500" />
          Seed Catalog
        </h1>
        <button
          onClick={() => { setEditingSeed(null); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-farm-green hover:bg-farm-green-light rounded-lg transition-colors"
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
            <div
              key={seed.id}
              className="bg-gray-800 rounded-xl overflow-hidden"
            >
              {/* Main row - clickable header */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-750"
                onClick={() => setExpandedSeed(expandedSeed === seed.id ? null : seed.id)}
              >
                {/* Top row: Name, Category, Perennial/Annual */}
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
                  {expandedSeed === seed.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>

                {/* Brief description */}
                {seed.description && (
                  <p className="text-sm text-gray-400 mt-1 line-clamp-2">{seed.description}</p>
                )}

                {/* Tags row */}
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
                    <span className="px-2 py-0.5 bg-yellow-900/30 text-yellow-300 rounded text-xs">
                      ⚠️ {seed.special_requirements}
                    </span>
                  )}
                  {seed.grow_zones && (
                    <span className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs">
                      Zones {seed.grow_zones}
                    </span>
                  )}
                </div>
              </div>

              {/* Expanded details */}
              {expandedSeed === seed.id && (
                <div className="px-4 pb-4 border-t border-gray-700 pt-4 space-y-4">
                  {/* Description */}
                  {seed.description && (
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <p className="text-gray-300">{seed.description}</p>
                    </div>
                  )}

                  {/* Germination & Growth Info */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-gray-900/30 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">Germination</div>
                      <div className="text-sm font-medium">{seed.days_to_germination || 'N/A'}</div>
                    </div>
                    <div className="bg-gray-900/30 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">Days to Maturity</div>
                      <div className="text-sm font-medium">{seed.days_to_maturity || 'N/A'}</div>
                    </div>
                    <div className="bg-gray-900/30 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">Optimal Germ Temp</div>
                      <div className="text-sm font-medium">{seed.optimal_germ_temp || 'N/A'}</div>
                    </div>
                    <div className="bg-gray-900/30 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">Grow Zones</div>
                      <div className="text-sm font-medium">{seed.grow_zones || 'N/A'}</div>
                    </div>
                  </div>

                  {/* Planting Requirements */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Planting Requirements</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-gray-900/30 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Sow Depth</div>
                        <div className="text-sm font-medium">{seed.planting_depth || 'N/A'}</div>
                      </div>
                      <div className="bg-gray-900/30 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Plant Spacing</div>
                        <div className="text-sm font-medium">{seed.spacing || 'N/A'}</div>
                      </div>
                      <div className="bg-gray-900/30 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Light to Germinate</div>
                        <div className="text-sm font-medium">{seed.light_to_germinate || 'N/A'}</div>
                      </div>
                      <div className="bg-gray-900/30 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Soil Type</div>
                        <div className="text-sm font-medium">{seed.soil_type || 'N/A'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Growing Conditions */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Growing Conditions</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-gray-900/30 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Sun Requirement</div>
                        <div className="text-sm font-medium">{getSunLabel(seed.sun_requirement)}</div>
                      </div>
                      <div className="bg-gray-900/30 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Water Needs</div>
                        <div className="text-sm font-medium">{getWaterLabel(seed.water_requirement)}</div>
                      </div>
                      <div className="bg-gray-900/30 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">pH Range</div>
                        <div className="text-sm font-medium">{seed.ph_range || 'N/A'}</div>
                      </div>
                      <div className="bg-gray-900/30 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Size (H x W)</div>
                        <div className="text-sm font-medium">
                          {seed.height || '?'} x {seed.spread || '?'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sowing & Harvest Calendar */}
                  {(seed.sow_months || seed.harvest_months) && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-2">Sowing & Harvest Calendar</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {seed.sow_months && (
                          <div className="bg-blue-900/20 rounded-lg p-3">
                            <div className="text-xs text-blue-400 mb-1">When to Sow</div>
                            <div className="text-sm font-medium text-blue-300">{seed.sow_months}</div>
                          </div>
                        )}
                        {seed.harvest_months && (
                          <div className="bg-green-900/20 rounded-lg p-3">
                            <div className="text-xs text-green-400 mb-1">Harvest Time</div>
                            <div className="text-sm font-medium text-green-300">{seed.harvest_months}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Florida Zone 9b Planting Windows */}
                  {(seed.spring_planting || seed.fall_planting) && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-2">Zone 9b Planting Windows</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {seed.spring_planting && (
                          <div className="bg-emerald-900/20 rounded-lg p-3">
                            <div className="text-xs text-emerald-400 mb-1">Spring Planting</div>
                            <div className="text-sm font-medium text-emerald-300">{seed.spring_planting}</div>
                          </div>
                        )}
                        {seed.fall_planting && (
                          <div className="bg-amber-900/20 rounded-lg p-3">
                            <div className="text-xs text-amber-400 mb-1">Fall Planting</div>
                            <div className="text-sm font-medium text-amber-300">{seed.fall_planting}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Characteristics Flags */}
                  <div className="flex flex-wrap gap-2">
                    {seed.direct_sow && <span className="px-2 py-1 bg-green-900/30 text-green-300 rounded text-xs">Direct Sow</span>}
                    {seed.frost_sensitive && <span className="px-2 py-1 bg-blue-900/30 text-blue-300 rounded text-xs">Frost Sensitive</span>}
                    {seed.heat_tolerant && <span className="px-2 py-1 bg-orange-900/30 text-orange-300 rounded text-xs">Heat Tolerant</span>}
                    {seed.drought_tolerant && <span className="px-2 py-1 bg-yellow-900/30 text-yellow-300 rounded text-xs">Drought Tolerant</span>}
                    {seed.attracts_pollinators && <span className="px-2 py-1 bg-pink-900/30 text-pink-300 rounded text-xs">Pollinators</span>}
                    {seed.culinary_use && <span className="px-2 py-1 bg-amber-900/30 text-amber-300 rounded text-xs">Culinary</span>}
                    {seed.medicinal_use && <span className="px-2 py-1 bg-purple-900/30 text-purple-300 rounded text-xs">Medicinal</span>}
                    {seed.ornamental_use && <span className="px-2 py-1 bg-pink-900/30 text-pink-300 rounded text-xs">Ornamental</span>}
                  </div>

                  {/* Notes Sections */}
                  {(seed.growing_notes || seed.harvest_notes || seed.medicinal_notes || seed.notes) && (
                    <div className="space-y-3 text-sm border-t border-gray-700 pt-4">
                      {seed.growing_notes && (
                        <div>
                          <span className="text-gray-400 font-medium">Growing Notes:</span>
                          <p className="mt-1 text-gray-300">{seed.growing_notes}</p>
                        </div>
                      )}
                      {seed.harvest_notes && (
                        <div>
                          <span className="text-gray-400 font-medium">Harvest Notes:</span>
                          <p className="mt-1 text-gray-300">{seed.harvest_notes}</p>
                        </div>
                      )}
                      {seed.medicinal_notes && (
                        <div>
                          <span className="text-gray-400 font-medium">Medicinal Uses:</span>
                          <p className="mt-1 text-gray-300">{seed.medicinal_notes}</p>
                        </div>
                      )}
                      {seed.notes && (
                        <div>
                          <span className="text-gray-400 font-medium">Notes:</span>
                          <p className="mt-1 text-gray-300">{seed.notes}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-gray-700">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingSeed(seed); setShowForm(true) }}
                      className="px-3 py-2 bg-blue-900/50 hover:bg-blue-800/50 rounded text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(seed.id) }}
                      className="px-3 py-2 bg-red-900/50 hover:bg-red-800/50 rounded text-sm"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Seed Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">
              {editingSeed ? 'Edit Seed' : 'Add New Seed'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Name *</label>
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={editingSeed?.name || ''}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Latin Name</label>
                  <input
                    type="text"
                    name="latin_name"
                    defaultValue={editingSeed?.latin_name || ''}
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
                    defaultValue={editingSeed?.category || 'other'}
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
                    defaultValue={editingSeed?.variety || ''}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Grow Zones</label>
                  <input
                    type="text"
                    name="grow_zones"
                    placeholder="e.g., 8-11"
                    defaultValue={editingSeed?.grow_zones || ''}
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
                  defaultValue={editingSeed?.description || ''}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>

              {/* Germination & Growth */}
              <h3 className="text-lg font-medium pt-2 border-t border-gray-700">Germination & Growth</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Germination Days</label>
                  <input
                    type="text"
                    name="days_to_germination"
                    placeholder="e.g., 7-14 days"
                    defaultValue={editingSeed?.days_to_germination || ''}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Days to Maturity</label>
                  <input
                    type="text"
                    name="days_to_maturity"
                    placeholder="e.g., 60-90 days"
                    defaultValue={editingSeed?.days_to_maturity || ''}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Optimal Germ Temp</label>
                  <input
                    type="text"
                    name="optimal_germ_temp"
                    placeholder="e.g., 70-85F"
                    defaultValue={editingSeed?.optimal_germ_temp || ''}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Light to Germinate</label>
                  <input
                    type="text"
                    name="light_to_germinate"
                    placeholder="e.g., Light required"
                    defaultValue={editingSeed?.light_to_germinate || ''}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Special Requirements</label>
                <input
                  type="text"
                  name="special_requirements"
                  placeholder="e.g., Scarification, Cold stratification 30 days, Soak 24hrs"
                  defaultValue={editingSeed?.special_requirements || ''}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>

              {/* Planting Requirements */}
              <h3 className="text-lg font-medium pt-2 border-t border-gray-700">Planting Requirements</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Sow Depth</label>
                  <input
                    type="text"
                    name="planting_depth"
                    placeholder="e.g., 1/4 inch"
                    defaultValue={editingSeed?.planting_depth || ''}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Plant Spacing</label>
                  <input
                    type="text"
                    name="spacing"
                    placeholder="e.g., 12 inches"
                    defaultValue={editingSeed?.spacing || ''}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Soil Type</label>
                  <input
                    type="text"
                    name="soil_type"
                    placeholder="e.g., Well-drained"
                    defaultValue={editingSeed?.soil_type || ''}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">pH Range</label>
                  <input
                    type="text"
                    name="ph_range"
                    placeholder="e.g., 6.0-7.0"
                    defaultValue={editingSeed?.ph_range || ''}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
              </div>

              {/* Growing Conditions */}
              <h3 className="text-lg font-medium pt-2 border-t border-gray-700">Growing Conditions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Sun</label>
                  <select
                    name="sun_requirement"
                    defaultValue={editingSeed?.sun_requirement || 'full_sun'}
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
                    defaultValue={editingSeed?.water_requirement || 'moderate'}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  >
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Height</label>
                  <input
                    type="text"
                    name="height"
                    placeholder="e.g., 24-36 in"
                    defaultValue={editingSeed?.height || ''}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Spread</label>
                  <input
                    type="text"
                    name="spread"
                    placeholder="e.g., 12-18 in"
                    defaultValue={editingSeed?.spread || ''}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
              </div>

              {/* Sowing & Harvest Calendar */}
              <h3 className="text-lg font-medium pt-2 border-t border-gray-700">Sowing & Harvest</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">When to Sow</label>
                  <input
                    type="text"
                    name="sow_months"
                    placeholder="e.g., Jan-Mar, Sep-Nov"
                    defaultValue={editingSeed?.sow_months || ''}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Harvest Time</label>
                  <input
                    type="text"
                    name="harvest_months"
                    placeholder="e.g., Apr-Jun, Nov-Dec"
                    defaultValue={editingSeed?.harvest_months || ''}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
              </div>

              {/* Zone 9b Planting Windows */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Spring Planting (9b)</label>
                  <input
                    type="text"
                    name="spring_planting"
                    placeholder="e.g., Feb-Apr"
                    defaultValue={editingSeed?.spring_planting || ''}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Fall Planting (9b)</label>
                  <input
                    type="text"
                    name="fall_planting"
                    placeholder="e.g., Sep-Nov"
                    defaultValue={editingSeed?.fall_planting || ''}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
              </div>

              {/* Flags */}
              <h3 className="text-lg font-medium pt-2 border-t border-gray-700">Characteristics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="is_perennial" defaultChecked={editingSeed?.is_perennial ?? false} className="w-4 h-4" />
                  <span className="text-sm">Perennial</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="direct_sow" defaultChecked={editingSeed?.direct_sow ?? true} className="w-4 h-4" />
                  <span className="text-sm">Direct Sow</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="frost_sensitive" defaultChecked={editingSeed?.frost_sensitive ?? true} className="w-4 h-4" />
                  <span className="text-sm">Frost Sensitive</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="heat_tolerant" defaultChecked={editingSeed?.heat_tolerant ?? true} className="w-4 h-4" />
                  <span className="text-sm">Heat Tolerant</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="drought_tolerant" defaultChecked={editingSeed?.drought_tolerant ?? false} className="w-4 h-4" />
                  <span className="text-sm">Drought Tolerant</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="is_native" defaultChecked={editingSeed?.is_native ?? false} className="w-4 h-4" />
                  <span className="text-sm">Native Florida</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="attracts_pollinators" defaultChecked={editingSeed?.attracts_pollinators ?? false} className="w-4 h-4" />
                  <span className="text-sm">Attracts Pollinators</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="medicinal_use" defaultChecked={editingSeed?.medicinal_use ?? false} className="w-4 h-4" />
                  <span className="text-sm">Medicinal Use</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="culinary_use" defaultChecked={editingSeed?.culinary_use ?? false} className="w-4 h-4" />
                  <span className="text-sm">Culinary Use</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="ornamental_use" defaultChecked={editingSeed?.ornamental_use ?? false} className="w-4 h-4" />
                  <span className="text-sm">Ornamental Use</span>
                </label>
              </div>

              {/* Notes */}
              <h3 className="text-lg font-medium pt-2 border-t border-gray-700">Notes</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Growing Notes</label>
                  <textarea
                    name="growing_notes"
                    rows={2}
                    defaultValue={editingSeed?.growing_notes || ''}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Harvest Notes</label>
                  <textarea
                    name="harvest_notes"
                    rows={2}
                    defaultValue={editingSeed?.harvest_notes || ''}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Medicinal Notes</label>
                <textarea
                  name="medicinal_notes"
                  rows={2}
                  defaultValue={editingSeed?.medicinal_notes || ''}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-700">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingSeed(null) }}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light rounded-lg transition-colors"
                >
                  {editingSeed ? 'Save Changes' : 'Add Seed'}
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
