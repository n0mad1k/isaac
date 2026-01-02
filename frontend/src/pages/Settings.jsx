import React, { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Save, RotateCcw, Mail, Thermometer, RefreshCw, Send, Calendar, Bell, PawPrint, Leaf, Wrench } from 'lucide-react'
import { getSettings, updateSetting, resetSetting, resetAllSettings, testColdProtectionEmail, testCalendarSync } from '../services/api'

function Settings() {
  const [settings, setSettings] = useState({})
  const [originalSettings, setOriginalSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)
  const [syncingCalendar, setSyncingCalendar] = useState(false)
  const [message, setMessage] = useState(null)
  const [hasChanges, setHasChanges] = useState(false)

  const fetchSettings = async () => {
    try {
      const response = await getSettings()
      setSettings(response.data.settings)
      setOriginalSettings(JSON.parse(JSON.stringify(response.data.settings)))
      setHasChanges(false)
    } catch (error) {
      console.error('Failed to fetch settings:', error)
      setMessage({ type: 'error', text: 'Failed to load settings' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const handleChange = (key, value) => {
    const newSettings = {
      ...settings,
      [key]: { ...settings[key], value }
    }
    setSettings(newSettings)

    // Check if there are any changes from original
    const changed = Object.keys(newSettings).some(k =>
      newSettings[k].value !== originalSettings[k]?.value
    )
    setHasChanges(changed)
  }

  const handleSaveAll = async () => {
    setSaving(true)
    try {
      // Find all changed settings
      const changedKeys = Object.keys(settings).filter(key =>
        settings[key].value !== originalSettings[key]?.value
      )

      // Update each changed setting
      for (const key of changedKeys) {
        await updateSetting(key, settings[key].value)
      }

      // Refresh to get updated timestamps
      await fetchSettings()
      setMessage({ type: 'success', text: `Saved ${changedKeys.length} setting(s)` })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Failed to save settings:', error)
      setMessage({ type: 'error', text: 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async (key) => {
    if (!confirm(`Reset ${key.replace(/_/g, ' ')} to default value?`)) return
    try {
      await resetSetting(key)
      await fetchSettings()
      setMessage({ type: 'success', text: `Reset ${key.replace(/_/g, ' ')} to default` })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Failed to reset setting:', error)
      setMessage({ type: 'error', text: 'Failed to reset setting' })
    }
  }

  const handleResetAll = async () => {
    if (!confirm('Reset ALL settings to their default values? This cannot be undone.')) return
    setLoading(true)
    try {
      await resetAllSettings()
      await fetchSettings()
      setMessage({ type: 'success', text: 'All settings reset to defaults' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Failed to reset all settings:', error)
      setMessage({ type: 'error', text: 'Failed to reset settings' })
    } finally {
      setLoading(false)
    }
  }

  const handleTestEmail = async () => {
    setSendingTest(true)
    try {
      const response = await testColdProtectionEmail()
      setMessage({
        type: 'success',
        text: `Test email sent! Included ${response.data.plants.length} plants (forecast low: ${response.data.forecast_low}°F)`
      })
      setTimeout(() => setMessage(null), 5000)
    } catch (error) {
      console.error('Failed to send test email:', error)
      const detail = error.response?.data?.detail || 'Failed to send test email'
      setMessage({ type: 'error', text: detail })
    } finally {
      setSendingTest(false)
    }
  }

  const handleCalendarSync = async () => {
    setSyncingCalendar(true)
    try {
      const response = await testCalendarSync()
      setMessage({
        type: 'success',
        text: `Calendar sync successful! ${response.data.tasks_synced_to_calendar} tasks synced, ${response.data.events_synced_to_tasks} events imported.`
      })
      setTimeout(() => setMessage(null), 5000)
    } catch (error) {
      console.error('Failed to sync calendar:', error)
      const detail = error.response?.data?.detail || 'Failed to sync calendar'
      setMessage({ type: 'error', text: detail })
    } finally {
      setSyncingCalendar(false)
    }
  }

  // Group settings by category
  const emailSettings = ['email_alerts_enabled', 'email_recipients', 'email_daily_digest', 'email_digest_time']
  const alertSettings = ['frost_warning_temp', 'freeze_warning_temp', 'heat_warning_temp', 'wind_warning_speed', 'rain_warning_inches', 'cold_protection_buffer']
  const calendarSettings = ['calendar_enabled', 'calendar_url', 'calendar_username', 'calendar_password', 'calendar_name', 'calendar_sync_interval']
  const displaySettings = ['dashboard_refresh_interval']

  // Notification category settings - grouped by type
  const animalNotifySettings = [
    { key: 'notify_animal_hoof_trim', label: 'Hoof Trim' },
    { key: 'notify_animal_worming', label: 'Worming' },
    { key: 'notify_animal_vaccination', label: 'Vaccination' },
    { key: 'notify_animal_dental', label: 'Dental' },
    { key: 'notify_animal_vet', label: 'Vet Appointments' },
    { key: 'notify_animal_slaughter', label: 'Slaughter Date' },
    { key: 'notify_animal_labor', label: 'Expected Birth' },
  ]
  const plantNotifySettings = [
    { key: 'notify_plant_watering', label: 'Watering' },
    { key: 'notify_plant_fertilizing', label: 'Fertilizing' },
    { key: 'notify_plant_harvest', label: 'Harvest' },
    { key: 'notify_plant_pruning', label: 'Pruning' },
    { key: 'notify_plant_sow', label: 'Sow Date' },
  ]
  const maintenanceNotifySettings = [
    { key: 'notify_maintenance', label: 'Maintenance Reminders' },
  ]

  // Helper to parse notification channels
  const parseChannels = (value) => {
    const channels = (value || '').split(',').map(c => c.trim().toLowerCase())
    return {
      dashboard: channels.includes('dashboard'),
      email: channels.includes('email'),
      calendar: channels.includes('calendar'),
    }
  }

  // Helper to build channel string from checkboxes
  const buildChannelString = (channels) => {
    const parts = []
    if (channels.dashboard) parts.push('dashboard')
    if (channels.email) parts.push('email')
    if (channels.calendar) parts.push('calendar')
    return parts.join(',')
  }

  // Handle notification channel toggle
  const handleChannelToggle = (key, channel) => {
    const current = settings[key]?.value || ''
    const channels = parseChannels(current)
    channels[channel] = !channels[channel]
    handleChange(key, buildChannelString(channels))
  }

  const renderSettingInput = (key, setting) => {
    const isBooleanSetting = setting.value === 'true' || setting.value === 'false'

    if (isBooleanSetting) {
      return (
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={setting.value === 'true'}
            onChange={(e) => handleChange(key, e.target.checked ? 'true' : 'false')}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-farm-green rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-farm-green"></div>
        </label>
      )
    }

    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={setting.value || ''}
          onChange={(e) => handleChange(key, e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
        />
        {!setting.is_default && (
          <button
            onClick={() => handleReset(key)}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Reset to default"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
      </div>
    )
  }

  const renderSettingCard = (key) => {
    const setting = settings[key]
    if (!setting) return null

    const isChanged = setting.value !== originalSettings[key]?.value

    return (
      <div key={key} className={`bg-gray-800/50 rounded-lg p-4 ${isChanged ? 'ring-2 ring-farm-green' : ''}`}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <h4 className="font-medium capitalize">
              {key.replace(/_/g, ' ')}
              {isChanged && <span className="ml-2 text-xs text-farm-green">(modified)</span>}
            </h4>
            <p className="text-sm text-gray-400">{setting.description}</p>
          </div>
          {setting.is_default && !isChanged && (
            <span className="text-xs bg-gray-700 text-gray-400 px-2 py-1 rounded">Default</span>
          )}
        </div>
        {renderSettingInput(key, setting)}
      </div>
    )
  }

  // Render notification channel checkboxes row
  const renderNotifyRow = ({ key, label }) => {
    const setting = settings[key]
    if (!setting) return null

    const channels = parseChannels(setting.value)
    const isChanged = setting.value !== originalSettings[key]?.value

    return (
      <tr key={key} className={isChanged ? 'bg-farm-green/10' : ''}>
        <td className="py-2 px-3 text-sm">
          {label}
          {isChanged && <span className="ml-2 text-xs text-farm-green">*</span>}
        </td>
        <td className="py-2 px-3 text-center">
          <input
            type="checkbox"
            checked={channels.dashboard}
            onChange={() => handleChannelToggle(key, 'dashboard')}
            className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-farm-green focus:ring-farm-green focus:ring-offset-gray-800"
          />
        </td>
        <td className="py-2 px-3 text-center">
          <input
            type="checkbox"
            checked={channels.email}
            onChange={() => handleChannelToggle(key, 'email')}
            className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-farm-green focus:ring-farm-green focus:ring-offset-gray-800"
          />
        </td>
        <td className="py-2 px-3 text-center">
          <input
            type="checkbox"
            checked={channels.calendar}
            onChange={() => handleChannelToggle(key, 'calendar')}
            className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-farm-green focus:ring-farm-green focus:ring-offset-gray-800"
          />
        </td>
      </tr>
    )
  }

  // Render a notification category table
  const renderNotifyTable = (title, icon, items, color) => {
    const IconComponent = icon
    return (
      <div className="mb-6 last:mb-0">
        <h3 className={`text-sm font-semibold flex items-center gap-2 mb-2 ${color}`}>
          <IconComponent className="w-4 h-4" />
          {title}
        </h3>
        <table className="w-full">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-700">
              <th className="py-2 px-3 text-left font-medium">Category</th>
              <th className="py-2 px-3 text-center font-medium">Dashboard</th>
              <th className="py-2 px-3 text-center font-medium">Email</th>
              <th className="py-2 px-3 text-center font-medium">Calendar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {items.map(item => renderNotifyRow(item))}
          </tbody>
        </table>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-farm-green"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SettingsIcon className="w-7 h-7 text-gray-400" />
          Settings
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetAll}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-sm"
          >
            <RotateCcw className="w-4 h-4" />
            Reset All
          </button>
          <button
            onClick={handleSaveAll}
            disabled={!hasChanges || saving}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm ${
              hasChanges
                ? 'bg-farm-green hover:bg-farm-green-light'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-900/50 text-green-300 border border-green-800' :
          'bg-red-900/50 text-red-300 border border-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Unsaved changes warning */}
      {hasChanges && (
        <div className="p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg text-yellow-300 text-sm">
          You have unsaved changes. Click "Save Changes" to apply them.
        </div>
      )}

      {/* Email Settings */}
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-400" />
            Email Notifications
          </h2>
          <button
            onClick={handleTestEmail}
            disabled={sendingTest}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg transition-colors text-sm"
          >
            <Send className="w-4 h-4" />
            {sendingTest ? 'Sending...' : 'Test Cold Protection Email'}
          </button>
        </div>
        <div className="space-y-4">
          {emailSettings.map(key => renderSettingCard(key))}
        </div>
      </div>

      {/* Alert Thresholds */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Thermometer className="w-5 h-5 text-orange-400" />
          Alert Thresholds
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Configure the temperature and weather conditions that trigger alerts.
          Cold protection emails are sent 1 hour before sunset when plants need covering.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {alertSettings.map(key => renderSettingCard(key))}
        </div>
      </div>

      {/* Notification Categories */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-yellow-400" />
          Notification Categories
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Choose which notification channels to use for each type of reminder.
          Dashboard shows alerts on the home screen. Email sends notifications.
          Calendar creates events in your synced calendar.
        </p>
        <div className="bg-gray-700/30 rounded-lg p-4">
          {renderNotifyTable('Animal Care', PawPrint, animalNotifySettings, 'text-blue-400')}
          {renderNotifyTable('Plant Care', Leaf, plantNotifySettings, 'text-green-400')}
          {renderNotifyTable('Maintenance', Wrench, maintenanceNotifySettings, 'text-orange-400')}
        </div>
      </div>

      {/* Calendar Sync */}
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-green-400" />
            Calendar Sync
          </h2>
          <button
            onClick={handleCalendarSync}
            disabled={syncingCalendar}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:cursor-not-allowed rounded-lg transition-colors text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${syncingCalendar ? 'animate-spin' : ''}`} />
            {syncingCalendar ? 'Syncing...' : 'Test Sync'}
          </button>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Sync tasks with your Proton Calendar (or other CalDAV calendar).
          Tasks will appear as events and calendar events will be imported as tasks.
        </p>
        <div className="space-y-4">
          {calendarSettings.map(key => renderSettingCard(key))}
        </div>
      </div>

      {/* Display Settings */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <RefreshCw className="w-5 h-5 text-purple-400" />
          Display Settings
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Auto-refresh is useful for kiosk displays around your property.
          Set the interval in minutes (e.g., "5" for 5 minutes). Set to "0" to disable.
          A countdown timer will appear at the bottom of the sidebar when enabled.
        </p>
        <div className="space-y-4">
          {displaySettings.map(key => renderSettingCard(key))}
        </div>
      </div>

      {/* Info */}
      <div className="bg-gray-800/50 rounded-xl p-6 text-sm text-gray-400">
        <h3 className="font-medium text-white mb-2">About Settings</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>Make your changes, then click "Save Changes" to apply them</li>
          <li>Email recipients should be comma-separated for multiple addresses</li>
          <li>Cold protection buffer accounts for forecast inaccuracy (NOAA can be off by 6-7 degrees)</li>
          <li>The sunset cold protection email is sent 1 hour before sunset if plants need covering</li>
        </ul>
      </div>
    </div>
  )
}

export default Settings
