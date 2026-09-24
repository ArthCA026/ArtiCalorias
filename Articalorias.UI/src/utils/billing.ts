import type { BillingPlan, BillingPlanCode } from '@/types';

/**
 * Billing display helpers. Every price on screen comes from the server's plan
 * catalogue (GET billing/status) and goes through formatPrice: nothing here
 * hardcodes an amount, so a price change is a server edit only.
 */

/** "$29.99" in English, "$29,99" in Spanish (Costa Rican conventions). */
export function formatPrice(cents: number, currency: string, language: string): string {
  const locale = language.startsWith('es') ? 'es-CR' : 'en-US';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).format(cents / 100);
  } catch {
    // Unknown currency code: still show the honest number.
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function findPlan(plans: BillingPlan[], code: BillingPlanCode): BillingPlan | undefined {
  return plans.find((p) => p.code === code);
}

/** What one month of the yearly plan works out to, rounded to the cent. */
export function yearlyPerMonthCents(yearly: BillingPlan): number {
  return Math.round(yearly.priceCents / 12);
}

/**
 * How much cheaper the yearly plan is than twelve monthly payments, as a whole
 * percentage ROUNDED DOWN: the claim on screen must never overstate the deal.
 * Both prices are real, purchasable plans, so the comparison is a true one.
 * Returns 0 when there is nothing to save (or the plans are not comparable).
 */
export function yearlySavingsPercent(monthly?: BillingPlan, yearly?: BillingPlan): number {
  if (!monthly || !yearly || monthly.currency !== yearly.currency || monthly.priceCents <= 0) return 0;
  const twelveMonths = monthly.priceCents * 12;
  const saved = twelveMonths - yearly.priceCents;
  if (saved <= 0) return 0;
  return Math.floor((saved / twelveMonths) * 100);
}

/**
 * A UTC instant from the API as the user's LOCAL calendar date. Billing dates
 * are instants (a renewal at 03:00 UTC is "Oct 17" in Costa Rica and "Oct 18"
 * in Madrid), so they are formatted from the instant, never from a sliced
 * yyyy-MM-dd string.
 */
export function formatBillingDate(isoUtc: string | null | undefined, language: string): string {
  if (!isoUtc) return '';
  const date = new Date(isoUtc);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

/** Whole days left until a UTC instant, never negative. "Today" is 0. */
export function daysUntil(isoUtc: string | null | undefined, now: Date = new Date()): number | null {
  if (!isoUtc) return null;
  const target = new Date(isoUtc).getTime();
  if (Number.isNaN(target)) return null;
  return Math.max(0, Math.ceil((target - now.getTime()) / 86_400_000));
}
