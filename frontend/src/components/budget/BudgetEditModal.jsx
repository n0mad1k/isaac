import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'

const MONTH_ABBREVS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const BILLING_PRESETS = [
  { value: '', label: 'Every month' },
  { value: '1,4,7,10', label: 'Quarterly (Jan, Apr, Jul, Oct)' },
  { value: '4,5,6,7,8,9,10', label: 'Seasonal (Apr-Oct)' },
  { value: '1,7', label: 'Twice a year (Jan, Jul)' },
  { value: 'custom', label: 'Custom months...' },
]

function BudgetEditModal({ item, itemType, accounts, onSave, onClose }) {
  // itemType: 'income' | 'category'
  const isIncome = itemType === 'income'

  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [billingMode, setBillingMode] = useState('') // '', preset value, or 'custom'
  const [customMonths, setCustomMonths] = useState([])

  useEffect(() => {
    if (!item) return
    if (isIncome) {
      setForm({
        name: item.name || '',
        amount: item.amount || 0,
        pay_day: item.pay_day || 1,
        frequency: item.frequency || 'monthly',
        account_id: item.account_id || '',
        is_active: item.is_active !== false,
      })
    } else {
      setForm({
        name: item.name || '',
        category_type: item.category_type || 'fixed',
        monthly_budget: item.monthly_budget || 0,
        budget_amount: item.budget_amount || 0,
        bill_day: item.bill_day || '',
        account_id: item.account_id || '',
        billing_months: item.billing_months || '',
        start_date: item.start_date || '',
        end_date: item.end_date || '',
        owner: item.owner || '',
        is_active: item.is_active !== false,
      })

      // Determine billing mode
      const bm = item.billing_months || ''
      if (!bm) {
        setBillingMode('')
      } else {
        const preset = BILLING_PRESETS.find(p => p.value === bm)
        if (preset) {
          setBillingMode(bm)
        } else {
          setBillingMode('custom')
          setCustomMonths(bm.split(',').map(m => parseInt(m.trim())).filter(n => !isNaN(n)))
        }
      }
    }
  }, [item, isIncome])

  const update = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const data = { ...form }

      if (isIncome) {
        data.amount = parseFloat(data.amount) || 0
        data.pay_day = parseInt(data.pay_day) || 1
        data.account_id = parseInt(data.account_id) || undefined
      } else {
        data.monthly_budget = parseFloat(data.monthly_budget) || 0
        data.budget_amount = parseFloat(data.budget_amount) || 0
        data.bill_day = data.bill_day ? parseInt(data.bill_day) : null
        data.account_id = data.account_id ? parseInt(data.account_id) : null
        data.owner = data.owner || null
        data.start_date = data.start_date || null
        data.end_date = data.end_date || null

        // Handle billing months
        if (billingMode === 'custom') {
          data.billing_months = customMonths.length > 0 ? customMonths.join(',') : null
        } else if (billingMode) {
          data.billing_months = billingMode
        } else {
          data.billing_months = null
        }
      }

      await onSave(item.id, data)
      onClose()
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  const toggleMonth = (monthNum) => {
    setCustomMonths(prev => {
      const next = prev.includes(monthNum)
        ? prev.filter(n => n !== monthNum)
        : [...prev, monthNum].sort((a, b) => a - b)
      return next
    })
  }

  const catType = form.category_type
  const isFixed = catType === 'fixed'
  const isVariable = catType === 'variable'
  const isTransfer = catType === 'transfer'

  const inputClass = "w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm focus:outline-none focus:border-blue-500"
  const labelClass = "block text-xs font-medium mb-1"
  const inputStyle = { color: 'var(--color-text-primary)' }
  const labelStyle = { color: 'var(--color-text-secondary)' }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
          <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Edit {isIncome ? 'Income' : catType === 'fixed' ? 'Bill' : catType === 'variable' ? 'Spending Budget' : 'Transfer'}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-700">
            <X className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
          </button>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className={labelClass} style={labelStyle}>Name</label>
            <input type="text" value={form.name || ''} onChange={e => update('name', e.target.value)}
              className={inputClass} style={inputStyle} />
          </div>

          {isIncome ? (
            <>
              {/* Amount */}
              <div>
                <label className={labelClass} style={labelStyle}>Amount (per paycheck)</label>
                <input type="number" step="0.01" value={form.amount || ''} onChange={e => update('amount', e.target.value)}
                  className={inputClass} style={inputStyle} />
              </div>

              {/* Pay Day */}
              <div>
                <label className={labelClass} style={labelStyle}>Pay Day (day of month)</label>
                <input type="number" min="1" max="31" value={form.pay_day || ''} onChange={e => update('pay_day', e.target.value)}
                  className={inputClass} style={inputStyle} />
              </div>

              {/* Frequency */}
              <div>
                <label className={labelClass} style={labelStyle}>Frequency</label>
                <select value={form.frequency || 'monthly'} onChange={e => update('frequency', e.target.value)}
                  className={inputClass} style={inputStyle}>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-Weekly</option>
                  <option value="semimonthly">Semi-Monthly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              {/* Account */}
              <div>
                <label className={labelClass} style={labelStyle}>Account</label>
                <select value={form.account_id || ''} onChange={e => update('account_id', e.target.value)}
                  className={inputClass} style={inputStyle}>
                  <option value="">None</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              {/* Active */}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="edit-active" checked={form.is_active !== false}
                  onChange={e => update('is_active', e.target.checked)} className="rounded" />
                <label htmlFor="edit-active" className="text-sm" style={labelStyle}>Active</label>
              </div>
            </>
          ) : (
            <>
              {/* Category Type */}
              <div>
                <label className={labelClass} style={labelStyle}>Type</label>
                <select value={form.category_type || 'fixed'} onChange={e => update('category_type', e.target.value)}
                  className={inputClass} style={inputStyle}>
                  <option value="fixed">Bill (Fixed)</option>
                  <option value="variable">Spending (Variable)</option>
                  <option value="transfer">Transfer/Distribution</option>
                </select>
              </div>

              {/* Amount fields based on type */}
              {isFixed && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass} style={labelStyle}>Monthly Amount</label>
                    <input type="number" step="0.01" value={form.monthly_budget || ''} onChange={e => update('monthly_budget', e.target.value)}
                      className={inputClass} style={inputStyle} />
                  </div>
                  <div>
                    <label className={labelClass} style={labelStyle}>Bill Day</label>
                    <input type="number" min="1" max="31" value={form.bill_day || ''} onChange={e => update('bill_day', e.target.value)}
                      className={inputClass} style={inputStyle} placeholder="None" />
                  </div>
                </div>
              )}

              {(isVariable || isTransfer) && (
                <div>
                  <label className={labelClass} style={labelStyle}>Amount (per pay period)</label>
                  <input type="number" step="0.01" value={form.budget_amount || ''} onChange={e => update('budget_amount', e.target.value)}
                    className={inputClass} style={inputStyle} />
                </div>
              )}

              {/* Account */}
              <div>
                <label className={labelClass} style={labelStyle}>
                  {isTransfer ? 'Destination Account' : 'Paid From Account'}
                </label>
                <select value={form.account_id || ''} onChange={e => update('account_id', e.target.value)}
                  className={inputClass} style={inputStyle}>
                  <option value="">None</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              {/* Owner */}
              <div>
                <label className={labelClass} style={labelStyle}>Owner</label>
                <select value={form.owner || ''} onChange={e => update('owner', e.target.value)}
                  className={inputClass} style={inputStyle}>
                  <option value="">Main Budget</option>
                  <option value="dane">Dane</option>
                  <option value="kelly">Kelly</option>
                </select>
              </div>

              {/* Billing Months */}
              {isFixed && (
                <div>
                  <label className={labelClass} style={labelStyle}>Billing Schedule</label>
                  <select value={billingMode} onChange={e => {
                    const val = e.target.value
                    setBillingMode(val)
                    if (val === 'custom') {
                      setCustomMonths(form.billing_months ? form.billing_months.split(',').map(m => parseInt(m.trim())).filter(n => !isNaN(n)) : [])
                    }
                  }}
                    className={inputClass} style={inputStyle}>
                    {BILLING_PRESETS.map(p => <option key={p.value || 'every'} value={p.value}>{p.label}</option>)}
                  </select>

                  {billingMode === 'custom' && (
                    <div className="flex items-center gap-1 flex-wrap mt-2">
                      {MONTH_ABBREVS.map((m, i) => {
                        const monthNum = i + 1
                        const selected = customMonths.includes(monthNum)
                        return (
                          <button key={m} type="button" onClick={() => toggleMonth(monthNum)}
                            className={`px-2 py-1 rounded text-xs ${selected ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                            {m}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} style={labelStyle}>Start Date</label>
                  <input type="month" value={form.start_date || ''} onChange={e => update('start_date', e.target.value)}
                    className={inputClass} style={inputStyle} />
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>End Date</label>
                  <input type="month" value={form.end_date || ''} onChange={e => update('end_date', e.target.value)}
                    className={inputClass} style={inputStyle} />
                </div>
              </div>
              <p className="text-xs -mt-2" style={{ color: 'var(--color-text-muted)' }}>
                Set an end date for payment plans. Leave blank for ongoing.
              </p>

              {/* Active */}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="edit-cat-active" checked={form.is_active !== false}
                  onChange={e => update('is_active', e.target.checked)} className="rounded" />
                <label htmlFor="edit-cat-active" className="text-sm" style={labelStyle}>Active</label>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3" style={{ borderTop: '1px solid var(--color-border-default)' }}>
          <button onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg hover:bg-gray-700" style={{ color: 'var(--color-text-secondary)' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default BudgetEditModal
