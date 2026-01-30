import React, { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, Check, X, Trash2 } from 'lucide-react'
import {
  getBudgetPayPeriods, getBudgetCategories, getBudgetAccounts,
  getBudgetIncome, updateBudgetCategory, updateBudgetIncome,
  createBudgetCategory, deleteBudgetCategory, getBudgetPeriodSummary
} from '../../services/api'

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

  const [editingLine, setEditingLine] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [addingTo, setAddingTo] = useState(null)
  const [newLine, setNewLine] = useState({ name: '', amount: '', bill_day: '' })

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

  const saveNewLine = async () => {
    if (!addingTo || saving || !newLine.name || !newLine.amount) return
    setSaving(true)
    try {
      let category_type = 'fixed'
      let owner = null
      let bill_day = parseInt(newLine.bill_day) || null

      if (addingTo.startsWith('dane')) owner = 'dane'
      else if (addingTo.startsWith('kelly')) owner = 'kelly'

      if (addingTo.includes('first') && !bill_day) bill_day = 1
      else if (addingTo.includes('second') && !bill_day) bill_day = 15

      await createBudgetCategory({
        name: newLine.name,
        category_type,
        monthly_budget: parseFloat(newLine.amount) || 0,
        budget_amount: 0,
        owner,
        bill_day,
      })
      setAddingTo(null)
      setNewLine({ name: '', amount: '', bill_day: '' })
      fetchData()
    } catch (err) {
      console.error('Failed to add line:', err)
    } finally {
      setSaving(false)
    }
  }

  const deleteLine = async (catId) => {
    if (!window.confirm('Remove this line item?')) return
    try {
      await deleteBudgetCategory(catId)
      fetchData()
    } catch (err) {
      console.error('Failed to delete:', err)
    }
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
  const fixedCats = activeCats.filter(c => c.category_type === 'fixed')
  const variableCats = activeCats.filter(c => c.category_type === 'variable')
  const transferCats = activeCats.filter(c => c.category_type === 'transfer')

  const mainBillsFirst = fixedCats.filter(c => !c.owner && (!c.bill_day || c.bill_day <= 14)).sort((a, b) => (a.bill_day || 0) - (b.bill_day || 0) || a.sort_order - b.sort_order)
  const mainBillsSecond = fixedCats.filter(c => !c.owner && c.bill_day && c.bill_day >= 15).sort((a, b) => (a.bill_day || 15) - (b.bill_day || 15) || a.sort_order - b.sort_order)
  const daneBillsFirst = fixedCats.filter(c => c.owner === 'dane' && (!c.bill_day || c.bill_day <= 14)).sort((a, b) => (a.bill_day || 0) - (b.bill_day || 0) || a.sort_order - b.sort_order)
  const daneBillsSecond = fixedCats.filter(c => c.owner === 'dane' && c.bill_day && c.bill_day >= 15).sort((a, b) => (a.bill_day || 15) - (b.bill_day || 15) || a.sort_order - b.sort_order)
  const kellyBillsFirst = fixedCats.filter(c => c.owner === 'kelly' && (!c.bill_day || c.bill_day <= 14)).sort((a, b) => (a.bill_day || 0) - (b.bill_day || 0) || a.sort_order - b.sort_order)
  const kellyBillsSecond = fixedCats.filter(c => c.owner === 'kelly' && c.bill_day && c.bill_day >= 15).sort((a, b) => (a.bill_day || 15) - (b.bill_day || 15) || a.sort_order - b.sort_order)

  const activeIncome = income.filter(i => i.is_active)
  const incomeFirst = activeIncome.filter(i => i.frequency === 'weekly' || i.frequency === 'biweekly' || !i.pay_day || i.pay_day <= 14)
  const incomeSecond = activeIncome.filter(i => i.frequency === 'weekly' || i.frequency === 'biweekly' || (i.pay_day && i.pay_day >= 15))

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

  const getBillAmount = (cat) => cat.monthly_budget || cat.budget_amount * 2 || 0
  const getPerPeriodAmount = (cat) => cat.budget_amount || 0

  const getAccountName = (cat) => {
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
    const amtField = type === 'income' ? 'amount' : (categories.find(c => c.id === id)?.category_type === 'fixed' ? 'monthly_budget' : 'budget_amount')

    return (
      <div key={`${type}-${id}`} className="grid grid-cols-[40px_1fr_80px_90px_24px] text-xs py-1 px-2 items-center" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>{day ? ordinal(day) : ''}</span>
        {editableCell(type, id, 'name', name, name, 'text-left truncate', { color: 'var(--color-text-primary)' })}
        {editableCell(type, id, amtField, Math.abs(amount), displayAmt, 'text-right', { color: amtColor })}
        <span className="text-right truncate" style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>{accountName}</span>
        {canDelete && type === 'category' ? (
          <button onClick={() => deleteLine(id)} className="p-0.5 text-gray-600 hover:text-red-400 flex-shrink-0"><Trash2 className="w-2.5 h-2.5" /></button>
        ) : <span />}
      </div>
    )
  }

  const addForm = (sectionKey) => {
    if (addingTo !== sectionKey) return null
    return (
      <div className="grid grid-cols-[40px_1fr_80px_90px_24px] text-xs py-1 px-2 items-center gap-1" style={{ borderBottom: '1px solid var(--color-border-default)', backgroundColor: 'rgba(34, 197, 94, 0.05)' }}>
        <input type="number" placeholder="Day" value={newLine.bill_day} onChange={(e) => setNewLine(f => ({ ...f, bill_day: e.target.value }))}
          className="w-full px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs" style={{ color: 'var(--color-text-primary)' }} />
        <input type="text" placeholder="Name" value={newLine.name} onChange={(e) => setNewLine(f => ({ ...f, name: e.target.value }))}
          className="w-full px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs" style={{ color: 'var(--color-text-primary)' }} autoFocus />
        <input type="number" step="0.01" placeholder="Amt" value={newLine.amount} onChange={(e) => setNewLine(f => ({ ...f, amount: e.target.value }))}
          className="w-full px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs text-right" style={{ color: 'var(--color-text-primary)' }}
          onKeyDown={(e) => { if (e.key === 'Enter') saveNewLine() }} />
        <span className="flex items-center justify-end gap-0.5">
          <button onClick={saveNewLine} disabled={saving} className="p-0.5 text-green-400"><Check className="w-3 h-3" /></button>
          <button onClick={() => { setAddingTo(null); setNewLine({ name: '', amount: '', bill_day: '' }) }} className="p-0.5 text-gray-400"><X className="w-3 h-3" /></button>
        </span>
        <span />
      </div>
    )
  }

  const colHeader = (bgColor = '#3b82f6') => (
    <div className="grid grid-cols-[40px_1fr_80px_90px_24px] text-xs font-semibold py-1.5 px-2" style={{ backgroundColor: bgColor, color: '#fff' }}>
      <span>Date</span><span>Item</span><span className="text-right">Amount</span><span className="text-right">Account</span><span />
    </div>
  )

  const moneyMarketName = accounts.find(a => a.name.toLowerCase().includes('money market'))?.name || 'Money Market'

  // Totals
  const firstHalfIncome = calcHalfIncome(activeIncome, true)
  const secondHalfIncome = calcHalfIncome(activeIncome, false)
  const firstHalfBills = mainBillsFirst.reduce((s, c) => s + getBillAmount(c), 0)
  const secondHalfBills = mainBillsSecond.reduce((s, c) => s + getBillAmount(c), 0)
  const distPerHalf = distributions.reduce((s, c) => s + getPerPeriodAmount(c), 0)
  const varPerHalf = variablePerHalf.reduce((s, c) => s + getPerPeriodAmount(c), 0)
  const daneBFirst = daneBillsFirst.reduce((s, c) => s + getBillAmount(c), 0)
  const daneBSecond = daneBillsSecond.reduce((s, c) => s + getBillAmount(c), 0)
  const kellyBFirst = kellyBillsFirst.reduce((s, c) => s + getBillAmount(c), 0)
  const kellyBSecond = kellyBillsSecond.reduce((s, c) => s + getBillAmount(c), 0)

  const totalIncome = firstHalfIncome + secondHalfIncome
  const totalBills = firstHalfBills + secondHalfBills + daneBFirst + daneBSecond + kellyBFirst + kellyBSecond
  const totalSpending = varPerHalf * 2
  const totalSavings = distPerHalf * 2
  const totalOutgoing = totalBills + totalSpending + totalSavings
  const surplus = totalIncome - totalOutgoing

  // Get spent data from summary for spending category cards
  const getCatSpent = (catName) => {
    const h1Cat = firstHalf?.categories?.find(c => c.name === catName)
    const h2Cat = secondHalf?.categories?.find(c => c.name === catName)
    const budgeted = (h1Cat?.budgeted || 0) + (h2Cat?.budgeted || 0)
    const spent = (h1Cat?.spent || 0) + (h2Cat?.spent || 0)
    return budgeted - spent
  }

  const spendingCardCats = ['Gas', 'Groceries', 'Main Spending', 'Dane Spending', 'Kelly Spending']

  // Half section renderer
  const halfSection = (label, isFirst) => {
    const halfIncome = isFirst ? incomeFirst : incomeSecond
    const halfBills = isFirst ? mainBillsFirst : mainBillsSecond
    const sectionKey = isFirst ? 'first' : 'second'

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
          return lineRow('income', inc.id, inc.pay_day, inc.name, halfAmt, incAcct?.name || moneyMarketName, true, false)
        })}

        {distributions.length > 0 && (
          <>
            <div className="text-xs font-semibold py-1 px-2" style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)', color: 'var(--color-text-primary)' }}>Distributions</div>
            {distributions.map(cat => {
              const amt = getPerPeriodAmount(cat)
              if (amt <= 0) return null
              let destAcct = 'Main Checking'
              const nl = cat.name.toLowerCase()
              if (nl.includes('dane')) destAcct = "Dane's Spending"
              else if (nl.includes('kelly')) destAcct = "Kelly's Spending"
              else if (nl.includes('house') || nl.includes('travel')) destAcct = 'House/Travel Fund'
              return lineRow('category', cat.id, null, `Move To ${cat.name}`, amt, destAcct, false, false)
            })}
          </>
        )}

        {variablePerHalf.length > 0 && (
          <>
            <div className="text-xs font-semibold py-1 px-2" style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)', color: 'var(--color-text-primary)' }}>Spending</div>
            {variablePerHalf.map(cat => {
              const amt = getPerPeriodAmount(cat)
              if (amt <= 0) return null
              return lineRow('category', cat.id, null, cat.name, amt, getAccountName(cat), false, false)
            })}
          </>
        )}

        {halfBills.length > 0 && (
          <>
            <div className="text-xs font-semibold py-1 px-2" style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', color: 'var(--color-text-primary)' }}>Bills</div>
            {halfBills.map(cat => lineRow('category', cat.id, cat.bill_day, cat.name, getBillAmount(cat), getAccountName(cat)))}
          </>
        )}

        {addForm(`${sectionKey}-bills`)}
        <div className="flex justify-end px-2 py-1">
          <button onClick={() => { setAddingTo(`${sectionKey}-bills`); setNewLine({ name: '', amount: '', bill_day: '' }) }}
            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded hover:bg-gray-700" style={{ color: 'var(--color-text-muted)' }}>
            <Plus className="w-3 h-3" /> Add Line
          </button>
        </div>
      </div>
    )
  }

  // Person section renderer
  const personSection = (personName, ownerKey, bFirst, bSecond) => {
    const hasData = bFirst.length > 0 || bSecond.length > 0 || addingTo === `${ownerKey}-first` || addingTo === `${ownerKey}-second`
    if (!hasData) return null

    return (
      <div className="rounded-xl overflow-hidden min-w-0" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
          <h4 className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{personName}'s Bills</h4>
        </div>
        {colHeader('#8b5cf6')}

        <div className="text-xs font-semibold py-1 px-2" style={{ backgroundColor: 'rgba(139, 92, 246, 0.08)', color: 'var(--color-text-primary)' }}>1st - 14th</div>
        {bFirst.map(cat => lineRow('category', cat.id, cat.bill_day, cat.name, getBillAmount(cat), getAccountName(cat)))}
        {addForm(`${ownerKey}-first`)}
        <div className="flex justify-end px-2 py-0.5">
          <button onClick={() => { setAddingTo(`${ownerKey}-first`); setNewLine({ name: '', amount: '', bill_day: '' }) }}
            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded hover:bg-gray-700" style={{ color: 'var(--color-text-muted)' }}>
            <Plus className="w-3 h-3" /> Add Line
          </button>
        </div>

        <div className="text-xs font-semibold py-1 px-2" style={{ backgroundColor: 'rgba(139, 92, 246, 0.08)', color: 'var(--color-text-primary)' }}>15th - End</div>
        {bSecond.map(cat => lineRow('category', cat.id, cat.bill_day, cat.name, getBillAmount(cat), getAccountName(cat)))}
        {addForm(`${ownerKey}-second`)}
        <div className="flex justify-end px-2 py-0.5">
          <button onClick={() => { setAddingTo(`${ownerKey}-second`); setNewLine({ name: '', amount: '', bill_day: '' }) }}
            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded hover:bg-gray-700" style={{ color: 'var(--color-text-muted)' }}>
            <Plus className="w-3 h-3" /> Add Line
          </button>
        </div>

        <div className="grid grid-cols-[40px_1fr_80px_90px_24px] text-xs font-bold py-1.5 px-2" style={{ borderTop: '2px solid var(--color-border-default)', backgroundColor: 'var(--color-bg-surface-soft)' }}>
          <span /><span style={{ color: 'var(--color-text-primary)' }}>Total</span>
          <span className="text-right" style={{ color: '#ef4444' }}>-{fmt(bFirst.reduce((s, c) => s + getBillAmount(c), 0) + bSecond.reduce((s, c) => s + getBillAmount(c), 0))}</span>
          <span /><span />
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

      {/* Cards: Income, Bills, per-category remaining, Surplus */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        <div className="rounded-xl p-2.5" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Income</div>
          <span className="text-sm font-bold" style={{ color: '#22c55e' }}>{fmt(totalIncome)}</span>
        </div>
        <div className="rounded-xl p-2.5" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Bills</div>
          <span className="text-sm font-bold" style={{ color: '#ef4444' }}>{fmt(totalBills)}</span>
        </div>
        {spendingCardCats.map(name => {
          const remaining = getCatSpent(name)
          return (
            <div key={name} className="rounded-xl p-2.5" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
              <div className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>{name}</div>
              <span className="text-sm font-bold" style={{ color: remaining >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(remaining)}</span>
            </div>
          )
        })}
        <div className="rounded-xl p-2.5" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Surplus</div>
          <span className="text-sm font-bold" style={{ color: surplus >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(surplus)}</span>
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
            ['Savings & Transfers', totalSavings, '#ef4444', true],
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
    </div>
  )
}

export default MonthlyBudget
