import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { billingService } from '@/services/billingService';
import { queryKeys } from '@/lib/queryKeys';
import type { BillingStatus } from '@/types';

const STALE_MS = 5 * 60 * 1000;
/** setTimeout overflows past ~24.8 days; an expiry further out is simply re-armed by a later fetch. */
const MAX_TIMER_MS = 24 * 60 * 60 * 1000;

/**
 * The account's billing status: the single source for "may this user be in
 * the app" and for everything the subscription screens draw. One shared,
 * cached query, so the guard, the profile row and the banner cost one request.
 */
export function useBillingStatus() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: queryKeys.billing(),
    queryFn: () => billingService.getStatus().then((r) => r.data),
    staleTime: STALE_MS,
    enabled: isAuthenticated,
  });
}

/**
 * Keeps the cached status honest without polling. Mount it once, where the
 * gate lives.
 *  - Coming back to the app after a while refetches it (a plan can lapse, or
 *    be paid on another device, while the tab sleeps). Focus refetching is off
 *    app-wide, so this is explicit and only fires when the cache is stale.
 *  - Access has a known end instant: a timer refetches right then, so the
 *    paywall appears when the period ends, not at the next failed request.
 * The API's 402 remains the safety net behind both.
 */
export function useBillingFreshness() {
  const queryClient = useQueryClient();
  const { data } = useBillingStatus();
  const accessUntilUtc = data?.hasAccess ? data.subscription?.accessUntilUtc : null;

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const updatedAt = queryClient.getQueryState(queryKeys.billing())?.dataUpdatedAt ?? 0;
      if (Date.now() - updatedAt > STALE_MS) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.billing() });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [queryClient]);

  useEffect(() => {
    if (!accessUntilUtc) return;
    const msLeft = new Date(accessUntilUtc).getTime() - Date.now();
    if (Number.isNaN(msLeft) || msLeft > MAX_TIMER_MS) return;

    // A second past the instant, so the server agrees it is over.
    const timer = window.setTimeout(
      () => void queryClient.invalidateQueries({ queryKey: queryKeys.billing() }),
      Math.max(0, msLeft) + 1000,
    );
    return () => window.clearTimeout(timer);
  }, [accessUntilUtc, queryClient]);
}

/** Every billing mutation answers with the fresh status: write it straight into the cache. */
function useStatusMutation(mutationFn: () => Promise<BillingStatus>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (status) => queryClient.setQueryData(queryKeys.billing(), status),
  });
}

/** Asks the server to re-read the subscription from ONVO ("Already paid? Refresh"). */
export function useSyncBilling() {
  return useStatusMutation(() => billingService.sync().then((r) => r.data));
}

export function useCancelSubscription() {
  return useStatusMutation(() => billingService.cancel().then((r) => r.data));
}

export function useResumeSubscription() {
  return useStatusMutation(() => billingService.resume().then((r) => r.data));
}
