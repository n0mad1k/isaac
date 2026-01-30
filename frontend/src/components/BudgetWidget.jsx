import React, { useState, useEffect } from 'react'
import { Wallet, TrendingDown, ArrowRight } from 'lucide-react'
import { getBudgetDashboard } from '../services/api'
import { useNavigate } from 'react-router-dom'

function BudgetWidget({ className = '' }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getBudgetDashboard()
        setData(res.data)
      } catch (error) {
        console.error('Failed to fetch budget data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()

    const handleRefresh = () => fetchData()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [])

  if (loading) {
    return (
      <div className={`rounded-xl p-4 flex flex-col overflow-hidden ${className}`}
           style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-gray-700 rounded w-1/3" />
          <div className="h-8 bg-gray-700 rounded w-1/2" />
          <div className="space-y-2">
            <div className="h-3 bg-gray-700 rounded" />
            <div className="h-3 bg-gray-700 rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  const spentPercent = data.total_budgeted > 0
    ? Math.min((data.total_spent / data.total_budgeted) * 100, 100)
    : 0

  const isOverBudget = data.total_spent > data.total_budgeted

  return (
    <div
      className={`rounded-xl p-4 flex flex-col overflow-hidden ${className}`}
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5" style={{ color: 'var(--color-gold-600, #ca8a04)' }} />
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Budget</h2>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700" style={{ color: 'var(--color-text-muted)' }}>
          {data.period_label}
        </span>
      </div>

      {/* Overall Progress */}
      <div className="mb-3">
        <div className="flex justify-between items-end mb-1.5">
          <div>
            <span className="text-xl font-bold" style={{ color: isOverBudget ? '#ef4444' : 'var(--color-text-primary)' }}>
              {formatCurrency(data.total_spent)}
            </span>
            <span className="text-xs ml-1" style={{ color: 'var(--color-text-muted)' }}>
              of {formatCurrency(data.total_budgeted)}
            </span>
          </div>
          <span className={`text-sm font-medium ${data.total_remaining >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(Math.abs(data.total_remaining))} {data.total_remaining >= 0 ? 'left' : 'over'}
          </span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-gray-700 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${spentPercent}%`,
              backgroundColor: isOverBudget ? '#ef4444' : '#22c55e',
            }}
          />
        </div>
      </div>

      {/* Top Categories */}
      <div className="space-y-2 flex-1 min-h-0 overflow-y-auto">
        {data.top_categories.map(cat => {
          const catPercent = cat.budgeted > 0 ? Math.min((cat.spent / cat.budgeted) * 100, 100) : 0
          const catOver = cat.spent > cat.budgeted && cat.budgeted > 0

          return (
            <div key={cat.id}>
              <div className="flex justify-between items-center mb-0.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{cat.name}</span>
                </div>
                <span className={`text-xs ${catOver ? 'text-red-400' : ''}`} style={{ color: catOver ? undefined : 'var(--color-text-muted)' }}>
                  {formatCurrency(cat.spent)}{cat.budgeted > 0 ? ` / ${formatCurrency(cat.budgeted)}` : ''}
                </span>
              </div>
              {cat.budgeted > 0 && (
                <div className="w-full h-1.5 rounded-full bg-gray-700 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${catPercent}%`, backgroundColor: catOver ? '#ef4444' : cat.color }}
                  />
                </div>
              )}
            </div>
          )
        })}

        {data.top_categories.length === 0 && (
          <p className="text-xs text-center py-2" style={{ color: 'var(--color-text-muted)' }}>
            No spending data yet
          </p>
        )}
      </div>

      {/* Footer Link */}
      <button
        onClick={() => navigate('/finances')}
        className="mt-3 flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg hover:bg-gray-700/50 transition-colors"
        style={{ color: 'var(--color-text-muted)' }}
      >
        View Full Budget <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  )
}

export default BudgetWidget
