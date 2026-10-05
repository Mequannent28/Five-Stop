import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Warehouse, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('admin@hotel.com');
  const [password, setPassword] = useState('');
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
      setError(err.response?.data?.message || 'Unable to sign in. Check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brass-400 text-ink-900">
            <Warehouse size={26} strokeWidth={2.25} />
          </div>
          <h1 className="font-display text-2xl text-white">Five Stop</h1>
          <p className="mt-1 text-sm text-ink-300">Hotel inventory &amp; supply control</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-soft">
          <h2 className="mb-4 text-lg font-semibold text-ink-900">Sign in</h2>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
          )}

          <label className="mb-1 block text-sm font-medium text-ink-600">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400"
            placeholder="you@hotel.com"
          />

          <label className="mb-1 block text-sm font-medium text-ink-600">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-6 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400"
            placeholder="••••••••"
          />

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink-900 py-2.5 text-sm font-semibold text-white hover:bg-ink-800 disabled:opacity-60"
          >
            <LogIn size={16} /> {loading ? 'Signing in...' : 'Sign in'}
          </button>

          <p className="mt-4 text-center text-xs text-ink-400">
            First time here? Run <code className="rounded bg-ink-50 px-1 py-0.5">npm run seed</code> in the server folder for a demo admin login.
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;
