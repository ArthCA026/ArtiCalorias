import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ConfirmSheet } from '@/components/ui/ActionSheet';
import { EmptyState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { dailyLogService } from '@/services/dailyLogService';
import { invalidateDayData } from '@/lib/queryKeys';
import { extractApiError, extractApiErrorCode } from '@/utils/apiError';

/**
 * The two faces of a deliberate fasting day on the meals tab.
 *
 * Marking is behind a confirm sheet because it changes real numbers: the
 * day's full deficit is banked into the week and the streak stays alive.
 * Unmarking is a single tap: it is instantly reversible and costs nothing.
 * Logging any food on a marked day removes the mark automatically server-side.
 */

interface FastingProps {
  /** yyyy-MM-dd of the day being marked or unmarked */
  date: string;
  /** Today gets present tense; a past day reads as a record being corrected */
  isToday: boolean;
}

function useSetFasting(date: string) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (isFasting: boolean) =>
      dailyLogService.setFasting(date, isFasting).then((r) => r.data),
    onSuccess: (log) => {
      // The fast banks a full day's deficit: every day of the week, the
      // streak and the history views shift with it.
      invalidateDayData(queryClient);
      toast(
        'success',
        log.isFastingDay
          ? t('today.fasting_marked', 'Marked as a fasting day')
          : t('today.fasting_unmarked', 'Fasting mark removed'),
      );
    },
    onError: (err) => {
      // Localized message for the one expected rejection; raw extraction
      // otherwise (network, auth, and other generic failures).
      const message =
        extractApiErrorCode(err) === 'FASTING_DAY_HAS_FOOD'
          ? t('today.fasting_has_food_error', 'This day has meals logged. Remove them first to mark it as a fasting day.')
          : extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.'));
      toast('error', message);
    },
  });
}

/** Subtle entry point under the empty meals state: "Fasting today? Mark it." */
export function MarkFastingButton({ date, isToday }: FastingProps) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const mutation = useSetFasting(date);

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="pressable mt-3 text-[13px] font-semibold text-ink-3 underline underline-offset-2 py-1"
      >
        {isToday
          ? t('today.fasting_cta', 'Fasting today? Mark it')
          : t('day.fasting_cta', 'Fasted this day? Mark it')}
      </button>

      <ConfirmSheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('today.fasting_confirm_title', 'Mark as a fasting day?')}
        body={t(
          'today.fasting_confirm_body',
          'No meals are expected on this day. Its full calorie deficit counts toward your week and your streak stays safe. Logging any food removes the mark automatically.',
        )}
        confirmLabel={t('today.fasting_confirm_label', 'Mark fasting day')}
        cancelLabel={t('common.cancel', 'Cancel')}
        destructive={false}
        loading={mutation.isPending}
        onConfirm={() =>
          mutation.mutate(true, { onSuccess: () => setConfirming(false) })
        }
      />
    </>
  );
}

/** What the meals tab shows instead of the empty state once the day is a fast. */
export function FastingState({ date, isToday }: FastingProps) {
  const { t } = useTranslation();
  const mutation = useSetFasting(date);

  return (
    <EmptyState
      icon="moon"
      title={
        isToday
          ? t('today.fasting_state_title', 'Fasting day')
          : t('day.fasting_state_title', 'A fasting day')
      }
      body={
        isToday
          ? t('today.fasting_state_body', 'No meals expected. Your full deficit counts toward the week and your streak is safe.')
          : t('day.fasting_state_body', 'This day was a deliberate fast. Its full deficit counted toward that week.')
      }
    >
      <button
        type="button"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate(false)}
        className="pressable mt-4 text-[13px] font-semibold text-ink-3 underline underline-offset-2 py-1 disabled:opacity-50"
      >
        {t('today.fasting_unmark', 'Not fasting? Remove the mark')}
      </button>
    </EmptyState>
  );
}
