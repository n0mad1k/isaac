import React from 'react'
import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react'
import { dismissAlert } from '../services/api'

function AlertBanner({ alerts, onDismiss }) {
  if (!alerts || alerts.length === 0) return null

  const getSeverityStyles = (severity) => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'bg-red-900/80',
          border: 'border-red-500',
          icon: <AlertTriangle className="w-6 h-6 text-red-400" />,
        }
      case 'warning':
        return {
          bg: 'bg-yellow-900/80',
          border: 'border-yellow-500',
          icon: <AlertCircle className="w-6 h-6 text-yellow-400" />,
        }
      default:
        return {
          bg: 'bg-blue-900/80',
          border: 'border-blue-500',
          icon: <Info className="w-6 h-6 text-blue-400" />,
        }
    }
  }

  const handleDismiss = async (alertId) => {
    try {
      await dismissAlert(alertId)
      if (onDismiss) onDismiss()
    } catch (error) {
      console.error('Failed to dismiss alert:', error)
    }
  }

  return (
    <div className="space-y-3 mb-6">
      {alerts.map((alert) => {
        const styles = getSeverityStyles(alert.severity)
        return (
          <div
            key={alert.id}
            className={`${styles.bg} border-l-4 ${styles.border} rounded-lg p-4 flex items-start gap-4`}
          >
            <div className="flex-shrink-0">{styles.icon}</div>
            <div className="flex-1">
              <h3 className="font-semibold">{alert.title}</h3>
              {alert.message && (
                <p className="text-sm text-gray-300 mt-1">{alert.message}</p>
              )}
            </div>
            <button
              onClick={() => handleDismiss(alert.id)}
              className="flex-shrink-0 p-1 hover:bg-white/10 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export default AlertBanner
