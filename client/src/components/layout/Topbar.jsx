import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Menu,
  LogOut,
  ChevronDown,
  User,
  Shield,
  Building,
  Settings as SettingsIcon,
  Layers,
  Clock,
  Timer,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSessionTimeout, TIMEOUT_OPTIONS } from '../../context/SessionTimeoutContext';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const Topbar = ({ onMenuClick, title }) => {
  const { user, logout, hasRole } = useAuth();
  const { timeoutMinutes, setTimeoutMinutes, remainingSeconds } = useSessionTimeout();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const handleNav = (path) => {
    setMenuOpen(false);
    navigate(path);
  };

  const roleBadgeStyle = {
    admin: 'bg-brass-100 text-brass-800 border-brass-200',
    manager: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    storekeeper: 'bg-blue-50 text-blue-700 border-blue-200',
  }[user?.role || 'storekeeper'];

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink-100 bg-white/90 px-4 py-3.5 backdrop-blur sm:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-md p-1.5 text-ink-500 hover:bg-ink-50 lg:hidden"
        >
          <Menu size={22} />
        </button>
        <div>
          <p className="text-xl font-bold text-ink-900">{title}</p>
          <p className="text-xs text-ink-500">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Session Inactivity Indicator */}
        <div
          onClick={() => setMenuOpen((v) => !v)}
          title={`Session Timeout: ${timeoutMinutes === 0 ? 'Disabled' : `Signs out after ${timeoutMinutes} minutes of inactivity`}`}
          className="hidden md:flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-slate-50/80 px-2.5 py-1 text-xs text-slate-600 cursor-pointer hover:bg-slate-100 transition shadow-2xs"
        >
          <span className={`h-1.5 w-1.5 rounded-full ${timeoutMinutes === 0 ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'}`} />
          <Clock size={12} className="text-slate-400" />
          <span className="text-[11px] font-medium text-slate-600">
            {timeoutMinutes === 0 ? 'Timeout: Off' : `Auto-Logout: ${timeoutMinutes}m`}
          </span>
        </div>

        <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2.5 rounded-full border border-ink-200/80 bg-white py-1 pl-1 pr-3 shadow-xs hover:border-ink-300 hover:bg-ink-50/60 transition"
        >
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user?.name}
              className="h-8 w-8 rounded-full object-cover ring-1 ring-ink-200"
            />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-xs">
              {user?.name?.[0]?.toUpperCase()}
            </span>
          )}
          <div className="hidden text-left sm:block">
            <p className="text-xs font-semibold leading-tight text-ink-800">{user?.name}</p>
            <p className="text-[10px] capitalize leading-none text-ink-400">{user?.role}</p>
          </div>
          <ChevronDown size={14} className={`text-ink-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-ink-100 bg-white p-2 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100 z-50">
            {/* User Profile Card Header */}
            <div className="rounded-xl bg-ink-50/70 p-3 mb-1">
              <div className="flex items-center gap-2.5">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user?.name}
                    className="h-9 w-9 rounded-xl object-cover ring-1 ring-ink-200 shadow-xs"
                  />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 font-bold text-white text-sm shadow-xs">
                    {user?.name?.[0]?.toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-ink-900 truncate">{user?.name}</p>
                  <p className="text-[11px] text-ink-400 truncate">{user?.email}</p>
                </div>
              </div>
              <div className="mt-2.5 flex items-center justify-between border-t border-ink-100/80 pt-2">
                <span className="text-[10px] uppercase font-bold text-ink-400">Role</span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${roleBadgeStyle}`}>
                  {user?.role}
                </span>
              </div>
            </div>

            {/* Menu Links */}
            <div className="space-y-0.5 pt-1">
              <button
                onClick={() => handleNav('/settings?tab=profile')}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50 transition"
              >
                <User size={15} className="text-ink-400" />
                <span>My Profile</span>
              </button>

              <button
                onClick={() => handleNav('/settings?tab=security')}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50 transition"
              >
                <Shield size={15} className="text-ink-400" />
                <span>Security &amp; Password</span>
              </button>

              {hasRole('admin') && (
                <button
                  onClick={() => handleNav('/settings?tab=system')}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50 transition"
                >
                  <Building size={15} className="text-ink-400" />
                  <span>Hotel Settings</span>
                </button>
              )}

              <button
                onClick={() => handleNav('/settings?tab=permissions')}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50 transition"
              >
                <Layers size={15} className="text-ink-400" />
                <span>Role Privileges</span>
              </button>
            </div>

            {/* Session Inactivity Timeout Selector */}
            <div className="mt-2 rounded-xl bg-slate-50 border border-slate-200/80 p-2.5 text-xs">
              <div className="flex items-center justify-between text-slate-700 font-semibold mb-1.5">
                <span className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <Clock size={13} className="text-blue-600" />
                  <span>Session Timeout</span>
                </span>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-200">
                  {timeoutMinutes === 0 ? 'Disabled' : `${timeoutMinutes} min`}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mb-2 leading-tight">
                Auto-signs out after idle time to secure workstation:
              </p>
              <select
                id="topbar-session-timeout-select"
                value={timeoutMinutes}
                onChange={(e) => setTimeoutMinutes(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-2 text-[11px] font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs"
              >
                <option value={1}>1 Minute (High Security)</option>
                <option value={2}>2 Minutes (Default Policy)</option>
                <option value={5}>5 Minutes</option>
                <option value={10}>10 Minutes</option>
                <option value={15}>15 Minutes</option>
                <option value={30}>30 Minutes</option>
                <option value={60}>60 Minutes (1 Hour)</option>
                <option value={0}>Never (Off)</option>
              </select>
            </div>

            {/* Logout Action */}
            <div className="mt-1 border-t border-ink-100 pt-1">
              <button
                onClick={logout}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </header>
  );
};

export default Topbar;
