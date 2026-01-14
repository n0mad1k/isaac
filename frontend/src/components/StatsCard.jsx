import React from 'react'

function StatsCard({ title, value, icon: Icon, color = 'green', subtitle, bgColor }) {
  // Earthy palette - Dark Walnut text, Dry Sage icon background
  const iconColor = '#582f0e'  // Dark Walnut
  const iconBgColor = '#c2c5aa'  // Dry Sage (matches app background)
  const textColor = '#582f0e'  // Dark Walnut

  return (
    <div
      className="rounded-lg p-2"
      style={{
        backgroundColor: bgColor || '#b6ad90',
        border: '1px solid #7f4f24',
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
