import React, { useState, useEffect, useMemo } from 'react'
import {
  TrendingUp, TrendingDown, Minus, Plus, Check, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, Activity, Ruler, Scale, Baby, Brain,
  MessageSquare, Hand, Users
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, ComposedChart, Legend
} from 'recharts'
import {
  getGrowthData, getGrowthCurves, getMemberMilestones, toggleMilestone, logWeight
} from '../../services/api'

const STATUS_COLORS = {
  on_track: { bg: 'bg-green-900/30', text: 'text-green-400', border: 'border-green-600', label: 'On Track' },
  monitor: { bg: 'bg-yellow-900/30', text: 'text-yellow-400', border: 'border-yellow-600', label: 'Monitor' },
  concern: { bg: 'bg-red-900/30', text: 'text-red-400', border: 'border-red-600', label: 'Concern' }
}

const CATEGORY_ICONS = {
  motor: Hand,
  language: MessageSquare,
  social: Users,
  cognitive: Brain
}

const CATEGORY_LABELS = {
  motor: 'Motor Skills',
  language: 'Language',
  social: 'Social & Emotional',
  cognitive: 'Cognitive'
}

const PERCENTILE_COLORS = {
  '3': '#ef4444',
  '10': '#f97316',
  '25': '#eab308',
  '50': '#22c55e',
  '75': '#eab308',
  '90': '#f97316',
  '97': '#ef4444'
}

function ChildGrowthTab({ member, formatWeight, formatHeight, formatDate, onUpdate }) {
  const [growthData, setGrowthData] = useState(null)
  const [growthCurves, setGrowthCurves] = useState(null)
  const [milestones, setMilestones] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [chartType, setChartType] = useState('weight')
  const [showAddWeight, setShowAddWeight] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [weightForm, setWeightForm] = useState({ weight: '', height_inches: '', notes: '' })

  const ageMonths = useMemo(() => {
    if (!member.birth_date) return 0
    const birth = new Date(member.birth_date)
    const today = new Date()
    return (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth())
  }, [member.birth_date])

  const showMilestones = ageMonths < 72 // Under 6 years

  // Load data
  useEffect(() => {
    loadData()
  }, [member.id])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const promises = [
        getGrowthData(member.id),
        getGrowthCurves(member.id, 'weight')
      ]
      if (showMilestones) {
        promises.push(getMemberMilestones(member.id))
      }

      const results = await Promise.all(promises)
      setGrowthData(results[0].data)
      setGrowthCurves(results[1].data)
      if (showMilestones && results[2]) {
        setMilestones(results[2].data)
      }
    } catch (err) {
      console.error('Failed to load growth data:', err)
      setError(err.response?.data?.detail || 'Failed to load growth data')
    } finally {
      setLoading(false)
    }
  }

  const handleChartTypeChange = async (type) => {
    setChartType(type)
    try {
      const res = await getGrowthCurves(member.id, type)
      setGrowthCurves(res.data)
    } catch (err) {
      console.error('Failed to load curves:', err)
    }
  }

  const handleLogWeight = async (e) => {
    e.preventDefault()
    if (!weightForm.weight) return
    setSubmitting(true)
    try {
      const data = {
        weight: parseFloat(weightForm.weight),
        notes: weightForm.notes || undefined
      }
      if (weightForm.height_inches) {
        data.height_inches = parseFloat(weightForm.height_inches)
      }
      await logWeight(member.id, data)
      setWeightForm({ weight: '', height_inches: '', notes: '' })
      setShowAddWeight(false)
      await loadData()
      if (onUpdate) onUpdate()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to log weight')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleMilestone = async (milestoneId, currentAchieved) => {
    try {
      await toggleMilestone(member.id, milestoneId, {
        achieved: !currentAchieved,
        achieved_date: !currentAchieved ? new Date().toISOString() : null
      })
      // Refresh milestones
      const res = await getMemberMilestones(member.id)
      setMilestones(res.data)
    } catch (err) {
      console.error('Failed to toggle milestone:', err)
    }
  }

  const toggleGroup = (key) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Build chart data from curves
  const chartData = useMemo(() => {
    if (!growthCurves?.curves?.percentile_lines) return []

    const lines = growthCurves.curves.percentile_lines
    const memberPts = growthCurves.member_points || []

    // Determine age range for chart (0 to current age + buffer, max 240)
    const maxAge = Math.min(Math.max(ageMonths + 12, 24), 240)

    // Build data points indexed by month
    const dataMap = {}
    const percentiles = ['3', '10', '25', '50', '75', '90', '97']

    for (const pct of percentiles) {
      if (!lines[pct]) continue
      for (const pt of lines[pct]) {
        if (pt.month > maxAge) continue
        if (!dataMap[pt.month]) dataMap[pt.month] = { month: pt.month }
        dataMap[pt.month][`p${pct}`] = pt.value
      }
    }

    // Add member data points
    for (const pt of memberPts) {
      if (!dataMap[pt.month]) dataMap[pt.month] = { month: pt.month }
      dataMap[pt.month].child = pt.value
      dataMap[pt.month].childDisplay = pt.value_display
      dataMap[pt.month].childUnit = pt.unit_display
    }

    return Object.values(dataMap).sort((a, b) => a.month - b.month)
  }, [growthCurves, ageMonths])

  // Unit labels (imperial for weight/height)
  const unitLabel = chartType === 'weight' ? 'lbs' : chartType === 'height' ? 'in' : 'kg/m²'
  const chartTitle = chartType === 'weight' ? 'Weight-for-Age' :
    chartType === 'height' ? 'Height-for-Age' : 'BMI-for-Age'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
        <span className="ml-3 text-gray-400">Loading growth data...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-400">
        <AlertTriangle className="w-5 h-5 inline mr-2" />
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Growth Summary Cards */}
      {growthData?.current_summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PercentileCard
            label="Weight"
            icon={Scale}
            data={growthData.current_summary.weight}
            currentValue={member.current_weight ? `${member.current_weight} lbs` : null}
          />
          <PercentileCard
            label="Height"
            icon={Ruler}
            data={growthData.current_summary.height}
            currentValue={member.height_inches ? formatHeight(member.height_inches) : null}
          />
          {growthData.current_summary.bmi && (
            <PercentileCard
              label="BMI"
              icon={Activity}
              data={growthData.current_summary.bmi}
              currentValue={null}
            />
          )}
        </div>
      )}

      {/* Growth Velocity */}
      {growthData?.weight_velocity && growthData.weight_velocity.status !== 'insufficient_data' && (
        <div className={`rounded-lg p-4 border ${
          growthData.weight_velocity.status === 'stable' ? 'bg-green-900/20 border-green-700' :
          growthData.weight_velocity.status === 'minor_shift' ? 'bg-yellow-900/20 border-yellow-700' :
          'bg-red-900/20 border-red-700'
        }`}>
          <div className="flex items-center gap-2">
            {growthData.weight_velocity.status === 'stable' ? (
              <Minus className="w-5 h-5 text-green-400" />
            ) : growthData.weight_velocity.percentile_change > 0 ? (
              <TrendingUp className="w-5 h-5 text-yellow-400" />
            ) : (
              <TrendingDown className="w-5 h-5 text-yellow-400" />
            )}
            <span className="text-sm text-gray-300">{growthData.weight_velocity.message}</span>
          </div>
        </div>
      )}

      {/* Growth Chart */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{chartTitle}</h3>
          <div className="flex gap-2">
            {['weight', 'height', ...(ageMonths >= 24 ? ['bmi'] : [])].map(type => (
              <button
                key={type}
                onClick={() => handleChartTypeChange(type)}
                className={`px-3 py-1 rounded text-sm ${
                  chartType === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {type === 'weight' ? 'Weight' : type === 'height' ? 'Height' : 'BMI'}
              </button>
            ))}
          </div>
        </div>

        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 25, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="month"
                stroke="#9ca3af"
                tick={{ fontSize: 12 }}
                label={{ value: 'Age (months)', position: 'insideBottom', offset: -15, style: { fill: '#9ca3af' } }}
              />
              <YAxis
                stroke="#9ca3af"
                tick={{ fontSize: 12 }}
                label={{ value: unitLabel, angle: -90, position: 'insideLeft', style: { fill: '#9ca3af' } }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#9ca3af' }}
                formatter={(value, name) => {
                  if (name === 'child') return [<span style={{ color: '#d946ef', fontWeight: 'bold' }}>{`${value} ${unitLabel}`}</span>, `● ${member.first_name || 'Child'}`]
                  const pctMap = { p3: '3rd', p10: '10th', p25: '25th', p50: '50th', p75: '75th', p90: '90th', p97: '97th' }
                  return [`${value} ${unitLabel}`, pctMap[name] || name]
                }}
                labelFormatter={(month) => `Age: ${month} months`}
                itemSorter={(item) => item.name === 'child' ? -1 : 0}
              />
              {/* Shaded percentile bands */}
              <Area type="monotone" dataKey="p97" stroke="none" fill="#374151" fillOpacity={0.3} />
              <Area type="monotone" dataKey="p3" stroke="none" fill="#1f2937" fillOpacity={1} />

              {/* Percentile lines - subtle so child's data stands out */}
              <Line type="monotone" dataKey="p3" stroke="#ef4444" strokeWidth={1} dot={false} strokeDasharray="4 4" strokeOpacity={0.5} />
              <Line type="monotone" dataKey="p10" stroke="#f97316" strokeWidth={1} dot={false} strokeDasharray="4 4" strokeOpacity={0.5} />
              <Line type="monotone" dataKey="p25" stroke="#eab308" strokeWidth={1} dot={false} strokeDasharray="3 3" strokeOpacity={0.5} />
              <Line type="monotone" dataKey="p50" stroke="#22c55e" strokeWidth={1.5} dot={false} strokeOpacity={0.7} />
              <Line type="monotone" dataKey="p75" stroke="#eab308" strokeWidth={1} dot={false} strokeDasharray="3 3" strokeOpacity={0.5} />
              <Line type="monotone" dataKey="p90" stroke="#f97316" strokeWidth={1} dot={false} strokeDasharray="4 4" strokeOpacity={0.5} />
              <Line type="monotone" dataKey="p97" stroke="#ef4444" strokeWidth={1} dot={false} strokeDasharray="4 4" strokeOpacity={0.5} />

              {/* Child's data - bold & prominent */}
              <Line
                type="monotone"
                dataKey="child"
                stroke="#f0abfc"
                strokeWidth={3}
                dot={{ fill: '#d946ef', stroke: '#ffffff', strokeWidth: 2, r: 6 }}
                activeDot={{ fill: '#d946ef', stroke: '#ffffff', strokeWidth: 3, r: 9 }}
                connectNulls
                name="child"
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-48 text-gray-500">
            No data points yet. Log weight and height to see the growth chart.
          </div>
        )}

        {/* Chart legend */}
        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 justify-center">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#d946ef', border: '2px solid #ffffff' }}></span>
            <span className="text-sm text-white font-bold">{member.first_name || 'Child'}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 inline-block" style={{ backgroundColor: '#22c55e' }}></span>
            <span className="text-xs text-gray-400">50th</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 inline-block" style={{ backgroundColor: '#eab308' }}></span>
            <span className="text-xs text-gray-400">25th/75th</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 inline-block" style={{ backgroundColor: '#f97316' }}></span>
            <span className="text-xs text-gray-400">10th/90th</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 inline-block" style={{ backgroundColor: '#ef4444' }}></span>
            <span className="text-xs text-gray-400">3rd/97th</span>
          </span>
        </div>
      </div>

      {/* Weight & Height Logging */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-white">Log Weight & Height</h3>
          <button
            onClick={() => setShowAddWeight(!showAddWeight)}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
          >
            <Plus className="w-4 h-4" />
            Add Entry
          </button>
        </div>

        {showAddWeight && (
          <form onSubmit={handleLogWeight} className="mb-4 p-3 bg-gray-900/50 rounded-lg space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Weight (lbs) *</label>
                <input
                  type="number"
                  step="0.1"
                  value={weightForm.weight}
                  onChange={(e) => setWeightForm(f => ({ ...f, weight: e.target.value }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Height (inches)</label>
                <input
                  type="number"
                  step="0.1"
                  value={weightForm.height_inches}
                  onChange={(e) => setWeightForm(f => ({ ...f, height_inches: e.target.value }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Notes</label>
              <input
                type="text"
                value={weightForm.notes}
                onChange={(e) => setWeightForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                placeholder="Optional notes"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddWeight(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Recent entries */}
        {growthData?.weight_history?.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-400">Recent Entries</h4>
            <div className="space-y-1">
              {growthData.weight_history.slice(-10).reverse().map((entry, idx) => (
                <div key={entry.id || idx} className="flex items-center justify-between py-2 px-3 bg-gray-900/30 rounded text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400">{entry.recorded_at ? formatDate(new Date(entry.recorded_at)) : '—'}</span>
                    <span className="text-white font-medium">{entry.weight_lbs} lbs</span>
                    {entry.percentile && (
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        STATUS_COLORS[entry.percentile.status]?.bg || 'bg-gray-700'
                      } ${STATUS_COLORS[entry.percentile.status]?.text || 'text-gray-400'}`}>
                        {entry.percentile.percentile}th percentile
                      </span>
                    )}
                  </div>
                  {entry.notes && <span className="text-gray-500 text-xs">{entry.notes}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Developmental Milestones (under 6 only) */}
      {showMilestones && milestones && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Baby className="w-5 h-5 text-purple-400" />
                Developmental Milestones
              </h3>
              {milestones.progress && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 max-w-[200px] bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full transition-all"
                      style={{ width: `${milestones.progress.percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">
                    {milestones.progress.achieved}/{milestones.progress.total} ({milestones.progress.percentage}%)
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {milestones.milestone_groups?.map((group) => {
              const groupKey = `group_${group.age_months}`
              const isExpanded = expandedGroups[groupKey] === true // collapsed by default
              const isCurrent = group.age_months <= ageMonths &&
                (!milestones.milestone_groups.find(g => g.age_months > group.age_months && g.age_months <= ageMonths))
              const isUpcoming = group.age_months > ageMonths

              // Count achieved in this group
              let groupTotal = 0
              let groupAchieved = 0
              Object.values(group.categories).forEach(items => {
                items.forEach(item => {
                  groupTotal++
                  if (item.achieved) groupAchieved++
                })
              })

              return (
                <div key={groupKey} className={`rounded-lg border ${
                  isCurrent ? 'border-purple-600 bg-purple-900/10' :
                  isUpcoming ? 'border-blue-700/50 bg-blue-900/10' :
                  'border-gray-700 bg-gray-900/30'
                }`}>
                  <button
                    onClick={() => toggleGroup(groupKey)}
                    className="w-full flex items-center justify-between p-3 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{group.label}</span>
                      {isCurrent && (
                        <span className="text-xs px-2 py-0.5 bg-purple-600 text-white rounded">Current</span>
                      )}
                      {isUpcoming && (
                        <span className="text-xs px-2 py-0.5 bg-blue-600/50 text-blue-200 rounded">Upcoming</span>
                      )}
                      <span className="text-xs text-gray-400">
                        {groupAchieved}/{groupTotal}
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-3">
                      {Object.entries(group.categories).map(([category, items]) => {
                        const Icon = CATEGORY_ICONS[category] || Brain
                        return (
                          <div key={category}>
                            <div className="flex items-center gap-2 mb-2">
                              <Icon className="w-4 h-4 text-gray-400" />
                              <span className="text-sm font-medium text-gray-300">
                                {CATEGORY_LABELS[category] || category}
                              </span>
                            </div>
                            <div className="space-y-1 ml-6">
                              {items.map((item) => (
                                <label
                                  key={item.id}
                                  className="flex items-start gap-2 py-1 cursor-pointer group"
                                >
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault()
                                      handleToggleMilestone(item.id, item.achieved)
                                    }}
                                    className={`mt-0.5 w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                                      item.achieved
                                        ? 'bg-purple-600 border-purple-600'
                                        : 'border-gray-600 group-hover:border-purple-500'
                                    }`}
                                  >
                                    {item.achieved && <Check className="w-3 h-3 text-white" />}
                                  </button>
                                  <span className={`text-sm ${
                                    item.achieved ? 'text-gray-500 line-through' : 'text-gray-300'
                                  }`}>
                                    {item.text}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function PercentileCard({ label, icon: Icon, data, currentValue }) {
  if (!data) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-5 h-5 text-gray-500" />
          <span className="text-sm font-medium text-gray-400">{label}</span>
        </div>
        <div className="text-gray-500 text-sm">No data</div>
      </div>
    )
  }

  const status = STATUS_COLORS[data.status] || STATUS_COLORS.on_track

  return (
    <div className={`bg-gray-800 rounded-lg border p-4 ${status.border}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${status.text}`} />
          <span className="text-sm font-medium text-gray-300">{label}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded ${status.bg} ${status.text}`}>
          {status.label}
        </span>
      </div>
      <div className="text-2xl font-bold text-white">
        {data.percentile}<span className="text-sm font-normal text-gray-400">th</span>
      </div>
      <div className="text-xs text-gray-400 mt-1">
        {currentValue && <span>{currentValue} · </span>}
        Median: {data.median} {label === 'Weight' ? 'lbs' : label === 'Height' ? 'in' : 'kg/m²'}
      </div>
    </div>
  )
}

export default ChildGrowthTab
