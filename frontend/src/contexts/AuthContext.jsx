import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { checkAuth, login as apiLogin, logout as apiLogout } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)

  // Check auth status on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Try to restore from localStorage first
        const savedUser = localStorage.getItem('auth_user')
        if (savedUser) {
          setUser(JSON.parse(savedUser))
        }

        // Then verify with server
        const response = await checkAuth()
        const { authenticated, needs_setup, user: serverUser } = response.data

        if (needs_setup) {
          setNeedsSetup(true)
          setUser(null)
        } else if (authenticated && serverUser) {
          setUser(serverUser)
          localStorage.setItem('auth_user', JSON.stringify(serverUser))
        } else {
          setUser(null)
          localStorage.removeItem('auth_user')
          localStorage.removeItem('auth_token')
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        setUser(null)
        localStorage.removeItem('auth_user')
        localStorage.removeItem('auth_token')
      } finally {
        setLoading(false)
      }
    }

    initAuth()
  }, [])

  const login = useCallback(async (username, password) => {
    const response = await apiLogin(username, password)
    const { token, user: userData, expires_at } = response.data

    // Store auth data
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify(userData))
    localStorage.setItem('auth_expires', expires_at)

    setUser(userData)
    setNeedsSetup(false)

    return userData
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiLogout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      localStorage.removeItem('auth_expires')
      setUser(null)
    }
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const response = await checkAuth()
      if (response.data.authenticated && response.data.user) {
        setUser(response.data.user)
        localStorage.setItem('auth_user', JSON.stringify(response.data.user))
      }
    } catch (error) {
      console.error('Failed to refresh user:', error)
    }
  }, [])

  const value = {
    user,
    loading,
    needsSetup,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isEditor: user?.role === 'admin' || user?.role === 'editor',
    isViewer: user?.role === 'viewer',
    canEdit: user?.role === 'admin' || user?.role === 'editor',
    login,
    logout,
    refreshUser,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
