import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { parseDate } from '@/utils/format';
import { deltaFor, hasComparablePlan } from '@/utils/calorieMath';
import { dayTargetFor } from '@/utils/macros';
import { isLoggedDay, longestLoggedRun } from './weekMath';
import type { CalorieMode } from '@/hooks/useCalorieMode';
import type { DailyLogResponse } from '@/types';

interface WeeklyInsightCardProps {
  /** Monday of the shown week, yyyy-MM-dd */
  monday: string;
  days: DailyLogResponse[];
  /** Active calorie display mode, so "most on-plan" means the same as elsewhere */
  mode: CalorieMode;
}

/**
 * Weekly insight card: up to two observations computed from the user's own
 * logged week (weekly thinking over daily perfection). ArtiCalorias has no
 * free and paid tiers, so every subscriber gets the same card.
 */
export function WeeklyInsightCard({ monday, days, mode }: WeeklyInsightCardProps) {
  const { t, i18n } = useTranslation();

  const insights = useMemo(() => {
    const weekdayName = new Intl.DateTimeFormat(i18n.language, { weekday: 'long' });
    const dayName = (d: DailyLogResponse) => weekdayName.format(parseDate(d.logDate));
    const logged = days.filter(isLoggedDay);
    const list: string[] = [];

    // Most consistent / best on-plan day: smallest distance to the plan,
    // measured against the same budget every other screen uses.
    const comparable = days.filter(hasComparablePlan);
    if (comparable.length > 0) {
      const closest = comparable.reduce((a, b) =>
        Math.abs(deltaFor(b, mode)) < Math.abs(deltaFor(a, mode)) ? b : a,
      );
      list.push(
        t('progress.insight_consistent', '{{day}} was your most on-plan day.', {
          day: dayName(closest),
        }),
      );
    }

    // Average protein vs goal, each day against the protein target frozen on it.
    const proteinTargets = logged
      .map((d) => dayTargetFor(d, 'protein')?.target ?? null)
      .filter((v): v is number => v !== null);
    if (proteinTargets.length > 0) {
      const avg = Math.round(
        logged.reduce((s, d) => s + (d.macroTotals.protein ?? 0), 0) / logged.length,
      );
      const goal = Math.round(
        proteinTargets.reduce((s, v) => s + v, 0) / proteinTargets.length,
      );
      list.push(
        t('progress.insight_protein', 'Protein averaged {{avg}} g a day against your {{goal}} g goal.', {
          avg,
          goal,
        }),
      );
    }

    // Biggest burn day. Only days with body metrics have a burn figure at
    // all: without them the stored expenditure is little more than the
    // digestion of the food, and "biggest burn: 140 kcal" would be nonsense.
    const withBurn = days.filter((d) => d.hasCalorieBudgetEstimate && d.totalDailyExpenditureKcal > 0);
    if (withBurn.length > 0) {
      const top = withBurn.reduce((a, b) =>
        b.totalDailyExpenditureKcal > a.totalDailyExpenditureKcal ? b : a,
      );
      const energy = `${Math.round(top.totalDailyExpenditureKcal).toLocaleString(i18n.language)} kcal`;
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
  }, [days, monday, i18n.language, mode, t]);

  return (
    <Card variant="soft">
      <div className="flex items-center gap-2.5">
        <span className="text-primary-soft-ink">
          <Icon name="sparkles" size={19} />
        </span>
        <p className="text-[14px] font-bold text-ink">
          {t('progress.insight_title', 'Your weekly insight')}
        </p>
      </div>
      <ul className="mt-2.5 space-y-2">
        {insights.slice(0, 2).map((line, i) => (
          <li key={i} className="flex items-start gap-2 text-[13px] text-ink-2 leading-relaxed">
            <Icon name="check" size={15} className="mt-0.5 shrink-0 text-primary-soft-ink" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
