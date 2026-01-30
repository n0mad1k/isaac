import React, { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, DollarSign, TrendingUp, TrendingDown, ArrowRightLeft, Plus, Edit, Check, X } from 'lucide-react'
import {
  getBudgetPeriodSummary, getBudgetPayPeriods, getBudgetCategories, getBudgetAccounts,
  updateBudgetCategory, createBudgetTransaction
} from '../../services/api'

function MonthlyBudget() {
  const [loading, setLoading] = useState(true)
  const [firstHalf, setFirstHalf] = useState(null)
  const [secondHalf, setSecondHalf] = useState(null)
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)

  // Editing state
  const [editingBudget, setEditingBudget] = useState(null) // { catId, field: 'budget_amount'|'monthly_budget' }
  const [editValue, setEditValue] = useState('')
  const [addingTxn, setAddingTxn] = useState(null) // { catId, period: 'first'|'second' }
  const [txnForm, setTxnForm] = useState({ description: '', amount: '', date: '' })
  const [saving, setSaving] = useState(false)

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

  // Edit budget amount
  const startEditBudget = (cat) => {
    const isFixed = cat.category_type === 'fixed'
    const field = isFixed ? 'monthly_budget' : 'budget_amount'
    const value = isFixed ? (cat.monthly_budget || cat.budget_amount * 2 || 0) : (cat.budget_amount || 0)
    setEditingBudget({ catId: cat.id, field })
    setEditValue(String(value))
  }

  const saveEditBudget = async () => {
    if (!editingBudget || saving) return
    setSaving(true)
    try {
      const update = { [editingBudget.field]: parseFloat(editValue) || 0 }
      await updateBudgetCategory(editingBudget.catId, update)
      setEditingBudget(null)
      fetchData()
    } catch (err) {
      console.error('Failed to update budget:', err)
    } finally {
      setSaving(false)
    }
  }

  // Add transaction
  const startAddTxn = (catId, period) => {
    const midMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${period === 'first' ? '07' : '20'}`
    setAddingTxn({ catId, period })
    setTxnForm({ description: '', amount: '', date: midMonth })
  }

  const saveAddTxn = async () => {
    if (!addingTxn || saving || !txnForm.description || !txnForm.amount) return
    setSaving(true)
    try {
      const defaultAcct = accounts.find(a => a.account_type === 'checking') || accounts[0]
      await createBudgetTransaction({
        account_id: defaultAcct?.id || 1,
        category_id: addingTxn.catId,
        transaction_date: txnForm.date,
        description: txnForm.description,
        amount: -Math.abs(parseFloat(txnForm.amount)),
        transaction_type: 'debit',
      })
      setAddingTxn(null)
      setTxnForm({ description: '', amount: '', date: '' })
      fetchData()
    } catch (err) {
      console.error('Failed to add transaction:', err)
    } finally {
      setSaving(false)
    }
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

  const renderCategoryRow = (cat, summary, periodKey) => {
    const data = getCatData(summary, cat.id)
    const over = data.spent > data.budgeted && data.budgeted > 0
    const isEditing = editingBudget?.catId === cat.id
    const isAdding = addingTxn?.catId === cat.id && addingTxn?.period === periodKey

    return (
      <div key={`${cat.id}-${periodKey}`}>
        <div className="flex justify-between items-center py-1 px-2 text-xs group">
          <span className="flex-1 flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}>
            {cat.name}
          </span>
          <button
            onClick={() => startAddTxn(cat.id, periodKey)}
            className="p-0.5 rounded hover:bg-gray-700 mr-1"
            title="Add transaction"
          >
            <Plus className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
          </button>
          {isEditing ? (
            <span className="w-20 flex items-center gap-0.5">
              <input
                type="number"
                step="0.01"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveEditBudget(); if (e.key === 'Escape') setEditingBudget(null); }}
                className="w-16 px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-xs text-right"
                style={{ color: 'var(--color-text-primary)' }}
                autoFocus
              />
              <button onClick={saveEditBudget} className="p-0.5 text-green-400 hover:text-green-300">
                <Check className="w-3 h-3" />
              </button>
            </span>
          ) : (
            <span className="w-20 flex items-center justify-end gap-0.5">
              <button
                onClick={() => startEditBudget(cat)}
                className="p-0.5 rounded hover:bg-gray-700"
                title="Edit budget"
              >
                <Edit className="w-3 h-3" style={{ color: 'var(--color-text-muted)' }} />
              </button>
              <span className="text-right" style={{ color: 'var(--color-text-muted)' }}>
                {fmt(data.budgeted)}
              </span>
            </span>
          )}
          <span className="w-20 text-right" style={{ color: data.spent > 0 ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
            {data.spent > 0 ? fmt(data.spent) : '-'}
          </span>
          <span className="w-20 text-right font-medium" style={{ color: over ? '#ef4444' : data.remaining > 0 ? '#22c55e' : 'var(--color-text-muted)' }}>
            {data.budgeted > 0 || data.spent > 0 ? fmt(data.remaining) : '-'}
          </span>
        </div>

        {/* Inline add transaction form */}
        {isAdding && (
          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-800/50 rounded mx-2 mb-1">
            <input
              type="date"
              value={txnForm.date}
              onChange={(e) => setTxnForm(f => ({ ...f, date: e.target.value }))}
              className="w-28 px-1 py-0.5 bg-gray-900 border border-gray-700 rounded text-xs"
              style={{ color: 'var(--color-text-primary)' }}
            />
            <input
              type="text"
              placeholder="Description"
              value={txnForm.description}
              onChange={(e) => setTxnForm(f => ({ ...f, description: e.target.value }))}
              className="flex-1 px-1 py-0.5 bg-gray-900 border border-gray-700 rounded text-xs"
              style={{ color: 'var(--color-text-primary)' }}
              autoFocus
            />
            <input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={txnForm.amount}
              onChange={(e) => setTxnForm(f => ({ ...f, amount: e.target.value }))}
              className="w-20 px-1 py-0.5 bg-gray-900 border border-gray-700 rounded text-xs text-right"
              style={{ color: 'var(--color-text-primary)' }}
            />
            <button onClick={saveAddTxn} disabled={saving} className="p-0.5 text-green-400 hover:text-green-300">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setAddingTxn(null)} className="p-0.5 text-gray-400 hover:text-gray-300">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
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

  const renderPeriodSection = (label, summary, periodKey) => {
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
              {variableCats.map(cat => renderCategoryRow(cat, summary, periodKey))}
              {renderSectionTotal(variableCats, summary, 'Variable Total')}
            </div>
          )}

          {/* Fixed Bills */}
          {fixedCats.length > 0 && (
            <div className="mt-2">
              <div className="text-xs font-semibold px-2 py-1" style={{ color: 'var(--color-text-primary)' }}>Bills & Fixed Expenses</div>
              {fixedCats.map(cat => renderCategoryRow(cat, summary, periodKey))}
              {renderSectionTotal(fixedCats, summary, 'Bills Total')}
            </div>
          )}

          {/* Transfers */}
          {transferCats.length > 0 && (
            <div className="mt-2">
              <div className="text-xs font-semibold px-2 py-1" style={{ color: 'var(--color-text-primary)' }}>Savings & Transfers</div>
              {transferCats.map(cat => renderCategoryRow(cat, summary, periodKey))}
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

  // Monthly totals - broken down like Excel: Income, Bills, Spending, Remaining
  const monthIncome = (firstHalf?.expected_income || 0) + (secondHalf?.expected_income || 0)
  let monthBills = 0, monthSpending = 0, monthSavings = 0
  fixedCats.forEach(cat => {
    const h1 = getCatData(firstHalf, cat.id)
    const h2 = getCatData(secondHalf, cat.id)
    monthBills += h1.budgeted + h2.budgeted
  })
  variableCats.forEach(cat => {
    const h1 = getCatData(firstHalf, cat.id)
    const h2 = getCatData(secondHalf, cat.id)
    monthSpending += h1.budgeted + h2.budgeted
  })
  transferCats.forEach(cat => {
    const h1 = getCatData(firstHalf, cat.id)
    const h2 = getCatData(secondHalf, cat.id)
    monthSavings += h1.budgeted + h2.budgeted
  })
  const monthRemaining = monthIncome - monthBills - monthSpending - monthSavings

  // Build money distribution data
  const buildDistribution = () => {
    const dist = []
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

    const checkingCats = variableCats.filter(c => !['Dane Spending', 'Kelly Spending', 'Other', 'Roll Over'].includes(c.name))
    let checkingBudget = 0, checkingSpent = 0
    checkingCats.forEach(cat => {
      const h1 = getCatData(firstHalf, cat.id)
      const h2 = getCatData(secondHalf, cat.id)
      checkingBudget += h1.budgeted + h2.budgeted
      checkingSpent += h1.spent + h2.spent
    })
    let billsBudget = 0, billsSpent = 0
    fixedCats.forEach(cat => {
      const h1 = getCatData(firstHalf, cat.id)
      const h2 = getCatData(secondHalf, cat.id)
      billsBudget += h1.budgeted + h2.budgeted
      billsSpent += h1.spent + h2.spent
    })
    dist.push({ name: 'Main Checking (Bills & Variable)', budgeted: checkingBudget + billsBudget, spent: checkingSpent + billsSpent })

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

      {/* Monthly Summary Cards - matches Excel: Income, Bills, Spending, Remaining */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Money In</span>
          </div>
          <span className="text-lg font-bold" style={{ color: '#22c55e' }}>{fmt(monthIncome)}</span>
        </div>
        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Bills</span>
          </div>
          <span className="text-lg font-bold" style={{ color: '#ef4444' }}>{fmt(monthBills)}</span>
        </div>
        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Spending</span>
          </div>
          <span className="text-lg font-bold" style={{ color: '#f59e0b' }}>{fmt(monthSpending)}</span>
        </div>
        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="w-3.5 h-3.5" style={{ color: monthRemaining >= 0 ? '#22c55e' : '#ef4444' }} />
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Remaining</span>
          </div>
          <span className="text-lg font-bold" style={{ color: monthRemaining >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(monthRemaining)}</span>
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

        <div className="flex justify-between items-center py-1.5 px-4 text-xs font-medium" style={{ backgroundColor: 'var(--color-bg-surface-soft)', color: 'var(--color-text-muted)' }}>
          <span className="flex-1">Destination</span>
          <span className="w-24 text-right">Budgeted</span>
          <span className="w-24 text-right">Actual</span>
          <span className="w-24 text-right">Remaining</span>
        </div>

        <div className="px-2 py-1">
          <div className="flex justify-between items-center py-1.5 px-2 text-xs font-semibold rounded" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}>
            <span style={{ color: '#22c55e' }}>Total Income (Money Market)</span>
            <span className="w-24 text-right" style={{ color: '#22c55e' }}>{fmt(monthIncome)}</span>
            <span className="w-24" />
            <span className="w-24" />
          </div>

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

          <div className="flex justify-between items-center py-2 px-2 text-xs font-bold mt-1" style={{ borderTop: '1px solid var(--color-border-default)' }}>
            <span style={{ color: 'var(--color-text-primary)' }}>Total Distributed</span>
            <span className="w-24 text-right" style={{ color: 'var(--color-text-primary)' }}>{fmt(totalDistBudgeted)}</span>
            <span className="w-24 text-right" style={{ color: 'var(--color-text-primary)' }}>{fmt(totalDistSpent)}</span>
            <span className="w-24 text-right" style={{ color: monthIncome - totalDistSpent >= 0 ? '#22c55e' : '#ef4444' }}>
              {fmt(monthIncome - totalDistSpent)}
            </span>
          </div>

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
        {renderPeriodSection('Beginning of Month (1st - 14th)', firstHalf, 'first')}
        {renderPeriodSection('End of Month (15th - End)', secondHalf, 'second')}
      </div>
    </div>
  )
}

export default MonthlyBudget
