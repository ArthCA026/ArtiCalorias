import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { InlineError } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useDelayedBoolean } from '@/hooks/useDelayedBoolean';
import { foodTemplateService } from '@/services/foodTemplateService';
import { activityService } from '@/services/activityService';
import { queryKeys } from '@/lib/queryKeys';
import { fmt } from '@/utils/format';
import { extractApiError } from '@/utils/apiError';
import { cn } from '@/utils/cn';
import type { FavoriteRoutineResponse } from '@/types';

const MAX_ITEMS = 20;

type RoutineItemType = 'food' | 'activity';

interface SelectedItem {
  itemType: RoutineItemType;
  id: number;
}

interface RoutineSheetProps {
  /** null = create mode */
  routine: FavoriteRoutineResponse | null;
  onClose: () => void;
}

/** Create or edit a routine: name it, then tap templates in the order they should be added. */
export function RoutineSheet({ routine, onClose }: RoutineSheetProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState(routine?.routineName ?? '');
  const [selection, setSelection] = useState<SelectedItem[]>(() => {
    if (!routine) return [];
    return [...routine.items]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .flatMap((item): SelectedItem[] => {
        if (item.itemType === 'food' && item.foodTemplate) {
          return [{ itemType: 'food', id: item.foodTemplate.foodTemplateId }];
        }
        if (item.itemType === 'activity' && item.activityTemplate) {
          return [{ itemType: 'activity', id: item.activityTemplate.activityTemplateId }];
        }
        return [];
      });
  });
  const [error, setError] = useState<string | null>(null);

  const foodQuery = useQuery({
    queryKey: queryKeys.foodTemplates(),
    queryFn: () => foodTemplateService.getAll().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const activityQuery = useQuery({
    queryKey: queryKeys.activityTemplates(),
    queryFn: () => activityService.getTemplates().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const showSkeleton = useDelayedBoolean(foodQuery.isLoading || activityQuery.isLoading, 300);

  const orderOf = (itemType: RoutineItemType, id: number): number =>
    selection.findIndex((s) => s.itemType === itemType && s.id === id);

  const toggle = (itemType: RoutineItemType, id: number) => {
    setSelection((prev) => {
      const exists = prev.some((s) => s.itemType === itemType && s.id === id);
      if (exists) return prev.filter((s) => !(s.itemType === itemType && s.id === id));
      if (prev.length >= MAX_ITEMS) return prev;
      return [...prev, { itemType, id }];
    });
  };

  const save = useMutation({
    mutationFn: () => {
      const data = {
        routineName: name.trim(),
        items: selection.map((s, i) => ({
          itemType: s.itemType,
          foodTemplateId: s.itemType === 'food' ? s.id : null,
          activityTemplateId: s.itemType === 'activity' ? s.id : null,
          sortOrder: i,
        })),
      };
      return routine
        ? foodTemplateService.updateRoutine(routine.favoriteRoutineId, data)
        : foodTemplateService.createRoutine(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routines() });
      toast('success', t('templates.saved', 'Saved'));
      onClose();
    },
    onError: (err) =>
      setError(
        extractApiError(err, t('templates.save_error', 'Could not save. Check your connection and try again.')),
      ),
  });

  const foods = foodQuery.data ?? [];
  const activities = activityQuery.data ?? [];
  const nothingToPick =
    !foodQuery.isLoading && !activityQuery.isLoading && foods.length === 0 && activities.length === 0;
  const atMax = selection.length >= MAX_ITEMS;

  const renderPickRow = (
    key: string,
    itemType: RoutineItemType,
    id: number,
    title: string,
    meta: string,
  ) => {
    const order = orderOf(itemType, id);
    const selected = order !== -1;
    return (
      <button
        key={key}
        type="button"
        aria-pressed={selected}
        disabled={!selected && atMax}
        onClick={() => toggle(itemType, id)}
        className={cn(
          'pressable w-full flex items-center gap-3 px-4 h-12 text-left active:bg-press',
          'disabled:opacity-50',
        )}
      >
        <span className="flex-1 min-w-0 text-[15px] font-semibold text-ink truncate">{title}</span>
        <span className="shrink-0 text-[13px] text-ink-2">{meta}</span>
        {selected ? (
          <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-on-primary text-xs font-bold flex items-center justify-center tabular-nums">
            {order + 1}
          </span>
        ) : (
          <span className="shrink-0 w-6 h-6 rounded-full border-2 border-hairline" />
        )}
      </button>
    );
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={routine ? t('templates.edit_routine', 'Edit routine') : t('templates.new_routine', 'New routine')}
    >
      <div className="space-y-3.5">
        <Field
          label={t('templates.routine_name', 'Routine name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />

        <div>
          <p className="text-[13px] font-semibold text-ink-2">{t('templates.routine_items', 'Items')}</p>
          <p className="text-[13px] text-ink-3 mb-1.5">
            {t('templates.routine_items_hint', 'Tap to include, in the order you want them.')}
          </p>

          {showSkeleton && (
            <div className="space-y-2" aria-busy="true">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}

          {nothingToPick && (
            <p className="text-sm text-ink-2 py-2">
              {t(
                'templates.routine_no_templates',
                'Create meal or activity templates first, then bundle them here.',
              )}
            </p>
          )}

          {foods.length > 0 && (
            <div className="mb-3">
              <p className="text-[13px] font-semibold text-ink-3 mb-1.5">
                {t('templates.tab_meals', 'Meals')}
              </p>
              <div className="rounded-card bg-inset overflow-hidden divide-y divide-hairline/60">
                {foods.map((tpl) =>
                  renderPickRow(
                    `food-${tpl.foodTemplateId}`,
                    'food',
                    tpl.foodTemplateId,
                    tpl.templateName,
                    `${fmt(tpl.caloriesKcal * tpl.defaultQuantity)} kcal`,
                  ),
                )}
              </div>
            </div>
          )}

          {activities.length > 0 && (
            <div>
              <p className="text-[13px] font-semibold text-ink-3 mb-1.5">
                {t('templates.tab_activities', 'Activities')}
              </p>
              <div className="rounded-card bg-inset overflow-hidden divide-y divide-hairline/60">
                {activities.map((tpl) =>
                  renderPickRow(
                    `activity-${tpl.activityTemplateId}`,
                    'activity',
                    tpl.activityTemplateId,
                    tpl.templateName,
                    t('templates.minutes_short', '{{v}} min', { v: fmt(tpl.defaultDurationMinutes ?? 0) }),
                  ),
                )}
              </div>
            </div>
          )}

          {atMax && (
            <p className="text-[13px] text-ink-3 mt-1.5">
              {t('templates.max_items', 'Up to 20 items per routine')}
            </p>
          )}
        </div>

        {error && <InlineError message={error} />}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={save.isPending}
          disabled={name.trim().length === 0 || selection.length === 0}
          onClick={() => save.mutate()}
        >
          {t('common.save', 'Save')}
        </Button>
      </div>
    </Sheet>
  );
}
