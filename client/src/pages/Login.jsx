import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Warehouse, Eye, EyeOff, ArrowRight, ShieldCheck,
  BarChart3, Package, Sparkles, ChefHat, TrendingUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/* ── Animated floating orb ── */
const Orb = ({ style }) => (
  <div
    className="pointer-events-none absolute rounded-full opacity-20 blur-3xl"
    style={style}
  />
);

const FEATURES = [
  { icon: Package,    text: 'Real-time stock tracking & alerts' },
  { icon: ChefHat,   text: 'Recipe costing & ingredient control' },
  { icon: BarChart3, text: 'P&L analytics & demand forecasting' },
  { icon: TrendingUp,text: 'Purchase workflow & approvals' },
];

const Login = () => {
  const [email,    setEmail]    = useState('admin@hotel.com');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full font-sans">

      {/* ══════════════════════════════════════════
          LEFT PANEL — Brand & Features
      ══════════════════════════════════════════ */}
      <div
        className="relative hidden lg:flex lg:w-1/2 flex-col justify-between overflow-hidden px-16 py-14"
        style={{ background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1f4c 50%, #0f2a6b 100%)' }}
      >
        {/* Animated orbs */}
        <Orb style={{ width: 480, height: 480, top: -120, left: -120, background: 'radial-gradient(circle, #3b82f6, #1d4ed8)' }} />
        <Orb style={{ width: 360, height: 360, bottom: -80, right: -80, background: 'radial-gradient(circle, #f59e0b, #b45309)' }} />
        <Orb style={{ width: 240, height: 240, top: '45%', left: '55%', background: 'radial-gradient(circle, #8b5cf6, #6d28d9)' }} />

        {/* Grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.3) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.3) 1px,transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#b45309)' }}
            >
              <Warehouse size={26} className="text-white" strokeWidth={2.25} />
            </div>
            <div>
              <p className="text-xl font-black tracking-tight text-white">Five Stop</p>
              <p className="text-xs font-medium text-blue-300">Hotel & Restaurant</p>
            </div>
          </div>
        </div>

        {/* Hero copy */}
        <div className="relative z-10 space-y-6">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
              <Sparkles size={12} /> International Standard Stock Management
            </div>
            <h2 className="text-4xl font-black leading-tight text-white">
              Complete Control of<br />
              <span style={{ background: 'linear-gradient(90deg,#f59e0b,#fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Your Inventory
              </span>
            </h2>
            <p className="mt-4 text-base leading-relaxed text-blue-200/80">
              Manage stock, recipes, purchases, P&amp;L, and demand forecasting — all in one powerful platform built for hotels and restaurants.
            </p>
          </div>

          {/* Feature list */}
          <ul className="space-y-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon size={15} className="text-amber-400" />
                </div>
                <span className="text-sm font-medium text-blue-100/90">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center gap-2 text-xs text-blue-400/60">
          <ShieldCheck size={13} />
          <span>© 2026 Nobir Trading Plc · Confidential Internal System</span>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          RIGHT PANEL — Login Form
      ══════════════════════════════════════════ */}
      <div
        className="flex w-full items-center justify-center lg:w-1/2 px-6 py-12"
        style={{ background: 'linear-gradient(160deg,#0d1117 0%,#0a0f1e 100%)' }}
      >
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="mb-10 flex flex-col items-center lg:hidden">
            <div
              className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#b45309)' }}
            >
              <Warehouse size={28} className="text-white" strokeWidth={2.25} />
            </div>
            <h1 className="text-2xl font-black text-white">Five Stop</h1>
            <p className="mt-1 text-sm text-blue-300">Hotel inventory &amp; supply control</p>
          </div>

          {/* Card */}
          <div
            className="rounded-3xl border p-8 shadow-2xl"
            style={{
              background: 'rgba(255,255,255,0.04)',
              borderColor: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(24px)',
            }}
          >
            <div className="mb-8">
              <h2 className="text-2xl font-black text-white">Welcome back 👋</h2>
              <p className="mt-1.5 text-sm text-blue-300/80">Sign in to your account to continue</p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                <span className="mt-0.5 text-red-400">⚠</span>
                <p className="text-sm font-medium text-red-300">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-blue-300/70">
                  Email address
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@hotel.com"
                  className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-blue-400/40 outline-none transition"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                  onFocus={e => e.target.style.borderColor = '#f59e0b'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>

              {/* Password */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-blue-300/70">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPw ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl px-4 py-3 pr-12 text-sm text-white placeholder-blue-400/40 outline-none transition"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                    onFocus={e => e.target.style.borderColor = '#f59e0b'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400/60 hover:text-blue-300 transition"
                  >
                    {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                id="login-submit"
                type="submit"
                disabled={loading}
                className="group relative mt-2 flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl py-3.5 text-sm font-bold text-white shadow-lg transition-all disabled:opacity-70"
                style={{ background: 'linear-gradient(135deg,#1a56db,#0d2d80)' }}
              >
                {/* Shimmer overlay on hover */}
                <span
                  className="pointer-events-none absolute inset-0 translate-x-[-100%] skew-x-[-20deg] bg-white/10 transition-transform duration-500 group-hover:translate-x-[200%]"
                />
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <span className="text-xs text-blue-400/50">System Access</span>
              <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
            </div>

            {/* Role badges */}
            <div className="flex flex-wrap justify-center gap-2">
              {['Admin', 'Manager', 'Store Keeper'].map(role => (
                <span
                  key={role}
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(147,197,253,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {role}
                </span>
              ))}
            </div>

            <p className="mt-5 text-center text-xs text-blue-400/40">
              First login? Run <code className="rounded bg-white/10 px-1.5 py-0.5 text-blue-300">npm run seed</code> in the server folder.
            </p>
          </div>

          {/* Bottom note */}
          <p className="mt-6 text-center text-xs text-blue-500/40">
            © 2026 Nobir Trading Plc · All rights reserved
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
