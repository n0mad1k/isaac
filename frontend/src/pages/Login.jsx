import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LogIn, User, Lock, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getVersionInfo } from '../services/api'

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, loading: authLoading } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isDevInstance, setIsDevInstance] = useState(false)

  const from = location.state?.from?.pathname || '/'

  useEffect(() => {
    const checkDevInstance = async () => {
      try {
        const response = await getVersionInfo()
        const isDev = response.data.is_dev_instance || false
        setIsDevInstance(isDev)
        document.title = isDev ? '[DEV] Isaac - Login' : 'Isaac - Login'
      } catch (error) {
        console.error('Failed to fetch version info:', error)
      }
    }
    checkDevInstance()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(username, password)
      navigate(from, { replace: true })
    } catch (err) {
      console.error('Login error:', err)
      if (err.response?.status === 401) {
        setError('Invalid username or password')
      } else {
        setError('Login failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface-app flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-farm-green animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-app flex flex-col">
      {/* Dev Instance Banner */}
      {isDevInstance && (
        <div className="bg-orange-600 text-white text-center py-1 text-sm font-medium">
          Development Instance
        </div>
      )}

      <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-farm-green/20 mb-4">
            <span className="text-4xl">🌿</span>
          </div>
          <h1 className="text-3xl font-bold text-white">
            Isaac {isDevInstance && <span className="text-orange-400">(Dev)</span>}
          </h1>
          <p className="text-muted mt-2">Farm & Homestead Assistant</p>
        </div>

        {/* Login Form */}
        <div className="bg-surface rounded-xl p-8 shadow-xl">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <LogIn className="w-5 h-5 text-farm-green" />
            Sign In
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg flex items-center gap-2 text-red-300">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-surface-soft border border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-farm-green focus:border-transparent"
                  placeholder="Enter your username"
                  required
                  autoFocus
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-surface-soft border border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-farm-green focus:border-transparent"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !username}
              className="w-full py-3 px-4 bg-farm-green hover:bg-farm-green-light disabled:bg-surface-hover disabled:cursor-not-allowed rounded-lg font-medium text-white transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-muted text-sm mt-6">
          Farm & Homestead Management
        </p>
      </div>
      </div>
    </div>
  )
}

export default Login
