import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/States';
import { Skeleton } from '@/components/ui/Skeleton';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { foodTemplateService } from '@/services/foodTemplateService';
import { activityService } from '@/services/activityService';
import { foodService } from '@/services/foodService';
import { queryKeys } from '@/lib/queryKeys';
import { fmt, round1, qtyStr } from '@/utils/format';
import { extractApiError } from '@/utils/apiError';
import type { ActivityTemplateResponse, FoodTemplateResponse } from '@/types';
import type { LogTab } from './LogSheetContext';

interface TemplateQuickPickProps {
  tab: LogTab;
  /** yyyy-MM-dd day the entries are logged to */
  date: string;
  onBack: () => void;
  onAdded: (date: string) => void;
}

/**
 * One-tap logging from saved templates. Stays open so several
 * items can be added in a row.
 */
export function TemplateQuickPick({ tab, date: targetDate, onBack, onAdded }: TemplateQuickPickProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [lastAddedId, setLastAddedId] = useState<number | null>(null);

  const foodQuery = useQuery({
    queryKey: queryKeys.foodTemplates(),
    queryFn: () => foodTemplateService.getAll().then((r) => r.data),
    staleTime: 10 * 60 * 1000,
    enabled: tab === 'meal',
  });
  const activityQuery = useQuery({
    queryKey: queryKeys.activityTemplates(),
    queryFn: () => activityService.getTemplates().then((r) => r.data),
    staleTime: 10 * 60 * 1000,
    enabled: tab === 'activity',
  });

  const addFood = useMutation({
    mutationFn: (tpl: FoodTemplateResponse) => {
      const date = targetDate;
      return foodService
        .create(date, {
          foodName: tpl.templateName,
          portionDescription: tpl.portionDescription,
          quantity: tpl.defaultQuantity,
          caloriesKcal: round1(tpl.caloriesKcal * tpl.defaultQuantity),
          proteinGrams: round1(tpl.proteinGrams * tpl.defaultQuantity),
          fatGrams: round1(tpl.fatGrams * tpl.defaultQuantity),
          carbsGrams: round1(tpl.carbsGrams * tpl.defaultQuantity),
          alcoholGrams: round1(tpl.alcoholGrams * tpl.defaultQuantity),
          foodTemplateId: tpl.foodTemplateId,
        })
        .then(() => ({ date, name: tpl.templateName, id: tpl.foodTemplateId }));
    },
    onSuccess: ({ date, name, id }) => {
      setLastAddedId(id);
      onAdded(date);
      toast('success', t('log.added_name', '{{name}} added', { name }));
    },
    onError: (err) =>
      toast('error', extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.'))),
  });

  const addActivity = useMutation({
    mutationFn: (tpl: ActivityTemplateResponse) => {
      const date = targetDate;
      return activityService
        .create(date, {
          activityTemplateId: tpl.activityTemplateId,
          activityName: tpl.templateName,
          durationMinutes: tpl.defaultDurationMinutes,
          metValue: tpl.defaultMET,
        })
        .then(() => ({ date, name: tpl.templateName, id: tpl.activityTemplateId }));
    },
    onSuccess: ({ date, name, id }) => {
      setLastAddedId(id);
      onAdded(date);
      toast('success', t('log.added_name', '{{name}} added', { name }));
    },
    onError: (err) =>
      toast('error', extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.'))),
  });

  const isLoading = tab === 'meal' ? foodQuery.isLoading : activityQuery.isLoading;
  const isError = tab === 'meal' ? foodQuery.isError : activityQuery.isError;

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (tab === 'meal') {
      const list = foodQuery.data ?? [];
      return q ? list.filter((x) => x.templateName.toLowerCase().includes(q)) : list;
    }
    const list = activityQuery.data ?? [];
    return q ? list.filter((x) => x.templateName.toLowerCase().includes(q)) : list;
  }, [tab, search, foodQuery.data, activityQuery.data]);

  const total = tab === 'meal' ? (foodQuery.data?.length ?? 0) : (activityQuery.data?.length ?? 0);

  return (
    <div className="space-y-3">
      {isLoading && (
        <div className="space-y-2.5" aria-busy="true">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}

      {isError && (
        <EmptyState
          icon="alertTriangle"
          title={t('log.templates_error_title', 'Could not load templates')}
          body={t('log.templates_error_body', 'Check your connection, then pull to retry or go back and type your entry instead.')}
          actionLabel={t('common.retry', 'Retry')}
          onAction={() => (tab === 'meal' ? foodQuery.refetch() : activityQuery.refetch())}
        />
      )}

      {!isLoading && !isError && total === 0 && (
        <EmptyState
          icon="bookmark"
          title={t('log.no_templates_title', 'No templates yet')}
          body={
            tab === 'meal'
              ? t('log.no_templates_body_meal', 'Save meals you eat often in the Templates tab and log them here in two taps.')
              : t('log.no_templates_body_activity', 'Save activities you do often in the Templates tab and log them here in two taps.')
          }
        />
      )}

      {!isLoading && !isError && total > 6 && (
        <Field
          type="search"
          inputMode="search"
          placeholder={t('common.search', 'Search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t('common.search', 'Search')}
        />
      )}

      {!isLoading && !isError && total > 0 && (
        <div className="space-y-2">
          {items.map((tpl) => {
            const isFood = tab === 'meal';
            const id = isFood
              ? (tpl as FoodTemplateResponse).foodTemplateId
              : (tpl as ActivityTemplateResponse).activityTemplateId;
            // Same amount language as the Templates screen: "2 · 1 cup · 320 kcal"
            const meta = isFood
              ? [
                  t('templates.amount_meta', '{{qty}} · {{portion}}', {
                    qty: qtyStr((tpl as FoodTemplateResponse).defaultQuantity),
                    portion: (tpl as FoodTemplateResponse).portionDescription,
                  }),
                  t('templates.kcal_value', '{{kcal}} kcal', {
                    kcal: fmt(
                      (tpl as FoodTemplateResponse).caloriesKcal *
                        (tpl as FoodTemplateResponse).defaultQuantity,
                    ),
                  }),
                ].join(' · ')
              : [
                  t('templates.duration_meta', '{{min}} min', {
                    min: qtyStr((tpl as ActivityTemplateResponse).defaultDurationMinutes ?? 0),
                  }),
                  t('log.met_value', 'MET {{met}}', {
                    met: (tpl as ActivityTemplateResponse).defaultMET ?? 0,
                  }),
                ].join(' · ');
            const pending =
              (isFood && addFood.isPending && addFood.variables?.foodTemplateId === id) ||
              (!isFood && addActivity.isPending && addActivity.variables?.activityTemplateId === id);
            return (
              <button
                key={id}
                type="button"
                disabled={pending}
                onClick={() =>
                  isFood
                    ? addFood.mutate(tpl as FoodTemplateResponse)
                    : addActivity.mutate(tpl as ActivityTemplateResponse)
                }
                className="pressable w-full flex items-center gap-3 rounded-card bg-inset active:bg-press px-4 py-3 text-left"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-bold text-ink truncate">{tpl.templateName}</span>
                  <span className="block text-[13px] text-ink-2 mt-0.5">{meta}</span>
                </span>
                {lastAddedId === id ? (
                  <span className="text-success animate-pop">
                    <Icon name="checkCircle" size={22} />
                  </span>
                ) : (
                  <span className="w-8 h-8 rounded-full bg-primary-soft text-primary-soft-ink flex items-center justify-center">
                    <Icon name="plus" size={17} />
                  </span>
                )}
              </button>
            );
          })}
          {items.length === 0 && (
            <p className="text-sm text-ink-2 text-center py-4">
              {t('common.no_results', 'Nothing matches your search')}
            </p>
          )}
        </div>
      )}

      <Button variant="ghost" size="md" fullWidth onClick={onBack}>
        {t('common.back', 'Back')}
      </Button>
    </div>
  );
}
