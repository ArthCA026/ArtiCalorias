import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { FEATURES } from '@/config/features';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ConfirmSheet } from '@/components/ui/ActionSheet';
import { useToast } from '@/components/ui/Toast';
import { usePremium, type PremiumPlan } from '@/hooks/usePremium';
import { cn } from '@/utils/cn';

/**
 * Mock subscription paywall ("Plus").
 * Persuasion structure, in order:
 *  - reciprocity: a gift banner before any ask
 *  - social proof: member count, rating, testimonial
 *  - price anchoring: lifetime anchors high, annual reads as the deal
 *  - smart default: annual preselected
 *  - loss aversion: trial framing and cancel copy
 * No real billing: activation is stored locally.
 */

interface PlanDef {
  id: PremiumPlan;
  priceLabel: string;
  perMonthLabel?: string;
  badge?: string;
}

const featureIcons: IconName[] = ['chart', 'zap', 'bookmark', 'sparkles'];

export default function PremiumPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isPremium, plan, activate, cancel } = usePremium();
  const [selected, setSelected] = useState<PremiumPlan>('annual');
  const [processing, setProcessing] = useState(false);
  const [justJoined, setJustJoined] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Subscription UI is disabled in development (see src/config/features.ts)
  if (!FEATURES.premium) return <Navigate to="/today" replace />;

  const plans: PlanDef[] = [
    {
      id: 'lifetime',
      priceLabel: t('premium.lifetime_price', '99.99 once'),
      badge: t('premium.lifetime_badge', 'Forever'),
    },
    {
      id: 'annual',
      priceLabel: t('premium.annual_price', '39.99 / year'),
      perMonthLabel: t('premium.annual_permonth', 'That is 3.33 a month, save 58%'),
      badge: t('premium.annual_badge', 'Best value'),
    },
    {
      id: 'monthly',
      priceLabel: t('premium.monthly_price', '7.99 / month'),
    },
  ];

  const features = [
    t('premium.feature_insights', 'Weekly insight reports on your trends'),
    t('premium.feature_macros', 'Deeper macro analytics and projections'),
    t('premium.feature_templates', 'Unlimited templates and routines'),
    t('premium.feature_ai', 'Priority AI parsing at busy times'),
  ];

  const startTrial = () => {
    setProcessing(true);
    // Mock checkout: no real billing behind this
    window.setTimeout(() => {
      activate(selected);
      setProcessing(false);
      setJustJoined(true);
      toast('success', t('premium.welcome_toast', 'Welcome to Plus!'));
    }, 1200);
  };

  if (isPremium) {
    return (
      <div className="mx-auto max-w-md px-4 pt-4 pb-10 min-h-dvh">
        <header className="flex items-center gap-2 mb-4">
          <IconButton icon="arrowLeft" label={t('common.back', 'Back')} onClick={() => navigate(-1)} />
          <h1 className="text-[20px] font-extrabold text-ink">{t('premium.title', 'ArtiCalorias Plus')}</h1>
        </header>

        <Card variant="premium" className={cn('text-center py-8', justJoined && 'animate-pop')}>
          <span className="inline-flex w-14 h-14 rounded-2xl bg-premium text-white items-center justify-center">
            <Icon name="crown" size={28} />
          </span>
          <p className="mt-3 text-lg font-extrabold text-ink">
            {t('premium.member_title', 'You are a Plus member')}
          </p>
          <p className="mt-1 text-sm text-ink-2">
            {plan === 'lifetime'
              ? t('premium.member_lifetime', 'Lifetime access. You are set forever.')
              : plan === 'annual'
                ? t('premium.member_annual', 'Annual plan, renews once a year.')
                : t('premium.member_monthly', 'Monthly plan, renews every month.')}
          </p>
        </Card>

        <Card className="mt-4" padded={false}>
          {features.map((f, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <span className="w-8 h-8 rounded-xl bg-premium-soft text-premium flex items-center justify-center shrink-0">
                <Icon name={featureIcons[i]} size={16} />
              </span>
              <span className="text-[14px] font-semibold text-ink">{f}</span>
              <Icon name="check" size={16} className="ml-auto text-success" />
            </div>
          ))}
        </Card>

        {plan !== 'lifetime' && (
          <Button variant="ghost" size="md" fullWidth className="mt-5" onClick={() => setConfirmCancel(true)}>
            {t('premium.cancel_cta', 'Cancel subscription')}
          </Button>
        )}

        <ConfirmSheet
          open={confirmCancel}
          onClose={() => setConfirmCancel(false)}
          title={t('premium.cancel_title', 'Cancel Plus?')}
          body={t('premium.cancel_body', 'You will lose your weekly insight reports and deeper analytics right away. Your logged data stays safe.')}
          confirmLabel={t('premium.cancel_confirm', 'Yes, cancel')}
          cancelLabel={t('premium.cancel_keep', 'Keep my benefits')}
          onConfirm={() => {
            cancel();
            setConfirmCancel(false);
            toast('info', t('premium.cancelled_toast', 'Subscription cancelled'));
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 pt-4 pb-10 min-h-dvh">
      <header className="flex items-center gap-2">
        <IconButton icon="arrowLeft" label={t('common.back', 'Back')} onClick={() => navigate(-1)} />
      </header>

      <div className="text-center mt-2">
        <span className="inline-flex w-16 h-16 rounded-3xl bg-premium-soft text-premium items-center justify-center">
          <Icon name="crown" size={32} />
        </span>
        <h1 className="mt-3 text-2xl font-extrabold text-ink">{t('premium.title', 'ArtiCalorias Plus')}</h1>
        <p className="mt-1 text-[15px] text-ink-2">
          {t('premium.subtitle', 'See the patterns behind your progress')}
        </p>
      </div>

      {/* Reciprocity: give before asking */}
      <Card variant="soft" className="mt-5 flex items-center gap-3">
        <span className="w-10 h-10 rounded-2xl bg-card text-primary-soft-ink flex items-center justify-center shrink-0">
          <Icon name="gift" size={20} />
        </span>
        <p className="text-[13px] font-semibold text-primary-soft-ink leading-snug">
          {t('premium.gift_banner', 'Because you have been logging with us, we added 7 extra free days on top of any plan you pick.')}
        </p>
      </Card>

      <Card className="mt-4" padded={false}>
        {features.map((f, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <span className="w-8 h-8 rounded-xl bg-premium-soft text-premium flex items-center justify-center shrink-0">
              <Icon name={featureIcons[i]} size={16} />
            </span>
            <span className="text-[14px] font-semibold text-ink">{f}</span>
          </div>
        ))}
      </Card>

      {/* Plans: lifetime anchors high, annual is the preselected deal */}
      <div className="mt-4 space-y-2.5" role="radiogroup" aria-label={t('premium.plans_aria', 'Choose a plan')}>
        {plans.map((p) => {
          const active = selected === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(p.id)}
              className={cn(
                'pressable w-full rounded-card px-4 py-3.5 text-left flex items-center gap-3',
                active ? 'bg-premium-soft ring-2 ring-premium' : 'bg-card',
              )}
            >
              <span
                className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center shrink-0',
                  active ? 'bg-premium text-white' : 'bg-inset',
                )}
              >
                {active && <Icon name="check" size={12} strokeWidth={3.5} />}
              </span>
              <span className="flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-[15px] font-bold text-ink">
                    {p.id === 'lifetime'
                      ? t('premium.lifetime', 'Lifetime')
                      : p.id === 'annual'
                        ? t('premium.annual', 'Annual')
                        : t('premium.monthly', 'Monthly')}
                  </span>
                  {p.badge && (
                    <span className="text-[10px] font-extrabold uppercase tracking-wide bg-premium text-white rounded-full px-2 py-0.5">
                      {p.badge}
                    </span>
                  )}
                </span>
                {p.perMonthLabel && (
                  <span className="block text-[12px] text-ink-2 mt-0.5">{p.perMonthLabel}</span>
                )}
              </span>
              <span className="text-[15px] font-extrabold text-ink tabular-nums">{p.priceLabel}</span>
            </button>
          );
        })}
      </div>

      <Button
        variant="premium"
        size="lg"
        fullWidth
        className="mt-4"
        loading={processing}
        onClick={startTrial}
      >
        {t('premium.cta', 'Start my 14 day free trial')}
      </Button>
      <p className="mt-2 text-center text-[12px] text-ink-3">
        {t('premium.cta_note', 'No charge today. Cancel anytime in two taps.')}
      </p>

      {/* Social proof */}
      <div className="mt-6 flex items-center justify-center gap-2 text-ink-2">
        <Icon name="users" size={16} />
        <span className="text-[13px] font-semibold">
          {t('premium.social_members', 'Trusted by 48,000+ members')}
        </span>
        <span aria-hidden="true">|</span>
        <Icon name="star" size={15} className="text-premium" />
        <span className="text-[13px] font-semibold">
          {t('premium.social_rating', '4.8 of 5')}
        </span>
      </div>

      <Card variant="inset" className="mt-3">
        <p className="text-[13px] text-ink-2 leading-relaxed">
          {t('premium.testimonial', '"The weekly report finally made my progress make sense. I stopped obsessing over single days."')}
        </p>
        <p className="mt-2 text-[12px] font-bold text-ink-3">
          {t('premium.testimonial_author', 'Marta R., member for 8 months')}
        </p>
      </Card>

      <Button variant="ghost" size="md" fullWidth className="mt-4" onClick={() => navigate(-1)}>
        {t('premium.later', 'Maybe later')}
      </Button>
    </div>
  );
}
