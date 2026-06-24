import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { Link } from 'react-router-dom';
import {
  BarChart as RechartsBarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Package, DollarSign, AlertTriangle, Boxes, ExternalLink,
} from 'lucide-react';

const STATUS_BADGE: Record<string, string> = {
  DELIVERED: 'badge badge-green',
  PENDING:   'badge badge-amber',
  CONFIRMED: 'badge badge-blue',
  SHIPPED:   'badge badge-blue',
  CANCELLED: 'badge badge-gray',
};

export const Dashboard: React.FC = () => {
  const { subscribe } = useSocket();

  const [stats, setStats] = useState({ totalSKUs: 0, totalStockUnits: 0, valuation: 0, activeAlerts: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [recentMovements, setRecentMovements] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    try {
      const [prodRes, orderRes, alertRes] = await Promise.all([
        api.products.list(), api.orders.list(), api.alerts.list({ isResolved: false }),
      ]);
      if (prodRes.success && orderRes.success && alertRes.success) {
        const products = prodRes.products;
        const orders = orderRes.orders;
        const alerts = alertRes.alerts;
        let stockUnits = 0, totalValuation = 0;
        const lowStockList: any[] = [];
        const formattedChartData = products.map((p: any) => {
          const qty = p.stockLevels.reduce((sum: number, sl: any) => sum + sl.quantity, 0);
          stockUnits += qty; totalValuation += qty * p.unitPrice;
          if (qty <= p.reorderPoint) lowStockList.push({ ...p, quantity: qty });
          return { name: p.name.length > 14 ? p.name.substring(0, 14) + '…' : p.name, Stock: qty, ReorderPoint: p.reorderPoint };
        });
        setStats({ totalSKUs: products.length, totalStockUnits: stockUnits, valuation: parseFloat(totalValuation.toFixed(2)), activeAlerts: alerts.length });
        setChartData(formattedChartData);
        setLowStockItems(lowStockList);
        setRecentOrders(orders.slice(0, 6));
      }
    } catch (err) { console.error('[Dashboard]', err); }
  };

  const loadMovementHistory = async () => {
    const mockHist = [
      { id: '1', sku: 'FOOD-3001', name: 'Colombian Coffee Beans', type: 'IN', quantity: 100, reason: 'PO-20001', date: new Date(Date.now() - 3600000 * 2) },
      { id: '2', sku: 'ELEC-1001', name: 'UltraHD Smart TV', type: 'OUT', quantity: 6, reason: 'SO-10004', date: new Date(Date.now() - 3600000 * 5) },
      { id: '3', sku: 'APPR-2001', name: 'Waterproof Mountain Parka', type: 'OUT', quantity: 20, reason: 'SO-10002', date: new Date(Date.now() - 3600000 * 12) },
    ];
    setRecentMovements(mockHist);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadDashboardData(), loadMovementHistory()]).finally(() => setLoading(false));
    const u1 = subscribe('STOCK_UPDATED', (payload) => {
      loadDashboardData();
      setRecentMovements((prev) => [{
        id: Math.random().toString(), sku: payload.data.product.sku,
        name: payload.data.product.name, type: 'ADJUST',
        quantity: Math.abs(payload.data.stockLevel.quantity), reason: 'Manual', date: new Date(),
      }, ...prev.slice(0, 4)]);
    });
    const u2 = subscribe('ORDER_UPDATED', () => loadDashboardData());
    const u3 = subscribe('ALERT_CREATED', () => loadDashboardData());
    return () => { u1(); u2(); u3(); };
  }, [subscribe]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 skeleton rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 h-80 skeleton rounded-xl" />
          <div className="h-80 skeleton rounded-xl" />
        </div>
      </div>
    );
  }

  const kpis = [
    {
      label: 'Total SKUs', value: stats.totalSKUs, trend: '+3 this month', trendType: 'up' as const,
      icon: Package, iconColor: '#3b82f6', iconBg: 'rgba(37,99,235,0.1)',
    },
    {
      label: 'Stock Volume', value: stats.totalStockUnits.toLocaleString(), trend: 'Across all locations', trendType: 'neutral' as const,
      icon: Boxes, iconColor: '#10b981', iconBg: 'rgba(16,185,129,0.1)',
    },
    {
      label: 'Inventory Value', value: `$${stats.valuation.toLocaleString()}`, trend: '+12% vs last month', trendType: 'up' as const,
      icon: DollarSign, iconColor: '#a78bfa', iconBg: 'rgba(124,58,237,0.1)',
    },
    {
      label: 'Active Alerts', value: stats.activeAlerts,
      trend: stats.activeAlerts > 0 ? 'Needs attention' : 'All systems nominal',
      trendType: stats.activeAlerts > 0 ? 'down' as const : 'neutral' as const,
      icon: AlertTriangle, iconColor: stats.activeAlerts > 0 ? '#f87171' : '#a1a1aa',
      iconBg: stats.activeAlerts > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(113,113,122,0.1)',
    },
  ];

  return (
    <div className="space-y-6 slide-up">
      {/* ── KPIs ────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="kpi-card">
              <div className="kpi-icon" style={{ background: k.iconBg }}>
                <Icon className="h-5 w-5" style={{ color: k.iconColor }} />
              </div>
              <div className="kpi-value">{k.value}</div>
              <div className="kpi-label">{k.label}</div>
              <div className={`kpi-trend ${k.trendType}`}>
                {k.trendType === 'up' && <TrendingUp className="h-3 w-3" />}
                {k.trendType === 'down' && <TrendingDown className="h-3 w-3" />}
                {k.trend}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Main grid ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Stock chart */}
        <div className="lg:col-span-2 panel">
          <div className="panel-header">
            <span className="panel-title">Inventory vs Reorder Levels</span>
            <div className="flex items-center gap-5 text-[12px]" style={{ color: '#52525b' }}>
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded" style={{ background: '#2563eb' }} />Current Stock</span>
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded" style={{ background: '#f59e0b', opacity: 0.7 }} />Reorder Point</span>
            </div>
          </div>
          <div className="p-5" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barSize={16} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" stroke="#3f3f46" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#3f3f46" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#fafafa', fontWeight: 600, marginBottom: 4 }}
                  cursor={{ fill: 'rgba(39,39,42,0.3)' }}
                />
                <Bar dataKey="Stock" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ReorderPoint" fill="#f59e0b" radius={[4, 4, 0, 0]} opacity={0.7} />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Low stock watchlist */}
        <div className="panel flex flex-col">
          <div className="panel-header">
            <span className="panel-title">Low Stock Watchlist</span>
            <span className="badge badge-amber">{lowStockItems.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {lowStockItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center px-4">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-3" style={{ background: '#18181b' }}>
                  <Package className="h-5 w-5" style={{ color: '#3f3f46' }} />
                </div>
                <div className="text-[14px] font-medium text-[var(--text-secondary)] mb-1">All stock healthy</div>
                <div className="text-[12px]" style={{ color: '#52525b' }}>No items below reorder point</div>
              </div>
            ) : (
              <div>
                {lowStockItems.map((item) => {
                  const pct = Math.round((item.quantity / Math.max(item.reorderPoint, 1)) * 100);
                  return (
                    <div key={item.id} className="px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors" style={{ borderBottom: '1px solid #1c1c1f' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="min-w-0 flex-1 mr-3">
                          <div className="text-[13px] font-medium truncate text-[var(--text-primary)]">{item.name}</div>
                          <div className="mono text-[11px] mt-0.5" style={{ color: '#52525b' }}>{item.sku}</div>
                        </div>
                        <span className="badge badge-red flex-shrink-0">{item.quantity} left</span>
                      </div>
                      <div className="progress-bar">
                        <div className="fill" style={{ width: `${Math.min(pct, 100)}%`, background: pct < 50 ? '#ef4444' : '#f59e0b' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {lowStockItems.length > 0 && (
            <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid #27272a' }}>
              <Link to="/forecasting" className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--accent)] hover:text-[var(--accent-light)] transition-colors">
                <TrendingUp className="h-3.5 w-3.5" /> Generate reorder recommendations
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom grid ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent orders */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Recent Orders</span>
            <Link to="/orders" className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--accent)] hover:text-[var(--accent-light)] transition-colors">
              View all <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <div className="py-12 text-center text-[13px]" style={{ color: '#52525b' }}>No recent orders</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Type</th>
                  <th>Partner</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order: any) => (
                  <tr key={order.id}>
                    <td><span className="mono font-medium" style={{ color: '#3b82f6' }}>{order.orderNumber}</span></td>
                    <td><span className={order.type === 'PURCHASE' ? 'badge badge-blue' : 'badge badge-purple'}>{order.type === 'PURCHASE' ? 'PO' : 'SO'}</span></td>
                    <td className="text-[var(--text-primary)]" style={{ maxWidth: 140 }}><span className="truncate block">{order.type === 'PURCHASE' ? order.supplier : order.customer}</span></td>
                    <td style={{ textAlign: 'right' }}><span className="mono font-semibold text-[var(--text-primary)]">${order.totalAmount.toLocaleString()}</span></td>
                    <td style={{ textAlign: 'right' }}><span className={STATUS_BADGE[order.status] || 'badge badge-gray'}>{order.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Live movements */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Stock Movements</span>
            <div className="flex items-center gap-2">
              <span className="status-dot online" />
              <span className="text-[12px]" style={{ color: '#52525b' }}>Live</span>
            </div>
          </div>
          {recentMovements.length === 0 ? (
            <div className="py-12 text-center text-[13px]" style={{ color: '#52525b' }}>No recent movements</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Ref</th>
                  <th style={{ textAlign: 'right' }}>Qty</th>
                </tr>
              </thead>
              <tbody>
                {recentMovements.map((move: any) => (
                  <tr key={move.id}>
                    <td style={{ color: '#52525b', whiteSpace: 'nowrap' }}>{new Date(move.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="text-[var(--text-primary)]" style={{ maxWidth: 140 }}><span className="truncate block">{move.name}</span></td>
                    <td><span className="mono" style={{ color: '#a1a1aa' }}>{move.sku}</span></td>
                    <td style={{ color: '#52525b' }}>{move.reason}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="flex items-center justify-end gap-1 mono font-semibold text-[12px]" style={{ color: move.type === 'IN' ? '#10b981' : '#ef4444' }}>
                        {move.type === 'IN' ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                        {move.type === 'IN' ? '+' : '-'}{move.quantity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
