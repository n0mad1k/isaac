import React, { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Save, RotateCcw, Mail, Thermometer, RefreshCw, Send, Calendar, Bell, PawPrint, Leaf, Wrench, Clock, Eye, EyeOff, Book, Users, UserPlus, Shield, Trash2, ToggleLeft, ToggleRight, Edit2, Key, X, Check, ShieldCheck, ChevronDown, ChevronRight, Plus, MapPin, Cloud, Server, HardDrive, AlertTriangle, MessageSquare, ExternalLink, Sun, Moon } from 'lucide-react'
import { getSettings, updateSetting, resetSetting, resetAllSettings, testColdProtectionEmail, testCalendarSync, getUsers, createUser, updateUser, updateUserRole, toggleUserStatus, deleteUser, resetUserPassword, inviteUser, resendInvite, getRoles, createRole, updateRole, deleteRole, getPermissionCategories, getStorageStats, clearLogs, getVersionInfo, updateApplication, pushToProduction, pullFromProduction, checkFeedbackEnabled, getMyFeedback, updateMyFeedback, deleteMyFeedback, submitFeedback } from '../services/api'
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
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', display_name: '', role: 'viewer', is_kiosk: false, is_farmhand: false, expires_at: '' })
  const [editingUser, setEditingUser] = useState(null)
  const [editUserData, setEditUserData] = useState({})
  const [resetPasswordUser, setResetPasswordUser] = useState(null)
  const [newPassword, setNewPassword] = useState('')

  // Invite user state
  const [showInviteUser, setShowInviteUser] = useState(false)
  const [inviteData, setInviteData] = useState({ email: '', display_name: '', role: 'viewer', expires_at: '' })
  const [sendingInvite, setSendingInvite] = useState(false)
  const [resendingInviteId, setResendingInviteId] = useState(null)

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

  // Version state
  const [versionInfo, setVersionInfo] = useState(null)
  const [loadingVersion, setLoadingVersion] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [pushingToProd, setPushingToProd] = useState(false)
  const [pushToProdResult, setPushToProdResult] = useState(null)
  const [pullingFromProd, setPullingFromProd] = useState(false)
  const [pullFromProdResult, setPullFromProdResult] = useState(null)
  const [showChangelog, setShowChangelog] = useState(false)

  // My Feedback state
  const [myFeedback, setMyFeedback] = useState([])
  const [loadingFeedback, setLoadingFeedback] = useState(false)
  const [feedbackEnabled, setFeedbackEnabled] = useState(false)
  const [editingFeedback, setEditingFeedback] = useState(null)
  const [savingFeedback, setSavingFeedback] = useState(false)
  const [showNewFeedback, setShowNewFeedback] = useState(false)
  const [newFeedback, setNewFeedback] = useState({ title: '', description: '', feedback_type: 'feature', submitted_by: '' })
  const [submittingFeedback, setSubmittingFeedback] = useState(false)

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
    cloudflare: false,
    display: false,
    bible: false,
    storage: false,
    myFeedback: false
  })

  // Fields that should be treated as passwords
  const passwordFields = ['calendar_password', 'smtp_password', 'awn_api_key', 'awn_app_key', 'cloudflare_api_token']

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
    fetchVersionInfo()
  }, [])

  // Fetch users and roles (admin only)
  useEffect(() => {
    if (isAdmin) {
      fetchUsers()
      fetchRoles()
      fetchPermissionCategories()
    }
  }, [isAdmin])

  // Check if feedback is enabled and fetch user's feedback
  useEffect(() => {
    const checkAndFetchFeedback = async () => {
      try {
        const response = await checkFeedbackEnabled()
        setFeedbackEnabled(response.data.enabled)
        if (response.data.enabled) {
          fetchMyFeedback()
        }
      } catch (e) {
        setFeedbackEnabled(false)
      }
    }
    checkAndFetchFeedback()
  }, [])

  // Fetch feedback when section expands
  useEffect(() => {
    if (expandedSections.myFeedback && feedbackEnabled) {
      fetchMyFeedback()
    }
  }, [expandedSections.myFeedback])

  const fetchMyFeedback = async () => {
    setLoadingFeedback(true)
    try {
      const response = await getMyFeedback()
      setMyFeedback(response.data)
    } catch (error) {
      console.error('Failed to fetch feedback:', error)
    } finally {
      setLoadingFeedback(false)
    }
  }

  const handleSaveFeedback = async (id) => {
    setSavingFeedback(true)
    try {
      await updateMyFeedback(id, {
        title: editingFeedback.title,
        description: editingFeedback.description,
        feedback_type: editingFeedback.feedback_type
      })
      setEditingFeedback(null)
      fetchMyFeedback()
      setMessage({ type: 'success', text: 'Feedback updated' })
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to update feedback' })
    } finally {
      setSavingFeedback(false)
    }
  }

  const handleDeleteFeedback = async (id) => {
    if (!confirm('Delete this feedback?')) return
    try {
      await deleteMyFeedback(id)
      fetchMyFeedback()
      setMessage({ type: 'success', text: 'Feedback deleted' })
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to delete feedback' })
    }
  }

  const handleSubmitNewFeedback = async () => {
    if (!newFeedback.title.trim()) {
      setMessage({ type: 'error', text: 'Please enter a title for your feedback' })
      return
    }
    setSubmittingFeedback(true)
    try {
      await submitFeedback(newFeedback)
      setNewFeedback({ title: '', description: '', feedback_type: 'feature', submitted_by: '' })
      setShowNewFeedback(false)
      fetchMyFeedback()
      setMessage({ type: 'success', text: 'Feedback submitted successfully!' })
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to submit feedback' })
    } finally {
      setSubmittingFeedback(false)
    }
  }

  const fetchVersionInfo = async () => {
    setLoadingVersion(true)
    try {
      const response = await getVersionInfo()
      setVersionInfo(response.data)
    } catch (error) {
      console.error('Failed to fetch version info:', error)
    } finally {
      setLoadingVersion(false)
    }
  }

  const handleUpdate = async () => {
    if (!confirm('This will pull the latest changes. Continue?')) return
    setUpdating(true)
    try {
      const response = await updateApplication()
      if (response.data.success) {
        setMessage({ type: 'success', text: response.data.message })
        fetchVersionInfo() // Refresh version info
      } else {
        setMessage({ type: 'error', text: response.data.message || 'Update failed' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Update failed: ' + (error.response?.data?.detail || error.message) })
    } finally {
      setUpdating(false)
    }
  }

  const handlePushToProd = async () => {
    if (!confirm('This will push all committed changes to production. Continue?')) return
    setPushingToProd(true)
    setPushToProdResult(null)
    try {
      const response = await pushToProduction()
      setPushToProdResult(response.data)
      if (response.data.success) {
        setMessage({ type: 'success', text: response.data.message })
      } else {
        setMessage({ type: 'error', text: response.data.message || 'Push to production failed' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Push failed: ' + (error.response?.data?.detail || error.message) })
    } finally {
      setPushingToProd(false)
    }
  }

  const handlePullFromProd = async () => {
    if (!confirm('This will replace dev database with production data. All dev data will be lost. Continue?')) return
    setPullingFromProd(true)
    setPullFromProdResult(null)
    try {
      const response = await pullFromProduction()
      setPullFromProdResult(response.data)
      if (response.data.success) {
        setMessage({ type: 'success', text: response.data.message })
        // Refresh page after successful pull since backend restarted
        setTimeout(() => window.location.reload(), 2000)
      } else {
        setMessage({ type: 'error', text: response.data.message || 'Pull from production failed' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Pull failed: ' + (error.response?.data?.detail || error.message) })
    } finally {
      setPullingFromProd(false)
    }
  }

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
      // Convert empty expires_at to null
      const userData = {
        ...newUser,
        expires_at: newUser.expires_at || null
      }
      await createUser(userData)
      setMessage({ type: 'success', text: 'User created successfully' })
      setTimeout(() => setMessage(null), 3000)
      setShowAddUser(false)
      setNewUser({ username: '', email: '', password: '', display_name: '', role: 'viewer', is_kiosk: false, is_farmhand: false, expires_at: '' })
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

  const handleResendInvite = async (userId, email) => {
    setResendingInviteId(userId)
    try {
      await resendInvite(userId)
      setMessage({ type: 'success', text: `Invitation resent to ${email}` })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Failed to resend invitation:', error)
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to resend invitation' })
    } finally {
      setResendingInviteId(null)
    }
  }

  const startEditingUser = (u) => {
    setEditingUser(u.id)
    setEditUserData({
      username: u.username,
      email: u.email || '',
      display_name: u.display_name || '',
      role: u.role,
      is_kiosk: u.is_kiosk || false,
      is_farmhand: u.is_farmhand || false
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

    // Apply theme change immediately for instant feedback
    if (key === 'theme') {
      const root = document.documentElement
      root.classList.remove('light', 'dark')
      root.classList.add(value)
      localStorage.setItem('isaac-theme', value)
    }

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

      // Check if theme was changed
      const themeChanged = changedKeys.includes('theme')

      // Update each changed setting
      for (const key of changedKeys) {
        await updateSetting(key, settings[key].value)
      }

      // If theme was changed, do a hard reload to apply all CSS changes
      if (themeChanged) {
        setMessage({ type: 'success', text: 'Theme saved! Reloading...' })
        setTimeout(() => window.location.reload(), 500)
        return
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
  const cloudflareSettings = ['cloudflare_api_token', 'cloudflare_account_id', 'cloudflare_app_id']
  const storageSettings = ['storage_warning_percent', 'storage_critical_percent']
  const displaySettings = ['dashboard_refresh_interval', 'hide_completed_today', 'time_format', 'worker_tasks_enabled']

  // Simplified notification categories - one setting per category
  const notifyCategories = [
    {
      key: 'notify_animal_care',
      label: 'Animal Care Tasks',
      description: 'Vet appointments, vaccinations, worming, hoof trim, etc.',
      icon: 'PawPrint',
      color: 'text-blue-400'
    },
    {
      key: 'notify_plant_care',
      label: 'Plant Care Tasks',
      description: 'Watering, fertilizing, harvesting, pruning reminders',
      icon: 'Leaf',
      color: 'text-green-400'
    },
    {
      key: 'notify_maintenance',
      label: 'Maintenance Tasks',
      description: 'Home, vehicle, equipment maintenance reminders',
      icon: 'Wrench',
      color: 'text-orange-400'
    },
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
    const isPasswordField = passwordFields.includes(key)
    const isTimeField = key.includes('_time') && key !== 'time_format' // e.g., email_digest_time

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

    // Determine input type
    let inputType = 'text'
    if (isPasswordField && !showPasswords[key]) {
      inputType = 'password'
    } else if (isTimeField) {
      inputType = 'time'
    }

    return (
      <div className="flex items-center gap-2">
        <div className="relative w-full">
          <input
            type={inputType}
            value={setting.value || ''}
            onChange={(e) => handleChange(key, e.target.value)}
            className={`px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green ${isTimeField ? 'w-auto' : 'w-full pr-10'}`}
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

  // Render simplified notification category card
  const renderNotifyCard = (category) => {
    const setting = settings[category.key]
    const channels = parseChannels(setting?.value || '')
    const isChanged = setting?.value !== originalSettings[category.key]?.value
    const IconComponent = category.icon === 'PawPrint' ? PawPrint : category.icon === 'Leaf' ? Leaf : Wrench

    return (
      <div key={category.key} className={`p-4 rounded-lg border ${isChanged ? 'bg-farm-green/10 border-farm-green/30' : 'bg-gray-700/30 border-gray-700'}`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-gray-700 ${category.color}`}>
              <IconComponent className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-medium text-white flex items-center gap-2">
                {category.label}
                {isChanged && <span className="text-xs text-farm-green">*</span>}
              </h3>
              <p className="text-xs text-gray-400">{category.description}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6 ml-12">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={channels.dashboard}
              onChange={() => handleChannelToggle(category.key, 'dashboard')}
              className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-farm-green focus:ring-farm-green"
            />
            <span className="text-sm text-gray-300">Dashboard</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={channels.email}
              onChange={() => handleChannelToggle(category.key, 'email')}
              className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-farm-green focus:ring-farm-green"
            />
            <span className="text-sm text-gray-300">Email</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={channels.calendar}
              onChange={() => handleChannelToggle(category.key, 'calendar')}
              className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-farm-green focus:ring-farm-green"
            />
            <span className="text-sm text-gray-300">Calendar</span>
          </label>
        </div>
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
              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowAddUser(!showAddUser); setShowInviteUser(false); }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors text-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  Add User
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowInviteUser(!showInviteUser); setShowAddUser(false); }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors text-sm"
                >
                  <Mail className="w-4 h-4" />
                  Invite via Email
                </button>
              </div>
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
                <div className="md:col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newUser.is_farmhand}
                      onChange={(e) => setNewUser({ ...newUser, is_farmhand: e.target.checked })}
                      className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-gray-800"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-300">Farm Hand Account</span>
                      <p className="text-xs text-gray-500">Limited dashboard - only sees tasks marked "visible to farm hands"</p>
                    </div>
                  </label>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Account Expires (optional)</label>
                  <input
                    type="datetime-local"
                    value={newUser.expires_at}
                    onChange={(e) => setNewUser({ ...newUser, expires_at: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-farm-green focus:ring-1 focus:ring-farm-green outline-none text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Account will auto-disable after this date/time</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors text-sm"
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

          {/* Invite User Form */}
          {showInviteUser && (
            <form onSubmit={async (e) => {
              e.preventDefault()
              if (sendingInvite) return // Prevent double submission
              setSendingInvite(true)
              try {
                await inviteUser({
                  email: inviteData.email,
                  display_name: inviteData.display_name || null,
                  role: inviteData.role,
                  expires_at: inviteData.expires_at || null,
                })
                setMessage({ type: 'success', text: `Invitation sent to ${inviteData.email}` })
                setShowInviteUser(false)
                setInviteData({ email: '', display_name: '', role: 'viewer', expires_at: '' })
                // Refresh user list
                const res = await getUsers()
                setUsers(res.data)
              } catch (error) {
                setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to send invitation' })
              } finally {
                setSendingInvite(false)
              }
            }} className="mb-6 p-4 bg-cyan-900/30 border border-cyan-700 rounded-lg space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-medium text-cyan-300">Invite User via Email</h3>
              </div>
              <p className="text-sm text-gray-400">
                Send an invitation email. The user will choose their own username and password.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Email *</label>
                  <input
                    type="email"
                    value={inviteData.email}
                    onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    required
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={inviteData.display_name}
                    onChange={(e) => setInviteData({ ...inviteData, display_name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
                  <select
                    value={inviteData.role}
                    onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {roles.map(role => (
                      <option key={role.name} value={role.name}>
                        {role.display_name} - {role.description}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Account Expires (optional)</label>
                  <input
                    type="datetime-local"
                    value={inviteData.expires_at}
                    onChange={(e) => setInviteData({ ...inviteData, expires_at: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={sendingInvite}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors text-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {sendingInvite ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Invitation
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowInviteUser(false)}
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
                    className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg transition-colors"
                  >
                    Reset Password
                  </button>
                  <button
                    onClick={() => { setResetPasswordUser(null); setNewPassword(''); }}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
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
                        <div className="md:col-span-2 flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editUserData.is_kiosk || false}
                              onChange={(e) => setEditUserData({ ...editUserData, is_kiosk: e.target.checked })}
                              className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-farm-green focus:ring-farm-green focus:ring-offset-gray-800"
                            />
                            <span className="text-xs text-gray-400">Kiosk Mode</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editUserData.is_farmhand || false}
                              onChange={(e) => setEditUserData({ ...editUserData, is_farmhand: e.target.checked })}
                              className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-gray-800"
                            />
                            <span className="text-xs text-gray-400">Farm Hand</span>
                          </label>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateUser(u.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors text-sm"
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
                            {u.is_farmhand && (
                              <span className="text-xs bg-cyan-900/50 text-cyan-400 px-2 py-0.5 rounded">Farm Hand</span>
                            )}
                            {!u.is_active && !u.invitation_token && (
                              <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded">Disabled</span>
                            )}
                            {u.invitation_token && !u.is_active && (
                              <span className="text-xs bg-cyan-900/50 text-cyan-400 px-2 py-0.5 rounded">Pending Invite</span>
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
                        {u.invitation_token && !u.is_active && (
                          <button
                            onClick={() => handleResendInvite(u.id, u.email)}
                            disabled={resendingInviteId === u.id}
                            className="p-2 text-cyan-400 hover:bg-cyan-900/30 rounded-lg transition-colors disabled:opacity-50"
                            title="Resend invitation"
                          >
                            {resendingInviteId === u.id ? (
                              <RefreshCw className="w-5 h-5 animate-spin" />
                            ) : (
                              <Send className="w-5 h-5" />
                            )}
                          </button>
                        )}
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
                className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors text-sm"
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
                      className="px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors text-sm"
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
                              {['view', 'create', 'interact', 'edit', 'delete'].map(action => (
                                <th key={action} className="text-center py-2 px-2 font-medium capitalize">{action}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(permissionCategories.categories).map(([catKey, catInfo]) => (
                              <tr key={catKey} className="border-b border-gray-700/50">
                                <td className="py-2 px-2 text-gray-300">{catInfo.label}</td>
                                {['view', 'create', 'interact', 'edit', 'delete'].map(action => (
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
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg transition-colors text-sm"
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
              Choose which notification channels to use for each type of task.
              Dashboard shows alerts on the home screen. Email sends reminder notifications.
              Calendar syncs tasks to your connected calendar.
            </p>
            <div className="space-y-3">
              {notifyCategories.map(category => renderNotifyCard(category))}
            </div>
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
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white disabled:bg-green-800 disabled:cursor-not-allowed rounded-lg transition-colors text-sm"
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

      {/* Cloudflare Access (Admin Only) */}
      {isAdmin && (
        <div className="bg-gray-800 rounded-xl p-6">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('cloudflare')}
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {expandedSections.cloudflare ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
              <Cloud className="w-5 h-5 text-orange-400" />
              Cloudflare Access
            </h2>
          </div>
          {expandedSections.cloudflare && (
            <div className="mt-4">
              <p className="text-sm text-gray-400 mb-4">
                Automatically add invited users to your Cloudflare Access policy.
                When you invite a user via email, their email will be added to the allowed list.
              </p>
              <div className="space-y-4">
                {cloudflareSettings.map(key => renderSettingCard(key))}
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

              {/* Time Format Toggle */}
              <div className="bg-gray-750 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Time Format</h3>
                    <p className="text-sm text-gray-400">Choose 12-hour (2:30 PM) or 24-hour (14:30) time format</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleChange('time_format', '12h')}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        settings.time_format?.value === '12h' || !settings.time_format?.value
                          ? 'bg-farm-green text-white'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      }`}
                    >
                      12h
                    </button>
                    <button
                      onClick={() => handleChange('time_format', '24h')}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        settings.time_format?.value === '24h'
                          ? 'bg-farm-green text-white'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      }`}
                    >
                      24h
                    </button>
                  </div>
                </div>
              </div>

              {/* Theme Toggle */}
              <div className="bg-gray-750 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Theme</h3>
                    <p className="text-sm text-gray-400">Choose between dark and light color scheme</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleChange('theme', 'dark')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        settings.theme?.value === 'dark' || !settings.theme?.value
                          ? 'bg-farm-green text-white'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      }`}
                    >
                      <Moon className="w-4 h-4" />
                      Dark
                    </button>
                    <button
                      onClick={() => handleChange('theme', 'light')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        settings.theme?.value === 'light'
                          ? 'bg-farm-green text-white'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      }`}
                    >
                      <Sun className="w-4 h-4" />
                      Light
                    </button>
                  </div>
                </div>
              </div>

              {/* Hide Completed Tasks Toggle */}
              <div className="bg-gray-750 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Hide Completed Tasks</h3>
                    <p className="text-sm text-gray-400">Hide completed tasks from Today's Schedule on the dashboard</p>
                  </div>
                  <button
                    onClick={() => handleChange('hide_completed_today', settings.hide_completed_today?.value === 'true' ? 'false' : 'true')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settings.hide_completed_today?.value === 'true'
                        ? 'bg-farm-green'
                        : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings.hide_completed_today?.value === 'true' ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Worker Tasks Page Toggle */}
              <div className="bg-gray-750 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Worker Tasks Page</h3>
                    <p className="text-sm text-gray-400">Enable the Worker Tasks page for managing external worker assignments</p>
                  </div>
                  <button
                    onClick={() => handleChange('worker_tasks_enabled', settings.worker_tasks_enabled?.value === 'true' ? 'false' : 'true')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settings.worker_tasks_enabled?.value === 'true'
                        ? 'bg-farm-green'
                        : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings.worker_tasks_enabled?.value === 'true' ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Keyboard Button Toggle (for kiosk/touch displays) */}
              <div className="bg-gray-750 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">On-Screen Keyboard Button</h3>
                    <p className="text-sm text-gray-400">Show a keyboard button in the nav bar for touch screen displays</p>
                  </div>
                  <button
                    onClick={() => handleChange('show_keyboard_button', settings.show_keyboard_button?.value === 'true' ? 'false' : 'true')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settings.show_keyboard_button?.value === 'true'
                        ? 'bg-farm-green'
                        : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings.show_keyboard_button?.value === 'true' ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
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

      {/* My Feedback */}
      {feedbackEnabled && (
        <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('myFeedback')}
          >
            <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              {expandedSections.myFeedback ? <ChevronDown className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} /> : <ChevronRight className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />}
              <MessageSquare className="w-5 h-5 text-purple-400" />
              My Feedback
            </h2>
            {myFeedback.length > 0 && (
              <span className="px-2 py-1 text-xs rounded-full" style={{ backgroundColor: 'var(--color-badge-purple-bg)', color: 'var(--color-badge-purple-text)' }}>
                {myFeedback.length}
              </span>
            )}
          </div>
          {expandedSections.myFeedback && (
            <div className="mt-4 space-y-3">
              {loadingFeedback ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: 'var(--color-primary)' }}></div>
                </div>
              ) : (
                <>
                {/* New feedback button/form */}
                {!showNewFeedback ? (
                  <button
                    onClick={() => setShowNewFeedback(true)}
                    className="w-full p-3 rounded-lg border-2 border-dashed flex items-center justify-center gap-2 transition-colors"
                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-muted)' }}
                  >
                    <Plus className="w-4 h-4" />
                    Submit New Feedback
                  </button>
                ) : (
                  <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-bg-surface-soft)', borderColor: 'var(--color-border-default)' }}>
                    <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-primary)' }}>Submit Feedback</h4>
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={newFeedback.title}
                        onChange={(e) => setNewFeedback({ ...newFeedback, title: e.target.value })}
                        placeholder="Title (required)"
                        className="w-full px-3 py-2 rounded-lg border"
                        style={{
                          backgroundColor: 'var(--color-input-bg)',
                          borderColor: 'var(--color-input-border)',
                          color: 'var(--color-input-text)'
                        }}
                      />
                      <textarea
                        value={newFeedback.description}
                        onChange={(e) => setNewFeedback({ ...newFeedback, description: e.target.value })}
                        placeholder="Description (optional)"
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg border resize-none"
                        style={{
                          backgroundColor: 'var(--color-input-bg)',
                          borderColor: 'var(--color-input-border)',
                          color: 'var(--color-input-text)'
                        }}
                      />
                      <div className="flex gap-3">
                        <select
                          value={newFeedback.feedback_type}
                          onChange={(e) => setNewFeedback({ ...newFeedback, feedback_type: e.target.value })}
                          className="px-3 py-2 rounded-lg border"
                          style={{
                            backgroundColor: 'var(--color-input-bg)',
                            borderColor: 'var(--color-input-border)',
                            color: 'var(--color-input-text)'
                          }}
                        >
                          <option value="feature">Feature Request</option>
                          <option value="bug">Bug Report</option>
                          <option value="improvement">Improvement</option>
                          <option value="other">Other</option>
                        </select>
                        <input
                          type="text"
                          value={newFeedback.submitted_by}
                          onChange={(e) => setNewFeedback({ ...newFeedback, submitted_by: e.target.value })}
                          placeholder="Your name (optional)"
                          className="flex-1 px-3 py-2 rounded-lg border"
                          style={{
                            backgroundColor: 'var(--color-input-bg)',
                            borderColor: 'var(--color-input-border)',
                            color: 'var(--color-input-text)'
                          }}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSubmitNewFeedback}
                          disabled={submittingFeedback || !newFeedback.title.trim()}
                          className="px-4 py-2 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
                          style={{ backgroundColor: 'var(--color-btn-primary-bg)', color: 'var(--color-btn-primary-text)' }}
                        >
                          {submittingFeedback ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          Submit
                        </button>
                        <button
                          onClick={() => { setShowNewFeedback(false); setNewFeedback({ title: '', description: '', feedback_type: 'feature', submitted_by: '' }) }}
                          className="px-4 py-2 rounded-lg text-sm"
                          style={{ backgroundColor: 'var(--color-btn-secondary-bg)', color: 'var(--color-btn-secondary-text)' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {myFeedback.length === 0 ? (
                  <p className="text-sm py-4" style={{ color: 'var(--color-text-muted)' }}>
                    No feedback submitted yet.
                  </p>
                ) : (
                myFeedback.map(fb => (
                  <div key={fb.id} className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg-surface-soft)' }}>
                    {editingFeedback?.id === fb.id ? (
                      // Edit mode
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={editingFeedback.title}
                          onChange={(e) => setEditingFeedback({ ...editingFeedback, title: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border"
                          style={{
                            backgroundColor: 'var(--color-input-bg)',
                            borderColor: 'var(--color-input-border)',
                            color: 'var(--color-input-text)'
                          }}
                        />
                        <textarea
                          value={editingFeedback.description || ''}
                          onChange={(e) => setEditingFeedback({ ...editingFeedback, description: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 rounded-lg border resize-none"
                          style={{
                            backgroundColor: 'var(--color-input-bg)',
                            borderColor: 'var(--color-input-border)',
                            color: 'var(--color-input-text)'
                          }}
                        />
                        <select
                          value={editingFeedback.feedback_type}
                          onChange={(e) => setEditingFeedback({ ...editingFeedback, feedback_type: e.target.value })}
                          className="px-3 py-2 rounded-lg border"
                          style={{
                            backgroundColor: 'var(--color-input-bg)',
                            borderColor: 'var(--color-input-border)',
                            color: 'var(--color-input-text)'
                          }}
                        >
                          <option value="feature">Feature Request</option>
                          <option value="bug">Bug Report</option>
                          <option value="improvement">Improvement</option>
                          <option value="other">Other</option>
                        </select>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveFeedback(fb.id)}
                            disabled={savingFeedback}
                            className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-1"
                            style={{ backgroundColor: 'var(--color-btn-primary-bg)', color: 'var(--color-btn-primary-text)' }}
                          >
                            <Check className="w-4 h-4" />
                            Save
                          </button>
                          <button
                            onClick={() => setEditingFeedback(null)}
                            className="px-3 py-1.5 rounded-lg text-sm"
                            style={{ backgroundColor: 'var(--color-btn-secondary-bg)', color: 'var(--color-btn-secondary-text)' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{fb.title}</span>
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                fb.feedback_type === 'bug' ? 'bg-red-600' :
                                fb.feedback_type === 'feature' ? 'bg-blue-600' :
                                fb.feedback_type === 'improvement' ? 'bg-green-600' : 'bg-gray-600'
                              } text-white`}>
                                {fb.feedback_type}
                              </span>
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                fb.status === 'new' ? 'bg-yellow-600' :
                                fb.status === 'approved' ? 'bg-green-600' :
                                fb.status === 'declined' ? 'bg-red-600' :
                                fb.status === 'kickback' ? 'bg-orange-600' :
                                fb.status === 'pulled' ? 'bg-purple-600' : 'bg-gray-600'
                              } text-white`}>
                                {fb.status === 'new' ? 'Pending Review' :
                                 fb.status === 'approved' ? 'Approved' :
                                 fb.status === 'declined' ? 'Declined' :
                                 fb.status === 'kickback' ? 'Needs Info' :
                                 fb.status === 'pulled' ? 'In Progress' : fb.status}
                              </span>
                            </div>
                            {fb.description && (
                              <p className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>{fb.description}</p>
                            )}
                            {/* Show admin response for declined/kickback */}
                            {fb.admin_response && (
                              <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg-surface-muted)' }}>
                                <p className="text-xs font-medium mb-1" style={{ color: fb.status === 'kickback' ? 'var(--color-warning-text)' : 'var(--color-error-text)' }}>
                                  {fb.status === 'kickback' ? 'More info requested:' : 'Response:'}
                                </p>
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{fb.admin_response}</p>
                              </div>
                            )}
                            <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                              Submitted {new Date(fb.created_at).toLocaleDateString()}
                              {fb.submitted_by && ` by ${fb.submitted_by}`}
                            </p>
                          </div>
                          {(fb.status === 'new' || fb.status === 'kickback') && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => setEditingFeedback(fb)}
                                className="p-1.5 rounded hover:bg-gray-600"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                              </button>
                              <button
                                onClick={() => handleDeleteFeedback(fb.id)}
                                className="p-1.5 rounded hover:bg-red-600/30"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
              </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Feedback & Support */}
      <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4" style={{ color: 'var(--color-text-primary)' }}>
          <MessageSquare className="w-5 h-5 text-pink-400" />
          Feedback & Support
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
          Found a bug? Have a feature request? We'd love to hear from you!
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href="https://github.com/n0mad1k/isaac/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-lg transition-colors group"
            style={{ backgroundColor: 'var(--color-bg-surface-soft)' }}
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-surface-muted)' }}>
              <ExternalLink className="w-5 h-5" style={{ color: 'var(--color-text-primary)' }} />
            </div>
            <div>
              <div className="font-medium flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                GitHub Issues
                <ExternalLink className="w-3 h-3" style={{ color: 'var(--color-text-muted)' }} />
              </div>
              <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Report bugs or request features</div>
            </div>
          </a>
          <a
            href="mailto:isaac.clx8c@simplelogin.com?subject=Isaac%20Feedback"
            className="flex items-center gap-3 p-4 rounded-lg transition-colors group"
            style={{ backgroundColor: 'var(--color-bg-surface-soft)' }}
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-surface-muted)' }}>
              <Mail className="w-5 h-5" style={{ color: 'var(--color-text-primary)' }} />
            </div>
            <div>
              <div className="font-medium" style={{ color: 'var(--color-text-primary)' }}>Email Feedback</div>
              <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>isaac.clx8c@simplelogin.com</div>
            </div>
          </a>
        </div>
      </div>

      {/* Version & Updates */}
      <div className="bg-gray-800/50 rounded-xl p-6">
        <h3 className="font-medium text-white mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-purple-400" />
          Version & Updates
        </h3>

        {loadingVersion ? (
          <div className="text-gray-400">Loading version info...</div>
        ) : versionInfo ? (
          <div className="space-y-4">
            {/* Current Version */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-white">v{versionInfo.version}</div>
                <div className="text-sm text-gray-400">
                  {versionInfo.git?.branch && (
                    <span className="mr-3">Branch: {versionInfo.git.branch}</span>
                  )}
                  {versionInfo.git?.commit && (
                    <span className="text-gray-500">({versionInfo.git.commit})</span>
                  )}
                </div>
                {versionInfo.git?.commit_date && (
                  <div className="text-xs text-gray-500 mt-1">
                    Last updated: {new Date(versionInfo.git.commit_date).toLocaleDateString()}
                  </div>
                )}
              </div>

              {/* Update Button */}
              <div className="flex flex-col items-end gap-2">
                {versionInfo.git?.has_updates && (
                  <span className="px-2 py-1 bg-green-600/30 text-green-400 text-xs rounded-full">
                    {versionInfo.git.commits_behind} update{versionInfo.git.commits_behind > 1 ? 's' : ''} available
                  </span>
                )}
                <button
                  onClick={handleUpdate}
                  disabled={updating || !versionInfo.git?.has_updates}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    versionInfo.git?.has_updates
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <RefreshCw className={`w-4 h-4 ${updating ? 'animate-spin' : ''}`} />
                  {updating ? 'Updating...' : versionInfo.git?.has_updates ? 'Update Now' : 'Up to Date'}
                </button>
              </div>
            </div>

            {/* Push to Production (Dev Instance Only) */}
            {versionInfo.is_dev_instance && (
              <div className="p-4 bg-orange-900/20 border border-orange-600/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-orange-400 flex items-center gap-2">
                      <Server className="w-4 h-4" />
                      Development Instance
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                      Push committed changes to production (levi.local)
                    </div>
                  </div>
                  <button
                    onClick={handlePushToProd}
                    disabled={pushingToProd}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
                  >
                    <Send className={`w-4 h-4 ${pushingToProd ? 'animate-pulse' : ''}`} />
                    {pushingToProd ? 'Pushing...' : 'Push to Production'}
                  </button>
                </div>

                {/* Push Result Steps */}
                {pushToProdResult?.steps?.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {pushToProdResult.steps.map((step, i) => (
                      <div key={i} className={`text-sm flex items-center gap-2 ${
                        step.status === 'ok' ? 'text-green-400' :
                        step.status === 'error' ? 'text-red-400' :
                        'text-yellow-400'
                      }`}>
                        {step.status === 'ok' ? <Check className="w-3 h-3" /> :
                         step.status === 'error' ? <X className="w-3 h-3" /> :
                         <AlertTriangle className="w-3 h-3" />}
                        {step.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Pull from Production (Dev Instance Only) */}
            {versionInfo.is_dev_instance && (
              <div className="p-4 bg-cyan-900/20 border border-cyan-600/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-cyan-400 flex items-center gap-2">
                      <HardDrive className="w-4 h-4" />
                      Pull Data from Production
                    </div>
                    <div className="text-sm text-gray-400">Copy production database to dev (clears sync data to prevent duplicates)</div>
                  </div>
                  <button
                    onClick={handlePullFromProd}
                    disabled={pullingFromProd}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
                  >
                    <HardDrive className={`w-4 h-4 ${pullingFromProd ? 'animate-pulse' : ''}`} />
                    {pullingFromProd ? 'Pulling...' : 'Pull from Production'}
                  </button>
                </div>

                {/* Pull Result Steps */}
                {pullFromProdResult?.steps?.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {pullFromProdResult.steps.map((step, i) => (
                      <div key={i} className={`text-sm flex items-center gap-2 ${
                        step.status === 'ok' ? 'text-green-400' :
                        step.status === 'error' ? 'text-red-400' :
                        step.status === 'skipped' ? 'text-gray-400' :
                        'text-yellow-400'
                      }`}>
                        {step.status === 'ok' ? <Check className="w-3 h-3" /> :
                         step.status === 'error' ? <X className="w-3 h-3" /> :
                         step.status === 'skipped' ? <RotateCcw className="w-3 h-3" /> :
                         <AlertTriangle className="w-3 h-3" />}
                        {step.step}: {step.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* What's New in This Version */}
            {versionInfo.recent_changes?.length > 0 && (
              <div className="p-4 bg-gray-900/30 rounded-lg">
                <div className="text-sm font-medium text-gray-300 mb-2">What's New in v{versionInfo.version}</div>
                <ul className="space-y-1">
                  {versionInfo.recent_changes.map((change, i) => (
                    <li key={i} className="text-sm text-gray-400 flex items-start gap-2">
                      <span className="text-green-400 mt-1">•</span>
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Changelog Toggle */}
            <div>
              <button
                onClick={() => setShowChangelog(!showChangelog)}
                className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
              >
                {showChangelog ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                View Full Changelog
              </button>

              {showChangelog && versionInfo.changelog && (
                <div className="mt-3 p-4 bg-gray-900/50 rounded-lg max-h-96 overflow-y-auto">
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                    {versionInfo.changelog}
                  </pre>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-gray-500">Version information unavailable</div>
        )}
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
