import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Garden from './pages/Garden'
import Animals from './pages/Animals'
import ToDo from './pages/ToDo'
import CalendarPage from './pages/CalendarPage'
import Settings from './pages/Settings'
import HomeMaintenance from './pages/HomeMaintenance'
import Vehicles from './pages/Vehicles'
import Equipment from './pages/Equipment'
import FarmAreas from './pages/FarmAreas'
import FarmFinances from './pages/FarmFinances'
import DevTracker from './pages/DevTracker'
import WorkerTasks from './pages/WorkerTasks'
import Team from './pages/Team'
import Budget from './pages/Budget'
import Login from './pages/Login'
import AcceptInvite from './pages/AcceptInvite'
import SetupWizard from './pages/SetupWizard'
import Layout from './components/Layout'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { getSetupStatus } from './services/api'

// Protected route wrapper
function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-farm-green"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}

// Setup check wrapper - redirects to setup wizard if not complete
function SetupCheckRoutes() {
  const [setupStatus, setSetupStatus] = useState({ loading: true, needsSetup: false })
  const location = useLocation()

  useEffect(() => {
    checkSetup()
  }, [])

  const checkSetup = async () => {
    try {
      const response = await getSetupStatus()
      setSetupStatus({
        loading: false,
        needsSetup: response.data.needs_setup
      })
    } catch (err) {
      // If setup endpoint fails, assume setup is complete (for backwards compat)
      console.error('Setup check failed:', err)
      setSetupStatus({ loading: false, needsSetup: false })
    }
  }

  if (setupStatus.loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-farm-green"></div>
      </div>
    )
  }

  // If setup is needed and we're not already on the setup page
  if (setupStatus.needsSetup && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />
  }

  // If setup is complete and we're on the setup page, redirect to login
  if (!setupStatus.needsSetup && location.pathname === '/setup') {
    return <Navigate to="/login" replace />
  }

  return (
    <Routes>
      <Route path="/setup" element={<SetupWizard />} />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  )
}

// Protected routes wrapped with auth providers
function ProtectedRoutes() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <Routes>
          <Route
            path="/"
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="todo" element={<ToDo />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="garden" element={<Garden />} />
            <Route path="plants" element={<Navigate to="/garden" replace />} />
            <Route path="seeds" element={<Navigate to="/garden" replace />} />
            <Route path="animals" element={<Animals />} />
            <Route path="home-maintenance" element={<HomeMaintenance />} />
            <Route path="vehicles" element={<Vehicles />} />
            <Route path="equipment" element={<Equipment />} />
            <Route path="farm-areas" element={<FarmAreas />} />
            <Route path="farm-finances" element={<FarmFinances />} />
            <Route path="settings" element={<Settings />} />
            <Route path="dev-tracker" element={<DevTracker />} />
            <Route path="worker-tasks" element={<WorkerTasks />} />
            <Route path="team" element={<Team />} />
            <Route path="budget" element={<Budget />} />
          </Route>
          <Route path="/login" element={<Login />} />
        </Routes>
      </SettingsProvider>
    </AuthProvider>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes - no auth providers, no API calls */}
        <Route path="/accept-invite/:token" element={<AcceptInvite />} />
        {/* All other routes go through setup check, then auth providers */}
        <Route path="/*" element={<SetupCheckRoutes />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
