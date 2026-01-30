import React, { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Receipt, Plus, Check, X, Pencil } from 'lucide-react'
import {
  getBudgetCategories, getBudgetPeriodSummary, getBudgetPayPeriods,
  getBudgetAccounts, updateBudgetCategory, createBudgetTransaction
} from '../../services/api'

function BillsSummary() {
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [summary, setSummary] = useState(null)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)

  // Editing state
  const [editingAmount, setEditingAmount] = useState(null) // catId being edited
  const [editValue, setEditValue] = useState('')
  const [addingTxn, setAddingTxn] = useState(null) // catId for adding transaction
  const [txnForm, setTxnForm] = useState({ description: '', amount: '', date: '' })
  const [saving, setSaving] = useState(false)

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [catRes, periodsRes, acctRes] = await Promise.all([
        getBudgetCategories(),
        getBudgetPayPeriods(currentYear, currentMonth),
        getBudgetAccounts(),
      ])
      setCategories(catRes.data || [])
      setAccounts(acctRes.data || [])

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

  // Edit bill amount (monthly_budget)
  const startEditAmount = (cat) => {
    const value = cat.monthly_budget || cat.budget_amount * 2 || 0
    setEditingAmount(cat.id)
    setEditValue(String(value))
  }

  const saveEditAmount = async () => {
    if (!editingAmount || saving) return
    setSaving(true)
    try {
      await updateBudgetCategory(editingAmount, { monthly_budget: parseFloat(editValue) || 0 })
      setEditingAmount(null)
      fetchData()
    } catch (err) {
      console.error('Failed to update bill amount:', err)
    } finally {
      setSaving(false)
    }
  }

  // Add transaction (pay bill)
  const startAddTxn = (cat) => {
    const budgeted = cat.monthly_budget || cat.budget_amount * 2 || 0
    const today = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
    setAddingTxn(cat.id)
    setTxnForm({ description: cat.name, amount: String(budgeted), date: today })
  }

  const saveAddTxn = async () => {
    if (!addingTxn || saving || !txnForm.description || !txnForm.amount) return
    setSaving(true)
    try {
      const defaultAcct = accounts.find(a => a.account_type === 'checking') || accounts[0]
      await createBudgetTransaction({
        account_id: defaultAcct?.id || 1,
        category_id: addingTxn,
        transaction_date: txnForm.date,
        description: txnForm.description,
        amount: -Math.abs(parseFloat(txnForm.amount)),
        transaction_type: 'debit',
      })
      setAddingTxn(null)
      setTxnForm({ description: '', amount: '', date: '' })
      fetchData()
    } catch (err) {
      console.error('Failed to add bill payment:', err)
    } finally {
      setSaving(false)
    }
  }

  // Mark bill as paid (quick pay with full amount)
  const markAsPaid = async (cat) => {
    if (saving) return
    const budgeted = cat.monthly_budget || cat.budget_amount * 2 || 0
    if (budgeted <= 0) return
    setSaving(true)
    try {
      const defaultAcct = accounts.find(a => a.account_type === 'checking') || accounts[0]
      const today = new Date().toISOString().split('T')[0]
      await createBudgetTransaction({
        account_id: defaultAcct?.id || 1,
        category_id: cat.id,
        transaction_date: today,
        description: cat.name,
        amount: -Math.abs(budgeted),
        transaction_type: 'debit',
      })
      fetchData()
    } catch (err) {
      console.error('Failed to mark bill as paid:', err)
    } finally {
      setSaving(false)
    }
  }

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
              const isEditingThis = editingAmount === cat.id
              const isAddingThis = addingTxn === cat.id

              return (
                <div key={cat.id}>
                  <div className="flex items-center justify-between px-2 py-2 rounded-lg group" style={{ backgroundColor: 'var(--color-bg-surface-soft)' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{cat.name}</span>
                      <button
                        onClick={() => startAddTxn(cat)}
                        className="p-0.5 rounded hover:bg-gray-700"
                        title="Add payment"
                      >
                        <Plus className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
                      </button>
                    </div>
                    <div className="flex gap-4 items-center">
                      {isEditingThis ? (
                        <span className="w-20 flex items-center gap-0.5 justify-end">
                          <input
                            type="number"
                            step="0.01"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveEditAmount(); if (e.key === 'Escape') setEditingAmount(null); }}
                            className="w-16 px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-xs text-right"
                            style={{ color: 'var(--color-text-primary)' }}
                            autoFocus
                          />
                          <button onClick={saveEditAmount} className="p-0.5 text-green-400 hover:text-green-300">
                            <Check className="w-3 h-3" />
                          </button>
                        </span>
                      ) : (
                        <span className="w-20 flex items-center justify-end gap-0.5 text-xs">
                          <button
                            onClick={() => startEditAmount(cat)}
                            className="p-0.5 rounded hover:bg-gray-700"
                            title="Edit amount"
                          >
                            <Pencil className="w-3 h-3" style={{ color: 'var(--color-text-muted)' }} />
                          </button>
                          <span style={{ color: 'var(--color-text-muted)' }}>{fmt(budgeted)}</span>
                        </span>
                      )}
                      <span className="w-16 text-right text-xs" style={{ color: spent > 0 ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                        {spent > 0 ? fmt(spent) : '-'}
                      </span>
                      {!isPaid && budgeted > 0 && spent === 0 ? (
                        <button
                          onClick={() => markAsPaid(cat)}
                          disabled={saving}
                          className="w-16 text-right text-xs font-medium px-1.5 py-0.5 rounded bg-gray-700 text-gray-500 hover:bg-green-900/40 hover:text-green-400 transition-colors cursor-pointer"
                          title="Click to mark as paid"
                        >
                          Due
                        </button>
                      ) : (
                        <span className={`w-16 text-right text-xs font-medium px-1.5 py-0.5 rounded ${
                          isPaid
                            ? 'bg-green-900/40 text-green-400'
                            : spent > 0
                              ? 'bg-yellow-900/40 text-yellow-400'
                              : 'bg-gray-700 text-gray-500'
                        }`}>
                          {isPaid ? 'Paid' : spent > 0 ? 'Partial' : 'Due'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Inline add transaction form */}
                  {isAddingThis && (
                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-800/50 rounded mx-2 mt-1">
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
