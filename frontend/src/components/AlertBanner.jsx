import React, { useState } from 'react'
import { AlertTriangle, AlertCircle, Info, X, Check, ChevronDown, ChevronUp, Bell } from 'lucide-react'
import { dismissAlert, acknowledgeAlert } from '../services/api'

function AlertBanner({ alerts, onDismiss }) {
  const [collapsed, setCollapsed] = useState(true)

  if (!alerts || alerts.length === 0) return null

  // Split alerts into new (unacknowledged) and acknowledged
  const newAlerts = alerts.filter(a => !a.is_acknowledged)
  const acknowledgedAlerts = alerts.filter(a => a.is_acknowledged)

  // Earth-toned alert colors
  const getSeverityStyles = (severity) => {
    switch (severity) {
      case 'critical':
        // Deep red
        return {
          bg: 'bg-[#7D1421]/90',
          border: 'border-[#A01C2B]',
          headerBg: 'bg-[#7D1421]/70',
          icon: <AlertTriangle className="w-5 h-5" style={{ color: '#E8A0A8' }} />,
          iconColor: '#E8A0A8',
          textColor: '#F5D0D4'
        }
      case 'warning':
        // Burnt orange
        return {
          bg: 'bg-[#B84F03]/90',
          border: 'border-[#D97706]',
          headerBg: 'bg-[#B84F03]/70',
          icon: <AlertCircle className="w-5 h-5" style={{ color: '#FCD9B6' }} />,
          iconColor: '#FCD9B6',
          textColor: '#FEF3E2'
        }
      default:
        // Forest green for info
        return {
          bg: 'bg-[#2C532C]/90',
          border: 'border-[#3D7A3D]',
          headerBg: 'bg-[#2C532C]/70',
          icon: <Info className="w-5 h-5" style={{ color: '#A8D4A8' }} />,
          iconColor: '#A8D4A8',
          textColor: '#D4F0D4'
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

  // Determine the most severe alert for the acknowledged section color
  const getMostSevere = (alerts) => {
    if (alerts.some(a => a.severity === 'critical')) return 'critical'
    if (alerts.some(a => a.severity === 'warning')) return 'warning'
    return 'info'
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
              <h3 className="font-semibold text-sm" style={{ color: styles.textColor }}>{alert.title}</h3>
              {alert.message && (
                <p className="text-xs mt-0.5" style={{ color: styles.textColor, opacity: 0.8 }}>{alert.message}</p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={(e) => handleAcknowledge(alert.id, e)}
                className="p-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors"
                title="Got it - move to alerts section"
              >
                <Check className="w-4 h-4" style={{ color: styles.textColor }} />
              </button>
              <button
                onClick={(e) => handleDismiss(alert.id, e)}
                className="p-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors"
                title="Dismiss alert"
              >
                <X className="w-4 h-4" style={{ color: styles.textColor }} />
              </button>
            </div>
          </div>
        )
      })}

      {/* Acknowledged Alerts - Collapsible section with alert-colored header */}
      {acknowledgedAlerts.length > 0 && (() => {
        const headerSeverity = getMostSevere(acknowledgedAlerts)
        const headerStyles = getSeverityStyles(headerSeverity)
        return (
          <div className={`rounded-lg overflow-hidden border-l-4 ${headerStyles.border}`}>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={`w-full px-3 py-2 flex items-center justify-between ${headerStyles.headerBg} hover:opacity-90 transition-opacity`}
            >
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4" style={{ color: headerStyles.iconColor }} />
                <span className="text-sm font-medium" style={{ color: headerStyles.textColor }}>
                  Acknowledged Alerts
                </span>
                <span className="text-xs" style={{ color: headerStyles.textColor, opacity: 0.7 }}>
                  ({acknowledgedAlerts.length})
                </span>
              </div>
              {collapsed ? (
                <ChevronDown className="w-4 h-4" style={{ color: headerStyles.iconColor }} />
              ) : (
                <ChevronUp className="w-4 h-4" style={{ color: headerStyles.iconColor }} />
              )}
            </button>

            {!collapsed && (
              <div className="px-3 py-2 space-y-2 bg-black/20 max-h-48 overflow-y-auto">
                {acknowledgedAlerts.map((alert) => {
                  const styles = getSeverityStyles(alert.severity)
                  return (
                    <div
                      key={alert.id}
                      className={`${styles.bg} rounded-lg p-2.5 flex items-start gap-2 border-l-2 ${styles.border}`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {React.cloneElement(styles.icon, { className: 'w-4 h-4' })}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium block" style={{ color: styles.textColor }}>
                          {alert.title}
                        </span>
                        {alert.message && (
                          <p className="text-xs mt-0.5" style={{ color: styles.textColor, opacity: 0.8 }}>{alert.message}</p>
                        )}
                      </div>
                      <button
                        onClick={(e) => handleDismiss(alert.id, e)}
                        className="p-1 rounded bg-white/10 hover:bg-white/20 transition-colors flex-shrink-0"
                        title="Dismiss"
                      >
                        <X className="w-3.5 h-3.5" style={{ color: styles.textColor }} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

export default AlertBanner
