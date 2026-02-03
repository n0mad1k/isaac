import React, { useState, useEffect, useCallback } from 'react'
import { Plus, X, Trash2, Edit, Save, LayoutDashboard } from 'lucide-react'
import {
  getBudgetAccounts, createBudgetAccount, updateBudgetAccount, deleteBudgetAccount,
  getBudgetCategories, createBudgetCategory, updateBudgetCategory, deleteBudgetCategory,
  getBudgetIncome, createBudgetIncome, updateBudgetIncome, deleteBudgetIncome,
  getBudgetRules, createBudgetRule, updateBudgetRule, deleteBudgetRule,
} from '../../services/api'

const ACCOUNT_TYPES = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit', label: 'Credit Card' },
  { value: 'cash', label: 'Cash' },
]

const CATEGORY_TYPES = [
  { value: 'variable', label: 'Variable' },
  { value: 'fixed', label: 'Fixed' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
]

const MATCH_TYPES = [
  { value: 'contains', label: 'Contains' },
  { value: 'starts_with', label: 'Starts With' },
  { value: 'regex', label: 'Regex' },
]

const DEFAULT_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#78716c',
]

function BudgetSettings() {
  const [activeSection, setActiveSection] = useState('accounts')
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [incomes, setIncomes] = useState([])
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [accRes, catRes, incRes, ruleRes] = await Promise.all([
        getBudgetAccounts(), getBudgetCategories(), getBudgetIncome(), getBudgetRules()
      ])
      setAccounts(accRes.data || [])
      setCategories(catRes.data || [])
      setIncomes(incRes.data || [])
      setRules(ruleRes.data || [])
    } catch (err) {
      console.error('Failed to load budget settings:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const sections = [
    { key: 'accounts', label: 'Accounts' },
    { key: 'pots', label: 'Pots of Money' },
    { key: 'categories', label: 'All Categories' },
    { key: 'income', label: 'Income' },
    { key: 'rules', label: 'Rules' },
  ]

  if (loading) {
    return <div className="animate-pulse bg-gray-800 rounded-xl h-64" />
  }

  return (
    <div className="space-y-4">
      {/* Section Tabs */}
      <div className="flex gap-2 flex-wrap">
        {sections.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activeSection === s.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {activeSection === 'accounts' && (
        <AccountsSection accounts={accounts} onRefresh={fetchAll} />
      )}
      {activeSection === 'pots' && (
        <PotsSection categories={categories} onRefresh={fetchAll} />
      )}
      {activeSection === 'categories' && (
        <CategoriesSection categories={categories} onRefresh={fetchAll} />
      )}
      {activeSection === 'income' && (
        <IncomeSection incomes={incomes} accounts={accounts} onRefresh={fetchAll} />
      )}
      {activeSection === 'rules' && (
        <RulesSection rules={rules} categories={categories} onRefresh={fetchAll} />
      )}
    </div>
  )
}


// ============================
// Accounts Section
// ============================
function AccountsSection({ accounts, onRefresh }) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', account_type: 'checking', institution: '', last_four: '', sort_order: 0 })

  const resetForm = () => {
    setForm({ name: '', account_type: 'checking', institution: '', last_four: '', sort_order: 0 })
    setEditingId(null)
  }

  const handleEdit = (acc) => {
    setForm({ name: acc.name, account_type: acc.account_type, institution: acc.institution || '', last_four: acc.last_four || '', sort_order: acc.sort_order })
    setEditingId(acc.id)
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const data = { ...form, last_four: form.last_four || null, institution: form.institution || null }
      if (editingId) {
        await updateBudgetAccount(editingId, data)
      } else {
        await createBudgetAccount(data)
      }
      setShowForm(false)
      resetForm()
      onRefresh()
    } catch (err) {
      console.error('Failed to save account:', err)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this account?')) return
    try {
      await deleteBudgetAccount(id)
      onRefresh()
    } catch (err) {
      console.error('Failed to delete account:', err)
    }
  }

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Accounts</h4>
        <button onClick={() => { resetForm(); setShowForm(!showForm) }} className="flex items-center gap-1 px-2 py-1 bg-farm-green text-white rounded text-xs hover:bg-green-700">
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-3 bg-gray-800 rounded-lg space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input type="text" placeholder="Account Name" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm" style={{ color: 'var(--color-text-primary)' }} required maxLength={100} />
            <select value={form.account_type} onChange={(e) => setForm(p => ({ ...p, account_type: e.target.value }))} className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm" style={{ color: 'var(--color-text-primary)' }}>
              {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input type="text" placeholder="Institution" value={form.institution} onChange={(e) => setForm(p => ({ ...p, institution: e.target.value }))} className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm" style={{ color: 'var(--color-text-primary)' }} maxLength={100} />
            <input type="text" placeholder="Last 4" value={form.last_four} onChange={(e) => setForm(p => ({ ...p, last_four: e.target.value }))} className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm" style={{ color: 'var(--color-text-primary)' }} maxLength={4} />
            <input type="number" placeholder="Sort Order" value={form.sort_order} onChange={(e) => setForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm" style={{ color: 'var(--color-text-primary)' }} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-3 py-1.5 bg-farm-green text-white rounded text-xs hover:bg-green-700">{editingId ? 'Update' : 'Add'}</button>
            <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="px-3 py-1.5 bg-gray-700 rounded text-xs" style={{ color: 'var(--color-text-secondary)' }}>Cancel</button>
          </div>
        </form>
      )}

      <div className="space-y-1.5">
        {accounts.map(acc => (
          <div key={acc.id} className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg">
            <div>
              <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{acc.name}</span>
              <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>
                {acc.account_type}{acc.last_four ? ` ...${acc.last_four}` : ''}{acc.institution ? ` (${acc.institution})` : ''}
              </span>
            </div>
            <div className="flex gap-1">
              <button onClick={() => handleEdit(acc)} className="p-1 rounded hover:bg-gray-700"><Edit className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} /></button>
              <button onClick={() => handleDelete(acc.id)} className="p-1 rounded hover:bg-red-900/50"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
            </div>
          </div>
        ))}
        {accounts.length === 0 && <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>No accounts yet</p>}
      </div>
    </div>
  )
}


// ============================
// Pots of Money Section
// ============================
function PotsSection({ categories, onRefresh }) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    name: '', category_type: 'variable', budget_amount: '', monthly_budget: '',
    color: '#3b82f6',
  })

  // Only show variable and transfer categories (the "pots of money")
  const pots = categories.filter(c => c.category_type === 'variable' || c.category_type === 'transfer')
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))

  const resetForm = () => {
    setForm({ name: '', category_type: 'variable', budget_amount: '', monthly_budget: '', color: '#3b82f6' })
    setEditingId(null)
  }

  const handleEdit = (cat) => {
    setForm({
      name: cat.name, category_type: cat.category_type,
      budget_amount: String(cat.budget_amount || ''),
      monthly_budget: cat.monthly_budget ? String(cat.monthly_budget) : '',
      color: cat.color,
    })
    setEditingId(cat.id)
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const data = {
        name: form.name,
        category_type: form.category_type,
        budget_amount: parseFloat(form.budget_amount) || 0,
        monthly_budget: form.monthly_budget ? parseFloat(form.monthly_budget) : null,
        color: form.color,
      }
      if (editingId) {
        await updateBudgetCategory(editingId, data)
      } else {
        await createBudgetCategory(data)
      }
      setShowForm(false)
      resetForm()
      onRefresh()
    } catch (err) {
      console.error('Failed to save pot:', err)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this pot? Transactions will become uncategorized.')) return
    try {
      await deleteBudgetCategory(id)
      onRefresh()
    } catch (err) {
      console.error('Failed to delete pot:', err)
    }
  }

  const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Pots of Money</h4>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Spending categories and funds</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(!showForm) }} className="flex items-center gap-1 px-2 py-1 bg-farm-green text-white rounded text-xs hover:bg-green-700 flex-shrink-0 self-start sm:self-auto">
          <Plus className="w-3 h-3" /> Add Pot
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-3 bg-gray-800 rounded-lg space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input type="text" placeholder="Pot Name (e.g., Emergency Fund)" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm" style={{ color: 'var(--color-text-primary)' }} required maxLength={100} />
            <select value={form.category_type} onChange={(e) => setForm(p => ({ ...p, category_type: e.target.value }))} className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm" style={{ color: 'var(--color-text-primary)' }}>
              <option value="variable">Spending Pot (Gas, Groceries, etc.)</option>
              <option value="transfer">Fund/Transfer (Savings, Travel, etc.)</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Budget Per Half-Month</label>
              <input type="number" step="0.01" placeholder="0.00" value={form.budget_amount} onChange={(e) => setForm(p => ({ ...p, budget_amount: e.target.value }))} className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm" style={{ color: 'var(--color-text-primary)' }} />
            </div>
            <div>
              <label className="block text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Monthly Budget (optional)</label>
              <input type="number" step="0.01" placeholder="Auto = 2x per-period" value={form.monthly_budget} onChange={(e) => setForm(p => ({ ...p, monthly_budget: e.target.value }))} className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm" style={{ color: 'var(--color-text-primary)' }} />
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Color</label>
            <div className="flex gap-1.5 flex-wrap">
              {DEFAULT_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-3 py-1.5 bg-farm-green text-white rounded text-xs hover:bg-green-700">{editingId ? 'Update' : 'Add Pot'}</button>
            <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="px-3 py-1.5 bg-gray-700 rounded text-xs" style={{ color: 'var(--color-text-secondary)' }}>Cancel</button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {pots.map(cat => (
          <div key={cat.id} className="px-3 py-2 bg-gray-800 rounded-lg">
            {/* Top row: Color, Name, Actions */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                <span className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{cat.name}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                  {cat.category_type === 'variable' ? 'Spending' : 'Fund'}
                </span>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => handleEdit(cat)} className="p-1.5 rounded hover:bg-gray-700"><Edit className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} /></button>
                <button onClick={() => handleDelete(cat.id)} className="p-1.5 rounded hover:bg-red-900/50"><Trash2 className="w-4 h-4 text-red-500" /></button>
              </div>
            </div>
            {/* Bottom row: Amounts */}
            {(cat.budget_amount > 0 || cat.monthly_budget > 0) && (
              <div className="text-xs mt-1 pl-5" style={{ color: 'var(--color-text-muted)' }}>
                {cat.budget_amount > 0 && <span>{formatCurrency(cat.budget_amount)}/half</span>}
                {cat.monthly_budget > 0 && <span className="ml-2">({formatCurrency(cat.monthly_budget)}/mo)</span>}
              </div>
            )}
          </div>
        ))}
        {pots.length === 0 && <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>No pots yet. Add a spending pot or savings fund to get started.</p>}
      </div>
    </div>
  )
}


// ============================
// Categories Section
// ============================
function CategoriesSection({ categories, onRefresh }) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    name: '', category_type: 'variable', budget_amount: '', monthly_budget: '',
    color: '#3b82f6', icon: '', show_on_dashboard: false, sort_order: 0,
  })

  const resetForm = () => {
    setForm({ name: '', category_type: 'variable', budget_amount: '', monthly_budget: '', color: '#3b82f6', icon: '', show_on_dashboard: false, sort_order: 0 })
    setEditingId(null)
  }

  const handleEdit = (cat) => {
    setForm({
      name: cat.name, category_type: cat.category_type, budget_amount: String(cat.budget_amount || ''),
      monthly_budget: cat.monthly_budget ? String(cat.monthly_budget) : '', color: cat.color, icon: cat.icon || '',
      show_on_dashboard: cat.show_on_dashboard || false, sort_order: cat.sort_order,
    })
    setEditingId(cat.id)
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const data = {
        ...form,
        budget_amount: parseFloat(form.budget_amount) || 0,
        monthly_budget: form.monthly_budget ? parseFloat(form.monthly_budget) : null,
        icon: form.icon || null,
      }
      if (editingId) {
        await updateBudgetCategory(editingId, data)
      } else {
        await createBudgetCategory(data)
      }
      setShowForm(false)
      resetForm()
      onRefresh()
    } catch (err) {
      console.error('Failed to save category:', err)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this category? Transactions will become uncategorized.')) return
    try {
      await deleteBudgetCategory(id)
      onRefresh()
    } catch (err) {
      console.error('Failed to delete category:', err)
    }
  }

  const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Categories</h4>
        <button onClick={() => { resetForm(); setShowForm(!showForm) }} className="flex items-center gap-1 px-2 py-1 bg-farm-green text-white rounded text-xs hover:bg-green-700">
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-3 bg-gray-800 rounded-lg space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input type="text" placeholder="Category Name" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm" style={{ color: 'var(--color-text-primary)' }} required maxLength={100} />
            <select value={form.category_type} onChange={(e) => setForm(p => ({ ...p, category_type: e.target.value }))} className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm" style={{ color: 'var(--color-text-primary)' }}>
              {CATEGORY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Per Period Budget</label>
              <input type="number" step="0.01" placeholder="0.00" value={form.budget_amount} onChange={(e) => setForm(p => ({ ...p, budget_amount: e.target.value }))} className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm" style={{ color: 'var(--color-text-primary)' }} />
            </div>
            <div>
              <label className="block text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Monthly Budget</label>
              <input type="number" step="0.01" placeholder="Optional" value={form.monthly_budget} onChange={(e) => setForm(p => ({ ...p, monthly_budget: e.target.value }))} className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm" style={{ color: 'var(--color-text-primary)' }} />
            </div>
            <div>
              <label className="block text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Sort Order</label>
              <input type="number" value={form.sort_order} onChange={(e) => setForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm" style={{ color: 'var(--color-text-primary)' }} />
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Color</label>
            <div className="flex gap-1.5 flex-wrap">
              {DEFAULT_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
              <input type="color" value={form.color} onChange={(e) => setForm(p => ({ ...p, color: e.target.value }))} className="w-6 h-6 rounded cursor-pointer" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-3 py-1.5 bg-farm-green text-white rounded text-xs hover:bg-green-700">{editingId ? 'Update' : 'Add'}</button>
            <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="px-3 py-1.5 bg-gray-700 rounded text-xs" style={{ color: 'var(--color-text-secondary)' }}>Cancel</button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {categories.map(cat => (
          <div key={cat.id} className="px-3 py-2 bg-gray-800 rounded-lg">
            {/* Top row: Color, Name, Actions */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                <span className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{cat.name}</span>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={async () => {
                    try {
                      await updateBudgetCategory(cat.id, { show_on_dashboard: !cat.show_on_dashboard })
                      onRefresh()
                    } catch (err) { console.error('Failed to toggle dashboard:', err) }
                  }}
                  className="p-1.5 rounded hover:bg-gray-700"
                  title={cat.show_on_dashboard ? 'Shown on dashboard' : 'Not on dashboard'}
                >
                  <LayoutDashboard className="w-4 h-4" style={{ color: cat.show_on_dashboard ? 'var(--color-success-500)' : 'var(--color-text-muted)', opacity: cat.show_on_dashboard ? 1 : 0.4 }} />
                </button>
                <button onClick={() => handleEdit(cat)} className="p-1.5 rounded hover:bg-gray-700"><Edit className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} /></button>
                <button onClick={() => handleDelete(cat.id)} className="p-1.5 rounded hover:bg-red-900/50"><Trash2 className="w-4 h-4 text-red-500" /></button>
              </div>
            </div>
            {/* Bottom row: Type badge and amounts */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700" style={{ color: 'var(--color-text-muted)' }}>{cat.category_type}</span>
              {cat.budget_amount > 0 && (
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{formatCurrency(cat.budget_amount)}/period</span>
              )}
              {cat.monthly_budget > 0 && (
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{formatCurrency(cat.monthly_budget)}/mo</span>
              )}
            </div>
          </div>
        ))}
        {categories.length === 0 && <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>No categories yet</p>}
      </div>
    </div>
  )
}


// ============================
// Income Section
// ============================
const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-Weekly' },
  { value: 'semimonthly', label: 'Semi-Monthly' },
  { value: 'monthly', label: 'Monthly' },
]

const DAY_OF_WEEK_OPTIONS = [
  { value: '0', label: 'Monday' },
  { value: '1', label: 'Tuesday' },
  { value: '2', label: 'Wednesday' },
  { value: '3', label: 'Thursday' },
  { value: '4', label: 'Friday' },
  { value: '5', label: 'Saturday' },
  { value: '6', label: 'Sunday' },
]

function IncomeSection({ incomes, accounts, onRefresh }) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', amount: '', frequency: 'monthly', pay_day: '1', account_id: '' })

  const resetForm = () => {
    setForm({ name: '', amount: '', frequency: 'monthly', pay_day: '1', account_id: accounts.length > 0 ? String(accounts[0].id) : '' })
    setEditingId(null)
  }

  const handleEdit = (inc) => {
    setForm({ name: inc.name, amount: String(inc.amount), frequency: inc.frequency || 'monthly', pay_day: String(inc.pay_day), account_id: String(inc.account_id) })
    setEditingId(inc.id)
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const data = { ...form, amount: parseFloat(form.amount), pay_day: parseInt(form.pay_day), account_id: parseInt(form.account_id) }
      if (editingId) {
        await updateBudgetIncome(editingId, data)
      } else {
        await createBudgetIncome(data)
      }
      setShowForm(false)
      resetForm()
      onRefresh()
    } catch (err) {
      console.error('Failed to save income:', err)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this income source?')) return
    try {
      await deleteBudgetIncome(id)
      onRefresh()
    } catch (err) {
      console.error('Failed to delete income:', err)
    }
  }

  const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  const isWeeklyType = form.frequency === 'weekly' || form.frequency === 'biweekly'

  const getFrequencyLabel = (freq) => {
    const opt = FREQUENCY_OPTIONS.find(f => f.value === freq)
    return opt ? opt.label : freq
  }

  const getPayDayLabel = (inc) => {
    const freq = inc.frequency || 'monthly'
    if (freq === 'weekly' || freq === 'biweekly') {
      const dow = DAY_OF_WEEK_OPTIONS.find(d => d.value === String(inc.pay_day))
      return dow ? dow.label : `Day ${inc.pay_day}`
    }
    return `Day ${inc.pay_day}`
  }

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Income Sources</h4>
        <button onClick={() => { resetForm(); setShowForm(!showForm) }} className="flex items-center gap-1 px-2 py-1 bg-farm-green text-white rounded text-xs hover:bg-green-700">
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-3 bg-gray-800 rounded-lg space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input type="text" placeholder="Income Name" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm" style={{ color: 'var(--color-text-primary)' }} required maxLength={100} />
            <input type="number" step="0.01" placeholder="Amount" value={form.amount} onChange={(e) => setForm(p => ({ ...p, amount: e.target.value }))} className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm" style={{ color: 'var(--color-text-primary)' }} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Frequency</label>
              <select value={form.frequency} onChange={(e) => {
                const freq = e.target.value
                setForm(p => ({
                  ...p,
                  frequency: freq,
                  pay_day: (freq === 'weekly' || freq === 'biweekly') ? '4' : '1'
                }))
              }} className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm" style={{ color: 'var(--color-text-primary)' }}>
                {FREQUENCY_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {isWeeklyType ? 'Pay Day (Day of Week)' : 'Pay Day (Day of Month)'}
              </label>
              {isWeeklyType ? (
                <select value={form.pay_day} onChange={(e) => setForm(p => ({ ...p, pay_day: e.target.value }))} className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm" style={{ color: 'var(--color-text-primary)' }} required>
                  {DAY_OF_WEEK_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              ) : (
                <input type="number" min="1" max="31" value={form.pay_day} onChange={(e) => setForm(p => ({ ...p, pay_day: e.target.value }))} className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm" style={{ color: 'var(--color-text-primary)' }} required />
              )}
            </div>
            <div>
              <label className="block text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Account</label>
              <select value={form.account_id} onChange={(e) => setForm(p => ({ ...p, account_id: e.target.value }))} className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm" style={{ color: 'var(--color-text-primary)' }} required>
                <option value="">Select...</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-3 py-1.5 bg-farm-green text-white rounded text-xs hover:bg-green-700">{editingId ? 'Update' : 'Add'}</button>
            <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="px-3 py-1.5 bg-gray-700 rounded text-xs" style={{ color: 'var(--color-text-secondary)' }}>Cancel</button>
          </div>
        </form>
      )}

      <div className="space-y-1.5">
        {incomes.map(inc => (
          <div key={inc.id} className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg">
            <div>
              <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{inc.name}</span>
              <span className="text-sm font-medium text-green-400 ml-2">{formatCurrency(inc.amount)}</span>
              <span className="text-xs ml-2 px-1.5 py-0.5 rounded bg-gray-700" style={{ color: 'var(--color-text-muted)' }}>
                {getFrequencyLabel(inc.frequency)}
              </span>
              <span className="text-xs ml-1" style={{ color: 'var(--color-text-muted)' }}>
                {getPayDayLabel(inc)}{inc.account_name ? ` - ${inc.account_name}` : ''}
              </span>
            </div>
            <div className="flex gap-1">
              <button onClick={() => handleEdit(inc)} className="p-1 rounded hover:bg-gray-700"><Edit className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} /></button>
              <button onClick={() => handleDelete(inc.id)} className="p-1 rounded hover:bg-red-900/50"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
            </div>
          </div>
        ))}
        {incomes.length === 0 && <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>No income sources yet</p>}
      </div>
    </div>
  )
}


// ============================
// Rules Section
// ============================
function RulesSection({ rules, categories, onRefresh }) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ pattern: '', match_type: 'contains', category_id: '', priority: '0' })

  const resetForm = () => {
    setForm({ pattern: '', match_type: 'contains', category_id: categories.length > 0 ? String(categories[0].id) : '', priority: '0' })
    setEditingId(null)
  }

  const handleEdit = (rule) => {
    setForm({ pattern: rule.pattern, match_type: rule.match_type, category_id: String(rule.category_id), priority: String(rule.priority) })
    setEditingId(rule.id)
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const data = { ...form, category_id: parseInt(form.category_id), priority: parseInt(form.priority) || 0 }
      if (editingId) {
        await updateBudgetRule(editingId, data)
      } else {
        await createBudgetRule(data)
      }
      setShowForm(false)
      resetForm()
      onRefresh()
    } catch (err) {
      console.error('Failed to save rule:', err)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this rule?')) return
    try {
      await deleteBudgetRule(id)
      onRefresh()
    } catch (err) {
      console.error('Failed to delete rule:', err)
    }
  }

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Auto-Categorization Rules</h4>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Rules are applied in priority order (highest first)</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(!showForm) }} className="flex items-center gap-1 px-2 py-1 bg-farm-green text-white rounded text-xs hover:bg-green-700">
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-3 bg-gray-800 rounded-lg space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input type="text" placeholder="Pattern (e.g., COSTCO)" value={form.pattern} onChange={(e) => setForm(p => ({ ...p, pattern: e.target.value }))} className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm" style={{ color: 'var(--color-text-primary)' }} required maxLength={200} />
            <select value={form.match_type} onChange={(e) => setForm(p => ({ ...p, match_type: e.target.value }))} className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm" style={{ color: 'var(--color-text-primary)' }}>
              {MATCH_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select value={form.category_id} onChange={(e) => setForm(p => ({ ...p, category_id: e.target.value }))} className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm" style={{ color: 'var(--color-text-primary)' }} required>
              <option value="">Select Category...</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="number" placeholder="Priority" value={form.priority} onChange={(e) => setForm(p => ({ ...p, priority: e.target.value }))} className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm" style={{ color: 'var(--color-text-primary)' }} min="0" max="1000" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-3 py-1.5 bg-farm-green text-white rounded text-xs hover:bg-green-700">{editingId ? 'Update' : 'Add'}</button>
            <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="px-3 py-1.5 bg-gray-700 rounded text-xs" style={{ color: 'var(--color-text-secondary)' }}>Cancel</button>
          </div>
        </form>
      )}

      <div className="space-y-1.5">
        {rules.map(rule => (
          <div key={rule.id} className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg">
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-xs px-1.5 py-0.5 rounded bg-gray-700" style={{ color: 'var(--color-text-primary)' }}>{rule.pattern}</code>
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700" style={{ color: 'var(--color-text-muted)' }}>{rule.match_type}</span>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                &rarr; {rule.category_name || `Category #${rule.category_id}`}
              </span>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>P:{rule.priority}</span>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => handleEdit(rule)} className="p-1 rounded hover:bg-gray-700"><Edit className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} /></button>
              <button onClick={() => handleDelete(rule.id)} className="p-1 rounded hover:bg-red-900/50"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
            </div>
          </div>
        ))}
        {rules.length === 0 && <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>No rules yet. Add rules to auto-categorize imported transactions.</p>}
      </div>
    </div>
  )
}


export default BudgetSettings
