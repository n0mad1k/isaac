import React, { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, DollarSign, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'
import { getBudgetPeriodSummary, getBudgetPayPeriods } from '../../services/api'

function BudgetOverview() {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(null)
  const [periods, setPeriods] = useState([])
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState(0) // 0 = first half, 1 = second half, 2 = full month
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  const fetchPeriods = useCallback(async () => {
    try {
      const res = await getBudgetPayPeriods(currentYear, currentMonth)
      const periodData = res.data || []
      // Add full month option
      if (periodData.length === 2) {
        periodData.push({
          start: periodData[0].start,
          end: periodData[1].end,
          label: 'Full Month'
        })
      }
      setPeriods(periodData)

      // Auto-select current period based on today's date
      const today = new Date()
      const todayDay = today.getDate()
      if (today.getFullYear() === currentYear && today.getMonth() + 1 === currentMonth) {
        setSelectedPeriodIdx(todayDay <= 14 ? 0 : 1)
      } else {
        setSelectedPeriodIdx(2) // Full month for non-current months
      }
    } catch (err) {
      console.error('Failed to fetch pay periods:', err)
    }
  }, [currentYear, currentMonth])

  const fetchSummary = useCallback(async () => {
    if (periods.length === 0) return
    setLoading(true)
    try {
      const period = periods[selectedPeriodIdx] || periods[0]
      const res = await getBudgetPeriodSummary(period.start, period.end)
      setSummary(res.data)
    } catch (err) {
      console.error('Failed to fetch budget summary:', err)
    } finally {
      setLoading(false)
    }
  }, [periods, selectedPeriodIdx])

  useEffect(() => { fetchPeriods() }, [fetchPeriods])
  useEffect(() => { fetchSummary() }, [fetchSummary])

  const goToPrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  const goToNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  if (loading && !summary) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse bg-gray-800 rounded-xl h-16" />
        <div className="animate-pulse bg-gray-800 rounded-xl h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Month & Period Navigation */}
      <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <div className="flex items-center justify-between mb-3">
          <button onClick={goToPrevMonth} className="p-1 rounded hover:bg-gray-700">
            <ChevronLeft className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
          </button>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {monthNames[currentMonth - 1]} {currentYear}
          </h3>
          <button onClick={goToNextMonth} className="p-1 rounded hover:bg-gray-700">
            <ChevronRight className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
          </button>
        </div>

        {/* Period Toggle */}
        <div className="flex gap-2 justify-center">
          {periods.map((period, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedPeriodIdx(idx)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                selectedPeriodIdx === idx
                  ? 'bg-farm-green text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {summary && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard
              label="Income"
              value={formatCurrency(summary.expected_income)}
              icon={TrendingUp}
              color="var(--color-green-500, #22c55e)"
            />
            <SummaryCard
              label="Spent"
              value={formatCurrency(summary.total_expenses)}
              icon={TrendingDown}
              color="var(--color-red-500, #ef4444)"
            />
            <SummaryCard
              label="Budgeted"
              value={formatCurrency(summary.total_budgeted)}
              icon={DollarSign}
              color="var(--color-blue-500, #3b82f6)"
            />
            <SummaryCard
              label="Net"
              value={formatCurrency(summary.net)}
              icon={summary.net >= 0 ? TrendingUp : TrendingDown}
              color={summary.net >= 0 ? 'var(--color-green-500, #22c55e)' : 'var(--color-red-500, #ef4444)'}
            />
          </div>

          {/* Uncategorized Warning */}
          {summary.uncategorized_spent > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-900/30 border border-yellow-700/50">
              <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
              <span className="text-sm text-yellow-400">
                {formatCurrency(summary.uncategorized_spent)} uncategorized spending
              </span>
            </div>
          )}

          {/* Category Budget Bars */}
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
              Budget vs Actual
            </h4>
            <div className="space-y-3">
              {summary.categories
                .filter(cat => cat.budgeted > 0 || cat.spent > 0)
                .sort((a, b) => b.spent - a.spent)
                .map((cat) => (
                  <BudgetBar key={cat.id} category={cat} formatCurrency={formatCurrency} />
                ))}
              {summary.categories.filter(cat => cat.budgeted > 0 || cat.spent > 0).length === 0 && (
                <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
                  No budget categories set up yet. Go to Settings to add categories.
                </p>
              )}
            </div>
          </div>

          {/* Spending Pie Chart */}
          {summary.categories.filter(c => c.spent > 0).length > 0 && (
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
              <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                Spending Breakdown
              </h4>
              <SpendingPieChart categories={summary.categories.filter(c => c.spent > 0)} formatCurrency={formatCurrency} />
            </div>
          )}
        </>
      )}
    </div>
  )
}


function SummaryCard({ label, value, icon: Icon, color }) {
  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4" style={{ color }} />
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      </div>
      <div className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{value}</div>
    </div>
  )
}


function BudgetBar({ category, formatCurrency }) {
  const percentage = Math.min(category.percentage, 100)
  const isOverBudget = category.percentage > 100
  const barColor = isOverBudget ? '#ef4444' : category.color

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: category.color }} />
          <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{category.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: isOverBudget ? '#ef4444' : 'var(--color-text-muted)' }}>
            {formatCurrency(category.spent)} / {formatCurrency(category.budgeted)}
          </span>
          {isOverBudget && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-900/40 text-red-400">
              +{formatCurrency(category.spent - category.budgeted)}
            </span>
          )}
        </div>
      </div>
      <div className="w-full h-2 rounded-full bg-gray-700 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  )
}


function SpendingPieChart({ categories, formatCurrency }) {
  const total = categories.reduce((sum, c) => sum + c.spent, 0)
  if (total === 0) return null

  // Build SVG pie chart
  const size = 160
  const center = size / 2
  const radius = 60
  let currentAngle = -90

  const slices = categories.map(cat => {
    const percentage = (cat.spent / total) * 100
    const angle = (percentage / 100) * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle = endAngle

    const startRad = (startAngle * Math.PI) / 180
    const endRad = (endAngle * Math.PI) / 180

    const x1 = center + radius * Math.cos(startRad)
    const y1 = center + radius * Math.sin(startRad)
    const x2 = center + radius * Math.cos(endRad)
    const y2 = center + radius * Math.sin(endRad)

    const largeArc = angle > 180 ? 1 : 0

    const path = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`

    return { ...cat, path, percentage }
  })

  return (
    <div className="flex flex-col md:flex-row items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
        {slices.map((slice, i) => (
          <path key={i} d={slice.path} fill={slice.color} stroke="var(--color-bg-surface)" strokeWidth="1" />
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {slices.map((slice, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: slice.color }} />
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {slice.name} ({slice.percentage.toFixed(0)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}


export default BudgetOverview
