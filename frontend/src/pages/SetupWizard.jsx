import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Settings, User, Lock, MapPin, Clock, Mail, Cloud, Check, ChevronRight,
  ChevronLeft, Loader2, AlertCircle, LayoutGrid, Calendar
} from 'lucide-react'
import { getAvailableModules, completeSetupWizard } from '../services/api'

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central Europe (CET)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
]

function SetupWizard() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [modules, setModules] = useState({})

  // Form state
  const [formData, setFormData] = useState({
    farm_name: '',
    timezone: 'America/New_York',
    latitude: 40.7128,
    longitude: -74.0060,
    usda_zone: '',
    admin_username: '',
    admin_password: '',
    confirm_password: '',
    enabled_modules: [],
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    notification_email: '',
    awn_api_key: '',
    awn_app_key: '',
    caldav_username: '',
    caldav_password: '',
  })

  useEffect(() => {
    loadModules()
  }, [])

  const loadModules = async () => {
    try {
      const response = await getAvailableModules()
      setModules(response.data.modules)
      // Set default enabled modules (all of them)
      const defaultModules = Object.keys(response.data.modules)
      setFormData(prev => ({ ...prev, enabled_modules: defaultModules }))
    } catch (err) {
      console.error('Failed to load modules:', err)
    }
  }

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError('')
  }

  const toggleModule = (moduleKey) => {
    const moduleInfo = modules[moduleKey]
    if (moduleInfo?.required) return // Can't disable required modules

    setFormData(prev => ({
      ...prev,
      enabled_modules: prev.enabled_modules.includes(moduleKey)
        ? prev.enabled_modules.filter(m => m !== moduleKey)
        : [...prev.enabled_modules, moduleKey]
    }))
  }

  const validateStep = () => {
    switch (step) {
      case 1:
        if (!formData.farm_name.trim()) {
          setError('Please enter a farm name')
          return false
        }
        break
      case 2:
        if (!formData.admin_username.trim()) {
          setError('Please enter a username')
          return false
        }
        if (formData.admin_username.length < 3) {
          setError('Username must be at least 3 characters')
          return false
        }
        if (!formData.admin_password) {
          setError('Please enter a password')
          return false
        }
        if (formData.admin_password.length < 8) {
          setError('Password must be at least 8 characters')
          return false
        }
        if (formData.admin_password !== formData.confirm_password) {
          setError('Passwords do not match')
          return false
        }
        break
      case 4:
        if (!formData.caldav_username.trim()) {
          setError('CalDAV username is required for calendar sync')
          return false
        }
        if (!formData.caldav_password) {
          setError('CalDAV password is required for calendar sync')
          return false
        }
        break
    }
    return true
  }

  const nextStep = () => {
    if (validateStep()) {
      setStep(prev => Math.min(prev + 1, 4))
    }
  }

  const prevStep = () => {
    setStep(prev => Math.max(prev - 1, 1))
    setError('')
  }

  const handleSubmit = async () => {
    if (!validateStep()) return

    setLoading(true)
    setError('')

    try {
      // Prepare data for API
      const submitData = {
        farm_name: formData.farm_name,
        timezone: formData.timezone,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        admin_username: formData.admin_username,
        admin_password: formData.admin_password,
        enabled_modules: formData.enabled_modules,
      }

      // Add USDA zone if provided
      if (formData.usda_zone) {
        submitData.usda_zone = formData.usda_zone
      }

      // Add optional email fields if provided
      if (formData.smtp_host && formData.smtp_user) {
        submitData.smtp_host = formData.smtp_host
        submitData.smtp_port = parseInt(formData.smtp_port) || 587
        submitData.smtp_user = formData.smtp_user
        if (formData.smtp_password) {
          submitData.smtp_password = formData.smtp_password
        }
        if (formData.notification_email) {
          submitData.notification_email = formData.notification_email
        }
      }

      // Add weather API keys if provided
      if (formData.awn_api_key && formData.awn_app_key) {
        submitData.awn_api_key = formData.awn_api_key
        submitData.awn_app_key = formData.awn_app_key
      }

      // CalDAV settings (required)
      submitData.caldav_enabled = true
      submitData.caldav_username = formData.caldav_username
      submitData.caldav_password = formData.caldav_password

      await completeSetupWizard(submitData)
      // Force full page reload to re-check setup status
      window.location.href = '/login'
    } catch (err) {
      console.error('Setup failed:', err)
      setError(err.response?.data?.detail || 'Setup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[1, 2, 3, 4].map((s) => (
        <React.Fragment key={s}>
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-medium
              ${s === step ? 'bg-farm-green text-white' :
                s < step ? 'bg-green-700 text-white' :
                'bg-gray-700 text-gray-400'}`}
          >
            {s < step ? <Check className="w-5 h-5" /> : s}
          </div>
          {s < 4 && (
            <div className={`w-12 h-1 ${s < step ? 'bg-green-700' : 'bg-gray-700'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  )

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Welcome to Isaac</h2>
        <p className="text-gray-400">Let's set up your farm management system</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Farm or Homestead Name
        </label>
        <input
          type="text"
          value={formData.farm_name}
          onChange={(e) => updateField('farm_name', e.target.value)}
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-farm-green"
          placeholder="e.g., Green Valley Farm"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          <Clock className="w-4 h-4 inline mr-1" />
          Timezone
        </label>
        <select
          value={formData.timezone}
          onChange={(e) => updateField('timezone', e.target.value)}
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-farm-green"
        >
          {TIMEZONES.map(tz => (
            <option key={tz.value} value={tz.value}>{tz.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <MapPin className="w-4 h-4 inline mr-1" />
            Latitude
          </label>
          <input
            type="number"
            step="0.0001"
            value={formData.latitude}
            onChange={(e) => updateField('latitude', e.target.value)}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-farm-green"
            placeholder="40.7128"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Longitude
          </label>
          <input
            type="number"
            step="0.0001"
            value={formData.longitude}
            onChange={(e) => updateField('longitude', e.target.value)}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-farm-green"
            placeholder="-74.0060"
          />
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Location is used for weather forecasts and frost date calculations
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          USDA Hardiness Zone (Optional)
        </label>
        <input
          type="text"
          value={formData.usda_zone}
          onChange={(e) => updateField('usda_zone', e.target.value)}
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-farm-green"
          placeholder="e.g., 9b"
        />
        <p className="text-xs text-gray-500 mt-1">
          Find your zone at planthardiness.ars.usda.gov
        </p>
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Create Admin Account</h2>
        <p className="text-gray-400">Set up your administrator login</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          <User className="w-4 h-4 inline mr-1" />
          Username
        </label>
        <input
          type="text"
          value={formData.admin_username}
          onChange={(e) => updateField('admin_username', e.target.value)}
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-farm-green"
          placeholder="admin"
          autoComplete="username"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          <Lock className="w-4 h-4 inline mr-1" />
          Password
        </label>
        <input
          type="password"
          value={formData.admin_password}
          onChange={(e) => updateField('admin_password', e.target.value)}
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-farm-green"
          placeholder="At least 8 characters"
          autoComplete="new-password"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Confirm Password
        </label>
        <input
          type="password"
          value={formData.confirm_password}
          onChange={(e) => updateField('confirm_password', e.target.value)}
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-farm-green"
          placeholder="Re-enter password"
          autoComplete="new-password"
        />
      </div>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Choose Your Modules</h2>
        <p className="text-gray-400">Select which features you want to use</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
        {Object.entries(modules).map(([key, module]) => (
          <button
            key={key}
            onClick={() => toggleModule(key)}
            disabled={module.required}
            className={`p-4 rounded-lg border text-left transition-colors ${
              formData.enabled_modules.includes(key)
                ? 'bg-farm-green/20 border-farm-green'
                : 'bg-gray-700 border-gray-600 hover:border-gray-500'
            } ${module.required ? 'opacity-75 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center mt-0.5 ${
                formData.enabled_modules.includes(key)
                  ? 'bg-farm-green text-white'
                  : 'bg-gray-600'
              }`}>
                {formData.enabled_modules.includes(key) && <Check className="w-3 h-3" />}
              </div>
              <div>
                <div className="font-medium text-white">
                  {module.name}
                  {module.required && (
                    <span className="ml-2 text-xs text-gray-400">(Required)</span>
                  )}
                </div>
                <div className="text-sm text-gray-400 mt-1">{module.description}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Optional Integrations</h2>
        <p className="text-gray-400">Configure these later in Settings if needed</p>
      </div>

      <div className="bg-gray-700/50 rounded-lg p-4">
        <h3 className="font-medium text-white flex items-center gap-2 mb-4">
          <Mail className="w-5 h-5 text-farm-green" />
          Email Notifications (Optional)
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">SMTP Host</label>
              <input
                type="text"
                value={formData.smtp_host}
                onChange={(e) => updateField('smtp_host', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
                placeholder="smtp.gmail.com"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Port</label>
              <input
                type="number"
                value={formData.smtp_port}
                onChange={(e) => updateField('smtp_port', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
                placeholder="587"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Username/Email</label>
              <input
                type="email"
                value={formData.smtp_user}
                onChange={(e) => updateField('smtp_user', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Password</label>
              <input
                type="password"
                value={formData.smtp_password}
                onChange={(e) => updateField('smtp_password', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
                placeholder="App password"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Send Alerts To (Optional)</label>
            <input
              type="email"
              value={formData.notification_email}
              onChange={(e) => updateField('notification_email', e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
              placeholder="Defaults to SMTP email if blank"
            />
          </div>
        </div>
      </div>

      <div className="bg-gray-700/50 rounded-lg p-4">
        <h3 className="font-medium text-white flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-farm-green" />
          Calendar Sync - CalDAV
        </h3>
        <div className="space-y-4">
          <p className="text-sm text-gray-300">
            Set up credentials for syncing tasks to your phone/tablet calendar.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">CalDAV Username <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={formData.caldav_username}
                onChange={(e) => updateField('caldav_username', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
                placeholder="e.g., farm-calendar"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">CalDAV Password <span className="text-red-400">*</span></label>
              <input
                type="password"
                value={formData.caldav_password}
                onChange={(e) => updateField('caldav_password', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
                placeholder="Secure password"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            These credentials are used to sync tasks to your phone calendar via Radicale CalDAV server.
            You cannot change these after setup.
          </p>
        </div>
      </div>

      <div className="bg-gray-700/50 rounded-lg p-4">
        <h3 className="font-medium text-white flex items-center gap-2 mb-4">
          <Cloud className="w-5 h-5 text-farm-green" />
          Ambient Weather Network (Optional)
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">API Key</label>
            <input
              type="text"
              value={formData.awn_api_key}
              onChange={(e) => updateField('awn_api_key', e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
              placeholder="Your AWN API key"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Application Key</label>
            <input
              type="text"
              value={formData.awn_app_key}
              onChange={(e) => updateField('awn_app_key', e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
              placeholder="Your AWN app key"
            />
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-farm-green/20 mb-4">
              <span className="text-4xl">🌿</span>
            </div>
          </div>

          {/* Card */}
          <div className="bg-gray-800 rounded-xl p-8 shadow-xl">
            {renderStepIndicator()}

            {error && (
              <div className="mb-6 p-3 bg-red-900/50 border border-red-700 rounded-lg flex items-center gap-2 text-red-300">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}

            {/* Navigation */}
            <div className="flex justify-between mt-8">
              {step > 1 ? (
                <button
                  onClick={prevStep}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium text-white transition-colors flex items-center gap-2"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Back
                </button>
              ) : (
                <div />
              )}

              {step < 4 ? (
                <button
                  onClick={nextStep}
                  className="px-6 py-3 bg-farm-green hover:bg-farm-green-light rounded-lg font-medium text-white transition-colors flex items-center gap-2"
                >
                  Next
                  <ChevronRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-8 py-3 bg-farm-green hover:bg-farm-green-light disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium text-white transition-colors flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Complete Setup
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <p className="text-center text-gray-500 text-sm mt-6">
            Isaac - Farm & Homestead Management
          </p>
        </div>
      </div>
    </div>
  )
}

export default SetupWizard
