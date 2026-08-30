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
import type { CreateFoodEntryRequest, DailyLogResponse } from '@/types';

interface AlcoholCardProps {
  date: string;
  log: DailyLogResponse;
}

/**
 * Reference drinks behind the quick-add buttons. Deliberately generic
 * averages: a 330 ml lager and a standard spirits-plus-mixer cocktail.
 * Ethanol at 7 kcal/g plus the drink's carbs lands on the round figures
 * below. Anything unusual belongs in the normal AI log flow.
 */
const BEER = { alcoholGrams: 13, caloriesKcal: 150, carbsGrams: 11, sugarGrams: 0 };
const COCKTAIL = { alcoholGrams: 16, caloriesKcal: 180, carbsGrams: 15, sugarGrams: 14 };

/**
 * Alcohol tracker, shown only on days whose frozen targets include alcohol
 * (which is why the macro is excluded from the hero bars: this card IS its
 * bar). One tap logs a beer or a cocktail as a regular meal entry, editable
 * and deletable like anything else. Alcohol is a LIMIT: the bar flips to the
 * warning color once past it, and with no limit set it just shows the amount.
 * Water is deliberately NOT credited: alcohol does not hydrate.
 */
export function AlcoholCard({ date, log }: AlcoholCardProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const haptics = useHaptics();
  const queryClient = useQueryClient();

  const target = dayTargetFor(log, 'alcohol');
  const totalG = log.totalAlcoholGrams;
  const limitG = target?.target ?? null;
  const over = limitG !== null && totalG > limitG;
  const tracksSugar = dayTargetFor(log, 'sugar') !== undefined;

  const add = useMutation({
    mutationFn: (drink: 'beer' | 'cocktail') => {
      const d = drink === 'beer' ? BEER : COCKTAIL;
      const entry: CreateFoodEntryRequest = {
        foodName:
          drink === 'beer' ? t('alcohol.beer_name', 'Beer') : t('alcohol.cocktail_name', 'Cocktail'),
        portionDescription:
          drink === 'beer'
            ? t('alcohol.beer_portion', '330 ml')
            : t('alcohol.cocktail_portion', '1 drink'),
        quantity: 1,
        caloriesKcal: d.caloriesKcal,
        proteinGrams: 0,
        fatGrams: 0,
        carbsGrams: d.carbsGrams,
        alcoholGrams: d.alcoholGrams,
        // Sugar only when the day tracks it (null = honestly "not captured").
        sugarGrams: tracksSugar ? d.sugarGrams : null,
        waterMl: null,
      };
      return foodService.create(date, entry);
    },
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
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-alcohol-soft text-alcohol">
          <Icon name="wine" size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-semibold text-ink-2">
              {t('macros.alcohol_full', 'Alcohol')}
            </span>
            <span
              className={cn(
                'text-[13px] font-bold tabular-nums',
                over ? 'text-warning' : 'text-ink',
              )}
            >
              {Math.round(totalG)}
              {limitG !== null && (
                <span className="text-ink-3 font-medium"> / {Math.round(limitG)}</span>
              )}{' '}
              g
            </span>
          </div>
          <div className="mt-1.5">
            {limitG !== null ? (
              <ProgressBar
                progress={limitG > 0 ? totalG / limitG : 0}
                height={6}
                color={over ? 'var(--t-warning)' : 'var(--t-alcohol)'}
                label={t('alcohol.bar_aria', 'Alcohol vs your limit')}
              />
            ) : (
              <div
                className="h-1.5 rounded-full"
                style={{ background: 'var(--t-ring-track)' }}
                aria-hidden="true"
              />
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            disabled={add.isPending}
            onClick={() => add.mutate('beer')}
            className={cn(
              'pressable inline-flex items-center gap-0.5 rounded-full bg-alcohol-soft px-3 py-2 text-[13px] font-bold text-alcohol',
              add.isPending && 'opacity-50',
            )}
            aria-label={t('alcohol.add_beer_aria', 'Add a 330 ml beer')}
          >
            +<Icon name="beer" size={16} />
          </button>
          <button
            type="button"
            disabled={add.isPending}
            onClick={() => add.mutate('cocktail')}
            className={cn(
              'pressable inline-flex items-center gap-0.5 rounded-full bg-alcohol-soft px-3 py-2 text-[13px] font-bold text-alcohol',
              add.isPending && 'opacity-50',
            )}
            aria-label={t('alcohol.add_cocktail_aria', 'Add a cocktail')}
          >
            +<Icon name="martini" size={16} />
          </button>
        </div>
      </div>
      {over && (
        <p className="mt-2 text-[12px] font-semibold text-warning">
          {t('alcohol.over_limit', 'Past your limit for this day.')}
        </p>
      )}
    </Card>
  );
}
