import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/utils/cn';
import { findPlan, formatPrice, yearlyPerMonthCents, yearlySavingsPercent } from '@/utils/billing';
import type { BillingPlan, BillingPlanCode } from '@/types';

interface PlanPickerProps {
  plans: BillingPlan[];
  value: BillingPlanCode;
  onChange: (code: BillingPlanCode) => void;
  disabled?: boolean;
}

/**
 * Two plans, one decision. Yearly leads and arrives preselected (smart
 * default); the monthly plan sits next to it as the price anchor.
 *
 * The anchor is an honest one: "12 months at the monthly price" is a plan
 * anyone can really buy, never an invented "was" price, and the saving is
 * rounded DOWN. The amount actually charged is always the biggest number on
 * the card; the per-month equivalent is secondary and labelled as such.
 */
export function PlanPicker({ plans, value, onChange, disabled }: PlanPickerProps) {
  const { t, i18n } = useTranslation();
  const monthly = findPlan(plans, 'monthly');
  const yearly = findPlan(plans, 'yearly');
  const savings = yearlySavingsPercent(monthly, yearly);
  const price = (cents: number, currency: string) => formatPrice(cents, currency, i18n.language);

  const options: Array<{
    plan: BillingPlan;
    title: string;
    period: string;
    badge?: string;
    detail: React.ReactNode;
  }> = [];

  if (yearly) {
    options.push({
      plan: yearly,
      title: t('billing.plan_yearly', 'Yearly'),
      period: t('billing.per_year', 'per year'),
      badge: savings > 0 ? t('billing.save_percent', 'Save {{percent}}%', { percent: savings }) : undefined,
      detail: (
        <>
          {t('billing.yearly_per_month', 'Works out to {{price}} a month.', {
            price: price(yearlyPerMonthCents(yearly), yearly.currency),
          })}
          {monthly && savings > 0 && (
            <>
              {' '}
              {t('billing.yearly_anchor', 'Paying monthly for a year costs {{price}}.', {
                price: price(monthly.priceCents * 12, monthly.currency),
              })}
            </>
          )}
        </>
      ),
    });
  }

  if (monthly) {
    options.push({
      plan: monthly,
      title: t('billing.plan_monthly', 'Monthly'),
      period: t('billing.per_month', 'per month'),
      detail: t('billing.monthly_detail', 'Billed every month.'),
    });
  }

  return (
    <div className="space-y-2.5" role="radiogroup" aria-label={t('billing.plans_aria', 'Choose a plan')}>
      {options.map(({ plan, title, period, badge, detail }) => {
        const active = value === plan.code;
        return (
          <button
            key={plan.code}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(plan.code)}
            className={cn(
              'pressable w-full rounded-card px-4 py-3.5 text-left flex items-start gap-3',
              'disabled:opacity-60 disabled:pointer-events-none',
              active ? 'bg-primary-soft ring-2 ring-primary' : 'bg-card',
            )}
          >
            <span
              className={cn(
                'mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0',
                active ? 'bg-primary text-on-primary' : 'bg-inset',
              )}
            >
              {active && <Icon name="check" size={12} strokeWidth={3.5} />}
            </span>

            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-2 flex-wrap">
                <span className="text-[15px] font-bold text-ink">{title}</span>
                {badge && (
                  <span className="text-[10px] font-extrabold uppercase tracking-wide bg-primary text-on-primary rounded-full px-2 py-0.5">
                    {badge}
                  </span>
                )}
              </span>
              <span className="block text-[12px] text-ink-2 mt-1 leading-snug">{detail}</span>
            </span>

            <span className="shrink-0 text-right">
              <span className="block text-[17px] font-extrabold text-ink tabular-nums leading-tight">
                {price(plan.priceCents, plan.currency)}
              </span>
              <span className="block text-[11px] text-ink-2">{period}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
