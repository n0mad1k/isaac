import React, { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, Check, X, Trash2 } from 'lucide-react'
import {
  getBudgetCategories, getBudgetPeriodSummary, getBudgetPayPeriods,
  getBudgetIncome, getBudgetAccounts,
  createBudgetIncome, updateBudgetIncome, deleteBudgetIncome,
  createBudgetCategory, updateBudgetCategory, deleteBudgetCategory
} from '../../services/api'

function BillsSummary() {
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState([])
  const [income, setIncome] = useState([])
  const [accounts, setAccounts] = useState([])
  const [summary, setSummary] = useState(null)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)

  // Editing state: { type: 'income'|'bill', id, field: 'name'|'amount'|'bill_day'|'pay_day' }
  const [editing, setEditing] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  // Adding state
  const [addingIncome, setAddingIncome] = useState(false)
  const [addingBill, setAddingBill] = useState(false)
  const [newName, setNewName] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newDay, setNewDay] = useState('')
  const [newBillingMonths, setNewBillingMonths] = useState('')

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [catRes, periodsRes, incomeRes, accountsRes] = await Promise.all([
        getBudgetCategories(),
        getBudgetPayPeriods(currentYear, currentMonth),
        getBudgetIncome(),
        getBudgetAccounts(),
      ])
      setCategories(catRes.data || [])
      setIncome(incomeRes.data || [])
      setAccounts(accountsRes.data || [])

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

  const ordinal = (d) => {
    if (!d) return ''
    const s = ['th', 'st', 'nd', 'rd']
    const v = d % 100
    return d + (s[(v - 20) % 10] || s[v] || s[0])
  }

  // --- Editing ---
  const startEdit = (type, id, field, value) => {
    setEditing({ type, id, field })
    setEditValue(String(value ?? ''))
  }

  const cancelEdit = () => {
    setEditing(null)
    setEditValue('')
  }

  const saveEdit = async () => {
    if (!editing || saving) return
    setSaving(true)
    try {
      if (editing.type === 'income') {
        const update = {}
        if (editing.field === 'name') update.name = editValue
        if (editing.field === 'amount') update.amount = parseFloat(editValue) || 0
        if (editing.field === 'pay_day') update.pay_day = parseInt(editValue) || 1
        await updateBudgetIncome(editing.id, update)
      } else {
        const update = {}
        if (editing.field === 'name') update.name = editValue
        if (editing.field === 'amount') update.monthly_budget = parseFloat(editValue) || 0
        if (editing.field === 'bill_day') update.bill_day = parseInt(editValue) || null
        await updateBudgetCategory(editing.id, update)
      }
      cancelEdit()
      fetchData()
    } catch (err) {
      console.error('Failed to update:', err)
    } finally {
      setSaving(false)
    }
  }

  // --- Adding ---
  const saveNewIncome = async () => {
    if (!newName.trim() || saving) return
    setSaving(true)
    try {
      const defaultAccount = accounts.length > 0 ? accounts[0].id : 1
      await createBudgetIncome({
        name: newName.trim(),
        amount: parseFloat(newAmount) || 0,
        frequency: 'monthly',
        pay_day: parseInt(newDay) || 1,
        account_id: defaultAccount,
      })
      setAddingIncome(false)
      setNewName('')
      setNewAmount('')
      setNewDay('')
      fetchData()
    } catch (err) {
      console.error('Failed to add income:', err)
    } finally {
      setSaving(false)
    }
  }

  const saveNewBill = async () => {
    if (!newName.trim() || saving) return
    setSaving(true)
    try {
      await createBudgetCategory({
        name: newName.trim(),
        category_type: 'fixed',
        monthly_budget: parseFloat(newAmount) || 0,
        budget_amount: 0,
        bill_day: parseInt(newDay) || null,
        billing_months: newBillingMonths.trim() || null,
      })
      setAddingBill(false)
      setNewName('')
      setNewAmount('')
      setNewDay('')
      fetchData()
    } catch (err) {
      console.error('Failed to add bill:', err)
    } finally {
      setSaving(false)
    }
  }

  // --- Deleting ---
  const deleteIncomeItem = async (id) => {
    if (saving) return
    setSaving(true)
    try {
      await deleteBudgetIncome(id)
      fetchData()
    } catch (err) {
      console.error('Failed to delete income:', err)
    } finally {
      setSaving(false)
    }
  }

  const deleteBillItem = async (id) => {
    if (saving) return
    setSaving(true)
    try {
      await deleteBudgetCategory(id)
      fetchData()
    } catch (err) {
      console.error('Failed to delete bill:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading && !summary) {
    return <div className="animate-pulse bg-gray-800 rounded-xl h-64" />
  }

  const totalMoneyIn = summary?.expected_income || 0

  // Only show bills active in the current month
  const isActiveThisMonth = (cat) => {
    if (!cat.billing_months) return true
    const months = cat.billing_months.split(',').map(m => parseInt(m.trim()))
    return months.includes(currentMonth)
  }

  const allCats = categories.filter(c => c.is_active)
  const billCats = [...allCats.filter(c => c.category_type === 'fixed'),
    ...allCats.filter(c => c.category_type === 'variable'),
    ...allCats.filter(c => c.category_type === 'transfer')]
    .filter(cat => {
      const amt = cat.monthly_budget || cat.budget_amount * 2 || 0
      return amt > 0 && isActiveThisMonth(cat)
    })
    .sort((a, b) => (a.bill_day || 99) - (b.bill_day || 99) || a.sort_order - b.sort_order || a.name.localeCompare(b.name))

  const totalBills = billCats.reduce((s, cat) => {
    const amt = cat.monthly_budget || cat.budget_amount * 2 || 0
    return s - Math.abs(amt)
  }, 0)
  const moneyAfterBills = totalMoneyIn + totalBills

  const activeIncome = income.filter(i => i.is_active).sort((a, b) => (a.pay_day || 0) - (b.pay_day || 0))

  // Editable cell renderer
  const renderCell = (type, id, field, displayValue, rawValue, align = 'left') => {
    const isEditing = editing && editing.type === type && editing.id === id && editing.field === field
    if (isEditing) {
      return (
        <span className="flex items-center gap-1">
          <input
            type={field === 'name' ? 'text' : 'number'}
            step={field === 'amount' ? '0.01' : '1'}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }}
            className={`w-full px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-sm ${align === 'right' ? 'text-right' : ''}`}
            style={{ color: 'var(--color-text-primary)' }}
            autoFocus
          />
          <button onClick={saveEdit} className="p-0.5 text-green-400 flex-shrink-0"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={cancelEdit} className="p-0.5 text-gray-400 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
        </span>
      )
    }
    return (
      <span
        className="cursor-pointer hover:underline"
        onClick={() => startEdit(type, id, field, rawValue)}
        title="Click to edit"
      >
        {displayValue}
      </span>
    )
  }

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

      {/* Income Section */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <div className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: '#22c55e', color: '#fff' }}>
          <span className="text-xs font-semibold">Income</span>
          <button
            onClick={() => { setAddingIncome(true); setNewName(''); setNewAmount(''); setNewDay('') }}
            className="p-0.5 hover:bg-green-600 rounded"
            title="Add income"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Header row */}
        <div className="grid grid-cols-[45px_1fr_90px_28px] text-xs py-1 px-3" style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border-default)' }}>
          <span>Day</span>
          <span>Name</span>
          <span className="text-right">Amount</span>
          <span></span>
        </div>

        {activeIncome.map(inc => {
          const monthlyAmt = inc.frequency === 'weekly' ? inc.amount * 4.33
            : inc.frequency === 'biweekly' ? inc.amount * 2.17
            : inc.frequency === 'semimonthly' ? inc.amount
            : inc.amount
          return (
            <div key={`inc-${inc.id}`} className="grid grid-cols-[45px_1fr_90px_28px] text-sm py-2 px-3 items-center" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>
                {renderCell('income', inc.id, 'pay_day', ordinal(inc.pay_day), inc.pay_day)}
              </span>
              <span style={{ color: 'var(--color-text-primary)' }}>
                {renderCell('income', inc.id, 'name', inc.name, inc.name)}
              </span>
              <span className="text-right" style={{ color: '#22c55e' }}>
                {renderCell('income', inc.id, 'amount', fmt(monthlyAmt), inc.amount, 'right')}
              </span>
              <span className="flex justify-center">
                <button onClick={() => deleteIncomeItem(inc.id)} className="p-0.5 text-gray-500 hover:text-red-400" title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </span>
            </div>
          )
        })}

        {/* Add income row */}
        {addingIncome && (
          <div className="grid grid-cols-[45px_1fr_90px_28px] text-sm py-2 px-3 items-center gap-1" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
            <input
              type="number"
              placeholder="Day"
              min="1" max="31"
              value={newDay}
              onChange={(e) => setNewDay(e.target.value)}
              className="w-full px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-sm"
              style={{ color: 'var(--color-text-primary)' }}
              autoFocus
            />
            <input
              type="text"
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveNewIncome(); if (e.key === 'Escape') setAddingIncome(false) }}
              className="px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-sm"
              style={{ color: 'var(--color-text-primary)' }}
            />
            <input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveNewIncome(); if (e.key === 'Escape') setAddingIncome(false) }}
              className="px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-sm text-right"
              style={{ color: 'var(--color-text-primary)' }}
            />
            <span className="flex justify-center gap-0.5">
              <button onClick={saveNewIncome} className="p-0.5 text-green-400"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => setAddingIncome(false)} className="p-0.5 text-gray-400"><X className="w-3.5 h-3.5" /></button>
            </span>
          </div>
        )}
      </div>

      {/* Bills Section */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <div className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: '#ef4444', color: '#fff' }}>
          <span className="text-xs font-semibold">Bills & Expenses</span>
          <button
            onClick={() => { setAddingBill(true); setNewName(''); setNewAmount(''); setNewDay('') }}
            className="p-0.5 hover:bg-red-600 rounded"
            title="Add line"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Header row */}
        <div className="grid grid-cols-[45px_1fr_90px_28px] text-xs py-1 px-3" style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border-default)' }}>
          <span>Day</span>
          <span>Name</span>
          <span className="text-right">Amount</span>
          <span></span>
        </div>

        {billCats.map(cat => {
          const amt = cat.monthly_budget || cat.budget_amount * 2 || 0
          const freqLabel = cat.billing_months ? (cat.billing_months.split(',').length === 1 ? 'yearly' : cat.billing_months.split(',').length <= 4 ? 'quarterly' : '') : ''
          return (
            <div key={cat.id} className="grid grid-cols-[45px_1fr_90px_28px] text-sm py-2 px-3 items-center" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>
                {renderCell('bill', cat.id, 'bill_day', cat.bill_day ? ordinal(cat.bill_day) : '—', cat.bill_day)}
              </span>
              <span className="flex items-center gap-1.5" style={{ color: 'var(--color-text-primary)' }}>
                {renderCell('bill', cat.id, 'name', cat.name, cat.name)}
                {freqLabel && <span className="text-xs px-1 py-0 rounded" style={{ backgroundColor: 'rgba(139,92,246,0.15)', color: '#a78bfa', fontSize: '9px' }}>{freqLabel}</span>}
              </span>
              <span className="text-right" style={{ color: '#ef4444' }}>
                {renderCell('bill', cat.id, 'amount', `-${fmt(amt)}`, amt, 'right')}
              </span>
              <span className="flex justify-center">
                <button onClick={() => deleteBillItem(cat.id)} className="p-0.5 text-gray-500 hover:text-red-400" title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </span>
            </div>
          )
        })}

        {/* Add bill row */}
        {addingBill && (
          <div className="grid grid-cols-[45px_1fr_90px_28px] text-sm py-2 px-3 items-center gap-1" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
            <input
              type="number"
              placeholder="Day"
              min="1" max="31"
              value={newDay}
              onChange={(e) => setNewDay(e.target.value)}
              className="w-full px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-sm"
              style={{ color: 'var(--color-text-primary)' }}
              autoFocus
            />
            <input
              type="text"
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveNewBill(); if (e.key === 'Escape') setAddingBill(false) }}
              className="px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-sm"
              style={{ color: 'var(--color-text-primary)' }}
            />
            <input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveNewBill(); if (e.key === 'Escape') setAddingBill(false) }}
              className="px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-sm text-right"
              style={{ color: 'var(--color-text-primary)' }}
            />
            <span className="flex justify-center gap-0.5">
              <button onClick={saveNewBill} className="p-0.5 text-green-400"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => setAddingBill(false)} className="p-0.5 text-gray-400"><X className="w-3.5 h-3.5" /></button>
            </span>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <div className="grid grid-cols-2 text-sm font-bold py-2 px-3" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
          <span style={{ color: 'var(--color-text-primary)' }}>Total Income</span>
          <span className="text-right" style={{ color: '#22c55e' }}>{fmt(totalMoneyIn)}</span>
        </div>
        <div className="grid grid-cols-2 text-sm font-bold py-2 px-3" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
          <span style={{ color: 'var(--color-text-primary)' }}>Total Bills</span>
          <span className="text-right" style={{ color: '#ef4444' }}>{fmt(totalBills)}</span>
        </div>
        <div className="grid grid-cols-2 text-sm font-bold py-2 px-3">
          <span style={{ color: 'var(--color-text-primary)' }}>Remaining After Bills</span>
          <span className="text-right" style={{ color: moneyAfterBills >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(moneyAfterBills)}</span>
        </div>
      </div>
    </div>
  )
}

export default BillsSummary
