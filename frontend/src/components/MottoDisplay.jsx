import { useSettings } from '../contexts/SettingsContext'

/**
 * Displays the farm motto/mission statement
 * Use className to control visibility and alignment:
 * - Header usage: className="hidden md:block" (right-aligned by default)
 * - Dashboard: className="text-center" (overrides right alignment)
 */
export default function MottoDisplay({ className = '', centered = false }) {
  const { getSetting } = useSettings()
  const motto = getSetting('motto', '')

  if (!motto) return null

  const alignClass = centered ? 'text-center' : 'text-right'

  return (
    <div className={`flex-1 ${alignClass} ${className}`}>
      <span className="text-sm italic truncate block" style={{ color: 'var(--color-text-muted)' }}>
        "{motto}"
      </span>
    </div>
  )
}
