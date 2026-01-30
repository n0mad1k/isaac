import React, { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, DollarSign, TrendingUp, TrendingDown, ArrowRightLeft } from 'lucide-react'
import { getBudgetPeriodSummary, getBudgetPayPeriods, getBudgetCategories, getBudgetAccounts } from '../../services/api'

function MonthlyBudget() {
  const [loading, setLoading] = useState(true)
  const [firstHalf, setFirstHalf] = useState(null)
  const [secondHalf, setSecondHalf] = useState(null)
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [periodsRes, catRes, acctRes] = await Promise.all([
        getBudgetPayPeriods(currentYear, currentMonth),
        getBudgetCategories(),
        getBudgetAccounts(),
      ])
      const periods = periodsRes.data || []
      setCategories(catRes.data || [])
      setAccounts(acctRes.data || [])

      if (periods.length >= 2) {
        const [first, second] = await Promise.all([
          getBudgetPeriodSummary(periods[0].start, periods[0].end),
          getBudgetPeriodSummary(periods[1].start, periods[1].end),
        ])
        setFirstHalf(first.data)
        setSecondHalf(second.data)
      }
    } catch (err) {
      console.error('Failed to fetch monthly budget:', err)
    } finally {
      setLoading(false)
    }
  }, [currentYear, currentMonth])

  useEffect(() => { fetchData() }, [fetchData])

  const goToPrevMonth = () => {
    if (currentMonth === 1) { setCurrentMonth(12); setCurrentYear(y => y - 1) }
    else setCurrentMonth(m => m - 1)
  }
  const goToNextMonth = () => {
    if (currentMonth === 12) { setCurrentMonth(1); setCurrentYear(y => y + 1) }
    else setCurrentMonth(m => m + 1)
  }

  const fmt = (n) => {
    const val = n || 0
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
  }

  if (loading && !firstHalf) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse bg-gray-800 rounded-xl h-16" />
        <div className="animate-pulse bg-gray-800 rounded-xl h-64" />
      </div>
    )
  }

  // Group categories by type for Excel-like layout
  const variableCats = categories.filter(c => c.category_type === 'variable' && c.is_active)
  const fixedCats = categories.filter(c => c.category_type === 'fixed' && c.is_active)
  const transferCats = categories.filter(c => c.category_type === 'transfer' && c.is_active)

  const getCatData = (summary, catId) => {
    if (!summary?.categories) return { budgeted: 0, spent: 0, remaining: 0 }
    const cat = summary.categories.find(c => c.id === catId)
    if (!cat) return { budgeted: 0, spent: 0, remaining: 0 }
    return { budgeted: cat.budgeted, spent: cat.spent, remaining: cat.budgeted - cat.spent }
  }

  const renderCategoryRow = (cat, summary) => {
    const data = getCatData(summary, cat.id)
    const over = data.spent > data.budgeted && data.budgeted > 0
    return (
      <div key={cat.id} className="flex justify-between items-center py-1 px-2 text-xs">
        <span className="flex-1" style={{ color: 'var(--color-text-secondary)' }}>{cat.name}</span>
        <span className="w-20 text-right" style={{ color: 'var(--color-text-muted)' }}>{fmt(data.budgeted)}</span>
        <span className="w-20 text-right" style={{ color: data.spent > 0 ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
          {data.spent > 0 ? fmt(data.spent) : '-'}
        </span>
        <span className="w-20 text-right font-medium" style={{ color: over ? '#ef4444' : data.remaining > 0 ? '#22c55e' : 'var(--color-text-muted)' }}>
          {data.budgeted > 0 || data.spent > 0 ? fmt(data.remaining) : '-'}
        </span>
      </div>
    )
  }

  const renderSectionTotal = (cats, summary, label) => {
    let totalBudget = 0, totalSpent = 0
    cats.forEach(cat => {
      const data = getCatData(summary, cat.id)
      totalBudget += data.budgeted
      totalSpent += data.spent
    })
    const totalRemaining = totalBudget - totalSpent
    return (
      <div className="flex justify-between items-center py-1.5 px-2 text-xs font-semibold" style={{ borderTop: '1px solid var(--color-border-default)' }}>
        <span className="flex-1" style={{ color: 'var(--color-text-primary)' }}>{label}</span>
        <span className="w-20 text-right" style={{ color: 'var(--color-text-primary)' }}>{fmt(totalBudget)}</span>
        <span className="w-20 text-right" style={{ color: 'var(--color-text-primary)' }}>{fmt(totalSpent)}</span>
        <span className="w-20 text-right" style={{ color: totalRemaining >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(totalRemaining)}</span>
      </div>
    )
  }

  const renderPeriodSection = (label, summary) => {
    if (!summary) return null

    return (
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        {/* Header */}
        <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
          <h4 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
            <DollarSign className="w-4 h-4" style={{ color: '#22c55e' }} />
            {label}
          </h4>
        </div>

        {/* Column Headers */}
        <div className="flex justify-between items-center py-1.5 px-2 text-xs font-medium" style={{ backgroundColor: 'var(--color-bg-surface-soft)', color: 'var(--color-text-muted)' }}>
          <span className="flex-1">Category</span>
          <span className="w-20 text-right">Budget</span>
          <span className="w-20 text-right">Spent</span>
          <span className="w-20 text-right">Remaining</span>
        </div>

        <div className="px-2 py-1">
          {/* Income */}
          <div className="flex justify-between items-center py-1.5 px-2 text-xs font-semibold rounded" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}>
            <span style={{ color: '#22c55e' }}>Expected Income</span>
            <span className="w-20 text-right" style={{ color: '#22c55e' }}>{fmt(summary.expected_income)}</span>
            <span className="w-20 text-right" style={{ color: summary.total_income > 0 ? '#22c55e' : 'var(--color-text-muted)' }}>
              {summary.total_income > 0 ? fmt(summary.total_income) : '-'}
            </span>
            <span className="w-20" />
          </div>

          {/* Variable Spending */}
          {variableCats.length > 0 && (
            <div className="mt-2">
              <div className="text-xs font-semibold px-2 py-1" style={{ color: 'var(--color-text-primary)' }}>Variable Spending</div>
              {variableCats.map(cat => renderCategoryRow(cat, summary))}
              {renderSectionTotal(variableCats, summary, 'Variable Total')}
            </div>
          )}

          {/* Fixed Bills */}
          {fixedCats.length > 0 && (
            <div className="mt-2">
              <div className="text-xs font-semibold px-2 py-1" style={{ color: 'var(--color-text-primary)' }}>Bills & Fixed Expenses</div>
              {fixedCats.map(cat => renderCategoryRow(cat, summary))}
              {renderSectionTotal(fixedCats, summary, 'Bills Total')}
            </div>
          )}

          {/* Transfers */}
          {transferCats.length > 0 && (
            <div className="mt-2">
              <div className="text-xs font-semibold px-2 py-1" style={{ color: 'var(--color-text-primary)' }}>Savings & Transfers</div>
              {transferCats.map(cat => renderCategoryRow(cat, summary))}
              {renderSectionTotal(transferCats, summary, 'Transfers Total')}
            </div>
          )}

          {/* Period Grand Total */}
          <div className="mt-3 mb-1 flex justify-between items-center py-2 px-2 text-sm font-bold rounded" style={{ backgroundColor: 'var(--color-bg-surface-soft)' }}>
            <span style={{ color: 'var(--color-text-primary)' }}>Period Total</span>
            <span className="w-20 text-right" style={{ color: 'var(--color-text-primary)' }}>{fmt(summary.total_budgeted)}</span>
            <span className="w-20 text-right" style={{ color: '#ef4444' }}>{fmt(summary.total_expenses)}</span>
            <span className="w-20 text-right" style={{ color: summary.expected_income - summary.total_expenses >= 0 ? '#22c55e' : '#ef4444' }}>
              {fmt(summary.expected_income - summary.total_expenses)}
            </span>
          </div>
        </div>
      </div>
    )
  }

  // Monthly totals
  const monthIncome = (firstHalf?.expected_income || 0) + (secondHalf?.expected_income || 0)
  const monthSpent = (firstHalf?.total_expenses || 0) + (secondHalf?.total_expenses || 0)
  const monthBudgeted = (firstHalf?.total_budgeted || 0) + (secondHalf?.total_budgeted || 0)
  const monthNet = monthIncome - monthSpent

  // Build money distribution data - how income from Money Market is distributed
  const buildDistribution = () => {
    const dist = []

    // Personal spending accounts
    const daneSpending = categories.find(c => c.name === 'Dane Spending')
    const kellySpending = categories.find(c => c.name === 'Kelly Spending')

    if (daneSpending) {
      const h1 = getCatData(firstHalf, daneSpending.id)
      const h2 = getCatData(secondHalf, daneSpending.id)
      dist.push({ name: "Dane's Spending", budgeted: h1.budgeted + h2.budgeted, spent: h1.spent + h2.spent })
    }
    if (kellySpending) {
      const h1 = getCatData(firstHalf, kellySpending.id)
      const h2 = getCatData(secondHalf, kellySpending.id)
      dist.push({ name: "Kelly's Spending", budgeted: h1.budgeted + h2.budgeted, spent: h1.spent + h2.spent })
    }

    // Main Checking (variable spending like Gas, Groceries, Main Spending goes through checking)
    const checkingCats = variableCats.filter(c => !['Dane Spending', 'Kelly Spending', 'Other', 'Roll Over'].includes(c.name))
    let checkingBudget = 0, checkingSpent = 0
    checkingCats.forEach(cat => {
      const h1 = getCatData(firstHalf, cat.id)
      const h2 = getCatData(secondHalf, cat.id)
      checkingBudget += h1.budgeted + h2.budgeted
      checkingSpent += h1.spent + h2.spent
    })
    // Add fixed bills to checking (bills are paid from checking/money market)
    let billsBudget = 0, billsSpent = 0
    fixedCats.forEach(cat => {
      const h1 = getCatData(firstHalf, cat.id)
      const h2 = getCatData(secondHalf, cat.id)
      billsBudget += h1.budgeted + h2.budgeted
      billsSpent += h1.spent + h2.spent
    })

    dist.push({ name: 'Main Checking (Bills & Variable)', budgeted: checkingBudget + billsBudget, spent: checkingSpent + billsSpent })

    // Transfers (Savings, House/Travel Fund)
    transferCats.forEach(cat => {
      const h1 = getCatData(firstHalf, cat.id)
      const h2 = getCatData(secondHalf, cat.id)
      dist.push({ name: cat.name, budgeted: h1.budgeted + h2.budgeted, spent: h1.spent + h2.spent })
    })

    return dist
  }

  const distribution = buildDistribution()
  const totalDistBudgeted = distribution.reduce((s, d) => s + d.budgeted, 0)
  const totalDistSpent = distribution.reduce((s, d) => s + d.spent, 0)

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <div className="flex items-center justify-between">
          <button onClick={goToPrevMonth} className="p-1 rounded hover:bg-gray-700">
            <ChevronLeft className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
          </button>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Monthly Budget - {monthNames[currentMonth - 1]} {currentYear}
          </h3>
          <button onClick={goToNextMonth} className="p-1 rounded hover:bg-gray-700">
            <ChevronRight className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
          </button>
        </div>
      </div>

      {/* Monthly Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Money In</span>
          </div>
          <span className="text-lg font-bold text-green-400">{fmt(monthIncome)}</span>
        </div>
        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Money Out</span>
          </div>
          <span className="text-lg font-bold" style={{ color: '#ef4444' }}>{fmt(monthSpent)}</span>
        </div>
        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="w-3.5 h-3.5" style={{ color: '#3b82f6' }} />
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Budgeted</span>
          </div>
          <span className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{fmt(monthBudgeted)}</span>
        </div>
        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="w-3.5 h-3.5" style={{ color: monthNet >= 0 ? '#22c55e' : '#ef4444' }} />
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Net</span>
          </div>
          <span className="text-lg font-bold" style={{ color: monthNet >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(monthNet)}</span>
        </div>
      </div>

      {/* Money Distribution from Money Market */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
          <h4 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
            <ArrowRightLeft className="w-4 h-4" style={{ color: '#3b82f6' }} />
            Money Market Distribution
          </h4>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            How income is distributed from Money Market each month
          </p>
        </div>

        {/* Distribution Column Headers */}
        <div className="flex justify-between items-center py-1.5 px-4 text-xs font-medium" style={{ backgroundColor: 'var(--color-bg-surface-soft)', color: 'var(--color-text-muted)' }}>
          <span className="flex-1">Destination</span>
          <span className="w-24 text-right">Budgeted</span>
          <span className="w-24 text-right">Actual</span>
          <span className="w-24 text-right">Remaining</span>
        </div>

        <div className="px-2 py-1">
          {/* Income source row */}
          <div className="flex justify-between items-center py-1.5 px-2 text-xs font-semibold rounded" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}>
            <span style={{ color: '#22c55e' }}>Total Income (Money Market)</span>
            <span className="w-24 text-right" style={{ color: '#22c55e' }}>{fmt(monthIncome)}</span>
            <span className="w-24" />
            <span className="w-24" />
          </div>

          {/* Distribution rows */}
          {distribution.map((d, i) => {
            const remaining = d.budgeted - d.spent
            return (
              <div key={i} className="flex justify-between items-center py-1.5 px-2 text-xs">
                <span className="flex-1" style={{ color: 'var(--color-text-secondary)' }}>{d.name}</span>
                <span className="w-24 text-right" style={{ color: 'var(--color-text-muted)' }}>{fmt(d.budgeted)}</span>
                <span className="w-24 text-right" style={{ color: d.spent > 0 ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                  {d.spent > 0 ? fmt(d.spent) : '-'}
                </span>
                <span className="w-24 text-right font-medium" style={{ color: remaining < 0 ? '#ef4444' : remaining > 0 ? '#22c55e' : 'var(--color-text-muted)' }}>
                  {d.budgeted > 0 || d.spent > 0 ? fmt(remaining) : '-'}
                </span>
              </div>
            )
          })}

          {/* Distribution total */}
          <div className="flex justify-between items-center py-2 px-2 text-xs font-bold mt-1" style={{ borderTop: '1px solid var(--color-border-default)' }}>
            <span style={{ color: 'var(--color-text-primary)' }}>Total Distributed</span>
            <span className="w-24 text-right" style={{ color: 'var(--color-text-primary)' }}>{fmt(totalDistBudgeted)}</span>
            <span className="w-24 text-right" style={{ color: 'var(--color-text-primary)' }}>{fmt(totalDistSpent)}</span>
            <span className="w-24 text-right" style={{ color: monthIncome - totalDistSpent >= 0 ? '#22c55e' : '#ef4444' }}>
              {fmt(monthIncome - totalDistSpent)}
            </span>
          </div>

          {/* Unallocated */}
          <div className="flex justify-between items-center py-1.5 px-2 text-xs font-semibold rounded mb-1" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
            <span style={{ color: '#3b82f6' }}>Unallocated (stays in Money Market)</span>
            <span className="w-24 text-right" style={{ color: '#3b82f6' }}>{fmt(monthIncome - totalDistBudgeted)}</span>
            <span className="w-24" />
            <span className="w-24" />
          </div>
        </div>
      </div>

      {/* Two Pay Periods */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {renderPeriodSection('Beginning of Month (1st - 14th)', firstHalf)}
        {renderPeriodSection('End of Month (15th - End)', secondHalf)}
      </div>
    </div>
  )
}

export default MonthlyBudget
