import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, roles, capability }) => {
  const { user, loading, can } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-200 border-t-brass-400" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (capability && !can(capability)) {
    return <Navigate to="/" replace />;
  }

  if (roles && !capability && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;

