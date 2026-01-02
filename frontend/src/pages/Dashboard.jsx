import React, { useState, useEffect, useCallback } from 'react'
import { Leaf, PawPrint, ListTodo, AlertTriangle, Clock } from 'lucide-react'
import { getDashboard, getAnimals } from '../services/api'
import WeatherWidget from '../components/WeatherWidget'
import TaskList from '../components/TaskList'
import AlertBanner from '../components/AlertBanner'
import StatsCard from '../components/StatsCard'
import ColdProtectionWidget from '../components/ColdProtectionWidget'
import AnimalFeedWidget from '../components/AnimalFeedWidget'
import { format } from 'date-fns'

function Dashboard() {
  const [data, setData] = useState(null)
  const [animals, setAnimals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  const fetchData = useCallback(async () => {
    try {
      const [dashboardRes, animalsRes] = await Promise.all([
        getDashboard(),
        getAnimals()
      ])
      setData(dashboardRes.data)
      setAnimals(animalsRes.data)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
      setError('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    // Refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  useEffect(() => {
    // Update clock every second
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-farm-green mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading Levi...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-red-400">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
          <p>{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-farm-green rounded-lg hover:bg-farm-green-light"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with Date/Time and Stats inline */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-shrink-0">
          <h1 className="text-2xl font-bold text-white">
            {format(currentTime, 'EEEE, MMMM d')}
          </h1>
          <div className="text-3xl font-mono text-farm-green">
            {format(currentTime, 'h:mm')}
            <span className="text-xl">{format(currentTime, ':ss a')}</span>
          </div>
        </div>

        {/* Stats - compact inline */}
        <div className="flex gap-2 flex-wrap justify-end flex-1">
          <StatsCard
            title="Plants"
            value={data?.stats?.total_plants || 0}
            icon={Leaf}
            color="green"
          />
          <StatsCard
            title="Animals"
            value={data?.stats?.total_animals || 0}
            icon={PawPrint}
            color="blue"
          />
          <StatsCard
            title="Tasks"
            value={data?.stats?.tasks_today || 0}
            icon={ListTodo}
            color="yellow"
          />
          <StatsCard
            title="Overdue"
            value={data?.stats?.tasks_overdue || 0}
            icon={Clock}
            color={data?.stats?.tasks_overdue > 0 ? 'red' : 'green'}
          />
        </div>
      </div>

      {/* Alerts - Priority positioning */}
      <AlertBanner alerts={data?.alerts} onDismiss={fetchData} />

      {/* Cold Protection Widget - Priority positioning right after alerts */}
      <ColdProtectionWidget />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column - Weather & Animal Feed */}
        <div className="space-y-4">
          <WeatherWidget weather={data?.weather} />

          {/* Animal Feed Widget */}
          <AnimalFeedWidget animals={animals} />
        </div>

        {/* Right Column - Today's Tasks */}
        <div className="space-y-4">
          <TaskList
            title="Today's Schedule"
            tasks={data?.tasks_today}
            onTaskToggle={fetchData}
            showTimeAndLocation={true}
          />

          {/* Undated Todos Widget */}
          {data?.undated_todos && data.undated_todos.length > 0 && (
            <TaskList
              title="To Do"
              tasks={data?.undated_todos}
              onTaskToggle={fetchData}
              showTimeAndLocation={false}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
