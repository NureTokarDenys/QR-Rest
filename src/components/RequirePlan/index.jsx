import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePlanContext } from '../../context/PlanContext';

/**
 * Route-level plan guard. Renders nothing while the plan is being fetched
 * (prevents a flash-redirect for premium users on initial load), then redirects
 * free-plan users away from premium routes entirely.
 *
 * Usage in App.jsx:
 *   <RequirePlan><Analytics /></RequirePlan>
 */
export default function RequirePlan({ children, redirectTo = '/staff/map' }) {
  const ctx = usePlanContext();

  // Still fetching — show nothing so premium users don't get a flicker redirect
  if (ctx?.planLoading) return null;

  // Free plan → hard redirect, page never renders
  if (!ctx?.isPremium) return <Navigate to={redirectTo} replace />;

  return children;
}
