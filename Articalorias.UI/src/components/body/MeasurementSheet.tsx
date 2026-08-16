import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { DecimalField } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { InlineError } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { DatePickerSheet } from '@/components/day/DatePickerSheet';
import { measurementService } from '@/services/measurementService';
import { queryKeys, invalidateDayData } from '@/lib/queryKeys';
import { useUnits } from '@/hooks/useUnits';
import { kgToDisplay, displayToKg, weightLabel } from '@/utils/units';
import { toDateString, parseDate } from '@/utils/format';
import { extractApiError } from '@/utils/apiError';
import type { BodyMeasurement, UserProfileResponse } from '@/types';

interface MeasurementSheetProps {
  open: boolean;
  onClose: () => void;
  /** Existing measurement to edit; null = add a new one (defaults to today) */
  measurement: BodyMeasurement | null;
  profile: UserProfileResponse | undefined;
}

const num = (raw: string): number | null => {
  if (raw.trim() === '') return null;
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/**
 * Add or edit one day's measurement. Weight in the user's display unit
 * (stored as kg), body fat optional: left empty it stays estimated, filled
 * in it becomes YOUR number and the app switches to using it.
 */
export function MeasurementSheet({ open, onClose, measurement, profile }: MeasurementSheetProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { weightUnit } = useUnits();
  const today = toDateString();
  const editing = measurement !== null;

  const [date, setDate] = useState(today);
  const [dateOpen, setDateOpen] = useState(false);
  const [weight, setWeight] = useState('');
  const [bf, setBf] = useState('');
  const [error, setError] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- bounded open-transition reset */
  useEffect(() => {
    if (!open) return;
    setDate(measurement?.measuredOn ?? today);
    setWeight(
      measurement?.weightKg != null
        ? String(Math.round(kgToDisplay(measurement.weightKg, weightUnit) * 10) / 10)
        : '',
    );
    setBf(measurement?.bodyFatPercent != null ? String(measurement.bodyFatPercent) : '');
    setError(null);
  }, [open, measurement, today, weightUnit]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const w = num(weight);
  const b = num(bf);
  const valid =
    (w !== null || b !== null) &&
    (w === null || (w > 0 && w < 1200)) &&
    (b === null || (b >= 1 && b <= 75));

  const afterChange = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.measurements() });
    queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
    // The newest measurement moves today's snapshot (weight drives the burn).
    invalidateDayData(queryClient);
  };

  const save = useMutation({
    mutationFn: () =>
      measurementService.upsert(date, {
        weightKg: w !== null ? Math.round(displayToKg(w, weightUnit) * 10) / 10 : null,
        bodyFatPercent: b,
      }),
    onSuccess: () => {
      afterChange();
      // A manual BMR / body fat measured at a different weight quietly drifts:
      // say it once, right when the weight moves, with the fix one tap away.
      const weightChanged =
        w !== null &&
        profile?.currentWeightKg != null &&
        Math.abs(displayToKg(w, weightUnit) - profile.currentWeightKg) >= 0.1;
      if (weightChanged && profile && (!profile.autoCalculateBMR || (!profile.autoCalculateBodyFat && b === null))) {
        toast('info', t('body.manual_review_hint', 'Weight updated. Your manual BMR or body fat may need a review in Profile.'));
      } else {
        toast('success', t('common.saved', 'Saved'));
      }
      onClose();
    },
    onError: (err) =>
      setError(extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.'))),
  });

  const del = useMutation({
    mutationFn: () => measurementService.remove(date),
    onSuccess: () => {
      afterChange();
      toast('success', t('today.deleted', 'Deleted'));
      onClose();
    },
    onError: (err) =>
      setError(extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.'))),
  });

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
      }).format(parseDate(date)),
    [date, i18n.language],
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? t('body.edit_title', 'Edit measurement') : t('body.add_title', 'Add measurement')}
    >
      <div className="space-y-3.5">
        <div>
          <p className="text-[13px] font-semibold text-ink-2 mb-1.5">{t('body.date', 'Date')}</p>
          <button
            type="button"
            disabled={editing}
            onClick={() => setDateOpen(true)}
            className="pressable w-full flex items-center justify-between rounded-card bg-inset px-4 py-3 disabled:opacity-60"
            aria-label={t('body.date_aria', 'Measurement date: {{date}}. Tap to change.', { date: dateLabel })}
          >
            <span className="text-[15px] font-semibold text-ink capitalize">
              {date === today ? t('progress.today_row', 'Today') : dateLabel}
            </span>
            {!editing && <Icon name="calendar" size={17} className="text-ink-3" />}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DecimalField
            label={t('profile.weight', 'Weight')}
            suffix={weightLabel(weightUnit)}
            placeholder={weightUnit === 'lbs' ? '155' : '70'}
            value={weight}
            onValueChange={(v) => {
              setWeight(v);
              setError(null);
            }}
          />
          <DecimalField
            label={t('body.bf_field', 'Body fat')}
            suffix="%"
            placeholder={t('body.bf_optional_ph', 'Optional')}
            value={bf}
            onValueChange={(v) => {
              setBf(v);
              setError(null);
            }}
          />
        </div>

        <p className="text-[13px] text-ink-3 leading-relaxed">
          {profile?.autoCalculateBodyFat
            ? t('body.bf_hint_auto', 'Leave body fat empty to keep the automatic estimate. Enter a measured value and the app starts using yours.')
            : t('body.bf_hint_manual', 'Body fat is optional. One measurement per day; saving again on the same day updates it.')}
        </p>

        {error && <InlineError message={error} />}

        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={save.isPending}
          disabled={!valid}
          onClick={() => save.mutate()}
        >
          {t('common.save', 'Save')}
        </Button>
        {editing && (
          <Button
            variant="ghost"
            size="md"
            fullWidth
            loading={del.isPending}
            onClick={() => del.mutate()}
          >
            <span className="text-danger">{t('body.delete_measurement', 'Delete this measurement')}</span>
          </Button>
        )}
      </div>

      <DatePickerSheet
        open={dateOpen}
        onClose={() => setDateOpen(false)}
        selected={date}
        maxDate={today}
        onPick={setDate}
        title={t('body.date_picker_title', 'Measurement date')}
      />
    </Sheet>
  );
}
