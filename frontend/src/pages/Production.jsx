import React, { useState, useEffect } from 'react'
import {
  Package,
  Beef,
  Apple,
  Calendar,
  DollarSign,
  Scale,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import {
  getProductionStats,
  getLivestockProductions,
  getPlantHarvests,
  deleteLivestockProduction,
  deletePlantHarvest,
} from '../services/api'
import { format } from 'date-fns'

function Production() {
  const [stats, setStats] = useState(null)
  const [livestock, setLivestock] = useState([])
  const [harvests, setHarvests] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('all')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [statsRes, livestockRes, harvestsRes] = await Promise.all([
        getProductionStats(selectedYear),
        getLivestockProductions({ year: selectedYear }),
        getPlantHarvests({ year: selectedYear }),
      ])
      setStats(statsRes.data)
      setLivestock(livestockRes.data)
      setHarvests(harvestsRes.data)
    } catch (error) {
      console.error('Failed to fetch production data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedYear])

  const handleDeleteLivestock = async (id, name) => {
    if (confirm(`Delete production record for "${name}"? This cannot be undone.`)) {
      try {
        await deleteLivestockProduction(id)
        fetchData()
      } catch (error) {
        console.error('Failed to delete:', error)
      }
    }
  }

  const handleDeleteHarvest = async (id, name) => {
    if (confirm(`Delete harvest record for "${name}"? This cannot be undone.`)) {
      try {
        await deletePlantHarvest(id)
        fetchData()
      } catch (error) {
        console.error('Failed to delete:', error)
      }
    }
  }

  const formatAnimalType = (type) => {
    if (!type) return ''
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  const formatQuality = (quality) => {
    const colors = {
      excellent: 'bg-green-600 text-white',
      good: 'bg-blue-600 text-white',
      fair: 'bg-yellow-600 text-black',
      poor: 'bg-red-600 text-white',
    }
    return colors[quality] || 'bg-gray-600 text-white'
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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Package className="w-7 h-7 text-orange-500" />
          Farm Production
        </h1>
        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <Beef className="w-4 h-4" />
              <span className="text-sm">Livestock Processed</span>
            </div>
            <div className="text-2xl font-bold">{stats.livestock.total_processed}</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <Scale className="w-4 h-4" />
              <span className="text-sm">Total Meat (lbs)</span>
            </div>
            <div className="text-2xl font-bold">{stats.livestock.total_meat_lbs?.toFixed(1) || 0}</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm">Avg Cost/lb</span>
            </div>
            <div className="text-2xl font-bold">
              ${stats.livestock.avg_cost_per_pound?.toFixed(2) || '0.00'}
            </div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <Apple className="w-4 h-4" />
              <span className="text-sm">Total Harvests</span>
            </div>
            <div className="text-2xl font-bold">{stats.harvests.total_harvests}</div>
          </div>
        </div>
      )}

      {/* Harvest Summary by Unit */}
      {stats && Object.keys(stats.harvests.by_unit || {}).length > 0 && (
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Harvest Totals</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.harvests.by_unit).map(([unit, qty]) => (
              <div key={unit} className="bg-gray-700 rounded-lg px-3 py-2">
                <span className="text-lg font-bold text-green-400">{qty.toFixed(1)}</span>
                <span className="text-gray-400 ml-1">{unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: 'All Records', icon: Package },
          { key: 'livestock', label: 'Livestock', icon: Beef },
          { key: 'harvests', label: 'Harvests', icon: Apple },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              view === tab.key
                ? 'bg-farm-green text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Livestock Records */}
      {(view === 'all' || view === 'livestock') && livestock.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Beef className="w-5 h-5 text-red-400" />
            Livestock Processing
          </h2>
          {livestock.map((record) => (
            <div
              key={record.id}
              className="bg-gray-800 rounded-lg p-4 border-l-4 border-red-500"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-lg">{record.animal_name}</h3>
                    <span className="text-sm text-gray-400">
                      {formatAnimalType(record.animal_type)}
                    </span>
                    {record.breed && (
                      <span className="text-sm text-gray-500">• {record.breed}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 mt-2 text-sm">
                    {record.slaughter_date && (
                      <span className="flex items-center gap-1 text-gray-400">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(record.slaughter_date), 'MMM d, yyyy')}
                      </span>
                    )}
                    {record.processor && (
                      <span className="text-gray-400">
                        Processor: {record.processor}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 mt-2 text-sm">
                    {record.live_weight && (
                      <span className="text-gray-400">
                        Live: <span className="text-white">{record.live_weight} lbs</span>
                      </span>
                    )}
                    {record.hanging_weight && (
                      <span className="text-gray-400">
                        Hanging: <span className="text-white">{record.hanging_weight} lbs</span>
                      </span>
                    )}
                    {record.final_weight && (
                      <span className="text-gray-400">
                        Final: <span className="text-green-400 font-medium">{record.final_weight} lbs</span>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 mt-2 text-sm">
                    {record.total_expenses > 0 && (
                      <span className="text-gray-400">
                        Expenses: <span className="text-yellow-400">${record.total_expenses.toFixed(2)}</span>
                      </span>
                    )}
                    {record.processing_cost > 0 && (
                      <span className="text-gray-400">
                        Processing: <span className="text-yellow-400">${record.processing_cost.toFixed(2)}</span>
                      </span>
                    )}
                    {record.cost_per_pound > 0 && (
                      <span className="text-gray-400">
                        Cost/lb: <span className="text-cyan-400 font-medium">${record.cost_per_pound.toFixed(2)}</span>
                      </span>
                    )}
                  </div>
                  {record.notes && (
                    <p className="text-sm text-gray-500 mt-2">{record.notes}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteLivestock(record.id, record.animal_name)}
                  className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Plant Harvest Records */}
      {(view === 'all' || view === 'harvests') && harvests.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Apple className="w-5 h-5 text-green-400" />
            Plant Harvests
          </h2>
          {harvests.map((record) => (
            <div
              key={record.id}
              className="bg-gray-800 rounded-lg p-4 border-l-4 border-green-500"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{record.plant_name}</h3>
                    {record.plant_variety && (
                      <span className="text-sm text-gray-400">({record.plant_variety})</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded ${formatQuality(record.quality)}`}>
                      {record.quality}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span className="text-green-400 font-medium text-lg">
                      {record.quantity} {record.unit}
                    </span>
                    {record.harvest_date && (
                      <span className="flex items-center gap-1 text-gray-400">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(record.harvest_date), 'MMM d, yyyy')}
                      </span>
                    )}
                  </div>
                  {record.notes && (
                    <p className="text-sm text-gray-500 mt-2">{record.notes}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteHarvest(record.id, record.plant_name)}
                  className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {livestock.length === 0 && harvests.length === 0 && (
        <div className="text-center py-12 text-gray-500 bg-gray-800 rounded-xl">
          <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="mb-2">No production records for {selectedYear}</p>
          <p className="text-sm">
            Archive livestock from the Animals page or record harvests from the Plants page
          </p>
        </div>
      )}
    </div>
  )
}

export default Production
