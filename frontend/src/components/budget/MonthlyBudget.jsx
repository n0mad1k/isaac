import React, { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, Check, X, Trash2 } from 'lucide-react'
import {
  getBudgetPayPeriods, getBudgetCategories, getBudgetAccounts,
  getBudgetIncome, updateBudgetCategory, updateBudgetIncome,
  createBudgetCategory, deleteBudgetCategory
} from '../../services/api'

function MonthlyBudget() {
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [income, setIncome] = useState([])
  const [periods, setPeriods] = useState([])
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)

  // Editing state
  const [editingLine, setEditingLine] = useState(null) // { type: 'income'|'category', id, field }
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  // Adding line state
  const [addingTo, setAddingTo] = useState(null) // 'first-bills'|'second-bills'|'dane-first'|'dane-second'|'kelly-first'|'kelly-second'
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
      setPeriods(periodsRes.data || [])
      setCategories(catRes.data || [])
      setAccounts(acctRes.data || [])
      setIncome(incRes.data || [])
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

  // Edit handlers
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

  // Add line handler
  const saveNewLine = async () => {
    if (!addingTo || saving || !newLine.name || !newLine.amount) return
    setSaving(true)
    try {
      // Determine category type and owner based on section
      let category_type = 'fixed'
      let owner = null
      let bill_day = parseInt(newLine.bill_day) || null

      if (addingTo.startsWith('dane')) {
        owner = 'dane'
      } else if (addingTo.startsWith('kelly')) {
        owner = 'kelly'
      }

      // If adding to first half and no bill_day specified, default to 1
      if (addingTo.includes('first') && !bill_day) {
        bill_day = 1
      } else if (addingTo.includes('second') && !bill_day) {
        bill_day = 15
      }

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

  // Filter active categories
  const activeCats = categories.filter(c => c.is_active)
  const fixedCats = activeCats.filter(c => c.category_type === 'fixed')
  const variableCats = activeCats.filter(c => c.category_type === 'variable')
  const transferCats = activeCats.filter(c => c.category_type === 'transfer')

  // Split bills by period (bill_day 1-14 = first half, 15+ = second half, null = first half)
  const mainBillsFirst = fixedCats
    .filter(c => !c.owner && (!c.bill_day || c.bill_day <= 14))
    .sort((a, b) => (a.bill_day || 0) - (b.bill_day || 0) || a.sort_order - b.sort_order)
  const mainBillsSecond = fixedCats
    .filter(c => !c.owner && c.bill_day && c.bill_day >= 15)
    .sort((a, b) => (a.bill_day || 15) - (b.bill_day || 15) || a.sort_order - b.sort_order)

  // Dane/Kelly bills split by period
  const daneBillsFirst = fixedCats
    .filter(c => c.owner === 'dane' && (!c.bill_day || c.bill_day <= 14))
    .sort((a, b) => (a.bill_day || 0) - (b.bill_day || 0) || a.sort_order - b.sort_order)
  const daneBillsSecond = fixedCats
    .filter(c => c.owner === 'dane' && c.bill_day && c.bill_day >= 15)
    .sort((a, b) => (a.bill_day || 15) - (b.bill_day || 15) || a.sort_order - b.sort_order)
  const kellyBillsFirst = fixedCats
    .filter(c => c.owner === 'kelly' && (!c.bill_day || c.bill_day <= 14))
    .sort((a, b) => (a.bill_day || 0) - (b.bill_day || 0) || a.sort_order - b.sort_order)
  const kellyBillsSecond = fixedCats
    .filter(c => c.owner === 'kelly' && c.bill_day && c.bill_day >= 15)
    .sort((a, b) => (a.bill_day || 15) - (b.bill_day || 15) || a.sort_order - b.sort_order)

  // Income split by period
  const activeIncome = income.filter(i => i.is_active)
  const incomeFirst = activeIncome.filter(i => {
    if (i.frequency === 'weekly' || i.frequency === 'biweekly') return true // shown in both
    return !i.pay_day || i.pay_day <= 14
  })
  const incomeSecond = activeIncome.filter(i => {
    if (i.frequency === 'weekly' || i.frequency === 'biweekly') return true
    return i.pay_day && i.pay_day >= 15
  })

  // Calculate income for each half
  const calcHalfIncome = (incomeList, isFirst) => {
    let total = 0
    incomeList.forEach(inc => {
      if (inc.frequency === 'weekly') {
        total += inc.amount * 2 // ~2 weeks per half
      } else if (inc.frequency === 'biweekly') {
        total += inc.amount // 1 paycheck per half
      } else if (inc.frequency === 'semimonthly') {
        total += inc.amount // 1 payment per half
      } else {
        // monthly - only count in the half where pay_day falls
        if (isFirst && (!inc.pay_day || inc.pay_day <= 14)) total += inc.amount
        else if (!isFirst && inc.pay_day && inc.pay_day >= 15) total += inc.amount
      }
    })
    return total
  }

  // Distributions (transfer categories) - split per half
  const distributions = transferCats.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))

  // Variable spending per half (budget_amount is per-period)
  const variablePerHalf = variableCats.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))

  // Get bill amount - use monthly_budget for fixed, budget_amount * 2 as fallback
  const getBillAmount = (cat) => cat.monthly_budget || cat.budget_amount * 2 || 0

  // Get per-period amount for variable/transfer categories
  const getPerPeriodAmount = (cat) => cat.budget_amount || 0

  // Find account name for a category based on owner
  const getAccountName = (cat) => {
    if (cat.owner === 'dane') {
      const acct = accounts.find(a => a.name.toLowerCase().includes('dane'))
      return acct ? acct.name : "Dane's Spending"
    }
    if (cat.owner === 'kelly') {
      const acct = accounts.find(a => a.name.toLowerCase().includes('kelly'))
      return acct ? acct.name : "Kelly's Spending"
    }
    const acct = accounts.find(a => a.account_type === 'checking')
    return acct ? acct.name : 'Main Checking'
  }

  // Render an editable cell
  const renderEditableCell = (type, id, field, value, displayValue, className = '', style = {}) => {
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
            className="w-full px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-xs text-right"
            style={{ color: 'var(--color-text-primary)' }}
            autoFocus
          />
          <button onClick={saveEdit} className="p-0.5 text-green-400 flex-shrink-0"><Check className="w-3 h-3" /></button>
          <button onClick={cancelEdit} className="p-0.5 text-gray-400 flex-shrink-0"><X className="w-3 h-3" /></button>
        </span>
      )
    }
    return (
      <span
        className={`cursor-pointer hover:underline ${className}`}
        style={style}
        onClick={() => startEdit(type, id, field, value)}
        title="Click to edit"
      >
        {displayValue}
      </span>
    )
  }

  // Render a line item row
  const renderLineRow = (type, id, day, name, amount, accountName, isIncome = false, canDelete = true) => {
    const displayAmt = isIncome ? fmt(amount) : `-${fmt(Math.abs(amount))}`
    const amtColor = isIncome ? '#22c55e' : '#ef4444'
    const amtField = type === 'income' ? 'amount' : (categories.find(c => c.id === id)?.category_type === 'fixed' ? 'monthly_budget' : 'budget_amount')

    return (
      <div key={`${type}-${id}`} className="grid grid-cols-[50px_1fr_100px_120px_30px] text-xs py-1.5 px-3 items-center" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
        {/* Date */}
        <span style={{ color: 'var(--color-text-muted)' }}>{day ? ordinal(day) : ''}</span>
        {/* Item name */}
        {renderEditableCell(type, id, 'name', name, name, 'text-left', { color: 'var(--color-text-primary)' })}
        {/* Amount */}
        {renderEditableCell(type, id, amtField, Math.abs(amount), displayAmt, 'text-right', { color: amtColor })}
        {/* Account */}
        <span className="text-right" style={{ color: 'var(--color-text-muted)' }}>{accountName}</span>
        {/* Delete */}
        {canDelete && type === 'category' ? (
          <button onClick={() => deleteLine(id)} className="p-0.5 text-gray-600 hover:text-red-400 flex-shrink-0" title="Remove">
            <Trash2 className="w-3 h-3" />
          </button>
        ) : <span />}
      </div>
    )
  }

  // Render add line form
  const renderAddForm = (sectionKey) => {
    if (addingTo !== sectionKey) return null
    return (
      <div className="grid grid-cols-[50px_1fr_100px_120px_30px] text-xs py-1.5 px-3 items-center gap-1" style={{ borderBottom: '1px solid var(--color-border-default)', backgroundColor: 'rgba(34, 197, 94, 0.05)' }}>
        <input
          type="number"
          placeholder="Day"
          value={newLine.bill_day}
          onChange={(e) => setNewLine(f => ({ ...f, bill_day: e.target.value }))}
          className="w-full px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs"
          style={{ color: 'var(--color-text-primary)' }}
        />
        <input
          type="text"
          placeholder="Item name"
          value={newLine.name}
          onChange={(e) => setNewLine(f => ({ ...f, name: e.target.value }))}
          className="w-full px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs"
          style={{ color: 'var(--color-text-primary)' }}
          autoFocus
        />
        <input
          type="number"
          step="0.01"
          placeholder="Amount"
          value={newLine.amount}
          onChange={(e) => setNewLine(f => ({ ...f, amount: e.target.value }))}
          className="w-full px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs text-right"
          style={{ color: 'var(--color-text-primary)' }}
          onKeyDown={(e) => { if (e.key === 'Enter') saveNewLine() }}
        />
        <span className="flex items-center justify-end gap-0.5">
          <button onClick={saveNewLine} disabled={saving} className="p-0.5 text-green-400"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={() => { setAddingTo(null); setNewLine({ name: '', amount: '', bill_day: '' }) }} className="p-0.5 text-gray-400"><X className="w-3.5 h-3.5" /></button>
        </span>
        <span />
      </div>
    )
  }

  // Section header row
  const sectionHeader = (title, bgColor = '#3b82f6') => (
    <div className="grid grid-cols-[50px_1fr_100px_120px_30px] text-xs font-semibold py-2 px-3" style={{ backgroundColor: bgColor, color: '#fff' }}>
      <span>Date</span>
      <span>Item</span>
      <span className="text-right">Amount</span>
      <span className="text-right">Account</span>
      <span />
    </div>
  )

  // Calculate totals for a half
  const firstHalfIncome = calcHalfIncome(activeIncome, true)
  const secondHalfIncome = calcHalfIncome(activeIncome, false)

  const firstHalfBills = mainBillsFirst.reduce((s, c) => s + getBillAmount(c), 0)
  const secondHalfBills = mainBillsSecond.reduce((s, c) => s + getBillAmount(c), 0)

  const firstHalfDistributions = distributions.reduce((s, c) => s + getPerPeriodAmount(c), 0)
  const secondHalfDistributions = distributions.reduce((s, c) => s + getPerPeriodAmount(c), 0)

  const firstHalfVariable = variablePerHalf.reduce((s, c) => s + getPerPeriodAmount(c), 0)
  const secondHalfVariable = variablePerHalf.reduce((s, c) => s + getPerPeriodAmount(c), 0)

  const daneBillsFirstTotal = daneBillsFirst.reduce((s, c) => s + getBillAmount(c), 0)
  const daneBillsSecondTotal = daneBillsSecond.reduce((s, c) => s + getBillAmount(c), 0)
  const kellyBillsFirstTotal = kellyBillsFirst.reduce((s, c) => s + getBillAmount(c), 0)
  const kellyBillsSecondTotal = kellyBillsSecond.reduce((s, c) => s + getBillAmount(c), 0)

  // Grand totals
  const totalIncome = firstHalfIncome + secondHalfIncome
  const totalBills = firstHalfBills + secondHalfBills + daneBillsFirstTotal + daneBillsSecondTotal + kellyBillsFirstTotal + kellyBillsSecondTotal
  const totalSpending = firstHalfVariable + secondHalfVariable
  const totalSavings = firstHalfDistributions + secondHalfDistributions
  const totalOutgoing = totalBills + totalSpending + totalSavings
  const moneyAfterBills = totalIncome - totalOutgoing

  // Get Money Market account name
  const moneyMarketAcct = accounts.find(a => a.name.toLowerCase().includes('money market'))
  const moneyMarketName = moneyMarketAcct ? moneyMarketAcct.name : 'Money Market'

  // Render a half-of-month section
  const renderHalfSection = (label, isFirst) => {
    const halfIncome = isFirst ? incomeFirst : incomeSecond
    const halfBills = isFirst ? mainBillsFirst : mainBillsSecond
    const halfBillsTotal = isFirst ? firstHalfBills : secondHalfBills
    const sectionKey = isFirst ? 'first' : 'second'

    return (
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        {/* Section title */}
        <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
          <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {label}
          </h4>
        </div>

        {sectionHeader('', '#3b82f6')}

        {/* Income lines */}
        {halfIncome.map(inc => {
          let halfAmt = inc.amount
          if (inc.frequency === 'weekly') halfAmt = inc.amount * 2
          else if (inc.frequency === 'biweekly') halfAmt = inc.amount
          else if (inc.frequency === 'semimonthly') halfAmt = inc.amount
          // monthly: full amount in its half
          const incAcct = accounts.find(a => a.id === inc.account_id)
          return renderLineRow('income', inc.id, inc.pay_day, inc.name, halfAmt, incAcct?.name || moneyMarketName, true, false)
        })}

        {/* Distributions (transfers from Money Market) */}
        {distributions.length > 0 && (
          <>
            <div className="text-xs font-semibold py-1.5 px-3" style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)', color: 'var(--color-text-primary)' }}>
              Distributions
            </div>
            {distributions.map(cat => {
              const amt = getPerPeriodAmount(cat)
              if (amt <= 0) return null
              // Find destination account
              let destAcct = 'Main Checking'
              const nameLower = cat.name.toLowerCase()
              if (nameLower.includes('dane')) destAcct = "Dane's Spending"
              else if (nameLower.includes('kelly')) destAcct = "Kelly's Spending"
              else if (nameLower.includes('house') || nameLower.includes('travel')) destAcct = 'House/Travel Fund'
              else if (nameLower.includes('saving')) destAcct = 'Savings'
              const matchedAcct = accounts.find(a => a.name.toLowerCase().includes(nameLower.split(' ')[0]))
              if (matchedAcct) destAcct = matchedAcct.name
              return renderLineRow('category', cat.id, null, `Move To ${cat.name}`, amt, destAcct, false, false)
            })}
          </>
        )}

        {/* Variable spending allocations */}
        {variablePerHalf.length > 0 && (
          <>
            <div className="text-xs font-semibold py-1.5 px-3" style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)', color: 'var(--color-text-primary)' }}>
              Spending Allocations
            </div>
            {variablePerHalf.map(cat => {
              const amt = getPerPeriodAmount(cat)
              if (amt <= 0) return null
              return renderLineRow('category', cat.id, null, cat.name, amt, getAccountName(cat), false, false)
            })}
          </>
        )}

        {/* Bills for this half */}
        {halfBills.length > 0 && (
          <>
            <div className="text-xs font-semibold py-1.5 px-3" style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', color: 'var(--color-text-primary)' }}>
              Bills
            </div>
            {halfBills.map(cat => {
              const amt = getBillAmount(cat)
              return renderLineRow('category', cat.id, cat.bill_day, cat.name, amt, getAccountName(cat))
            })}
          </>
        )}

        {/* Add bill line */}
        {renderAddForm(`${sectionKey}-bills`)}
        <div className="flex justify-end px-3 py-1">
          <button
            onClick={() => { setAddingTo(`${sectionKey}-bills`); setNewLine({ name: '', amount: '', bill_day: '' }) }}
            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded hover:bg-gray-700"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <Plus className="w-3 h-3" /> Add Bill
          </button>
        </div>

        {/* Half total */}
        <div className="grid grid-cols-[50px_1fr_100px_120px_30px] text-xs font-bold py-2 px-3" style={{ borderTop: '2px solid var(--color-border-default)', backgroundColor: 'var(--color-bg-surface-soft)' }}>
          <span />
          <span style={{ color: 'var(--color-text-primary)' }}>Period Total</span>
          <span className="text-right" style={{ color: '#ef4444' }}>-{fmt(halfBillsTotal + (isFirst ? firstHalfDistributions + firstHalfVariable : secondHalfDistributions + secondHalfVariable))}</span>
          <span />
          <span />
        </div>
      </div>
    )
  }

  // Render Dane/Kelly section
  const renderPersonSection = (personName, ownerKey, billsFirst, billsSecond, billsFirstTotal, billsSecondTotal) => {
    if (billsFirst.length === 0 && billsSecond.length === 0 && addingTo !== `${ownerKey}-first` && addingTo !== `${ownerKey}-second`) return null

    return (
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
          <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {personName}'s Spending Bills
          </h4>
        </div>

        {sectionHeader('', '#8b5cf6')}

        {/* Beginning of Month */}
        {(billsFirst.length > 0 || addingTo === `${ownerKey}-first`) && (
          <>
            <div className="text-xs font-semibold py-1.5 px-3" style={{ backgroundColor: 'rgba(139, 92, 246, 0.08)', color: 'var(--color-text-primary)' }}>
              Beginning of Month
            </div>
            {billsFirst.map(cat => {
              const amt = getBillAmount(cat)
              return renderLineRow('category', cat.id, cat.bill_day, cat.name, amt, getAccountName(cat))
            })}
            {renderAddForm(`${ownerKey}-first`)}
            <div className="flex justify-end px-3 py-1">
              <button
                onClick={() => { setAddingTo(`${ownerKey}-first`); setNewLine({ name: '', amount: '', bill_day: '' }) }}
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded hover:bg-gray-700"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <Plus className="w-3 h-3" /> Add Bill
              </button>
            </div>
          </>
        )}

        {/* End of Month */}
        {(billsSecond.length > 0 || addingTo === `${ownerKey}-second`) && (
          <>
            <div className="text-xs font-semibold py-1.5 px-3" style={{ backgroundColor: 'rgba(139, 92, 246, 0.08)', color: 'var(--color-text-primary)' }}>
              End of Month
            </div>
            {billsSecond.map(cat => {
              const amt = getBillAmount(cat)
              return renderLineRow('category', cat.id, cat.bill_day, cat.name, amt, getAccountName(cat))
            })}
            {renderAddForm(`${ownerKey}-second`)}
            <div className="flex justify-end px-3 py-1">
              <button
                onClick={() => { setAddingTo(`${ownerKey}-second`); setNewLine({ name: '', amount: '', bill_day: '' }) }}
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded hover:bg-gray-700"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <Plus className="w-3 h-3" /> Add Bill
              </button>
            </div>
          </>
        )}

        {/* Person total */}
        <div className="grid grid-cols-[50px_1fr_100px_120px_30px] text-xs font-bold py-2 px-3" style={{ borderTop: '2px solid var(--color-border-default)', backgroundColor: 'var(--color-bg-surface-soft)' }}>
          <span />
          <span style={{ color: 'var(--color-text-primary)' }}>{personName}'s Total</span>
          <span className="text-right" style={{ color: '#ef4444' }}>-{fmt(billsFirstTotal + billsSecondTotal)}</span>
          <span />
          <span />
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Money In</div>
          <span className="text-lg font-bold" style={{ color: '#22c55e' }}>{fmt(totalIncome)}</span>
        </div>
        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Bills</div>
          <span className="text-lg font-bold" style={{ color: '#ef4444' }}>{fmt(totalBills)}</span>
        </div>
        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Spending + Savings</div>
          <span className="text-lg font-bold" style={{ color: '#f59e0b' }}>{fmt(totalSpending + totalSavings)}</span>
        </div>
        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Remaining</div>
          <span className="text-lg font-bold" style={{ color: moneyAfterBills >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(moneyAfterBills)}</span>
        </div>
      </div>

      {/* Beginning of Month */}
      {renderHalfSection('Beginning of Month (1st - 14th)', true)}

      {/* End of Month */}
      {renderHalfSection('End of Month (15th - End)', false)}

      {/* Dane's Spending Bills */}
      {renderPersonSection("Dane", "dane", daneBillsFirst, daneBillsSecond, daneBillsFirstTotal, daneBillsSecondTotal)}

      {/* Kelly's Spending Bills */}
      {renderPersonSection("Kelly", "kelly", kellyBillsFirst, kellyBillsSecond, kellyBillsFirstTotal, kellyBillsSecondTotal)}

      {/* Grand Totals */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
          <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Monthly Summary
          </h4>
        </div>

        <div className="py-1">
          <div className="grid grid-cols-2 text-sm py-2 px-4">
            <span style={{ color: 'var(--color-text-primary)' }}>Total Money In</span>
            <span className="text-right font-bold" style={{ color: '#22c55e' }}>{fmt(totalIncome)}</span>
          </div>
          <div className="grid grid-cols-2 text-sm py-2 px-4">
            <span style={{ color: 'var(--color-text-primary)' }}>Bills</span>
            <span className="text-right font-bold" style={{ color: '#ef4444' }}>-{fmt(totalBills)}</span>
          </div>
          <div className="grid grid-cols-2 text-sm py-2 px-4">
            <span style={{ color: 'var(--color-text-primary)' }}>Spending</span>
            <span className="text-right font-bold" style={{ color: '#ef4444' }}>-{fmt(totalSpending)}</span>
          </div>
          <div className="grid grid-cols-2 text-sm py-2 px-4">
            <span style={{ color: 'var(--color-text-primary)' }}>Savings & Transfers</span>
            <span className="text-right font-bold" style={{ color: '#ef4444' }}>-{fmt(totalSavings)}</span>
          </div>
          <div className="grid grid-cols-2 text-sm py-2 px-4" style={{ borderTop: '1px solid var(--color-border-default)' }}>
            <span style={{ color: 'var(--color-text-primary)' }}>Total Outgoing</span>
            <span className="text-right font-bold" style={{ color: '#ef4444' }}>-{fmt(totalOutgoing)}</span>
          </div>
          <div className="grid grid-cols-2 text-sm font-bold py-3 px-4" style={{ borderTop: '2px solid var(--color-border-default)' }}>
            <span style={{ color: 'var(--color-text-primary)' }}>Money After Bills</span>
            <span className="text-right" style={{ color: moneyAfterBills >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(moneyAfterBills)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MonthlyBudget
