import React, { useState, useEffect } from 'react'
import { Keyboard } from 'lucide-react'
import { toggleKeyboard as toggleKeyboardApi } from '../services/api'

/**
 * Floating keyboard toggle button for touchscreen devices
 * Appears as a small button in the bottom-right corner
 * Only shows on touchscreen devices when enabled in settings
 */
function FloatingKeyboardButton({ enabled }) {
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const [lastTap, setLastTap] = useState(0)

  // Detect if device has touch capability
  useEffect(() => {
    const checkTouch = () => {
      // Check for touch capability
      const hasTouch = 'ontouchstart' in window ||
                       navigator.maxTouchPoints > 0 ||
                       window.matchMedia('(pointer: coarse)').matches
      setIsTouchDevice(hasTouch)
    }
    checkTouch()
    window.addEventListener('resize', checkTouch)
    return () => window.removeEventListener('resize', checkTouch)
  }, [])

  // Don't render if not enabled or not a touch device
  if (!enabled || !isTouchDevice) return null

  const handleToggle = async (e) => {
    e.preventDefault()
    e.stopPropagation()

    // Debounce to prevent double-taps
    const now = Date.now()
    if (now - lastTap < 300) return
    setLastTap(now)

    try {
      await toggleKeyboardApi()
    } catch (err) {
      console.error('Keyboard toggle failed:', err)
    }
  }

  return (
    <button
      onClick={handleToggle}
      className="fixed p-4 rounded-full shadow-lg transition-all duration-200 active:scale-95 touch-manipulation"
      style={{
        bottom: '24px',
        right: '24px',
        backgroundColor: 'var(--color-bg-surface)',
        border: '2px solid var(--color-border-default)',
        color: 'var(--color-text-secondary)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        zIndex: 9999,
        minWidth: '56px',
        minHeight: '56px',
        WebkitTapHighlightColor: 'transparent'
      }}
      title="Toggle on-screen keyboard"
      aria-label="Toggle on-screen keyboard"
    >
      <Keyboard className="w-7 h-7" />
    </button>
  )
}

export default FloatingKeyboardButton
