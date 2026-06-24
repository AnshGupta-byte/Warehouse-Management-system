import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../services/api';
import {
  Warehouse, LayoutGrid, Package, ClipboardList, TrendingUp, BarChart2,
  Users, Bell, LogOut, X, Check, AlertTriangle, Clock, BellOff,
  ChevronRight, Settings,
} from 'lucide-react';

// ── Notification Drawer ────────────────────────────────────────────────────

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  alerts: any[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onResolve: (id: string) => void;
  onMarkAllRead: () => void;
}

const SEV_CONFIG: Record<string, { color: string; bg: string }> = {
  CRITICAL: { color: '#f87171', bg: 'rgba(239,68,68,0.06)' },
  WARNING:  { color: '#fbbf24', bg: 'rgba(245,158,11,0.06)' },
  INFO:     { color: '#60a5fa', bg: 'rgba(37,99,235,0.06)' },
};

const NotificationDrawer: React.FC<DrawerProps> = ({
  open, onClose, alerts, unreadCount, onMarkRead, onResolve, onMarkAllRead,
}) => (
  <>
    {open && <div className="fixed inset-0 z-30 bg-black/40" onClick={onClose} />}
    <div
      className="fixed top-0 right-0 h-full z-40 flex flex-col"
      style={{
        width: 380,
        background: '#0c0c0f',
        borderLeft: '1px solid #27272a',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: open ? '-16px 0 48px rgba(0,0,0,0.3)' : 'none',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #27272a' }}>
        <div>
          <div className="text-[15px] font-semibold text-[var(--text-primary)]">Notifications</div>
          <div className="text-[12px] mt-0.5" style={{ color: '#52525b' }}>{alerts.length} total · {unreadCount} unread</div>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={onMarkAllRead} className="btn-ghost text-[12px] font-medium" style={{ color: '#3b82f6' }}>
              Mark all read
            </button>
          )}
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="h-4 w-4" /></button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center px-6">
            <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-4" style={{ background: '#18181b' }}>
              <BellOff className="h-5 w-5" style={{ color: '#3f3f46' }} />
            </div>
            <div className="text-[14px] font-medium text-[var(--text-secondary)] mb-1">All clear</div>
            <div className="text-[12px]" style={{ color: '#52525b' }}>No active alerts. All systems are operational.</div>
          </div>
        ) : (
          <div>
            {alerts.map((alert) => {
              const sev = SEV_CONFIG[alert.severity] || SEV_CONFIG.INFO;
              const isUnread = !alert.isRead;
              return (
                <div
                  key={alert.id}
                  className="px-5 py-4 transition-colors"
                  style={{
                    background: isUnread ? sev.bg : 'transparent',
                    borderBottom: '1px solid #1c1c1f',
                    borderLeft: isUnread ? `3px solid ${sev.color}` : '3px solid transparent',
                  }}
                >
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: sev.color }} />
                      <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">{alert.title}</span>
                      {isUnread && <span className="h-2 w-2 rounded-full flex-shrink-0 bg-[var(--accent)]" />}
                    </div>
                    <span className="badge badge-gray text-[10px] flex-shrink-0">{alert.severity}</span>
                  </div>
                  <p className="text-[12px] mb-3 leading-relaxed pl-6" style={{ color: '#71717a' }}>{alert.message}</p>
                  <div className="flex items-center justify-between pl-6">
                    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: '#3f3f46' }}>
                      <Clock className="h-3 w-3" />
                      {new Date(alert.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="flex items-center gap-2">
                      {isUnread && (
                        <button onClick={() => onMarkRead(alert.id)} className="btn-ghost text-[11px] py-1 px-2" style={{ color: '#3b82f6' }}>
                          <Check className="h-3 w-3 mr-1" /> Read
                        </button>
                      )}
                      <button onClick={() => onResolve(alert.id)} className="btn-ghost text-[11px] py-1 px-2">
                        <X className="h-3 w-3 mr-1" /> Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  </>
);

// ── Layout ─────────────────────────────────────────────────────────────────

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
    const u1 = subscribe('ALERT_CREATED', (p) => { setAlerts((prev) => [p.data, ...prev]); setUnreadCount((c) => c + 1); });
    const u2 = subscribe('ALERT_UPDATED', () => fetchAlerts());
    return () => { u1(); u2(); };
  }, [subscribe]);

  const handleMarkRead = async (id: string) => {
    try { await api.alerts.read(id); setAlerts((p) => p.map((a) => a.id === id ? { ...a, isRead: true } : a)); setUnreadCount((c) => Math.max(0, c - 1)); } catch {}
  };
  const handleMarkAllRead = async () => {
    await Promise.all(alerts.filter((a) => !a.isRead).map((a) => api.alerts.read(a.id)));
    setAlerts((p) => p.map((a) => ({ ...a, isRead: true }))); setUnreadCount(0);
  };
  const handleResolve = async (id: string) => {
    try { await api.alerts.resolve(id); setAlerts((p) => p.filter((a) => a.id !== id)); setUnreadCount((c) => Math.max(0, c - 1)); } catch {}
  };

  const isAdmin = user?.role === 'ADMIN';

  const navGroups = [
    {
      label: 'Operations',
      items: [
        { name: 'Dashboard', path: '/', icon: LayoutGrid },
        { name: 'Inventory', path: '/inventory', icon: Package },
        { name: 'Orders', path: '/orders', icon: ClipboardList },
      ],
    },
    {
      label: 'Intelligence',
      items: [
        { name: 'Forecasting', path: '/forecasting', icon: TrendingUp },
        { name: 'Analytics', path: '/analytics', icon: BarChart2 },
      ],
    },
    ...(isAdmin ? [{
      label: 'Admin',
      items: [{ name: 'User Management', path: '/users', icon: Users }],
    }] : []),
  ];

  const currentPage = navGroups.flatMap(g => g.items).find(i => i.path === location.pathname)?.name || 'Dashboard';

  const ROLE_BADGE: Record<string, { color: string; bg: string }> = {
    ADMIN:   { color: '#f87171', bg: 'rgba(239,68,68,0.1)' },
    MANAGER: { color: '#fbbf24', bg: 'rgba(245,158,11,0.1)' },
    STAFF:   { color: '#34d399', bg: 'rgba(16,185,129,0.1)' },
  };
  const rb = ROLE_BADGE[user?.role || 'STAFF'];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#09090b' }}>
      {/* ── Sidebar ──────────────────────────────── */}
      <aside
        className="flex flex-col flex-shrink-0 w-[240px]"
        style={{ background: '#0c0c0f', borderRight: '1px solid #1c1c1f', boxShadow: '2px 0 8px rgba(0,0,0,0.1)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: '1px solid #1c1c1f' }}>
          <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
            <Warehouse className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-[14px] font-semibold text-[var(--text-primary)] leading-none">WarehouseAI</div>
            <div className="text-[11px] mt-1 font-medium" style={{ color: '#3f3f46' }}>Enterprise · v2.4</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-6">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="px-3 mb-2 text-[11px] font-semibold tracking-wider uppercase" style={{ color: '#3f3f46' }}>
                {group.label}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`nav-item ${isActive ? 'active' : ''}`}
                    >
                      <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 flex-shrink-0" style={{ borderTop: '1px solid #1c1c1f' }}>
          <div className="flex items-center gap-3 mb-3">
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 text-[13px] font-bold"
              style={{ background: rb.bg, color: rb.color }}
            >
              {user?.name?.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <div className="text-[13px] font-medium text-[var(--text-primary)] truncate leading-none">{user?.name}</div>
              <span
                className="badge mt-1 text-[10px]"
                style={{ color: rb.color, background: rb.bg }}
              >
                {user?.role}
              </span>
            </div>
          </div>
          <button onClick={() => logout()} className="btn-secondary w-full justify-center text-[12px] h-9">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topbar */}
        <header
          className="flex items-center justify-between px-6 flex-shrink-0"
          style={{ height: 56, background: '#09090b', borderBottom: '1px solid #1c1c1f' }}
        >
          <div>
            <div className="text-[15px] font-semibold text-[var(--text-primary)]">{currentPage}</div>
            <div className="text-[12px]" style={{ color: '#52525b' }}>
              {greeting()}, {user?.name?.split(' ')[0]} · {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDrawer(true)}
              className="relative h-9 w-9 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: '#18181b', border: '1px solid #27272a' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#1f1f23'; e.currentTarget.style.borderColor = '#3f3f46'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#18181b'; e.currentTarget.style.borderColor = '#27272a'; }}
            >
              <Bell className="h-4 w-4 text-[var(--text-secondary)]" />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 h-[18px] min-w-[18px] px-1 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ fontSize: 10, background: '#ef4444', border: '2px solid #09090b' }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6" style={{ background: '#09090b' }}>
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
