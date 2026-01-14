import React from 'react'

function StatsCard({ title, value, icon: Icon, color = 'green', subtitle }) {
  // Use CSS token variables for theme-aware colors
  const colorStyles = {
    green: {
      background: 'var(--color-success-bg)',
      iconColor: 'var(--color-success-600)',
      border: '1px solid var(--color-success-border)'
    },
    blue: {
      background: 'var(--color-info-bg)',
      iconColor: 'var(--color-info-600)',
      border: '1px solid var(--color-info-border)'
    },
    yellow: {
      background: 'var(--color-warning-bg)',
      iconColor: 'var(--color-warning-600)',
      border: '1px solid var(--color-warning-border)'
    },
    red: {
      background: 'var(--color-error-bg)',
      iconColor: 'var(--color-error-600)',
      border: '1px solid var(--color-error-border)'
    },
    purple: {
      background: 'var(--color-bg-surface-soft)',
      iconColor: 'var(--color-badge-purple-bg)',
      border: '1px solid var(--color-border-default)'
    },
    gold: {
      background: 'var(--color-warning-bg)',
      iconColor: 'var(--color-gold-600)',
      border: '1px solid var(--color-warning-border)'
    },
    teal: {
      background: 'var(--color-info-bg)',
      iconColor: 'var(--color-teal-600)',
      border: '1px solid var(--color-info-border)'
    },
  }

  const style = colorStyles[color] || colorStyles.green

  return (
    <div
      className="rounded-lg p-2"
      style={{
        backgroundColor: style.background,
        border: style.border,
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{title}</p>
          <p className="text-xl font-bold" style={{ color: style.iconColor }}>{value}</p>
          {subtitle && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{subtitle}</p>}
        </div>
        {Icon && (
          <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg-surface-hover)' }}>
            <Icon className="w-4 h-4" style={{ color: style.iconColor }} />
          </div>
        )}
      </div>
    </div>
  )
}

export default StatsCard
