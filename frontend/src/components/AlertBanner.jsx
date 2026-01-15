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
          bg: 'var(--color-red-900)',
          border: 'var(--color-red-500)',
          icon: <AlertTriangle className="w-5 h-5" style={{ color: 'var(--color-red-400)' }} />,
          iconColor: 'var(--color-red-400)'
        }
      case 'warning':
        return {
          bg: 'var(--color-gold-900)',
          border: 'var(--color-gold-500)',
          icon: <AlertCircle className="w-5 h-5" style={{ color: 'var(--color-gold-400)' }} />,
          iconColor: 'var(--color-gold-400)'
        }
      default:
        return {
          bg: 'var(--color-blue-900)',
          border: 'var(--color-blue-500)',
          icon: <Info className="w-5 h-5" style={{ color: 'var(--color-blue-400)' }} />,
          iconColor: 'var(--color-blue-400)'
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
            className="rounded-lg p-3 flex items-start gap-3"
            style={{
              backgroundColor: styles.bg,
              borderLeft: `4px solid ${styles.border}`,
              opacity: 0.9
            }}
          >
            <div className="flex-shrink-0 mt-0.5">{styles.icon}</div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>{alert.title}</h3>
              {alert.message && (
                <p className="text-xs mt-0.5 opacity-80" style={{ color: 'var(--color-text-secondary)' }}>{alert.message}</p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={(e) => handleAcknowledge(alert.id, e)}
                className="p-1.5 rounded transition-colors text-xs flex items-center gap-1"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                title="Got it"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => handleDismiss(alert.id, e)}
                className="p-1.5 rounded transition-colors"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                title="Dismiss"
              >
                <X className="w-4 h-4" />
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
            className="w-full px-3 py-2 flex items-center justify-between transition-colors"
            style={{ backgroundColor: 'transparent' }}
            onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-surface-hover)'}
            onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                Alerts
              </span>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                ({acknowledgedAlerts.length})
              </span>
            </div>
            {collapsed ? (
              <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
            ) : (
              <ChevronUp className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
            )}
          </button>

          {!collapsed && (
            <div className="px-3 pb-2 space-y-1.5 max-h-48 overflow-y-auto">
              {acknowledgedAlerts.map((alert) => {
                const styles = getSeverityStyles(alert.severity)
                return (
                  <div
                    key={alert.id}
                    className="rounded p-2 flex items-center gap-2"
                    style={{
                      backgroundColor: 'var(--color-bg-surface-soft)',
                      borderLeft: `3px solid ${styles.border}`
                    }}
                  >
                    <div className="flex-shrink-0" style={{ color: styles.iconColor }}>
                      {React.cloneElement(styles.icon, { className: 'w-4 h-4' })}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm truncate block" style={{ color: 'var(--color-text-primary)' }}>
                        {alert.title}
                      </span>
                    </div>
                    <button
                      onClick={(e) => handleDismiss(alert.id, e)}
                      className="p-1 rounded transition-colors flex-shrink-0"
                      style={{ backgroundColor: 'transparent' }}
                      onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-surface-hover)'}
                      onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      title="Dismiss"
                    >
                      <X className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
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
