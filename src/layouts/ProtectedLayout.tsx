import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import authClient from '../utils/auth-client';
import LoadingSpinner from '../components/LoadingSpinner';

interface ProtectedLayoutProps {
  allowedRoles?: ('student' | 'admin')[];
}

const ProtectedLayout: React.FC<ProtectedLayoutProps> = ({ allowedRoles }) => {
  // Use authClient.useSession() directly — this is the source of truth
  // It reads the Better Auth session cookie via fetch with credentials
  const { data: session, isPending } = authClient.useSession();

  // Still loading — don't redirect yet
  if (isPending) {
    return <LoadingSpinner fullPage />;
  }

  // No session = not logged in
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  let role = (session?.user as any)?.role as 'student' | 'admin' | undefined;
  const savedUserStr = localStorage.getItem('user');
  if (savedUserStr) {
    try {
      const savedUser = JSON.parse(savedUserStr);
      if (savedUser.role) {
        role = savedUser.role;
      }
    } catch (_) {}
  }

  // Role-based access check
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to={role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  return <Outlet />;
};

export default ProtectedLayout;
