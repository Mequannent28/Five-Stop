import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

const SessionTimeoutContext = createContext(null);

const STORAGE_KEY_TIMEOUT = 'hotelStockSessionTimeoutMinutes';
const STORAGE_KEY_LAST_ACTIVITY = 'hotelStockLastActivity';

// Options for timeout in minutes: 0 means disabled / never
export const TIMEOUT_OPTIONS = [
  { value: 1, label: '1 Minute (High Security / Test)' },
  { value: 2, label: '2 Minutes (Default Security Policy)' },
  { value: 5, label: '5 Minutes' },
  { value: 10, label: '10 Minutes' },
  { value: 15, label: '15 Minutes' },
  { value: 30, label: '30 Minutes' },
  { value: 60, label: '60 Minutes (1 Hour)' },
  { value: 0, label: 'Disabled (Never Auto-Logout)' },
];

export const SessionTimeoutProvider = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Default is 2 minutes as requested by the user
  const [timeoutMinutes, setTimeoutMinutesState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TIMEOUT);
      if (saved !== null) {
        const val = parseInt(saved, 10);
        return isNaN(val) ? 2 : val;
      }
    } catch (e) {
      console.warn('Could not read session timeout preference', e);
    }
    return 2;
  });

  const [remainingSeconds, setRemainingSeconds] = useState(timeoutMinutes * 60);
  const [showWarning, setShowWarning] = useState(false);
  const lastRecordedRef = useRef(Date.now());

  // Update timeout preference & sync to localStorage
  const setTimeoutMinutes = useCallback((mins) => {
    const num = Number(mins);
    setTimeoutMinutesState(num);
    try {
      localStorage.setItem(STORAGE_KEY_TIMEOUT, String(num));
    } catch (e) {
      console.warn('Could not save session timeout preference', e);
    }
    // Reset activity on preference change
    const now = Date.now();
    lastRecordedRef.current = now;
    try {
      localStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, String(now));
    } catch {}
    setShowWarning(false);
  }, []);

  // Record user activity (throttled to once per second)
  const recordActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastRecordedRef.current > 1000) {
      lastRecordedRef.current = now;
      try {
        localStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, String(now));
      } catch {}
    }
  }, []);

  // Stay logged in button clicked
  const resetInactivity = useCallback(() => {
    const now = Date.now();
    lastRecordedRef.current = now;
    try {
      localStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, String(now));
    } catch {}
    setShowWarning(false);
    if (timeoutMinutes > 0) {
      setRemainingSeconds(timeoutMinutes * 60);
    }
  }, [timeoutMinutes]);

  // Immediate manual logout
  const manualLogout = useCallback(() => {
    setShowWarning(false);
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  // Handle auto logout when timer expires
  const triggerAutoLogout = useCallback(() => {
    setShowWarning(false);
    logout();
    navigate('/login', {
      replace: true,
      state: {
        sessionExpired: true,
        reason: 'inactivity',
        timeoutMinutes,
      },
    });
  }, [logout, navigate, timeoutMinutes]);

  // Listen to user interaction events across the entire window
  useEffect(() => {
    if (!user || timeoutMinutes === 0) return;

    // Initialize activity timestamp if missing
    const now = Date.now();
    lastRecordedRef.current = now;
    try {
      localStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, String(now));
    } catch {}

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    const handleActivity = () => {
      recordActivity();
    };

    // Cross-tab sync via storage events
    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEY_LAST_ACTIVITY && e.newValue) {
        lastRecordedRef.current = parseInt(e.newValue, 10) || Date.now();
      }
      if (e.key === STORAGE_KEY_TIMEOUT && e.newValue !== null) {
        setTimeoutMinutesState(parseInt(e.newValue, 10) || 2);
      }
    };

    events.forEach((ev) => window.addEventListener(ev, handleActivity, { passive: true }));
    window.addEventListener('storage', handleStorageChange);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleActivity));
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user, timeoutMinutes, recordActivity]);

  // Main countdown & timeout checker loop (runs every 1 second)
  useEffect(() => {
    if (!user || timeoutMinutes === 0) {
      setShowWarning(false);
      return;
    }

    const checkInterval = setInterval(() => {
      let lastActivityTime = lastRecordedRef.current;
      try {
        const stored = localStorage.getItem(STORAGE_KEY_LAST_ACTIVITY);
        if (stored) {
          const parsed = parseInt(stored, 10);
          if (!isNaN(parsed) && parsed > lastActivityTime) {
            lastActivityTime = parsed;
            lastRecordedRef.current = parsed;
          }
        }
      } catch {}

      const elapsedMs = Date.now() - lastActivityTime;
      const totalAllowedMs = timeoutMinutes * 60 * 1000;
      const diffMs = totalAllowedMs - elapsedMs;
      const remainingSec = Math.max(0, Math.ceil(diffMs / 1000));

      setRemainingSeconds(remainingSec);

      // Warning threshold:
      // If timeout is 1 min (60s), warn at 20 seconds remaining.
      // If timeout >= 2 min, warn at 35 seconds remaining.
      const warningThreshold = timeoutMinutes === 1 ? 20 : 35;

      if (remainingSec <= 0) {
        clearInterval(checkInterval);
        triggerAutoLogout();
      } else if (remainingSec <= warningThreshold) {
        setShowWarning(true);
      } else {
        setShowWarning(false);
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [user, timeoutMinutes, triggerAutoLogout]);

  return (
    <SessionTimeoutContext.Provider
      value={{
        timeoutMinutes,
        setTimeoutMinutes,
        remainingSeconds,
        showWarning,
        resetInactivity,
        manualLogout,
        recordActivity,
      }}
    >
      {children}
    </SessionTimeoutContext.Provider>
  );
};

export const useSessionTimeout = () => {
  const context = useContext(SessionTimeoutContext);
  if (!context) {
    throw new Error('useSessionTimeout must be used within a SessionTimeoutProvider');
  }
  return context;
};
