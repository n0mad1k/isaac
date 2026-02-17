import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Wallet, PiggyBank, CreditCard, Banknote, User } from 'lucide-react'
import AccountView from './AccountView'
import { getAccountsWithBalances, createBudgetAccount, getBudgetPeriodSummary, getBudgetPayPeriods, getBudgetPeriodReference } from '../../services/api'

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
  const [activeSpendingAccount, setActiveSpendingAccount] = useState(null) // 'dane' or 'kelly'
  const [showAddModal, setShowAddModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [spendingBalances, setSpendingBalances] = useState({})
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
      // Select first account if none selected (only if not viewing a spending account)
      if (data.length > 0 && !activeAccountId && !activeSpendingAccount) {
        setActiveAccountId(data[0].id)
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err)
    } finally {
      setLoading(false)
    }
  }, [activeAccountId, activeSpendingAccount])

  const fetchSpendingBalances = useCallback(async () => {
    try {
      // Get reference date to determine current period
      const refRes = await getBudgetPeriodReference()
      const refDate = refRes.data?.reference_date ? new Date(refRes.data.reference_date + 'T12:00:00') : new Date()
      const year = refDate.getFullYear()
      const month = refDate.getMonth() + 1

      // Get pay periods for current month
      const periodsRes = await getBudgetPayPeriods(year, month)
      const periods = periodsRes.data || []
      if (periods.length < 2) return

      // Determine which period we're in (first or second half)
      const periodIdx = refDate.getDate() <= 14 ? 0 : 1
      const period = periods[periodIdx]

      // Fetch the period summary which contains spending balances
      const summaryRes = await getBudgetPeriodSummary(period.start, period.end)
      const balances = summaryRes.data?.person_spending_balances || {}
      setSpendingBalances(balances)
    } catch (err) {
      console.error('Failed to fetch spending balances:', err)
    }
  }, [])

  useEffect(() => {
    fetchAccounts()
    fetchSpendingBalances()
  }, [fetchAccounts, fetchSpendingBalances])

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
        {/* Bank Accounts */}
        {accounts.map((account) => {
          const Icon = ACCOUNT_ICONS[account.account_type] || Wallet
          const isActive = activeAccountId === account.id && !activeSpendingAccount
          return (
            <button
              key={account.id}
              onClick={() => { setActiveAccountId(account.id); setActiveSpendingAccount(null) }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-farm-green text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{account.name}</span>
              <span className={`text-xs ${isActive ? 'text-green-200' : 'text-gray-500'}`}>
                {fmt(account.current_balance)}
              </span>
            </button>
          )
        })}

        {/* Spending Accounts (Dane/Kelly) */}
        {Object.entries(spendingBalances).map(([ownerKey, data]) => {
          const available = typeof data === 'number' ? data : data?.available || 0
          const isActive = activeSpendingAccount === ownerKey
          const displayName = ownerKey.charAt(0).toUpperCase() + ownerKey.slice(1) + ' Spending'
          return (
            <button
              key={`spending-${ownerKey}`}
              onClick={() => { setActiveSpendingAccount(ownerKey); setActiveAccountId(null) }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <User className="w-4 h-4" />
              <span>{displayName}</span>
              <span className={`text-xs ${isActive ? 'text-purple-200' : available >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fmt(available)}
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
      {activeSpendingAccount ? (
        <SpendingAccountView ownerKey={activeSpendingAccount} data={spendingBalances[activeSpendingAccount]} />
      ) : activeAccount ? (
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

// Spending Account View - shows person spending breakdown
function SpendingAccountView({ ownerKey, data }) {
  const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
  const displayName = ownerKey.charAt(0).toUpperCase() + ownerKey.slice(1)

  if (!data) {
    return (
      <div className="rounded-xl p-8 text-center" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <User className="w-12 h-12 mx-auto mb-3 text-gray-500" />
        <p className="text-gray-400">No spending data available for {displayName}.</p>
      </div>
    )
  }

  // Handle both old (number) and new (object) format
  const available = typeof data === 'number' ? data : data.available || 0
  const rollover = typeof data === 'object' ? data.rollover || 0 : 0
  const periodNet = typeof data === 'object' ? data.period_net || 0 : 0
  const periodSpent = typeof data === 'object' ? data.period_spent || 0 : 0
  const depositPerPeriod = typeof data === 'object' ? data.deposit_per_period || 0 : 0
  const firstHalfRemaining = typeof data === 'object' ? data.first_half_remaining || 0 : 0
  const secondHalfRemaining = typeof data === 'object' ? data.second_half_remaining || 0 : 0
  const firstHalfBills = typeof data === 'object' ? data.first_half_bills || 0 : 0
  const secondHalfBills = typeof data === 'object' ? data.second_half_bills || 0 : 0

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-purple-600/20 flex items-center justify-center">
            <User className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{displayName}'s Spending Account</h2>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {fmt(depositPerPeriod)}/half deposit
            </p>
          </div>
        </div>

        {/* Balance Display */}
        <div className="text-center py-6 rounded-lg" style={{ backgroundColor: 'var(--color-bg-surface-soft)' }}>
          <div className="text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Available to Spend</div>
          <div className={`text-4xl font-bold ${available >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {fmt(available)}
          </div>
        </div>
      </div>

      {/* Breakdown Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Rollover</div>
          <div className="text-lg font-semibold" style={{ color: rollover >= 0 ? 'var(--color-success-500)' : 'var(--color-error-500)' }}>
            {fmt(rollover)}
          </div>
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>from prior months</div>
        </div>

        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Period Net</div>
          <div className="text-lg font-semibold" style={{ color: periodNet >= 0 ? 'var(--color-success-500)' : 'var(--color-error-500)' }}>
            {fmt(periodNet)}
          </div>
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>deposit - bills</div>
        </div>

        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Spent This Period</div>
          <div className="text-lg font-semibold" style={{ color: 'var(--color-error-500)' }}>
            {fmt(periodSpent)}
          </div>
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>transactions</div>
        </div>

        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Per Half Budget</div>
          <div className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {fmt(depositPerPeriod)}
          </div>
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>budgeted deposit</div>
        </div>
      </div>

      {/* Monthly Breakdown */}
      <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>This Month's Breakdown</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg-surface-soft)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>1st Half (1-14)</div>
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Remaining:</span>
              <span className={`font-semibold ${firstHalfRemaining >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fmt(firstHalfRemaining)}
              </span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Bills:</span>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{fmt(firstHalfBills)}</span>
            </div>
          </div>

          <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg-surface-soft)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>2nd Half (15-EOM)</div>
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Remaining:</span>
              <span className={`font-semibold ${secondHalfRemaining >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fmt(secondHalfRemaining)}
              </span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Bills:</span>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{fmt(secondHalfBills)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Info Note */}
      <div className="rounded-xl p-4 bg-purple-900/20 border border-purple-700/30">
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          <strong>How it works:</strong> Available balance = Prior month rollover + This period's budget - Bills assigned to you - Spending transactions.
          To add money, add a transaction in the Transactions tab with your spending category. To adjust bills, update them in the Bills tab with your owner assignment.
        </p>
      </div>
    </div>
  )
}

export default AccountsTab
