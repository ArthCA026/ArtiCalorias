import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { ConfirmSheet } from '@/components/ui/ActionSheet';
import { ItemRow, ItemMeta } from '@/components/ui/ItemRow';
import { SelectionBar, type SelectionAction } from '@/components/ui/SelectionBar';
import { Fab } from '@/components/ui/Fab';
import { useToast } from '@/components/ui/Toast';
import { useDelayedBoolean } from '@/hooks/useDelayedBoolean';
import { activityService } from '@/services/activityService';
import { dailyLogService } from '@/services/dailyLogService';
import { queryKeys, invalidateDayData } from '@/lib/queryKeys';
import { qtyStr, toDateString } from '@/utils/format';
import { extractApiError } from '@/utils/apiError';
import type { ActivityTemplateResponse } from '@/types';
import { ActivityTemplateSheet } from './ActivityTemplateSheet';

/**
 * Activities tab: saved activity templates. One tap opens the editor, the +
 * logs it to today, holding a row starts multi-select — the same gesture
 * language as the Today lists.
 */
export function ActivityTemplates() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ActivityTemplateResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ActivityTemplateResponse | null>(null);
  const [usedIn, setUsedIn] = useState<string[]>([]);
  const [selectIds, setSelectIds] = useState<Set<number> | null>(null);
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);

  const query = useQuery({
    queryKey: queryKeys.activityTemplates(),
    queryFn: () => activityService.getTemplates().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const showSkeleton = useDelayedBoolean(query.isLoading, 300);

  const total = query.data?.length ?? 0;
  const items = useMemo(() => {
    const list = query.data ?? [];
    const q = search.trim().toLowerCase();
    return q ? list.filter((x) => x.templateName.toLowerCase().includes(q)) : list;
  }, [query.data, search]);

  // Stale ids (templates deleted elsewhere) are inert: everything below
  // derives from the LIVE list, so they simply stop matching anything.
  const selecting = selectIds !== null;
  const selectedTemplates = (query.data ?? []).filter((x) => selectIds?.has(x.activityTemplateId));
  const toggleSelect = (id: number) =>
    setSelectIds((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const quickAdd = useMutation({
    mutationFn: (tpl: ActivityTemplateResponse) => {
      const date = toDateString();
      return activityService
        .create(date, {
          activityTemplateId: tpl.activityTemplateId,
          activityName: tpl.templateName,
          durationMinutes: tpl.defaultDurationMinutes,
          metValue: tpl.defaultMET,
        })
        .then(() => ({ date, name: tpl.templateName }));
    },
    onSuccess: ({ name }) => {
      invalidateDayData(queryClient);
      toast('success', t('templates.added_to_today', '{{name}} added to today', { name }));
    },
    onError: (err) =>
      toast('error', extractApiError(err, t('templates.save_error', 'Could not save. Check your connection and try again.'))),
  });

  const del = useMutation({
    mutationFn: (tpl: ActivityTemplateResponse) =>
      activityService.removeTemplate(tpl.activityTemplateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activityTemplates() });
      queryClient.invalidateQueries({ queryKey: queryKeys.routines() });
      setDeleteTarget(null);
      toast('success', t('templates.deleted', 'Deleted'));
    },
    onError: (err) =>
      toast('error', extractApiError(err, t('templates.save_error', 'Could not save. Check your connection and try again.'))),
  });

  const openDelete = (tpl: ActivityTemplateResponse) => {
    setUsedIn([]);
    setDeleteTarget(tpl);
    activityService
      .getRoutinesForActivityTemplate(tpl.activityTemplateId)
      .then((r) => setUsedIn(r.data))
      .catch(() => setUsedIn([]));
  };

  // Bulk add: one batch call, one recalculation.
  const bulkAdd = useMutation({
    mutationFn: (tpls: ActivityTemplateResponse[]) =>
      dailyLogService.confirmParsedActivities(toDateString(), {
        items: tpls.map((tpl) => ({
          activityTemplateId: tpl.activityTemplateId,
          activityName: tpl.templateName,
          durationMinutes: tpl.defaultDurationMinutes,
          metValue: tpl.defaultMET,
        })),
      }),
    onSuccess: (_res, tpls) => {
      invalidateDayData(queryClient);
      setSelectIds(null);
      toast('success', t('select.added_to_today', 'Added to today ({{n}})', { n: tpls.length }));
    },
    onError: (err) =>
      toast('error', extractApiError(err, t('templates.save_error', 'Could not save. Check your connection and try again.'))),
  });

  const bulkDelete = useMutation({
    mutationFn: async (tpls: ActivityTemplateResponse[]) => {
      // Sequential: each delete also detaches the template from any routines.
      for (const tpl of tpls) await activityService.removeTemplate(tpl.activityTemplateId);
      return tpls.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activityTemplates() });
      queryClient.invalidateQueries({ queryKey: queryKeys.routines() });
      setConfirmingBulkDelete(false);
      setSelectIds(null);
      toast('success', t('templates.deleted', 'Deleted'));
    },
    onError: (err) => {
      // Some may have been deleted before the failure: refresh to show reality.
      queryClient.invalidateQueries({ queryKey: queryKeys.activityTemplates() });
      queryClient.invalidateQueries({ queryKey: queryKeys.routines() });
      setConfirmingBulkDelete(false);
      toast('error', extractApiError(err, t('templates.save_error', 'Could not save. Check your connection and try again.')));
    },
  });

  const selectionActions: SelectionAction[] = [
    {
      icon: 'plus',
      label: t('select.action_add_today', 'To today'),
      onSelect: () => bulkAdd.mutate(selectedTemplates),
    },
    {
      icon: 'trash',
      label: t('common.delete', 'Delete'),
      destructive: true,
      onSelect: () => setConfirmingBulkDelete(true),
    },
  ];

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
          icon="activity"
          title={t('templates.no_activities_title', 'No activity templates yet')}
          body={t(
            'templates.no_activities_body',
            'Save activities you do often and log them in two taps. You can also save any logged activity as a template from Today.',
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
              <ItemRow
                key={tpl.activityTemplateId}
                title={tpl.templateName}
                ariaLabel={
                  selecting
                    ? t('select.entry_aria', '{{name}}, toggle selection', { name: tpl.templateName })
                    : t('templates.row_tap_aria', '{{name}}, tap to edit, hold to select', { name: tpl.templateName })
                }
                autoBadge={tpl.autoAddToNewDay}
                selectMode={selecting}
                selected={selectIds?.has(tpl.activityTemplateId) ?? false}
                onTap={() => (selecting ? toggleSelect(tpl.activityTemplateId) : setEditing(tpl))}
                onLongPress={() =>
                  selecting
                    ? toggleSelect(tpl.activityTemplateId)
                    : setSelectIds(new Set([tpl.activityTemplateId]))
                }
                trailing={
                  <IconButton
                    icon="plus"
                    label={t('templates.add_to_today', 'Add to today')}
                    size={36}
                    iconSize={18}
                    variant="primary"
                    className="disabled:opacity-50 disabled:pointer-events-none"
                    disabled={
                      quickAdd.isPending &&
                      quickAdd.variables?.activityTemplateId === tpl.activityTemplateId
                    }
                    onClick={() => quickAdd.mutate(tpl)}
                  />
                }
                meta={
                  <ItemMeta>
                    {t('templates.duration_meta', '{{min}} min', {
                      min: qtyStr(tpl.defaultDurationMinutes ?? 0),
                    })}
                  </ItemMeta>
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

      {query.data && total > 0 && !selecting && (
        <p className="px-1 text-[12px] text-ink-3">
          {t('select.hint_templates', 'Tap to edit, + to log it. Hold to select several.')}
        </p>
      )}

      {selecting && (
        <SelectionBar
          count={selectedTemplates.length}
          actions={selectionActions}
          onClear={() => setSelectIds(null)}
          busy={bulkAdd.isPending || bulkDelete.isPending}
        />
      )}

      <ConfirmSheet
        open={confirmingBulkDelete}
        onClose={() => setConfirmingBulkDelete(false)}
        title={t('select.delete_templates_title', 'Delete {{n}} templates?', { n: selectedTemplates.length })}
        body={t('select.delete_templates_body', 'They also disappear from any routine that uses them. Entries already logged stay as they are.')}
        confirmLabel={t('common.delete', 'Delete')}
        cancelLabel={t('common.cancel', 'Cancel')}
        loading={bulkDelete.isPending}
        onConfirm={() => bulkDelete.mutate(selectedTemplates)}
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

      {editing && (
        <ActivityTemplateSheet
          template={editing}
          onClose={() => setEditing(null)}
          onDelete={() => {
            const target = editing;
            setEditing(null);
            openDelete(target);
          }}
        />
      )}
      {creating && <ActivityTemplateSheet template={null} onClose={() => setCreating(false)} />}

      <Fab label={t('templates.fab_new', 'New')} onClick={() => setCreating(true)} />
    </div>
  );
}
