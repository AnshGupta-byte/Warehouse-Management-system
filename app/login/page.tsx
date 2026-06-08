'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setLoading(false)
    if (result?.error) {
      setError('Invalid email or password. Please try again.')
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  const quickLogin = async (role: 'admin' | 'manager') => {
    setEmail(role === 'admin' ? 'admin@warehouse.com' : 'manager@warehouse.com')
    setPassword(role === 'admin' ? 'admin123' : 'manager123')
  }

  return (
    <div className="login-page">
      {/* Background orbs */}
      <div className="login-bg-orb" style={{
        width: 500, height: 500, top: -200, left: -200,
        background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)',
      }} />
      <div className="login-bg-orb" style={{
        width: 400, height: 400, bottom: -150, right: -150,
        background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)',
      }} />

      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">🏭</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>WarehouseAI</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Management System</div>
          </div>
        </div>

        <h1 className="login-title">Welcome Back</h1>
        <p className="login-subtitle">Sign in to your warehouse dashboard</p>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="login-error">⚠️ {error}</div>}

          <div className="input-group">
            <label className="input-label" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="you@warehouse.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
            style={{ justifyContent: 'center', padding: '13px' }}
            id="login-submit-btn"
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                Signing in...
              </>
            ) : (
              <>🔐 Sign In</>
            )}
          </button>
        </form>

        {/* Demo credentials */}
        <div className="login-demo">
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>🚀 Demo Accounts</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => quickLogin('admin')}
              style={{
                background: 'rgba(59,130,246,0.15)',
                border: '1px solid rgba(59,130,246,0.3)',
                borderRadius: 6,
                padding: '4px 10px',
                color: 'var(--accent-blue)',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 600,
              }}
              id="quick-login-admin"
            >
              Admin Login
            </button>
            <button
              type="button"
              onClick={() => quickLogin('manager')}
              style={{
                background: 'rgba(139,92,246,0.15)',
                border: '1px solid rgba(139,92,246,0.3)',
                borderRadius: 6,
                padding: '4px 10px',
                color: 'var(--accent-purple)',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 600,
              }}
              id="quick-login-manager"
            >
              Manager Login
            </button>
          </div>
          <div style={{ marginTop: 8, opacity: 0.7 }}>
            Admin: admin@warehouse.com / admin123<br />
            Manager: manager@warehouse.com / manager123
          </div>
        </div>
      </div>
    </div>
  )
}
