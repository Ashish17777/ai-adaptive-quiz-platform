import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

interface ProtectedLayoutProps {
  allowedRoles?: ('student' | 'admin')[];
}

const ProtectedLayout: React.FC<ProtectedLayoutProps> = ({ allowedRoles }) => {
  const { user, token, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullPage />;
  }

  // If not authenticated, redirect to login page
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  // If role is restricted and user doesn't match, redirect to corresponding default dash
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  return <Outlet />;
};

export default ProtectedLayout;
