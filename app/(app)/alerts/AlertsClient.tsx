'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Alert {
  id: string
  type: string
  severity: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  product: any | null
}

interface Props { alerts: Alert[] }

const SEVERITY_CONFIG: Record<string, { cls: string; icon: string; label: string }> = {
  CRITICAL: { cls: 'critical', icon: '🔴', label: 'Critical' },
  WARNING: { cls: 'warning', icon: '🟡', label: 'Warning' },
  INFO: { cls: 'info', icon: '🔵', label: 'Info' },
}

const TYPE_ICON: Record<string, string> = {
  LOW_STOCK: '📉',
  OVERSTOCK: '📦',
  DEMAND_SPIKE: '📈',
  STOCKOUT_RISK: '⚠️',
}

export default function AlertsClient({ alerts: initialAlerts }: Props) {
  const [alerts, setAlerts] = useState(initialAlerts)
  const [severityFilter, setSeverityFilter] = useState('')

  const resolveAlert = async (id: string) => {
    await fetch('/api/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'resolve' }),
    })
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  const resolveAll = async () => {
    await fetch('/api/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve_all' }),
    })
    setAlerts([])
  }

  const filtered = severityFilter ? alerts.filter(a => a.severity === severityFilter) : alerts

  const criticalCount = alerts.filter(a => a.severity === 'CRITICAL').length
  const warningCount = alerts.filter(a => a.severity === 'WARNING').length

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Alerts</h1>
          <p className="page-subtitle">
            {criticalCount > 0 && <span style={{ color: 'var(--accent-red)' }}>{criticalCount} critical • </span>}
            {warningCount > 0 && <span style={{ color: 'var(--accent-amber)' }}>{warningCount} warnings</span>}
            {alerts.length === 0 && 'All clear — no active alerts'}
          </p>
        </div>
        {alerts.length > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={resolveAll} id="resolve-all-btn">
            ✓ Resolve All
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <div className="card" style={{ padding: '16px 20px', borderColor: 'rgba(239,68,68,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>🔴</span>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-red)' }}>{criticalCount}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Critical Alerts</div>
            </div>
          </div>
        </div>
        <div className="card" style={{ padding: '16px 20px', borderColor: 'rgba(245,158,11,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>🟡</span>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-amber)' }}>{warningCount}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Warnings</div>
            </div>
          </div>
        </div>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>🛎️</span>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{alerts.length}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total Active</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {['', 'CRITICAL', 'WARNING', 'INFO'].map(sev => (
          <button
            key={sev}
            className={`btn btn-sm ${severityFilter === sev ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSeverityFilter(sev)}
            id={`alert-filter-${sev || 'all'}`}
          >
            {sev === '' ? 'All' : sev === 'CRITICAL' ? '🔴 Critical' : sev === 'WARNING' ? '🟡 Warning' : '🔵 Info'}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <div className="empty-state-title">No alerts</div>
            <div className="empty-state-desc">Your warehouse is running smoothly</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(alert => {
            const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.INFO
            return (
              <div key={alert.id} className={`alert-item ${config.cls}`} id={`alert-${alert.id}`}>
                <div style={{ fontSize: 22, flexShrink: 0 }}>
                  {TYPE_ICON[alert.type] || '🔔'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className={`badge badge-${config.cls === 'critical' ? 'red' : config.cls === 'warning' ? 'amber' : 'blue'}`}>
                      {config.icon} {config.label}
                    </span>
                    <span className="badge badge-gray" style={{ fontSize: 10 }}>
                      {alert.type.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="alert-title">{alert.title}</div>
                  <div className="alert-message">{alert.message}</div>
                  {alert.product && (
                    <div style={{ marginTop: 8, fontSize: 12 }}>
                      <span className="badge badge-gray">
                        📦 {alert.product.sku} — {alert.product.category?.name}
                      </span>
                    </div>
                  )}
                  <div className="alert-time">
                    🕐 {new Date(alert.createdAt).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  {alert.product && (
                    <Link href="/forecasting" className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} id={`alert-forecast-${alert.id}`}>
                      📈 Forecast
                    </Link>
                  )}
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => resolveAlert(alert.id)}
                    id={`resolve-alert-${alert.id}`}
                    style={{ fontSize: 11 }}
                  >
                    ✓ Resolve
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
