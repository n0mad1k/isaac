import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Wallet, PiggyBank, CreditCard, Banknote } from 'lucide-react'
import AccountView from './AccountView'
import { getAccountsWithBalances, createBudgetAccount } from '../../services/api'

const ACCOUNT_ICONS = {
  checking: Wallet,
  savings: PiggyBank,
  credit: CreditCard,
  cash: Banknote,
}

function AccountsTab() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeAccountId, setActiveAccountId] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newAccount, setNewAccount] = useState({
    name: '',
    account_type: 'savings',
    institution: '',
    initial_balance: '',
    balance_as_of: new Date().toISOString().split('T')[0],
  })

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await getAccountsWithBalances()
      const data = res.data || []
      setAccounts(data)
      // Select first account if none selected
      if (data.length > 0 && !activeAccountId) {
        setActiveAccountId(data[0].id)
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err)
    } finally {
      setLoading(false)
    }
  }, [activeAccountId])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)

  const handleCreateAccount = async (e) => {
    e.preventDefault()
    if (!newAccount.name.trim() || saving) return

    setSaving(true)
    try {
      const payload = {
        name: newAccount.name.trim(),
        account_type: newAccount.account_type,
        institution: newAccount.institution.trim() || null,
        initial_balance: parseFloat(newAccount.initial_balance) || 0,
        balance_as_of: newAccount.balance_as_of || null,
      }
      const res = await createBudgetAccount(payload)
      setShowAddModal(false)
      setNewAccount({
        name: '',
        account_type: 'savings',
        institution: '',
        initial_balance: '',
        balance_as_of: new Date().toISOString().split('T')[0],
      })
      await fetchAccounts()
      // Select the newly created account
      if (res.data?.id) {
        setActiveAccountId(res.data.id)
      }
    } catch (err) {
      console.error('Failed to create account:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse bg-gray-800 rounded-xl h-12" />
        <div className="animate-pulse bg-gray-800 rounded-xl h-64" />
      </div>
    )
  }

  const activeAccount = accounts.find(a => a.id === activeAccountId)

  return (
    <div className="space-y-4">
      {/* Account Sub-tabs */}
      <div className="flex gap-2 flex-wrap">
        {accounts.map((account) => {
          const Icon = ACCOUNT_ICONS[account.account_type] || Wallet
          return (
            <button
              key={account.id}
              onClick={() => setActiveAccountId(account.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeAccountId === account.id
                  ? 'bg-farm-green text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{account.name}</span>
              <span className={`text-xs ${activeAccountId === account.id ? 'text-green-200' : 'text-gray-500'}`}>
                {fmt(account.current_balance)}
              </span>
            </button>
          )
        })}
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Account
        </button>
      </div>

      {/* Account View */}
      {activeAccount ? (
        <AccountView
          accountId={activeAccountId}
          onAccountUpdated={fetchAccounts}
          onAccountDeleted={() => {
            setActiveAccountId(accounts.length > 1 ? accounts.find(a => a.id !== activeAccountId)?.id : null)
            fetchAccounts()
          }}
        />
      ) : (
        <div className="rounded-xl p-8 text-center" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <PiggyBank className="w-12 h-12 mx-auto mb-3 text-gray-500" />
          <p className="text-gray-400 mb-4">No accounts yet. Create one to start tracking balances.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-farm-green text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            <Plus className="w-4 h-4 inline mr-1" />
            Add Your First Account
          </button>
        </div>
      )}

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl w-full max-w-md" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Add Account</h2>
            </div>
            <form onSubmit={handleCreateAccount} className="p-4 space-y-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Account Name *</label>
                <input
                  type="text"
                  value={newAccount.name}
                  onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-farm-green focus:outline-none"
                  placeholder="e.g., Trust Account"
                  required
                />
              </div>

              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Account Type</label>
                <select
                  value={newAccount.account_type}
                  onChange={(e) => setNewAccount({ ...newAccount, account_type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-farm-green focus:outline-none"
                >
                  <option value="savings">Savings</option>
                  <option value="checking">Checking</option>
                  <option value="credit">Credit</option>
                  <option value="cash">Cash</option>
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Institution</label>
                <input
                  type="text"
                  value={newAccount.institution}
                  onChange={(e) => setNewAccount({ ...newAccount, institution: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-farm-green focus:outline-none"
                  placeholder="e.g., Navy Federal"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Initial Balance</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newAccount.initial_balance}
                    onChange={(e) => setNewAccount({ ...newAccount, initial_balance: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-farm-green focus:outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>As Of Date</label>
                  <input
                    type="date"
                    value={newAccount.balance_as_of}
                    onChange={(e) => setNewAccount({ ...newAccount, balance_as_of: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-farm-green focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !newAccount.name.trim()}
                  className="flex-1 px-4 py-2 rounded-lg bg-farm-green text-white hover:bg-green-600 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AccountsTab
