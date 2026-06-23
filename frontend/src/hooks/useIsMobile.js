import { useState, useEffect } from 'react'

/**
 * Hook to detect if the user is on a mobile device
 * Uses both screen width and touch capability detection
 */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < breakpoint
  })

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint)
    }

    window.addEventListener('resize', handleResize)
    // Initial check
    handleResize()

    return () => window.removeEventListener('resize', handleResize)
  }, [breakpoint])

  return isMobile
}

/**
 * Hook to detect if device has touch capability
 */
export function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    setIsTouch(
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      navigator.msMaxTouchPoints > 0
    )
  }, [])

  return isTouch
}

/**
 * Hook to get current screen size category
 */
export function useScreenSize() {
  const [size, setSize] = useState('lg')

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      if (width < 480) setSize('xs')       // Extra small phones
      else if (width < 640) setSize('sm')  // Small phones
      else if (width < 768) setSize('md')  // Large phones / small tablets
      else if (width < 1024) setSize('lg') // Tablets
      else setSize('xl')                   // Desktop
    }

    window.addEventListener('resize', handleResize)
    handleResize()

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return size
}

export default useIsMobile
