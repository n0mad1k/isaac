import React, { useState, useEffect, useCallback } from 'react'
import { Leaf, PawPrint, ListTodo, AlertTriangle, Clock, Archive, Check, Circle, ArrowUp } from 'lucide-react'
import { getDashboard, getAnimals, getSettings, completeTask, toggleBacklog } from '../services/api'
import WeatherWidget from '../components/WeatherWidget'
import TaskList from '../components/TaskList'
import AlertBanner from '../components/AlertBanner'
import StorageAlertWidget from '../components/StorageAlertWidget'
import StatsCard from '../components/StatsCard'
import ColdProtectionWidget from '../components/ColdProtectionWidget'
import AnimalFeedWidget from '../components/AnimalFeedWidget'
import BibleVerse from '../components/BibleVerse'
import { format } from 'date-fns'

function Dashboard() {
  const [data, setData] = useState(null)
  const [animals, setAnimals] = useState([])
  const [hideCompleted, setHideCompleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  const fetchData = useCallback(async () => {
    try {
      const [dashboardRes, animalsRes, settingsRes] = await Promise.all([
        getDashboard(),
        getAnimals(),
        getSettings()
      ])
      setData(dashboardRes.data)
      setAnimals(animalsRes.data)
      // Check hide_completed_today setting
      const hideCompletedSetting = settingsRes.data?.settings?.hide_completed_today?.value
      setHideCompleted(hideCompletedSetting === 'true')
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
          <p className="mt-4 text-gray-400">Loading Isaac...</p>
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
      {/* Header with Date/Time, Bible Verse, and Stats */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 lg:gap-4">
        {/* Top row on mobile: Date/Time and Stats */}
        <div className="flex items-start justify-between gap-2 lg:contents">
          {/* Left - Date/Time */}
          <div className="flex-shrink-0 min-w-0">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white truncate">
              {format(currentTime, 'EEE, MMM d')}
            </h1>
            <div className="text-xl sm:text-2xl md:text-3xl font-mono text-farm-green">
              {format(currentTime, 'h:mm')}
              <span className="text-sm sm:text-lg md:text-xl">{format(currentTime, ':ss a')}</span>
            </div>
          </div>

          {/* Stats - 2x2 grid on mobile, row on desktop */}
          <div className="grid grid-cols-2 gap-1 sm:flex sm:gap-2 flex-shrink-0 lg:order-3">
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

        {/* Bible Verse - Full width below on mobile, center on desktop */}
        <div className="w-full lg:flex-1 lg:order-2">
          <BibleVerse />
        </div>
      </div>

      {/* Alerts - Priority positioning */}
      <AlertBanner alerts={data?.alerts} onDismiss={fetchData} />

      {/* Storage Alert - Only shows when storage is low/critical */}
      <StorageAlertWidget />

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
            tasks={hideCompleted
              ? data?.tasks_today?.filter(t => !t.is_completed)
              : data?.tasks_today}
            onTaskToggle={fetchData}
            showTimeAndLocation={true}
          />

          {/* Backlog Widget - Only shows if there are backlog items */}
          {data?.backlog_tasks && data.backlog_tasks.length > 0 && (
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-gray-300 mb-4 flex items-center gap-2">
                <Archive className="w-5 h-5" />
                Backlog
                <span className="text-sm font-normal text-gray-500">({data.backlog_tasks.length})</span>
              </h2>
              <div className="space-y-2">
                {data.backlog_tasks.map(task => (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg bg-gray-700/50 border-l-4 border-l-gray-500 flex items-center gap-2"
                  >
                    <button
                      onClick={async () => {
                        try {
                          await completeTask(task.id)
                          fetchData()
                        } catch (err) {
                          console.error('Failed to complete task:', err)
                        }
                      }}
                      className="flex-shrink-0 focus:outline-none"
                      title="Complete"
                    >
                      <Circle className="w-5 h-5 text-gray-500 hover:text-green-400" />
                    </button>
                    <span className="flex-1 font-medium truncate">{task.title}</span>
                    <button
                      onClick={async () => {
                        try {
                          await toggleBacklog(task.id)
                          fetchData()
                        } catch (err) {
                          console.error('Failed to move to today:', err)
                        }
                      }}
                      className="flex-shrink-0 px-2 py-1 text-xs bg-farm-green/20 text-farm-green rounded hover:bg-farm-green/30 flex items-center gap-1"
                      title="Move to Today"
                    >
                      <ArrowUp className="w-3 h-3" />
                      Today
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
