import React from 'react'

function StatsCard({ title, value, icon: Icon, color = 'green', subtitle, bgColor }) {
  return (
    <div
      className="rounded-lg p-2"
      style={{
        backgroundColor: bgColor || 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{title}</p>
          <p className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{value}</p>
          {subtitle && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{subtitle}</p>}
        </div>
        {Icon && (
          <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg-surface-soft)' }}>
            <Icon className="w-4 h-4" style={{ color: 'var(--color-green-600)' }} />
          </div>
        )}
      </div>
    </div>
  )
}

export default StatsCard
