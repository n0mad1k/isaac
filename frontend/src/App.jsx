import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Plants from './pages/Plants'
import Animals from './pages/Animals'
import Tasks from './pages/Tasks'
import Seeds from './pages/Seeds'
import CalendarPage from './pages/CalendarPage'
import Layout from './components/Layout'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="plants" element={<Plants />} />
          <Route path="animals" element={<Animals />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="seeds" element={<Seeds />} />
          <Route path="calendar" element={<CalendarPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
