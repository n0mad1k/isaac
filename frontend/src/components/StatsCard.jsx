import React from 'react'

function StatsCard({ title, value, icon: Icon, color = 'green', subtitle }) {
  const colorClasses = {
    green: 'from-green-900 to-green-800 text-green-400',
    blue: 'from-blue-900 to-blue-800 text-blue-400',
    yellow: 'from-yellow-900 to-yellow-800 text-yellow-400',
    red: 'from-red-900 to-red-800 text-red-400',
    purple: 'from-purple-900 to-purple-800 text-purple-400',
  }

  return (
    <div
      className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl p-4 shadow-lg`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-300">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        {Icon && (
          <div className="p-3 bg-white/10 rounded-lg">
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </div>
  )
}

export default StatsCard
