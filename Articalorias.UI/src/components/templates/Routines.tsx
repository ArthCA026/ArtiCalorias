import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { ActionSheet, ConfirmSheet } from '@/components/ui/ActionSheet';
import { Fab } from '@/components/ui/Fab';
import { useToast } from '@/components/ui/Toast';
import { useDelayedBoolean } from '@/hooks/useDelayedBoolean';
import { foodTemplateService } from '@/services/foodTemplateService';
import { queryKeys } from '@/lib/queryKeys';
import { fmt, toDateString } from '@/utils/format';
import { extractApiError } from '@/utils/apiError';
import type { FavoriteRoutineResponse } from '@/types';
import { TemplateRow } from './TemplateRow';
import { RoutineSheet } from './RoutineSheet';

const routineKcal = (routine: FavoriteRoutineResponse): number =>
  routine.items.reduce(
    (sum, item) =>
      item.itemType === 'food' && item.foodTemplate
        ? sum + item.foodTemplate.caloriesKcal * item.foodTemplate.defaultQuantity
        : sum,
    0,
  );

/** Routines tab: bundles of templates added to today in one tap. */
export function Routines() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState<FavoriteRoutineResponse | null>(null);
  const [editing, setEditing] = useState<FavoriteRoutineResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FavoriteRoutineResponse | null>(null);

  const query = useQuery({
    queryKey: queryKeys.routines(),
    queryFn: () => foodTemplateService.getRoutines().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const showSkeleton = useDelayedBoolean(query.isLoading, 300);

  const addAll = useMutation({
    mutationFn: (routine: FavoriteRoutineResponse) =>
      foodTemplateService.addRoutineToToday(routine.favoriteRoutineId).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(toDateString()) });
      queryClient.invalidateQueries({ queryKey: queryKeys.historyAll() });
      queryClient.invalidateQueries({ queryKey: queryKeys.streak() });
      toast('success', t('templates.routine_added', '{{n}} items added', { n: data.addedCount }));
      if (data.skippedItems.length > 0) {
        toast(
          'info',
          t('templates.routine_skipped', '{{k}} skipped (template deleted)', {
            k: data.skippedItems.length,
          }),
        );
      }
    },
    onError: (err) =>
      toast('error', extractApiError(err, t('templates.save_error', 'Could not save. Check your connection and try again.'))),
  });

  const del = useMutation({
    mutationFn: (routine: FavoriteRoutineResponse) =>
      foodTemplateService.removeRoutine(routine.favoriteRoutineId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routines() });
      setDeleteTarget(null);
      toast('success', t('templates.deleted', 'Deleted'));
    },
    onError: (err) =>
      toast('error', extractApiError(err, t('templates.save_error', 'Could not save. Check your connection and try again.'))),
  });

  const routines = query.data ?? [];

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

      {query.data && routines.length === 0 && (
        <EmptyState
          icon="repeat"
          title={t('templates.no_routines_title', 'No routines yet')}
          body={t(
            'templates.no_routines_body',
            'Bundle a whole morning: coffee, eggs, a walk. Add everything to a day with one tap.',
          )}
          actionLabel={t('templates.create_one', 'Create one')}
          onAction={() => setCreating(true)}
        />
      )}

      {routines.length > 0 && (
        <Card padded={false} className="overflow-hidden">
          <div className="divide-y divide-hairline/50">
            {routines.map((routine) => (
              <TemplateRow
                key={routine.favoriteRoutineId}
                title={routine.routineName}
                subtitle={t('templates.routine_meta', '{{n}} items, ~{{kcal}} kcal', {
                  n: routine.items.length,
                  kcal: fmt(routineKcal(routine)),
                })}
                ariaLabel={t('templates.row_aria', '{{name}}, open options', { name: routine.routineName })}
                onOpen={() => setSelected(routine)}
                trailing={
                  <Button
                    variant="primary"
                    size="sm"
                    loading={
                      addAll.isPending &&
                      addAll.variables?.favoriteRoutineId === routine.favoriteRoutineId
                    }
                    onClick={() => addAll.mutate(routine)}
                  >
                    {t('templates.add_all', 'Add all to today')}
                  </Button>
                }
              />
            ))}
          </div>
        </Card>
      )}

      <ActionSheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.routineName}
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
            onSelect: () => selected && setDeleteTarget(selected),
          },
        ]}
      />

      <ConfirmSheet
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t('templates.delete_routine_title', 'Delete routine?')}
        body={t('templates.delete_routine_body', 'This deletes the routine. The templates inside it are kept.')}
        confirmLabel={t('common.delete', 'Delete')}
        cancelLabel={t('common.cancel', 'Cancel')}
        loading={del.isPending}
        onConfirm={() => deleteTarget && del.mutate(deleteTarget)}
      />

      {editing && <RoutineSheet routine={editing} onClose={() => setEditing(null)} />}
      {creating && <RoutineSheet routine={null} onClose={() => setCreating(false)} />}

      <Fab label={t('templates.fab_new', 'New')} onClick={() => setCreating(true)} />
    </div>
  );
}
