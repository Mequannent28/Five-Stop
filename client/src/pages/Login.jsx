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
    <div className="flex min-h-screen w-full flex-col lg:flex-row bg-white selection:bg-blue-600 selection:text-white">
      
      {/* ════════════════════════════════════════════════════════════════
          LEFT COLUMN: Brand & Security Showcase (Refined High-End Brand Blue)
      ════════════════════════════════════════════════════════════════ */}
      <div
        className="relative flex flex-col justify-between overflow-hidden p-8 text-white sm:p-12 lg:w-1/2 lg:p-16 shadow-2xl"
        style={{
          background: 'linear-gradient(150deg, #091f58 0%, #1742a8 50%, #0d286d 100%)',
        }}
      >
        {/* Decorative background ambient glow circles */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-blue-500/25 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:24px_24px] opacity-20" />

        {/* Top: Brand Logo & Title */}
        <div className="relative z-10 pb-6 border-b border-white/15">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 p-3 backdrop-blur-md border border-white/30 shadow-xl shadow-blue-950/30">
              <Warehouse className="h-full w-full text-white drop-shadow-sm" strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-2xl font-black tracking-tight uppercase text-white font-sans drop-shadow-md">
                  FIVE STOP
                </span>
                <span className="rounded-full bg-white/20 border border-white/30 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-white uppercase shadow-xs">
                  ENTERPRISE
                </span>
              </div>
              <p className="text-xs font-medium tracking-wide text-blue-100/90 mt-0.5">
                Hotel &amp; Resort Stock Management System
              </p>
            </div>
          </div>
        </div>

        {/* Middle: Headline, Subtext & Verified Badge Card */}
        <div className="relative z-10 my-8 space-y-7 lg:my-0 lg:max-w-xl">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-3.5 py-1 text-xs font-semibold text-white backdrop-blur-md shadow-xs">
              <Sparkles size={13} className="text-amber-300 animate-pulse" />
              <span>Multi-Store &amp; Kitchen Inventory Engine</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-[42px] leading-[1.18] drop-shadow-sm">
              Secure Inventory &amp; Store Ledger Desk
            </h1>
            <p className="text-sm sm:text-base leading-relaxed text-blue-50/90 font-normal">
              Access the central store ledger for digital receiving verification (GRV), automated recipe costing, multi-tier Maker-Checker approvals, and perpetual stock reconciliations.
            </p>
          </div>

          {/* Compliance & Audit Verified Card (modeled after reference) */}
          <div className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-md transition hover:bg-white/15 shadow-xl shadow-blue-950/20">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 border border-white/30 text-white shadow-xs">
                <ShieldCheck size={22} strokeWidth={2.3} />
              </div>
              <div className="space-y-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                  COMPLIANCE &amp; AUDIT VERIFIED
                </h2>
                <p className="text-xs leading-relaxed text-blue-100/90 font-normal">
                  Fully compliant with perpetual stock accounting, voucher-based multi-tier authorization (Review, Approve, Post), and automated monthly ledger balancing.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: Left Column Footer */}
        <div className="relative z-10 pt-6 border-t border-white/10 flex flex-col gap-2.5 text-xs text-blue-100/80">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>© 2026 Five Stop Hotel &amp; Resort Management SC.</p>
            <div className="text-[11px] text-blue-100">
              Developed &amp; Powered by <strong className="text-white font-semibold underline underline-offset-2">Mequannent Gashaw</strong>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 pt-0.5 text-[11px]">
            <a
              href="https://t.me/+251918592028"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-2.5 py-1 font-medium text-white transition backdrop-blur-xs border border-white/20 shadow-2xs"
            >
              <svg className="w-3.5 h-3.5 fill-current text-sky-300" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.05-.2-.06-.05-.16-.03-.23-.02-.1.02-1.68 1.07-4.75 3.14-.45.31-.86.46-1.22.45-.4-.01-1.17-.23-1.74-.41-.7-.23-1.26-.35-1.21-.74.03-.2.3-.41.83-.62 3.25-1.42 5.42-2.35 6.52-2.8 3.11-1.29 3.75-1.51 4.18-1.52.09 0 .31.02.45.14.12.1.15.24.17.34-.01.07.01.21 0 .28z"/>
              </svg>
              <span>Telegram</span>
            </a>
            <a
              href="https://wa.me/251918592028"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-2.5 py-1 font-medium text-white transition backdrop-blur-xs border border-white/20 shadow-2xs"
            >
              <svg className="w-3.5 h-3.5 fill-current text-emerald-300" viewBox="0 0 24 24">
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.13 7.42C8.94 7.42 8.64 7.49 8.38 7.78C8.12 8.06 7.39 8.75 7.39 10.15C7.39 11.55 8.41 12.9 8.55 13.09C8.69 13.28 10.55 16.14 13.4 17.37C14.08 17.66 14.61 17.84 15.02 17.97C15.7 18.19 16.32 18.16 16.81 18.08C17.36 18 18.5 17.39 18.74 16.72C18.98 16.05 18.98 15.48 18.91 15.36C18.84 15.24 18.65 15.17 18.36 15.03C18.08 14.89 16.7 14.21 16.44 14.12C16.19 14.02 16 13.98 15.82 14.26C15.63 14.54 15.11 15.17 14.95 15.36C14.79 15.54 14.63 15.57 14.35 15.42C14.06 15.28 13.15 14.98 12.07 14.02C11.23 13.27 10.66 12.35 10.5 12.07C10.34 11.78 10.48 11.63 10.63 11.49C10.76 11.36 10.92 11.15 11.06 10.98C11.21 10.82 11.25 10.7 11.35 10.51C11.44 10.32 11.39 10.16 11.32 10.02C11.25 9.88 10.7 8.53 10.47 7.98C10.25 7.44 10.02 7.52 9.85 7.51C9.69 7.51 9.5 7.42 9.13 7.42Z"/>
              </svg>
              <span>WhatsApp</span>
            </a>
            <a href="tel:0918592028" className="font-mono text-white/90 hover:text-white font-semibold pl-1">
              0918592028
            </a>
          </div>
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
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 shadow-xs"
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
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-11 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 shadow-xs"
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
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 py-3.5 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition active:scale-[0.99] disabled:opacity-60 cursor-pointer"
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
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50/50 transition cursor-pointer shadow-2xs"
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Security / Access & Developer Note */}
        <div className="flex flex-col gap-3 pt-6 text-xs text-slate-500 border-t border-slate-200/80">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div>
              Developed &amp; Powered by <strong className="text-slate-800 font-semibold">Mequannent Gashaw</strong>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="https://t.me/+251918592028"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-700 px-2 py-0.5 text-[11px] font-semibold border border-sky-200 transition"
              >
                Telegram
              </a>
              <a
                href="https://wa.me/251918592028"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[11px] font-semibold border border-emerald-200 transition"
              >
                WhatsApp
              </a>
              <a href="tel:0918592028" className="font-mono text-slate-700 font-semibold hover:text-blue-600">
                0918592028
              </a>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
            <div className="flex items-center gap-3 uppercase tracking-wider font-semibold">
              <span className="hover:text-slate-700 transition cursor-pointer">RESET CREDENTIALS</span>
              <span>·</span>
              <span className="hover:text-slate-700 transition cursor-pointer">CONTACT SUPPORT</span>
            </div>
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
              <KeyRound size={11} className="text-slate-600" />
              <span>Authorized Access Only</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Login;

