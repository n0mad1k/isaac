import React, { useState, useEffect, useCallback } from 'react'
import { Plus, X, Trash2, Pencil, Check } from 'lucide-react'
import {
  getBudgetTransactions, createBudgetTransaction, updateBudgetTransaction,
  deleteBudgetTransaction, getBudgetAccounts, getBudgetCategories, getBudgetPeriodReference
} from '../../services/api'
import { useSettings } from '../../contexts/SettingsContext'

function BudgetTransactions() {
  const { formatDate } = useSettings()
  const [transactions, setTransactions] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [page, setPage] = useState(0)
  const [referenceDate, setReferenceDate] = useState(null)
  const [initializing, setInitializing] = useState(true)
  const pageSize = 50

  // Period filter: 'current' = current half, 'month' = full month, 'all' = everything
  const [periodFilter, setPeriodFilter] = useState('current')

  // Load period reference on mount
  useEffect(() => {
    const loadReference = async () => {
      try {
        const res = await getBudgetPeriodReference()
        const refDateStr = res.data?.reference_date
        if (refDateStr) {
          setReferenceDate(new Date(refDateStr + 'T12:00:00'))
        } else {
          setReferenceDate(new Date())
        }
      } catch (err) {
        console.error('Failed to load period reference:', err)
        setReferenceDate(new Date())
      } finally {
        setInitializing(false)
      }
    }
    loadReference()
  }, [])

  // Calculate current half-period date range using reference date
  const getDateRange = (filter) => {
    const refDate = referenceDate || new Date()
    const y = refDate.getFullYear()
    const m = refDate.getMonth() + 1
    const mStr = String(m).padStart(2, '0')

    if (filter === 'current') {
      if (refDate.getDate() <= 14) {
        return { start_date: `${y}-${mStr}-01`, end_date: `${y}-${mStr}-14` }
      } else {
        const lastDay = new Date(y, m, 0).getDate()
        return { start_date: `${y}-${mStr}-15`, end_date: `${y}-${mStr}-${lastDay}` }
      }
    } else if (filter === 'month') {
      const lastDay = new Date(y, m, 0).getDate()
      return { start_date: `${y}-${mStr}-01`, end_date: `${y}-${mStr}-${lastDay}` }
    }
    return {} // 'all' - no filter
  }

  // Add/Edit form
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    category_id: '',
    account_id: '',
  })

  const fetchData = useCallback(async () => {
    if (initializing) return // Wait for reference date
    setLoading(true)
    try {
      const dateRange = getDateRange(periodFilter)
      const [txnRes, accRes, catRes] = await Promise.all([
        getBudgetTransactions({ limit: pageSize, offset: page * pageSize, ...dateRange }),
        getBudgetAccounts(),
        getBudgetCategories(),
      ])
      setTransactions(txnRes.data?.items || [])
      setTotal(txnRes.data?.total || 0)
      setAccounts(accRes.data || [])
      setCategories(catRes.data || [])
    } catch (err) {
      console.error('Failed to fetch transactions:', err)
    } finally {
      setLoading(false)
    }
  }, [page, periodFilter, initializing, referenceDate])

  useEffect(() => { fetchData() }, [fetchData])

  // All active categories grouped by type for dropdown
  // Show "Roll Over" category when Rollover account is selected
  const selectedAccountIsRollover = accounts.find(a => String(a.id) === formData.account_id)?.name === 'Rollover'
  const allActiveCategories = categories.filter(c => c.is_active && c.name !== 'Other' && (c.name !== 'Roll Over' || selectedAccountIsRollover))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  const variableCategories = allActiveCategories.filter(c => c.category_type === 'variable')
  const fixedCategories = allActiveCategories.filter(c => c.category_type === 'fixed')
  const transferCategories = allActiveCategories.filter(c => c.category_type === 'transfer')
  // "Pots of money" = variable spending + transfer categories (not fixed bills)
  const potCategories = [...variableCategories, ...transferCategories]

  const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)

  // Find the Money Market account for defaulting
  const moneyMarketAcct = accounts.find(a => a.name === 'Money Market' && a.is_active)

  const resetForm = () => {
    setFormData({
      transaction_date: new Date().toISOString().split('T')[0],
      description: '',
      amount: '',
      category_id: '',
      account_id: moneyMarketAcct ? String(moneyMarketAcct.id) : '',
    })
    setEditingId(null)
    setShowForm(false)
  }

  const handleSubmit = async () => {
    if (!formData.description || !formData.amount || !formData.category_id) return
    try {
      const selectedAcctId = formData.account_id ? parseInt(formData.account_id) : null
      const defaultAcct = moneyMarketAcct || accounts.find(a => a.account_type === 'savings') || accounts[0]
      const data = {
        account_id: selectedAcctId || defaultAcct?.id || 1,
        category_id: parseInt(formData.category_id),
        transaction_date: formData.transaction_date,
        description: formData.description,
        amount: -Math.abs(parseFloat(formData.amount)),
        transaction_type: 'debit',
      }
      if (editingId) {
        await updateBudgetTransaction(editingId, data)
      } else {
        await createBudgetTransaction(data)
      }
      resetForm()
      fetchData()
    } catch (err) {
      console.error('Failed to save transaction:', err)
    }
  }

  const handleEdit = (txn) => {
    setFormData({
      transaction_date: txn.transaction_date,
      description: txn.description,
      amount: String(Math.abs(txn.amount)),
      category_id: txn.category_id ? String(txn.category_id) : '',
      account_id: txn.account_id ? String(txn.account_id) : '',
    })
    setEditingId(txn.id)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transaction?')) return
    try {
      await deleteBudgetTransaction(id)
      fetchData()
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  const handleCategoryChange = async (txnId, categoryId) => {
    try {
      await updateBudgetTransaction(txnId, { category_id: categoryId || null })
      fetchData()
    } catch (err) {
      console.error('Failed to update category:', err)
    }
  }

  const getCategoryName = (catId) => {
    const cat = categories.find(c => c.id === catId)
    return cat ? cat.name : 'Uncategorized'
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-3">
      {/* Period Filter & Add Button */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-farm-green text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Transaction
          </button>
          <div className="flex gap-1">
            {[
              { key: 'current', label: 'This Half' },
              { key: 'month', label: 'This Month' },
              { key: 'all', label: 'All' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => { setPeriodFilter(f.key); setPage(0) }}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  periodFilter === f.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-surface text-muted hover:bg-surface-soft'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {total} transaction{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {editingId ? 'Edit Transaction' : 'New Transaction'}
            </h4>
            <button onClick={resetForm} className="p-1 rounded hover:bg-surface-soft">
              <X className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Date</label>
              <input
                type="date"
                value={formData.transaction_date}
                onChange={(e) => setFormData(f => ({ ...f, transaction_date: e.target.value }))}
                className="w-full px-2 py-1.5 bg-surface border border-subtle rounded text-sm"
                style={{ color: 'var(--color-text-primary)' }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>What was it?</label>
              <input
                type="text"
                placeholder="Description"
                value={formData.description}
                onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                className="w-full px-2 py-1.5 bg-surface border border-subtle rounded text-sm"
                style={{ color: 'var(--color-text-primary)' }}
                maxLength={500}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData(f => ({ ...f, amount: e.target.value }))}
                className="w-full px-2 py-1.5 bg-surface border border-subtle rounded text-sm"
                style={{ color: 'var(--color-text-primary)' }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Account</label>
              <select
                value={formData.account_id}
                onChange={(e) => {
                  const newAcctId = e.target.value
                  const isRollover = accounts.find(a => String(a.id) === newAcctId)?.name === 'Rollover'
                  const rollOverCat = isRollover ? categories.find(c => c.name === 'Roll Over') : null
                  setFormData(f => ({
                    ...f,
                    account_id: newAcctId,
                    ...(rollOverCat ? { category_id: String(rollOverCat.id) } : {})
                  }))
                }}
                className="w-full px-2 py-1.5 bg-surface border border-subtle rounded text-sm"
                style={{ color: 'var(--color-text-primary)' }}
              >
                <option value="">Default</option>
                {accounts.filter(a => a.is_active).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Category</label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData(f => ({ ...f, category_id: e.target.value }))}
                className="w-full px-2 py-1.5 bg-surface border border-subtle rounded text-sm"
                style={{ color: 'var(--color-text-primary)' }}
              >
                <option value="">Select...</option>
                {potCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <button
              onClick={handleSubmit}
              disabled={!formData.description || !formData.amount || !formData.category_id}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-farm-green text-white rounded-lg text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              {editingId ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Transaction List */}
      <div className="rounded-xl overflow-x-auto" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        {/* Desktop Header - hidden on mobile */}
        <div className="hidden md:grid grid-cols-[90px_1fr_100px_110px_140px_50px] text-xs font-semibold py-2 px-3" style={{ backgroundColor: 'var(--color-blue-600)', color: '#fff' }}>
          <span>Date</span>
          <span>Description</span>
          <span className="text-right">Amount</span>
          <span className="text-right">Account</span>
          <span className="text-right">Category</span>
          <span />
        </div>

        {loading ? (
          <div className="p-4 space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="animate-pulse bg-surface rounded h-8" />)}
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
            <p className="text-sm">No transactions yet. Click "Add Transaction" to get started.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table Rows - hidden on mobile */}
            <div className="hidden md:block">
              {transactions.map(txn => (
                <div
                  key={txn.id}
                  className="grid grid-cols-[90px_1fr_100px_110px_140px_50px] text-xs py-2 px-3 items-center hover:bg-surface/30 transition-colors"
                  style={{ borderBottom: '1px solid var(--color-border-default)' }}
                >
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    {formatDate ? formatDate(txn.transaction_date) : txn.transaction_date}
                  </span>
                  <span className="min-w-0 truncate" style={{ color: 'var(--color-text-primary)' }}>{txn.description}</span>
                  <span className="text-right font-medium" style={{ color: txn.amount < 0 ? 'var(--color-error-500)' : 'var(--color-success-500)' }}>
                    {fmt(txn.amount)}
                  </span>
                  <span className="text-right truncate" style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
                    {accounts.find(a => a.id === txn.account_id)?.name || ''}
                  </span>
                  <span className="text-right min-w-0 overflow-hidden">
                    <select
                      value={txn.category_id || ''}
                      onChange={(e) => handleCategoryChange(txn.id, e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-1 py-0.5 bg-transparent border border-transparent hover:border rounded text-xs text-right cursor-pointer truncate"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      <option value="">--</option>
                      {variableCategories.length > 0 && <optgroup label="Spending">
                        {variableCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </optgroup>}
                      {transferCategories.length > 0 && <optgroup label="Transfers">
                        {transferCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </optgroup>}
                      {fixedCategories.length > 0 && <optgroup label="Bills">
                        {fixedCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </optgroup>}
                    </select>
                  </span>
                  <span className="flex justify-end gap-1">
                    <button
                      onClick={() => handleEdit(txn)}
                      className="p-0.5 rounded hover:bg-surface-soft"
                      style={{ color: 'var(--color-text-muted)' }}
                      title="Edit"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(txn.id)}
                      className="p-0.5 rounded hover:bg-red-900/50 text-red-500"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                </div>
              ))}
            </div>

            {/* Mobile Card View - visible only on mobile */}
            <div className="md:hidden divide-y" style={{ borderColor: 'var(--color-border-default)' }}>
              {transactions.map(txn => (
                <div key={txn.id} className="p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{txn.description}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {formatDate ? formatDate(txn.transaction_date) : txn.transaction_date}
                        {accounts.find(a => a.id === txn.account_id)?.name && (
                          <span> &middot; {accounts.find(a => a.id === txn.account_id)?.name}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold" style={{ color: txn.amount < 0 ? 'var(--color-error-500)' : 'var(--color-success-500)' }}>
                        {fmt(txn.amount)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <select
                      value={txn.category_id || ''}
                      onChange={(e) => handleCategoryChange(txn.id, e.target.value ? parseInt(e.target.value) : null)}
                      className="flex-1 min-w-0 px-2 py-1 bg-surface border border-subtle rounded text-xs cursor-pointer"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      <option value="">Uncategorized</option>
                      {variableCategories.length > 0 && <optgroup label="Spending">
                        {variableCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </optgroup>}
                      {transferCategories.length > 0 && <optgroup label="Transfers">
                        {transferCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </optgroup>}
                      {fixedCategories.length > 0 && <optgroup label="Bills">
                        {fixedCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </optgroup>}
                    </select>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleEdit(txn)}
                        className="p-1 rounded hover:bg-surface-soft"
                        style={{ color: 'var(--color-text-muted)' }}
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(txn.id)}
                        className="p-1 rounded hover:bg-red-900/50 text-red-500"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-2 py-1 text-xs rounded bg-surface disabled:opacity-50"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Prev
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 text-xs rounded bg-surface disabled:opacity-50"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default BudgetTransactions
