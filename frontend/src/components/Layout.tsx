import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../services/api';
import {
  LayoutDashboard, Boxes, ClipboardList, LineChart, Bell,
  LogOut, User as UserIcon, Sparkles, Layers, Users,
  X, Check, AlertTriangle, Clock,
  BellOff,
} from 'lucide-react';

// ─── Notification Drawer ────────────────────────────────────────────────────

interface NotificationDrawerProps {
  open: boolean;
  onClose: () => void;
  alerts: any[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onResolve: (id: string) => void;
  onMarkAllRead: () => void;
}

const SEVERITY_CONFIG: Record<string, { bg: string; border: string; text: string }> = {
  CRITICAL: { bg: 'bg-red-950/30', border: 'border-red-800/60', text: 'text-red-400' },
  WARNING: { bg: 'bg-amber-950/30', border: 'border-amber-800/60', text: 'text-amber-400' },
  INFO: { bg: 'bg-blue-950/30', border: 'border-blue-800/60', text: 'text-blue-400' },
};

const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  open, onClose, alerts, unreadCount, onMarkRead, onResolve, onMarkAllRead,
}) => {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 transition-opacity"
          onClick={onClose}
        />
      )}
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-slate-950 border-l border-slate-800 z-40 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/80 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <Bell className="h-5 w-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold text-white">Notifications</h2>
              <p className="text-xs text-slate-400">{alerts.length} active · {unreadCount} unread</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <button onClick={onMarkAllRead} className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold px-2 py-1 rounded hover:bg-slate-800 transition-all">
                Mark all read
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <BellOff className="h-12 w-12 text-slate-700 mb-4" />
              <p className="text-slate-500 text-sm font-medium">All clear!</p>
              <p className="text-slate-600 text-xs mt-1">No active alerts or warnings</p>
            </div>
          ) : (
            alerts.map((alert) => {
              const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.INFO;
              const isUnread = !alert.isRead;
              return (
                <div key={alert.id} className={`p-4 rounded-xl border transition-all ${cfg.bg} ${cfg.border} ${isUnread ? 'ring-1 ring-indigo-500/40' : 'opacity-75'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <AlertTriangle className={`h-4 w-4 flex-shrink-0 ${cfg.text}`} />
                      <p className="text-sm font-semibold text-slate-200 truncate">{alert.title}</p>
                      {isUnread && <span className="h-2 w-2 rounded-full bg-indigo-500 flex-shrink-0 animate-pulse" />}
                    </div>
                    <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ml-2 flex-shrink-0 ${cfg.text}`}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3 leading-relaxed">{alert.message}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1 text-[10px] text-slate-600">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(alert.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {isUnread && (
                        <button onClick={() => onMarkRead(alert.id)} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center space-x-1">
                          <Check className="h-3 w-3" /><span>Read</span>
                        </button>
                      )}
                      <button onClick={() => onResolve(alert.id)} className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center space-x-1">
                        <X className="h-3 w-3" /><span>Resolve</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {alerts.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-800 flex-shrink-0">
            <p className="text-xs text-slate-600 text-center">Resolved alerts are auto-archived after 24h</p>
          </div>
        )}
      </div>
    </>
  );
};

// ─── Layout ──────────────────────────────────────────────────────────────────

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const { subscribe } = useSocket();
  const location = useLocation();

  const [alerts, setAlerts] = useState<any[]>([]);
  const [showDrawer, setShowDrawer] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchAlerts = async () => {
    try {
      const res = await api.alerts.list({ isResolved: false });
      if (res.success) {
        setAlerts(res.alerts);
        setUnreadCount(res.alerts.filter((a: any) => !a.isRead).length);
      }
    } catch {}
  };

  useEffect(() => {
    fetchAlerts();
    const unsub1 = subscribe('ALERT_CREATED', (payload) => {
      setAlerts((prev) => [payload.data, ...prev]);
      setUnreadCount((c) => c + 1);
    });
    const unsub2 = subscribe('ALERT_UPDATED', () => fetchAlerts());
    return () => { unsub1(); unsub2(); };
  }, [subscribe]);

  const handleMarkRead = async (id: string) => {
    try {
      await api.alerts.read(id);
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    const unread = alerts.filter((a) => !a.isRead);
    await Promise.all(unread.map((a) => api.alerts.read(a.id)));
    setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
    setUnreadCount(0);
  };

  const handleResolve = async (id: string) => {
    try {
      await api.alerts.resolve(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  };

  const isAdmin = user?.role === 'ADMIN';

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Inventory & Stock', path: '/inventory', icon: Boxes },
    { name: 'Order Tracking', path: '/orders', icon: ClipboardList },
    { name: 'Demand Forecasting', path: '/forecasting', icon: LineChart },
    { name: 'Analytics & Heatmap', path: '/analytics', icon: Layers },
    ...(isAdmin ? [{ name: 'User Management', path: '/users', icon: Users }] : []),
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between z-10 flex-shrink-0">
        <div>
          <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="h-5 w-5 text-indigo-100" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">WarehouseAI</span>
          </div>

          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/10'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1">{item.name}</span>
                  {item.name === 'User Management' && (
                    <span className="text-[9px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded">ADM</span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center space-x-3 mb-3">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-white">{user?.name?.charAt(0).toUpperCase() || '?'}</span>
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-slate-200 truncate">{user?.name}</p>
              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                user?.role === 'ADMIN' ? 'bg-red-500/10 text-red-400 border-red-500/20'
                : user?.role === 'MANAGER' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                {user?.role}
              </span>
            </div>
          </div>

          <button
            onClick={() => logout()}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white transition-all"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-8 z-20 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-bold text-slate-100">
              {navItems.find((n) => n.path === location.pathname)?.name || 'Warehouse Operations'}
            </h1>
          </div>

          <button
            onClick={() => setShowDrawer(true)}
            className="relative p-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white transition-all"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-slate-900 animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-950 p-8">
          {children}
        </main>
      </div>

      <NotificationDrawer
        open={showDrawer}
        onClose={() => setShowDrawer(false)}
        alerts={alerts}
        unreadCount={unreadCount}
        onMarkRead={handleMarkRead}
        onResolve={handleResolve}
        onMarkAllRead={handleMarkAllRead}
      />
    </div>
  );
};
