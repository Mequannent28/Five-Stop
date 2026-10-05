import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Warehouse, Eye, EyeOff, Lock, Mail, ArrowRight } from 'lucide-react';
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
      setError(err.response?.data?.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center p-4"
      style={{
        background: 'radial-gradient(ellipse at 50% 20%, #172554 0%, #0b1120 60%, #030712 100%)',
      }}
    >
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div
            className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl shadow-xl shadow-amber-500/10"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
          >
            <Warehouse size={28} className="text-white" strokeWidth={2.25} />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Five Stop</h1>
          <p className="mt-1 text-xs font-medium tracking-wide text-blue-300/80">
            Hotel &amp; Restaurant Inventory System
          </p>
        </div>

        {/* Login Card */}
        <div
          className="rounded-3xl border p-8 shadow-2xl"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">Sign In</h2>
            <p className="mt-1 text-xs text-blue-200/60">
              Enter your credentials to access the management portal
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              <span className="font-bold text-rose-400">⚠</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-blue-200/70">
                Email Address
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-blue-400/50">
                  <Mail size={16} />
                </div>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@hotel.com"
                  className="w-full rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-blue-300/30 outline-none transition focus:border-amber-500"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-blue-200/70">
                Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-blue-400/50">
                  <Lock size={16} />
                </div>
                <input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl py-3 pl-10 pr-11 text-sm text-white placeholder-blue-300/30 outline-none transition focus:border-amber-500"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-blue-400/60 hover:text-blue-300 transition"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white shadow-lg transition disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              }}
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Signing in…</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* System Roles Footer */}
          <div className="mt-6 border-t border-white/5 pt-5">
            <p className="mb-2.5 text-center text-[11px] font-medium tracking-wide text-blue-300/50 uppercase">
              Authorized Roles
            </p>
            <div className="flex justify-center gap-2">
              {['Admin', 'Manager', 'Store Keeper'].map((role) => (
                <span
                  key={role}
                  className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-blue-200/70"
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  {role}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <p className="mt-6 text-center text-xs text-blue-300/40">
          © 2026 Nobir Trading Plc · Five Stop Hotel Stock
        </p>
      </div>
    </div>
  );
};

export default Login;
