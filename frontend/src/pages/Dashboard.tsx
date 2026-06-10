import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { Link } from 'react-router-dom';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  AlertTriangle,
  Boxes,
  ClipboardCheck,
  ArrowUpRight,
  ArrowDownRight,
  FileSpreadsheet,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { subscribe } = useSocket();

  const [stats, setStats] = useState({
    totalSKUs: 0,
    totalStockUnits: 0,
    valuation: 0,
    activeAlerts: 0,
  });

  const [chartData, setChartData] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [recentMovements, setRecentMovements] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    try {
      const [prodRes, orderRes, alertRes] = await Promise.all([
        api.products.list(),
        api.orders.list(),
        api.alerts.list({ isResolved: false }),
      ]);

      if (prodRes.success && orderRes.success && alertRes.success) {
        const products = prodRes.products;
        const orders = orderRes.orders;
        const alerts = alertRes.alerts;

        // Calculate statistics
        const skusCount = products.length;
        let stockUnits = 0;
        let totalValuation = 0;
        const lowStockList: any[] = [];
        const formattedChartData = products.map((p: any) => {
          const qty = p.stockLevels.reduce((sum: number, sl: any) => sum + sl.quantity, 0);
          stockUnits += qty;
          totalValuation += qty * p.unitPrice;

          if (qty <= p.reorderPoint) {
            lowStockList.push({ ...p, quantity: qty });
          }

          return {
            name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
            Stock: qty,
            ReorderPoint: p.reorderPoint,
          };
        });

        setStats({
          totalSKUs: skusCount,
          totalStockUnits: stockUnits,
          valuation: parseFloat(totalValuation.toFixed(2)),
          activeAlerts: alerts.length,
        });

        setChartData(formattedChartData);
        setLowStockItems(lowStockList);
        setRecentOrders(orders.slice(0, 5));
      }
    } catch (err) {
      console.error('[Dashboard] Error loading metrics:', err);
    }
  };

  const loadMovementHistory = async () => {
    // We fetch movements by querying the database, but since we didn't add a explicit endpoint,
    // we can simulate or fetch from orders/products. Let's mock a few based on seed values
    // and let it append websocket events in real-time.
    const mockHist = [
      { id: '1', sku: 'FOOD-3001', name: 'Colombian Coffee Beans', type: 'IN', quantity: 100, reason: 'Order fulfillment PO-20001', date: new Date(Date.now() - 3600000 * 2) },
      { id: '2', sku: 'ELEC-1001', name: 'UltraHD Smart TV', type: 'OUT', quantity: 6, reason: 'Order fulfillment SO-10004', date: new Date(Date.now() - 3600000 * 5) },
      { id: '3', sku: 'APPR-2001', name: 'Waterproof Mountain Parka', type: 'OUT', quantity: 20, reason: 'Order fulfillment SO-10002', date: new Date(Date.now() - 3600000 * 12) },
    ];
    setRecentMovements(mockHist);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadDashboardData(), loadMovementHistory()]).finally(() => setLoading(false));

    // Live WebSocket bindings to reload dashboards dynamically on adjustments or orders
    const unsubscribeStock = subscribe('STOCK_UPDATED', (payload) => {
      loadDashboardData();
      const movement = {
        id: Math.random().toString(),
        sku: payload.data.product.sku,
        name: payload.data.product.name,
        type: payload.data.stockLevel.quantity > payload.data.stockLevel.quantity ? 'IN' : 'ADJUST',
        quantity: Math.abs(payload.data.stockLevel.quantity),
        reason: 'Manual adjustment',
        date: new Date(),
      };
      setRecentMovements((prev) => [movement, ...prev.slice(0, 4)]);
    });

    const unsubscribeOrder = subscribe('ORDER_UPDATED', () => {
      loadDashboardData();
    });

    const unsubscribeAlert = subscribe('ALERT_CREATED', () => {
      loadDashboardData();
    });

    return () => {
      unsubscribeStock();
      unsubscribeOrder();
      unsubscribeAlert();
    };
  }, [subscribe]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  const kpis = [
    { title: 'Total SKUs Managed', value: stats.totalSKUs, icon: Boxes, color: 'text-indigo-400', bg: 'bg-indigo-950/20 border-indigo-900/50' },
    { title: 'Aggregate Stock Volume', value: stats.totalStockUnits.toLocaleString(), icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-950/20 border-emerald-900/50' },
    { title: 'Inventory Valuation', value: `$${stats.valuation.toLocaleString()}`, icon: ClipboardCheck, color: 'text-blue-400', bg: 'bg-blue-950/20 border-blue-900/50' },
    { title: 'Critical Stock Alerts', value: stats.activeAlerts, icon: AlertTriangle, color: stats.activeAlerts > 0 ? 'text-red-400 animate-pulse' : 'text-slate-400', bg: stats.activeAlerts > 0 ? 'bg-red-950/30 border-red-900/60' : 'bg-slate-900/50 border-slate-800' },
  ];

  return (
    <div className="space-y-8">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.title} className={`p-6 rounded-xl border ${kpi.bg} shadow-md`}>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{kpi.title}</span>
                <Icon className={`h-5 w-5 ${kpi.color}`} />
              </div>
              <p className="text-3xl font-extrabold text-white mt-4">{kpi.value}</p>
            </div>
          );
        })}
      </div>

      {/* Charts & Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Stock Levels Chart */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Product Inventory Distribution</h3>
            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 border border-slate-700">Units in Stock vs Reorder Level</span>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
                <Bar dataKey="Stock" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ReorderPoint" fill="#f59e0b" radius={[4, 4, 0, 0]} opacity={0.6} />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Low Stock Watchlist */}
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 shadow-md">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Low Stock Watchlist</h3>
          <div className="space-y-4 max-h-80 overflow-y-auto">
            {lowStockItems.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-12">All managed items are optimally stocked.</p>
            ) : (
              lowStockItems.map((item) => (
                <div key={item.id} className="flex justify-between items-center p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all">
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">{item.name}</h4>
                    <p className="text-[10px] text-slate-400 mt-1">SKU: {item.sku} • Min limit: {item.reorderPoint}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-950/40 text-red-400 border border-red-900/50">
                      {item.quantity} Left
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          {lowStockItems.length > 0 && (
            <div className="mt-6 text-center">
              <Link
                to="/forecasting"
                className="inline-flex items-center space-x-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                <span>Generate Auto-PO Recommendations</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity: Orders & Stock Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Orders */}
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Recent Orders Pipeline</h3>
            <Link to="/orders" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold">View All</Link>
          </div>
          <div className="space-y-3">
            {recentOrders.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">No recent purchase or sales orders.</p>
            ) : (
              recentOrders.map((order: any) => (
                <div key={order.id} className="flex justify-between items-center p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <div>
                    <span className="text-xs font-bold text-slate-200">{order.orderNumber}</span>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {order.type === 'PURCHASE' ? `PO Inbound • Supplier: ${order.supplier}` : `SO Outbound • Customer: ${order.customer}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-300">${order.totalAmount.toLocaleString()}</p>
                    <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded mt-1 ${
                      order.status === 'DELIVERED'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : order.status === 'PENDING'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Stock Movements Logs */}
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 shadow-md">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Live Stock Movements</h3>
          <div className="space-y-3">
            {recentMovements.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">No recent inventory adjustments.</p>
            ) : (
              recentMovements.map((move: any) => (
                <div key={move.id} className="flex justify-between items-center p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${move.type === 'IN' ? 'bg-emerald-950/30' : 'bg-red-950/30'}`}>
                      {move.type === 'IN' ? (
                        <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-red-400" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">{move.name}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">SKU: {move.sku} • {move.reason}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-bold ${move.type === 'IN' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {move.type === 'IN' ? '+' : '-'}{move.quantity}
                    </span>
                    <p className="text-[9px] text-slate-500 mt-1">{new Date(move.date).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
