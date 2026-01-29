import React, { useState, useEffect, useRef } from 'react'
import {
  Leaf, Sprout, LayoutDashboard, Calendar, Droplets, Sun, Snowflake, Pencil, X, Plus, Check,
  ChevronRight, AlertTriangle, BookOpen, Grid3X3, BarChart3, Trash2, Upload, Camera, Search,
  Link2, Repeat, Eye, ChevronDown, Move, Maximize2
} from 'lucide-react'
import Plants from './Plants'
import Seeds from './Seeds'
import {
  getGardenOverview, getPlantingSchedule, getFrostDates, updateFrostDates,
  getPlantingEvents, createPlantingEvent, deletePlantingEvent, completePlantingEvent,
  createSuccessionPlanting, deleteSuccessionGroup, getSeeds,
  getJournalEntries, createJournalEntry, updateJournalEntry, deleteJournalEntry,
  uploadJournalPhoto, getJournalPhotoUrl,
  getCompanionChart, getCompanions,
  getGardenBeds, createGardenBed, updateGardenBed, deleteGardenBed,
  addBedPlanting, removeBedPlanting, moveBedPlanting,
  getPlants
} from '../services/api'
import { useSettings } from '../contexts/SettingsContext'

const ACTIVITY_COLORS = {
  start_indoors: { bg: 'bg-blue-900/40', border: 'border-blue-500', text: 'text-blue-300', label: 'Start Indoors', bar: 'bg-blue-500' },
  direct_sow: { bg: 'bg-green-900/40', border: 'border-green-500', text: 'text-green-300', label: 'Direct Sow', bar: 'bg-green-500' },
  transplant: { bg: 'bg-yellow-900/40', border: 'border-yellow-500', text: 'text-yellow-300', label: 'Transplant', bar: 'bg-yellow-500' },
  harvest: { bg: 'bg-orange-900/40', border: 'border-orange-500', text: 'text-orange-300', label: 'Harvest', bar: 'bg-orange-500' },
  other: { bg: 'bg-gray-800/40', border: 'border-gray-500', text: 'text-gray-300', label: 'Other', bar: 'bg-gray-500' },
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

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const BED_TYPES = [
  { value: 'raised_bed', label: 'Raised Bed', color: 'bg-amber-800' },
  { value: 'in_ground', label: 'In Ground', color: 'bg-green-800' },
  { value: 'container', label: 'Container', color: 'bg-gray-600' },
  { value: 'row', label: 'Row', color: 'bg-yellow-900' },
  { value: 'greenhouse', label: 'Greenhouse', color: 'bg-emerald-900' },
]

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
        <div className="flex items-center gap-4 bg-gray-800/50 rounded-lg px-4 py-2 text-sm text-gray-300 flex-wrap">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
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
          {stats?.growing_season && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Growing Season</span>
                <span>{stats.growing_season.progress_pct}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${stats.growing_season.progress_pct}%` }} />
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
// Planner Tab (Calendar + Timeline + Succession)
// ============================================
function PlannerTab() {
  const [schedule, setSchedule] = useState(null)
  const [events, setEvents] = useState([])
  const [frostDates, setFrostDates] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editingFrost, setEditingFrost] = useState(false)
  const [frostForm, setFrostForm] = useState({ last_frost_date: '', first_frost_date: '' })
  const [showAddEvent, setShowAddEvent] = useState(null)
  const [seedList, setSeedList] = useState([])
  const [eventForm, setEventForm] = useState({ seed_id: '', activity_type: 'direct_sow', start_date: '', notes: '' })
  const [successionMode, setSuccessionMode] = useState(false)
  const [successionForm, setSuccessionForm] = useState({ interval_weeks: 2, num_plantings: 4 })
  const [viewMode, setViewMode] = useState('calendar') // 'calendar' or 'timeline'

  const currentMonth = new Date().getMonth() + 1

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const [scheduleRes, frostRes, eventsRes] = await Promise.all([
        getPlantingSchedule(), getFrostDates(), getPlantingEvents(),
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
    } catch (err) { console.error('Failed to update frost dates:', err) }
  }

  const handleAddEvent = async () => {
    if (!eventForm.seed_id || !eventForm.start_date) return
    try {
      if (successionMode) {
        await createSuccessionPlanting({
          seed_id: parseInt(eventForm.seed_id),
          activity_type: eventForm.activity_type,
          first_date: eventForm.start_date,
          interval_weeks: successionForm.interval_weeks,
          num_plantings: successionForm.num_plantings,
          notes: eventForm.notes || null,
        })
      } else {
        await createPlantingEvent(eventForm)
      }
      setShowAddEvent(null)
      setEventForm({ seed_id: '', activity_type: 'direct_sow', start_date: '', notes: '' })
      setSuccessionMode(false)
      loadData()
    } catch (err) { console.error('Failed to create event:', err) }
  }

  const handleDeleteEvent = async (evt) => {
    try {
      if (evt.succession_group_id) {
        if (confirm('Delete all plantings in this succession group?')) {
          await deleteSuccessionGroup(evt.succession_group_id)
        } else {
          await deletePlantingEvent(evt.id)
        }
      } else {
        await deletePlantingEvent(evt.id)
      }
      loadData()
    } catch (err) { console.error('Failed to delete event:', err) }
  }

  const handleCompleteEvent = async (id) => {
    try {
      await completePlantingEvent(id)
      loadData()
    } catch (err) { console.error('Failed to complete event:', err) }
  }

  const openAddEvent = async (month) => {
    setShowAddEvent(month)
    if (seedList.length === 0) {
      try {
        const res = await getSeeds()
        setSeedList(res.data)
      } catch (err) { console.error('Failed to load seeds:', err) }
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

  const lastFrostMonth = frostDates ? parseInt(frostDates.last_frost_date.split('/')[0]) : 2
  const firstFrostMonth = frostDates ? parseInt(frostDates.first_frost_date.split('/')[0]) : 12

  // Build timeline data from schedule
  const buildTimelineData = () => {
    if (!schedule?.months) return []
    const cropMap = {}
    schedule.months.forEach(month => {
      Object.entries(month.activities).forEach(([type, items]) => {
        items.forEach(item => {
          const key = item.name
          if (!cropMap[key]) cropMap[key] = { name: item.name, months: {} }
          if (!cropMap[key].months[month.month]) cropMap[key].months[month.month] = []
          cropMap[key].months[month.month].push(type)
        })
      })
    })
    return Object.values(cropMap).sort((a, b) => a.name.localeCompare(b.name))
  }

  // Succession preview dates
  const getSuccessionPreview = () => {
    if (!eventForm.start_date) return []
    const dates = []
    for (let i = 0; i < successionForm.num_plantings; i++) {
      const d = new Date(eventForm.start_date)
      d.setDate(d.getDate() + i * successionForm.interval_weeks * 7)
      dates.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
    }
    return dates
  }

  return (
    <div className="space-y-4">
      {/* Frost Date Banner + View Toggle */}
      <div className="bg-gray-800/50 rounded-lg px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        {editingFrost ? (
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm text-gray-300">
              Last Frost:
              <input type="text" value={frostForm.last_frost_date} onChange={(e) => setFrostForm({ ...frostForm, last_frost_date: e.target.value })} className="ml-2 w-20 bg-gray-700 text-white px-2 py-1 rounded text-sm" placeholder="MM/DD" />
            </label>
            <label className="text-sm text-gray-300">
              First Frost:
              <input type="text" value={frostForm.first_frost_date} onChange={(e) => setFrostForm({ ...frostForm, first_frost_date: e.target.value })} className="ml-2 w-20 bg-gray-700 text-white px-2 py-1 rounded text-sm" placeholder="MM/DD" />
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
        <div className="flex items-center gap-2">
          {!editingFrost && (
            <button onClick={() => setEditingFrost(true)} className="text-gray-400 hover:text-white"><Pencil className="w-4 h-4" /></button>
          )}
          <div className="flex bg-gray-700 rounded overflow-hidden">
            <button onClick={() => setViewMode('calendar')} className={`px-3 py-1 text-xs ${viewMode === 'calendar' ? 'bg-green-600 text-white' : 'text-gray-300 hover:text-white'}`}>
              <Calendar className="w-3 h-3 inline mr-1" />Calendar
            </button>
            <button onClick={() => setViewMode('timeline')} className={`px-3 py-1 text-xs ${viewMode === 'timeline' ? 'bg-green-600 text-white' : 'text-gray-300 hover:text-white'}`}>
              <BarChart3 className="w-3 h-3 inline mr-1" />Timeline
            </button>
          </div>
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {schedule?.months?.map((month) => {
            const isFrostMonth = month.month <= lastFrostMonth || month.month >= firstFrostMonth
            const isCurrent = month.month === currentMonth
            const monthEvents = events.filter(e => new Date(e.start_date).getMonth() + 1 === month.month)
            const hasContent = Object.values(month.activities).some(a => a.length > 0) || monthEvents.length > 0

            return (
              <div key={month.month} className={`bg-gray-800/40 rounded-lg overflow-hidden border ${isCurrent ? 'border-green-500 ring-1 ring-green-500/30' : isFrostMonth ? 'border-blue-800/50' : 'border-gray-700/50'}`}>
                <div className={`px-3 py-2 flex items-center justify-between ${isFrostMonth ? 'bg-blue-900/30' : 'bg-green-900/20'}`}>
                  <span className={`font-semibold text-sm ${isCurrent ? 'text-green-400' : 'text-gray-200'}`}>{month.name}</span>
                  <button onClick={() => openAddEvent(month.month)} className="text-gray-500 hover:text-green-400 transition-colors" title="Add planting event">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
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
                              <div key={i} className={`text-xs text-gray-300 pl-2 border-l-2 ${colors.border} mb-1`}>{item.name}</div>
                            ))}
                          </div>
                        )
                      })}
                      {monthEvents.map((evt) => {
                        const colors = ACTIVITY_COLORS[evt.activity_type] || ACTIVITY_COLORS.other
                        return (
                          <div key={evt.id} className={`${colors.bg} border ${colors.border} rounded p-2 flex items-center justify-between ${evt.is_completed ? 'opacity-50' : ''}`}>
                            <div>
                              <div className="text-xs text-gray-200">
                                {evt.seed_name} - {colors.label}
                                {evt.succession_number && <span className="text-gray-500 ml-1">(#{evt.succession_number})</span>}
                              </div>
                              {evt.notes && <div className="text-xs text-gray-400">{evt.notes}</div>}
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              {!evt.is_completed && (
                                <button onClick={() => handleCompleteEvent(evt.id)} className="text-green-400 hover:text-green-300"><Check className="w-3 h-3" /></button>
                              )}
                              <button onClick={() => handleDeleteEvent(evt)} className="text-red-400 hover:text-red-300"><X className="w-3 h-3" /></button>
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
      )}

      {/* Timeline View (Gantt-style) */}
      {viewMode === 'timeline' && (
        <div className="bg-gray-800/30 rounded-lg p-4 overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Month headers */}
            <div className="flex border-b border-gray-700 pb-2 mb-2">
              <div className="w-40 flex-shrink-0 text-sm font-medium text-gray-400">Crop</div>
              <div className="flex-1 grid grid-cols-12 gap-0">
                {MONTH_NAMES.map((m, i) => (
                  <div key={i} className={`text-center text-xs ${i + 1 === currentMonth ? 'text-green-400 font-bold' : 'text-gray-500'}`}>
                    {m}
                  </div>
                ))}
              </div>
            </div>
            {/* Frost date indicators */}
            <div className="flex mb-1">
              <div className="w-40 flex-shrink-0"></div>
              <div className="flex-1 grid grid-cols-12 gap-0 h-1">
                {Array.from({ length: 12 }, (_, i) => {
                  const m = i + 1
                  const isFrost = m <= lastFrostMonth || m >= firstFrostMonth
                  return <div key={i} className={`${isFrost ? 'bg-blue-800/40' : 'bg-green-900/20'}`} />
                })}
              </div>
            </div>
            {/* Crop rows */}
            {buildTimelineData().map((crop, idx) => (
              <div key={idx} className="flex items-center border-b border-gray-800 py-1 hover:bg-gray-800/30">
                <div className="w-40 flex-shrink-0 text-xs text-gray-300 truncate pr-2">{crop.name}</div>
                <div className="flex-1 grid grid-cols-12 gap-0">
                  {Array.from({ length: 12 }, (_, i) => {
                    const m = i + 1
                    const types = crop.months[m] || []
                    if (types.length === 0) return <div key={i} className="h-6" />
                    // Show the highest priority type
                    const priority = ['start_indoors', 'direct_sow', 'transplant', 'harvest']
                    const topType = priority.find(t => types.includes(t)) || types[0]
                    const color = ACTIVITY_COLORS[topType]?.bar || 'bg-gray-500'
                    return (
                      <div key={i} className="h-6 px-0.5">
                        <div className={`${color} h-full rounded-sm opacity-80`} title={`${crop.name}: ${types.map(t => ACTIVITY_COLORS[t]?.label || t).join(', ')}`} />
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            {buildTimelineData().length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">Add seeds with planting data to see the timeline</p>
            )}
            {/* Legend */}
            <div className="flex gap-4 mt-3 pt-2 border-t border-gray-700">
              {Object.entries(ACTIVITY_COLORS).filter(([k]) => k !== 'other').map(([key, val]) => (
                <div key={key} className="flex items-center gap-1.5 text-xs text-gray-400">
                  <div className={`w-3 h-3 rounded-sm ${val.bar}`} />
                  {val.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {showAddEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowAddEvent(null); setSuccessionMode(false) }}>
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm sm:max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Add Planting Event</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Seed</label>
                <select value={eventForm.seed_id} onChange={(e) => setEventForm({ ...eventForm, seed_id: e.target.value })} className="w-full bg-gray-700 text-white px-3 py-2 rounded">
                  <option value="">Select a seed...</option>
                  {seedList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Activity</label>
                <select value={eventForm.activity_type} onChange={(e) => setEventForm({ ...eventForm, activity_type: e.target.value })} className="w-full bg-gray-700 text-white px-3 py-2 rounded">
                  {Object.entries(ACTIVITY_COLORS).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">{successionMode ? 'First Date' : 'Date'}</label>
                <input type="date" value={eventForm.start_date} onChange={(e) => setEventForm({ ...eventForm, start_date: e.target.value })} className="w-full bg-gray-700 text-white px-3 py-2 rounded" />
              </div>

              {/* Succession Planting Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="succession-toggle" checked={successionMode} onChange={(e) => setSuccessionMode(e.target.checked)} className="rounded border-gray-600 bg-gray-800 text-green-500" />
                <label htmlFor="succession-toggle" className="text-sm text-gray-300 flex items-center gap-1">
                  <Repeat className="w-3 h-3" /> Succession Planting
                </label>
              </div>

              {successionMode && (
                <div className="bg-gray-700/30 rounded-lg p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Every N weeks</label>
                      <select value={successionForm.interval_weeks} onChange={(e) => setSuccessionForm({ ...successionForm, interval_weeks: parseInt(e.target.value) })} className="w-full bg-gray-700 text-white px-2 py-1.5 rounded text-sm">
                        {[1, 2, 3, 4, 6, 8].map(w => <option key={w} value={w}>{w} week{w > 1 ? 's' : ''}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">How many plantings</label>
                      <select value={successionForm.num_plantings} onChange={(e) => setSuccessionForm({ ...successionForm, num_plantings: parseInt(e.target.value) })} className="w-full bg-gray-700 text-white px-2 py-1.5 rounded text-sm">
                        {[2, 3, 4, 5, 6, 8, 10, 12].map(n => <option key={n} value={n}>{n} plantings</option>)}
                      </select>
                    </div>
                  </div>
                  {eventForm.start_date && (
                    <div className="text-xs text-gray-400">
                      <span className="text-gray-500">Preview: </span>
                      {getSuccessionPreview().join(' → ')}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-300 mb-1">Notes</label>
                <textarea value={eventForm.notes} onChange={(e) => setEventForm({ ...eventForm, notes: e.target.value })} className="w-full bg-gray-700 text-white px-3 py-2 rounded" rows={2} placeholder="Optional notes..." />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleAddEvent} disabled={!eventForm.seed_id || !eventForm.start_date} className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2 rounded font-medium">
                {successionMode ? `Create ${successionForm.num_plantings} Events` : 'Add Event'}
              </button>
              <button onClick={() => { setShowAddEvent(null); setSuccessionMode(false) }} className="px-4 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// Journal Tab
// ============================================
function JournalTab() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ title: '', content: '', entry_date: new Date().toISOString().split('T')[0], plant_id: '', seed_id: '', tags: '' })
  const [plants, setPlants] = useState([])
  const [seeds, setSeeds] = useState([])
  const [filterPlant, setFilterPlant] = useState('')
  const [filterSeed, setFilterSeed] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const { formatDate } = useSettings()
  const fileInputRef = useRef(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const params = {}
      if (filterPlant) params.plant_id = filterPlant
      if (filterSeed) params.seed_id = filterSeed
      const [entriesRes, plantsRes, seedsRes] = await Promise.all([
        getJournalEntries(params),
        getPlants(),
        getSeeds(),
      ])
      setEntries(entriesRes.data)
      setPlants(plantsRes.data)
      setSeeds(seedsRes.data)
    } catch (err) {
      console.error('Failed to load journal:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!form.title.trim()) return
    try {
      const data = {
        ...form,
        plant_id: form.plant_id ? parseInt(form.plant_id) : null,
        seed_id: form.seed_id ? parseInt(form.seed_id) : null,
      }
      if (editingId) {
        await updateJournalEntry(editingId, data)
      } else {
        await createJournalEntry(data)
      }
      setShowForm(false)
      setEditingId(null)
      setForm({ title: '', content: '', entry_date: new Date().toISOString().split('T')[0], plant_id: '', seed_id: '', tags: '' })
      loadData()
    } catch (err) { console.error('Failed to save journal entry:', err) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this journal entry?')) return
    try {
      await deleteJournalEntry(id)
      loadData()
    } catch (err) { console.error('Failed to delete entry:', err) }
  }

  const handlePhotoUpload = async (entryId, file) => {
    const formData = new FormData()
    formData.append('file', file)
    try {
      await uploadJournalPhoto(entryId, formData)
      loadData()
    } catch (err) { console.error('Failed to upload photo:', err) }
  }

  const openEdit = (entry) => {
    setForm({
      title: entry.title || '',
      content: entry.content || '',
      entry_date: entry.entry_date || new Date().toISOString().split('T')[0],
      plant_id: entry.plant_id || '',
      seed_id: entry.seed_id || '',
      tags: entry.tags || '',
    })
    setEditingId(entry.id)
    setShowForm(true)
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400"></div></div>
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          <select value={filterPlant} onChange={(e) => { setFilterPlant(e.target.value); setTimeout(loadData, 0) }} className="bg-gray-700 text-white px-2 py-1.5 rounded text-sm">
            <option value="">All Plants</option>
            {plants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={filterSeed} onChange={(e) => { setFilterSeed(e.target.value); setTimeout(loadData, 0) }} className="bg-gray-700 text-white px-2 py-1.5 rounded text-sm">
            <option value="">All Seeds</option>
            {seeds.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ title: '', content: '', entry_date: new Date().toISOString().split('T')[0], plant_id: '', seed_id: '', tags: '' }) }} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm text-white flex items-center gap-1">
          <Plus className="w-4 h-4" /> New Entry
        </button>
      </div>

      {/* Entries */}
      {entries.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-600" />
          <p>No journal entries yet</p>
          <p className="text-sm mt-1">Document your garden observations, notes, and progress</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="bg-gray-800/40 rounded-lg border border-gray-700/50 overflow-hidden">
              <div className="p-4 cursor-pointer" onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500">{formatDate(entry.entry_date)}</span>
                      <h3 className="font-medium text-white">{entry.title}</h3>
                      {entry.plant_name && (
                        <span className="text-xs bg-green-900/40 text-green-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Leaf className="w-3 h-3" />{entry.plant_name}
                        </span>
                      )}
                      {entry.seed_name && (
                        <span className="text-xs bg-emerald-900/40 text-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Sprout className="w-3 h-3" />{entry.seed_name}
                        </span>
                      )}
                      {entry.tags && entry.tags.split(',').map((tag, i) => (
                        <span key={i} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{tag.trim()}</span>
                      ))}
                    </div>
                    {!expandedId !== entry.id && entry.content && (
                      <p className="text-sm text-gray-400 mt-1 line-clamp-2">{entry.content}</p>
                    )}
                  </div>
                  {entry.photo_path && (
                    <img src={getJournalPhotoUrl(entry.photo_path)} alt="" className="w-16 h-16 rounded-lg object-cover ml-3 flex-shrink-0" />
                  )}
                </div>
              </div>
              {expandedId === entry.id && (
                <div className="px-4 pb-4 border-t border-gray-700 pt-3">
                  {entry.content && <p className="text-sm text-gray-300 whitespace-pre-wrap mb-3">{entry.content}</p>}
                  {entry.photo_path && (
                    <img src={getJournalPhotoUrl(entry.photo_path)} alt="" className="max-h-64 rounded-lg object-contain mb-3" />
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(entry)} className="px-2 py-1 bg-blue-600/50 hover:bg-blue-600 rounded text-xs text-white flex items-center gap-1">
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button onClick={() => {
                      const input = document.createElement('input')
                      input.type = 'file'
                      input.accept = 'image/*'
                      input.onchange = (e) => { if (e.target.files[0]) handlePhotoUpload(entry.id, e.target.files[0]) }
                      input.click()
                    }} className="px-2 py-1 bg-gray-600/50 hover:bg-gray-600 rounded text-xs text-white flex items-center gap-1">
                      <Camera className="w-3 h-3" /> Photo
                    </button>
                    <button onClick={() => handleDelete(entry.id)} className="px-2 py-1 bg-red-600/50 hover:bg-red-600 rounded text-xs text-white flex items-center gap-1 ml-auto">
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Entry Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">{editingId ? 'Edit Entry' : 'New Journal Entry'}</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Title</label>
                  <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full bg-gray-700 text-white px-3 py-2 rounded" placeholder="Entry title..." />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Date</label>
                  <input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} className="w-full bg-gray-700 text-white px-3 py-2 rounded" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Content</label>
                <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="w-full bg-gray-700 text-white px-3 py-2 rounded" rows={5} placeholder="Your observations, notes, progress..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Link to Plant</label>
                  <select value={form.plant_id} onChange={(e) => setForm({ ...form, plant_id: e.target.value })} className="w-full bg-gray-700 text-white px-3 py-2 rounded">
                    <option value="">None</option>
                    {plants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Link to Seed</label>
                  <select value={form.seed_id} onChange={(e) => setForm({ ...form, seed_id: e.target.value })} className="w-full bg-gray-700 text-white px-3 py-2 rounded">
                    <option value="">None</option>
                    {seeds.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Tags (comma separated)</label>
                <input type="text" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="w-full bg-gray-700 text-white px-3 py-2 rounded" placeholder="transplant, tomato, greenhouse" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleSave} disabled={!form.title.trim()} className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2 rounded font-medium">
                {editingId ? 'Save Changes' : 'Create Entry'}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// Companion Planting Tab (embedded in Layout or standalone)
// ============================================
function CompanionTab() {
  const [chart, setChart] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => { loadChart() }, [])

  const loadChart = async () => {
    try {
      const res = await getCompanionChart()
      setChart(res.data)
    } catch (err) {
      console.error('Failed to load companion chart:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400"></div></div>
  }

  if (!chart) {
    return <div className="text-gray-400 text-center py-12">Failed to load companion planting data</div>
  }

  const plantNames = Object.keys(chart).sort()
  const filtered = search ? plantNames.filter(n => n.toLowerCase().includes(search.toLowerCase())) : plantNames
  const selectedData = selected ? chart[selected] : null

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search plants..."
          className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Plant list */}
        <div className="lg:col-span-1 bg-gray-800/30 rounded-lg p-3 max-h-[600px] overflow-y-auto">
          <h4 className="text-sm font-medium text-gray-400 mb-2">Plants ({filtered.length})</h4>
          <div className="space-y-1">
            {filtered.map(name => (
              <button
                key={name}
                onClick={() => setSelected(name)}
                className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                  selected === name ? 'bg-green-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                {name.charAt(0).toUpperCase() + name.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Detail view */}
        <div className="lg:col-span-2">
          {selectedData ? (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-white capitalize">{selected}</h3>
              {selectedData.notes && (
                <p className="text-sm text-gray-400 italic">{selectedData.notes}</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-green-400 mb-2 flex items-center gap-1">
                    <Check className="w-4 h-4" /> Good Companions
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedData.companions?.map(c => (
                      <button
                        key={c}
                        onClick={() => { if (chart[c]) setSelected(c) }}
                        className={`text-sm px-2.5 py-1 rounded-full ${chart[c] ? 'bg-green-700/50 text-green-300 hover:bg-green-700 cursor-pointer' : 'bg-green-900/30 text-green-400'}`}
                      >
                        {c}
                      </button>
                    ))}
                    {(!selectedData.companions || selectedData.companions.length === 0) && (
                      <span className="text-sm text-gray-500">No known companions</span>
                    )}
                  </div>
                </div>
                <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-1">
                    <X className="w-4 h-4" /> Antagonists (Avoid)
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedData.antagonists?.map(a => (
                      <button
                        key={a}
                        onClick={() => { if (chart[a]) setSelected(a) }}
                        className={`text-sm px-2.5 py-1 rounded-full ${chart[a] ? 'bg-red-700/50 text-red-300 hover:bg-red-700 cursor-pointer' : 'bg-red-900/30 text-red-400'}`}
                      >
                        {a}
                      </button>
                    ))}
                    {(!selectedData.antagonists || selectedData.antagonists.length === 0) && (
                      <span className="text-sm text-gray-500">No known antagonists</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Leaf className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p>Select a plant to see companion planting info</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// Layout Tab (Garden Bed Designer)
// ============================================
function LayoutTab() {
  const [beds, setBeds] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddBed, setShowAddBed] = useState(false)
  const [bedForm, setBedForm] = useState({ name: '', bed_type: 'raised_bed', width_inches: 48, length_inches: 96 })
  const [selectedBed, setSelectedBed] = useState(null)
  const [seedList, setSeedList] = useState([])
  const [plantList, setPlantList] = useState([])
  const [showAddPlanting, setShowAddPlanting] = useState(false)
  const [plantingForm, setPlantingForm] = useState({ seed_id: '', plant_id: '', grid_row: 0, grid_col: 0 })
  const [companions, setCompanions] = useState(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const [bedsRes, seedsRes, plantsRes] = await Promise.all([
        getGardenBeds(), getSeeds(), getPlants(),
      ])
      setBeds(bedsRes.data)
      setSeedList(seedsRes.data)
      setPlantList(plantsRes.data)
    } catch (err) {
      console.error('Failed to load garden beds:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBed = async () => {
    if (!bedForm.name.trim()) return
    try {
      await createGardenBed(bedForm)
      setShowAddBed(false)
      setBedForm({ name: '', bed_type: 'raised_bed', width_inches: 48, length_inches: 96 })
      loadData()
    } catch (err) { console.error('Failed to create bed:', err) }
  }

  const handleDeleteBed = async (id) => {
    if (!confirm('Delete this garden bed?')) return
    try {
      await deleteGardenBed(id)
      if (selectedBed?.id === id) setSelectedBed(null)
      loadData()
    } catch (err) { console.error('Failed to delete bed:', err) }
  }

  const handleAddPlanting = async () => {
    if (!selectedBed || (!plantingForm.seed_id && !plantingForm.plant_id)) return
    try {
      await addBedPlanting(selectedBed.id, {
        seed_id: plantingForm.seed_id ? parseInt(plantingForm.seed_id) : null,
        plant_id: plantingForm.plant_id ? parseInt(plantingForm.plant_id) : null,
        grid_row: plantingForm.grid_row,
        grid_col: plantingForm.grid_col,
      })
      setShowAddPlanting(false)
      setPlantingForm({ seed_id: '', plant_id: '', grid_row: 0, grid_col: 0 })
      loadData()
    } catch (err) { console.error('Failed to add planting:', err) }
  }

  const handleRemovePlanting = async (plantingId) => {
    if (!selectedBed) return
    try {
      await removeBedPlanting(selectedBed.id, plantingId)
      loadData()
    } catch (err) { console.error('Failed to remove planting:', err) }
  }

  // Load companion data when a planting is focused
  const checkCompanion = async (plantName) => {
    try {
      const res = await getCompanions(plantName)
      setCompanions(res.data)
    } catch { setCompanions(null) }
  }

  // Refresh selectedBed from updated beds
  useEffect(() => {
    if (selectedBed) {
      const updated = beds.find(b => b.id === selectedBed.id)
      if (updated) setSelectedBed(updated)
    }
  }, [beds])

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400"></div></div>
  }

  const currentBed = selectedBed ? beds.find(b => b.id === selectedBed.id) : null
  const gridRows = currentBed ? Math.max(1, Math.floor(currentBed.length_inches / (currentBed.plant_spacing_inches || 12))) : 0
  const gridCols = currentBed ? Math.max(1, Math.floor(currentBed.width_inches / (currentBed.plant_spacing_inches || 12))) : 0

  return (
    <div className="space-y-4">
      {/* Bed list header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Garden Beds ({beds.length})</h3>
        <button onClick={() => setShowAddBed(true)} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm text-white flex items-center gap-1">
          <Plus className="w-4 h-4" /> New Bed
        </button>
      </div>

      {beds.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Grid3X3 className="w-12 h-12 mx-auto mb-3 text-gray-600" />
          <p>No garden beds yet</p>
          <p className="text-sm mt-1">Create beds to plan what goes where</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Bed cards */}
          <div className="lg:col-span-1 space-y-2 max-h-[600px] overflow-y-auto">
            {beds.map(bed => {
              const typeInfo = BED_TYPES.find(t => t.value === bed.bed_type) || BED_TYPES[0]
              const isSelected = selectedBed?.id === bed.id
              return (
                <div
                  key={bed.id}
                  onClick={() => setSelectedBed(bed)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                    isSelected ? 'border-green-500 bg-gray-800' : 'border-gray-700/50 bg-gray-800/40 hover:bg-gray-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-white text-sm">{bed.name}</div>
                      <div className="text-xs text-gray-500">{typeInfo.label} - {bed.width_inches}"x{bed.length_inches}"</div>
                      <div className="text-xs text-gray-500">{bed.plantings?.length || 0} plantings</div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteBed(bed.id) }} className="text-red-400 hover:text-red-300 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Bed detail / grid view */}
          <div className="lg:col-span-2">
            {currentBed ? (
              <div className="bg-gray-800/30 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-medium text-white">{currentBed.name}</h4>
                    <p className="text-sm text-gray-500">{currentBed.width_inches}"x{currentBed.length_inches}" - {gridCols} cols x {gridRows} rows ({currentBed.plant_spacing_inches || 12}" spacing)</p>
                  </div>
                  <button onClick={() => setShowAddPlanting(true)} className="px-3 py-1.5 bg-green-600/80 hover:bg-green-600 rounded text-sm text-white flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add Plant
                  </button>
                </div>

                {/* Grid visualization */}
                <div className="overflow-x-auto">
                  <div className="inline-grid gap-1 p-2 bg-amber-950/30 rounded-lg border border-amber-800/30" style={{ gridTemplateColumns: `repeat(${gridCols}, 2.5rem)` }}>
                    {Array.from({ length: gridRows * gridCols }, (_, idx) => {
                      const row = Math.floor(idx / gridCols)
                      const col = idx % gridCols
                      const planting = currentBed.plantings?.find(p => p.grid_row === row && p.grid_col === col)
                      const name = planting?.seed_name || planting?.plant_name || null

                      return (
                        <div
                          key={idx}
                          className={`w-10 h-10 rounded flex items-center justify-center text-xs cursor-pointer transition-colors ${
                            planting
                              ? 'bg-green-700/60 hover:bg-green-600/60 text-white'
                              : 'bg-gray-800/50 hover:bg-gray-700/50 text-gray-600'
                          }`}
                          title={planting ? `${name} (${row},${col})` : `Empty (${row},${col})`}
                          onClick={() => {
                            if (planting) {
                              if (confirm(`Remove ${name}?`)) handleRemovePlanting(planting.id)
                            } else {
                              setPlantingForm({ ...plantingForm, grid_row: row, grid_col: col })
                              setShowAddPlanting(true)
                            }
                          }}
                          onMouseEnter={() => { if (name) checkCompanion(name) }}
                        >
                          {name ? name.substring(0, 2).toUpperCase() : ''}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Plantings list */}
                {currentBed.plantings && currentBed.plantings.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-400 mb-2">Planted in this bed</h5>
                    <div className="flex flex-wrap gap-2">
                      {currentBed.plantings.map(p => (
                        <div key={p.id} className="flex items-center gap-1 bg-gray-700/50 rounded-full px-3 py-1 text-sm">
                          <span className="text-gray-200">{p.seed_name || p.plant_name}</span>
                          <span className="text-gray-500 text-xs">({p.grid_row},{p.grid_col})</span>
                          <button onClick={() => handleRemovePlanting(p.id)} className="text-red-400 hover:text-red-300 ml-1">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Companion info */}
                {companions && (
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <h5 className="text-sm font-medium text-gray-400 mb-2">Companion Info</h5>
                    <div className="grid grid-cols-2 gap-3">
                      {companions.companions?.length > 0 && (
                        <div>
                          <span className="text-xs text-green-400">Good with:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {companions.companions.map(c => (
                              <span key={c} className="text-xs bg-green-900/30 text-green-300 px-2 py-0.5 rounded-full">{c}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {companions.antagonists?.length > 0 && (
                        <div>
                          <span className="text-xs text-red-400">Keep away from:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {companions.antagonists.map(a => (
                              <span key={a} className="text-xs bg-red-900/30 text-red-300 px-2 py-0.5 rounded-full">{a}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 bg-gray-800/20 rounded-lg">
                <p>Select a bed to view and manage plantings</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Bed Modal */}
      {showAddBed && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddBed(false)}>
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm sm:max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">New Garden Bed</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Name</label>
                <input type="text" value={bedForm.name} onChange={(e) => setBedForm({ ...bedForm, name: e.target.value })} className="w-full bg-gray-700 text-white px-3 py-2 rounded" placeholder="e.g., Raised Bed A" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Type</label>
                <select value={bedForm.bed_type} onChange={(e) => setBedForm({ ...bedForm, bed_type: e.target.value })} className="w-full bg-gray-700 text-white px-3 py-2 rounded">
                  {BED_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Width (inches)</label>
                  <input type="number" value={bedForm.width_inches} onChange={(e) => setBedForm({ ...bedForm, width_inches: parseInt(e.target.value) || 48 })} className="w-full bg-gray-700 text-white px-3 py-2 rounded" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Length (inches)</label>
                  <input type="number" value={bedForm.length_inches} onChange={(e) => setBedForm({ ...bedForm, length_inches: parseInt(e.target.value) || 96 })} className="w-full bg-gray-700 text-white px-3 py-2 rounded" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleCreateBed} disabled={!bedForm.name.trim()} className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2 rounded font-medium">Create Bed</button>
              <button onClick={() => setShowAddBed(false)} className="px-4 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Planting Modal */}
      {showAddPlanting && selectedBed && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddPlanting(false)}>
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm sm:max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Add Plant to {selectedBed.name}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Seed</label>
                <select value={plantingForm.seed_id} onChange={(e) => setPlantingForm({ ...plantingForm, seed_id: e.target.value, plant_id: '' })} className="w-full bg-gray-700 text-white px-3 py-2 rounded">
                  <option value="">Select a seed...</option>
                  {seedList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="text-center text-xs text-gray-500">— or —</div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Existing Plant</label>
                <select value={plantingForm.plant_id} onChange={(e) => setPlantingForm({ ...plantingForm, plant_id: e.target.value, seed_id: '' })} className="w-full bg-gray-700 text-white px-3 py-2 rounded">
                  <option value="">Select a plant...</option>
                  {plantList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Grid Row</label>
                  <input type="number" min="0" max={gridRows - 1} value={plantingForm.grid_row} onChange={(e) => setPlantingForm({ ...plantingForm, grid_row: parseInt(e.target.value) || 0 })} className="w-full bg-gray-700 text-white px-3 py-2 rounded" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Grid Col</label>
                  <input type="number" min="0" max={gridCols - 1} value={plantingForm.grid_col} onChange={(e) => setPlantingForm({ ...plantingForm, grid_col: parseInt(e.target.value) || 0 })} className="w-full bg-gray-700 text-white px-3 py-2 rounded" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleAddPlanting} disabled={!plantingForm.seed_id && !plantingForm.plant_id} className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2 rounded font-medium">Add to Bed</button>
              <button onClick={() => setShowAddPlanting(false)} className="px-4 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded">Cancel</button>
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
    { id: 'seeds', label: 'Seeds', icon: Sprout },
    { id: 'plants', label: 'Plants', icon: Leaf },
    { id: 'planner', label: 'Planner', icon: Calendar },
    { id: 'journal', label: 'Journal', icon: BookOpen },
    { id: 'companions', label: 'Companions', icon: Link2 },
    { id: 'layout', label: 'Layout', icon: Grid3X3 },
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
      {activeTab === 'seeds' && <Seeds />}
      {activeTab === 'plants' && <Plants />}
      {activeTab === 'planner' && <PlannerTab />}
      {activeTab === 'journal' && <JournalTab />}
      {activeTab === 'companions' && <CompanionTab />}
      {activeTab === 'layout' && <LayoutTab />}
    </div>
  )
}

export default Garden
