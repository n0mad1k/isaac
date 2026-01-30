import React, { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, DollarSign } from 'lucide-react'
import { getBudgetPeriodSummary, getBudgetPayPeriods, getBudgetIncome } from '../../services/api'

function MonthlyBudget() {
  const [loading, setLoading] = useState(true)
  const [firstHalf, setFirstHalf] = useState(null)
  const [secondHalf, setSecondHalf] = useState(null)
  const [incomes, setIncomes] = useState([])
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [periodsRes, incomeRes] = await Promise.all([
        getBudgetPayPeriods(currentYear, currentMonth),
        getBudgetIncome(),
      ])
      const periods = periodsRes.data || []
      setIncomes(incomeRes.data || [])

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

  const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)

  if (loading && !firstHalf) {
    return <div className="animate-pulse bg-gray-800 rounded-xl h-64" />
  }

  const renderPeriodSection = (label, data) => {
    if (!data) return null
    const totalBudget = data.total_budgeted || 0
    const totalSpent = data.total_expenses || 0
    const expectedIncome = data.expected_income || 0
    const remaining = expectedIncome - totalSpent

    return (
      <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
          <DollarSign className="w-4 h-4" style={{ color: 'var(--color-green-500, #22c55e)' }} />
          {label}
        </h4>

        {/* Income */}
        <div className="mb-3 pb-3" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
          <div className="flex justify-between text-sm mb-1">
            <span style={{ color: 'var(--color-text-secondary)' }}>Expected Income</span>
            <span className="font-medium text-green-400">{fmt(expectedIncome)}</span>
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-1.5 mb-3">
          {data.categories
            ?.filter(c => c.budgeted > 0 || c.spent > 0)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(cat => {
              const rem = cat.budgeted - cat.spent
              const over = cat.spent > cat.budgeted
              return (
                <div key={cat.id} className="flex justify-between text-xs">
                  <span style={{ color: 'var(--color-text-secondary)' }}>{cat.name}</span>
                  <div className="flex gap-3">
                    <span style={{ color: 'var(--color-text-muted)' }}>{fmt(cat.budgeted)}</span>
                    <span style={{ color: over ? '#ef4444' : 'var(--color-text-primary)' }}>{fmt(cat.spent)}</span>
                    <span className="w-20 text-right" style={{ color: over ? '#ef4444' : '#22c55e' }}>
                      {fmt(rem)}
                    </span>
                  </div>
                </div>
              )
            })}
        </div>

        {/* Totals */}
        <div className="pt-3 space-y-1" style={{ borderTop: '1px solid var(--color-border-default)' }}>
          <div className="flex justify-between text-sm font-medium">
            <span style={{ color: 'var(--color-text-primary)' }}>Total Budgeted</span>
            <span style={{ color: 'var(--color-text-primary)' }}>{fmt(totalBudget)}</span>
          </div>
          <div className="flex justify-between text-sm font-medium">
            <span style={{ color: 'var(--color-text-primary)' }}>Total Spent</span>
            <span style={{ color: '#ef4444' }}>{fmt(totalSpent)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold">
            <span style={{ color: 'var(--color-text-primary)' }}>Remaining</span>
            <span style={{ color: remaining >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(remaining)}</span>
          </div>
        </div>
      </div>
    )
  }

  // Calculate full month totals
  const monthIncome = (firstHalf?.expected_income || 0) + (secondHalf?.expected_income || 0)
  const monthSpent = (firstHalf?.total_expenses || 0) + (secondHalf?.total_expenses || 0)
  const monthBudgeted = (firstHalf?.total_budgeted || 0) + (secondHalf?.total_budgeted || 0)
  const monthRemaining = monthIncome - monthSpent

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <div className="flex items-center justify-between">
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
      </div>

      {/* Monthly Summary */}
      <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Monthly Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <span className="text-xs block" style={{ color: 'var(--color-text-muted)' }}>Income</span>
            <span className="text-lg font-bold text-green-400">{fmt(monthIncome)}</span>
          </div>
          <div>
            <span className="text-xs block" style={{ color: 'var(--color-text-muted)' }}>Budgeted</span>
            <span className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{fmt(monthBudgeted)}</span>
          </div>
          <div>
            <span className="text-xs block" style={{ color: 'var(--color-text-muted)' }}>Spent</span>
            <span className="text-lg font-bold" style={{ color: '#ef4444' }}>{fmt(monthSpent)}</span>
          </div>
          <div>
            <span className="text-xs block" style={{ color: 'var(--color-text-muted)' }}>Remaining</span>
            <span className="text-lg font-bold" style={{ color: monthRemaining >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(monthRemaining)}</span>
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div className="flex justify-end gap-3 text-xs px-4" style={{ color: 'var(--color-text-muted)' }}>
        <span className="w-16 text-right">Budget</span>
        <span className="w-16 text-right">Spent</span>
        <span className="w-20 text-right">Remaining</span>
      </div>

      {/* Pay Period Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderPeriodSection('Beginning of Month (1st - 14th)', firstHalf)}
        {renderPeriodSection('End of Month (15th - End)', secondHalf)}
      </div>
    </div>
  )
}

export default MonthlyBudget
