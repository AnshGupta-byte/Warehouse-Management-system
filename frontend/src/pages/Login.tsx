import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutGrid, Activity, RefreshCw, Cpu } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ email, password });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const loadDemoUser = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="min-h-screen flex bg-[#070d19]">
      {/* ── Left Panel ──────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex w-[55%] flex-shrink-0 bg-[#060c18] border-r border-[#1a2840] flex-col justify-between p-12">
        {/* Top: Logo */}
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 bg-[#1d4ed8] rounded flex items-center justify-center flex-shrink-0">
            <LayoutGrid className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-white tracking-tight leading-none">WarehouseAI</p>
            <p className="text-[9px] text-[#4a5f7a] uppercase tracking-widest font-medium mt-0.5">WMS Platform</p>
          </div>
        </div>

        {/* Middle: Headline + stats */}
        <div>
          <h1 className="text-[32px] font-bold text-white leading-tight mb-4 tracking-tight">
            Warehouse Operations<br />Platform
          </h1>
          <p className="text-[#4a5f7a] text-[13px] leading-relaxed max-w-sm">
            Real-time inventory intelligence, AI-driven demand forecasting, and
            end-to-end order lifecycle management for modern distribution operations.
          </p>

          {/* Stats row */}
          <div className="flex gap-8 mt-10">
            <div>
              <p className="text-[22px] font-bold text-[#3b82f6] leading-none tabular-nums">99.9%</p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4a5f7a] mt-1">Uptime</p>
            </div>
            <div className="border-l border-[#1a2840] pl-8">
              <p className="text-[22px] font-bold text-[#3b82f6] leading-none">Live</p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4a5f7a] mt-1">Real-time Sync</p>
            </div>
            <div className="border-l border-[#1a2840] pl-8">
              <p className="text-[22px] font-bold text-[#3b82f6] leading-none">AI</p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4a5f7a] mt-1">AI-Powered</p>
            </div>
          </div>
        </div>

        {/* Bottom: Copyright */}
        <p className="text-[11px] text-[#2d4060]">
          © {new Date().getFullYear()} WarehouseAI. Enterprise Warehouse Management System.
        </p>
      </div>

      {/* ── Right Panel ─────────────────────────────────────────────────────── */}
      <div className="flex-1 bg-[#070d19] flex items-center justify-center p-8">
        <div className="w-full max-w-[360px] bg-[#0b1120] border border-[#1e2d45] rounded-lg p-8">

          {/* Mobile logo (hidden on lg) */}
          <div className="flex items-center gap-2 mb-6 lg:hidden">
            <div className="h-7 w-7 bg-[#1d4ed8] rounded flex items-center justify-center">
              <LayoutGrid className="h-4 w-4 text-white" />
            </div>
            <p className="text-[13px] font-semibold text-white">WarehouseAI</p>
          </div>

          <h2 className="text-[18px] font-semibold text-white mb-1">Sign In</h2>
          <p className="text-[12px] text-[#4a5f7a] mb-6">
            Enter your credentials to access the platform
          </p>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-md bg-red-950/20 border border-red-800/40 px-3 py-2.5 text-[12px] text-red-400">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-[11px] font-semibold tracking-wide text-[#94a3b8] uppercase mb-1.5">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-[11px] font-semibold tracking-wide text-[#94a3b8] uppercase mb-1.5">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-2.5 text-[12px]"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </div>
          </form>

          {/* Demo Accounts */}
          <div className="mt-6 pt-5 border-t border-[#1e2d45]">
            <p className="text-[9px] font-semibold tracking-widest uppercase text-[#2d4060] text-center mb-3">
              Quick Connect — Demo Accounts
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => loadDemoUser('admin@warehouse.com', 'admin123')}
                className="py-2 px-1 text-center rounded-md bg-[#070d19] border border-[#1e2d45] hover:border-[#3b82f6] hover:bg-[#0f1729] text-[11px] font-semibold text-[#60a5fa] transition-all"
              >
                Admin
              </button>
              <button
                onClick={() => loadDemoUser('manager@warehouse.com', 'manager123')}
                className="py-2 px-1 text-center rounded-md bg-[#070d19] border border-[#1e2d45] hover:border-[#10b981] hover:bg-[#0f1729] text-[11px] font-semibold text-[#34d399] transition-all"
              >
                Manager
              </button>
              <button
                onClick={() => loadDemoUser('staff@warehouse.com', 'staff123')}
                className="py-2 px-1 text-center rounded-md bg-[#070d19] border border-[#1e2d45] hover:border-[#f59e0b] hover:bg-[#0f1729] text-[11px] font-semibold text-[#fbbf24] transition-all"
              >
                Staff
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
