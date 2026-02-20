import React, { useState, useRef, useEffect } from 'react'
import { Plus, X, ClipboardCheck, Dumbbell, Heart, Scale } from 'lucide-react'

function FloatingActionButton({ onDailyCheckin, onLogWorkout, onLogVital, onLogWeight }) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const menuItems = [
    {
      icon: ClipboardCheck,
      label: 'Daily Check-in',
      description: 'Log all health metrics at once',
      color: 'text-blue-400',
      bgColor: 'hover:bg-blue-600/20',
      onClick: () => {
        setIsOpen(false)
        onDailyCheckin?.()
      }
    },
    {
      icon: Dumbbell,
      label: 'Log Workout',
      description: 'Record a workout session',
      color: 'text-green-400',
      bgColor: 'hover:bg-green-600/20',
      onClick: () => {
        setIsOpen(false)
        onLogWorkout?.()
      }
    },
    {
      icon: Heart,
      label: 'Log Vital',
      description: 'Record a single vital sign',
      color: 'text-red-400',
      bgColor: 'hover:bg-red-600/20',
      onClick: () => {
        setIsOpen(false)
        onLogVital?.()
      }
    },
    {
      icon: Scale,
      label: 'Log Weight',
      description: 'Record body weight',
      color: 'text-purple-400',
      bgColor: 'hover:bg-purple-600/20',
      onClick: () => {
        setIsOpen(false)
        onLogWeight?.()
      }
    }
  ]

  return (
    <div ref={menuRef} className="fixed bottom-6 right-6 z-50">
      {/* Expanded menu */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 mb-2 bg-surface border border-subtle rounded-lg shadow-xl overflow-hidden min-w-[220px]">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={item.onClick}
              className={`w-full px-4 py-3 text-left flex items-center gap-3 ${item.bgColor} transition-colors`}
            >
              <item.icon className={`w-5 h-5 ${item.color}`} />
              <div>
                <div className="text-white text-sm font-medium">{item.label}</div>
                <div className="text-muted text-xs">{item.description}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Main FAB button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          isOpen
            ? 'bg-surface-soft rotate-45'
            : 'bg-farm-green hover:bg-green-600'
        }`}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <Plus className="w-6 h-6 text-white" />
        )}
      </button>
    </div>
  )
}

export default FloatingActionButton
