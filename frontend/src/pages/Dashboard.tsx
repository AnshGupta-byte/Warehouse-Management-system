import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { Link } from 'react-router-dom';
import {
  BarChart as RechartsBarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, AlertTriangle, Boxes, ClipboardCheck,
  ArrowUpRight, ArrowDownRight, Circle, ExternalLink,
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
      <div className="flex h-64 items-center justify-center gap-3">
        <div className="spinner" /><span className="text-[12px]" style={{ color: '#4a5f7a' }}>Loading...</span>
      </div>
    );
  }

  const kpis = [
    { label: 'TOTAL SKUs', value: stats.totalSKUs, sub: 'Managed products', accentColor: '#3b82f6' },
    { label: 'STOCK UNITS', value: stats.totalStockUnits.toLocaleString(), sub: 'Across all locations', accentColor: '#10b981' },
    { label: 'INVENTORY VALUE', value: `$${stats.valuation.toLocaleString()}`, sub: 'Total asset value', accentColor: '#7c3aed' },
    { label: 'ACTIVE ALERTS', value: stats.activeAlerts, sub: stats.activeAlerts > 0 ? 'Requires attention' : 'All systems nominal', accentColor: stats.activeAlerts > 0 ? '#ef4444' : '#1e2d45' },
  ];

  return (
    <div className="space-y-5 fade-in">
      {/* ── Header ──────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[14px] font-semibold text-white">Operations Overview</h1>
          <p className="text-[11px] mt-0.5" style={{ color: '#4a5f7a' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Circle className="h-2 w-2 fill-emerald-400 text-emerald-400" style={{ animation: 'pulse 2s infinite' }} />
          <span className="badge badge-green text-[9px]">LIVE</span>
        </div>
      </div>

      {/* ── KPIs ────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="kpi-card" style={{ '--kpi-accent': k.accentColor } as any}>
            <style>{`.kpi-card:nth-child(${kpis.indexOf(k) + 1})::before { background: linear-gradient(90deg, ${k.accentColor}, transparent); }`}</style>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
            <div className="kpi-trend" style={{ color: '#4a5f7a' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Main grid ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Stock chart */}
        <div className="lg:col-span-2 panel">
          <div className="panel-header">
            <span className="panel-title">Inventory vs Reorder Levels</span>
            <div className="flex items-center gap-4 text-[10px]" style={{ color: '#4a5f7a' }}>
              <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: '#3b82f6' }} />Stock</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: '#f59e0b' }} />Reorder</span>
            </div>
          </div>
          <div className="p-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={14} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
                <XAxis dataKey="name" stroke="#2d4060" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis stroke="#2d4060" fontSize={9} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#0b1120', border: '1px solid #1e2d45', borderRadius: 4, fontSize: 11 }} labelStyle={{ color: '#cbd5e1', fontWeight: 600 }} cursor={{ fill: '#1e2d4510' }} />
                <Bar dataKey="Stock" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                <Bar dataKey="ReorderPoint" fill="#f59e0b" radius={[2, 2, 0, 0]} opacity={0.7} />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Low stock watchlist */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Low Stock Watchlist</span>
            <span className="badge badge-amber">{lowStockItems.length} items</span>
          </div>
          {lowStockItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-[12px] font-medium mb-1" style={{ color: '#4a5f7a' }}>All stock levels healthy</div>
              <div className="text-[11px]" style={{ color: '#2d4060' }}>No items below reorder point</div>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#111e35' }}>
              {lowStockItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-4 py-2.5 transition-all" style={{ cursor: 'default' }} onMouseEnter={e => (e.currentTarget.style.background = '#0f1729')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-medium truncate" style={{ color: '#cbd5e1' }}>{item.name}</div>
                    <div className="mono text-[10px] mt-0.5" style={{ color: '#4a5f7a' }}>{item.sku} · min {item.reorderPoint}</div>
                  </div>
                  <span className="badge badge-red ml-3 flex-shrink-0">{item.quantity} left</span>
                </div>
              ))}
            </div>
          )}
          {lowStockItems.length > 0 && (
            <div className="px-4 py-2.5" style={{ borderTop: '1px solid #1e2d45' }}>
              <Link to="/forecasting" className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: '#60a5fa' }}>
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
            <Link to="/orders" className="flex items-center gap-1 text-[11px]" style={{ color: '#60a5fa' }}>
              View all <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <div className="py-8 text-center text-[12px]" style={{ color: '#4a5f7a' }}>No recent orders</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Type</th>
                  <th>Partner</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order: any) => (
                  <tr key={order.id}>
                    <td><span className="mono" style={{ color: '#60a5fa' }}>{order.orderNumber}</span></td>
                    <td><span className={order.type === 'PURCHASE' ? 'badge badge-blue' : 'badge badge-purple'}>{order.type === 'PURCHASE' ? 'PO' : 'SO'}</span></td>
                    <td style={{ color: '#cbd5e1', maxWidth: 120 }}><span className="truncate block">{order.type === 'PURCHASE' ? order.supplier : order.customer}</span></td>
                    <td className="text-right font-mono font-semibold text-white text-[11px]">${order.totalAmount.toLocaleString()}</td>
                    <td className="text-right"><span className={STATUS_BADGE[order.status] || 'badge badge-gray'}>{order.status}</span></td>
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
            <div className="flex items-center gap-1.5"><Circle className="h-2 w-2 fill-emerald-400 text-emerald-400" /><span className="text-[10px]" style={{ color: '#4a5f7a' }}>Live</span></div>
          </div>
          {recentMovements.length === 0 ? (
            <div className="py-8 text-center text-[12px]" style={{ color: '#4a5f7a' }}>No recent movements</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Ref</th>
                  <th className="text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {recentMovements.map((move: any) => (
                  <tr key={move.id}>
                    <td style={{ color: '#2d4060', whiteSpace: 'nowrap' }}>{new Date(move.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ color: '#cbd5e1', maxWidth: 120 }}><span className="truncate block">{move.name}</span></td>
                    <td><span className="mono">{move.sku}</span></td>
                    <td style={{ color: '#4a5f7a' }}>{move.reason}</td>
                    <td className="text-right">
                      <span className="flex items-center justify-end gap-1 font-mono font-semibold text-[11px]" style={{ color: move.type === 'IN' ? '#10b981' : '#ef4444' }}>
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
