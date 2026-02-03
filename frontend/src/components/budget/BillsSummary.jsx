import React, { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, Check, X, Trash2, Pencil } from 'lucide-react'
import {
  getBudgetCategories, getBudgetPeriodSummary, getBudgetPayPeriods,
  getBudgetIncome, getBudgetAccounts,
  createBudgetIncome, updateBudgetIncome, deleteBudgetIncome,
  createBudgetCategory, updateBudgetCategory, deleteBudgetCategory
} from '../../services/api'
import BudgetEditModal from './BudgetEditModal'

function BillsSummary() {
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState([])
  const [income, setIncome] = useState([])
  const [accounts, setAccounts] = useState([])
  const [summary, setSummary] = useState(null)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)

  const [saving, setSaving] = useState(false)

  const [editModal, setEditModal] = useState(null) // { item, type: 'income'|'category' }

  const [addingIncome, setAddingIncome] = useState(false)
  const [addingBill, setAddingBill] = useState(false)
  const [addingSpending, setAddingSpending] = useState(false)
  const [addingTransfer, setAddingTransfer] = useState(false)
  const [newName, setNewName] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newDay, setNewDay] = useState('')
  const [newAccountId, setNewAccountId] = useState('')
  const [newEndDate, setNewEndDate] = useState('')
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

  const resetAddForm = () => {
    setNewName(''); setNewAmount(''); setNewDay('')
    setNewAccountId(''); setNewEndDate(''); setNewBillingMonths('')
  }

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
        account_id: parseInt(newAccountId) || defaultAccount,
      })
      setAddingIncome(false)
      resetAddForm()
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
        account_id: parseInt(newAccountId) || null,
        billing_months: newBillingMonths || null,
        end_date: newEndDate || null,
      })
      setAddingBill(false)
      resetAddForm()
      fetchData()
    } catch (err) {
      console.error('Failed to add bill:', err)
    } finally {
      setSaving(false)
    }
  }

  const saveNewSpending = async () => {
    if (!newName.trim() || saving) return
    setSaving(true)
    try {
      const perPeriod = parseFloat(newAmount) || 0
      await createBudgetCategory({
        name: newName.trim(),
        category_type: 'variable',
        budget_amount: perPeriod,
        monthly_budget: perPeriod * 2,
        account_id: parseInt(newAccountId) || null,
      })
      setAddingSpending(false)
      resetAddForm()
      fetchData()
    } catch (err) {
      console.error('Failed to add spending:', err)
    } finally {
      setSaving(false)
    }
  }

  const saveNewTransfer = async () => {
    if (!newName.trim() || saving) return
    setSaving(true)
    try {
      await createBudgetCategory({
        name: newName.trim(),
        category_type: 'transfer',
        budget_amount: parseFloat(newAmount) || 0,
        account_id: parseInt(newAccountId) || null,
      })
      setAddingTransfer(false)
      resetAddForm()
      fetchData()
    } catch (err) {
      console.error('Failed to add transfer:', err)
    } finally {
      setSaving(false)
    }
  }

  const deleteIncomeItem = async (id) => {
    if (saving || !window.confirm('Delete this income source?')) return
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

  const deleteCatItem = async (id) => {
    if (saving || !window.confirm('Delete this item?')) return
    setSaving(true)
    try {
      await deleteBudgetCategory(id)
      fetchData()
    } catch (err) {
      console.error('Failed to delete:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleModalSave = async (id, data) => {
    if (editModal?.type === 'income') {
      await updateBudgetIncome(id, data)
    } else {
      await updateBudgetCategory(id, data)
    }
    fetchData()
  }

  if (loading && !summary) {
    return <div className="animate-pulse bg-gray-800 rounded-xl h-64" />
  }

  const totalMoneyIn = summary?.expected_income || 0

  const isActiveThisMonth = (cat) => {
    if (!cat.billing_months) return true
    const months = cat.billing_months.split(',').map(m => parseInt(m.trim()))
    return months.includes(currentMonth)
  }

  const allCats = categories.filter(c => c.is_active)
  const fixedBills = allCats.filter(c => c.category_type === 'fixed' && isActiveThisMonth(c))
    .sort((a, b) => (a.bill_day || 99) - (b.bill_day || 99) || a.sort_order - b.sort_order)
  const spendingCats = allCats.filter(c => c.category_type === 'variable' && c.name !== 'Roll Over' && c.name !== 'Other')
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  const transferCats = allCats.filter(c => c.category_type === 'transfer')
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))

  const totalBillsAmt = fixedBills.reduce((s, cat) => s + (cat.monthly_budget || cat.budget_amount * 2 || 0), 0)
  const totalSpendingAmt = spendingCats.reduce((s, cat) => s + (cat.monthly_budget || cat.budget_amount * 2 || 0), 0)
  const totalTransferAmt = transferCats.reduce((s, cat) => s + (cat.budget_amount * 2 || 0), 0)
  const totalOutgoing = totalBillsAmt + totalSpendingAmt + totalTransferAmt
  const remaining = totalMoneyIn - totalOutgoing

  const activeIncome = income.filter(i => i.is_active).sort((a, b) => (a.pay_day || 0) - (b.pay_day || 0))

  const getAcctName = (id) => accounts.find(a => a.id === id)?.name || ''

  const getRecurrenceLabel = (cat) => {
    if (cat.end_date) return 'payment plan'
    if (!cat.billing_months) return ''
    const count = cat.billing_months.split(',').length
    if (count === 1) return 'yearly'
    if (count <= 4) return 'quarterly'
    if (count <= 7) return 'seasonal'
    return ''
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
          <button onClick={() => { setAddingIncome(true); resetAddForm() }} className="p-0.5 hover:bg-green-600 rounded" title="Add income">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
        <div className="grid grid-cols-[40px_minmax(80px,1fr)_70px_70px_40px] sm:grid-cols-[45px_1fr_90px_80px_52px] text-xs py-1 px-3 min-w-[320px]" style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border-default)' }}>
          <span>Day</span><span>Name</span><span className="text-right">Amt</span><span className="text-right hidden sm:block">Account</span><span />
        </div>
        {activeIncome.map(inc => {
          const monthlyAmt = inc.frequency === 'weekly' ? inc.amount * 4.33
            : inc.frequency === 'biweekly' ? inc.amount * 2.17
            : inc.frequency === 'semimonthly' ? inc.amount * 2
            : inc.amount
          const freqLabel = inc.frequency === 'weekly' ? '/wk' : inc.frequency === 'biweekly' ? '/2wk' : inc.frequency === 'semimonthly' ? '2x/mo' : '/mo'
          return (
            <div key={`inc-${inc.id}`} className="grid grid-cols-[45px_1fr_90px_80px_52px] text-sm py-2 px-3 items-center" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>
                {ordinal(inc.pay_day)}
              </span>
              <span className="flex items-center gap-1" style={{ color: 'var(--color-text-primary)' }}>
                {inc.name}
                <span className="text-xs px-1 rounded" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', fontSize: '9px' }}>{freqLabel}</span>
              </span>
              <span className="text-right" style={{ color: '#22c55e' }}>
                {fmt(monthlyAmt)}
              </span>
              <span className="text-right truncate" style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
                {getAcctName(inc.account_id)}
              </span>
              <span className="flex justify-center gap-1">
                <button onClick={() => setEditModal({ item: inc, type: 'income' })} className="p-0.5 text-gray-500 hover:text-blue-400" title="Edit">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => deleteIncomeItem(inc.id)} className="p-0.5 text-gray-500 hover:text-red-400" title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </span>
            </div>
          )
        })}
        {addingIncome && (
          <div className="text-sm py-2 px-3 space-y-1.5" style={{ borderBottom: '1px solid var(--color-border-default)', backgroundColor: 'rgba(34, 197, 94, 0.05)' }}>
            <div className="flex items-center gap-1.5">
              <input type="number" placeholder="Day" min="1" max="31" value={newDay} onChange={(e) => setNewDay(e.target.value)}
                className="w-12 px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-sm" style={{ color: 'var(--color-text-primary)' }} autoFocus />
              <input type="text" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)}
                className="flex-1 px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-sm" style={{ color: 'var(--color-text-primary)' }}
                onKeyDown={(e) => { if (e.key === 'Enter') saveNewIncome() }} />
              <input type="number" step="0.01" placeholder="Amount" value={newAmount} onChange={(e) => setNewAmount(e.target.value)}
                className="w-20 px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-sm text-right" style={{ color: 'var(--color-text-primary)' }}
                onKeyDown={(e) => { if (e.key === 'Enter') saveNewIncome() }} />
            </div>
            <div className="flex items-center gap-1.5">
              <select value={newAccountId} onChange={(e) => setNewAccountId(e.target.value)}
                className="px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-xs" style={{ color: 'var(--color-text-primary)' }}>
                <option value="">Account...</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <span className="flex-1" />
              <button onClick={saveNewIncome} className="p-0.5 text-green-400"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => setAddingIncome(false)} className="p-0.5 text-gray-400"><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Bills Section (Fixed only) */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <div className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: '#ef4444', color: '#fff' }}>
          <span className="text-xs font-semibold">Bills</span>
          <button onClick={() => { setAddingBill(true); resetAddForm() }} className="p-0.5 hover:bg-red-600 rounded" title="Add bill">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-[40px_1fr_80px_80px_60px_52px] text-xs py-1 px-3" style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border-default)' }}>
          <span>Day</span><span>Name</span><span className="text-right">Amount</span><span className="text-right">Account</span><span className="text-center">Recur</span><span />
        </div>
        {fixedBills.map(cat => {
          const amt = cat.monthly_budget || cat.budget_amount * 2 || 0
          const recLabel = getRecurrenceLabel(cat)
          return (
            <div key={cat.id} className="grid grid-cols-[40px_1fr_80px_80px_60px_52px] text-sm py-2 px-3 items-center" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>
                {cat.bill_day ? ordinal(cat.bill_day) : '—'}
              </span>
              <span className="flex items-center gap-1 truncate" style={{ color: 'var(--color-text-primary)' }}>
                {cat.name}
                {cat.owner && <span className="text-xs px-1 rounded" style={{ backgroundColor: 'rgba(139,92,246,0.15)', color: '#a78bfa', fontSize: '9px' }}>{cat.owner}</span>}
              </span>
              <span className="text-right" style={{ color: '#ef4444' }}>
                -{fmt(amt)}
              </span>
              <span className="text-right truncate" style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
                {getAcctName(cat.account_id) || '—'}
              </span>
              <span className="text-center">
                {recLabel ? (
                  <span className="text-xs px-1 py-0 rounded" style={{ backgroundColor: 'rgba(139,92,246,0.15)', color: '#a78bfa', fontSize: '9px' }}
                    title={cat.end_date ? `Ends ${cat.end_date}` : cat.billing_months ? `Months: ${cat.billing_months}` : ''}>
                    {recLabel}
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)', fontSize: '9px' }}>monthly</span>
                )}
              </span>
              <span className="flex justify-center gap-1">
                <button onClick={() => setEditModal({ item: cat, type: 'category' })} className="p-0.5 text-gray-500 hover:text-blue-400" title="Edit">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => deleteCatItem(cat.id)} className="p-0.5 text-gray-500 hover:text-red-400" title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </span>
            </div>
          )
        })}
        {addingBill && (
          <div className="text-sm py-2 px-3 space-y-1.5" style={{ borderBottom: '1px solid var(--color-border-default)', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
            <div className="flex items-center gap-1.5">
              <input type="number" placeholder="Day" min="1" max="31" value={newDay} onChange={(e) => setNewDay(e.target.value)}
                className="w-12 px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-sm" style={{ color: 'var(--color-text-primary)' }} autoFocus />
              <input type="text" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)}
                className="flex-1 px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-sm" style={{ color: 'var(--color-text-primary)' }}
                onKeyDown={(e) => { if (e.key === 'Enter') saveNewBill() }} />
              <input type="number" step="0.01" placeholder="Monthly amt" value={newAmount} onChange={(e) => setNewAmount(e.target.value)}
                className="w-24 px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-sm text-right" style={{ color: 'var(--color-text-primary)' }}
                onKeyDown={(e) => { if (e.key === 'Enter') saveNewBill() }} />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <select value={newAccountId} onChange={(e) => setNewAccountId(e.target.value)}
                className="px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-xs" style={{ color: 'var(--color-text-primary)' }}>
                <option value="">Account...</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select value={newBillingMonths} onChange={(e) => setNewBillingMonths(e.target.value)}
                className="px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-xs" style={{ color: 'var(--color-text-primary)' }}>
                <option value="">Every month</option>
                <option value="1,4,7,10">Quarterly</option>
                <option value="4,5,6,7,8,9,10">Apr-Oct</option>
                <option value="1,7">Twice/year</option>
              </select>
              <input type="month" placeholder="End date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)}
                className="px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-xs" style={{ color: 'var(--color-text-primary)' }}
                title="End date (for payment plans)" />
              <span className="flex-1" />
              <button onClick={saveNewBill} className="p-0.5 text-green-400"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => setAddingBill(false)} className="p-0.5 text-gray-400"><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-[40px_1fr_80px_80px_60px_52px] text-xs font-bold py-1.5 px-3" style={{ borderTop: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-bg-surface-soft)' }}>
          <span /><span style={{ color: 'var(--color-text-primary)' }}>Total Bills</span>
          <span className="text-right" style={{ color: '#ef4444' }}>-{fmt(totalBillsAmt)}</span>
          <span /><span /><span />
        </div>
      </div>

      {/* Spending Budgets Section (Variable) */}
      {(spendingCats.length > 0 || addingSpending) && (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: '#f59e0b', color: '#fff' }}>
            <span className="text-xs font-semibold">Spending Budgets</span>
            <button onClick={() => { setAddingSpending(true); resetAddForm() }} className="p-0.5 hover:bg-yellow-600 rounded" title="Add spending budget">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-[1fr_90px_80px_52px] text-xs py-1 px-3" style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border-default)' }}>
            <span>Name</span><span className="text-right">Per Period</span><span className="text-right">Account</span><span />
          </div>
          {spendingCats.map(cat => (
            <div key={cat.id} className="grid grid-cols-[1fr_90px_80px_52px] text-sm py-2 px-3 items-center" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
              <span style={{ color: 'var(--color-text-primary)' }}>
                {cat.name}
              </span>
              <span className="text-right" style={{ color: '#f59e0b' }}>
                {fmt(cat.budget_amount)}
              </span>
              <span className="text-right truncate" style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
                {getAcctName(cat.account_id) || '—'}
              </span>
              <span className="flex justify-center gap-1">
                <button onClick={() => setEditModal({ item: cat, type: 'category' })} className="p-0.5 text-gray-500 hover:text-blue-400" title="Edit">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => deleteCatItem(cat.id)} className="p-0.5 text-gray-500 hover:text-red-400" title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </span>
            </div>
          ))}
          {addingSpending && (
            <div className="flex items-center gap-1.5 text-sm py-2 px-3" style={{ borderBottom: '1px solid var(--color-border-default)', backgroundColor: 'rgba(245, 158, 11, 0.05)' }}>
              <input type="text" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)}
                className="flex-1 px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-sm" style={{ color: 'var(--color-text-primary)' }} autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') saveNewSpending() }} />
              <input type="number" step="0.01" placeholder="Per period" value={newAmount} onChange={(e) => setNewAmount(e.target.value)}
                className="w-24 px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-sm text-right" style={{ color: 'var(--color-text-primary)' }}
                onKeyDown={(e) => { if (e.key === 'Enter') saveNewSpending() }} />
              <select value={newAccountId} onChange={(e) => setNewAccountId(e.target.value)}
                className="px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-xs" style={{ color: 'var(--color-text-primary)' }}>
                <option value="">Account...</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <button onClick={saveNewSpending} className="p-0.5 text-green-400"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => setAddingSpending(false)} className="p-0.5 text-gray-400"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}
          <div className="grid grid-cols-[1fr_90px_80px_52px] text-xs font-bold py-1.5 px-3" style={{ borderTop: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-bg-surface-soft)' }}>
            <span style={{ color: 'var(--color-text-primary)' }}>Total Spending</span>
            <span className="text-right" style={{ color: '#f59e0b' }}>-{fmt(totalSpendingAmt)}/mo</span>
            <span /><span />
          </div>
        </div>
      )}

      {/* Distributions Section (Transfers) */}
      {(transferCats.length > 0 || addingTransfer) && (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: '#3b82f6', color: '#fff' }}>
            <span className="text-xs font-semibold">Distributions</span>
            <button onClick={() => { setAddingTransfer(true); resetAddForm() }} className="p-0.5 hover:bg-blue-600 rounded" title="Add transfer">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-[1fr_90px_80px_52px] text-xs py-1 px-3" style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border-default)' }}>
            <span>Name</span><span className="text-right">Per Period</span><span className="text-right">Destination</span><span />
          </div>
          {transferCats.map(cat => (
            <div key={cat.id} className="grid grid-cols-[1fr_90px_80px_52px] text-sm py-2 px-3 items-center" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
              <span style={{ color: 'var(--color-text-primary)' }}>
                {cat.name}
              </span>
              <span className="text-right" style={{ color: '#3b82f6' }}>
                {fmt(cat.budget_amount)}
              </span>
              <span className="text-right truncate" style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
                {getAcctName(cat.account_id) || '—'}
              </span>
              <span className="flex justify-center gap-1">
                <button onClick={() => setEditModal({ item: cat, type: 'category' })} className="p-0.5 text-gray-500 hover:text-blue-400" title="Edit">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => deleteCatItem(cat.id)} className="p-0.5 text-gray-500 hover:text-red-400" title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </span>
            </div>
          ))}
          {addingTransfer && (
            <div className="flex items-center gap-1.5 text-sm py-2 px-3" style={{ borderBottom: '1px solid var(--color-border-default)', backgroundColor: 'rgba(59, 130, 246, 0.05)' }}>
              <input type="text" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)}
                className="flex-1 px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-sm" style={{ color: 'var(--color-text-primary)' }} autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') saveNewTransfer() }} />
              <input type="number" step="0.01" placeholder="Per period" value={newAmount} onChange={(e) => setNewAmount(e.target.value)}
                className="w-24 px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-sm text-right" style={{ color: 'var(--color-text-primary)' }}
                onKeyDown={(e) => { if (e.key === 'Enter') saveNewTransfer() }} />
              <select value={newAccountId} onChange={(e) => setNewAccountId(e.target.value)}
                className="px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-xs" style={{ color: 'var(--color-text-primary)' }}>
                <option value="">Destination...</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <button onClick={saveNewTransfer} className="p-0.5 text-green-400"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => setAddingTransfer(false)} className="p-0.5 text-gray-400"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}
          <div className="grid grid-cols-[1fr_90px_80px_52px] text-xs font-bold py-1.5 px-3" style={{ borderTop: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-bg-surface-soft)' }}>
            <span style={{ color: 'var(--color-text-primary)' }}>Total Distributions</span>
            <span className="text-right" style={{ color: '#3b82f6' }}>-{fmt(totalTransferAmt)}/mo</span>
            <span /><span />
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <div className="grid grid-cols-2 text-sm py-2 px-3" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
          <span style={{ color: 'var(--color-text-primary)' }}>Total Income</span>
          <span className="text-right font-bold" style={{ color: '#22c55e' }}>{fmt(totalMoneyIn)}</span>
        </div>
        <div className="grid grid-cols-2 text-sm py-2 px-3" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
          <span style={{ color: 'var(--color-text-primary)' }}>Bills</span>
          <span className="text-right font-bold" style={{ color: '#ef4444' }}>-{fmt(totalBillsAmt)}</span>
        </div>
        <div className="grid grid-cols-2 text-sm py-2 px-3" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
          <span style={{ color: 'var(--color-text-primary)' }}>Spending</span>
          <span className="text-right font-bold" style={{ color: '#f59e0b' }}>-{fmt(totalSpendingAmt)}</span>
        </div>
        <div className="grid grid-cols-2 text-sm py-2 px-3" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
          <span style={{ color: 'var(--color-text-primary)' }}>Distributions</span>
          <span className="text-right font-bold" style={{ color: '#3b82f6' }}>-{fmt(totalTransferAmt)}</span>
        </div>
        <div className="grid grid-cols-2 text-sm font-bold py-2.5 px-3" style={{ borderTop: '2px solid var(--color-border-default)' }}>
          <span style={{ color: 'var(--color-text-primary)' }}>{remaining >= 0 ? 'Surplus' : 'Overage'}</span>
          <span className="text-right" style={{ color: remaining >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(remaining)}</span>
        </div>
      </div>
      {editModal && (
        <BudgetEditModal
          item={editModal.item}
          itemType={editModal.type}
          accounts={accounts}
          onSave={handleModalSave}
          onClose={() => setEditModal(null)}
        />
      )}
    </div>
  )
}

export default BillsSummary
