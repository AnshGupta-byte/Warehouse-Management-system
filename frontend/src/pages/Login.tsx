import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Warehouse, ArrowRight, Shield, Zap, BarChart3, Lock } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login({ email, password });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadDemoUser = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  const features = [
    { icon: BarChart3, title: 'Demand Forecasting', desc: 'XGBoost-powered predictions with 94% accuracy' },
    { icon: Zap, title: 'Real-time Sync', desc: 'WebSocket-driven stock updates across all warehouses' },
    { icon: Shield, title: 'Role-based Access', desc: 'Granular permissions for Admin, Manager & Staff' },
  ];

  return (
    <div className="min-h-screen flex" style={{ background: '#09090b' }}>
      {/* ── Left Panel ──────────────────────────── */}
      <div className="hidden lg:flex w-[52%] flex-shrink-0 flex-col justify-between relative overflow-hidden" style={{ background: '#0c0c0f' }}>
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(#a1a1aa 1px, transparent 1px), linear-gradient(90deg, #a1a1aa 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }} />
        {/* Gradient glow */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 70%)' }} />

        <div className="relative z-10 p-12 flex flex-col justify-between h-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
              <Warehouse className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-white tracking-tight">WarehouseAI</div>
              <div className="text-[11px] text-[var(--text-muted)] font-medium">Enterprise Edition v2.4</div>
            </div>
          </div>

          {/* Hero */}
          <div className="max-w-lg">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-[#2563eb] mb-4">Intelligent Operations</div>
            <h1 className="text-[38px] font-bold leading-[1.1] mb-5 tracking-tight" style={{ color: '#fafafa' }}>
              Warehouse<br />Management<br />
              <span style={{ color: '#3b82f6' }}>Reimagined</span>
            </h1>
            <p className="text-[15px] leading-relaxed mb-10" style={{ color: '#71717a' }}>
              AI-powered inventory intelligence, demand forecasting, and spatial warehouse analytics — built for enterprise logistics teams that demand precision.
            </p>

            {/* Feature list */}
            <div className="space-y-5">
              {features.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3.5">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(37,99,235,0.1)' }}>
                    <Icon className="h-4 w-4" style={{ color: '#3b82f6' }} />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</div>
                    <div className="text-[12px] text-[var(--text-muted)] mt-0.5">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[12px] text-[#3f3f46]">© 2024 WarehouseAI Inc. All rights reserved.</div>
        </div>
      </div>

      {/* ── Right Panel ─────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2.5 mb-10">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
              <Warehouse className="h-5 w-5 text-white" />
            </div>
            <span className="text-[15px] font-semibold text-white">WarehouseAI</span>
          </div>

          {/* Card */}
          <div className="rounded-2xl p-8" style={{ background: '#0c0c0f', border: '1px solid #27272a' }}>
            <div className="mb-7">
              <h2 className="text-[22px] font-semibold text-white mb-1.5">Welcome back</h2>
              <p className="text-[13px]" style={{ color: '#52525b' }}>Sign in to your operations dashboard</p>
            </div>

            {error && (
              <div className="mb-5 px-4 py-3 rounded-lg text-[13px] flex items-center gap-2.5" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>
                <div className="h-1.5 w-1.5 rounded-full bg-red-400 flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-[12px] font-medium mb-2" style={{ color: '#a1a1aa' }}>Email address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[12px] font-medium" style={{ color: '#a1a1aa' }}>Password</label>
                  <button type="button" className="text-[12px] font-medium" style={{ color: '#3b82f6' }}>Forgot password?</button>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
              </div>

              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[#2563eb] focus:ring-[#2563eb] cursor-pointer"
                  style={{ width: 16, height: 16 }}
                />
                <label className="text-[12px]" style={{ color: '#71717a' }}>Remember me for 30 days</label>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full justify-center h-11 text-[14px]">
                {loading ? (
                  <><span className="spinner" style={{ width: 16, height: 16 }} />Signing in...</>
                ) : (
                  <>Sign in <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </form>

            {/* Demo accounts */}
            <div className="mt-7 pt-6" style={{ borderTop: '1px solid #27272a' }}>
              <div className="text-[11px] font-medium mb-3 text-center" style={{ color: '#3f3f46' }}>DEMO ACCOUNTS</div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Admin', email: 'admin@warehouse.com', pass: 'admin123', color: '#f87171' },
                  { label: 'Manager', email: 'manager@warehouse.com', pass: 'manager123', color: '#fbbf24' },
                  { label: 'Staff', email: 'staff@warehouse.com', pass: 'staff123', color: '#34d399' },
                ].map(({ label, email: e, pass, color }) => (
                  <button
                    key={label}
                    onClick={() => loadDemoUser(e, pass)}
                    className="py-2.5 text-center text-[12px] font-semibold rounded-lg transition-all"
                    style={{ background: '#18181b', border: '1px solid #27272a', color }}
                    onMouseEnter={(el) => { el.currentTarget.style.borderColor = color; el.currentTarget.style.background = '#1f1f23'; }}
                    onMouseLeave={(el) => { el.currentTarget.style.borderColor = '#27272a'; el.currentTarget.style.background = '#18181b'; }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="text-center text-[11px] mt-6" style={{ color: '#3f3f46' }}>
            <Lock className="h-3 w-3 inline mr-1" /> Secured with end-to-end encryption
          </p>
        </div>
      </div>
    </div>
  );
};
