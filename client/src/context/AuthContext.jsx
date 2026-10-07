import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

const DEFAULT_PERMISSIONS = {
  recordGoods:      { storekeeper: true,  manager: true,  admin: true },
  checkReview:      { storekeeper: false, manager: true,  admin: true },
  approveGoods:     { storekeeper: false, manager: false, admin: true },
  postLedger:       { storekeeper: false, manager: true,  admin: true },
  voidTransactions: { storekeeper: false, manager: false, admin: true },
  viewReports:      { storekeeper: false, manager: true,  admin: true },
  manageAccounts:   { storekeeper: false, manager: false, admin: true },
};

const DEFAULT_NAV_VISIBILITY = {
  dashboard:      { storekeeper: true,  manager: true,  admin: true },
  rawMaterials:   { storekeeper: true,  manager: true,  admin: true },
  products:       { storekeeper: true,  manager: true,  admin: true },
  stockMovements: { storekeeper: true,  manager: true,  admin: true },
  suppliers:      { storekeeper: false, manager: true,  admin: true },
  reports:        { storekeeper: false, manager: true,  admin: true },
  analytics:      { storekeeper: false, manager: true,  admin: true },
  staffAccounts:  { storekeeper: false, manager: false, admin: true },
};

/** Clear every settings-related key from localStorage */
const clearSettingsCache = () => {
  localStorage.removeItem('hotelStockPermissions');
  localStorage.removeItem('hotelStockNavVisibility');
};

export const AuthProvider = ({ children }) => {
  const [user, setUser]                     = useState(null);
  const [rolePermissions, setRolePermissions] = useState(DEFAULT_PERMISSIONS);
  const [navVisibility,   setNavVisibility]   = useState(DEFAULT_NAV_VISIBILITY);

  // loading stays true until BOTH the user AND the server settings are resolved
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await api.get('/settings');
      if (res.data?.rolePermissions) {
        setRolePermissions(res.data.rolePermissions);
        localStorage.setItem('hotelStockPermissions', JSON.stringify(res.data.rolePermissions));
      }
      if (res.data?.navVisibility) {
        setNavVisibility(res.data.navVisibility);
        localStorage.setItem('hotelStockNavVisibility', JSON.stringify(res.data.navVisibility));
      }
      return res.data;
    } catch (err) {
      // Network failure: fall back to localStorage cache if available, else hardcoded defaults
      try {
        const cachedRP = localStorage.getItem('hotelStockPermissions');
        const cachedNV = localStorage.getItem('hotelStockNavVisibility');
        if (cachedRP) setRolePermissions(JSON.parse(cachedRP));
        if (cachedNV) setNavVisibility(JSON.parse(cachedNV));
      } catch { /* ignore parse errors */ }
      console.warn('Could not fetch settings from server, using cache/defaults', err);
    }
    return null;
  }, []);

  // On mount: restore user from localStorage, then AWAIT fetchPermissions before
  // clearing the loading flag. This prevents a flash of wrong nav items.
  useEffect(() => {
    const init = async () => {
      const stored = localStorage.getItem('hotelStockAuth');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setUser(parsed);
          // Fetch server settings BEFORE showing the app
          await fetchPermissions();
        } catch {
          localStorage.removeItem('hotelStockAuth');
        }
      }
      // Only now allow the app to render
      setLoading(false);
    };
    init();
  }, [fetchPermissions]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('hotelStockAuth', JSON.stringify(data));
    setUser(data);
    // Fetch authoritative settings right after login — no stale cache possible
    await fetchPermissions();
    return data;
  };

  const logout = () => {
    localStorage.removeItem('hotelStockAuth');
    // Clear ALL cached settings so the next login always reads fresh server data
    clearSettingsCache();
    setUser(null);
    setRolePermissions(DEFAULT_PERMISSIONS);
    setNavVisibility(DEFAULT_NAV_VISIBILITY);
  };

  const updateUser = (updatedData) => {
    const newUser = { ...user, ...updatedData };
    localStorage.setItem('hotelStockAuth', JSON.stringify(newUser));
    setUser(newUser);
  };

  const hasRole = (...roles) => user && roles.includes(user.role);

  /** Check a workflow/action capability (e.g. 'recordGoods') */
  const can = (capability) => {
    if (!user) return false;
    if (user.role === 'admin') {
      const adminVal = rolePermissions?.[capability]?.admin;
      return adminVal !== false;
    }
    return Boolean(rolePermissions?.[capability]?.[user.role]);
  };

  /** Check whether a sidebar nav section is visible for this user's role */
  const canSeeNav = (navKey) => {
    if (!user) return false;
    const nav = navVisibility ?? DEFAULT_NAV_VISIBILITY;
    const entry = nav[navKey];
    if (!entry) return true; // unknown key — show by default
    return Boolean(entry[user.role]);
  };

  const refreshPermissions = async (newSettings) => {
    if (newSettings) {
      const rp = newSettings.rolePermissions ?? newSettings;
      const nv = newSettings.navVisibility ?? null;

      setRolePermissions(rp);
      localStorage.setItem('hotelStockPermissions', JSON.stringify(rp));

      if (nv) {
        setNavVisibility(nv);
        localStorage.setItem('hotelStockNavVisibility', JSON.stringify(nv));
      }
      return newSettings;
    }
    return await fetchPermissions();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        updateUser,
        hasRole,
        can,
        canSeeNav,
        rolePermissions,
        navVisibility,
        refreshPermissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
