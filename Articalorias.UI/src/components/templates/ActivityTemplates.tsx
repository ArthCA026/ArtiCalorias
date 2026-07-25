import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { ActionSheet, ConfirmSheet } from '@/components/ui/ActionSheet';
import { QuickAmountSheet } from '@/components/ui/QuantityField';
import { Fab } from '@/components/ui/Fab';
import { useToast } from '@/components/ui/Toast';
import { useDelayedBoolean } from '@/hooks/useDelayedBoolean';
import { activityService } from '@/services/activityService';
import { queryKeys } from '@/lib/queryKeys';
import { toDateString } from '@/utils/format';
import { extractApiError } from '@/utils/apiError';
import type { ActivityTemplateResponse } from '@/types';
import { TemplateRow } from './TemplateRow';
import { ActivityTemplateSheet } from './ActivityTemplateSheet';

/** Activities tab: saved activity templates with one-tap logging to today. */
export function ActivityTemplates() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ActivityTemplateResponse | null>(null);
  const [editing, setEditing] = useState<ActivityTemplateResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ActivityTemplateResponse | null>(null);
  const [durationTarget, setDurationTarget] = useState<ActivityTemplateResponse | null>(null);
  const [usedIn, setUsedIn] = useState<string[]>([]);

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
    onSuccess: ({ date, name }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(date) });
      queryClient.invalidateQueries({ queryKey: queryKeys.historyAll() });
      queryClient.invalidateQueries({ queryKey: queryKeys.streak() });
      toast('success', t('templates.added_to_today', '{{name}} added to today', { name }));
    },
    onError: (err) =>
      toast('error', extractApiError(err, t('templates.save_error', 'Could not save. Check your connection and try again.'))),
  });

  const updateDuration = useMutation({
    mutationFn: ({ tpl, minutes }: { tpl: ActivityTemplateResponse; minutes: number }) =>
      activityService.updateTemplate(tpl.activityTemplateId, {
        templateName: tpl.templateName,
        autoAddToNewDay: tpl.autoAddToNewDay,
        defaultDurationMinutes: minutes,
        defaultMET: tpl.defaultMET,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activityTemplates() });
      queryClient.invalidateQueries({ queryKey: queryKeys.routines() });
      setDurationTarget(null);
      toast('success', t('templates.saved', 'Saved'));
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
              <TemplateRow
                key={tpl.activityTemplateId}
                title={tpl.templateName}
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
                    disabled={
                      quickAdd.isPending &&
                      quickAdd.variables?.activityTemplateId === tpl.activityTemplateId
                    }
                    onClick={() => quickAdd.mutate(tpl)}
                  />
                }
                chip={
                  <button
                    type="button"
                    aria-label={t('templates.duration_chip_aria', 'Change duration')}
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerUp={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDurationTarget(tpl);
                    }}
                    className="pressable inline-flex items-center gap-1 bg-inset rounded-lg px-2 py-1 text-[13px] font-medium text-ink-2"
                  >
                    <span className="truncate">
                      {t('templates.duration_chip', '({{min}} min)', {
                        min: tpl.defaultDurationMinutes ?? 0,
                      })}
                    </span>
                    <Icon name="chevronDown" size={13} className="text-ink-3 shrink-0" />
                  </button>
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

      <QuickAmountSheet
        open={durationTarget !== null}
        onClose={() => setDurationTarget(null)}
        title={t('templates.duration', 'Duration')}
        subtitle={durationTarget?.templateName}
        value={durationTarget?.defaultDurationMinutes ?? 30}
        min={5}
        max={1440}
        step={5}
        suffix={t('templates.min_suffix', 'min')}
        saving={updateDuration.isPending}
        onSave={(next) => durationTarget && updateDuration.mutate({ tpl: durationTarget, minutes: next })}
      />

      {editing && <ActivityTemplateSheet template={editing} onClose={() => setEditing(null)} />}
      {creating && <ActivityTemplateSheet template={null} onClose={() => setCreating(false)} />}

      <Fab label={t('templates.fab_new', 'New')} onClick={() => setCreating(true)} />
    </div>
  );
}
