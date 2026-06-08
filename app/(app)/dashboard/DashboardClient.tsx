'use client'

import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

interface Props {
  stats: {
    totalProducts: number
    totalStockValue: number
    lowStockCount: number
    pendingOrders: number
    totalOrderValue: number
    activeAlerts: number
  }
  categoryData: Array<{ name: string; count: number; value: number; color: string }>
  dailyMovement: Array<{ date: string; quantity: number }>
  topMovers: Array<{ name: string; quantity: number; category: string }>
  warehouseData: Array<{ name: string; location: string; capacity: number; used: number }>
  userName: string
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981']

function MetricCard({ icon, label, value, change, color, bg }: any) {
  return (
    <div className="metric-card" style={{ '--accent-color': color } as any}>
      <div className="metric-icon" style={{ background: bg }}>
        {icon}
      </div>
      <div className="metric-content">
        <div className="metric-label">{label}</div>
        <div className="metric-value">{value}</div>
        {change && <div className={`metric-change ${change.type}`}>{change.text}</div>}
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 13,
      }}>
        <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ color: p.color, fontWeight: 600 }}>
            {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
          </div>
        ))}
      </div>
    )
  }
  return null
}

export default function DashboardClient({
  stats, categoryData, dailyMovement, topMovers, warehouseData, userName
}: Props) {
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{greeting}, {userName.split(' ')[0]} 👋</h1>
          <p className="page-subtitle">Here's what's happening in your warehouse today</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{
            padding: '8px 16px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 13,
            color: 'var(--text-secondary)',
          }}>
            📅 {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="metrics-grid">
        <MetricCard
          icon="📦"
          label="Total SKUs"
          value={stats.totalProducts.toLocaleString()}
          change={{ type: 'neutral', text: 'Across all warehouses' }}
          color="#3b82f6"
          bg="rgba(59,130,246,0.12)"
        />
        <MetricCard
          icon="💰"
          label="Stock Value"
          value={`$${(stats.totalStockValue / 1000).toFixed(0)}K`}
          change={{ type: 'positive', text: `$${stats.totalStockValue.toLocaleString('en-US', { maximumFractionDigits: 0 })} total` }}
          color="#10b981"
          bg="rgba(16,185,129,0.12)"
        />
        <MetricCard
          icon="⚠️"
          label="Low Stock Items"
          value={stats.lowStockCount.toString()}
          change={{ type: stats.lowStockCount > 5 ? 'negative' : 'neutral', text: 'Need attention' }}
          color="#f59e0b"
          bg="rgba(245,158,11,0.12)"
        />
        <MetricCard
          icon="🛒"
          label="Pending Orders"
          value={stats.pendingOrders.toString()}
          change={{ type: 'neutral', text: `${stats.activeAlerts} active alerts` }}
          color="#ef4444"
          bg="rgba(239,68,68,0.12)"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="charts-grid" style={{ marginBottom: 20 }}>
        {/* Daily Movement */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Daily Demand (Last 30 Days)</div>
              <div className="card-subtitle">Units dispatched per day</div>
            </div>
          </div>
          <div className="card-body" style={{ paddingTop: 12 }}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailyMovement}>
                <defs>
                  <linearGradient id="demandGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} interval={4} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="quantity" stroke="#3b82f6" strokeWidth={2} fill="url(#demandGrad)" name="Units" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Stock by Category</div>
              <div className="card-subtitle">Value distribution</div>
            </div>
          </div>
          <div className="card-body" style={{ paddingTop: 12 }}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={index} fill={entry.color || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`$${Number(val).toLocaleString('en-US', { maximumFractionDigits: 0 })}`, 'Value']}
                  contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8 }}
                  labelStyle={{ color: 'var(--text-primary)' }}
                  itemStyle={{ color: 'var(--text-secondary)' }}
                />
                <Legend
                  formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Top Moving Products */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Top Moving Products</div>
              <div className="card-subtitle">Last 30 days</div>
            </div>
          </div>
          <div className="card-body" style={{ paddingTop: 12 }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topMovers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={110} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="quantity" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Units Sold" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Warehouse Utilization */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Warehouse Utilization</div>
              <div className="card-subtitle">Current stock vs capacity</div>
            </div>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
              {warehouseData.map((w, i) => {
                const pct = Math.min(100, Math.round((w.used / w.capacity) * 100))
                const color = pct > 80 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#10b981'
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{w.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{w.location}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color }}>{pct}%</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{w.used.toLocaleString()} / {w.capacity.toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}aa, ${color})` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
