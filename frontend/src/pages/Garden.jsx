import React, { useState, useEffect, useCallback } from 'react'
import { Leaf, Sprout, LayoutDashboard, Calendar, Droplets, Sun, Snowflake, Pencil, X, Plus, Check, ChevronRight, AlertTriangle } from 'lucide-react'
import Plants from './Plants'
import Seeds from './Seeds'
import { getGardenOverview, getPlantingSchedule, getFrostDates, updateFrostDates, getPlantingEvents, createPlantingEvent, deletePlantingEvent, completePlantingEvent, getSeeds } from '../services/api'
import { useSettings } from '../contexts/SettingsContext'

const ACTIVITY_COLORS = {
  start_indoors: { bg: 'bg-blue-900/40', border: 'border-blue-500', text: 'text-blue-300', label: 'Start Indoors' },
  direct_sow: { bg: 'bg-green-900/40', border: 'border-green-500', text: 'text-green-300', label: 'Direct Sow' },
  transplant: { bg: 'bg-yellow-900/40', border: 'border-yellow-500', text: 'text-yellow-300', label: 'Transplant' },
  harvest: { bg: 'bg-orange-900/40', border: 'border-orange-500', text: 'text-orange-300', label: 'Harvest' },
  other: { bg: 'bg-gray-800/40', border: 'border-gray-500', text: 'text-gray-300', label: 'Other' },
}

const STAGE_COLORS = {
  seed: 'bg-blue-600',
  seedling: 'bg-emerald-600',
  transplanted: 'bg-yellow-600',
  vegetative: 'bg-green-600',
  flowering: 'bg-pink-600',
  fruiting: 'bg-orange-600',
  harvesting: 'bg-red-600',
  dormant: 'bg-gray-600',
}

// ============================================
// Overview Tab
// ============================================
function OverviewTab({ onSwitchTab }) {
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const { formatDate } = useSettings()

  useEffect(() => {
    loadOverview()
  }, [])

  const loadOverview = async () => {
    try {
      const res = await getGardenOverview()
      setOverview(res.data)
    } catch (err) {
      console.error('Failed to load garden overview:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400"></div>
      </div>
    )
  }

  if (!overview) {
    return <div className="text-gray-400 text-center py-12">Failed to load garden overview</div>
  }

  const { this_month, needs_attention, stats, active_lifecycle, recent_care, frost_dates } = overview
  const hasActivities = this_month && Object.values(this_month.activities || {}).some(a => a.length > 0)
  const hasAttention = needs_attention && (
    needs_attention.needs_water?.length > 0 ||
    needs_attention.needs_fertilizer?.length > 0 ||
    needs_attention.overdue_events?.length > 0
  )

  return (
    <div className="space-y-4">
      {/* Frost Dates Banner */}
      {frost_dates && (
        <div className="flex items-center gap-4 bg-gray-800/50 rounded-lg px-4 py-2 text-sm text-gray-300">
          <Snowflake className="w-4 h-4 text-blue-400" />
          <span>Last Frost: <span className="text-white font-medium">{frost_dates.last_frost_date}</span></span>
          <span className="text-gray-600">|</span>
          <span>First Frost: <span className="text-white font-medium">{frost_dates.first_frost_date}</span></span>
          {stats?.growing_season && (
            <>
              <span className="text-gray-600">|</span>
              <span>Season: <span className="text-green-400 font-medium">{stats.growing_season.progress_pct}%</span></span>
            </>
          )}
        </div>
      )}

      {/* This Month's Activities */}
      <div className="bg-gray-800/30 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">{this_month?.name || 'This Month'}</h3>
          <button onClick={() => onSwitchTab('planner')} className="text-sm text-green-400 hover:text-green-300 flex items-center gap-1">
            View Full Calendar <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {hasActivities ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(this_month.activities).map(([type, items]) => {
              if (items.length === 0) return null
              const colors = ACTIVITY_COLORS[type] || ACTIVITY_COLORS.other
              return (
                <div key={type} className={`${colors.bg} border ${colors.border} rounded-lg p-3`}>
                  <div className={`text-xs font-semibold ${colors.text} mb-2`}>{colors.label}</div>
                  {items.map((item, i) => (
                    <div key={i} className="text-sm text-gray-200 mb-1">{item.name}</div>
                  ))}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No planting activities this month</p>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Needs Attention */}
        <div className="bg-gray-800/30 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            Needs Attention
          </h3>
          {hasAttention ? (
            <div className="space-y-2">
              {needs_attention.needs_water?.map((p, i) => (
                <div key={`w-${i}`} className="flex items-center gap-2 text-sm">
                  <Droplets className="w-4 h-4 text-blue-400" />
                  <span className="text-gray-200">{p.name}</span>
                  {p.days_overdue > 0 && <span className="text-red-400 text-xs">({p.days_overdue}d overdue)</span>}
                </div>
              ))}
              {needs_attention.needs_fertilizer?.map((p, i) => (
                <div key={`f-${i}`} className="flex items-center gap-2 text-sm">
                  <Sun className="w-4 h-4 text-yellow-400" />
                  <span className="text-gray-200">{p.name}</span>
                  <span className="text-yellow-400 text-xs">(needs fertilizer)</span>
                </div>
              ))}
              {needs_attention.overdue_events?.map((e, i) => (
                <div key={`e-${i}`} className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-red-400" />
                  <span className="text-gray-200">{e.seed_name} - {ACTIVITY_COLORS[e.activity_type]?.label || e.activity_type}</span>
                  <span className="text-red-400 text-xs">({e.days_overdue}d overdue)</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Everything looks good!</p>
          )}
        </div>

        {/* Quick Stats */}
        <div className="bg-gray-800/30 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">Quick Stats</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-700/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-400">{stats?.total_plants || 0}</div>
              <div className="text-xs text-gray-400">Active Plants</div>
            </div>
            <div className="bg-gray-700/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-emerald-400">{stats?.total_seeds || 0}</div>
              <div className="text-xs text-gray-400">Seed Varieties</div>
            </div>
          </div>
          {/* Growth Stage Breakdown */}
          {stats?.stages && Object.keys(stats.stages).length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-gray-400 mb-2">By Growth Stage</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.stages).map(([stage, count]) => (
                  <span key={stage} className={`${STAGE_COLORS[stage] || 'bg-gray-600'} text-white text-xs px-2 py-1 rounded-full`}>
                    {stage}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}
          {/* Growing Season Progress */}
          {stats?.growing_season && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Growing Season</span>
                <span>{stats.growing_season.progress_pct}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${stats.growing_season.progress_pct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{stats.growing_season.days_since_last_frost}d since last frost</span>
                <span>{stats.growing_season.days_until_first_frost}d until first frost</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active Lifecycle */}
      {active_lifecycle && active_lifecycle.length > 0 && (
        <div className="bg-gray-800/30 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">Active Lifecycle</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {active_lifecycle.map((p) => (
              <div key={p.id} className="flex items-center gap-3 bg-gray-700/30 rounded-lg p-2">
                <span className={`${STAGE_COLORS[p.growth_stage] || 'bg-gray-600'} text-white text-xs px-2 py-0.5 rounded-full`}>
                  {p.growth_stage}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-200 truncate">{p.name}</div>
                  {p.seed_name && <div className="text-xs text-gray-500">from: {p.seed_name}</div>}
                </div>
                <div className="text-xs text-gray-500">{p.days_in_stage}d</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {recent_care && recent_care.length > 0 && (
        <div className="bg-gray-800/30 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">Recent Activity</h3>
          <div className="space-y-2">
            {recent_care.map((log, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="text-gray-500 text-xs w-24">
                  {log.performed_at ? formatDate(log.performed_at) : ''}
                </span>
                <span className="text-gray-200">{log.plant_name}</span>
                <span className="text-gray-400">-</span>
                <span className="text-green-400">{log.care_type}</span>
                {log.quantity && <span className="text-gray-500">({log.quantity})</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// Planner Tab
// ============================================
function PlannerTab() {
  const [schedule, setSchedule] = useState(null)
  const [events, setEvents] = useState([])
  const [frostDates, setFrostDates] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editingFrost, setEditingFrost] = useState(false)
  const [frostForm, setFrostForm] = useState({ last_frost_date: '', first_frost_date: '' })
  const [showAddEvent, setShowAddEvent] = useState(null) // month number to add to
  const [seedList, setSeedList] = useState([])
  const [eventForm, setEventForm] = useState({ seed_id: '', activity_type: 'direct_sow', start_date: '', notes: '' })

  const currentMonth = new Date().getMonth() + 1

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [scheduleRes, frostRes, eventsRes] = await Promise.all([
        getPlantingSchedule(),
        getFrostDates(),
        getPlantingEvents(),
      ])
      setSchedule(scheduleRes.data)
      setFrostDates(frostRes.data)
      setFrostForm({ last_frost_date: frostRes.data.last_frost_date, first_frost_date: frostRes.data.first_frost_date })
      setEvents(eventsRes.data)
    } catch (err) {
      console.error('Failed to load planting schedule:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveFrost = async () => {
    try {
      await updateFrostDates(frostForm)
      setEditingFrost(false)
      loadData()
    } catch (err) {
      console.error('Failed to update frost dates:', err)
    }
  }

  const handleAddEvent = async () => {
    if (!eventForm.seed_id || !eventForm.start_date) return
    try {
      await createPlantingEvent(eventForm)
      setShowAddEvent(null)
      setEventForm({ seed_id: '', activity_type: 'direct_sow', start_date: '', notes: '' })
      loadData()
    } catch (err) {
      console.error('Failed to create event:', err)
    }
  }

  const handleDeleteEvent = async (id) => {
    try {
      await deletePlantingEvent(id)
      loadData()
    } catch (err) {
      console.error('Failed to delete event:', err)
    }
  }

  const handleCompleteEvent = async (id) => {
    try {
      await completePlantingEvent(id)
      loadData()
    } catch (err) {
      console.error('Failed to complete event:', err)
    }
  }

  const openAddEvent = async (month) => {
    setShowAddEvent(month)
    if (seedList.length === 0) {
      try {
        const res = await getSeeds()
        setSeedList(res.data)
      } catch (err) {
        console.error('Failed to load seeds:', err)
      }
    }
    const year = new Date().getFullYear()
    const monthStr = String(month).padStart(2, '0')
    setEventForm({ ...eventForm, start_date: `${year}-${monthStr}-01` })
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400"></div>
      </div>
    )
  }

  // Determine frost months (before last frost or after first frost)
  const lastFrostMonth = frostDates ? parseInt(frostDates.last_frost_date.split('/')[0]) : 2
  const firstFrostMonth = frostDates ? parseInt(frostDates.first_frost_date.split('/')[0]) : 12

  return (
    <div className="space-y-4">
      {/* Frost Date Banner */}
      <div className="bg-gray-800/50 rounded-lg px-4 py-3 flex items-center justify-between">
        {editingFrost ? (
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm text-gray-300">
              Last Frost:
              <input
                type="text"
                value={frostForm.last_frost_date}
                onChange={(e) => setFrostForm({ ...frostForm, last_frost_date: e.target.value })}
                className="ml-2 w-20 bg-gray-700 text-white px-2 py-1 rounded text-sm"
                placeholder="MM/DD"
              />
            </label>
            <label className="text-sm text-gray-300">
              First Frost:
              <input
                type="text"
                value={frostForm.first_frost_date}
                onChange={(e) => setFrostForm({ ...frostForm, first_frost_date: e.target.value })}
                className="ml-2 w-20 bg-gray-700 text-white px-2 py-1 rounded text-sm"
                placeholder="MM/DD"
              />
            </label>
            <button onClick={handleSaveFrost} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm">Save</button>
            <button onClick={() => setEditingFrost(false)} className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm">Cancel</button>
          </div>
        ) : (
          <div className="flex items-center gap-4 text-sm text-gray-300">
            <Snowflake className="w-4 h-4 text-blue-400" />
            <span>Last Frost: <span className="text-white font-medium">{frostDates?.last_frost_date || '02/15'}</span></span>
            <span className="text-gray-600">|</span>
            <span>First Frost: <span className="text-white font-medium">{frostDates?.first_frost_date || '12/15'}</span></span>
            <span className="text-gray-600">|</span>
            <span>Zone: <span className="text-white font-medium">{frostDates?.usda_zone || '9b'}</span></span>
          </div>
        )}
        {!editingFrost && (
          <button onClick={() => setEditingFrost(true)} className="text-gray-400 hover:text-white">
            <Pencil className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Month Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {schedule?.months?.map((month) => {
          const isFrostMonth = month.month <= lastFrostMonth || month.month >= firstFrostMonth
          const isCurrent = month.month === currentMonth
          const monthEvents = events.filter(e => {
            const eventMonth = new Date(e.start_date).getMonth() + 1
            return eventMonth === month.month
          })
          const hasContent = Object.values(month.activities).some(a => a.length > 0) || monthEvents.length > 0

          return (
            <div
              key={month.month}
              className={`bg-gray-800/40 rounded-lg overflow-hidden border ${
                isCurrent ? 'border-green-500 ring-1 ring-green-500/30' : isFrostMonth ? 'border-blue-800/50' : 'border-gray-700/50'
              }`}
            >
              {/* Month Header */}
              <div className={`px-3 py-2 flex items-center justify-between ${isFrostMonth ? 'bg-blue-900/30' : 'bg-green-900/20'}`}>
                <span className={`font-semibold text-sm ${isCurrent ? 'text-green-400' : 'text-gray-200'}`}>
                  {month.name}
                </span>
                <button
                  onClick={() => openAddEvent(month.month)}
                  className="text-gray-500 hover:text-green-400 transition-colors"
                  title="Add planting event"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Activities */}
              <div className="p-3 space-y-2 min-h-[60px]">
                {hasContent ? (
                  <>
                    {Object.entries(month.activities).map(([type, items]) => {
                      if (items.length === 0) return null
                      const colors = ACTIVITY_COLORS[type] || ACTIVITY_COLORS.other
                      return (
                        <div key={type}>
                          <div className={`text-xs font-semibold ${colors.text} mb-1`}>{colors.label}</div>
                          {items.map((item, i) => (
                            <div key={i} className={`text-xs text-gray-300 pl-2 border-l-2 ${colors.border} mb-1`}>
                              {item.name}
                            </div>
                          ))}
                        </div>
                      )
                    })}

                    {/* User Events */}
                    {monthEvents.map((evt) => {
                      const colors = ACTIVITY_COLORS[evt.activity_type] || ACTIVITY_COLORS.other
                      return (
                        <div key={evt.id} className={`${colors.bg} border ${colors.border} rounded p-2 flex items-center justify-between`}>
                          <div>
                            <div className="text-xs text-gray-200">{evt.seed_name} - {colors.label}</div>
                            {evt.notes && <div className="text-xs text-gray-400">{evt.notes}</div>}
                          </div>
                          <div className="flex gap-1">
                            {!evt.is_completed && (
                              <button onClick={() => handleCompleteEvent(evt.id)} className="text-green-400 hover:text-green-300">
                                <Check className="w-3 h-3" />
                              </button>
                            )}
                            <button onClick={() => handleDeleteEvent(evt.id)} className="text-red-400 hover:text-red-300">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </>
                ) : (
                  <p className="text-xs text-gray-600 italic">No activities</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add Event Modal */}
      {showAddEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddEvent(null)}>
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Add Planting Event</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Seed</label>
                <select
                  value={eventForm.seed_id}
                  onChange={(e) => setEventForm({ ...eventForm, seed_id: e.target.value })}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded"
                >
                  <option value="">Select a seed...</option>
                  {seedList.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Activity</label>
                <select
                  value={eventForm.activity_type}
                  onChange={(e) => setEventForm({ ...eventForm, activity_type: e.target.value })}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded"
                >
                  {Object.entries(ACTIVITY_COLORS).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Date</label>
                <input
                  type="date"
                  value={eventForm.start_date}
                  onChange={(e) => setEventForm({ ...eventForm, start_date: e.target.value })}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Notes</label>
                <textarea
                  value={eventForm.notes}
                  onChange={(e) => setEventForm({ ...eventForm, notes: e.target.value })}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded"
                  rows={2}
                  placeholder="Optional notes..."
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleAddEvent}
                disabled={!eventForm.seed_id || !eventForm.start_date}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2 rounded font-medium"
              >
                Add Event
              </button>
              <button
                onClick={() => setShowAddEvent(null)}
                className="px-4 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// Main Garden Component
// ============================================
function Garden() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('garden-tab') || 'overview'
  })

  const switchTab = (tab) => {
    setActiveTab(tab)
    localStorage.setItem('garden-tab', tab)
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'plants', label: 'Plants', icon: Leaf },
    { id: 'seeds', label: 'Seeds', icon: Sprout },
    { id: 'planner', label: 'Planner', icon: Calendar },
  ]

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-4 border-b border-gray-700 pb-1 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-gray-800 text-green-400 border-b-2 border-green-400'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab onSwitchTab={switchTab} />}
      {activeTab === 'plants' && <Plants />}
      {activeTab === 'seeds' && <Seeds />}
      {activeTab === 'planner' && <PlannerTab />}
    </div>
  )
}

export default Garden
