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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const Topbar = ({ onMenuClick, title }) => {
  const { user, logout, hasRole } = useAuth();
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
          <p className="font-display text-xl font-bold text-ink-900">{title}</p>
          <p className="text-xs text-ink-400">
            {greeting()}, <span className="font-medium text-ink-700">{user?.name?.split(' ')[0]}</span>
          </p>
        </div>
      </div>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2.5 rounded-full border border-ink-200/80 bg-white py-1 pl-1 pr-3 shadow-xs hover:border-ink-300 hover:bg-ink-50/60 transition"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-xs">
            {user?.name?.[0]?.toUpperCase()}
          </span>
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
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 font-bold text-white text-sm shadow-xs">
                  {user?.name?.[0]?.toUpperCase()}
                </span>
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
    </header>
  );
};

export default Topbar;
