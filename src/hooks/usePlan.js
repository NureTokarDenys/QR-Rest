import { usePlanContext } from '../context/PlanContext';
import { useApp } from '../context/AppContext';

/**
 * Returns the current restaurant's plan ('free' | 'premium').
 * For staff pages: reads from PlanContext (fetched from admin API).
 * For client pages: reads from AppContext.restaurantPlan.
 * Falls back to 'free'.
 */
export function usePlan() {
  const planCtx = usePlanContext();
  const appCtx  = useApp();

  const plan = planCtx?.plan || appCtx?.restaurantPlan || 'free';
  return { plan, isPremium: plan === 'premium', isFree: plan === 'free' };
}
