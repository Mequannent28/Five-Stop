import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

const DEFAULT_PERMISSIONS = {
  recordGoods: { storekeeper: true, manager: true, admin: true },
  checkReview: { storekeeper: false, manager: true, admin: true },
  approveGoods: { storekeeper: false, manager: false, admin: true },
  postLedger: { storekeeper: false, manager: true, admin: true },
  voidTransactions: { storekeeper: false, manager: false, admin: true },
  viewReports: { storekeeper: false, manager: true, admin: true },
  manageAccounts: { storekeeper: false, manager: false, admin: true },
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
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await api.get('/settings');
      if (res.data?.rolePermissions) {
        setRolePermissions(res.data.rolePermissions);
        localStorage.setItem('hotelStockPermissions', JSON.stringify(res.data.rolePermissions));
        return res.data.rolePermissions;
      }
    } catch (err) {
      console.warn('Could not fetch settings permissions, using defaults/cached', err);
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

  const can = (capability) => {
    if (!user) return false;
    if (user.role === 'admin') {
      const adminVal = rolePermissions?.[capability]?.admin;
      return adminVal !== false;
    }
    return Boolean(rolePermissions?.[capability]?.[user.role]);
  };

  const refreshPermissions = async (newPermissions) => {
    if (newPermissions) {
      setRolePermissions(newPermissions);
      localStorage.setItem('hotelStockPermissions', JSON.stringify(newPermissions));
      return newPermissions;
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
        rolePermissions,
        refreshPermissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

