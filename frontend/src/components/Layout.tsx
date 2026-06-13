import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../services/api';
import {
  LayoutGrid, Package, ClipboardList, TrendingUp, BarChart2,
  Users, Bell, LogOut, X, Check, AlertTriangle, Clock, BellOff,
  ChevronRight,
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

const SEV_STYLE: Record<string, { accent: string; bg: string; text: string }> = {
  CRITICAL: { accent: '#ef4444', bg: '#ef444408', text: '#f87171' },
  WARNING:  { accent: '#f59e0b', bg: '#f59e0b08', text: '#fbbf24' },
  INFO:     { accent: '#3b82f6', bg: '#3b82f608', text: '#60a5fa' },
};

const NotificationDrawer: React.FC<DrawerProps> = ({
  open, onClose, alerts, unreadCount, onMarkRead, onResolve, onMarkAllRead,
}) => (
  <>
    {open && <div className="fixed inset-0 z-30" style={{ background: 'rgba(4,8,18,0.5)' }} onClick={onClose} />}
    <div
      className="fixed top-0 right-0 h-full z-40 flex flex-col"
      style={{
        width: 340,
        background: '#0b1120',
        borderLeft: '1px solid #1e2d45',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: open ? '-20px 0 60px rgba(0,0,0,0.4)' : 'none',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid #1e2d45' }}>
        <div className="flex items-center gap-2.5">
          <Bell className="h-4 w-4" style={{ color: '#3b82f6' }} />
          <div>
            <div className="text-[13px] font-semibold text-white">Notifications</div>
            <div className="text-[10px]" style={{ color: '#4a5f7a' }}>{alerts.length} active · {unreadCount} unread</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={onMarkAllRead} className="text-[11px] font-medium px-2 py-1 rounded transition-all" style={{ color: '#60a5fa' }} onMouseEnter={e => e.currentTarget.style.background = '#1e2d45'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              Mark all read
            </button>
          )}
          <button onClick={onClose} className="btn-ghost p-1"><X className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center">
            <BellOff className="h-8 w-8 mb-3" style={{ color: '#1e2d45' }} />
            <div className="text-[12px] font-medium" style={{ color: '#4a5f7a' }}>No active alerts</div>
            <div className="text-[11px] mt-1" style={{ color: '#2d4060' }}>All systems operational</div>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#111e35' }}>
            {alerts.map((alert) => {
              const sev = SEV_STYLE[alert.severity] || SEV_STYLE.INFO;
              const isUnread = !alert.isRead;
              return (
                <div
                  key={alert.id}
                  className="px-4 py-3 transition-all"
                  style={{ background: isUnread ? sev.bg : 'transparent', borderLeft: isUnread ? `2px solid ${sev.accent}` : '2px solid transparent' }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: sev.text }} />
                      <span className="text-[12px] font-medium text-white truncate">{alert.title}</span>
                      {isUnread && <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: '#3b82f6' }} />}
                    </div>
                    <span className="badge badge-gray text-[9px]">{alert.severity}</span>
                  </div>
                  <p className="text-[11px] mb-2.5 leading-relaxed pl-5" style={{ color: '#4a5f7a' }}>{alert.message}</p>
                  <div className="flex items-center justify-between pl-5">
                    <div className="flex items-center gap-1 text-[10px]" style={{ color: '#2d4060' }}>
                      <Clock className="h-3 w-3" />
                      {new Date(alert.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="flex items-center gap-3">
                      {isUnread && (
                        <button onClick={() => onMarkRead(alert.id)} className="flex items-center gap-1 text-[10px] font-medium" style={{ color: '#60a5fa' }}>
                          <Check className="h-3 w-3" /> Read
                        </button>
                      )}
                      <button onClick={() => onResolve(alert.id)} className="flex items-center gap-1 text-[10px] font-medium" style={{ color: '#4a5f7a' }}>
                        <X className="h-3 w-3" /> Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {alerts.length > 0 && (
        <div className="px-4 py-2.5 flex-shrink-0 text-center text-[10px]" style={{ borderTop: '1px solid #1e2d45', color: '#2d4060' }}>
          Resolved alerts auto-archive after 24h
        </div>
      )}
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
      label: 'Administration',
      items: [{ name: 'User Management', path: '/users', icon: Users }],
    }] : []),
  ];

  const currentPage = navGroups.flatMap(g => g.items).find(i => i.path === location.pathname)?.name || 'Dashboard';

  const ROLE_COLOR: Record<string, string> = { ADMIN: '#f87171', MANAGER: '#fbbf24', STAFF: '#34d399' };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#070d19' }}>
      {/* ── Sidebar ──────────────────────────────── */}
      <aside className="flex flex-col flex-shrink-0 w-[220px]" style={{ background: '#060c18', borderRight: '1px solid #1a2840' }}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4" style={{ borderBottom: '1px solid #1a2840' }}>
          <div className="h-7 w-7 rounded flex items-center justify-center flex-shrink-0" style={{ background: '#1d4ed8' }}>
            <LayoutGrid className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-white leading-none">WarehouseAI</div>
            <div className="text-[9px] uppercase tracking-widest mt-0.5" style={{ color: '#2d4060' }}>Enterprise WMS</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-3">
              <div className="px-2 py-1.5 text-[9px] font-semibold tracking-widest uppercase" style={{ color: '#2d4060' }}>
                {group.label}
              </div>
              {group.items.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="nav-item mb-0.5"
                    style={isActive ? {
                      background: '#1d4ed815',
                      color: '#60a5fa',
                      borderLeft: '2px solid #3b82f6',
                      marginLeft: -1,
                      paddingLeft: 11,
                    } : {}}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{item.name}</span>
                    {item.path === '/users' && (
                      <span className="ml-auto badge badge-red text-[8px]">ADM</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 flex-shrink-0" style={{ borderTop: '1px solid #1a2840' }}>
          <div className="flex items-center gap-2.5 mb-3">
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
              style={{ background: '#1d4ed820', border: '1px solid #1e2d45', color: '#60a5fa' }}
            >
              {user?.name?.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <div className="text-[12px] font-medium text-white truncate leading-none mb-0.5">{user?.name}</div>
              <span className="badge" style={{ fontSize: 9, color: ROLE_COLOR[user?.role || 'STAFF'], background: ROLE_COLOR[user?.role || 'STAFF'] + '12', borderColor: ROLE_COLOR[user?.role || 'STAFF'] + '35' }}>
                {user?.role}
              </span>
            </div>
          </div>
          <button onClick={() => logout()} className="btn-secondary w-full text-[11px] py-1.5 justify-center">
            <LogOut className="h-3.5 w-3.5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topbar */}
        <header className="flex items-center justify-between px-5 flex-shrink-0" style={{ height: 48, background: '#070d19', borderBottom: '1px solid #1a2840' }}>
          <div className="flex items-center gap-2 text-[11px]" style={{ color: '#2d4060' }}>
            <span>WarehouseAI</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-[13px] font-semibold text-white">{currentPage}</span>
          </div>
          <button
            onClick={() => setShowDrawer(true)}
            className="btn-ghost relative h-8 w-8 flex items-center justify-center"
            style={{ border: '1px solid #1e2d45', borderRadius: 5 }}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 h-4 w-4 rounded-full flex items-center justify-center text-white font-bold"
                style={{ fontSize: 9, background: '#ef4444', border: '1.5px solid #070d19' }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6" style={{ background: '#070d19' }}>
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
