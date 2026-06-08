'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

const navItems = [
  { href: '/dashboard', icon: '📊', label: 'Dashboard' },
  { href: '/inventory', icon: '📦', label: 'Inventory' },
  { href: '/orders', icon: '🛒', label: 'Orders' },
  { href: '/forecasting', icon: '🤖', label: 'AI Forecasting' },
  { href: '/alerts', icon: '🚨', label: 'Alerts' },
]

interface SidebarProps {
  user: { name?: string | null; email?: string | null; role?: string }
  alertCount?: number
}

export default function Sidebar({ user, alertCount = 0 }: SidebarProps) {
  const pathname = usePathname()
  const initials = user.name?.split(' ').map(w => w[0]).join('').toUpperCase() || 'U'

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🏭</div>
        <div className="sidebar-logo-text">
          <span className="sidebar-logo-title">WarehouseAI</span>
          <span className="sidebar-logo-subtitle">Management System</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">Main Menu</div>
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${pathname === item.href || pathname.startsWith(item.href + '/') ? 'active' : ''}`}
            id={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <span className="nav-item-icon">{item.icon}</span>
            <span>{item.label}</span>
            {item.href === '/alerts' && alertCount > 0 && (
              <span className="nav-badge">{alertCount > 99 ? '99+' : alertCount}</span>
            )}
          </Link>
        ))}

        <div className="nav-section-label" style={{ marginTop: 16 }}>Settings</div>
        <button
          className="nav-item w-full"
          onClick={() => signOut({ callbackUrl: '/login' })}
          id="sidebar-signout-btn"
          style={{ border: 'none', background: 'none', textAlign: 'left' }}
        >
          <span className="nav-item-icon">🚪</span>
          <span>Sign Out</span>
        </button>
      </nav>

      {/* User card */}
      <div className="sidebar-footer">
        <div className="user-card">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{user.name || 'User'}</div>
            <div className="user-role">{(user as any).role || 'staff'}</div>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>⚙️</span>
        </div>
      </div>
    </aside>
  )
}
