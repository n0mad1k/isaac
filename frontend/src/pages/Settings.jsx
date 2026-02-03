import React, { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Save, RotateCcw, Mail, Thermometer, RefreshCw, Send, Calendar, Bell, PawPrint, Leaf, Wrench, Clock, Eye, EyeOff, Book, Users, UserPlus, Shield, Trash2, ToggleLeft, ToggleRight, Edit2, Key, X, Check, ShieldCheck, ChevronDown, ChevronRight, Plus, MapPin, Cloud, Server, HardDrive, AlertTriangle, MessageSquare, ExternalLink, Sun, Moon, Languages, UsersRound, Target, FileText, Search, Upload, Image, Bot } from 'lucide-react'
import { getSettings, updateSetting, resetSetting, resetAllSettings, testColdProtectionEmail, testCalendarSync, getUsers, createUser, updateUser, updateUserRole, toggleUserStatus, deleteUser, resetUserPassword, inviteUser, resendInvite, getRoles, createRole, updateRole, deleteRole, getPermissionCategories, getStorageStats, clearLogs, getVersionInfo, updateApplication, pushToProduction, pullFromProduction, checkFeedbackEnabled, getMyFeedback, updateMyFeedback, deleteMyFeedback, submitFeedback, getLogFiles, getAppLogs, clearAppLogs, uploadTeamLogo, runHealthCheck, getHealthLogs, getHealthSummary, clearHealthLogs, getAllInsights, createInsight, updateInsight, deleteInsight, regenerateInsights } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import MottoDisplay from '../components/MottoDisplay'

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

  // Application Logs state
  const [appLogs, setAppLogs] = useState([])
  const [logFiles, setLogFiles] = useState([])
  const [selectedLogFile, setSelectedLogFile] = useState('app')
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [logFilter, setLogFilter] = useState({ level: '', search: '', lines: 100 })
  const [clearingAppLogs, setClearingAppLogs] = useState(false)

  // Health Monitor state
  const [healthSummary, setHealthSummary] = useState(null)
  const [healthLogs, setHealthLogs] = useState([])
  const [loadingHealth, setLoadingHealth] = useState(false)
  const [runningHealthCheck, setRunningHealthCheck] = useState(false)
  const [healthFilter, setHealthFilter] = useState({ status: '', limit: 50 })
  const [expandedLogs, setExpandedLogs] = useState({})

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
  const [newFeedback, setNewFeedback] = useState({ title: '', description: '', feedback_type: 'feature' })
  const [submittingFeedback, setSubmittingFeedback] = useState(false)

  // AI Insights state
  const [insights, setInsights] = useState([])
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [regeneratingInsights, setRegeneratingInsights] = useState(false)
  const [editingInsight, setEditingInsight] = useState(null)
  const [showNewInsight, setShowNewInsight] = useState(false)
  const [newInsight, setNewInsight] = useState({ domain: 'tasks', insight_type: 'analysis', title: '', content: '', priority: 'medium' })

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
    farm: false,
    team: false,
    translation: false,
    bible: false,
    featureToggles: false,
    storage: false,
    healthMonitor: false,
    logs: false,
    ai: false,
    myFeedback: true
  })
  const [teamValues, setTeamValues] = useState([])

  // Fields that should be treated as passwords
  const passwordFields = ['calendar_password', 'smtp_password', 'awn_api_key', 'awn_app_key', 'cloudflare_api_token', 'deepl_api_key', 'anthropic_api_key', 'openai_api_key']

  const fetchSettings = async () => {
    try {
      const response = await getSettings()
      setSettings(response.data.settings)
      setOriginalSettings(JSON.parse(JSON.stringify(response.data.settings)))
      setHasChanges(false)
      // Parse team_values JSON
      const teamValuesStr = response.data.settings?.team_values?.value
      if (teamValuesStr) {
        try {
          setTeamValues(JSON.parse(teamValuesStr))
        } catch (e) {
          setTeamValues([])
        }
      }
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

  // Fetch insights when AI section expands
  useEffect(() => {
    if (expandedSections.ai && isAdmin) {
      fetchInsights()
    }
  }, [expandedSections.ai])

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
      // Auto-set submitted_by to current user's display_name or username
      const feedbackData = {
        ...newFeedback,
        submitted_by: user?.display_name || user?.username || ''
      }
      await submitFeedback(feedbackData)
      setNewFeedback({ title: '', description: '', feedback_type: 'feature' })
      setShowNewFeedback(false)
      fetchMyFeedback()
      setMessage({ type: 'success', text: 'Feedback submitted successfully!' })
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to submit feedback' })
    } finally {
      setSubmittingFeedback(false)
    }
  }

  // AI Insights functions
  const fetchInsights = async () => {
    setLoadingInsights(true)
    try {
      const response = await getAllInsights(100)
      setInsights(response.data.insights || [])
    } catch (error) {
      console.error('Failed to fetch insights:', error)
    } finally {
      setLoadingInsights(false)
    }
  }

  const handleRegenerateInsights = async (type = 'all') => {
    setRegeneratingInsights(true)
    try {
      const response = await regenerateInsights(type)
      setMessage({ type: 'success', text: `Generated: ${response.data.generated?.join(', ') || 'None'}` })
      fetchInsights()
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to regenerate insights' })
    } finally {
      setRegeneratingInsights(false)
    }
  }

  const handleSaveInsight = async (id) => {
    try {
      await updateInsight(id, editingInsight)
      setEditingInsight(null)
      fetchInsights()
      setMessage({ type: 'success', text: 'Insight updated' })
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to update insight' })
    }
  }

  const handleDeleteInsight = async (id) => {
    if (!confirm('Delete this insight permanently?')) return
    try {
      await deleteInsight(id)
      fetchInsights()
      setMessage({ type: 'success', text: 'Insight deleted' })
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to delete insight' })
    }
  }

  const handleCreateInsight = async () => {
    if (!newInsight.title.trim() || !newInsight.content.trim()) {
      setMessage({ type: 'error', text: 'Please enter title and content' })
      return
    }
    try {
      await createInsight(newInsight)
      setNewInsight({ domain: 'tasks', insight_type: 'analysis', title: '', content: '', priority: 'medium' })
      setShowNewInsight(false)
      fetchInsights()
      setMessage({ type: 'success', text: 'Insight created' })
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to create insight' })
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
      // Notify Layout and other listeners that settings changed
      window.dispatchEvent(new CustomEvent('settings-changed'))
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

  // Application logs functions
  const fetchLogFilesList = async () => {
    try {
      const response = await getLogFiles()
      setLogFiles(response.data.files || [])
    } catch (error) {
      console.error('Failed to fetch log files:', error)
    }
  }

  const fetchAppLogs = async (logFile = selectedLogFile) => {
    setLoadingLogs(true)
    try {
      const response = await getAppLogs(logFilter.lines, logFilter.level || null, logFilter.search || null, logFile)
      setAppLogs(response.data.logs || [])
    } catch (error) {
      console.error('Failed to fetch logs:', error)
      setMessage({ type: 'error', text: 'Failed to fetch logs' })
    } finally {
      setLoadingLogs(false)
    }
  }

  const handleClearAppLogs = async () => {
    if (!confirm('Are you sure you want to clear the application log file? This cannot be undone.')) return
    setClearingAppLogs(true)
    try {
      await clearAppLogs()
      setMessage({ type: 'success', text: 'Application logs cleared successfully' })
      setTimeout(() => setMessage(null), 5000)
      setAppLogs([])
    } catch (error) {
      console.error('Failed to clear app logs:', error)
      setMessage({ type: 'error', text: 'Failed to clear logs' })
    } finally {
      setClearingAppLogs(false)
    }
  }

  // Health monitoring functions
  const fetchHealthData = async () => {
    setLoadingHealth(true)
    try {
      const [summaryRes, logsRes] = await Promise.all([
        getHealthSummary(),
        getHealthLogs(healthFilter.limit, healthFilter.status || null)
      ])
      setHealthSummary(summaryRes.data)
      setHealthLogs(logsRes.data.logs || [])
    } catch (error) {
      console.error('Failed to fetch health data:', error)
      setMessage({ type: 'error', text: 'Failed to fetch health data' })
    } finally {
      setLoadingHealth(false)
    }
  }

  const handleRunHealthCheck = async () => {
    setRunningHealthCheck(true)
    try {
      const response = await runHealthCheck()
      setMessage({ type: 'success', text: `Health check complete: ${response.data.overall_status}` })
      setTimeout(() => setMessage(null), 5000)
      fetchHealthData()
    } catch (error) {
      console.error('Failed to run health check:', error)
      setMessage({ type: 'error', text: 'Failed to run health check' })
    } finally {
      setRunningHealthCheck(false)
    }
  }

  const handleClearHealthLogs = async () => {
    if (!confirm('Are you sure you want to clear health logs older than 7 days?')) return
    try {
      await clearHealthLogs(7)
      setMessage({ type: 'success', text: 'Old health logs cleared' })
      setTimeout(() => setMessage(null), 5000)
      fetchHealthData()
    } catch (error) {
      console.error('Failed to clear health logs:', error)
      setMessage({ type: 'error', text: 'Failed to clear health logs' })
    }
  }

  // Fetch storage stats when section is expanded
  useEffect(() => {
    if (expandedSections.storage && !storageStats) {
      fetchStorageStats()
    }
  }, [expandedSections.storage])

  // Fetch logs when section is expanded
  useEffect(() => {
    if (expandedSections.logs) {
      if (logFiles.length === 0) {
        fetchLogFilesList()
      }
      if (appLogs.length === 0) {
        fetchAppLogs()
      }
    }
  }, [expandedSections.logs])

  // Fetch health data when section is expanded
  useEffect(() => {
    if (expandedSections.healthMonitor) {
      fetchHealthData()
    }
  }, [expandedSections.healthMonitor])

  // Group settings by category
  const locationSettings = ['timezone', 'latitude', 'longitude', 'usda_zone']
  const weatherApiSettings = ['awn_api_key', 'awn_app_key']
  const emailServerSettings = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_from']
  const emailSettings = ['email_alerts_enabled', 'email_recipients', 'email_daily_digest', 'email_digest_time']
  const alertSettings = ['frost_warning_temp', 'freeze_warning_temp', 'heat_warning_temp', 'wind_warning_speed', 'rain_warning_inches', 'cold_protection_buffer']
  const calendarSettings = ['calendar_enabled', 'calendar_url', 'calendar_username', 'calendar_password', 'calendar_name', 'calendar_sync_interval']
  const cloudflareSettings = ['cloudflare_api_token', 'cloudflare_account_id', 'cloudflare_app_id']
  const storageSettings = ['storage_warning_percent', 'storage_critical_percent']
  const displaySettings = ['dashboard_refresh_interval', 'hide_completed_today', 'time_format']
  const farmSettings = ['farm_name', 'payment_instructions']
  const teamSettings = ['team_name', 'team_mission', 'team_units', 'mentoring_day', 'aar_day']
  const aiSettings = ['ai_enabled', 'ai_provider', 'ai_proactive_insights', 'ai_can_create_tasks', 'ollama_url', 'ollama_model', 'anthropic_api_key', 'claude_model', 'openai_api_key', 'openai_model', 'ai_shared_domains', 'knowledge_base_enabled', 'ai_read_only', 'ai_require_confirmation', 'ai_blocked_topics', 'ai_max_response_tokens', 'ai_guardrails_enabled']

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

    // AI provider dropdown
    if (key === 'ai_provider') {
      return (
        <select
          value={setting.value || 'ollama'}
          onChange={(e) => handleChange(key, e.target.value)}
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green w-full"
        >
          <option value="ollama">Ollama (Self-hosted)</option>
          <option value="claude">Claude (Anthropic)</option>
          <option value="openai">OpenAI (ChatGPT)</option>
        </select>
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
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-6 ml-0 sm:ml-12">
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2 flex-shrink-0">
          <SettingsIcon className="w-7 h-7 text-gray-400" />
          Settings
        </h1>
        <MottoDisplay />
        <div className="flex items-center gap-2 flex-shrink-0">
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
        <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
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
              <div className="bg-gray-800 rounded-xl p-3 sm:p-4 md:p-6 w-full max-w-[92vw] sm:max-w-md mx-4">
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
        <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
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
                    <div key={role.id} className="bg-gray-700/30 rounded-lg p-3 sm:p-4 min-w-0">
                      <div className="flex items-center justify-between mb-3 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
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

                      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                        <table className="w-full text-xs sm:text-sm">
                          <thead>
                            <tr className="text-gray-400 border-b border-gray-600">
                              <th className="text-left py-2 px-1 sm:px-2 font-medium">Category</th>
                              {['view', 'create', 'interact', 'edit', 'delete'].map(action => (
                                <th key={action} className="text-center py-2 px-1 sm:px-2 font-medium capitalize">{action}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(permissionCategories.categories).map(([catKey, catInfo]) => (
                              <tr key={catKey} className="border-b border-gray-700/50">
                                <td className="py-1.5 sm:py-2 px-1 sm:px-2 text-gray-300 whitespace-nowrap">{catInfo.label}</td>
                                {['view', 'create', 'interact', 'edit', 'delete'].map(action => (
                                  <td key={action} className="text-center py-1.5 sm:py-2 px-1 sm:px-2">
                                    {catInfo.actions.includes(action) ? (
                                      <input
                                        type="checkbox"
                                        checked={role.permissions?.[catKey]?.[action] || false}
                                        onChange={(e) => handleUpdateRolePermission(role.id, catKey, action, e.target.checked)}
                                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded bg-gray-700 border-gray-600 text-farm-green focus:ring-farm-green focus:ring-offset-gray-800"
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

      {/* Location Settings */}
      <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
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

      {/* Weather API Settings (Admin Only) */}
      {isAdmin && (
        <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
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
        <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
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

      {/* Email Notification Settings */}
      <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
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

      {/* Alert Thresholds */}
      <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
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
      <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
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
        <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
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
        <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
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
      <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
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

              {/* Motto/Mission Statement */}
              <div className="bg-gray-750 rounded-lg p-4">
                <div>
                  <h3 className="font-medium">Motto / Mission Statement</h3>
                  <p className="text-sm text-gray-400 mb-2">A reminder displayed on every page to keep you focused on your purpose</p>
                  <textarea
                    value={settings.motto?.value || ''}
                    onChange={(e) => handleChange('motto', e.target.value)}
                    placeholder="Enter your farm's motto or mission statement..."
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-farm-green focus:ring-1 focus:ring-farm-green resize-none"
                    rows={3}
                    maxLength={500}
                  />
                  <p className="text-xs text-gray-500 mt-1 text-right">{(settings.motto?.value || '').length}/500</p>
                </div>
              </div>

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

            </div>
          </div>
        )}
      </div>

      {/* AI Assistant Settings */}
      {isAdmin && (
      <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => toggleSection('ai')}
        >
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {expandedSections.ai ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
            <Bot className="w-5 h-5 text-purple-400" />
            AI Assistant
          </h2>
        </div>
        {expandedSections.ai && (
          <div className="mt-4">
            <p className="text-sm text-gray-400 mb-4">
              Choose a provider: <strong>Ollama</strong> (self-hosted, free), <strong>Claude</strong> (<a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">console.anthropic.com</a>), or <strong>OpenAI</strong> (<a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">platform.openai.com</a>).
              Use "AI Shared Domains" to control which personal data categories the AI can access (comma-separated: garden,fitness,budget,production,animals,weather,tasks). Leave empty to share no data.
            </p>
            <div className="space-y-4">
              {aiSettings.filter(key => {
                const provider = (settings?.ai_provider?.value || 'ollama').toLowerCase()
                // Always show: ai_enabled, ai_provider, ai_proactive_insights, ai_can_create_tasks, ai_shared_domains, restriction settings
                if (['ai_enabled', 'ai_provider', 'ai_proactive_insights', 'ai_can_create_tasks', 'ai_shared_domains', 'knowledge_base_enabled', 'ai_read_only', 'ai_require_confirmation', 'ai_blocked_topics', 'ai_max_response_tokens', 'ai_guardrails_enabled'].includes(key)) return true
                // Provider-specific
                if (provider === 'ollama') return ['ollama_url', 'ollama_model'].includes(key)
                if (provider === 'claude') return ['anthropic_api_key', 'claude_model'].includes(key)
                if (provider === 'openai') return ['openai_api_key', 'openai_model'].includes(key)
                return false
              }).map(key => renderSettingCard(key))}
            </div>

            {/* AI Insights Management */}
            <div className="mt-6 border-t border-gray-700 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-md font-semibold text-purple-400">AI Insights</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowNewInsight(true)}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-sm flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> New
                  </button>
                  <button
                    onClick={() => handleRegenerateInsights('all')}
                    disabled={regeneratingInsights}
                    className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-sm flex items-center gap-1 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${regeneratingInsights ? 'animate-spin' : ''}`} />
                    {regeneratingInsights ? 'Generating...' : 'Regenerate All'}
                  </button>
                </div>
              </div>

              {/* New Insight Form */}
              {showNewInsight && (
                <div className="mb-4 p-4 bg-gray-700 rounded-lg">
                  <h4 className="font-medium mb-3">Create New Insight</h4>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Domain</label>
                      <select
                        value={newInsight.domain}
                        onChange={e => setNewInsight({ ...newInsight, domain: e.target.value })}
                        className="w-full bg-gray-600 rounded px-3 py-2 text-sm"
                      >
                        <option value="tasks">Tasks</option>
                        <option value="garden">Garden</option>
                        <option value="fitness">Fitness</option>
                        <option value="budget">Budget</option>
                        <option value="animals">Animals</option>
                        <option value="weather">Weather</option>
                        <option value="production">Production</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Priority</label>
                      <select
                        value={newInsight.priority}
                        onChange={e => setNewInsight({ ...newInsight, priority: e.target.value })}
                        className="w-full bg-gray-600 rounded px-3 py-2 text-sm"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-xs text-gray-400 mb-1">Title</label>
                    <input
                      type="text"
                      value={newInsight.title}
                      onChange={e => setNewInsight({ ...newInsight, title: e.target.value })}
                      className="w-full bg-gray-600 rounded px-3 py-2 text-sm"
                      placeholder="Insight title"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="block text-xs text-gray-400 mb-1">Content</label>
                    <textarea
                      value={newInsight.content}
                      onChange={e => setNewInsight({ ...newInsight, content: e.target.value })}
                      className="w-full bg-gray-600 rounded px-3 py-2 text-sm h-24"
                      placeholder="Insight content (supports markdown)"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setShowNewInsight(false)}
                      className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateInsight}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-sm"
                    >
                      Create
                    </button>
                  </div>
                </div>
              )}

              {/* Insights List */}
              {loadingInsights ? (
                <div className="text-center py-4 text-gray-400">Loading insights...</div>
              ) : insights.length === 0 ? (
                <div className="text-center py-4 text-gray-400">No insights yet. Click "Regenerate All" to generate.</div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {insights.map(insight => (
                    <div key={insight.id} className={`p-3 rounded-lg ${insight.is_dismissed ? 'bg-gray-800 opacity-60' : 'bg-gray-700'}`}>
                      {editingInsight?.id === insight.id ? (
                        // Editing mode
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editingInsight.title}
                            onChange={e => setEditingInsight({ ...editingInsight, title: e.target.value })}
                            className="w-full bg-gray-600 rounded px-3 py-1.5 text-sm"
                          />
                          <textarea
                            value={editingInsight.content}
                            onChange={e => setEditingInsight({ ...editingInsight, content: e.target.value })}
                            className="w-full bg-gray-600 rounded px-3 py-1.5 text-sm h-20"
                          />
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditingInsight(null)} className="px-2 py-1 text-xs bg-gray-600 rounded">Cancel</button>
                            <button onClick={() => handleSaveInsight(insight.id)} className="px-2 py-1 text-xs bg-purple-600 rounded">Save</button>
                          </div>
                        </div>
                      ) : (
                        // View mode
                        <>
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                insight.priority === 'high' ? 'bg-red-500/30 text-red-300' :
                                insight.priority === 'low' ? 'bg-gray-500/30 text-gray-300' :
                                'bg-yellow-500/30 text-yellow-300'
                              }`}>{insight.priority}</span>
                              <span className="text-xs text-gray-400">{insight.domain}</span>
                              {insight.is_dismissed && <span className="text-xs text-gray-500">(dismissed)</span>}
                              {!insight.is_read && <span className="w-2 h-2 bg-blue-400 rounded-full" title="Unread" />}
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => setEditingInsight({ ...insight })}
                                className="p-1 hover:bg-gray-600 rounded"
                                title="Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-gray-400" />
                              </button>
                              <button
                                onClick={() => handleDeleteInsight(insight.id)}
                                className="p-1 hover:bg-gray-600 rounded"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              </button>
                            </div>
                          </div>
                          <h4 className="font-medium text-sm mb-1">{insight.title}</h4>
                          <p className="text-xs text-gray-300 whitespace-pre-wrap line-clamp-3">{insight.content}</p>
                          <div className="text-xs text-gray-500 mt-1">
                            {insight.created_at && new Date(insight.created_at).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      )}

      {/* Feature Toggles */}
      <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => toggleSection('featureToggles')}
        >
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {expandedSections.featureToggles ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
            <ToggleRight className="w-5 h-5 text-cyan-400" />
            Feature Toggles
          </h2>
        </div>
        {expandedSections.featureToggles && (
          <div className="mt-4">
            <p className="text-sm text-gray-400 mb-4">
              Toggle pages on or off to customize your navigation. Disabled pages won't appear in the sidebar.
            </p>
            <div className="space-y-3">
              {[
                { key: 'page_budget_enabled', label: 'Budget', desc: 'Budget tracking and financial overview' },
                { key: 'page_calendar_enabled', label: 'Calendar', desc: 'Event calendar and scheduling' },
                { key: 'page_plants_enabled', label: 'Plants', desc: 'Plant tracking and watering schedules' },
                { key: 'page_seeds_enabled', label: 'Seeds', desc: 'Seed inventory and planting plans' },
                { key: 'page_animals_enabled', label: 'Animals', desc: 'Livestock and pet management' },
                { key: 'page_home_maintenance_enabled', label: 'Home Maintenance', desc: 'Home repairs and upkeep tracking' },
                { key: 'page_vehicles_enabled', label: 'Vehicles', desc: 'Vehicle maintenance and records' },
                { key: 'page_equipment_enabled', label: 'Equipment', desc: 'Farm and shop equipment tracking' },
                { key: 'page_farm_areas_enabled', label: 'Farm Areas', desc: 'Field and area management' },
                { key: 'page_farm_finances_enabled', label: 'Farm Finances', desc: 'Production tracking and finances' },
                { key: 'worker_tasks_enabled', label: 'Worker Tasks', desc: 'Task management for farm workers' },
                { key: 'team_enabled', label: 'Team Management', desc: 'Member dossiers, mentoring, and AAR' },
                { key: 'show_keyboard_button', label: 'On-Screen Keyboard', desc: 'Show keyboard toggle button for touch displays' },
                { key: 'show_hard_refresh_button', label: 'Hard Refresh Button', desc: 'Show hard refresh button in floating menu' },
                { key: 'customer_feedback_enabled', label: 'Feedback Button', desc: 'Enable feedback submission for users' },
              ].map(toggle => (
                <div key={toggle.key} className="bg-gray-750 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-sm">{toggle.label}</h3>
                      <p className="text-xs text-gray-400">{toggle.desc}</p>
                    </div>
                    <button
                      onClick={() => handleChange(toggle.key, settings[toggle.key]?.value === 'true' ? 'false' : 'true')}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                        settings[toggle.key]?.value !== 'false'
                          ? 'bg-farm-green'
                          : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings[toggle.key]?.value !== 'false' ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Farm Settings - Always visible */}
      <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => toggleSection('farm')}
        >
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {expandedSections.farm ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
            <Leaf className="w-5 h-5 text-green-400" />
            Farm Settings
          </h2>
        </div>
        {expandedSections.farm && (
          <div className="mt-4 space-y-6">
            <p className="text-sm text-gray-400">
              Configure your farm name and business settings. The farm name is used in emails, receipts, and notifications.
            </p>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Farm/Business Name</label>
                <input
                  type="text"
                  value={settings.farm_name?.value || ''}
                  onChange={(e) => handleChange('farm_name', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
                  placeholder="Green Acres Farm"
                />
                <p className="text-xs text-gray-400 mt-1">Used in email From headers, subject lines, receipts, and customer communications</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Payment Instructions</label>
                <textarea
                  value={settings.payment_instructions?.value || ''}
                  onChange={(e) => handleChange('payment_instructions', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 h-24"
                  placeholder="Payment accepted via Venmo @farmname, Zelle, or check made out to..."
                />
                <p className="text-xs text-gray-400 mt-1">Included in invoice emails to customers</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Team Configuration - Only show when team is enabled */}
      {settings.team_enabled?.value === 'true' && (
        <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('team')}
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {expandedSections.team ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
              <UsersRound className="w-5 h-5 text-green-400" />
              Team Configuration
            </h2>
          </div>
          {expandedSections.team && (
            <div className="mt-4 space-y-6">
              <p className="text-sm text-gray-400">
                Configure your team name, mission, values, and meeting schedule.
              </p>

              {/* Team Logo */}
              <div className="bg-gray-700/50 rounded-lg p-4">
                <label className="block text-sm font-medium mb-3">Team Logo</label>
                <div className="flex items-center gap-4">
                  {settings.team_logo?.value ? (
                    <img
                      src={`/api/team/logo/${settings.team_logo.value.split('/').pop()}`}
                      alt="Team Logo"
                      className="h-24 w-auto object-contain rounded bg-gray-800 p-2"
                    />
                  ) : (
                    <div className="h-24 w-24 bg-gray-800 rounded flex items-center justify-center text-gray-500">
                      <Image className="w-8 h-8" />
                    </div>
                  )}
                  <div className="flex-1">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors">
                      <Upload className="w-4 h-4" />
                      <span>{settings.team_logo?.value ? 'Change Logo' : 'Upload Logo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          try {
                            const formData = new FormData()
                            formData.append('file', file)
                            await uploadTeamLogo(formData)
                            loadSettings()
                            setMessage({ type: 'success', text: 'Logo uploaded successfully!' })
                          } catch (err) {
                            setMessage({ type: 'error', text: 'Failed to upload logo' })
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                    <p className="text-xs text-gray-400 mt-2">Recommended: PNG or SVG with transparent background</p>
                  </div>
                </div>
              </div>

              {/* Basic Team Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Team Name</label>
                  <input
                    type="text"
                    value={settings.team_name?.value || ''}
                    onChange={(e) => handleChange('team_name', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
                    placeholder="Smith Family"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Team Mission</label>
                  <textarea
                    value={settings.team_mission?.value || ''}
                    onChange={(e) => handleChange('team_mission', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 h-24"
                    placeholder="Build a resilient, self-sufficient homestead..."
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Units</label>
                    <select
                      value={settings.team_units?.value || 'imperial'}
                      onChange={(e) => handleChange('team_units', e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
                    >
                      <option value="imperial">Imperial (lbs, ft)</option>
                      <option value="metric">Metric (kg, cm)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Mentoring Day</label>
                    <select
                      value={settings.mentoring_day?.value || 'Sunday'}
                      onChange={(e) => handleChange('mentoring_day', e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
                    >
                      {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">AAR Day</label>
                    <select
                      value={settings.aar_day?.value || 'Saturday'}
                      onChange={(e) => handleChange('aar_day', e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
                    >
                      {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Team Values */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium flex items-center gap-2">
                    <Target className="w-4 h-4 text-farm-green" />
                    Team Values
                  </label>
                  <button
                    onClick={() => {
                      const newValues = [...teamValues, { name: '', description: '', questions: [''] }]
                      setTeamValues(newValues)
                      handleChange('team_values', JSON.stringify(newValues))
                    }}
                    className="flex items-center gap-1 text-sm text-farm-green hover:text-green-400"
                  >
                    <Plus className="w-4 h-4" /> Add Value
                  </button>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  Define your team's core values. Each value can have assessment questions for mentoring sessions.
                </p>
                <div className="space-y-4">
                  {teamValues.map((value, idx) => (
                    <div key={idx} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={value.name}
                            onChange={(e) => {
                              const newValues = [...teamValues]
                              newValues[idx].name = e.target.value
                              setTeamValues(newValues)
                              handleChange('team_values', JSON.stringify(newValues))
                            }}
                            className="bg-gray-600 border border-gray-500 rounded px-3 py-2"
                            placeholder="Value name (e.g., Faith)"
                          />
                          <input
                            type="text"
                            value={value.description}
                            onChange={(e) => {
                              const newValues = [...teamValues]
                              newValues[idx].description = e.target.value
                              setTeamValues(newValues)
                              handleChange('team_values', JSON.stringify(newValues))
                            }}
                            className="bg-gray-600 border border-gray-500 rounded px-3 py-2"
                            placeholder="Brief description"
                          />
                        </div>
                        <button
                          onClick={() => {
                            const newValues = teamValues.filter((_, i) => i !== idx)
                            setTeamValues(newValues)
                            handleChange('team_values', JSON.stringify(newValues))
                          }}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-gray-400">Assessment Questions</label>
                        {(value.questions || ['']).map((q, qIdx) => (
                          <div key={qIdx} className="flex gap-2">
                            <input
                              type="text"
                              value={q}
                              onChange={(e) => {
                                const newValues = [...teamValues]
                                newValues[idx].questions[qIdx] = e.target.value
                                setTeamValues(newValues)
                                handleChange('team_values', JSON.stringify(newValues))
                              }}
                              className="flex-1 bg-gray-600 border border-gray-500 rounded px-3 py-1.5 text-sm"
                              placeholder="Assessment question..."
                            />
                            {value.questions.length > 1 && (
                              <button
                                onClick={() => {
                                  const newValues = [...teamValues]
                                  newValues[idx].questions = newValues[idx].questions.filter((_, i) => i !== qIdx)
                                  setTeamValues(newValues)
                                  handleChange('team_values', JSON.stringify(newValues))
                                }}
                                className="text-red-400 hover:text-red-300 p-1"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const newValues = [...teamValues]
                            newValues[idx].questions = [...(newValues[idx].questions || []), '']
                            setTeamValues(newValues)
                            handleChange('team_values', JSON.stringify(newValues))
                          }}
                          className="text-xs text-gray-400 hover:text-gray-300 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Add question
                        </button>
                      </div>
                    </div>
                  ))}
                  {teamValues.length === 0 && (
                    <p className="text-sm text-gray-500 italic">No values defined. Click "Add Value" to create your first team value.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Translation Settings (Admin Only) */}
      {isAdmin && (
        <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('translation')}
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {expandedSections.translation ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
              <Languages className="w-5 h-5 text-blue-400" />
              Translation
            </h2>
          </div>
          {expandedSections.translation && (
            <div className="mt-4">
              <p className="text-sm text-gray-400 mb-4">
                Configure translation for worker task content. Tasks assigned to workers with a non-English language preference will be automatically translated using DeepL.
              </p>
              <div className="space-y-4">
                {renderSettingCard('deepl_api_key')}
                <p className="text-xs text-gray-500">
                  Get a free API key at <a href="https://www.deepl.com/pro-api" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">deepl.com/pro-api</a>. Free tier includes 500,000 characters/month.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Storage Monitoring (Admin Only) */}
      {isAdmin && (
        <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
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

      {/* Health Monitoring (Admin Only) */}
      {isAdmin && (
        <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('healthMonitor')}
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {expandedSections.healthMonitor ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
              <Server className="w-5 h-5 text-green-400" />
              Health Monitoring
            </h2>
          </div>
          {expandedSections.healthMonitor && (
            <div className="mt-4 space-y-4">
              {loadingHealth ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-farm-green"></div>
                </div>
              ) : (
                <>
                  {/* Health Summary */}
                  {healthSummary && (
                    <div className="space-y-4">
                      {/* Current Status */}
                      {healthSummary.latest && (
                        <div className="bg-gray-700/50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-white">Current Status</span>
                            <span className={`px-3 py-1.5 rounded text-xs font-bold ${
                              healthSummary.latest.overall_status === 'healthy' ? 'bg-green-700 text-white' :
                              healthSummary.latest.overall_status === 'warning' ? 'bg-amber-600 text-black' :
                              healthSummary.latest.overall_status === 'critical' ? 'bg-red-600 text-white' :
                              'bg-gray-600 text-white'
                            }`}>
                              {healthSummary.latest.overall_status?.toUpperCase()}
                            </span>
                          </div>
                          {/* Warning/Critical reason banner */}
                          {healthSummary.latest.overall_status !== 'healthy' && (() => {
                            const allCheckKeys = ['api', 'database', 'caldav', 'memory', 'disk', 'cpu', 'calendar_sync']
                            const issueChecks = allCheckKeys
                              .filter(k => healthSummary.latest[k] && (healthSummary.latest[k].status === 'warning' || healthSummary.latest[k].status === 'critical'))
                              .map(k => {
                                const data = healthSummary.latest[k]
                                const label = k === 'calendar_sync' ? 'Cal Sync' : k
                                const statusLabel = data.status === 'warning' ? '[Warning]' : '[Critical]'
                                return `${statusLabel} ${label}: ${data.message || 'No details'}`
                              })
                            return issueChecks.length > 0 ? (
                              <div className="rounded-lg px-4 py-3 mb-3" style={{
                                backgroundColor: healthSummary.latest.overall_status === 'critical' ? 'var(--color-error-bg)' :
                                  healthSummary.latest.overall_status === 'warning' ? 'var(--color-warning-bg)' : 'var(--color-bg-surface-muted)',
                                border: `1px solid ${healthSummary.latest.overall_status === 'critical' ? 'var(--color-error-border)' :
                                  healthSummary.latest.overall_status === 'warning' ? 'var(--color-warning-border)' : 'var(--color-border-default)'}`
                              }}>
                                <p className="text-sm font-bold mb-2" style={{
                                  color: healthSummary.latest.overall_status === 'critical' ? 'var(--color-error-700)' :
                                    healthSummary.latest.overall_status === 'warning' ? 'var(--color-warning-700)' : 'var(--color-text-secondary)'
                                }}>
                                  Why {healthSummary.latest.overall_status.toUpperCase()}?
                                </p>
                                {issueChecks.map((issue, i) => (
                                  <p key={i} className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                    {issue}
                                  </p>
                                ))}
                              </div>
                            ) : null
                          })()}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                            {['api', 'database', 'caldav', 'calendar_sync', 'memory', 'disk', 'cpu'].map(check => {
                              const data = healthSummary.latest[check]
                              if (!data) return null
                              const isIssue = data.status === 'warning' || data.status === 'critical'
                              const label = check === 'calendar_sync' ? 'Cal Sync' : check
                              return (
                                <div key={check} className="rounded px-3 py-2" style={{
                                  backgroundColor: 'var(--color-bg-surface)',
                                  border: isIssue ? (data.status === 'critical' ? '2px solid var(--color-error-border)' : data.status === 'warning' ? '2px solid var(--color-warning-border)' : '1px solid var(--color-border-default)') : '1px solid var(--color-border-subtle)'
                                }}>
                                  <div className="flex items-center justify-between">
                                    <span className="capitalize font-medium" style={{ color: 'var(--color-text-primary)' }}>{label}</span>
                                    <span className="text-sm font-bold" style={{
                                      color: data.status === 'healthy' ? 'var(--color-success-600)' :
                                        data.status === 'warning' ? 'var(--color-warning-700)' : 'var(--color-error-600)'
                                    }}>
                                      {data.status === 'healthy' ? '✓' : data.status === 'warning' ? '⚠' : '✗'}
                                      {data.percent !== undefined && ` ${data.percent?.toFixed(0)}%`}
                                      {data.latency_ms !== undefined && ` ${data.latency_ms?.toFixed(0)}ms`}
                                      {data.load !== undefined && ` ${data.load?.toFixed(1)}`}
                                      {check === 'calendar_sync' && data.value !== undefined && data.value !== null && ` ${data.value?.toFixed(1)}s`}
                                    </span>
                                  </div>
                                  {data.message && (
                                    <p className="mt-1 text-sm" style={{
                                      color: isIssue ? (data.status === 'critical' ? 'var(--color-error-600)' : 'var(--color-warning-700)') : 'var(--color-text-muted)',
                                      fontWeight: isIssue ? 500 : 400
                                    }}>
                                      {data.message}
                                    </p>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            Last check: {new Date(healthSummary.latest.checked_at).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      )}

                      {/* 24h Stats */}
                      <div className="bg-gray-700/50 rounded-lg p-4">
                        <h3 className="text-sm font-medium mb-3">Last 24 Hours</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-2xl font-bold text-green-400">{healthSummary.last_24h?.uptime_percent || 0}%</p>
                            <p className="text-xs text-gray-400">Uptime</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{healthSummary.last_24h?.total_checks || 0}</p>
                            <p className="text-xs text-gray-400">Total Checks</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-red-400">{healthSummary.last_24h?.by_status?.critical || 0}</p>
                            <p className="text-xs text-gray-400">Critical</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={handleRunHealthCheck}
                      disabled={runningHealthCheck}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:cursor-not-allowed rounded-lg transition-colors text-sm"
                    >
                      <RefreshCw className={`w-4 h-4 ${runningHealthCheck ? 'animate-spin' : ''}`} />
                      {runningHealthCheck ? 'Checking...' : 'Run Health Check'}
                    </button>
                    <button
                      onClick={fetchHealthData}
                      disabled={loadingHealth}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors text-sm"
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingHealth ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                    <button
                      onClick={handleClearHealthLogs}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600/50 hover:bg-red-600 rounded-lg transition-colors text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      Clear Old Logs
                    </button>
                    <button
                      onClick={() => {
                        setExpandedSections(prev => ({ ...prev, logs: true }))
                        setLogFilter(prev => ({ ...prev, level: 'ERROR' }))
                        setTimeout(() => {
                          document.getElementById('logs-section')?.scrollIntoView({ behavior: 'smooth' })
                        }, 100)
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors text-sm"
                    >
                      <FileText className="w-4 h-4" />
                      View Application Logs
                    </button>
                  </div>

                  {/* Health Logs */}
                  <div className="border-t border-gray-700 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-medium">Health Check History</h3>
                        <p className="text-xs text-gray-500">Periodic system health snapshots (not application logs)</p>
                      </div>
                      <select
                        value={healthFilter.status}
                        onChange={(e) => {
                          setHealthFilter({ ...healthFilter, status: e.target.value })
                          fetchHealthData()
                        }}
                        className="px-2 py-1 bg-gray-700 rounded text-sm"
                      >
                        <option value="">All Status</option>
                        <option value="healthy">Healthy</option>
                        <option value="warning">Warning</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {healthLogs.length === 0 ? (
                        <p className="text-gray-400 text-sm py-4 text-center">No health logs yet</p>
                      ) : (
                        healthLogs.map((log, idx) => {
                          const allChecks = ['api', 'database', 'caldav', 'calendar_sync', 'memory', 'disk', 'cpu']
                          const issues = allChecks.filter(check => log[check] && (log[check].status === 'warning' || log[check].status === 'critical'))
                          const isExpanded = expandedLogs[idx]
                          return (
                            <div key={idx} className="rounded text-sm cursor-pointer transition-colors" style={{
                              backgroundColor: 'var(--color-bg-surface)',
                              borderLeft: log.overall_status === 'warning' ? '4px solid var(--color-warning-border)' :
                                log.overall_status === 'critical' ? '4px solid var(--color-error-border)' : 'none'
                            }}
                              onClick={() => setExpandedLogs(prev => ({ ...prev, [idx]: !prev[idx] }))}
                            >
                              <div className="flex items-center justify-between px-3 py-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-gray-500 text-xs flex-shrink-0">{isExpanded ? '▼' : '▶'}</span>
                                  <span className="text-gray-300 text-xs flex-shrink-0">
                                    {new Date(log.checked_at).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {issues.length > 0 && !isExpanded && (
                                    <span className="text-xs truncate" style={{ color: 'var(--color-warning-700)' }}>
                                      {issues.map(check => {
                                        const d = log[check]
                                        return d?.message || check
                                      }).join(' | ')}
                                    </span>
                                  )}
                                </div>
                                <span className="font-medium text-xs flex-shrink-0" style={{
                                  color: log.overall_status === 'healthy' ? 'var(--color-success-600)' :
                                    log.overall_status === 'warning' ? 'var(--color-warning-700)' :
                                    log.overall_status === 'critical' ? 'var(--color-error-600)' :
                                    'var(--color-text-muted)'
                                }}>
                                  {log.overall_status?.toUpperCase()}
                                </span>
                              </div>
                              {isExpanded && (
                                <div className="px-3 pb-3 space-y-1 border-t border-gray-700/50 pt-2">
                                  {allChecks.map(check => {
                                    const data = log[check]
                                    if (!data) return null
                                    const isIssue = data.status === 'warning' || data.status === 'critical'
                                    const statusIcon = data.status === 'healthy' ? '✓' : data.status === 'warning' ? '⚠' : data.status === 'critical' ? '✗' : '?'
                                    const statusColorStyle = data.status === 'healthy' ? 'var(--color-success-600)' : data.status === 'warning' ? 'var(--color-warning-700)' : data.status === 'critical' ? 'var(--color-error-600)' : 'var(--color-text-muted)'
                                    const label = check === 'calendar_sync' ? 'Cal Sync' : check
                                    const valueStr = data.percent !== undefined ? `${data.percent?.toFixed(0)}%` : data.latency_ms !== undefined ? `${data.latency_ms?.toFixed(0)}ms` : data.load !== undefined ? `load ${data.load?.toFixed(1)}` : ''
                                    return (
                                      <div key={check} className="rounded px-3 py-2" style={{
                                        backgroundColor: isIssue ? (data.status === 'critical' ? 'var(--color-error-bg)' : 'var(--color-warning-bg)') : 'var(--color-bg-surface-soft)',
                                        border: isIssue ? (data.status === 'critical' ? '1px solid var(--color-error-border)' : '1px solid var(--color-warning-border)') : 'none'
                                      }}>
                                        <div className="flex items-center gap-2 text-sm">
                                          <span style={{ color: statusColorStyle }}>{statusIcon}</span>
                                          <span className="text-gray-200 capitalize font-medium">{label}</span>
                                          {valueStr && <span className="text-gray-400">{valueStr}</span>}
                                          {data.message && !isIssue && <span className="text-gray-500 text-xs ml-auto">{data.message}</span>}
                                        </div>
                                        {data.message && isIssue && (
                                          <p className="text-sm mt-1 ml-6" style={{ color: data.status === 'critical' ? 'var(--color-error-600)' : 'var(--color-warning-700)' }}>
                                            {data.message}
                                          </p>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Application Logs - Admin Only */}
      {isAdmin && (
        <div id="logs-section" className="rounded-xl p-4 sm:p-6" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('logs')}
          >
            <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              {expandedSections.logs ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
              <FileText className="w-5 h-5 text-blue-400" />
              Application Logs
            </h2>
          </div>
          {expandedSections.logs && (
            <div className="mt-4 space-y-4">
              {/* Log File Selector */}
              {logFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {logFiles.map(file => (
                    <button
                      key={file.id}
                      onClick={() => {
                        setSelectedLogFile(file.id)
                        fetchAppLogs(file.id)
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        selectedLogFile === file.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {file.name}
                      <span className="ml-2 text-xs opacity-70">{file.size_human}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Filters */}
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={logFilter.search}
                    onChange={(e) => setLogFilter({ ...logFilter, search: e.target.value })}
                    placeholder="Search logs..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-input-text)' }}
                    onKeyDown={(e) => e.key === 'Enter' && fetchAppLogs()}
                  />
                </div>
                <select
                  value={logFilter.level}
                  onChange={(e) => setLogFilter({ ...logFilter, level: e.target.value })}
                  className="px-3 py-2 rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-input-text)' }}
                >
                  <option value="">All Levels</option>
                  <option value="ERROR">ERROR</option>
                  <option value="WARNING">WARNING</option>
                  <option value="INFO">INFO</option>
                  <option value="DEBUG">DEBUG</option>
                </select>
                <select
                  value={logFilter.lines}
                  onChange={(e) => setLogFilter({ ...logFilter, lines: parseInt(e.target.value) })}
                  className="px-3 py-2 rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-input-text)' }}
                >
                  <option value={50}>Last 50</option>
                  <option value={100}>Last 100</option>
                  <option value={200}>Last 200</option>
                  <option value={500}>Last 500</option>
                </select>
                <button
                  onClick={fetchAppLogs}
                  disabled={loadingLogs}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--color-btn-primary-bg)', color: 'var(--color-btn-primary-text)' }}
                >
                  <RefreshCw className={`w-4 h-4 ${loadingLogs ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  onClick={handleClearAppLogs}
                  disabled={clearingAppLogs}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm text-white"
                >
                  <Trash2 className="w-4 h-4" />
                  {clearingAppLogs ? 'Clearing...' : 'Clear'}
                </button>
              </div>

              {/* Log Display */}
              {loadingLogs ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-farm-green"></div>
                </div>
              ) : appLogs.length === 0 ? (
                <p className="text-sm py-4" style={{ color: 'var(--color-text-muted)' }}>No logs found</p>
              ) : (
                <div className="rounded-lg overflow-hidden border border-gray-700/50">
                  <div className="max-h-[400px] overflow-y-auto font-mono text-xs bg-gray-800/50">
                    {appLogs.map((log, idx) => (
                      <div
                        key={idx}
                        className={`px-3 py-1.5 border-b border-gray-700/30 flex flex-wrap gap-2 ${
                          log.level === 'ERROR' ? 'bg-red-900/20' :
                          log.level === 'WARNING' ? 'bg-yellow-900/20' : ''
                        }`}
                      >
                        <span className="shrink-0 text-gray-500">{log.timestamp}</span>
                        <span className={`font-semibold shrink-0 ${
                          log.level === 'ERROR' ? 'text-red-400' :
                          log.level === 'WARNING' ? 'text-yellow-400' :
                          log.level === 'INFO' ? 'text-blue-400' :
                          log.level === 'DEBUG' ? 'text-gray-500' : 'text-gray-400'
                        }`}>
                          [{log.level}]
                        </span>
                        <span className="break-all text-gray-300">{log.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* My Feedback */}
      {feedbackEnabled && (
        <div className="rounded-xl p-4 sm:p-6" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
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
                          onClick={() => { setShowNewFeedback(false); setNewFeedback({ title: '', description: '', feedback_type: 'feature' }) }}
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
                                fb.display_status === 'new' ? 'bg-yellow-600' :
                                fb.display_status === 'pending_implementation' ? 'bg-cyan-600' :
                                fb.display_status === 'in_development' ? 'bg-blue-600' :
                                fb.display_status === 'in_testing' ? 'bg-purple-600' :
                                fb.display_status === 'completed' ? 'bg-green-600' :
                                fb.display_status === 'declined' ? 'bg-red-600' :
                                fb.display_status === 'kickback' ? 'bg-orange-600' : 'bg-gray-600'
                              } text-white`}>
                                {fb.display_status === 'new' ? 'Pending Review' :
                                 fb.display_status === 'pending_implementation' ? 'Pending Implementation' :
                                 fb.display_status === 'in_development' ? 'In Development' :
                                 fb.display_status === 'in_testing' ? 'In Testing' :
                                 fb.display_status === 'completed' ? 'Completed' :
                                 fb.display_status === 'declined' ? 'Declined' :
                                 fb.display_status === 'kickback' ? 'Needs Info' : fb.display_status}
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
                              Submitted {new Date(fb.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                              {fb.submitted_by && ` by ${fb.submitted_by}`}
                              {fb.completed_at && (
                                <span className="ml-2 text-green-500">
                                  • Completed {new Date(fb.completed_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                                </span>
                              )}
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
      <div className="rounded-xl p-4 sm:p-6" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
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
      <div className="bg-gray-800/50 rounded-xl p-4 sm:p-6">
        <h3 className="font-medium text-white mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-purple-400" />
          Version & Updates
        </h3>

        {loadingVersion ? (
          <div className="text-gray-400">Loading version info...</div>
        ) : versionInfo ? (
          <div className="space-y-4">
            {/* Environment Switcher */}
            <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg mb-4">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${versionInfo.is_dev_instance ? 'bg-orange-600/30 text-orange-400' : 'bg-green-600/30 text-green-400'}`}>
                  {versionInfo.is_dev_instance ? 'DEV' : 'PROD'}
                </span>
                <span className="text-sm text-gray-400">
                  {versionInfo.is_dev_instance ? 'Development Instance' : 'Production Instance'}
                </span>
              </div>
              <a
                href={versionInfo.is_dev_instance ? 'https://levi.local' : 'https://192.168.5.56:8443'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-farm-green hover:text-green-400 flex items-center gap-1"
              >
                <Server className="w-4 h-4" />
                Switch to {versionInfo.is_dev_instance ? 'Production' : 'Dev'}
              </a>
            </div>

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
                    Last updated: {new Date(versionInfo.git.commit_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
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
      <div className="bg-gray-800/50 rounded-xl p-4 sm:p-6 text-sm text-gray-400">
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
