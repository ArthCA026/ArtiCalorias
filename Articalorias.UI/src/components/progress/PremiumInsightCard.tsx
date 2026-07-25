import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { usePremium } from '@/hooks/usePremium';
import { useUnits } from '@/hooks/useUnits';
import { energyLabel, kcalToDisplay } from '@/utils/units';
import { parseDate } from '@/utils/format';
import { isLoggedDay, longestLoggedRun } from './weekMath';
import { FEATURES } from '@/config/features';
import type { DailyLogResponse } from '@/types';

interface PremiumInsightCardProps {
  /** Monday of the shown week, yyyy-MM-dd */
  monday: string;
  days: DailyLogResponse[];
}

/**
 * Weekly insight card. For free users it is a reciprocity gift: one real
 * insight computed from their own week, plus a gentle loss-aversion nudge
 * to keep the feature. Premium users get the full pair of insights.
 */
export function PremiumInsightCard({ monday, days }: PremiumInsightCardProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { energyUnit } = useUnits();
  const { isPremium, claimGift } = usePremium();

  // Reciprocity: the free preview counts as the one-time gift.
  useEffect(() => {
    if (FEATURES.premium && !isPremium) claimGift();
  }, [isPremium, claimGift]);

  const insights = useMemo(() => {
    const weekdayName = new Intl.DateTimeFormat(i18n.language, { weekday: 'long' });
    const dayName = (d: DailyLogResponse) => weekdayName.format(parseDate(d.logDate));
    const logged = days.filter(isLoggedDay);
    const list: string[] = [];

    // Most consistent / best on-plan day: smallest distance to the plan.
    if (logged.length > 0) {
      const closest = logged.reduce((a, b) =>
        Math.abs(b.dailyGoalDeltaKcal) < Math.abs(a.dailyGoalDeltaKcal) ? b : a,
      );
      list.push(
        t('progress.insight_consistent', '{{day}} was your most on-plan day.', {
          day: dayName(closest),
        }),
      );
    }

    // Average protein vs goal.
    const withGoal = logged.filter((d) => d.snapshotProteinGoalGrams > 0);
    if (withGoal.length > 0) {
      const avg = Math.round(
        logged.reduce((s, d) => s + d.totalProteinGrams, 0) / logged.length,
      );
      const goal = Math.round(
        withGoal.reduce((s, d) => s + d.snapshotProteinGoalGrams, 0) / withGoal.length,
      );
      list.push(
        t('progress.insight_protein', 'Protein averaged {{avg}} g a day against your {{goal}} g goal.', {
          avg,
          goal,
        }),
      );
    }

    // Biggest burn day.
    const withBurn = days.filter((d) => d.totalDailyExpenditureKcal > 0);
    if (withBurn.length > 0) {
      const top = withBurn.reduce((a, b) =>
        b.totalDailyExpenditureKcal > a.totalDailyExpenditureKcal ? b : a,
      );
      const energy = `${Math.round(
        kcalToDisplay(top.totalDailyExpenditureKcal, energyUnit),
      ).toLocaleString(i18n.language)} ${energyLabel(energyUnit)}`;
      list.push(
        t('progress.insight_burn', 'Your biggest burn day was {{day}} at {{energy}}.', {
          day: dayName(top),
          energy,
        }),
      );
    }

    // Fallbacks so the card always has something true to say.
    const run = longestLoggedRun(days, monday);
    if (run >= 2) {
      list.push(t('progress.insight_run', 'You logged {{n}} days in a row this week.', { n: run }));
    }
    if (list.length === 0) {
      list.push(
        t('progress.insight_days_logged', 'You logged {{n}} of 7 days this week.', {
          n: logged.length,
        }),
      );
    }
    return list;
  }, [days, monday, i18n.language, energyUnit, t]);

  // Hidden entirely while the subscription is disabled in development
  if (!FEATURES.premium) return null;

  if (!isPremium) {
    return (
      <Card variant="premium">
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-xl bg-card text-premium flex items-center justify-center shrink-0">
            <Icon name="gift" size={18} />
          </span>
          <div className="flex-1">
            <p className="text-[14px] font-bold text-ink">
              {t('progress.gift_title', "A gift for you: this week's insight")}
            </p>
            <p className="mt-1 text-[13px] text-ink-2 leading-relaxed">{insights[0]}</p>
            <p className="mt-1.5 text-[12px] font-semibold text-premium">
              {t('progress.gift_note', 'Free preview this week')}
            </p>
          </div>
        </div>
        <Button
          variant="premium"
          size="md"
          fullWidth
          className="mt-3.5"
          onClick={() => navigate('/premium')}
        >
          {t('progress.gift_cta', 'Keep weekly insights')}
        </Button>
      </Card>
    );
  }

  return (
    <Card variant="premium">
      <div className="flex items-center gap-2.5">
        <span className="text-premium">
          <Icon name="crown" size={19} />
        </span>
        <p className="text-[14px] font-bold text-ink">
          {t('progress.insight_title', 'Your weekly insight')}
        </p>
      </div>
      <ul className="mt-2.5 space-y-2">
        {insights.slice(0, 2).map((line, i) => (
          <li key={i} className="flex items-start gap-2 text-[13px] text-ink-2 leading-relaxed">
            <Icon name="sparkles" size={15} className="mt-0.5 shrink-0 text-premium" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
