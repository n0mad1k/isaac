import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { UserCheck, Lock, User, AlertCircle, Loader2, CheckCircle } from 'lucide-react'
import { getInvitationInfo, acceptInvitation } from '../services/api'

function AcceptInvite() {
  const { token } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [invitation, setInvitation] = useState(null)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  })

  useEffect(() => {
    const fetchInvitation = async () => {
      try {
        const response = await getInvitationInfo(token)
        setInvitation(response.data)
      } catch (err) {
        if (err.response?.status === 404) {
          setError('Invalid invitation link. Please check the link in your email.')
        } else if (err.response?.status === 410) {
          setError('This invitation has expired. Please request a new invitation.')
        } else if (err.response?.status === 400) {
          setError('This invitation has already been accepted.')
        } else {
          setError('Failed to load invitation. Please try again.')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchInvitation()
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await acceptInvitation(token, {
        username: formData.username,
        password: formData.password
      })

      setSuccess(true)

      // Redirect to dashboard after a short delay
      // The backend already set the auth cookie, so they'll be logged in
      setTimeout(() => {
        navigate('/')
      }, 2000)
    } catch (err) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail)
      } else {
        setError('Failed to create account. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading invitation...</p>
        </div>
      </div>
    )
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Invalid Invitation</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <a
            href="/"
            className="inline-block px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Go to Login
          </a>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full text-center">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Account Created!</h1>
          <p className="text-gray-400 mb-2">Welcome to Isaac, {formData.username}!</p>
          <p className="text-gray-500 text-sm">Redirecting to dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <UserCheck className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Accept Invitation</h1>
          <p className="text-gray-400">
            You've been invited to join Isaac
          </p>
        </div>

        {invitation && (
          <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Email:</span>
              <span className="text-white">{invitation.email}</span>
            </div>
            {invitation.display_name && (
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Display Name:</span>
                <span className="text-white">{invitation.display_name}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Role:</span>
              <span className="text-cyan-400 capitalize">{invitation.role}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-red-300 text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Choose a Username
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="username"
                required
                minLength={3}
                pattern="^[a-zA-Z0-9._-]+$"
                title="Username can only contain letters, numbers, dots, underscores, and hyphens"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Create a Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="••••••••"
                required
                minLength={8}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating Account...
              </>
            ) : (
              <>
                <UserCheck className="w-5 h-5" />
                Create Account
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

export default AcceptInvite
