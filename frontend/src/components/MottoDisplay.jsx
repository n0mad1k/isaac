import { useSettings } from '../contexts/SettingsContext'

/**
 * Displays the farm motto/mission statement
 * Bold, centered display to remind users of their purpose
 */
export default function MottoDisplay({ className = '' }) {
  const settings = useSettings()

  // Safety check - don't crash if settings context isn't ready
  if (!settings || !settings.getSetting) return null

  const motto = settings.getSetting('motto', '')

  if (!motto) return null

  return (
    <div className={`w-full text-center py-2 ${className}`}>
      <span className="text-lg font-bold tracking-wide" style={{ color: 'var(--color-text-primary)' }}>
        {motto}
      </span>
    </div>
  )
}
