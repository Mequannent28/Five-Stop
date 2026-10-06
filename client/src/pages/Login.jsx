import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Warehouse, Eye, EyeOff, Lock, Mail, ArrowRight,
  ShieldCheck, User, KeyRound, Sparkles, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('admin@hotel.com');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials. Please verify your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (roleEmail) => {
    setEmail(roleEmail);
    setPassword('admin123');
    setError('');
  };

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row bg-white selection:bg-rose-500 selection:text-white">
      
      {/* ════════════════════════════════════════════════════════════════
          LEFT COLUMN: Brand & Security Showcase
      ════════════════════════════════════════════════════════════════ */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-linear-to-br from-[#3b0d13] via-[#4a121a] to-[#20060a] p-8 text-white sm:p-12 lg:w-1/2 lg:p-16">
        
        {/* Subtle decorative background pattern / glow */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-rose-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />

        {/* Top: Brand Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 p-2.5 backdrop-blur-md border border-white/15 shadow-xl shadow-black/20">
              <Warehouse className="h-full w-full text-rose-200" strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight uppercase text-white font-sans">
                  FIVE STOP
                </span>
                <span className="rounded-full bg-rose-500/30 border border-rose-400/30 px-2 py-0.5 text-[10px] font-bold tracking-wider text-rose-200 uppercase">
                  ENTERPRISE
                </span>
              </div>
              <p className="text-xs font-medium tracking-wide text-rose-200/70">
                Hotel Stock &amp; Inventory Management System
              </p>
            </div>
          </div>
        </div>

        {/* Middle: Headline & Core Capabilities */}
        <div className="relative z-10 my-12 space-y-6 lg:my-0 lg:max-w-lg">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs font-medium text-rose-200 backdrop-blur-xs">
              <Sparkles size={13} className="text-amber-300" />
              <span>Version 2.0 · Multi-Department Stock Control</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-[40px] leading-tight">
              Hospitality Stock, Purchasing &amp; Recipe Ledger Desk
            </h1>
            <p className="text-sm leading-relaxed text-rose-100/80">
              Centralized real-time warehouse tracking, supplier price indexation, recipe consumption breakdown, and automated monthly ledger reconciliations.
            </p>
          </div>

          {/* Compliance & Audit Verified Card */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4.5 backdrop-blur-md transition hover:bg-white/10">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 border border-rose-400/30 text-rose-300">
                <ShieldCheck size={20} strokeWidth={2.2} />
              </div>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                  Audit Trail &amp; Maker-Checker Compliant
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-rose-200/70">
                  Enforces strict voucher authorization (Checked, Approved, Posted), perpetual inventory valuation, and tamper-proof user activity logs.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: Left Column Footer */}
        <div className="relative z-10 pt-6 text-xs text-rose-200/50">
          <p>© 2026 Five Stop Hotel &amp; Restaurant Management SC. All rights reserved.</p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          RIGHT COLUMN: Sign In Form
      ════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 flex-col justify-between bg-slate-50/50 p-8 sm:p-12 lg:p-16">
        
        {/* Top Right Utilities / Status */}
        <div className="flex justify-end items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-medium text-slate-500">System Online · Port 5000</span>
        </div>

        {/* Main Sign In Form Area */}
        <div className="mx-auto w-full max-w-md my-auto py-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Sign In to Portal
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Input system credentials authorized by Store Management or IT Administration.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700 shadow-xs">
              <span className="font-bold text-rose-600">⚠</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Email / Username */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">
                Email / Institutional ID
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <User size={18} />
                </div>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter institutional email or username"
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-[#4a121a] focus:ring-2 focus:ring-[#4a121a]/15 shadow-xs"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock size={18} />
                </div>
                <input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-11 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-[#4a121a] focus:ring-2 focus:ring-[#4a121a]/15 shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 transition"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#4a121a] hover:bg-[#380d14] py-3.5 text-sm font-semibold text-white shadow-md shadow-[#4a121a]/20 transition active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Authenticating…</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Switcher / Role Badges */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="mb-2.5 text-center text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Quick Role Switcher
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {[
                { label: 'Admin', email: 'admin@hotel.com' },
                { label: 'Manager', email: 'manager@hotel.com' },
                { label: 'Store Keeper', email: 'storekeeper@hotel.com' },
              ].map((r) => (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => handleQuickFill(r.email)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-[#4a121a] hover:text-[#4a121a] hover:bg-rose-50/50 transition cursor-pointer shadow-2xs"
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Security / Access Note */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 text-xs text-slate-400 border-t border-slate-200/60">
          <div className="flex items-center gap-4 font-semibold text-slate-500 uppercase tracking-wider text-[11px]">
            <span className="hover:text-slate-800 transition cursor-pointer">RESET CREDENTIALS</span>
            <span>·</span>
            <span className="hover:text-slate-800 transition cursor-pointer">CONTACT SUPPORT DESK</span>
          </div>
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
            <KeyRound size={12} className="text-slate-600" />
            <span>Authorized Access Only</span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Login;

