import React, { useState, useEffect } from 'react'
import { getBudgetDashboard } from '../services/api'
import { useNavigate } from 'react-router-dom'

function BudgetWidget({ className = '' }) {
  const [data, setData] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getBudgetDashboard()
        setData(res.data)
      } catch (error) {
        console.error('Failed to fetch budget data:', error)
      }
    }
    fetchData()

    const handleRefresh = () => fetchData()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [])

  if (!data || !data.top_categories || data.top_categories.length === 0) return null

  const fmt = (n) => {
    const abs = Math.abs(n)
    return abs >= 1000
      ? '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
      : '$' + abs.toFixed(2)
  }

  // Cap to same height as the date/time + motto area
  const cats = data.top_categories.filter(c => c.budgeted > 0)

  return (
    <div
      className={`flex flex-col gap-0.5 cursor-pointer max-h-[4.5rem] overflow-hidden ${className}`}
      onClick={() => navigate('/farm-finances?tab=budget')}
      title="View Budget"
    >
      {cats.map(cat => {
        const over = cat.spent > cat.budgeted
        const remaining = cat.budgeted - cat.spent
        const color = over ? '#ef4444' : '#22c55e'
        return (
          <div
            key={cat.id}
            className="flex items-center gap-1 text-xs font-mono font-bold leading-tight whitespace-nowrap"
            style={{ color }}
          >
            <span className="font-sans font-semibold" style={{ color }}>
              {cat.name}:
            </span>
            <span>
              {over ? '-' : ''}{fmt(remaining)}/{fmt(cat.budgeted)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default BudgetWidget
