import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute — wraps a route and redirects to /forbidden if the user
 * does not have one of the allowed roles.
 *
 * Props:
 *   requiredRoles  string[]   e.g. ['admin', 'waiter', 'cook']
 *                             If empty / omitted → any authenticated user is allowed.
 *   children       ReactNode  the page to render when access is granted
 *
 * Redirect targets:
 *   /forbidden?required=<roles>&from=<path>
 */
export default function ProtectedRoute({ requiredRoles = [], children }) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  const roles = requiredRoles.length > 0 ? requiredRoles : ['admin', 'waiter', 'cook'];

  // Not logged in at all
  if (!isAuthenticated || !user) {
    const q = new URLSearchParams({
      required: roles.join(','),
      from: location.pathname,
    });
    return <Navigate to={`/forbidden?${q}`} replace />;
  }

  // Logged in but wrong role
  if (!roles.includes(user.role)) {
    const q = new URLSearchParams({
      required: roles.join(','),
      from: location.pathname,
    });
    return <Navigate to={`/forbidden?${q}`} replace />;
  }

  return children;
}
