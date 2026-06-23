import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { checkAuth, login as apiLogin, logout as apiLogout } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)

  // Check auth status on mount
  // Auth tokens are stored in HttpOnly cookies (not accessible to JavaScript)
  // We only cache user data in localStorage for UI display
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Try to restore user data from localStorage for faster UI display
        const savedUser = localStorage.getItem('auth_user')
        if (savedUser) {
          setUser(JSON.parse(savedUser))
        }

        // Verify with server - cookies are sent automatically
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
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        setUser(null)
        localStorage.removeItem('auth_user')
      } finally {
        setLoading(false)
      }
    }

    initAuth()
  }, [])

  const login = useCallback(async (username, password) => {
    const response = await apiLogin(username, password)
    const { user: userData } = response.data
    // Note: auth token is set as HttpOnly cookie by backend, not accessible here

    // Store user data for UI display only (not security-sensitive)
    localStorage.setItem('auth_user', JSON.stringify(userData))

    setUser(userData)
    setNeedsSetup(false)

    return userData
  }, [])

  const logout = useCallback(async () => {
    try {
      // Backend will clear the HttpOnly cookie
      await apiLogout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      localStorage.removeItem('auth_user')
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

  // Granular permission checker
  const hasPermission = useCallback((category, action) => {
    if (!user?.permissions) return false
    const categoryPerms = user.permissions[category]
    if (!categoryPerms) return false
    return categoryPerms[action] === true
  }, [user?.permissions])

  // Check if user can perform action (view/create/interact/edit/delete) on category
  const canView = useCallback((category) => hasPermission(category, 'view'), [hasPermission])
  const canCreate = useCallback((category) => hasPermission(category, 'create'), [hasPermission])
  const canInteract = useCallback((category) => hasPermission(category, 'interact'), [hasPermission])
  const canEditCategory = useCallback((category) => hasPermission(category, 'edit'), [hasPermission])
  const canDelete = useCallback((category) => hasPermission(category, 'delete'), [hasPermission])

  const value = {
    user,
    loading,
    needsSetup,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isEditor: user?.role === 'admin' || user?.role === 'editor',
    isViewer: user?.role === 'viewer',
    canEdit: user?.role === 'admin' || user?.role === 'editor',
    // Granular permission helpers
    permissions: user?.permissions || {},
    hasPermission,
    canView,
    canCreate,
    canInteract,
    canEditCategory,
    canDelete,
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
