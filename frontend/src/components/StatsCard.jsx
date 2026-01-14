import React from 'react'

function StatsCard({ title, value, icon: Icon, color = 'green', subtitle, bgColor }) {
  // Consistent styling for all stats cards
  const iconColor = '#a2a9a3'
  const iconBgColor = '#f0e2d3'
  const textColor = '#a17f66'

  return (
    <div
      className="rounded-lg p-2"
      style={{
        backgroundColor: bgColor || '#d7c3b2',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs" style={{ color: textColor }}>{title}</p>
          <p className="text-xl font-bold" style={{ color: textColor }}>{value}</p>
          {subtitle && <p className="text-xs" style={{ color: textColor }}>{subtitle}</p>}
        </div>
        {Icon && (
          <div className="p-2 rounded-lg" style={{ backgroundColor: iconBgColor }}>
            <Icon className="w-4 h-4" style={{ color: iconColor }} />
          </div>
        )}
      </div>
    </div>
  )
}

export default StatsCard
