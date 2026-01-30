import React, { useState, useEffect, useCallback } from 'react'
import { Search, Plus, X, Filter, RefreshCw } from 'lucide-react'
import {
  getBudgetTransactions, createBudgetTransaction, updateBudgetTransaction,
  deleteBudgetTransaction, getBudgetAccounts, getBudgetCategories, runBudgetCategorize
} from '../../services/api'
import { useSettings } from '../../contexts/SettingsContext'

function BudgetTransactions() {
  const { formatDate } = useSettings()
  const [transactions, setTransactions] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])

  // Filters
  const [filters, setFilters] = useState({
    account_id: '',
    category_id: '',
    start_date: '',
    end_date: '',
    search: '',
    uncategorized: false,
  })
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(0)
  const pageSize = 50

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({
    account_id: '',
    category_id: '',
    transaction_date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    transaction_type: 'debit',
    notes: '',
  })
  const [editingId, setEditingId] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [txnRes, accRes, catRes] = await Promise.all([
        getBudgetTransactions({
          ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== '' && v !== false)),
          limit: pageSize,
          offset: page * pageSize,
        }),
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
  }, [filters, page])

  useEffect(() => { fetchData() }, [fetchData])

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPage(0)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const data = {
        ...formData,
        account_id: parseInt(formData.account_id),
        category_id: formData.category_id ? parseInt(formData.category_id) : null,
        amount: formData.transaction_type === 'debit' ? -Math.abs(parseFloat(formData.amount)) : Math.abs(parseFloat(formData.amount)),
      }
      if (editingId) {
        await updateBudgetTransaction(editingId, data)
      } else {
        await createBudgetTransaction(data)
      }
      setShowAddModal(false)
      resetForm()
      fetchData()
    } catch (err) {
      console.error('Failed to save transaction:', err)
    }
  }

  const handleEdit = (txn) => {
    setFormData({
      account_id: String(txn.account_id),
      category_id: txn.category_id ? String(txn.category_id) : '',
      transaction_date: txn.transaction_date,
      description: txn.description,
      amount: String(Math.abs(txn.amount)),
      transaction_type: txn.amount < 0 ? 'debit' : 'credit',
      notes: txn.notes || '',
    })
    setEditingId(txn.id)
    setShowAddModal(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transaction?')) return
    try {
      await deleteBudgetTransaction(id)
      fetchData()
    } catch (err) {
      console.error('Failed to delete transaction:', err)
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

  const handleAutoCategorize = async () => {
    try {
      const res = await runBudgetCategorize()
      const data = res.data
      alert(`Categorized ${data.categorized} of ${data.total_uncategorized} transactions`)
      fetchData()
    } catch (err) {
      console.error('Failed to auto-categorize:', err)
    }
  }

  const resetForm = () => {
    setFormData({
      account_id: accounts.length > 0 ? String(accounts[0].id) : '',
      category_id: '',
      transaction_date: new Date().toISOString().split('T')[0],
      description: '',
      amount: '',
      transaction_type: 'debit',
      notes: '',
    })
    setEditingId(null)
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => { resetForm(); setShowAddModal(true) }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-farm-green text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Transaction
        </button>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
            showFilters ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          Filters
        </button>
        <button
          onClick={handleAutoCategorize}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-gray-400 rounded-lg text-sm hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Auto-Categorize
        </button>

        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              placeholder="Search transactions..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm"
              style={{ color: 'var(--color-text-primary)' }}
            />
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="rounded-xl p-3 grid grid-cols-2 md:grid-cols-4 gap-3" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Account</label>
            <select
              value={filters.account_id}
              onChange={(e) => handleFilterChange('account_id', e.target.value)}
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <option value="">All Accounts</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Category</label>
            <select
              value={filters.category_id}
              onChange={(e) => handleFilterChange('category_id', e.target.value)}
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>From</label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => handleFilterChange('start_date', e.target.value)}
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm"
              style={{ color: 'var(--color-text-primary)' }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>To</label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => handleFilterChange('end_date', e.target.value)}
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm"
              style={{ color: 'var(--color-text-primary)' }}
            />
          </div>
          <div className="col-span-2 md:col-span-4 flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
              <input
                type="checkbox"
                checked={filters.uncategorized}
                onChange={(e) => handleFilterChange('uncategorized', e.target.checked)}
                className="rounded"
              />
              Show only uncategorized
            </label>
            <button
              onClick={() => { setFilters({ account_id: '', category_id: '', start_date: '', end_date: '', search: '', uncategorized: false }); setPage(0) }}
              className="ml-auto text-xs text-gray-500 hover:text-gray-300"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Transaction List */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        {loading ? (
          <div className="p-4 space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="animate-pulse bg-gray-800 rounded h-10" />)}
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
            <p className="text-sm">No transactions found</p>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="hidden md:grid grid-cols-[100px_1fr_150px_100px_80px] gap-2 px-4 py-2 border-b border-gray-700">
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Date</span>
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Description</span>
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Category</span>
              <span className="text-xs font-medium text-right" style={{ color: 'var(--color-text-muted)' }}>Amount</span>
              <span className="text-xs font-medium text-right" style={{ color: 'var(--color-text-muted)' }}>Actions</span>
            </div>

            {/* Transaction Rows */}
            {transactions.map(txn => (
              <div
                key={txn.id}
                className="grid grid-cols-1 md:grid-cols-[100px_1fr_150px_100px_80px] gap-1 md:gap-2 px-4 py-2.5 border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
              >
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {formatDate ? formatDate(txn.transaction_date) : txn.transaction_date}
                </span>
                <div>
                  <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                    {txn.description}
                  </span>
                  {txn.account_name && (
                    <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>
                      {txn.account_name}
                    </span>
                  )}
                </div>
                <div>
                  <select
                    value={txn.category_id || ''}
                    onChange={(e) => handleCategoryChange(txn.id, e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs"
                    style={{
                      color: txn.category_color || 'var(--color-text-secondary)',
                    }}
                  >
                    <option value="">Uncategorized</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <span className={`text-sm text-right font-medium ${txn.amount < 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {formatCurrency(txn.amount)}
                </span>
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => handleEdit(txn)}
                    className="text-xs px-1.5 py-0.5 rounded hover:bg-gray-700 transition-colors"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(txn.id)}
                    className="text-xs px-1.5 py-0.5 rounded hover:bg-red-900/50 text-red-500 transition-colors"
                  >
                    Del
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, total)} of {total}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-2 py-1 text-xs rounded bg-gray-800 disabled:opacity-50"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Prev
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 text-xs rounded bg-gray-800 disabled:opacity-50"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div
            className="w-full max-w-md rounded-xl p-5"
            style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {editingId ? 'Edit Transaction' : 'Add Transaction'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded hover:bg-gray-700">
                <X className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Type</label>
                  <select
                    value={formData.transaction_type}
                    onChange={(e) => setFormData(prev => ({ ...prev, transaction_type: e.target.value }))}
                    className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    <option value="debit">Expense</option>
                    <option value="credit">Income</option>
                    <option value="transfer">Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Date</label>
                  <input
                    type="date"
                    value={formData.transaction_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, transaction_date: e.target.value }))}
                    className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm"
                    style={{ color: 'var(--color-text-primary)' }}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm"
                  style={{ color: 'var(--color-text-primary)' }}
                  required
                  maxLength={500}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm"
                    style={{ color: 'var(--color-text-primary)' }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Account</label>
                  <select
                    value={formData.account_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, account_id: e.target.value }))}
                    className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm"
                    style={{ color: 'var(--color-text-primary)' }}
                    required
                  >
                    <option value="">Select...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Category</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                  className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  <option value="">Auto-categorize</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm"
                  style={{ color: 'var(--color-text-primary)' }}
                  rows={2}
                  maxLength={5000}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-farm-green text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  {editingId ? 'Update' : 'Add Transaction'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-gray-700 rounded-lg text-sm hover:bg-gray-600 transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default BudgetTransactions
