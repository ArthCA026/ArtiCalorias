import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/Progress';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { useHaptics } from '@/hooks/useHaptics';
import { foodService } from '@/services/foodService';
import { invalidateDayData } from '@/lib/queryKeys';
import { extractApiError } from '@/utils/apiError';
import { dayTargetFor } from '@/utils/macros';
import { cn } from '@/utils/cn';
import type { DailyLogResponse } from '@/types';

interface WaterCardProps {
  date: string;
  log: DailyLogResponse;
}

/**
 * Water tracker, shown only on days whose frozen targets include water.
 * One tap logs a glass or a bottle as a transparent 0 kcal "Water" entry in
 * the meal list (editable and deletable like any other entry), so there is
 * no hidden second bookkeeping system for fluids. Drinks parsed by the AI
 * (coffee, soda) add their volume here automatically.
 */
export function WaterCard({ date, log }: WaterCardProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const haptics = useHaptics();
  const queryClient = useQueryClient();

  const target = dayTargetFor(log, 'water');
  const totalMl = log.totalWaterMl ?? 0;
  const goalMl = target?.target ?? null;
  const reached = goalMl !== null && totalMl >= goalMl;

  const add = useMutation({
    mutationFn: (ml: number) =>
      foodService.create(date, {
        foodName: t('water.entry_name', 'Water'),
        portionDescription: `${ml} ml`,
        quantity: 1,
        caloriesKcal: 0,
        proteinGrams: 0,
        fatGrams: 0,
        carbsGrams: 0,
        alcoholGrams: 0,
        sugarGrams: 0,
        waterMl: ml,
      }),
    onSuccess: () => {
      haptics.success();
      invalidateDayData(queryClient);
    },
    onError: (err) =>
      toast('error', extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.'))),
  });

  if (!target) return null;

  return (
    <Card>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-water-soft text-water">
          <Icon name="glassWater" size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-semibold text-ink-2">
              {t('water.title', 'Water')}
            </span>
            <span className="text-[13px] font-bold text-ink tabular-nums">
              {Math.round(totalMl).toLocaleString()}
              {goalMl !== null && (
                <span className="text-ink-3 font-medium"> / {Math.round(goalMl).toLocaleString()}</span>
              )}{' '}
              ml
            </span>
          </div>
          <div className="mt-1.5">
            <ProgressBar
              progress={goalMl !== null && goalMl > 0 ? totalMl / goalMl : 0}
              height={6}
              color="var(--t-water)"
              label={t('water.bar_aria', 'Water progress')}
            />
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {/* Icons over numbers: a glass (250 ml) and a bottle (500 ml) read
              instantly; the exact ml lives in the aria label and the entry. */}
          <button
            type="button"
            disabled={add.isPending}
            onClick={() => add.mutate(250)}
            className={cn(
              'pressable inline-flex items-center gap-0.5 rounded-full bg-water-soft px-3 py-2 text-[13px] font-bold text-water',
              add.isPending && 'opacity-50',
            )}
            aria-label={t('water.add_glass_aria', 'Add a 250 ml glass of water')}
          >
            +<Icon name="glassWater" size={16} />
          </button>
          <button
            type="button"
            disabled={add.isPending}
            onClick={() => add.mutate(500)}
            className={cn(
              'pressable inline-flex items-center gap-0.5 rounded-full bg-water-soft px-3 py-2 text-[13px] font-bold text-water',
              add.isPending && 'opacity-50',
            )}
            aria-label={t('water.add_bottle_aria', 'Add a 500 ml bottle of water')}
          >
            +<Icon name="bottle" size={16} />
          </button>
        </div>
      </div>
      {reached && (
        <p className="mt-2 text-[12px] font-semibold text-success">
          {t('water.goal_reached', 'Hydration goal reached. Well done!')}
        </p>
      )}
    </Card>
  );
}
