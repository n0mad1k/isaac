import React, { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Save, RotateCcw, Mail, Thermometer, RefreshCw, Send, Calendar, Bell, PawPrint, Leaf, Wrench, Clock, Eye, EyeOff, Book, Users, UserPlus, Shield, Trash2, ToggleLeft, ToggleRight, Edit2, Key, X, Check, ShieldCheck, ChevronDown, ChevronRight, Plus, MapPin, Cloud, Server, HardDrive, AlertTriangle } from 'lucide-react'
import { getSettings, updateSetting, resetSetting, resetAllSettings, testColdProtectionEmail, testCalendarSync, getUsers, createUser, updateUser, updateUserRole, toggleUserStatus, deleteUser, resetUserPassword, getRoles, createRole, updateRole, deleteRole, getPermissionCategories, getStorageStats, clearLogs } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

function Settings() {
  const { isAdmin, user } = useAuth()
  const [settings, setSettings] = useState({})
  const [originalSettings, setOriginalSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)
  const [syncingCalendar, setSyncingCalendar] = useState(false)
  const [message, setMessage] = useState(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [showPasswords, setShowPasswords] = useState({})  // Track which password fields are visible

  // User management state (admin only)
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', display_name: '', role: 'viewer', is_kiosk: false })
  const [editingUser, setEditingUser] = useState(null)
  const [editUserData, setEditUserData] = useState({})
  const [resetPasswordUser, setResetPasswordUser] = useState(null)
  const [newPassword, setNewPassword] = useState('')

  // Role management state
  const [roles, setRoles] = useState([])
  const [loadingRoles, setLoadingRoles] = useState(false)
  const [editingRole, setEditingRole] = useState(null)
  const [permissionCategories, setPermissionCategories] = useState(null)
  const [showAddRole, setShowAddRole] = useState(false)
  const [newRole, setNewRole] = useState({ name: '', display_name: '', description: '', color: '#6B7280' })

  // Storage state
  const [storageStats, setStorageStats] = useState(null)
  const [loadingStorage, setLoadingStorage] = useState(false)
  const [clearingLogs, setClearingLogs] = useState(false)

  // Collapsible sections state - all collapsed by default
  const [expandedSections, setExpandedSections] = useState({
    users: false,
    roles: false,
    location: false,
    weatherApi: false,
    emailServer: false,
    email: false,
    alerts: false,
    notifications: false,
    reminders: false,
    calendar: false,
    display: false,
    bible: false,
    storage: false
  })

  // Fields that should be treated as passwords
  const passwordFields = ['calendar_password', 'smtp_password', 'awn_api_key', 'awn_app_key']

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

  // Fetch users and roles (admin only)
  useEffect(() => {
    if (isAdmin) {
      fetchUsers()
      fetchRoles()
      fetchPermissionCategories()
    }
  }, [isAdmin])

  const fetchUsers = async () => {
    setLoadingUsers(true)
    try {
      const response = await getUsers()
      setUsers(response.data)
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    try {
      await createUser(newUser)
      setMessage({ type: 'success', text: 'User created successfully' })
      setTimeout(() => setMessage(null), 3000)
      setShowAddUser(false)
      setNewUser({ username: '', email: '', password: '', display_name: '', role: 'viewer', is_kiosk: false })
      fetchUsers()
    } catch (error) {
      console.error('Failed to create user:', error)
      const detail = error.response?.data?.detail || 'Failed to create user'
      setMessage({ type: 'error', text: Array.isArray(detail) ? detail[0]?.msg || 'Failed to create user' : detail })
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateUserRole(userId, newRole)
      setMessage({ type: 'success', text: 'User role updated' })
      setTimeout(() => setMessage(null), 3000)
      fetchUsers()
    } catch (error) {
      console.error('Failed to update role:', error)
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to update role' })
    }
  }

  const handleToggleUser = async (userId) => {
    try {
      await toggleUserStatus(userId)
      setMessage({ type: 'success', text: 'User status updated' })
      setTimeout(() => setMessage(null), 3000)
      fetchUsers()
    } catch (error) {
      console.error('Failed to toggle user:', error)
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to update status' })
    }
  }

  const handleDeleteUser = async (userId, username) => {
    if (!confirm(`Are you sure you want to delete user "${username}"? This cannot be undone.`)) return
    try {
      await deleteUser(userId)
      setMessage({ type: 'success', text: 'User deleted' })
      setTimeout(() => setMessage(null), 3000)
      fetchUsers()
    } catch (error) {
      console.error('Failed to delete user:', error)
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to delete user' })
    }
  }

  const startEditingUser = (u) => {
    setEditingUser(u.id)
    setEditUserData({
      username: u.username,
      email: u.email || '',
      display_name: u.display_name || '',
      role: u.role,
      is_kiosk: u.is_kiosk || false
    })
  }

  const cancelEditingUser = () => {
    setEditingUser(null)
    setEditUserData({})
  }

  const handleUpdateUser = async (userId) => {
    try {
      await updateUser(userId, editUserData)
      setMessage({ type: 'success', text: 'User updated successfully' })
      setTimeout(() => setMessage(null), 3000)
      setEditingUser(null)
      setEditUserData({})
      fetchUsers()
    } catch (error) {
      console.error('Failed to update user:', error)
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to update user' })
    }
  }

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' })
      return
    }
    try {
      await resetUserPassword(resetPasswordUser.id, newPassword)
      setMessage({ type: 'success', text: `Password reset for ${resetPasswordUser.username}` })
      setTimeout(() => setMessage(null), 3000)
      setResetPasswordUser(null)
      setNewPassword('')
    } catch (error) {
      console.error('Failed to reset password:', error)
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to reset password' })
    }
  }

  // Role management functions
  const fetchRoles = async () => {
    setLoadingRoles(true)
    try {
      const response = await getRoles()
      setRoles(response.data)
    } catch (error) {
      console.error('Failed to fetch roles:', error)
    } finally {
      setLoadingRoles(false)
    }
  }

  const fetchPermissionCategories = async () => {
    try {
      const response = await getPermissionCategories()
      setPermissionCategories(response.data)
    } catch (error) {
      console.error('Failed to fetch permission categories:', error)
    }
  }

  const handleUpdateRolePermission = async (roleId, category, action, value) => {
    const role = roles.find(r => r.id === roleId)
    if (!role) return

    const newPermissions = { ...role.permissions }
    if (!newPermissions[category]) {
      newPermissions[category] = {}
    }
    newPermissions[category][action] = value

    try {
      await updateRole(roleId, { permissions: newPermissions })
      setMessage({ type: 'success', text: 'Role permissions updated' })
      setTimeout(() => setMessage(null), 3000)
      fetchRoles()
    } catch (error) {
      console.error('Failed to update role:', error)
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to update role' })
    }
  }

  const handleCreateRole = async (e) => {
    e.preventDefault()
    try {
      await createRole({
        ...newRole,
        permissions: permissionCategories?.defaults?.viewer || {}
      })
      setMessage({ type: 'success', text: 'Role created successfully' })
      setTimeout(() => setMessage(null), 3000)
      setShowAddRole(false)
      setNewRole({ name: '', display_name: '', description: '', color: '#6B7280' })
      fetchRoles()
    } catch (error) {
      console.error('Failed to create role:', error)
      const detail = error.response?.data?.detail || 'Failed to create role'
      setMessage({ type: 'error', text: Array.isArray(detail) ? detail[0]?.msg || 'Failed to create role' : detail })
    }
  }

  const handleDeleteRole = async (roleId, roleName) => {
    if (!confirm(`Are you sure you want to delete the role "${roleName}"? This cannot be undone.`)) return
    try {
      await deleteRole(roleId)
      setMessage({ type: 'success', text: 'Role deleted' })
      setTimeout(() => setMessage(null), 3000)
      fetchRoles()
    } catch (error) {
      console.error('Failed to delete role:', error)
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to delete role' })
    }
  }

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

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
      const changedKeys = Object.keys(settings).filter(key => {
        const isChanged = settings[key].value !== originalSettings[key]?.value
        // Don't save if it's a password field and the value is the mask
        const isMaskedPassword = passwordFields.includes(key) && settings[key].value === '••••••••'
        return isChanged && !isMaskedPassword
      })

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

  const fetchStorageStats = async () => {
    setLoadingStorage(true)
    try {
      const response = await getStorageStats()
      setStorageStats(response.data)
    } catch (error) {
      console.error('Failed to fetch storage stats:', error)
    } finally {
      setLoadingStorage(false)
    }
  }

  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear all log files? This cannot be undone.')) return
    setClearingLogs(true)
    try {
      const response = await clearLogs()
      setMessage({
        type: 'success',
        text: `Cleared ${response.data.cleared_count} log files (${response.data.cleared_human} freed)`
      })
      setTimeout(() => setMessage(null), 5000)
      fetchStorageStats()  // Refresh storage stats
    } catch (error) {
      console.error('Failed to clear logs:', error)
      setMessage({ type: 'error', text: 'Failed to clear logs' })
    } finally {
      setClearingLogs(false)
    }
  }

  // Fetch storage stats when section is expanded
  useEffect(() => {
    if (expandedSections.storage && !storageStats) {
      fetchStorageStats()
    }
  }, [expandedSections.storage])

  // Group settings by category
  const locationSettings = ['timezone', 'latitude', 'longitude', 'usda_zone']
  const weatherApiSettings = ['awn_api_key', 'awn_app_key']
  const emailServerSettings = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_from']
  const emailSettings = ['email_alerts_enabled', 'email_recipients', 'email_daily_digest', 'email_digest_time']
  const alertSettings = ['frost_warning_temp', 'freeze_warning_temp', 'heat_warning_temp', 'wind_warning_speed', 'rain_warning_inches', 'cold_protection_buffer']
  const calendarSettings = ['calendar_enabled', 'calendar_url', 'calendar_username', 'calendar_password', 'calendar_name', 'calendar_sync_interval']
  const storageSettings = ['storage_warning_percent', 'storage_critical_percent']
  const displaySettings = ['dashboard_refresh_interval', 'bible_translation']

  // Bible translation options (available from bible-api.com)
  const bibleTranslationOptions = [
    { value: 'KJV', label: 'King James Version (KJV)' },
    { value: 'ASV', label: 'American Standard Version (ASV)' },
    { value: 'WEB', label: 'World English Bible (WEB)' },
    { value: 'BBE', label: 'Bible in Basic English (BBE)' },
    { value: 'DARBY', label: 'Darby Translation' },
    { value: 'YLT', label: "Young's Literal Translation (YLT)" },
  ]

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

  // Reminder alert interval options (in minutes)
  const alertIntervalOptions = [
    { value: 0, label: 'At time due' },
    { value: 15, label: '15 minutes before' },
    { value: 30, label: '30 minutes before' },
    { value: 60, label: '1 hour before' },
    { value: 120, label: '2 hours before' },
    { value: 1440, label: '1 day before' },
    { value: 2880, label: '2 days before' },
    { value: 10080, label: '1 week before' },
  ]

  // Parse reminder alerts string to array of numbers
  const parseReminderAlerts = (value) => {
    if (!value) return []
    return value.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v))
  }

  // Toggle an alert interval
  const handleAlertIntervalToggle = (minutes) => {
    const current = settings['default_reminder_alerts']?.value || ''
    const intervals = parseReminderAlerts(current)
    const newIntervals = intervals.includes(minutes)
      ? intervals.filter(v => v !== minutes)
      : [...intervals, minutes].sort((a, b) => a - b)
    handleChange('default_reminder_alerts', newIntervals.join(','))
  }

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
    const isPasswordField = passwordFields.includes(key)
    const isBibleTranslation = key === 'bible_translation'

    if (isBibleTranslation) {
      return (
        <div className="flex items-center gap-2">
          <select
            value={setting.value || 'KJV'}
            onChange={(e) => handleChange(key, e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
          >
            {bibleTranslationOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
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
        <div className="relative w-full">
          <input
            type={isPasswordField && !showPasswords[key] ? 'password' : 'text'}
            value={setting.value || ''}
            onChange={(e) => handleChange(key, e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green pr-10"
            autoComplete={isPasswordField ? 'new-password' : 'off'}
          />
          {isPasswordField && (
            <button
              type="button"
              onClick={() => setShowPasswords(prev => ({ ...prev, [key]: !prev[key] }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white transition-colors"
              title={showPasswords[key] ? 'Hide password' : 'Show password'}
            >
              {showPasswords[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>
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

      {/* User Management (Admin Only) */}
      {isAdmin && (
        <div className="bg-gray-800 rounded-xl p-6">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('users')}
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {expandedSections.users ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
              <Users className="w-5 h-5 text-indigo-400" />
              User Management
            </h2>
            {expandedSections.users && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowAddUser(!showAddUser); }}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors text-sm"
              >
                <UserPlus className="w-4 h-4" />
                Add User
              </button>
            )}
          </div>

          {expandedSections.users && (
            <div className="mt-4">

          {/* Add User Form */}
          {showAddUser && (
            <form onSubmit={handleCreateUser} className="mb-6 p-4 bg-gray-700/50 rounded-lg space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
                  <input
                    type="text"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={newUser.display_name}
                    onChange={(e) => setNewUser({ ...newUser, display_name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Email <span className="text-gray-500">(optional)</span></label>
                  <input
                    type="text"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                    placeholder="optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Password {newUser.is_kiosk && <span className="text-gray-500">(not required for kiosk)</span>}
                  </label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                    required={!newUser.is_kiosk}
                    disabled={newUser.is_kiosk}
                    placeholder={newUser.is_kiosk ? 'Not required for kiosk mode' : ''}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  >
                    <option value="viewer">Viewer (Read-only)</option>
                    <option value="editor">Editor (Can edit content)</option>
                    <option value="admin">Admin (Full access)</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newUser.is_kiosk}
                      onChange={(e) => setNewUser({ ...newUser, is_kiosk: e.target.checked, password: e.target.checked ? '' : newUser.password })}
                      className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-farm-green focus:ring-farm-green focus:ring-offset-gray-800"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-300">Kiosk Mode</span>
                      <p className="text-xs text-gray-500">Allow login without password (for dashboard displays)</p>
                    </div>
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-farm-green hover:bg-farm-green-light rounded-lg transition-colors text-sm"
                >
                  Create User
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddUser(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Password Reset Modal */}
          {resetPasswordUser && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Key className="w-5 h-5 text-yellow-400" />
                  Reset Password for {resetPasswordUser.username}
                </h3>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-1">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                    placeholder="Minimum 8 characters"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleResetPassword}
                    className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg transition-colors"
                  >
                    Reset Password
                  </button>
                  <button
                    onClick={() => { setResetPasswordUser(null); setNewPassword(''); }}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Users List */}
          {loadingUsers ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-farm-green"></div>
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div
                  key={u.id}
                  className={`p-4 rounded-lg ${
                    u.is_active ? 'bg-gray-700/50' : 'bg-gray-700/20 opacity-60'
                  }`}
                >
                  {editingUser === u.id ? (
                    // Edit mode
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Username</label>
                          <input
                            type="text"
                            value={editUserData.username}
                            onChange={(e) => setEditUserData({ ...editUserData, username: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Display Name</label>
                          <input
                            type="text"
                            value={editUserData.display_name}
                            onChange={(e) => setEditUserData({ ...editUserData, display_name: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Email <span className="text-gray-500">(optional)</span></label>
                          <input
                            type="text"
                            value={editUserData.email}
                            onChange={(e) => setEditUserData({ ...editUserData, email: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green text-sm"
                            placeholder="optional"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Role</label>
                          <select
                            value={editUserData.role}
                            onChange={(e) => setEditUserData({ ...editUserData, role: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green text-sm"
                            disabled={u.id === user?.id}
                          >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editUserData.is_kiosk || false}
                              onChange={(e) => setEditUserData({ ...editUserData, is_kiosk: e.target.checked })}
                              className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-farm-green focus:ring-farm-green focus:ring-offset-gray-800"
                            />
                            <span className="text-xs text-gray-400">Kiosk Mode (login without password)</span>
                          </label>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateUser(u.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-farm-green hover:bg-farm-green-light rounded-lg transition-colors text-sm"
                        >
                          <Check className="w-4 h-4" /> Save
                        </button>
                        <button
                          onClick={cancelEditingUser}
                          className="flex items-center gap-1 px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors text-sm"
                        >
                          <X className="w-4 h-4" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          u.role === 'admin' ? 'bg-indigo-600' :
                          u.role === 'editor' ? 'bg-blue-600' : 'bg-gray-600'
                        }`}>
                          {u.role === 'admin' ? <Shield className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {u.display_name || u.username}
                            {u.id === user?.id && (
                              <span className="text-xs bg-farm-green/20 text-farm-green px-2 py-0.5 rounded">You</span>
                            )}
                            {u.is_kiosk && (
                              <span className="text-xs bg-purple-900/50 text-purple-400 px-2 py-0.5 rounded">Kiosk</span>
                            )}
                            {!u.is_active && (
                              <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded">Disabled</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-400">@{u.username}{u.email && ` • ${u.email}`}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEditingUser(u)}
                          className="p-2 text-blue-400 hover:bg-blue-900/30 rounded-lg transition-colors"
                          title="Edit user"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setResetPasswordUser(u)}
                          className="p-2 text-yellow-400 hover:bg-yellow-900/30 rounded-lg transition-colors"
                          title="Reset password"
                        >
                          <Key className="w-5 h-5" />
                        </button>
                        {u.id !== user?.id && (
                          <>
                            <button
                              onClick={() => handleToggleUser(u.id)}
                              className={`p-2 rounded-lg transition-colors ${
                                u.is_active ? 'text-green-400 hover:bg-green-900/30' : 'text-gray-500 hover:bg-gray-600'
                              }`}
                              title={u.is_active ? 'Disable user' : 'Enable user'}
                            >
                              {u.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              className="p-2 text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                              title="Delete user"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
          )}
        </div>
      )}

      {/* Role Permissions (Admin Only) */}
      {isAdmin && (
        <div className="bg-gray-800 rounded-xl p-6">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('roles')}
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {expandedSections.roles ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
              <ShieldCheck className="w-5 h-5 text-purple-400" />
              Role Permissions
            </h2>
            {expandedSections.roles && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowAddRole(!showAddRole); }}
                className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Role
              </button>
            )}
          </div>

          {expandedSections.roles && (
            <div className="mt-4">
              <p className="text-sm text-gray-400 mb-4">
                Configure what each role can access. Changes take effect immediately.
              </p>

              {/* Add Role Form */}
              {showAddRole && (
                <form onSubmit={handleCreateRole} className="mb-6 p-4 bg-gray-700/50 rounded-lg space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Role Name (slug)</label>
                      <input
                        type="text"
                        value={newRole.name}
                        onChange={(e) => setNewRole({ ...newRole, name: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                        placeholder="e.g., farm_hand"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Display Name</label>
                      <input
                        type="text"
                        value={newRole.display_name}
                        onChange={(e) => setNewRole({ ...newRole, display_name: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                        placeholder="e.g., Farm Hand"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                      <input
                        type="text"
                        value={newRole.description}
                        onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                        placeholder="Optional description"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Color</label>
                      <input
                        type="color"
                        value={newRole.color}
                        onChange={(e) => setNewRole({ ...newRole, color: e.target.value })}
                        className="w-full h-10 px-1 py-1 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green cursor-pointer"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-farm-green hover:bg-farm-green-light rounded-lg transition-colors text-sm"
                    >
                      Create Role
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddRole(false)}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {loadingRoles ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-farm-green"></div>
                </div>
              ) : permissionCategories && (
                <div className="space-y-6">
                  {roles.map((role) => (
                    <div key={role.id} className="bg-gray-700/30 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: role.color }}
                          />
                          <h3 className="font-medium capitalize">{role.display_name}</h3>
                          {role.is_builtin && (
                            <span className="text-xs bg-gray-600 text-gray-300 px-2 py-0.5 rounded">Built-in</span>
                          )}
                        </div>
                        {!role.is_builtin && (
                          <button
                            onClick={() => handleDeleteRole(role.id, role.display_name)}
                            className="p-2 text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                            title="Delete role"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      {role.description && (
                        <p className="text-sm text-gray-400 mb-3">{role.description}</p>
                      )}

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-400 border-b border-gray-600">
                              <th className="text-left py-2 px-2 font-medium">Category</th>
                              {['view', 'create', 'edit', 'delete'].map(action => (
                                <th key={action} className="text-center py-2 px-2 font-medium capitalize">{action}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(permissionCategories.categories).map(([catKey, catInfo]) => (
                              <tr key={catKey} className="border-b border-gray-700/50">
                                <td className="py-2 px-2 text-gray-300">{catInfo.label}</td>
                                {['view', 'create', 'edit', 'delete'].map(action => (
                                  <td key={action} className="text-center py-2 px-2">
                                    {catInfo.actions.includes(action) ? (
                                      <input
                                        type="checkbox"
                                        checked={role.permissions?.[catKey]?.[action] || false}
                                        onChange={(e) => handleUpdateRolePermission(role.id, catKey, action, e.target.checked)}
                                        className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-farm-green focus:ring-farm-green focus:ring-offset-gray-800"
                                        disabled={role.name === 'admin' && catKey === 'users'}
                                      />
                                    ) : (
                                      <span className="text-gray-600">-</span>
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Location Settings (Admin Only) */}
      {isAdmin && (
        <div className="bg-gray-800 rounded-xl p-6">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('location')}
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {expandedSections.location ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
              <MapPin className="w-5 h-5 text-red-400" />
              Location Settings
            </h2>
          </div>
          {expandedSections.location && (
            <div className="mt-4">
              <p className="text-sm text-gray-400 mb-4">
                Configure your farm location for weather forecasts, sunrise/sunset calculations, and frost warnings.
                Find your coordinates at <a href="https://www.latlong.net/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">latlong.net</a>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {locationSettings.map(key => renderSettingCard(key))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Weather API Settings (Admin Only) */}
      {isAdmin && (
        <div className="bg-gray-800 rounded-xl p-6">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('weatherApi')}
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {expandedSections.weatherApi ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
              <Cloud className="w-5 h-5 text-sky-400" />
              Weather Integration
            </h2>
          </div>
          {expandedSections.weatherApi && (
            <div className="mt-4">
              <p className="text-sm text-gray-400 mb-4">
                Connect your Ambient Weather station for real-time local weather data.
                Get API keys from <a href="https://ambientweather.net/account" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">ambientweather.net/account</a>.
                Leave blank to use NWS forecast data only.
              </p>
              <div className="space-y-4">
                {weatherApiSettings.map(key => renderSettingCard(key))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Email Server Settings (Admin Only) */}
      {isAdmin && (
        <div className="bg-gray-800 rounded-xl p-6">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('emailServer')}
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {expandedSections.emailServer ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
              <Server className="w-5 h-5 text-teal-400" />
              Email Server (SMTP)
            </h2>
          </div>
          {expandedSections.emailServer && (
            <div className="mt-4">
              <p className="text-sm text-gray-400 mb-4">
                Configure SMTP settings to send email notifications. For Gmail, use an{' '}
                <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">App Password</a>.
                For Protonmail, use Bridge or SMTP token.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {emailServerSettings.map(key => renderSettingCard(key))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Email Notification Settings (Admin Only) */}
      {isAdmin && (
        <div className="bg-gray-800 rounded-xl p-6">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('email')}
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {expandedSections.email ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
              <Mail className="w-5 h-5 text-blue-400" />
              Email Notifications
            </h2>
            {expandedSections.email && (
              <button
                onClick={(e) => { e.stopPropagation(); handleTestEmail(); }}
                disabled={sendingTest}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg transition-colors text-sm"
              >
                <Send className="w-4 h-4" />
                {sendingTest ? 'Sending...' : 'Test Email'}
              </button>
            )}
          </div>
          {expandedSections.email && (
            <div className="mt-4 space-y-4">
              {emailSettings.map(key => renderSettingCard(key))}
            </div>
          )}
        </div>
      )}

      {/* Alert Thresholds */}
      <div className="bg-gray-800 rounded-xl p-6">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => toggleSection('alerts')}
        >
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {expandedSections.alerts ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
            <Thermometer className="w-5 h-5 text-orange-400" />
            Alert Thresholds
          </h2>
        </div>
        {expandedSections.alerts && (
          <div className="mt-4">
            <p className="text-sm text-gray-400 mb-4">
              Configure the temperature and weather conditions that trigger alerts.
              Cold protection emails are sent 1 hour before sunset when plants need covering.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {alertSettings.map(key => renderSettingCard(key))}
            </div>
          </div>
        )}
      </div>

      {/* Notification Categories */}
      <div className="bg-gray-800 rounded-xl p-6">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => toggleSection('notifications')}
        >
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {expandedSections.notifications ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
            <Bell className="w-5 h-5 text-yellow-400" />
            Notification Categories
          </h2>
        </div>
        {expandedSections.notifications && (
          <div className="mt-4">
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
        )}
      </div>

      {/* Reminder Alert Intervals */}
      <div className="bg-gray-800 rounded-xl p-6">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => toggleSection('reminders')}
        >
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {expandedSections.reminders ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
            <Clock className="w-5 h-5 text-cyan-400" />
            Reminder Alert Intervals
          </h2>
        </div>
        {expandedSections.reminders && (
          <div className="mt-4">
            <p className="text-sm text-gray-400 mb-4">
              Choose when to receive email reminders for tasks and events.
              Select multiple intervals to get multiple reminders.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {alertIntervalOptions.map(option => {
                const currentAlerts = parseReminderAlerts(settings['default_reminder_alerts']?.value || '')
                const isSelected = currentAlerts.includes(option.value)
                return (
                  <button
                    key={option.value}
                    onClick={() => handleAlertIntervalToggle(option.value)}
                    className={`p-3 rounded-lg border-2 transition-all text-sm font-medium ${
                      isSelected
                        ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300'
                        : 'bg-gray-700/50 border-gray-600 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
            {settings['default_reminder_alerts']?.value !== originalSettings['default_reminder_alerts']?.value && (
              <p className="text-xs text-farm-green mt-3">Modified - click Save Changes to apply</p>
            )}
            <p className="text-xs text-gray-500 mt-3">
              Current: {settings['default_reminder_alerts']?.value || 'none'} (minutes before due)
            </p>
          </div>
        )}
      </div>

      {/* Calendar Sync (Admin Only) */}
      {isAdmin && (
        <div className="bg-gray-800 rounded-xl p-6">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('calendar')}
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {expandedSections.calendar ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
              <Calendar className="w-5 h-5 text-green-400" />
              Calendar Sync
            </h2>
            {expandedSections.calendar && (
              <button
                onClick={(e) => { e.stopPropagation(); handleCalendarSync(); }}
                disabled={syncingCalendar}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:cursor-not-allowed rounded-lg transition-colors text-sm"
              >
                <RefreshCw className={`w-4 h-4 ${syncingCalendar ? 'animate-spin' : ''}`} />
                {syncingCalendar ? 'Syncing...' : 'Test Sync'}
              </button>
            )}
          </div>
          {expandedSections.calendar && (
            <div className="mt-4">
              <p className="text-sm text-gray-400 mb-4">
                Sync tasks with your Proton Calendar (or other CalDAV calendar).
                Tasks will appear as events and calendar events will be imported as tasks.
              </p>
              <div className="space-y-4">
                {calendarSettings.map(key => renderSettingCard(key))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Display Settings */}
      <div className="bg-gray-800 rounded-xl p-6">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => toggleSection('display')}
        >
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {expandedSections.display ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
            <RefreshCw className="w-5 h-5 text-purple-400" />
            Display Settings
          </h2>
        </div>
        {expandedSections.display && (
          <div className="mt-4">
            <p className="text-sm text-gray-400 mb-4">
              Auto-refresh is useful for kiosk displays around your property.
              Set the interval in minutes (e.g., "5" for 5 minutes). Set to "0" to disable.
            </p>
            <div className="space-y-4">
              {renderSettingCard('dashboard_refresh_interval')}
            </div>
          </div>
        )}
      </div>

      {/* Bible Settings */}
      <div className="bg-gray-800 rounded-xl p-6">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => toggleSection('bible')}
        >
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {expandedSections.bible ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
            <Book className="w-5 h-5 text-amber-400" />
            Bible Settings
          </h2>
        </div>
        {expandedSections.bible && (
          <div className="mt-4">
            <p className="text-sm text-gray-400 mb-4">
              Choose your preferred Bible translation for the daily verse displayed on the dashboard.
            </p>
            <div className="space-y-4">
              {renderSettingCard('bible_translation')}
            </div>
          </div>
        )}
      </div>

      {/* Storage Monitoring (Admin Only) */}
      {isAdmin && (
        <div className="bg-gray-800 rounded-xl p-6">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('storage')}
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {expandedSections.storage ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
              <HardDrive className="w-5 h-5 text-gray-400" />
              Storage Monitoring
            </h2>
          </div>
          {expandedSections.storage && (
            <div className="mt-4">
              {loadingStorage ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-farm-green"></div>
                </div>
              ) : storageStats ? (
                <div className="space-y-4">
                  {/* Storage Usage Progress Bar */}
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Disk Usage</span>
                      <span className={`text-sm font-bold ${
                        storageStats.alert_level === 'critical' ? 'text-red-400' :
                        storageStats.alert_level === 'warning' ? 'text-yellow-400' :
                        'text-green-400'
                      }`}>
                        {storageStats.disk_usage_percent}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-600 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          storageStats.alert_level === 'critical' ? 'bg-red-500' :
                          storageStats.alert_level === 'warning' ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(storageStats.disk_usage_percent, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-gray-400">
                      <span>Used: {storageStats.disk_used_human}</span>
                      <span>Available: {storageStats.disk_available_human}</span>
                    </div>
                  </div>

                  {/* Alert Status */}
                  {storageStats.alert_level !== 'ok' && (
                    <div className={`flex items-center gap-2 p-3 rounded-lg ${
                      storageStats.alert_level === 'critical' ? 'bg-red-900/30 border border-red-800 text-red-300' :
                      'bg-yellow-900/30 border border-yellow-800 text-yellow-300'
                    }`}>
                      <AlertTriangle className="w-5 h-5" />
                      <span className="text-sm">
                        {storageStats.alert_level === 'critical'
                          ? 'Storage critically low! Free up space immediately.'
                          : 'Storage running low. Consider clearing logs or old data.'}
                      </span>
                    </div>
                  )}

                  {/* Isaac App Breakdown */}
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <h3 className="text-sm font-medium mb-3">Isaac Storage Breakdown</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Database</span>
                        <span>{storageStats.database_human}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Log Files</span>
                        <span>{storageStats.logs_human}</span>
                      </div>
                    </div>
                  </div>

                  {/* Clear Logs Button */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleClearLogs}
                      disabled={clearingLogs}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:cursor-not-allowed rounded-lg transition-colors text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      {clearingLogs ? 'Clearing...' : 'Clear Logs'}
                    </button>
                    <button
                      onClick={fetchStorageStats}
                      disabled={loadingStorage}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors text-sm"
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingStorage ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  </div>

                  {/* Alert Thresholds */}
                  <div className="border-t border-gray-700 pt-4 mt-4">
                    <h3 className="text-sm font-medium mb-3">Alert Thresholds</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {storageSettings.map(key => renderSettingCard(key))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-400 text-sm">Failed to load storage information</p>
              )}
            </div>
          )}
        </div>
      )}

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
