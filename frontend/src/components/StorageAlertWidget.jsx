import React, { useState, useEffect } from 'react'
import { HardDrive, AlertTriangle, ChevronDown, ChevronRight, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getStorageStats } from '../services/api'

/**
 * StorageAlertWidget - Only displays when storage usage exceeds warning threshold
 * Shows a compact alert on dashboard that links to full storage details in Settings
 */
function StorageAlertWidget() {
  const [storageStats, setStorageStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const fetchStorage = async () => {
      try {
        const response = await getStorageStats()
        setStorageStats(response.data)
      } catch (error) {
        console.error('Failed to fetch storage stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStorage()
    // Refresh every 5 minutes
    const interval = setInterval(fetchStorage, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Don't render if loading, no data, or status is OK
  if (loading || !storageStats || storageStats.alert_level === 'ok') {
    return null
  }

  const isCritical = storageStats.alert_level === 'critical'

  return (
    <div
      className={`rounded-lg border ${
        isCritical
          ? 'bg-red-900/30 border-red-700'
          : 'bg-yellow-900/30 border-yellow-700'
      }`}
    >
      {/* Header - clickable to expand */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className={`w-4 h-4 ${isCritical ? 'text-red-400' : 'text-yellow-400'}`} />
          ) : (
            <ChevronRight className={`w-4 h-4 ${isCritical ? 'text-red-400' : 'text-yellow-400'}`} />
          )}
          <AlertTriangle className={`w-5 h-5 ${isCritical ? 'text-red-400' : 'text-yellow-400'}`} />
          <span className={`font-medium ${isCritical ? 'text-red-300' : 'text-yellow-300'}`}>
            {isCritical ? 'Storage Critical' : 'Storage Low'}
          </span>
        </div>
        <span className={`text-sm font-bold ${isCritical ? 'text-red-400' : 'text-yellow-400'}`}>
          {storageStats.disk_usage_percent}% used
        </span>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Progress Bar */}
          <div className="w-full bg-gray-600 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${isCritical ? 'bg-red-500' : 'bg-yellow-500'}`}
              style={{ width: `${Math.min(storageStats.disk_usage_percent, 100)}%` }}
            />
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Available:</span>
              <span>{storageStats.disk_available_human}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Total:</span>
              <span>{storageStats.disk_total_human}</span>
            </div>
          </div>

          {/* App Breakdown */}
          <div className="text-xs text-gray-400 space-y-1">
            <div className="flex items-center gap-1">
              <HardDrive className="w-3 h-3" />
              <span>Isaac: Database {storageStats.database_human}, Logs {storageStats.logs_human}</span>
            </div>
          </div>

          {/* Link to Settings */}
          <Link
            to="/settings"
            className={`flex items-center justify-center gap-2 w-full py-2 rounded-lg text-sm transition-colors ${
              isCritical
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-yellow-600 hover:bg-yellow-500 text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            Manage Storage
          </Link>
        </div>
      )}
    </div>
  )
}

export default StorageAlertWidget
