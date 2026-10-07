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
  purchases:      { storekeeper: false, manager: true,  admin: true },
  suppliers:      { storekeeper: false, manager: true,  admin: true },
  reports:        { storekeeper: false, manager: true,  admin: true },
  analytics:      { storekeeper: false, manager: true,  admin: true },
  staffAccounts:  { storekeeper: false, manager: false, admin: true },
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  const [rolePermissions, setRolePermissions] = useState(() => {
    try {
      const saved = localStorage.getItem('hotelStockPermissions');
      return saved ? JSON.parse(saved) : DEFAULT_PERMISSIONS;
    } catch {
      return DEFAULT_PERMISSIONS;
    }
  });

  const [navVisibility, setNavVisibility] = useState(() => {
    try {
      const saved = localStorage.getItem('hotelStockNavVisibility');
      return saved ? JSON.parse(saved) : DEFAULT_NAV_VISIBILITY;
    } catch {
      return DEFAULT_NAV_VISIBILITY;
    }
  });

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
      console.warn('Could not fetch settings, using defaults/cached', err);
    }
    return null;
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('hotelStockAuth');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        fetchPermissions();
      } catch {
        localStorage.removeItem('hotelStockAuth');
      }
    }
    setLoading(false);
  }, [fetchPermissions]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('hotelStockAuth', JSON.stringify(data));
    setUser(data);
    await fetchPermissions();
    return data;
  };

  const logout = () => {
    localStorage.removeItem('hotelStockAuth');
    setUser(null);
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
    // newSettings can be the full settings object or just rolePermissions (legacy)
    if (newSettings) {
      // Handle both shapes: full settings object OR bare rolePermissions map
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
