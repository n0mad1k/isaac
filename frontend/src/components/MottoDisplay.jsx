import { useSettings } from '../contexts/SettingsContext'

/**
 * Displays the farm motto/mission statement
 * Styled as a proper motto - centered, italic, with decorative elements
 */
export default function MottoDisplay({ className = '' }) {
  const settings = useSettings()

  // Safety check - don't crash if settings context isn't ready
  if (!settings || !settings.getSetting) return null

  const motto = settings.getSetting('motto', '')

  if (!motto) return null

  return (
    <div className={`w-full text-center py-3 ${className}`}>
      <div className="inline-flex items-center gap-3">
        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
        <span
          className="text-base sm:text-lg italic font-medium tracking-wide"
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'Georgia, serif'
          }}
        >
          "{motto}"
        </span>
        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
      </div>
    </div>
  )
}
