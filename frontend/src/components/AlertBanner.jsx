import React, { useState } from 'react'
import { AlertTriangle, AlertCircle, Info, X, Check, ChevronDown, ChevronUp, Bell } from 'lucide-react'
import { dismissAlert, acknowledgeAlert } from '../services/api'

function AlertBanner({ alerts, onDismiss }) {
  const [collapsed, setCollapsed] = useState(true)

  if (!alerts || alerts.length === 0) return null

  // Split alerts into new (unacknowledged) and acknowledged
  const newAlerts = alerts.filter(a => !a.is_acknowledged)
  const acknowledgedAlerts = alerts.filter(a => a.is_acknowledged)

  const getSeverityStyles = (severity) => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'bg-red-900/80',
          border: 'border-red-500',
          icon: <AlertTriangle className="w-5 h-5 text-red-400" />,
          iconClass: 'text-red-400'
        }
      case 'warning':
        return {
          bg: 'bg-yellow-900/80',
          border: 'border-yellow-500',
          icon: <AlertCircle className="w-5 h-5 text-yellow-400" />,
          iconClass: 'text-yellow-400'
        }
      default:
        return {
          bg: 'bg-blue-900/80',
          border: 'border-blue-500',
          icon: <Info className="w-5 h-5 text-blue-400" />,
          iconClass: 'text-blue-400'
        }
    }
  }

  const handleDismiss = async (alertId, e) => {
    e?.stopPropagation()
    try {
      await dismissAlert(alertId)
      if (onDismiss) onDismiss()
    } catch (error) {
      console.error('Failed to dismiss alert:', error)
    }
  }

  const handleAcknowledge = async (alertId, e) => {
    e?.stopPropagation()
    try {
      await acknowledgeAlert(alertId)
      if (onDismiss) onDismiss()
    } catch (error) {
      console.error('Failed to acknowledge alert:', error)
    }
  }

  return (
    <div className="space-y-2">
      {/* New/Unacknowledged Alerts - Show prominently */}
      {newAlerts.map((alert) => {
        const styles = getSeverityStyles(alert.severity)
        return (
          <div
            key={alert.id}
            className={`${styles.bg} border-l-4 ${styles.border} rounded-lg p-3 flex items-start gap-3`}
          >
            <div className="flex-shrink-0 mt-0.5">{styles.icon}</div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-white">{alert.title}</h3>
              {alert.message && (
                <p className="text-xs mt-0.5 text-gray-300">{alert.message}</p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={(e) => handleAcknowledge(alert.id, e)}
                className="p-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors"
                title="Got it - move to alerts section"
              >
                <Check className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={(e) => handleDismiss(alert.id, e)}
                className="p-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors"
                title="Dismiss alert"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        )
      })}

      {/* Acknowledged Alerts - Collapsible section */}
      {acknowledgedAlerts.length > 0 && (
        <div
          className="rounded-lg overflow-hidden"
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-default)'
          }}
        >
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-black/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                Alerts
              </span>
              <span className="text-xs text-gray-500">
                ({acknowledgedAlerts.length})
              </span>
            </div>
            {collapsed ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {!collapsed && (
            <div className="px-3 pb-2 space-y-1.5 max-h-48 overflow-y-auto">
              {acknowledgedAlerts.map((alert) => {
                const styles = getSeverityStyles(alert.severity)
                return (
                  <div
                    key={alert.id}
                    className={`rounded p-2 flex items-center gap-2 border-l-3 ${styles.border}`}
                    style={{ backgroundColor: 'var(--color-bg-surface-soft)' }}
                  >
                    <div className={`flex-shrink-0 ${styles.iconClass}`}>
                      {React.cloneElement(styles.icon, { className: 'w-4 h-4' })}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm truncate block" style={{ color: 'var(--color-text-primary)' }}>
                        {alert.title}
                      </span>
                    </div>
                    <button
                      onClick={(e) => handleDismiss(alert.id, e)}
                      className="p-1 rounded hover:bg-black/10 transition-colors flex-shrink-0"
                      title="Dismiss"
                    >
                      <X className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AlertBanner
