import React, { useState } from 'react'
import { Leaf, Sprout } from 'lucide-react'
import Plants from './Plants'
import Seeds from './Seeds'

function Garden() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('garden-tab') || 'plants'
  })

  const switchTab = (tab) => {
    setActiveTab(tab)
    localStorage.setItem('garden-tab', tab)
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-4 border-b border-gray-700 pb-1">
        <button
          onClick={() => switchTab('plants')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
            activeTab === 'plants'
              ? 'bg-gray-800 text-green-400 border-b-2 border-green-400'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
          }`}
        >
          <Leaf className="w-4 h-4" />
          Plants
        </button>
        <button
          onClick={() => switchTab('seeds')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
            activeTab === 'seeds'
              ? 'bg-gray-800 text-green-400 border-b-2 border-green-400'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
          }`}
        >
          <Sprout className="w-4 h-4" />
          Seeds
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'plants' ? <Plants /> : <Seeds />}
    </div>
  )
}

export default Garden
