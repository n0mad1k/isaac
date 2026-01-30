import React, { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Plus, Check, X, Trash2 } from 'lucide-react'
import {
  getBudgetCategories, getBudgetPeriodSummary, getBudgetPayPeriods,
  getBudgetIncome, updateBudgetCategory
} from '../../services/api'

function BillsSummary() {
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState([])
  const [income, setIncome] = useState([])
  const [summary, setSummary] = useState(null)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [catRes, periodsRes, incomeRes] = await Promise.all([
        getBudgetCategories(),
        getBudgetPayPeriods(currentYear, currentMonth),
        getBudgetIncome(),
      ])
      setCategories(catRes.data || [])
      setIncome(incomeRes.data || [])

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

  const startEdit = (catId, value) => {
    setEditingId(catId)
    setEditValue(String(value))
  }

  const saveEdit = async () => {
    if (!editingId || saving) return
    setSaving(true)
    try {
      await updateBudgetCategory(editingId, { monthly_budget: parseFloat(editValue) || 0 })
      setEditingId(null)
      fetchData()
    } catch (err) {
      console.error('Failed to update:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading && !summary) {
    return <div className="animate-pulse bg-gray-800 rounded-xl h-64" />
  }

  // Calculate total income for the month
  const totalMoneyIn = summary?.expected_income || 0

  // All bill categories (fixed + transfer + variable spending allocations)
  // Match Excel: every outgoing line item
  const allCats = categories.filter(c => c.is_active)
  const fixedCats = allCats.filter(c => c.category_type === 'fixed')
  const variableCats = allCats.filter(c => c.category_type === 'variable')
  const transferCats = allCats.filter(c => c.category_type === 'transfer')

  // Build bill lines - everything that costs money
  const billLines = []

  // Income lines
  income.filter(i => i.is_active).forEach(inc => {
    billLines.push({ type: 'income', name: inc.name, amount: inc.amount * (inc.frequency === 'weekly' ? 4.33 : inc.frequency === 'biweekly' ? 2.17 : inc.frequency === 'semimonthly' ? 2 : 1) })
  })

  // Fixed bills
  fixedCats.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)).forEach(cat => {
    const amt = cat.monthly_budget || cat.budget_amount * 2 || 0
    billLines.push({ type: 'bill', id: cat.id, name: cat.name, amount: -Math.abs(amt) })
  })

  // Variable spending
  variableCats.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)).forEach(cat => {
    const amt = cat.monthly_budget || cat.budget_amount * 2 || 0
    if (amt > 0) billLines.push({ type: 'bill', id: cat.id, name: cat.name, amount: -Math.abs(amt) })
  })

  // Transfers/Savings
  transferCats.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)).forEach(cat => {
    const amt = cat.monthly_budget || cat.budget_amount * 2 || 0
    if (amt > 0) billLines.push({ type: 'bill', id: cat.id, name: cat.name, amount: -Math.abs(amt) })
  })

  const totalBills = billLines.filter(l => l.type === 'bill').reduce((s, l) => s + l.amount, 0)
  const moneyAfterBills = totalMoneyIn + totalBills

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

      {/* Bills Table */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        {/* Header */}
        <div className="grid grid-cols-2 text-xs font-semibold py-2 px-3" style={{ backgroundColor: '#ef4444', color: '#fff' }}>
          <span>Description</span>
          <span className="text-right">Amount</span>
        </div>

        {/* Income lines */}
        {income.filter(i => i.is_active).map(inc => {
          // Rough monthly amount
          const monthlyAmt = inc.frequency === 'weekly' ? inc.amount * 4.33
            : inc.frequency === 'biweekly' ? inc.amount * 2.17
            : inc.frequency === 'semimonthly' ? inc.amount * 2
            : inc.amount
          return (
            <div key={`inc-${inc.id}`} className="grid grid-cols-2 text-sm py-2 px-3" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
              <span style={{ color: 'var(--color-text-primary)' }}>{inc.name}</span>
              <span className="text-right" style={{ color: 'var(--color-text-primary)' }}>{fmt(monthlyAmt)}</span>
            </div>
          )
        })}

        {/* Bill lines */}
        {[...fixedCats, ...variableCats, ...transferCats]
          .filter(cat => {
            const amt = cat.monthly_budget || cat.budget_amount * 2 || 0
            return amt > 0
          })
          .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
          .map(cat => {
            const amt = cat.monthly_budget || cat.budget_amount * 2 || 0
            const isEditing = editingId === cat.id
            return (
              <div key={cat.id} className="grid grid-cols-2 text-sm py-2 px-3 items-center" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                <span style={{ color: 'var(--color-text-primary)' }}>{cat.name}</span>
                {isEditing ? (
                  <span className="flex items-center justify-end gap-1">
                    <input
                      type="number"
                      step="0.01"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null) }}
                      className="w-24 px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-sm text-right"
                      style={{ color: 'var(--color-text-primary)' }}
                      autoFocus
                    />
                    <button onClick={saveEdit} className="p-0.5 text-green-400"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditingId(null)} className="p-0.5 text-gray-400"><X className="w-4 h-4" /></button>
                  </span>
                ) : (
                  <span
                    className="text-right cursor-pointer hover:underline"
                    style={{ color: '#ef4444' }}
                    onClick={() => startEdit(cat.id, amt)}
                    title="Click to edit"
                  >
                    -{fmt(amt)}
                  </span>
                )}
              </div>
            )
          })}

        {/* Summary rows */}
        <div className="py-1" style={{ borderTop: '2px solid var(--color-border-default)' }}>
          <div className="grid grid-cols-2 text-sm font-bold py-2 px-3">
            <span style={{ color: 'var(--color-text-primary)' }}>Total Money In</span>
            <span className="text-right" style={{ color: 'var(--color-text-primary)' }}>{fmt(totalMoneyIn)}</span>
          </div>
          <div className="grid grid-cols-2 text-sm font-bold py-2 px-3">
            <span style={{ color: 'var(--color-text-primary)' }}>Bills</span>
            <span className="text-right" style={{ color: '#ef4444' }}>{fmt(totalBills)}</span>
          </div>
          <div className="grid grid-cols-2 text-sm font-bold py-2 px-3">
            <span style={{ color: 'var(--color-text-primary)' }}>Money After Bills</span>
            <span className="text-right" style={{ color: moneyAfterBills >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(moneyAfterBills)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BillsSummary
