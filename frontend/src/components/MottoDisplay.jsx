import { useSettings } from '../contexts/SettingsContext'

/**
 * Displays the farm motto/mission statement
 * Styled as a proper motto - centered, italic, with decorative elements
 * Uses flex-1 to fill available space in header rows
 */
export default function MottoDisplay({ className = '' }) {
  const settings = useSettings()

  // Safety check - don't crash if settings context isn't ready
  if (!settings || !settings.getSetting) return null

  const motto = settings.getSetting('motto', '')

  if (!motto) return null

  return (
    <div className={`flex-1 text-center px-2 ${className}`}>
      <p
        className="text-sm sm:text-base italic font-medium tracking-wide leading-tight"
        style={{
          color: 'var(--color-text-secondary)',
          fontFamily: 'Georgia, serif'
        }}
      >
        — "{motto}" —
      </p>
    </div>
  )
}
