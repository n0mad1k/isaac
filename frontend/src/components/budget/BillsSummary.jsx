import React, { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Receipt } from 'lucide-react'
import { getBudgetCategories, getBudgetPeriodSummary, getBudgetPayPeriods } from '../../services/api'

function BillsSummary() {
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState([])
  const [summary, setSummary] = useState(null)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [catRes, periodsRes] = await Promise.all([
        getBudgetCategories(),
        getBudgetPayPeriods(currentYear, currentMonth),
      ])
      setCategories(catRes.data || [])

      // Get full month summary
      const periods = periodsRes.data || []
      if (periods.length >= 2) {
        const res = await getBudgetPeriodSummary(periods[0].start, periods[1].end)
        setSummary(res.data)
      }
    } catch (err) {
      console.error('Failed to fetch bills data:', err)
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

  if (loading && !summary) {
    return <div className="animate-pulse bg-gray-800 rounded-xl h-64" />
  }

  // Filter to only fixed/bill categories
  const fixedCategories = categories.filter(c => c.category_type === 'fixed')
  const fixedCatIds = new Set(fixedCategories.map(c => c.id))

  // Get spending data for bill categories from summary
  const billData = summary?.categories?.filter(c => fixedCatIds.has(c.id)) || []
  const totalBills = billData.reduce((sum, b) => sum + (b.budgeted || 0), 0)
  const totalPaid = billData.reduce((sum, b) => sum + (b.spent || 0), 0)
  const totalRemaining = totalBills - totalPaid

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <div className="flex items-center justify-between">
          <button onClick={goToPrevMonth} className="p-1 rounded hover:bg-gray-700">
            <ChevronLeft className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
          </button>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Bills - {monthNames[currentMonth - 1]} {currentYear}
          </h3>
          <button onClick={goToNextMonth} className="p-1 rounded hover:bg-gray-700">
            <ChevronRight className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <span className="text-xs block" style={{ color: 'var(--color-text-muted)' }}>Total Bills</span>
          <span className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{fmt(totalBills)}</span>
        </div>
        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <span className="text-xs block" style={{ color: 'var(--color-text-muted)' }}>Paid</span>
          <span className="text-lg font-bold text-green-400">{fmt(totalPaid)}</span>
        </div>
        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <span className="text-xs block" style={{ color: 'var(--color-text-muted)' }}>Remaining</span>
          <span className="text-lg font-bold" style={{ color: totalRemaining > 0 ? '#eab308' : '#22c55e' }}>{fmt(totalRemaining)}</span>
        </div>
      </div>

      {/* Bills List */}
      <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
          <Receipt className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
          Monthly Bills
        </h4>

        {/* Header */}
        <div className="flex justify-between text-xs mb-2 px-1" style={{ color: 'var(--color-text-muted)' }}>
          <span>Bill</span>
          <div className="flex gap-4">
            <span className="w-20 text-right">Amount</span>
            <span className="w-16 text-right">Paid</span>
            <span className="w-16 text-right">Status</span>
          </div>
        </div>

        <div className="space-y-1">
          {fixedCategories
            .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
            .map(cat => {
              const data = billData.find(b => b.id === cat.id) || {}
              const budgeted = cat.monthly_budget || cat.budget_amount * 2 || 0
              const spent = data.spent || 0
              const isPaid = spent >= budgeted && budgeted > 0

              return (
                <div key={cat.id} className="flex items-center justify-between px-2 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg-surface-soft)' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{cat.name}</span>
                  </div>
                  <div className="flex gap-4 items-center">
                    <span className="w-20 text-right text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {fmt(budgeted)}
                    </span>
                    <span className="w-16 text-right text-xs" style={{ color: spent > 0 ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                      {spent > 0 ? fmt(spent) : '-'}
                    </span>
                    <span className={`w-16 text-right text-xs font-medium px-1.5 py-0.5 rounded ${
                      isPaid
                        ? 'bg-green-900/40 text-green-400'
                        : spent > 0
                          ? 'bg-yellow-900/40 text-yellow-400'
                          : 'bg-gray-700 text-gray-500'
                    }`}>
                      {isPaid ? 'Paid' : spent > 0 ? 'Partial' : 'Due'}
                    </span>
                  </div>
                </div>
              )
            })}
        </div>

        {fixedCategories.length === 0 && (
          <p className="text-sm text-center py-6" style={{ color: 'var(--color-text-muted)' }}>
            No bills set up yet. Add categories with type "Fixed" in Settings to track bills.
          </p>
        )}

        {/* Total Row */}
        {fixedCategories.length > 0 && (
          <div className="flex justify-between items-center mt-3 pt-3 px-2" style={{ borderTop: '1px solid var(--color-border-default)' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Total</span>
            <div className="flex gap-4">
              <span className="w-20 text-right text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{fmt(totalBills)}</span>
              <span className="w-16 text-right text-sm font-medium text-green-400">{fmt(totalPaid)}</span>
              <span className="w-16" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default BillsSummary
