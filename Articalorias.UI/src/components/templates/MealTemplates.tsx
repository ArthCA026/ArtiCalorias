import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { ActionSheet, ConfirmSheet } from '@/components/ui/ActionSheet';
import { useToast } from '@/components/ui/Toast';
import { useDelayedBoolean } from '@/hooks/useDelayedBoolean';
import { foodTemplateService } from '@/services/foodTemplateService';
import { foodService } from '@/services/foodService';
import { queryKeys } from '@/lib/queryKeys';
import { fmt, toDateString } from '@/utils/format';
import { extractApiError } from '@/utils/apiError';
import type { FoodTemplateResponse } from '@/types';
import { TemplateRow } from './TemplateRow';
import { MealTemplateSheet } from './MealTemplateSheet';

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Meals tab: saved meal templates with one-tap logging to today. */
export function MealTemplates() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<FoodTemplateResponse | null>(null);
  const [editing, setEditing] = useState<FoodTemplateResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FoodTemplateResponse | null>(null);
  const [usedIn, setUsedIn] = useState<string[]>([]);

  const query = useQuery({
    queryKey: queryKeys.foodTemplates(),
    queryFn: () => foodTemplateService.getAll().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const showSkeleton = useDelayedBoolean(query.isLoading, 300);

  const total = query.data?.length ?? 0;
  const items = useMemo(() => {
    const list = query.data ?? [];
    const q = search.trim().toLowerCase();
    return q ? list.filter((x) => x.templateName.toLowerCase().includes(q)) : list;
  }, [query.data, search]);

  const quickAdd = useMutation({
    mutationFn: (tpl: FoodTemplateResponse) => {
      const date = toDateString();
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
        .then(() => ({ date, name: tpl.templateName }));
    },
    onSuccess: ({ date, name }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(date) });
      queryClient.invalidateQueries({ queryKey: queryKeys.historyAll() });
      queryClient.invalidateQueries({ queryKey: queryKeys.streak() });
      toast('success', t('templates.added_to_today', '{{name}} added to today', { name }));
    },
    onError: (err) =>
      toast('error', extractApiError(err, t('templates.save_error', 'Could not save. Check your connection and try again.'))),
  });

  const del = useMutation({
    mutationFn: (tpl: FoodTemplateResponse) => foodTemplateService.remove(tpl.foodTemplateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.foodTemplates() });
      queryClient.invalidateQueries({ queryKey: queryKeys.routines() });
      setDeleteTarget(null);
      toast('success', t('templates.deleted', 'Deleted'));
    },
    onError: (err) =>
      toast('error', extractApiError(err, t('templates.save_error', 'Could not save. Check your connection and try again.'))),
  });

  const openDelete = (tpl: FoodTemplateResponse) => {
    setUsedIn([]);
    setDeleteTarget(tpl);
    foodTemplateService
      .getRoutinesForFoodTemplate(tpl.foodTemplateId)
      .then((r) => setUsedIn(r.data))
      .catch(() => setUsedIn([]));
  };

  return (
    <div className="space-y-3">
      {showSkeleton && (
        <div className="space-y-2.5" aria-busy="true">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {query.isError && (
        <ErrorState
          title={t('templates.load_error_title', 'Could not load templates')}
          body={t('templates.load_error_body', 'Check your internet connection and try again.')}
          retryLabel={t('common.retry', 'Retry')}
          onRetry={() => query.refetch()}
        />
      )}

      {query.data && total === 0 && (
        <EmptyState
          icon="bookmark"
          title={t('templates.no_meals_title', 'No meal templates yet')}
          body={t(
            'templates.no_meals_body',
            'Save meals you eat often and log them in two taps. You can also save any logged meal as a template from Today.',
          )}
          actionLabel={t('templates.create_one', 'Create one')}
          onAction={() => setCreating(true)}
        />
      )}

      {query.data && total > 6 && (
        <Field
          type="search"
          inputMode="search"
          placeholder={t('common.search', 'Search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t('common.search', 'Search')}
        />
      )}

      {query.data && total > 0 && (
        <Card padded={false} className="overflow-hidden">
          <div className="divide-y divide-hairline/50">
            {items.map((tpl) => (
              <TemplateRow
                key={tpl.foodTemplateId}
                title={tpl.templateName}
                subtitle={t('templates.meal_meta', '{{qty}} x {{portion}}, {{kcal}} kcal', {
                  qty: tpl.defaultQuantity,
                  portion: tpl.portionDescription,
                  kcal: fmt(tpl.caloriesKcal * tpl.defaultQuantity),
                })}
                ariaLabel={t('templates.row_aria', '{{name}}, open options', { name: tpl.templateName })}
                autoBadge={tpl.autoAddToNewDay}
                onOpen={() => setSelected(tpl)}
                trailing={
                  <IconButton
                    icon="plus"
                    label={t('templates.add_to_today', 'Add to today')}
                    size={36}
                    iconSize={18}
                    variant="primary"
                    className="disabled:opacity-50 disabled:pointer-events-none"
                    disabled={quickAdd.isPending && quickAdd.variables?.foodTemplateId === tpl.foodTemplateId}
                    onClick={() => quickAdd.mutate(tpl)}
                  />
                }
              />
            ))}
          </div>
          {items.length === 0 && (
            <p className="text-sm text-ink-2 text-center py-4">
              {t('templates.no_results', 'Nothing matches your search')}
            </p>
          )}
        </Card>
      )}

      {query.data && total > 0 && (
        <Button variant="secondary" icon="plus" fullWidth onClick={() => setCreating(true)}>
          {t('templates.new_meal', 'New meal template')}
        </Button>
      )}

      <ActionSheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.templateName}
        actions={[
          {
            icon: 'pencil',
            label: t('common.edit', 'Edit'),
            onSelect: () => setEditing(selected),
          },
          {
            icon: 'trash',
            label: t('common.delete', 'Delete'),
            destructive: true,
            onSelect: () => selected && openDelete(selected),
          },
        ]}
      />

      <ConfirmSheet
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t('templates.delete_template_title', 'Delete template?')}
        body={
          t('templates.delete_template_body', 'This deletes the template. Entries already logged stay as they are.') +
          (usedIn.length > 0
            ? ' ' + t('templates.delete_used_in', 'Also removes it from: {{names}}', { names: usedIn.join(', ') })
            : '')
        }
        confirmLabel={t('common.delete', 'Delete')}
        cancelLabel={t('common.cancel', 'Cancel')}
        loading={del.isPending}
        onConfirm={() => deleteTarget && del.mutate(deleteTarget)}
      />

      {editing && <MealTemplateSheet template={editing} onClose={() => setEditing(null)} />}
      {creating && <MealTemplateSheet template={null} onClose={() => setCreating(false)} />}
    </div>
  );
}
