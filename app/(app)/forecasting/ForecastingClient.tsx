'use client'

import { useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'

interface Product { id: string; name: string; sku: string; category: { name: string } }

interface Props {
  products: Product[]
}

export default function ForecastingClient({ products }: Props) {
  const [selectedProduct, setSelectedProduct] = useState<string>('')
  const [forecastDays, setForecastDays] = useState(90)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const runForecast = async () => {
    if (!selectedProduct) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: selectedProduct, forecastDays }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Forecast failed')
      setResult(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const selectedProductData = products.find(p => p.id === selectedProduct)

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '10px 14px',
          fontSize: 12,
        }}>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>{label}</div>
          {payload.map((p: any, i: number) => (
            <div key={i} style={{ color: p.color, marginBottom: 2 }}>
              {p.name}: <strong>{Math.round(p.value)}</strong> units
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Demand Forecasting</h1>
          <p className="page-subtitle">Prophet-powered time-series predictions with confidence intervals</p>
        </div>
        <div style={{
          padding: '8px 16px',
          background: 'rgba(59,130,246,0.1)',
          border: '1px solid rgba(59,130,246,0.3)',
          borderRadius: 8,
          fontSize: 13,
          color: 'var(--accent-blue)',
          fontWeight: 600,
        }}>
          🤖 Powered by Prophet ML
        </div>
      </div>

      {/* Controls */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 16, alignItems: 'end' }}>
          <div className="input-group">
            <label className="input-label">Select Product</label>
            <select
              className="input"
              value={selectedProduct}
              onChange={e => setSelectedProduct(e.target.value)}
              id="forecast-product-select"
            >
              <option value="">-- Choose a product to forecast --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Forecast Period</label>
            <select
              className="input"
              value={forecastDays}
              onChange={e => setForecastDays(parseInt(e.target.value))}
              id="forecast-days-select"
            >
              <option value={30}>30 Days</option>
              <option value={60}>60 Days</option>
              <option value={90}>90 Days</option>
            </select>
          </div>
          <button
            className="btn btn-primary"
            onClick={runForecast}
            disabled={!selectedProduct || loading}
            id="run-forecast-btn"
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                Forecasting...
              </>
            ) : (
              <>🚀 Run Forecast</>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 12,
          padding: 20,
          color: 'var(--accent-red)',
          marginBottom: 20,
        }}>
          ⚠️ {error}
          {error.includes('AI service') && (
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
              Make sure the Python AI service is running: <code>cd python-ai && uvicorn main:app --reload</code>
            </div>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px', width: 40, height: 40, borderWidth: 3 }} />
          <div style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
            Running Prophet ML forecast for {selectedProductData?.name}...
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>
            Analyzing {forecastDays}-day demand patterns with weekly & seasonal decomposition
          </div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <>
          {/* Summary Cards */}
          <div className="metrics-grid" style={{ marginBottom: 20 }}>
            <div className="metric-card">
              <div className="metric-icon" style={{ background: 'rgba(59,130,246,0.12)' }}>📈</div>
              <div className="metric-content">
                <div className="metric-label">Predicted Demand</div>
                <div className="metric-value">{Math.round(result.summary.total_predicted).toLocaleString()}</div>
                <div className="metric-change neutral">over {result.summary.forecast_days} days</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon" style={{ background: 'rgba(16,185,129,0.12)' }}>📊</div>
              <div className="metric-content">
                <div className="metric-label">Avg Daily Demand</div>
                <div className="metric-value">{Math.round(result.summary.avg_daily_demand)}</div>
                <div className="metric-change neutral">units/day</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon" style={{ background: 'rgba(245,158,11,0.12)' }}>⚡</div>
              <div className="metric-content">
                <div className="metric-label">Peak Daily Demand</div>
                <div className="metric-value">{Math.round(result.summary.peak_daily_demand)}</div>
                <div className="metric-change neutral">units/day max</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon" style={{ background: 'rgba(139,92,246,0.12)' }}>📦</div>
              <div className="metric-content">
                <div className="metric-label">Current Stock</div>
                <div className="metric-value">{result.currentStock?.toLocaleString()}</div>
                <div className="metric-change neutral">units available</div>
              </div>
            </div>
          </div>

          {/* AI Recommendation */}
          <div style={{
            background: result.recommendation?.includes('⚠️') ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)',
            border: `1px solid ${result.recommendation?.includes('⚠️') ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`,
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: 20,
            fontSize: 14,
          }}>
            <strong>🤖 AI Recommendation:</strong> {result.recommendation}
          </div>

          {/* Forecast Chart */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Demand Forecast — {result.product?.name}</div>
                <div className="card-subtitle">
                  Model: {result.modelUsed} • Confidence: {result.summary.confidence_level}
                </div>
              </div>
            </div>
            <div className="card-body" style={{ paddingTop: 12 }}>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={result.forecast}>
                  <defs>
                    <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="upperGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.08} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} interval={Math.floor(result.forecast.length / 8)} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="upper" stroke="#06b6d4" strokeWidth={1} strokeDasharray="4 4" fill="url(#upperGrad)" name="Upper Bound" />
                  <Area type="monotone" dataKey="predicted" stroke="#3b82f6" strokeWidth={2.5} fill="url(#forecastGrad)" name="Predicted" />
                  <Area type="monotone" dataKey="lower" stroke="#8b5cf6" strokeWidth={1} strokeDasharray="4 4" fill="none" name="Lower Bound" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div className="card">
          <div className="empty-state" style={{ padding: '80px 20px' }}>
            <div className="empty-state-icon" style={{ fontSize: 64 }}>🔮</div>
            <div className="empty-state-title" style={{ fontSize: 20 }}>Select a product to forecast demand</div>
            <div className="empty-state-desc" style={{ maxWidth: 400 }}>
              Our Prophet ML model will analyze historical sales patterns, detect weekly and seasonal trends,
              and generate confidence-bounded demand predictions.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
