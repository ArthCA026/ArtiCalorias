import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet';
import { MiniTable } from '@/components/ui/MiniTable';
import { WeekStrip } from './WeekStrip';
import { budgetFor } from './CalorieHero';
import { useUnits } from '@/hooks/useUnits';
import { kcalToDisplay } from '@/utils/units';
import type { CalorieMode } from '@/hooks/useCalorieMode';
import type { DailyDashboardResponse } from '@/types';

interface DayDetailsSheetProps {
  open: boolean;
  onClose: () => void;
  dash: DailyDashboardResponse;
  mode: CalorieMode;
  date: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The numbers behind the ring, one tap away: eaten / budget / burned,
 * macro totals, and the week at a glance. Keeps the main screen short.
 */
export function DayDetailsSheet({ open, onClose, dash, mode, date }: DayDetailsSheetProps) {
  const { t } = useTranslation();
  const { energyUnit } = useUnits();
  const e = (kcal: number) => Math.round(kcalToDisplay(kcal, energyUnit)).toLocaleString();

  const budget = Math.max(budgetFor(dash, mode), 1);

  return (
    <Sheet open={open} onClose={onClose} title={t('today.details_title', 'Day details')}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-inset px-2 py-3 text-center">
            <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide">
              {t('today.eaten', 'Eaten')}
            </p>
            <p className="mt-1 text-[15px] font-bold text-ink tabular-nums">
              {e(dash.totalFoodCaloriesKcal)}
            </p>
          </div>
          <div className="rounded-2xl bg-inset px-2 py-3 text-center">
            <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide">
              {t('today.budget', 'Budget')}
            </p>
            <p className="mt-1 text-[15px] font-bold text-ink tabular-nums">
              {dash.hasCalorieBudgetEstimate ? e(budget) : '–'}
            </p>
          </div>
          <div className="rounded-2xl bg-inset px-2 py-3 text-center">
            <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide">
              {t('today.burned', 'Burned')}
            </p>
            <p className="mt-1 text-[15px] font-bold text-ink tabular-nums">
              {dash.hasCalorieEstimate ? e(dash.totalDailyExpenditureKcal) : '–'}
            </p>
          </div>
        </div>

        <div className="rounded-card bg-inset px-4 py-3">
          <p className="text-[13px] font-bold text-ink-2 uppercase tracking-wide mb-2">
            {t('today.macro_totals', 'Macros so far')}
          </p>
          <MiniTable
            cols={[
              { label: t('today.col_prot', 'Prot'), value: `${round1(dash.totalProteinGrams)}g` },
              { label: t('today.col_fat', 'Fat'), value: `${round1(dash.totalFatGrams)}g` },
              { label: t('today.col_carbs', 'Carbs'), value: `${round1(dash.totalCarbsGrams)}g` },
            ]}
          />
        </div>

        <WeekStrip date={date} baseGoalKcal={dash.snapshotDailyBaseGoalKcal} inset />
      </div>
    </Sheet>
  );
}
