import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { DayView } from '@/components/day/DayView';
import { IconButton } from '@/components/ui/Button';
import { ConfirmSheet } from '@/components/ui/ActionSheet';
import { useToast } from '@/components/ui/Toast';
import { dailyLogService } from '@/services/dailyLogService';
import { queryKeys } from '@/lib/queryKeys';
import { toDateString, parseDate } from '@/utils/format';
import { extractApiError } from '@/utils/apiError';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A past day, fully editable with the same UI as Today.
 * Reached from Progress; future dates are refused.
 */
export default function DayPage() {
  const { t, i18n } = useTranslation();
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const today = toDateString();
  const valid =
    !!date && DATE_RE.test(date) && !Number.isNaN(parseDate(date).getTime());

  const dateLabel = useMemo(() => {
    if (!valid || !date) return '';
    return new Intl.DateTimeFormat(i18n.language, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(parseDate(date));
  }, [valid, date, i18n.language]);

  const deleteDay = useMutation({
    mutationFn: () => dailyLogService.deleteDay(date!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.historyAll() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(date!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.streak() });
      toast('success', t('day.deleted', 'Day deleted'));
      navigate('/progress', { replace: true });
    },
    onError: (err) =>
      toast('error', extractApiError(err, t('day.delete_error', 'Could not delete the day. Try again.'))),
  });

  // No future days, no malformed dates; today lives on its own tab
  if (!valid || !date || date > today) return <Navigate to="/today" replace />;
  if (date === today) return <Navigate to="/today" replace />;

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <IconButton
          icon="arrowLeft"
          label={t('common.back', 'Back')}
          onClick={() => navigate('/progress')}
        />
        <div className="flex-1 min-w-0">
          <h1 className="text-[19px] font-extrabold text-ink leading-tight capitalize truncate">
            {dateLabel}
          </h1>
          <p className="text-[12px] text-ink-2">{t('day.past_hint', 'Editing a past day')}</p>
        </div>
        <IconButton
          icon="trash"
          label={t('day.delete', 'Delete this day')}
          onClick={() => setConfirmDelete(true)}
        />
      </header>

      <DayView date={date} isToday={false} />

      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('day.delete_title', 'Delete this day?')}
        body={t('day.delete_body', 'This permanently removes the day and everything logged on it.')}
        confirmLabel={t('day.delete_confirm', 'Delete day')}
        cancelLabel={t('common.cancel', 'Cancel')}
        loading={deleteDay.isPending}
        onConfirm={() => deleteDay.mutate()}
      />
    </div>
  );
}
