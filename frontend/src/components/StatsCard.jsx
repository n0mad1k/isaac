import React from 'react'

function StatsCard({ title, value, icon: Icon, color = 'green', subtitle, bgColor }) {
  // E-paper palette - carbon text on parchment
  const iconColor = '#4b3b2f'  // Dark coffee
  const iconBgColor = '#c4b199'  // Light beige
  const textColor = '#2d2316'  // Carbon black

  return (
    <div
      className="rounded-lg p-2"
      style={{
        backgroundColor: bgColor || '#d4b483',
        border: '1px solid #8a6f3b',
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
