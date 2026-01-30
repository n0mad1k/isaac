import React, { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, DollarSign, Pencil } from 'lucide-react'
import { getBudgetPeriodSummary, getBudgetPayPeriods, getBudgetCategories, updateBudgetCategory } from '../../services/api'

function BudgetOverview() {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(null)
  const [categories, setCategories] = useState([])
  const [periods, setPeriods] = useState([])
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState(0)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)
  const [editingBudget, setEditingBudget] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  const fetchPeriods = useCallback(async () => {
    try {
      const [periodsRes, catRes] = await Promise.all([
        getBudgetPayPeriods(currentYear, currentMonth),
        getBudgetCategories(),
      ])
      const periodData = periodsRes.data || []
      setCategories(catRes.data || [])
      if (periodData.length === 2) {
        periodData.push({ start: periodData[0].start, end: periodData[1].end, label: 'Full Month' })
      }
      setPeriods(periodData)

      const today = new Date()
      if (today.getFullYear() === currentYear && today.getMonth() + 1 === currentMonth) {
        setSelectedPeriodIdx(today.getDate() <= 14 ? 0 : 1)
      } else {
        setSelectedPeriodIdx(2)
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
    if (currentMonth === 1) { setCurrentMonth(12); setCurrentYear(y => y - 1) }
    else setCurrentMonth(m => m - 1)
  }
  const goToNextMonth = () => {
    if (currentMonth === 12) { setCurrentMonth(1); setCurrentYear(y => y + 1) }
    else setCurrentMonth(m => m + 1)
  }

  const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
  const fmtAccounting = (n) => {
    const val = n || 0
    if (val < 0) return `(${fmt(Math.abs(val))})`
    return fmt(val)
  }

  const startEditBudget = (cat) => {
    setEditingBudget(cat.id)
    setEditValue(String(cat.budget_amount || 0))
  }

  const saveEditBudget = async () => {
    if (!editingBudget || saving) return
    setSaving(true)
    try {
      await updateBudgetCategory(editingBudget, { budget_amount: parseFloat(editValue) || 0 })
      setEditingBudget(null)
      fetchPeriods()
      fetchSummary()
    } catch (err) {
      console.error('Failed to update budget:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading && !summary) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse bg-gray-800 rounded-xl h-16" />
        <div className="animate-pulse bg-gray-800 rounded-xl h-64" />
      </div>
    )
  }

  // Only variable spending categories (matches Excel: Gas, Groceries, Main Spending, Other, Roll Over)
  const variableCatIds = new Set(categories.filter(c => c.category_type === 'variable' && c.is_active).map(c => c.id))
  const variableCats = (summary?.categories || []).filter(c => variableCatIds.has(c.id) && (c.budgeted > 0 || c.spent > 0))
    .sort((a, b) => {
      const catA = categories.find(c => c.id === a.id)
      const catB = categories.find(c => c.id === b.id)
      return (catA?.sort_order || 0) - (catB?.sort_order || 0) || a.name.localeCompare(b.name)
    })

  const totalBudget = variableCats.reduce((s, c) => s + (c.budgeted || 0), 0)
  const totalSpent = variableCats.reduce((s, c) => s + (c.spent || 0), 0)
  const totalRemaining = totalBudget - totalSpent

  return (
    <div className="space-y-4">
      {/* Month & Period Navigation */}
      <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <div className="flex items-center justify-between mb-3">
          <button onClick={goToPrevMonth} className="p-1 rounded hover:bg-gray-700">
            <ChevronLeft className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
          </button>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Bi-Monthly Budget
          </h3>
          <button onClick={goToNextMonth} className="p-1 rounded hover:bg-gray-700">
            <ChevronRight className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
          </button>
        </div>
        <div className="flex gap-2 justify-center">
          {periods.map((period, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedPeriodIdx(idx)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                selectedPeriodIdx === idx ? 'bg-farm-green text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards - matches Excel: Income, Bills, Spending, Remaining */}
      {summary && (() => {
        const allCats = summary.categories || []
        const fixedCatIdsAll = new Set(categories.filter(c => c.category_type === 'fixed').map(c => c.id))
        const billsBudgeted = allCats.filter(c => fixedCatIdsAll.has(c.id)).reduce((s, c) => s + (c.budgeted || 0), 0)
        const spendingBudgeted = allCats.filter(c => variableCatIds.has(c.id)).reduce((s, c) => s + (c.budgeted || 0), 0)
        const remaining = summary.expected_income - billsBudgeted - spendingBudgeted
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4" style={{ color: '#22c55e' }} />
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Income</span>
              </div>
              <div className="text-lg font-bold" style={{ color: '#22c55e' }}>{fmt(summary.expected_income)}</div>
            </div>
            <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4" style={{ color: '#ef4444' }} />
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Bills</span>
              </div>
              <div className="text-lg font-bold" style={{ color: '#ef4444' }}>{fmt(billsBudgeted)}</div>
            </div>
            <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4" style={{ color: '#f59e0b' }} />
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Spending</span>
              </div>
              <div className="text-lg font-bold" style={{ color: '#f59e0b' }}>{fmt(spendingBudgeted)}</div>
            </div>
            <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
              <div className="flex items-center gap-2 mb-1">
                {remaining >= 0 ? <TrendingUp className="w-4 h-4" style={{ color: '#22c55e' }} /> : <TrendingDown className="w-4 h-4" style={{ color: '#ef4444' }} />}
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Remaining</span>
              </div>
              <div className="text-lg font-bold" style={{ color: remaining >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(remaining)}</div>
            </div>
          </div>
        )
      })()}

      {summary && variableCats.length > 0 && (
        <>
          {/* Charts - Donut + Bar side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Donut Chart - Actual Summary */}
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
              <h4 className="text-sm font-semibold mb-3 text-center" style={{ color: 'var(--color-text-primary)' }}>
                Actual Summary
              </h4>
              <DonutChart categories={variableCats} />
            </div>

            {/* Bar Chart - Budget vs Actual */}
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
              <h4 className="text-sm font-semibold mb-3 text-center" style={{ color: 'var(--color-text-primary)' }}>
                Budget vs. Actual
              </h4>
              <BarChart categories={variableCats} fmt={fmt} />
            </div>
          </div>

          {/* Summary by Category Table */}
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <h4 className="text-sm font-semibold mb-3 text-center" style={{ color: 'var(--color-text-primary)' }}>
              Summary by Category
            </h4>

            {/* Header */}
            <div className="grid grid-cols-4 text-xs font-semibold py-2 px-2 rounded-t" style={{ backgroundColor: '#3b82f6', color: '#fff' }}>
              <span>Category</span>
              <span className="text-right">Budget</span>
              <span className="text-right">Spent</span>
              <span className="text-right">Remaining</span>
            </div>

            {/* Rows */}
            <div>
              {variableCats.map((cat, i) => {
                const remaining = (cat.budgeted || 0) - (cat.spent || 0)
                const isEditing = editingBudget === cat.id
                return (
                  <div key={cat.id} className="grid grid-cols-4 text-xs py-2 px-2 items-center" style={{ backgroundColor: i % 2 === 0 ? 'var(--color-bg-surface)' : 'var(--color-bg-surface-soft)', borderBottom: '1px solid var(--color-border-default)' }}>
                    <span style={{ color: 'var(--color-text-primary)' }}>{cat.name}</span>
                    {isEditing ? (
                      <span className="text-right flex items-center justify-end gap-1">
                        <input
                          type="number"
                          step="0.01"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEditBudget(); if (e.key === 'Escape') setEditingBudget(null) }}
                          className="w-16 px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-xs text-right"
                          style={{ color: 'var(--color-text-primary)' }}
                          autoFocus
                        />
                      </span>
                    ) : (
                      <span className="text-right flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            const fullCat = categories.find(c => c.id === cat.id)
                            if (fullCat) startEditBudget(fullCat)
                          }}
                          className="p-0.5 rounded hover:bg-gray-700"
                          title="Edit budget"
                        >
                          <Pencil className="w-3 h-3" style={{ color: 'var(--color-text-muted)' }} />
                        </button>
                        <span style={{ color: 'var(--color-text-primary)' }}>{fmt(cat.budgeted)}</span>
                      </span>
                    )}
                    <span className="text-right" style={{ color: 'var(--color-text-primary)' }}>{fmt(cat.spent)}</span>
                    <span className="text-right" style={{ color: remaining < 0 ? '#ef4444' : 'var(--color-text-primary)' }}>
                      {fmtAccounting(remaining)}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Total Row */}
            <div className="grid grid-cols-4 text-xs font-bold py-2 px-2 rounded-b" style={{ backgroundColor: '#3b82f6', color: '#fff' }}>
              <span>Total</span>
              <span className="text-right">{fmt(totalBudget)}</span>
              <span className="text-right">{fmt(totalSpent)}</span>
              <span className="text-right">{fmtAccounting(totalRemaining)}</span>
            </div>
          </div>
        </>
      )}

      {summary && variableCats.length === 0 && (
        <div className="rounded-xl p-6 text-center" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            No variable spending categories with data. Add categories in Settings and record transactions.
          </p>
        </div>
      )}
    </div>
  )
}


function DonutChart({ categories }) {
  const total = categories.reduce((sum, c) => sum + (c.spent || 0), 0)
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No spending data</span>
      </div>
    )
  }

  const size = 200
  const center = size / 2
  const outerRadius = 85
  const innerRadius = 50
  let currentAngle = -90

  const slices = categories.filter(c => c.spent > 0).map(cat => {
    const percentage = (cat.spent / total) * 100
    const angle = (percentage / 100) * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle = endAngle

    const startRad = (startAngle * Math.PI) / 180
    const endRad = (endAngle * Math.PI) / 180

    const outerX1 = center + outerRadius * Math.cos(startRad)
    const outerY1 = center + outerRadius * Math.sin(startRad)
    const outerX2 = center + outerRadius * Math.cos(endRad)
    const outerY2 = center + outerRadius * Math.sin(endRad)
    const innerX1 = center + innerRadius * Math.cos(endRad)
    const innerY1 = center + innerRadius * Math.sin(endRad)
    const innerX2 = center + innerRadius * Math.cos(startRad)
    const innerY2 = center + innerRadius * Math.sin(startRad)

    const largeArc = angle > 180 ? 1 : 0

    const path = [
      `M ${outerX1} ${outerY1}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerX2} ${outerY2}`,
      `L ${innerX1} ${innerY1}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerX2} ${innerY2}`,
      'Z'
    ].join(' ')

    // Label position at midpoint of arc
    const midAngle = ((startAngle + endAngle) / 2) * Math.PI / 180
    const labelRadius = outerRadius + 18
    const labelX = center + labelRadius * Math.cos(midAngle)
    const labelY = center + labelRadius * Math.sin(midAngle)

    return { ...cat, path, percentage, labelX, labelY }
  })

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((slice, i) => (
          <path key={i} d={slice.path} fill={slice.color} stroke="var(--color-bg-surface)" strokeWidth="2" />
        ))}
        {/* Percentage labels */}
        {slices.filter(s => s.percentage >= 5).map((slice, i) => (
          <text key={`lbl-${i}`} x={slice.labelX} y={slice.labelY} textAnchor="middle" dominantBaseline="middle"
            fill="var(--color-text-secondary)" fontSize="11" fontWeight="600">
            {Math.round(slice.percentage)}%
          </text>
        ))}
      </svg>
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {slices.map((slice, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{slice.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}


function BarChart({ categories, fmt }) {
  const maxVal = Math.max(...categories.flatMap(c => [c.budgeted || 0, c.spent || 0]), 1)

  // Y-axis tick values
  const niceMax = Math.ceil(maxVal / 100) * 100
  const ticks = []
  const tickCount = 5
  for (let i = 0; i <= tickCount; i++) {
    ticks.push((niceMax / tickCount) * i)
  }

  const chartHeight = 180
  const chartWidth = 280
  const leftPad = 60
  const bottomPad = 50
  const barGroupWidth = (chartWidth - leftPad) / categories.length
  const barWidth = barGroupWidth * 0.3
  const barGap = 3

  return (
    <div className="flex justify-center">
      <svg width={chartWidth} height={chartHeight + bottomPad} viewBox={`0 0 ${chartWidth} ${chartHeight + bottomPad}`}>
        {/* Y-axis gridlines & labels */}
        {ticks.map((tick, i) => {
          const y = chartHeight - (tick / niceMax) * chartHeight
          return (
            <g key={i}>
              <line x1={leftPad} y1={y} x2={chartWidth} y2={y} stroke="var(--color-border-default)" strokeWidth="0.5" />
              <text x={leftPad - 5} y={y + 4} textAnchor="end" fill="var(--color-text-muted)" fontSize="9">
                ${tick.toLocaleString()}
              </text>
            </g>
          )
        })}

        {/* Bars */}
        {categories.map((cat, i) => {
          const groupX = leftPad + i * barGroupWidth + barGroupWidth * 0.15
          const budgetH = ((cat.budgeted || 0) / niceMax) * chartHeight
          const spentH = ((cat.spent || 0) / niceMax) * chartHeight

          return (
            <g key={cat.id}>
              {/* Budget bar (blue) */}
              <rect
                x={groupX}
                y={chartHeight - budgetH}
                width={barWidth}
                height={budgetH}
                fill="#6495ED"
                rx="1"
              />
              {/* Spent bar (green) */}
              <rect
                x={groupX + barWidth + barGap}
                y={chartHeight - spentH}
                width={barWidth}
                height={spentH}
                fill="#9ACD32"
                rx="1"
              />
              {/* Category label */}
              <text
                x={groupX + barWidth + barGap / 2}
                y={chartHeight + 12}
                textAnchor="end"
                fill="var(--color-text-muted)"
                fontSize="9"
                transform={`rotate(-45, ${groupX + barWidth + barGap / 2}, ${chartHeight + 12})`}
              >
                {cat.name}
              </text>
            </g>
          )
        })}

        {/* Legend */}
        <rect x={chartWidth - 100} y={chartHeight + 30} width="10" height="10" fill="#6495ED" rx="1" />
        <text x={chartWidth - 86} y={chartHeight + 39} fill="var(--color-text-secondary)" fontSize="10">Budget</text>
        <rect x={chartWidth - 45} y={chartHeight + 30} width="10" height="10" fill="#9ACD32" rx="1" />
        <text x={chartWidth - 31} y={chartHeight + 39} fill="var(--color-text-secondary)" fontSize="10">Spent</text>
      </svg>
    </div>
  )
}


export default BudgetOverview
