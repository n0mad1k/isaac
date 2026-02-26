import React, { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Check, X, Wallet, PiggyBank, CreditCard, Banknote } from 'lucide-react'
import { getBudgetPeriodSummary, getBudgetPayPeriods, getBudgetCategories, updateBudgetCategory, getBudgetPeriodReference, getAccountsWithBalances } from '../../services/api'

const ACCOUNT_ICONS = {
  checking: Wallet,
  savings: PiggyBank,
  credit: CreditCard,
  cash: Banknote,
}

function BudgetOverview() {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(null)
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [periods, setPeriods] = useState([])
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState(0)
  const [currentYear, setCurrentYear] = useState(null)
  const [currentMonth, setCurrentMonth] = useState(null)
  const [editingBudget, setEditingBudget] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [referenceDate, setReferenceDate] = useState(null)
  const [initializing, setInitializing] = useState(true)

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  // Fetch period reference on mount
  useEffect(() => {
    const initFromReference = async () => {
      try {
        const res = await getBudgetPeriodReference()
        const refDate = res.data?.reference_date ? new Date(res.data.reference_date + 'T12:00:00') : new Date()
        setReferenceDate(refDate)
        setCurrentYear(refDate.getFullYear())
        setCurrentMonth(refDate.getMonth() + 1)
      } catch (err) {
        const today = new Date()
        setReferenceDate(today)
        setCurrentYear(today.getFullYear())
        setCurrentMonth(today.getMonth() + 1)
      } finally {
        setInitializing(false)
      }
    }
    initFromReference()
  }, [])

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await getAccountsWithBalances()
      setAccounts(res.data || [])
    } catch (err) {
      console.error('Failed to fetch accounts:', err)
    }
  }, [])

  const fetchPeriods = useCallback(async () => {
    if (initializing || !currentYear || !currentMonth) return
    try {
      const [periodsRes, catRes, accountsRes] = await Promise.all([
        getBudgetPayPeriods(currentYear, currentMonth),
        getBudgetCategories(),
        getAccountsWithBalances(),
      ])
      const periodData = periodsRes.data || []
      setCategories(catRes.data || [])
      setAccounts(accountsRes.data || [])
      if (periodData.length === 2) {
        periodData.push({ start: periodData[0].start, end: periodData[1].end, label: 'Full Month' })
      }
      setPeriods(periodData)

      // Use reference date to determine which period to show
      const refDateForPeriod = referenceDate || new Date()
      if (refDateForPeriod.getFullYear() === currentYear && refDateForPeriod.getMonth() + 1 === currentMonth) {
        setSelectedPeriodIdx(refDateForPeriod.getDate() <= 14 ? 0 : 1)
      } else {
        setSelectedPeriodIdx(2)
      }
    } catch (err) {
      console.error('Failed to fetch pay periods:', err)
    }
  }, [currentYear, currentMonth, initializing, referenceDate])

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

  useEffect(() => {
    if (!initializing && currentYear && currentMonth) {
      fetchPeriods()
    }
  }, [fetchPeriods, initializing, currentYear, currentMonth])
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
        <div className="animate-pulse bg-surface rounded-xl h-16" />
        <div className="animate-pulse bg-surface rounded-xl h-64" />
      </div>
    )
  }

  // Variable spending categories
  const variableCatIds = new Set(categories.filter(c => c.category_type === 'variable' && c.is_active).map(c => c.id))
  const fixedCatIds = new Set(categories.filter(c => c.category_type === 'fixed' && c.is_active).map(c => c.id))
  const transferCatIds = new Set(categories.filter(c => c.category_type === 'transfer' && c.is_active).map(c => c.id))
  const variableCats = (summary?.categories || []).filter(c => variableCatIds.has(c.id) && c.name !== 'Roll Over' && (c.budgeted > 0 || c.spent > 0))
    .sort((a, b) => {
      const catA = categories.find(c => c.id === a.id)
      const catB = categories.find(c => c.id === b.id)
      return (catA?.sort_order || 0) - (catB?.sort_order || 0) || a.name.localeCompare(b.name)
    })

  const totalBudget = variableCats.reduce((s, c) => s + (c.budgeted || 0), 0)
  const totalSpent = variableCats.reduce((s, c) => s + (c.spent || 0), 0)
  const totalRemaining = totalBudget - totalSpent

  // Bills: only main bills (exclude person-owned bills - those are funded by transfers)
  const billsBudgeted = (summary?.categories || []).filter(c => {
    if (!fixedCatIds.has(c.id)) return false
    const cat = categories.find(cc => cc.id === c.id)
    return !cat?.owner
  }).reduce((s, c) => s + (c.budgeted || 0), 0)

  // For spending cards, include both variable and transfer categories
  const allCardCats = (summary?.categories || []).filter(c =>
    (variableCatIds.has(c.id) || transferCatIds.has(c.id)) && c.name !== 'Roll Over' && (c.budgeted > 0 || c.spent > 0)
  )

  // Get person spending balance (accumulated with rollover from prior periods)
  const getPersonData = (ownerKey) => {
    const data = summary?.person_spending_balances?.[ownerKey]
    if (!data) return { available: 0 }
    // Handle both old (number) and new (object) format
    if (typeof data === 'number') return { available: data }
    return data
  }

  // Discover unique owners from categories AND transfer names (e.g. "Dane Spending" -> "dane")
  const ownersFromCats = categories.filter(c => c.owner).map(c => c.owner)
  const ownersFromTransfers = categories
    .filter(c => c.category_type === 'transfer' && c.name.toLowerCase().endsWith(' spending'))
    .map(c => c.name.toLowerCase().replace(' spending', ''))
  const owners = [...new Set([...ownersFromCats, ...ownersFromTransfers])]

  // Build cards: Income, Bills, then remaining for each spending category
  const spendingCardCats = ['Gas', 'Groceries', 'Main Spending', ...owners.map(o => `${o.charAt(0).toUpperCase() + o.slice(1)} Spending`)]

  return (
    <div className="space-y-4">
      {/* Month & Period Navigation */}
      <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <div className="flex items-center justify-between mb-3">
          <button onClick={goToPrevMonth} className="p-1 rounded hover:bg-surface-soft">
            <ChevronLeft className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
          </button>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Budget Overview
          </h3>
          <button onClick={goToNextMonth} className="p-1 rounded hover:bg-surface-soft">
            <ChevronRight className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
          </button>
        </div>
        <div className="flex gap-2 justify-center">
          {periods.map((period, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedPeriodIdx(idx)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                selectedPeriodIdx === idx ? 'bg-farm-green text-white' : 'bg-surface-soft text-muted hover:bg-surface-hover'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards: Income, Bills, spending categories, Roll Over */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-2">
          <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Income</div>
            <div className="text-base font-bold" style={{ color: 'var(--color-success-500)' }}>{fmt(summary.expected_income)}</div>
          </div>
          <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Bills</div>
            <div className="text-base font-bold" style={{ color: 'var(--color-error-500)' }}>{fmt(billsBudgeted)}</div>
          </div>
          {spendingCardCats.map(name => {
            const ownerKey = owners.find(o => name.toLowerCase().includes(o.toLowerCase())) || null

            if (ownerKey) {
              const personData = getPersonData(ownerKey)
              const available = personData.available
              return (
                <div key={name} className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
                  <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{name}</div>
                  <div className="text-base font-bold" style={{ color: available >= 0 ? 'var(--color-success-500)' : 'var(--color-error-500)' }}>{fmt(available)}</div>
                </div>
              )
            }

            const cat = allCardCats.find(c => c.name === name)
            if (!cat) return null
            const remaining = (cat.budgeted || 0) - (cat.spent || 0)
            return (
              <div key={name} className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
                <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{name}</div>
                <div className="text-base font-bold" style={{ color: remaining >= 0 ? 'var(--color-success-500)' : 'var(--color-error-500)' }}>{fmt(remaining)}</div>
              </div>
            )
          })}
          <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Roll Over</div>
            <div className="text-base font-bold" style={{ color: (summary.rollover_balance || 0) > 0 ? 'var(--color-success-500)' : (summary.rollover_balance || 0) < 0 ? 'var(--color-error-500)' : 'var(--color-text-muted)' }}>
              {fmt(summary.rollover_balance || 0)}
            </div>
          </div>
        </div>
      )}

      {/* Accounts Overview */}
      {accounts.length > 0 && (
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Account Balances</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {accounts.map(account => {
              const Icon = ACCOUNT_ICONS[account.account_type] || Wallet
              const balance = account.current_balance || 0
              return (
                <div key={account.id} className="flex items-center gap-3 p-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg-surface-soft)' }}>
                  <Icon className="w-5 h-5 text-muted" />
                  <div>
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{account.name}</div>
                    <div className="text-sm font-semibold" style={{ color: balance >= 0 ? 'var(--color-success-500)' : 'var(--color-error-500)' }}>
                      {fmt(balance)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {summary && variableCats.length > 0 && (
        <>
          {/* Charts - Donut + Bar side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Donut Chart - Actual Summary */}
            <div className="rounded-xl p-4 overflow-visible" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
              <h4 className="text-sm font-semibold mb-3 text-center" style={{ color: 'var(--color-text-primary)' }}>
                Actual Summary
              </h4>
              <DonutChart categories={variableCats} />
            </div>

            {/* Bar Chart - Budget vs Actual */}
            <div className="rounded-xl p-4 overflow-visible" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
              <h4 className="text-sm font-semibold mb-3 text-center" style={{ color: 'var(--color-text-primary)' }}>
                Budget vs. Actual
              </h4>
              <div style={{ maxWidth: '600px' }} className="mx-auto">
                <BarChart categories={variableCats} />
              </div>
            </div>
          </div>

          {/* Summary by Category Table */}
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <h4 className="text-sm font-semibold mb-3 text-center" style={{ color: 'var(--color-text-primary)' }}>
              Summary by Category
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 text-xs font-semibold py-2 px-2 rounded-t" style={{ backgroundColor: 'var(--color-blue-600)', color: '#fff' }}>
              <span>Category</span>
              <span className="text-right hidden sm:block">Budget</span>
              <span className="text-right hidden sm:block">Spent</span>
              <span className="text-right">Remaining</span>
            </div>

            <div>
              {variableCats.map((cat, i) => {
                const remaining = (cat.budgeted || 0) - (cat.spent || 0)
                const isEditing = editingBudget === cat.id
                return (
                  <div key={cat.id} className="grid grid-cols-2 sm:grid-cols-4 text-xs py-2 px-2 items-center" style={{ backgroundColor: i % 2 === 0 ? 'var(--color-bg-surface)' : 'var(--color-bg-surface-soft)', borderBottom: '1px solid var(--color-border-default)' }}>
                    <span className="truncate" style={{ color: 'var(--color-text-primary)' }}>{cat.name}</span>
                    {isEditing ? (
                      <span className="text-right hidden sm:flex items-center justify-end gap-1">
                        <input
                          type="number"
                          step="0.01"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEditBudget(); if (e.key === 'Escape') setEditingBudget(null) }}
                          className="w-16 px-1 py-0.5 bg-surface border border rounded text-xs text-right"
                          style={{ color: 'var(--color-text-primary)' }}
                          autoFocus
                        />
                      </span>
                    ) : (
                      <span
                        className="text-right cursor-pointer hover:underline hidden sm:block"
                        style={{ color: 'var(--color-text-primary)' }}
                        onClick={() => {
                          const fullCat = categories.find(c => c.id === cat.id)
                          if (fullCat) startEditBudget(fullCat)
                        }}
                        title="Click to edit budget"
                      >
                        {fmt(cat.budgeted)}
                      </span>
                    )}
                    <span className="text-right hidden sm:block" style={{ color: 'var(--color-text-primary)' }}>{fmt(cat.spent)}</span>
                    <span className="text-right" style={{ color: remaining < 0 ? 'var(--color-error-500)' : 'var(--color-text-primary)' }}>
                      {fmtAccounting(remaining)}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 text-xs font-bold py-2 px-2 rounded-b" style={{ backgroundColor: 'var(--color-blue-600)', color: '#fff' }}>
              <span>Total</span>
              <span className="text-right hidden sm:block">{fmt(totalBudget)}</span>
              <span className="text-right hidden sm:block">{fmt(totalSpent)}</span>
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
  const totalSpent = categories.reduce((sum, c) => sum + (c.spent || 0), 0)
  const totalBudgeted = categories.reduce((sum, c) => sum + (c.budgeted || 0), 0)

  // Use spending data if available, otherwise show budget allocations
  const useSpent = totalSpent > 0
  const total = useSpent ? totalSpent : totalBudgeted

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No budget data</span>
      </div>
    )
  }

  const size = 280
  const center = size / 2
  const outerRadius = 100
  const innerRadius = 60
  const labelRadius = outerRadius + 25
  let currentAngle = -90

  const dataKey = useSpent ? 'spent' : 'budgeted'
  const slices = categories.filter(c => (c[dataKey] || 0) > 0).map(cat => {
    const value = cat[dataKey] || 0
    const percentage = (value / total) * 100
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

    const midAngle = ((startAngle + endAngle) / 2) * Math.PI / 180
    const labelX = center + labelRadius * Math.cos(midAngle)
    const labelY = center + labelRadius * Math.sin(midAngle)

    return { ...cat, path, percentage, labelX, labelY }
  })

  return (
    <div className="flex flex-col items-center gap-3">
      {!useSpent && (
        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Showing budget allocation (no spending yet)</div>
      )}
      <svg width="100%" viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: size, overflow: 'visible' }}>
        {slices.map((slice, i) => (
          <path key={i} d={slice.path} fill={slice.color} stroke="var(--color-bg-surface)" strokeWidth="2"
            opacity={useSpent ? 1 : 0.6} />
        ))}
        {slices.filter(s => s.percentage >= 5).map((slice, i) => (
          <text key={`lbl-${i}`} x={slice.labelX} y={slice.labelY} textAnchor="middle" dominantBaseline="middle"
            fill="var(--color-text-secondary)" fontSize="11" fontWeight="600">
            {Math.round(slice.percentage)}%
          </text>
        ))}
      </svg>
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


function BarChart({ categories }) {
  const maxVal = Math.max(...categories.flatMap(c => [c.budgeted || 0, c.spent || 0]), 1)
  const niceMax = Math.ceil(maxVal / 100) * 100
  const ticks = []
  const tickCount = 4
  for (let i = 0; i <= tickCount; i++) {
    ticks.push((niceMax / tickCount) * i)
  }

  const chartHeight = 200
  const leftPad = 55
  const bottomPad = 85
  const rightPad = 20
  const topPad = 10
  const catCount = categories.length
  const totalWidth = Math.max(leftPad + catCount * 80 + rightPad, 300)
  const barGroupWidth = (totalWidth - leftPad - rightPad) / catCount
  const barWidth = barGroupWidth * 0.30
  const barGap = 4

  return (
    <div className="w-full overflow-x-auto">
      <svg width="100%" viewBox={`0 0 ${totalWidth} ${chartHeight + bottomPad + topPad}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
        {ticks.map((tick, i) => {
          const y = topPad + chartHeight - (tick / niceMax) * chartHeight
          return (
            <g key={i}>
              <line x1={leftPad} y1={y} x2={totalWidth - rightPad} y2={y} stroke="var(--color-border-default)" strokeWidth="0.5" />
              <text x={leftPad - 5} y={y + 4} textAnchor="end" fill="var(--color-text-muted)" fontSize="10">
                ${tick.toLocaleString()}
              </text>
            </g>
          )
        })}

        {categories.map((cat, i) => {
          const groupX = leftPad + i * barGroupWidth + barGroupWidth * 0.15
          const budgetH = ((cat.budgeted || 0) / niceMax) * chartHeight
          const spentH = ((cat.spent || 0) / niceMax) * chartHeight
          const labelX = groupX + barWidth
          const labelY = topPad + chartHeight + 14

          return (
            <g key={cat.id}>
              <rect x={groupX} y={topPad + chartHeight - budgetH} width={barWidth} height={budgetH} fill="#6495ED" rx="2" />
              <rect x={groupX + barWidth + barGap} y={topPad + chartHeight - spentH} width={barWidth} height={spentH} fill="#9ACD32" rx="2" />
              <text
                x={labelX}
                y={labelY}
                textAnchor="end"
                fill="var(--color-text-muted)"
                fontSize="9"
                transform={`rotate(-45, ${labelX}, ${labelY})`}
              >
                {cat.name}
              </text>
            </g>
          )
        })}

        {/* Legend */}
        <rect x={totalWidth / 2 - 60} y={topPad + chartHeight + bottomPad - 18} width="10" height="10" fill="#6495ED" rx="1" />
        <text x={totalWidth / 2 - 46} y={topPad + chartHeight + bottomPad - 9} fill="var(--color-text-secondary)" fontSize="10">Budget</text>
        <rect x={totalWidth / 2 + 10} y={topPad + chartHeight + bottomPad - 18} width="10" height="10" fill="#9ACD32" rx="1" />
        <text x={totalWidth / 2 + 24} y={topPad + chartHeight + bottomPad - 9} fill="var(--color-text-secondary)" fontSize="10">Spent</text>
      </svg>
    </div>
  )
}


export default BudgetOverview
