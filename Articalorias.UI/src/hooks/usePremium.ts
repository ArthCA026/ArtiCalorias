import { useCallback, useEffect, useState } from 'react';

/**
 * Mock premium subscription ("Plus"). Client-side only: state lives in
 * localStorage so the paywall and gated features can be demonstrated
 * without a real billing backend.
 */

export type PremiumPlan = 'monthly' | 'annual' | 'lifetime';

export interface PremiumState {
  active: boolean;
  plan: PremiumPlan | null;
  activatedAt: string | null;
  /** Reciprocity gift: one-time free preview of Plus insights */
  giftClaimedAt: string | null;
}

const STORAGE_KEY = 'ac-premium';
const CHANGE_EVENT = 'ac-premium-changed';

const defaultState: PremiumState = {
  active: false,
  plan: null,
  activatedAt: null,
  giftClaimedAt: null,
};

function load(): PremiumState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    return { ...defaultState, ...(JSON.parse(raw) as Partial<PremiumState>) };
  } catch {
    return defaultState;
  }
}

function save(state: PremiumState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function usePremium() {
  const [state, setState] = useState<PremiumState>(load);

  useEffect(() => {
    const sync = () => setState(load());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const activate = useCallback((plan: PremiumPlan) => {
    save({ ...load(), active: true, plan, activatedAt: new Date().toISOString() });
  }, []);

  const cancel = useCallback(() => {
    save({ ...load(), active: false, plan: null, activatedAt: null });
  }, []);

  const claimGift = useCallback(() => {
    const current = load();
    if (!current.giftClaimedAt) {
      save({ ...current, giftClaimedAt: new Date().toISOString() });
    }
  }, []);

  return {
    isPremium: state.active,
    plan: state.plan,
    giftClaimed: state.giftClaimedAt !== null,
    activate,
    cancel,
    claimGift,
  };
}
