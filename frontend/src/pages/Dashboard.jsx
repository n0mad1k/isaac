import React, { useState, useEffect, useCallback } from 'react'
import { Leaf, PawPrint, ListTodo, AlertTriangle, Clock } from 'lucide-react'
import { getDashboard } from '../services/api'
import WeatherWidget from '../components/WeatherWidget'
import TaskList from '../components/TaskList'
import AlertBanner from '../components/AlertBanner'
import StatsCard from '../components/StatsCard'
import ColdProtectionWidget from '../components/ColdProtectionWidget'
import { format } from 'date-fns'

function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  const fetchData = useCallback(async () => {
    try {
      const response = await getDashboard()
      setData(response.data)
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
    <div className="space-y-6">
      {/* Header with Date/Time */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            {format(currentTime, 'EEEE, MMMM d')}
          </h1>
          <p className="text-gray-400">{format(currentTime, 'yyyy')}</p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-mono text-farm-green">
            {format(currentTime, 'h:mm')}
            <span className="text-2xl">{format(currentTime, ':ss a')}</span>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <AlertBanner alerts={data?.alerts} onDismiss={fetchData} />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Weather & Stats */}
        <div className="space-y-6">
          <WeatherWidget weather={data?.weather} />

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
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
              title="Tasks Today"
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

        {/* Right Column - Today's Tasks */}
        <div>
          <TaskList
            title="Today's Tasks"
            tasks={data?.tasks_today}
            onTaskToggle={fetchData}
          />

          {/* Upcoming This Week */}
          {data?.upcoming_events?.length > 0 && (
            <div className="mt-6 bg-gray-800 rounded-xl p-4">
              <h2 className="text-lg font-semibold text-gray-300 mb-3">
                Upcoming This Week
              </h2>
              <div className="space-y-2">
                {data.upcoming_events
                  .filter((e) => !e.is_completed)
                  .slice(0, 5)
                  .map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between bg-gray-700 rounded-lg px-3 py-2"
                    >
                      <p className="font-medium truncate">{event.title}</p>
                      <p className="text-sm text-gray-400 ml-2 flex-shrink-0">
                        {format(new Date(event.date), 'EEE, MMM d')}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cold Protection Widget - bottom, compact */}
      <ColdProtectionWidget />
    </div>
  )
}

export default Dashboard
