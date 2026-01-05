import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Plants from './pages/Plants'
import Animals from './pages/Animals'
import ToDo from './pages/ToDo'
import Seeds from './pages/Seeds'
import CalendarPage from './pages/CalendarPage'
import Settings from './pages/Settings'
import HomeMaintenance from './pages/HomeMaintenance'
import Vehicles from './pages/Vehicles'
import Equipment from './pages/Equipment'
import FarmAreas from './pages/FarmAreas'
import Production from './pages/Production'
import Login from './pages/Login'
import Layout from './components/Layout'
import { AuthProvider, useAuth } from './contexts/AuthContext'

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

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
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
        <Route path="plants" element={<Plants />} />
        <Route path="seeds" element={<Seeds />} />
        <Route path="animals" element={<Animals />} />
        <Route path="home-maintenance" element={<HomeMaintenance />} />
        <Route path="vehicles" element={<Vehicles />} />
        <Route path="equipment" element={<Equipment />} />
        <Route path="farm-areas" element={<FarmAreas />} />
        <Route path="production" element={<Production />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
