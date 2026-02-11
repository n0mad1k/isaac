import React, { useState, useEffect, useCallback } from 'react'
import {
  Plus, Minus, Settings, Trash2, Edit2, X, Check,
  ArrowUpCircle, ArrowDownCircle, ChevronDown, ChevronUp
} from 'lucide-react'
import {
  getAccountDetail,
  getAccountTransactions,
  updateBudgetAccount,
  deleteBudgetAccount,
  createBudgetTransaction,
  updateBudgetTransaction,
  deleteBudgetTransaction,
  updateBudgetCategory,
} from '../../services/api'

function AccountView({ accountId, onAccountUpdated, onAccountDeleted }) {
  const [account, setAccount] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [totalTransactions, setTotalTransactions] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [showAllocationModal, setShowAllocationModal] = useState(false)
  const [selectedAllocation, setSelectedAllocation] = useState(null)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [saving, setSaving] = useState(false)
  const [transactionPage, setTransactionPage] = useState(0)
  const [showAllTransactions, setShowAllTransactions] = useState(false)

  const [newTransaction, setNewTransaction] = useState({
    type: 'deposit', // 'deposit' or 'withdrawal'
    amount: '',
    description: '',
    transaction_date: new Date().toISOString().split('T')[0],
    notes: '',
  })

  const [editAccount, setEditAccount] = useState({
    name: '',
    institution: '',
    initial_balance: '',
    balance_as_of: '',
  })

  const [allocationAdjust, setAllocationAdjust] = useState({
    amount: '',
    operation: 'add', // 'add' or 'subtract'
  })

  const TRANSACTIONS_PER_PAGE = 20

  const fetchAccountData = useCallback(async () => {
    if (!accountId) return
    setLoading(true)
    try {
      const [detailRes, txnRes] = await Promise.all([
        getAccountDetail(accountId),
        getAccountTransactions(accountId, { limit: TRANSACTIONS_PER_PAGE, offset: 0 }),
      ])
      setAccount(detailRes.data)
      setTransactions(txnRes.data?.items || [])
      setTotalTransactions(txnRes.data?.total || 0)
      setTransactionPage(0)

      // Initialize edit form
      const acc = detailRes.data
      setEditAccount({
        name: acc.name || '',
        institution: acc.institution || '',
        initial_balance: acc.initial_balance?.toString() || '0',
        balance_as_of: acc.balance_as_of || '',
      })
    } catch (err) {
      console.error('Failed to fetch account data:', err)
    } finally {
      setLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    fetchAccountData()
  }, [fetchAccountData])

  const loadMoreTransactions = async () => {
    const nextPage = transactionPage + 1
    try {
      const res = await getAccountTransactions(accountId, {
        limit: TRANSACTIONS_PER_PAGE,
        offset: nextPage * TRANSACTIONS_PER_PAGE,
      })
      setTransactions([...transactions, ...(res.data?.items || [])])
      setTransactionPage(nextPage)
    } catch (err) {
      console.error('Failed to load more transactions:', err)
    }
  }

  const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
  }

  const handleSaveAccount = async () => {
    if (saving) return
    setSaving(true)
    try {
      await updateBudgetAccount(accountId, {
        name: editAccount.name.trim(),
        institution: editAccount.institution.trim() || null,
        initial_balance: parseFloat(editAccount.initial_balance) || 0,
        balance_as_of: editAccount.balance_as_of || null,
      })
      setShowSettings(false)
      fetchAccountData()
      onAccountUpdated?.()
    } catch (err) {
      console.error('Failed to update account:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (saving) return
    setSaving(true)
    try {
      await deleteBudgetAccount(accountId)
      setShowDeleteConfirm(false)
      onAccountDeleted?.()
    } catch (err) {
      console.error('Failed to delete account:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleCreateTransaction = async (e) => {
    e.preventDefault()
    if (!newTransaction.amount || saving) return

    setSaving(true)
    try {
      const amount = parseFloat(newTransaction.amount)
      const payload = {
        account_id: accountId,
        transaction_date: newTransaction.transaction_date,
        description: newTransaction.description.trim() || (newTransaction.type === 'deposit' ? 'Deposit' : 'Withdrawal'),
        amount: newTransaction.type === 'deposit' ? Math.abs(amount) : -Math.abs(amount),
        transaction_type: newTransaction.type === 'deposit' ? 'credit' : 'debit',
        notes: newTransaction.notes.trim() || null,
      }
      await createBudgetTransaction(payload)
      setShowTransactionModal(false)
      setNewTransaction({
        type: 'deposit',
        amount: '',
        description: '',
        transaction_date: new Date().toISOString().split('T')[0],
        notes: '',
      })
      fetchAccountData()
      onAccountUpdated?.()
    } catch (err) {
      console.error('Failed to create transaction:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateTransaction = async (txnId, data) => {
    if (saving) return
    setSaving(true)
    try {
      await updateBudgetTransaction(txnId, data)
      setEditingTransaction(null)
      fetchAccountData()
      onAccountUpdated?.()
    } catch (err) {
      console.error('Failed to update transaction:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTransaction = async (txnId) => {
    if (saving) return
    setSaving(true)
    try {
      await deleteBudgetTransaction(txnId)
      fetchAccountData()
      onAccountUpdated?.()
    } catch (err) {
      console.error('Failed to delete transaction:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleAdjustAllocation = async () => {
    if (!selectedAllocation || !allocationAdjust.amount || saving) return

    setSaving(true)
    try {
      const adjustAmount = parseFloat(allocationAdjust.amount)
      const newBalance = allocationAdjust.operation === 'add'
        ? (selectedAllocation.starting_balance || 0) + adjustAmount
        : (selectedAllocation.starting_balance || 0) - adjustAmount

      await updateBudgetCategory(selectedAllocation.id, {
        starting_balance: newBalance,
      })
      setShowAllocationModal(false)
      setSelectedAllocation(null)
      setAllocationAdjust({ amount: '', operation: 'add' })
      fetchAccountData()
    } catch (err) {
      console.error('Failed to adjust allocation:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse bg-gray-800 rounded-xl h-32" />
        <div className="animate-pulse bg-gray-800 rounded-xl h-64" />
      </div>
    )
  }

  if (!account) {
    return (
      <div className="rounded-xl p-8 text-center" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <p className="text-gray-400">Account not found</p>
      </div>
    )
  }

  // Check if account has allocations (TRANSFER categories linked to it)
  const hasAllocations = account.allocations && account.allocations.length > 0

  // Calculate unallocated amount (account balance minus sum of allocation balances)
  const totalAllocated = hasAllocations
    ? account.allocations.reduce((sum, a) => sum + (a.current_balance || 0), 0)
    : 0
  const unallocated = account.current_balance - totalAllocated

  // Calculate change from initial balance
  const balanceChange = account.current_balance - (account.initial_balance || 0)

  // Visible transactions (show 5 initially, or all if expanded)
  const visibleTransactions = showAllTransactions ? transactions : transactions.slice(0, 5)
  const hasMoreToShow = !showAllTransactions && transactions.length > 5
  const hasMoreToLoad = transactions.length < totalTransactions

  return (
    <div className="space-y-4">
      {/* Balance Summary Card */}
      <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>{account.name}</h2>
            {account.institution && (
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{account.institution}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"
              title="Account Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-lg bg-gray-800 text-red-400 hover:bg-red-900/30 transition-colors"
              title="Delete Account"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Current Balance</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{fmt(account.current_balance)}</p>
          </div>
          <div>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Initial Balance</p>
            <p className="text-lg" style={{ color: 'var(--color-text-primary)' }}>{fmt(account.initial_balance)}</p>
            {account.balance_as_of && (
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>as of {formatDate(account.balance_as_of)}</p>
            )}
          </div>
          <div>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Change</p>
            <p className={`text-lg font-medium ${balanceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {balanceChange >= 0 ? '+' : ''}{fmt(balanceChange)}
            </p>
          </div>
        </div>
      </div>

      {/* Allocations Section */}
      {hasAllocations && (
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <h3 className="text-lg font-medium mb-3" style={{ color: 'var(--color-text-primary)' }}>Allocations</h3>
          <div className="space-y-2">
            {account.allocations.map((alloc) => (
              <div key={alloc.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50">
                <div>
                  <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{alloc.name}</p>
                  {alloc.budget_amount > 0 && (
                    <p className="text-xs text-green-400">+{fmt(alloc.budget_amount)}/period</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-medium" style={{ color: 'var(--color-text-primary)' }}>{fmt(alloc.current_balance)}</span>
                  <button
                    onClick={() => {
                      setSelectedAllocation(alloc)
                      setAllocationAdjust({ amount: '', operation: 'add' })
                      setShowAllocationModal(true)
                    }}
                    className="px-2 py-1 text-xs rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                  >
                    Adjust
                  </button>
                </div>
              </div>
            ))}
            {unallocated !== 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800/30 border border-dashed border-gray-700">
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Unallocated</p>
                <span className={`text-lg font-medium ${unallocated >= 0 ? 'text-gray-400' : 'text-yellow-400'}`}>
                  {fmt(unallocated)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setNewTransaction({ ...newTransaction, type: 'deposit' })
            setShowTransactionModal(true)
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-500 transition-colors"
        >
          <ArrowUpCircle className="w-4 h-4" />
          Add Deposit
        </button>
        <button
          onClick={() => {
            setNewTransaction({ ...newTransaction, type: 'withdrawal' })
            setShowTransactionModal(true)
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors"
        >
          <ArrowDownCircle className="w-4 h-4" />
          Add Withdrawal
        </button>
      </div>

      {/* Transactions List */}
      <div className="rounded-xl" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Transactions
            <span className="text-sm font-normal text-gray-400 ml-2">({totalTransactions} total)</span>
          </h3>
        </div>
        {transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No transactions yet
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--color-border-default)' }}>
            {visibleTransactions.map((txn) => (
              <div key={txn.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-800/20 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                      {formatDate(txn.transaction_date)}
                    </span>
                    <span className="font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {txn.description}
                    </span>
                  </div>
                  {txn.category_name && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                      {txn.category_name}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className={`font-semibold tabular-nums ${txn.amount >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                    {txn.amount >= 0 ? '+' : ''}{fmt(txn.amount)}
                  </span>
                  <div className="flex gap-1 opacity-50 hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditingTransaction(txn)}
                      className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteTransaction(txn.id)}
                      className="p-1.5 rounded text-gray-400 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {(hasMoreToShow || hasMoreToLoad) && (
          <div className="p-3 border-t border-gray-800 flex justify-center gap-2">
            {hasMoreToShow && (
              <button
                onClick={() => setShowAllTransactions(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
                Show All ({transactions.length})
              </button>
            )}
            {showAllTransactions && transactions.length > 5 && (
              <button
                onClick={() => setShowAllTransactions(false)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <ChevronUp className="w-4 h-4" />
                Show Less
              </button>
            )}
            {hasMoreToLoad && showAllTransactions && (
              <button
                onClick={loadMoreTransactions}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-800 rounded text-gray-300 hover:bg-gray-700 transition-colors"
              >
                Load More...
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Transaction Modal */}
      {showTransactionModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl w-full max-w-md" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Add {newTransaction.type === 'deposit' ? 'Deposit' : 'Withdrawal'}
              </h2>
              <button onClick={() => setShowTransactionModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTransaction} className="p-4 space-y-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewTransaction({ ...newTransaction, type: 'deposit' })}
                  className={`flex-1 py-2 rounded-lg transition-colors ${
                    newTransaction.type === 'deposit'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  Deposit
                </button>
                <button
                  type="button"
                  onClick={() => setNewTransaction({ ...newTransaction, type: 'withdrawal' })}
                  className={`flex-1 py-2 rounded-lg transition-colors ${
                    newTransaction.type === 'withdrawal'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  Withdrawal
                </button>
              </div>

              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-farm-green focus:outline-none"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Description</label>
                <input
                  type="text"
                  value={newTransaction.description}
                  onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-farm-green focus:outline-none"
                  placeholder={newTransaction.type === 'deposit' ? 'Deposit' : 'Withdrawal'}
                />
              </div>

              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Date</label>
                <input
                  type="date"
                  value={newTransaction.transaction_date}
                  onChange={(e) => setNewTransaction({ ...newTransaction, transaction_date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-farm-green focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Notes</label>
                <textarea
                  value={newTransaction.notes}
                  onChange={(e) => setNewTransaction({ ...newTransaction, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-farm-green focus:outline-none resize-none"
                  rows={2}
                  placeholder="Optional notes..."
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransactionModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !newTransaction.amount}
                  className={`flex-1 px-4 py-2 rounded-lg text-white transition-colors disabled:opacity-50 ${
                    newTransaction.type === 'deposit' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'
                  }`}
                >
                  {saving ? 'Saving...' : `Add ${newTransaction.type === 'deposit' ? 'Deposit' : 'Withdrawal'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editingTransaction && (
        <EditTransactionModal
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onSave={handleUpdateTransaction}
          saving={saving}
        />
      )}

      {/* Account Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl w-full max-w-md" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Account Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Account Name</label>
                <input
                  type="text"
                  value={editAccount.name}
                  onChange={(e) => setEditAccount({ ...editAccount, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-farm-green focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Institution</label>
                <input
                  type="text"
                  value={editAccount.institution}
                  onChange={(e) => setEditAccount({ ...editAccount, institution: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-farm-green focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Initial Balance</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editAccount.initial_balance}
                    onChange={(e) => setEditAccount({ ...editAccount, initial_balance: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-farm-green focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>As Of Date</label>
                  <input
                    type="date"
                    value={editAccount.balance_as_of}
                    onChange={(e) => setEditAccount({ ...editAccount, balance_as_of: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-farm-green focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAccount}
                  disabled={saving || !editAccount.name.trim()}
                  className="flex-1 px-4 py-2 rounded-lg bg-farm-green text-white hover:bg-green-600 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl w-full max-w-sm" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-red-400">Delete Account</h2>
            </div>
            <div className="p-4">
              <p className="text-gray-300 mb-4">
                Are you sure you want to delete <strong>{account.name}</strong>?
                {totalTransactions > 0 && (
                  <span className="block text-yellow-400 text-sm mt-2">
                    Warning: This account has {totalTransactions} transaction(s) that will become orphaned.
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={saving}
                  className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Allocation Modal */}
      {showAllocationModal && selectedAllocation && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl w-full max-w-sm" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Adjust {selectedAllocation.name}
              </h2>
              <button onClick={() => setShowAllocationModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="text-center p-3 rounded-lg bg-gray-800/50">
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Current Balance</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  {fmt(selectedAllocation.current_balance)}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAllocationAdjust({ ...allocationAdjust, operation: 'add' })}
                  className={`flex-1 py-2 rounded-lg transition-colors ${
                    allocationAdjust.operation === 'add'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setAllocationAdjust({ ...allocationAdjust, operation: 'subtract' })}
                  className={`flex-1 py-2 rounded-lg transition-colors ${
                    allocationAdjust.operation === 'subtract'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  Remove
                </button>
              </div>

              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={allocationAdjust.amount}
                  onChange={(e) => setAllocationAdjust({ ...allocationAdjust, amount: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-farm-green focus:outline-none"
                  placeholder="0.00"
                />
              </div>

              {allocationAdjust.amount && (
                <div className="text-center p-3 rounded-lg bg-gray-800/30 border border-dashed border-gray-700">
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>New Balance</p>
                  <p className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {fmt(
                      allocationAdjust.operation === 'add'
                        ? (selectedAllocation.starting_balance || 0) + parseFloat(allocationAdjust.amount || 0)
                        : (selectedAllocation.starting_balance || 0) - parseFloat(allocationAdjust.amount || 0)
                    )}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowAllocationModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdjustAllocation}
                  disabled={saving || !allocationAdjust.amount}
                  className="flex-1 px-4 py-2 rounded-lg bg-farm-green text-white hover:bg-green-600 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Separate component for editing transactions
function EditTransactionModal({ transaction, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    description: transaction.description || '',
    amount: Math.abs(transaction.amount).toString(),
    type: transaction.amount >= 0 ? 'deposit' : 'withdrawal',
    transaction_date: transaction.transaction_date || '',
    notes: transaction.notes || '',
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    onSave(transaction.id, {
      description: form.description.trim(),
      amount: form.type === 'deposit' ? Math.abs(amount) : -Math.abs(amount),
      transaction_type: form.type === 'deposit' ? 'credit' : 'debit',
      transaction_date: form.transaction_date,
      notes: form.notes.trim() || null,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="rounded-xl w-full max-w-md" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Edit Transaction</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, type: 'deposit' })}
              className={`flex-1 py-2 rounded-lg transition-colors ${
                form.type === 'deposit'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Deposit
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, type: 'withdrawal' })}
              className={`flex-1 py-2 rounded-lg transition-colors ${
                form.type === 'withdrawal'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Withdrawal
            </button>
          </div>

          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Amount</label>
            <input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-farm-green focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-farm-green focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Date</label>
            <input
              type="date"
              value={form.transaction_date}
              onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-farm-green focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-farm-green focus:outline-none resize-none"
              rows={2}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.amount}
              className="flex-1 px-4 py-2 rounded-lg bg-farm-green text-white hover:bg-green-600 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AccountView
