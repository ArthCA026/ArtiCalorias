import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { DayView } from '@/components/day/DayView';
import { DatePickerSheet } from '@/components/day/DatePickerSheet';
import { IconButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ConfirmSheet } from '@/components/ui/ActionSheet';
import { useToast } from '@/components/ui/Toast';
import { dailyLogService } from '@/services/dailyLogService';
import { invalidateDayData } from '@/lib/queryKeys';
import { toDateString, parseDate, addDays } from '@/utils/format';
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
  const [pickerOpen, setPickerOpen] = useState(false);

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
      invalidateDayData(queryClient);
      toast('success', t('day.deleted', 'Day deleted'));
      navigate('/progress', { replace: true });
    },
    onError: (err) =>
      toast('error', extractApiError(err, t('day.delete_error', 'Could not delete the day. Try again.'))),
  });

  // No future days, no malformed dates; today lives on its own tab
  if (!valid || !date || date > today) return <Navigate to="/today" replace />;
  if (date === today) return <Navigate to="/today" replace />;

  const goTo = (target: string) => {
    navigate(target === today ? '/today' : `/day/${target}`);
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <IconButton
          icon="arrowLeft"
          label={t('common.back', 'Back')}
          onClick={() => navigate('/progress')}
        />
        {/* The date is a button into the calendar, flanked by day-by-day
            arrows: flipping through history should feel like paging a diary,
            not retyping URLs. */}
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            aria-label={t('day.open_calendar_aria', 'Open the calendar to go to another day')}
            className="pressable w-full text-left"
          >
            <span className="flex items-center gap-1.5 text-[19px] font-extrabold text-ink leading-tight capitalize truncate">
              <span className="truncate">{dateLabel}</span>
              <Icon name="calendar" size={15} className="shrink-0 text-ink-3" />
            </span>
            <span className="block text-[12px] text-ink-2">
              {t('day.past_hint', 'Editing a past day')}
            </span>
          </button>
        </div>
        <IconButton
          icon="chevronLeft"
          label={t('day.prev_day', 'Previous day')}
          onClick={() => goTo(addDays(date, -1))}
        />
        <IconButton
          icon="chevronRight"
          label={t('day.next_day', 'Next day')}
          onClick={() => goTo(addDays(date, 1))}
        />
        <IconButton
          icon="trash"
          label={t('day.delete', 'Delete this day')}
          onClick={() => setConfirmDelete(true)}
        />
      </header>

      <DayView date={date} isToday={false} />

      <DatePickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selected={date}
        maxDate={today}
        onPick={goTo}
      />

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
