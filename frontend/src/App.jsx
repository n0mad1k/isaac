import React, { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { getSetupStatus } from './services/api'

// Lazy-load all page components so each page is a separate JS chunk
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Garden = lazy(() => import('./pages/Garden'))
const Animals = lazy(() => import('./pages/Animals'))
const ToDo = lazy(() => import('./pages/ToDo'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const Settings = lazy(() => import('./pages/Settings'))
const HomeMaintenance = lazy(() => import('./pages/HomeMaintenance'))
const Vehicles = lazy(() => import('./pages/Vehicles'))
const Equipment = lazy(() => import('./pages/Equipment'))
const FarmAreas = lazy(() => import('./pages/FarmAreas'))
const FarmFinances = lazy(() => import('./pages/FarmFinances'))
const DevTracker = lazy(() => import('./pages/DevTracker'))
const WorkerTasks = lazy(() => import('./pages/WorkerTasks'))
const Team = lazy(() => import('./pages/Team'))
const Budget = lazy(() => import('./pages/Budget'))
const Login = lazy(() => import('./pages/Login'))
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'))
const SetupWizard = lazy(() => import('./pages/SetupWizard'))

// Shared loading fallback shown while a page chunk is downloading
function PageLoader() {
  return (
    <div className="min-h-screen bg-surface-app flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-farm-green"></div>
    </div>
  )
}

// Protected route wrapper
function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-app flex items-center justify-center">
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
      <div className="min-h-screen bg-surface-app flex items-center justify-center">
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
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/setup" element={<SetupWizard />} />
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </Suspense>
  )
}

// Protected routes wrapped with auth providers
function ProtectedRoutes() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <Suspense fallback={<PageLoader />}>
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
        </Suspense>
      </SettingsProvider>
    </AuthProvider>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public routes - no auth providers, no API calls */}
          <Route path="/accept-invite/:token" element={<AcceptInvite />} />
          {/* All other routes go through setup check, then auth providers */}
          <Route path="/*" element={<SetupCheckRoutes />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
