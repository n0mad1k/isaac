import React, { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, Check, X, Trash2, Pencil } from 'lucide-react'
import {
  getBudgetPayPeriods, getBudgetCategories, getBudgetAccounts,
  getBudgetIncome, updateBudgetCategory, updateBudgetIncome,
  createBudgetCategory, deleteBudgetCategory, createBudgetIncome,
  deleteBudgetIncome, getBudgetPeriodSummary
} from '../../services/api'
import BudgetEditModal from './BudgetEditModal'

function MonthlyBudget() {
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [income, setIncome] = useState([])
  const [periods, setPeriods] = useState([])
  const [firstHalf, setFirstHalf] = useState(null)
  const [secondHalf, setSecondHalf] = useState(null)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)

  const [editModal, setEditModal] = useState(null) // { item, type: 'income'|'category' }
  const [editingLine, setEditingLine] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [addingTo, setAddingTo] = useState(null)
  const [newLine, setNewLine] = useState({
    type: 'bill', name: '', amount: '', bill_day: '',
    account_id: '', frequency: 'semimonthly', end_date: ''
  })

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [periodsRes, catRes, acctRes, incRes] = await Promise.all([
        getBudgetPayPeriods(currentYear, currentMonth),
        getBudgetCategories(),
        getBudgetAccounts(),
        getBudgetIncome(),
      ])
      const p = periodsRes.data || []
      setPeriods(p)
      setCategories(catRes.data || [])
      setAccounts(acctRes.data || [])
      setIncome(incRes.data || [])

      if (p.length >= 2) {
        const [h1, h2] = await Promise.all([
          getBudgetPeriodSummary(p[0].start, p[0].end),
          getBudgetPeriodSummary(p[1].start, p[1].end),
        ])
        setFirstHalf(h1.data)
        setSecondHalf(h2.data)
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

  const ordinal = (d) => {
    if (!d) return ''
    const s = ['th', 'st', 'nd', 'rd']
    const v = d % 100
    return d + (s[(v - 20) % 10] || s[v] || s[0])
  }

  const startEdit = (type, id, field, value) => {
    setEditingLine({ type, id, field })
    setEditValue(String(value))
  }

  const saveEdit = async () => {
    if (!editingLine || saving) return
    setSaving(true)
    try {
      const { type, id, field } = editingLine
      const val = field === 'name' ? editValue : (parseFloat(editValue) || 0)
      if (type === 'income') {
        await updateBudgetIncome(id, { [field]: val })
      } else {
        await updateBudgetCategory(id, { [field]: val })
      }
      setEditingLine(null)
      fetchData()
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  const cancelEdit = () => setEditingLine(null)

  const resetNewLine = (type = 'bill') => {
    setNewLine({
      type, name: '', amount: '', bill_day: '',
      account_id: '', frequency: 'semimonthly', end_date: '',
      billing_months: '', bill_frequency: 'per_period'
    })
  }

  const openAddForm = (sectionKey, defaultType) => {
    setAddingTo(sectionKey)
    resetNewLine(defaultType)
  }

  const saveNewLine = async () => {
    if (!addingTo || saving || !newLine.name || !newLine.amount) return
    setSaving(true)
    try {
      const { type } = newLine
      const amount = parseFloat(newLine.amount) || 0
      const acctId = parseInt(newLine.account_id) || null

      if (type === 'income') {
        await createBudgetIncome({
          name: newLine.name,
          amount,
          frequency: newLine.frequency || 'semimonthly',
          pay_day: parseInt(newLine.bill_day) || 1,
          account_id: acctId || accounts[0]?.id || 1,
        })
      } else {
        let category_type = 'fixed'
        let owner = null
        let bill_day = parseInt(newLine.bill_day) || null
        const isPerPeriod = (type === 'bill' || type === 'payment_plan') && newLine.bill_frequency === 'per_period'

        if (type === 'spending') category_type = 'variable'
        else if (type === 'transfer') category_type = 'transfer'

        if (addingTo.startsWith('dane')) owner = 'dane'
        else if (addingTo.startsWith('kelly')) owner = 'kelly'

        // For per-period bills, do NOT set bill_day (they appear in both halves)
        // For monthly bills and other types, auto-assign bill_day based on which half they're added to
        if (isPerPeriod) {
          bill_day = null
        } else if (type !== 'income') {
          if (addingTo.includes('first') && !bill_day) bill_day = 1
          else if (addingTo.includes('second') && !bill_day) bill_day = 15
        }

        let monthly_budget = null
        let budget_amount = 0

        if (isPerPeriod) {
          // Per-period bill: amount is per pay period, stored in budget_amount
          budget_amount = amount
          monthly_budget = null
        } else if (type === 'bill' || type === 'payment_plan') {
          // Monthly bill: full monthly amount
          monthly_budget = amount
          budget_amount = 0
        } else {
          // Spending/transfer: per-period amount in budget_amount
          budget_amount = amount
        }

        const data = {
          name: newLine.name,
          category_type,
          monthly_budget,
          budget_amount,
          owner,
          bill_day,
          account_id: acctId,
        }

        if (type === 'payment_plan' && newLine.end_date) {
          data.end_date = newLine.end_date
        }

        if (newLine.billing_months) {
          data.billing_months = newLine.billing_months
        }

        await createBudgetCategory(data)
      }
      setAddingTo(null)
      resetNewLine()
      fetchData()
    } catch (err) {
      console.error('Failed to add line:', err)
    } finally {
      setSaving(false)
    }
  }

  const deleteLine = async (type, id) => {
    if (!window.confirm('Remove this line item?')) return
    try {
      if (type === 'income') {
        await deleteBudgetIncome(id)
      } else {
        await deleteBudgetCategory(id)
      }
      fetchData()
    } catch (err) {
      console.error('Failed to delete:', err)
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

  if (loading && categories.length === 0) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse bg-gray-800 rounded-xl h-16" />
        <div className="animate-pulse bg-gray-800 rounded-xl h-64" />
      </div>
    )
  }

  const activeCats = categories.filter(c => c.is_active)
  const currentYM = `${currentYear}-${String(currentMonth).padStart(2, '0')}`

  // Filter out categories not active this month
  const isActiveThisMonth = (cat) => {
    if (cat.billing_months) {
      const months = cat.billing_months.split(',').map(m => parseInt(m.trim()))
      if (!months.includes(currentMonth)) return false
    }
    if (cat.start_date && currentYM < cat.start_date) return false
    if (cat.end_date && currentYM > cat.end_date) return false
    return true
  }

  const fixedCats = activeCats.filter(c => c.category_type === 'fixed' && isActiveThisMonth(c))
  const variableCats = activeCats.filter(c => c.category_type === 'variable' && c.name !== 'Roll Over')
  const transferCats = activeCats.filter(c => c.category_type === 'transfer')

  const isPerPeriod = (cat) => !cat.bill_day && cat.budget_amount > 0

  const sortBills = (a, b) => (a.bill_day || 0) - (b.bill_day || 0) || a.sort_order - b.sort_order

  const mainBillsFirst = fixedCats.filter(c => !c.owner && ((c.bill_day && c.bill_day <= 14) || isPerPeriod(c))).sort(sortBills)
  const mainBillsSecond = fixedCats.filter(c => !c.owner && ((c.bill_day && c.bill_day >= 15) || isPerPeriod(c))).sort(sortBills)
  const daneBillsFirst = fixedCats.filter(c => c.owner === 'dane' && ((c.bill_day && c.bill_day <= 14) || isPerPeriod(c))).sort(sortBills)
  const daneBillsSecond = fixedCats.filter(c => c.owner === 'dane' && ((c.bill_day && c.bill_day >= 15) || isPerPeriod(c))).sort(sortBills)
  const kellyBillsFirst = fixedCats.filter(c => c.owner === 'kelly' && ((c.bill_day && c.bill_day <= 14) || isPerPeriod(c))).sort(sortBills)
  const kellyBillsSecond = fixedCats.filter(c => c.owner === 'kelly' && ((c.bill_day && c.bill_day >= 15) || isPerPeriod(c))).sort(sortBills)

  const activeIncome = income.filter(i => i.is_active)
  const incomeFirst = activeIncome.filter(i => i.frequency === 'weekly' || i.frequency === 'biweekly' || !i.pay_day || i.pay_day <= 14)
  const incomeSecond = activeIncome.filter(i => i.frequency === 'weekly' || i.frequency === 'biweekly' || i.frequency === 'semimonthly' || (i.pay_day && i.pay_day >= 15))

  const calcHalfIncome = (incomeList, isFirst) => {
    let total = 0
    incomeList.forEach(inc => {
      if (inc.frequency === 'weekly') total += inc.amount * 2
      else if (inc.frequency === 'biweekly') total += inc.amount
      else if (inc.frequency === 'semimonthly') total += inc.amount
      else {
        if (isFirst && (!inc.pay_day || inc.pay_day <= 14)) total += inc.amount
        else if (!isFirst && inc.pay_day && inc.pay_day >= 15) total += inc.amount
      }
    })
    return total
  }

  const distributions = transferCats.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  const variablePerHalf = variableCats.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))

  const getHalfBillAmount = (cat) => isPerPeriod(cat) ? cat.budget_amount : (cat.monthly_budget || cat.budget_amount * 2 || 0)

  const getPerPeriodAmount = (cat) => cat.budget_amount || 0

  const getAccountName = (cat) => {
    if (cat.account_id) {
      const acct = accounts.find(a => a.id === cat.account_id)
      if (acct) return acct.name
    }
    if (cat.owner === 'dane') return accounts.find(a => a.name.toLowerCase().includes('dane'))?.name || "Dane's Spending"
    if (cat.owner === 'kelly') return accounts.find(a => a.name.toLowerCase().includes('kelly'))?.name || "Kelly's Spending"
    return accounts.find(a => a.account_type === 'checking')?.name || 'Main Checking'
  }

  // Editable cell
  const editableCell = (type, id, field, value, displayValue, className = '', style = {}) => {
    const isEditing = editingLine?.type === type && editingLine?.id === id && editingLine?.field === field
    if (isEditing) {
      return (
        <span className={`flex items-center gap-0.5 ${className}`}>
          <input
            type={field === 'name' ? 'text' : 'number'}
            step="0.01"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }}
            className="w-full px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-xs"
            style={{ color: 'var(--color-text-primary)', textAlign: field === 'name' ? 'left' : 'right' }}
            autoFocus
          />
          <button onClick={saveEdit} className="p-0.5 text-green-400 flex-shrink-0"><Check className="w-3 h-3" /></button>
          <button onClick={cancelEdit} className="p-0.5 text-gray-400 flex-shrink-0"><X className="w-3 h-3" /></button>
        </span>
      )
    }
    return (
      <span className={`cursor-pointer hover:underline ${className}`} style={style}
        onClick={() => startEdit(type, id, field, value)} title="Click to edit">
        {displayValue}
      </span>
    )
  }

  const lineRow = (type, id, day, name, amount, accountName, isIncome = false, canDelete = true) => {
    const displayAmt = isIncome ? fmt(amount) : `-${fmt(Math.abs(amount))}`
    const amtColor = isIncome ? '#22c55e' : '#ef4444'

    // Find full item for edit modal
    const openEdit = () => {
      if (type === 'income') {
        const inc = income.find(i => i.id === id)
        if (inc) setEditModal({ item: inc, type: 'income' })
      } else {
        const cat = categories.find(c => c.id === id)
        if (cat) setEditModal({ item: cat, type: 'category' })
      }
    }

    return (
      <div key={`${type}-${id}`} className="grid grid-cols-[40px_1fr_80px_44px] sm:grid-cols-[40px_1fr_80px_80px_44px] text-xs py-1 px-2 items-center" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>{day ? ordinal(day) : ''}</span>
        <span className="text-left truncate" style={{ color: 'var(--color-text-primary)' }}>{name}</span>
        <span className="text-right" style={{ color: amtColor }}>{displayAmt}</span>
        <span className="hidden sm:inline text-right truncate" style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>{accountName}</span>
        <span className="flex justify-center gap-0.5">
          <button onClick={openEdit} className="p-0.5 text-gray-600 hover:text-blue-400 flex-shrink-0" title="Edit">
            <Pencil className="w-2.5 h-2.5" />
          </button>
          {canDelete ? (
            <button onClick={() => deleteLine(type, id)} className="p-0.5 text-gray-600 hover:text-red-400 flex-shrink-0" title="Delete">
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          ) : <span className="w-3.5" />}
        </span>
      </div>
    )
  }

  const monthAbbrevs = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const addForm = (sectionKey) => {
    if (addingTo !== sectionKey) return null
    const { type } = newLine
    const isBillType = type === 'bill' || type === 'payment_plan'
    const isPerPeriodBill = isBillType && newLine.bill_frequency === 'per_period'
    const showDay = !isPerPeriodBill // Hide day for per-period bills
    const showFreq = type === 'income'
    const showEndDate = isBillType
    const showBillingMonths = isBillType && !isPerPeriodBill
    const showAccount = true

    return (
      <div className="text-xs py-2 px-2 space-y-1.5" style={{ borderBottom: '1px solid var(--color-border-default)', backgroundColor: 'rgba(34, 197, 94, 0.05)' }}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <select value={type} onChange={(e) => setNewLine(f => ({ ...f, type: e.target.value }))}
            className="px-1.5 py-1 bg-gray-800 border border-gray-700 rounded text-xs" style={{ color: 'var(--color-text-primary)' }}>
            <option value="bill">Bill</option>
            <option value="income">Income</option>
            <option value="spending">Spending</option>
            <option value="transfer">Transfer</option>
            <option value="payment_plan">Payment Plan</option>
          </select>
          {isBillType && (
            <select value={newLine.bill_frequency || 'per_period'} onChange={(e) => setNewLine(f => ({ ...f, bill_frequency: e.target.value, bill_day: '' }))}
              className="px-1.5 py-1 bg-gray-800 border border-gray-700 rounded text-xs" style={{ color: 'var(--color-text-primary)' }}>
              <option value="per_period">Each Half</option>
              <option value="monthly">Monthly</option>
            </select>
          )}
          {showDay && (
            <input type="number" placeholder="Day" min="1" max="31" value={newLine.bill_day} onChange={(e) => setNewLine(f => ({ ...f, bill_day: e.target.value }))}
              className="w-12 px-1 py-1 bg-gray-800 border border-gray-700 rounded text-xs" style={{ color: 'var(--color-text-primary)' }} title="Day of month (1-31)" />
          )}
          <input type="text" placeholder="Name" value={newLine.name} onChange={(e) => setNewLine(f => ({ ...f, name: e.target.value }))}
            className="flex-1 min-w-0 px-1.5 py-1 bg-gray-800 border border-gray-700 rounded text-xs" style={{ color: 'var(--color-text-primary)' }} autoFocus />
          <input type="number" step="0.01" placeholder={isPerPeriodBill ? 'Per half' : 'Amt'} value={newLine.amount} onChange={(e) => setNewLine(f => ({ ...f, amount: e.target.value }))}
            className="w-20 px-1 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-right" style={{ color: 'var(--color-text-primary)' }}
            onKeyDown={(e) => { if (e.key === 'Enter') saveNewLine() }} />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {showAccount && (
            <select value={newLine.account_id} onChange={(e) => setNewLine(f => ({ ...f, account_id: e.target.value }))}
              className="px-1.5 py-1 bg-gray-800 border border-gray-700 rounded text-xs" style={{ color: 'var(--color-text-primary)' }}>
              <option value="">Account...</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          {showFreq && (
            <select value={newLine.frequency} onChange={(e) => setNewLine(f => ({ ...f, frequency: e.target.value }))}
              className="px-1.5 py-1 bg-gray-800 border border-gray-700 rounded text-xs" style={{ color: 'var(--color-text-primary)' }}>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-Weekly</option>
              <option value="semimonthly">Semi-Monthly</option>
              <option value="monthly">Monthly</option>
            </select>
          )}
          {showEndDate && (
            <input type="month" value={newLine.end_date} onChange={(e) => setNewLine(f => ({ ...f, end_date: e.target.value }))}
              className="px-1.5 py-1 bg-gray-800 border border-gray-700 rounded text-xs" style={{ color: 'var(--color-text-primary)' }}
              title="End date (for payment plans)" />
          )}
          {showBillingMonths && (
            <select value={newLine.billing_months} onChange={(e) => setNewLine(f => ({ ...f, billing_months: e.target.value }))}
              className="px-1.5 py-1 bg-gray-800 border border-gray-700 rounded text-xs" style={{ color: 'var(--color-text-primary)' }}>
              <option value="">Every month</option>
              <option value="1,2,3,4,5,6,7,8,9,10,11,12">Monthly</option>
              <option value="1,4,7,10">Quarterly</option>
              <option value="4,5,6,7,8,9,10">Apr-Oct (seasonal)</option>
              <option value="1,7">Twice a year</option>
              <option value="custom">Custom...</option>
            </select>
          )}
          <span className="flex-1" />
          <button onClick={saveNewLine} disabled={saving} className="p-1 text-green-400"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={() => { setAddingTo(null); resetNewLine() }} className="p-1 text-gray-400"><X className="w-3.5 h-3.5" /></button>
        </div>
        {newLine.billing_months === 'custom' && (
          <div className="flex items-center gap-1 flex-wrap">
            <span style={{ color: 'var(--color-text-muted)' }}>Active months:</span>
            {monthAbbrevs.map((m, i) => {
              const monthNum = i + 1
              const selected = (newLine._customMonths || []).includes(monthNum)
              return (
                <button key={m} type="button"
                  onClick={() => {
                    const cur = newLine._customMonths || []
                    const next = selected ? cur.filter(n => n !== monthNum) : [...cur, monthNum].sort((a, b) => a - b)
                    setNewLine(f => ({ ...f, _customMonths: next, billing_months: next.join(',') }))
                  }}
                  className={`px-1.5 py-0.5 rounded text-xs ${selected ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                  {m}
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const colHeader = (bgColor = '#3b82f6') => (
    <div className="grid grid-cols-[40px_1fr_80px_44px] sm:grid-cols-[40px_1fr_80px_80px_44px] text-xs font-semibold py-1.5 px-2" style={{ backgroundColor: bgColor, color: '#fff' }}>
      <span>Date</span><span>Item</span><span className="text-right">Amount</span><span className="hidden sm:inline text-right">Account</span><span />
    </div>
  )

  const moneyMarketName = accounts.find(a => a.name.toLowerCase().includes('money market'))?.name || 'Money Market'

  // Totals
  const firstHalfIncome = calcHalfIncome(activeIncome, true)
  const secondHalfIncome = calcHalfIncome(activeIncome, false)
  const firstHalfBills = mainBillsFirst.reduce((s, c) => s + getHalfBillAmount(c), 0)
  const secondHalfBills = mainBillsSecond.reduce((s, c) => s + getHalfBillAmount(c), 0)
  // Monthly total: items without bill_day appear in both halves (amount * 2), items with bill_day are single-half
  const calcMonthlyTotal = (items) => items.reduce((s, c) => s + (c.bill_day ? (c.budget_amount || 0) : (c.budget_amount || 0) * 2), 0)
  const daneBFirst = daneBillsFirst.reduce((s, c) => s + getHalfBillAmount(c), 0)
  const daneBSecond = daneBillsSecond.reduce((s, c) => s + getHalfBillAmount(c), 0)
  const kellyBFirst = kellyBillsFirst.reduce((s, c) => s + getHalfBillAmount(c), 0)
  const kellyBSecond = kellyBillsSecond.reduce((s, c) => s + getHalfBillAmount(c), 0)

  // Determine which half of the month we're currently in (for card display)
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === currentYear && today.getMonth() + 1 === currentMonth
  const inFirstHalf = isCurrentMonth ? today.getDate() <= 14 : true
  const currentHalf = inFirstHalf ? firstHalf : secondHalf

  // Cards show CURRENT HALF data (not full month)
  const cardIncome = currentHalf?.expected_income || (inFirstHalf ? firstHalfIncome : secondHalfIncome)
  const cardBills = inFirstHalf ? firstHalfBills : secondHalfBills
  // For spending/distributions in current half: items with bill_day in this half + per-period items
  const cardDistHalf = distributions.filter(c => !c.bill_day || (inFirstHalf ? c.bill_day <= 14 : c.bill_day >= 15))
  const cardVarHalf = variablePerHalf.filter(c => !c.bill_day || (inFirstHalf ? c.bill_day <= 14 : c.bill_day >= 15))
  const cardSpending = cardVarHalf.reduce((s, c) => s + (c.budget_amount || 0), 0)
  const cardDistributions = cardDistHalf.reduce((s, c) => s + (c.budget_amount || 0), 0)
  const cardOutgoing = cardBills + cardSpending + cardDistributions
  const cardSurplus = cardIncome - cardOutgoing

  // Full month totals for Monthly Summary section
  const totalIncome = (firstHalf?.expected_income || 0) + (secondHalf?.expected_income || 0) || (firstHalfIncome + secondHalfIncome)
  const totalBills = firstHalfBills + secondHalfBills
  const totalSpending = calcMonthlyTotal(variablePerHalf)
  const totalDistributions = calcMonthlyTotal(distributions)
  const totalOutgoing = totalBills + totalSpending + totalDistributions
  const surplus = totalIncome - totalOutgoing

  // Get remaining for a spending category card (current half only)
  const getCatRemaining = (catName) => {
    const halfCat = currentHalf?.categories?.find(c => c.name === catName)
    const budgeted = halfCat?.budgeted || 0
    const spent = halfCat?.spent || 0
    return budgeted - spent
  }

  // Get person spending data (accumulated with rollover from prior periods)
  const getPersonData = (ownerKey, half) => {
    const data = (half || currentHalf)?.person_spending_balances?.[ownerKey]
    if (!data) return { available: 0 }
    if (typeof data === 'number') return { available: data }
    return data
  }

  const spendingCardCats = ['Gas', 'Groceries', 'Main Spending', 'Dane Spending', 'Kelly Spending']

  // ---- Account Overview Calculations ----
  const accountFlows = {}
  accounts.forEach(acct => {
    accountFlows[acct.id] = { name: acct.name, moneyIn: 0, moneyOut: 0 }
  })

  // Income -> money into their account
  activeIncome.forEach(inc => {
    if (inc.account_id && accountFlows[inc.account_id]) {
      let monthlyAmt = inc.amount
      if (inc.frequency === 'weekly') monthlyAmt = inc.amount * 4
      else if (inc.frequency === 'biweekly') monthlyAmt = inc.amount * 2
      else if (inc.frequency === 'semimonthly') monthlyAmt = inc.amount * 2
      accountFlows[inc.account_id].moneyIn += monthlyAmt
    }
  })

  // Find the primary income account (first income source's account, typically Money Market)
  const primaryAccountId = activeIncome[0]?.account_id || accounts[0]?.id

  // Helper: get monthly amount for transfer/variable categories (bill_day = single-half, no bill_day = both halves)
  const getMonthlyAmt = (cat) => cat.bill_day ? (cat.budget_amount || 0) : (cat.budget_amount || 0) * 2

  // Transfers: money out of primary, money into destination
  transferCats.forEach(cat => {
    const monthlyAmt = getMonthlyAmt(cat)
    if (monthlyAmt <= 0) return
    // Money out of primary account
    if (primaryAccountId && accountFlows[primaryAccountId]) {
      accountFlows[primaryAccountId].moneyOut += monthlyAmt
    }
    // Money into destination account
    const destId = cat.account_id
    if (destId && accountFlows[destId]) {
      accountFlows[destId].moneyIn += monthlyAmt
    }
  })

  // Fixed/Variable bills: money out of their account (or primary if no account_id)
  const allActiveBills = [...fixedCats, ...variableCats]
  allActiveBills.forEach(cat => {
    let monthlyAmt
    if (cat.category_type === 'variable') {
      monthlyAmt = getMonthlyAmt(cat)
    } else {
      monthlyAmt = isPerPeriod(cat) ? (cat.budget_amount || 0) * 2 : (cat.monthly_budget || 0)
    }
    if (monthlyAmt <= 0) return
    const acctId = cat.account_id || primaryAccountId
    if (acctId && accountFlows[acctId]) {
      accountFlows[acctId].moneyOut += monthlyAmt
    }
  })

  // Compute "Move to Checking" amount: sum of bills assigned to checking account
  // This is handled automatically by transfers above

  const accountList = Object.values(accountFlows).filter(a => a.moneyIn > 0 || a.moneyOut > 0)

  // Half section renderer
  const halfSection = (label, isFirst) => {
    const halfIncome = isFirst ? incomeFirst : incomeSecond
    const halfBills = isFirst ? mainBillsFirst : mainBillsSecond
    const sectionKey = isFirst ? 'first' : 'second'

    // Filter distributions and spending: show items without bill_day (per-period) in both halves,
    // but items with bill_day only in the matching half
    const halfDist = distributions.filter(c => !c.bill_day || (isFirst ? c.bill_day <= 14 : c.bill_day >= 15))
    const halfVar = variablePerHalf.filter(c => !c.bill_day || (isFirst ? c.bill_day <= 14 : c.bill_day >= 15))

    return (
      <div className="rounded-xl overflow-hidden min-w-0" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
          <h4 className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{label}</h4>
        </div>
        {colHeader('#3b82f6')}

        {halfIncome.map(inc => {
          let halfAmt = inc.amount
          if (inc.frequency === 'weekly') halfAmt = inc.amount * 2
          const incAcct = accounts.find(a => a.id === inc.account_id)
          const freqLabel = inc.frequency === 'weekly' ? ' (weekly)' : inc.frequency === 'biweekly' ? ' (bi-weekly)' : ''
          return lineRow('income', inc.id, inc.pay_day, `${inc.name}${freqLabel}`, halfAmt, incAcct?.name || moneyMarketName, true, true)
        })}
        {addForm(`${sectionKey}-income`)}
        <div className="flex justify-end px-2 py-0.5">
          <button onClick={() => openAddForm(`${sectionKey}-income`, 'income')}
            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded hover:bg-gray-700" style={{ color: 'var(--color-text-muted)' }}>
            <Plus className="w-3 h-3" /> Add Income
          </button>
        </div>

        {(halfDist.length > 0 || distributions.length > 0) && (
          <>
            <div className="text-xs font-semibold py-1 px-2" style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)', color: 'var(--color-text-primary)' }}>Distributions</div>
            {halfDist.map(cat => {
              const amt = getPerPeriodAmount(cat)
              if (amt <= 0) return null
              const destAcct = cat.account_id ? (accounts.find(a => a.id === cat.account_id)?.name || 'Unknown') : getTransferDest(cat)
              return lineRow('category', cat.id, cat.bill_day, `Move To ${cat.name}`, amt, destAcct, false, true)
            })}
            {addForm(`${sectionKey}-dist`)}
            <div className="flex justify-end px-2 py-0.5">
              <button onClick={() => openAddForm(`${sectionKey}-dist`, 'transfer')}
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded hover:bg-gray-700" style={{ color: 'var(--color-text-muted)' }}>
                <Plus className="w-3 h-3" /> Add Transfer
              </button>
            </div>
          </>
        )}

        {(halfVar.length > 0 || variablePerHalf.length > 0) && (
          <>
            <div className="text-xs font-semibold py-1 px-2" style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)', color: 'var(--color-text-primary)' }}>Spending</div>
            {halfVar.map(cat => {
              const amt = getPerPeriodAmount(cat)
              if (amt <= 0) return null
              return lineRow('category', cat.id, cat.bill_day, cat.name, amt, getAccountName(cat), false, true)
            })}
            {addForm(`${sectionKey}-spending`)}
            <div className="flex justify-end px-2 py-0.5">
              <button onClick={() => openAddForm(`${sectionKey}-spending`, 'spending')}
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded hover:bg-gray-700" style={{ color: 'var(--color-text-muted)' }}>
                <Plus className="w-3 h-3" /> Add Spending
              </button>
            </div>
          </>
        )}

        {halfBills.length > 0 && (
          <>
            <div className="text-xs font-semibold py-1 px-2" style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', color: 'var(--color-text-primary)' }}>Bills</div>
            {halfBills.map(cat => lineRow('category', cat.id, cat.bill_day, cat.name, getHalfBillAmount(cat), getAccountName(cat)))}
          </>
        )}

        {addForm(`${sectionKey}-bills`)}
        <div className="flex justify-end px-2 py-1">
          <button onClick={() => openAddForm(`${sectionKey}-bills`, 'bill')}
            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded hover:bg-gray-700" style={{ color: 'var(--color-text-muted)' }}>
            <Plus className="w-3 h-3" /> Add Bill
          </button>
        </div>
      </div>
    )
  }

  const getTransferDest = (cat) => {
    const nl = cat.name.toLowerCase()
    if (nl.includes('dane')) return "Dane's Spending"
    if (nl.includes('kelly')) return "Kelly's Spending"
    if (nl.includes('house') || nl.includes('travel')) return 'House/Travel Fund'
    return 'Main Checking'
  }

  // Person section renderer
  const personSection = (personName, ownerKey, bFirst, bSecond) => {
    // Find the person's spending account and transfers targeting it
    const personAcct = accounts.find(a => a.name.toLowerCase().includes(ownerKey))
    const personTransfers = transferCats.filter(c => c.account_id === personAcct?.id)

    // Filter deposits by half: no bill_day = per-period (both halves), bill_day = specific half
    const firstDeposits = personTransfers.filter(c => !c.bill_day || c.bill_day <= 14)
    const secondDeposits = personTransfers.filter(c => !c.bill_day || c.bill_day >= 15)

    const hasData = bFirst.length > 0 || bSecond.length > 0 || personTransfers.length > 0 || addingTo === `${ownerKey}-first` || addingTo === `${ownerKey}-second`
    if (!hasData) return null

    const firstBillTotal = bFirst.reduce((s, c) => s + getHalfBillAmount(c), 0)
    const secondBillTotal = bSecond.reduce((s, c) => s + getHalfBillAmount(c), 0)

    // Per-half deposit totals
    const firstDepositTotal = firstDeposits.reduce((s, c) => s + (c.budget_amount || 0), 0)
    const secondDepositTotal = secondDeposits.reduce((s, c) => s + (c.budget_amount || 0), 0)
    const firstHalfRemaining = firstDepositTotal - firstBillTotal
    const secondHalfRemaining = secondDepositTotal - secondBillTotal

    // Person spending data from API (includes rollover and spending)
    const personData = getPersonData(ownerKey, firstHalf)
    const secondPersonData = getPersonData(ownerKey, secondHalf)
    const rollover = personData.rollover || 0
    const periodSpent = (personData.period_spent || 0) + (secondPersonData.period_spent || 0)

    return (
      <div className="rounded-xl overflow-hidden min-w-0" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
          <h4 className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{personName}'s Budget</h4>
        </div>
        {colHeader('#8b5cf6')}

        <div className="text-xs font-semibold py-1 px-2" style={{ backgroundColor: 'rgba(139, 92, 246, 0.08)', color: 'var(--color-text-primary)' }}>1st - 14th</div>
        {firstDeposits.map(cat => lineRow('category', cat.id, cat.bill_day, 'Deposit', getPerPeriodAmount(cat), moneyMarketName, true, false))}
        {bFirst.map(cat => lineRow('category', cat.id, cat.bill_day, cat.name, getHalfBillAmount(cat), getAccountName(cat)))}
        {/* Inline Half Summary */}
        <div className="bg-gray-700/30 px-2 py-1.5 flex items-center justify-between text-xs" style={{ borderTop: '1px solid var(--color-border-default)' }}>
          <div className="flex items-center gap-4">
            <span style={{ color: 'var(--color-text-muted)' }}>Bills: <span className="font-semibold" style={{ color: '#ef4444' }}>-{fmt(firstBillTotal)}</span></span>
            <span style={{ color: 'var(--color-text-muted)' }}>Total: <span className="font-semibold" style={{ color: firstHalfRemaining >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(firstHalfRemaining)}</span></span>
          </div>
        </div>
        {addForm(`${ownerKey}-first`)}
        <div className="flex justify-end px-2 py-0.5">
          <button onClick={() => openAddForm(`${ownerKey}-first`, 'bill')}
            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded hover:bg-gray-700" style={{ color: 'var(--color-text-muted)' }}>
            <Plus className="w-3 h-3" /> Add Line
          </button>
        </div>

        <div className="text-xs font-semibold py-1 px-2" style={{ backgroundColor: 'rgba(139, 92, 246, 0.08)', color: 'var(--color-text-primary)' }}>15th - End</div>
        {secondDeposits.map(cat => lineRow('category', cat.id, cat.bill_day, 'Deposit', getPerPeriodAmount(cat), moneyMarketName, true, false))}
        {bSecond.map(cat => lineRow('category', cat.id, cat.bill_day, cat.name, getHalfBillAmount(cat), getAccountName(cat)))}
        {/* Inline Half Summary */}
        <div className="bg-gray-700/30 px-2 py-1.5 flex items-center justify-between text-xs" style={{ borderTop: '1px solid var(--color-border-default)' }}>
          <div className="flex items-center gap-4">
            <span style={{ color: 'var(--color-text-muted)' }}>Bills: <span className="font-semibold" style={{ color: '#ef4444' }}>-{fmt(secondBillTotal)}</span></span>
            <span style={{ color: 'var(--color-text-muted)' }}>Total: <span className="font-semibold" style={{ color: secondHalfRemaining >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(secondHalfRemaining)}</span></span>
          </div>
        </div>
        {addForm(`${ownerKey}-second`)}
        <div className="flex justify-end px-2 py-0.5">
          <button onClick={() => openAddForm(`${ownerKey}-second`, 'bill')}
            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded hover:bg-gray-700" style={{ color: 'var(--color-text-muted)' }}>
            <Plus className="w-3 h-3" /> Add Line
          </button>
        </div>

        <div className="py-1" style={{ borderTop: '2px solid var(--color-border-default)', backgroundColor: 'var(--color-bg-surface-soft)' }}>
          {/* Bottom totals */}
          <div>
            {/* Monthly remaining = first half remaining + second half remaining (pure budget math, no rollover) */}
            <div className="grid grid-cols-[40px_1fr_80px_44px] sm:grid-cols-[40px_1fr_80px_80px_44px] text-xs font-semibold py-0.5 px-2">
              <span /><span style={{ color: 'var(--color-text-primary)' }}>Monthly Remaining</span>
              <span className="text-right" style={{ color: (firstHalfRemaining + secondHalfRemaining) >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(firstHalfRemaining + secondHalfRemaining)}</span>
              <span className="hidden sm:inline" /><span />
            </div>
            {/* Rollover from prior months */}
            {rollover !== 0 && (
              <div className="grid grid-cols-[40px_1fr_80px_44px] sm:grid-cols-[40px_1fr_80px_80px_44px] text-xs py-0.5 px-2">
                <span /><span style={{ color: 'var(--color-text-muted)' }}>Rollover</span>
                <span className="text-right" style={{ color: rollover >= 0 ? '#22c55e' : '#ef4444' }}>{rollover >= 0 ? '+' : ''}{fmt(rollover)}</span>
                <span className="hidden sm:inline" /><span />
              </div>
            )}
            {/* Available to Spend = current half remaining + rollover - spending this period */}
            {(() => {
              // Determine current half based on today's date
              const isViewingCurrentMonth = today.getFullYear() === currentYear && today.getMonth() + 1 === currentMonth
              const viewingFirstHalf = isViewingCurrentMonth ? today.getDate() <= 14 : true
              const currentHalfRemaining = viewingFirstHalf ? firstHalfRemaining : secondHalfRemaining
              const available = currentHalfRemaining + rollover - periodSpent
              return (
                <div className="grid grid-cols-[40px_1fr_80px_44px] sm:grid-cols-[40px_1fr_80px_80px_44px] text-xs font-bold py-1.5 px-2" style={{ borderTop: '2px solid var(--color-border-default)', backgroundColor: 'rgba(34, 197, 94, 0.05)' }}>
                  <span /><span style={{ color: 'var(--color-text-primary)' }}>Available to Spend</span>
                  <span className="text-right text-sm" style={{ color: available >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(available)}</span>
                  <span className="hidden sm:inline" /><span />
                </div>
              )
            })()}
          </div>
        </div>
      </div>
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
            Monthly Budget - {monthNames[currentMonth - 1]} {currentYear}
          </h3>
          <button onClick={goToNextMonth} className="p-1 rounded hover:bg-gray-700">
            <ChevronRight className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
          </button>
        </div>
      </div>

      {/* Cards: Current half-month snapshot */}
      <div className="text-xs text-center mb-1" style={{ color: 'var(--color-text-muted)' }}>
        {isCurrentMonth ? (inFirstHalf ? '1st - 14th (current)' : '15th - End (current)') : (inFirstHalf ? '1st - 14th' : '15th - End')}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-2">
        <div className="rounded-xl p-2.5" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Income</div>
          <span className="text-sm font-bold" style={{ color: '#22c55e' }}>{fmt(cardIncome)}</span>
        </div>
        <div className="rounded-xl p-2.5" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Bills</div>
          <span className="text-sm font-bold" style={{ color: '#ef4444' }}>{fmt(cardBills)}</span>
        </div>
        {spendingCardCats.map(name => {
          const isDaneKelly = name.toLowerCase().includes('dane') || name.toLowerCase().includes('kelly')
          const ownerKey = name.toLowerCase().includes('dane') ? 'dane' : name.toLowerCase().includes('kelly') ? 'kelly' : null
          if (isDaneKelly) {
            const personData = getPersonData(ownerKey)
            const available = personData.available
            return (
              <div key={name} className="rounded-xl p-2.5" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
                <div className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>{name}</div>
                <span className="text-sm font-bold" style={{ color: available >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(available)}</span>
                {personData.period_spent > 0 && (
                  <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>spent: {fmt(personData.period_spent)}</div>
                )}
              </div>
            )
          }
          const remaining = getCatRemaining(name)
          return (
            <div key={name} className="rounded-xl p-2.5" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
              <div className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>{name}</div>
              <span className="text-sm font-bold" style={{ color: remaining >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(remaining)}</span>
            </div>
          )
        })}
        <div className="rounded-xl p-2.5" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Surplus</div>
          <span className="text-sm font-bold" style={{ color: cardSurplus >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(cardSurplus)}</span>
        </div>
      </div>

      {/* Both halves side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {halfSection('Beginning of Month (1st - 14th)', true)}
        {halfSection('End of Month (15th - End)', false)}
      </div>

      {/* Dane & Kelly side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {personSection("Dane", "dane", daneBillsFirst, daneBillsSecond)}
        {personSection("Kelly", "kelly", kellyBillsFirst, kellyBillsSecond)}
      </div>

      {/* Account Overview */}
      {accountList.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
            <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Account Overview</h4>
          </div>
          <div className="grid grid-cols-4 text-xs font-semibold py-1.5 px-4" style={{ backgroundColor: '#3b82f6', color: '#fff' }}>
            <span>Account</span>
            <span className="text-right">Money In</span>
            <span className="text-right">Money Out</span>
            <span className="text-right">Net</span>
          </div>
          {accountList.map((acct, i) => {
            const net = acct.moneyIn - acct.moneyOut
            return (
              <div key={i} className="grid grid-cols-4 text-xs py-1.5 px-4" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                <span style={{ color: 'var(--color-text-primary)' }}>{acct.name}</span>
                <span className="text-right" style={{ color: '#22c55e' }}>{fmt(acct.moneyIn)}</span>
                <span className="text-right" style={{ color: '#ef4444' }}>{fmt(acct.moneyOut)}</span>
                <span className="text-right font-semibold" style={{ color: net >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(net)}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Monthly Summary */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
          <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Monthly Summary</h4>
        </div>
        <div className="py-1">
          {[
            ['Total Money In', totalIncome, '#22c55e', false],
            ['Bills', totalBills, '#ef4444', true],
            ['Spending', totalSpending, '#ef4444', true],
            ['Distributions', totalDistributions, '#ef4444', true],
          ].map(([label, val, color, neg]) => (
            <div key={label} className="grid grid-cols-2 text-sm py-1.5 px-4">
              <span style={{ color: 'var(--color-text-primary)' }}>{label}</span>
              <span className="text-right font-bold" style={{ color }}>{neg ? '-' : ''}{fmt(val)}</span>
            </div>
          ))}
          <div className="grid grid-cols-2 text-sm py-1.5 px-4" style={{ borderTop: '1px solid var(--color-border-default)' }}>
            <span style={{ color: 'var(--color-text-primary)' }}>Total Outgoing</span>
            <span className="text-right font-bold" style={{ color: '#ef4444' }}>-{fmt(totalOutgoing)}</span>
          </div>
          <div className="grid grid-cols-2 text-sm font-bold py-2.5 px-4" style={{ borderTop: '2px solid var(--color-border-default)' }}>
            <span style={{ color: 'var(--color-text-primary)' }}>{surplus >= 0 ? 'Surplus' : 'Overage'}</span>
            <span className="text-right" style={{ color: surplus >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(surplus)}</span>
          </div>
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

export default MonthlyBudget
