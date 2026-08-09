import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { DecimalField, Field } from '@/components/ui/Field';
import { QuantityField } from '@/components/ui/QuantityField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Switch } from '@/components/ui/Switch';
import { Icon } from '@/components/ui/Icon';
import { InlineError } from '@/components/ui/States';
import { useUnits } from '@/hooks/useUnits';
import { kgToDisplay, displayToKg, weightLabel, cmToFtIn, ftInToCm } from '@/utils/units';
import {
  GOAL_PRESETS,
  formatKgPerWeekShort,
  kgPerWeekToKcal,
  validateCustomKg,
  matchPreset,
  type GoalPresetKey,
} from '@/utils/goalUtils';
import { PROTEIN_PRESETS, getAgeProteinMinimum } from '@/config/proteinPresets';
import { cn } from '@/utils/cn';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toTimeInputValue, fromTimeInputValue } from '@/utils/notifications';
import type { UserProfileRequest, UserProfileResponse } from '@/types';

export interface EditSheetProps {
  open: boolean;
  onClose: () => void;
  profile: UserProfileResponse;
  onSave: (patch: Partial<UserProfileRequest>) => void;
  saving: boolean;
}

const num = (raw: string): number | null => {
  if (raw.trim() === '') return null;
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/* ------------------------------------------------------------------ */
/* Body details                                                        */
/* ------------------------------------------------------------------ */

export function BodySheet({ open, onClose, profile, onSave, saving }: EditSheetProps) {
  const { t } = useTranslation();
  const { system, weightUnit } = useUnits();
  const imperial = system === 'imperial';
  const [weight, setWeight] = useState(
    profile.currentWeightKg !== null
      ? String(Math.round(kgToDisplay(profile.currentWeightKg, weightUnit) * 10) / 10)
      : '',
  );
  const [height, setHeight] = useState(profile.heightCm !== null ? String(profile.heightCm) : '');
  const storedFtIn = profile.heightCm !== null ? cmToFtIn(profile.heightCm) : null;
  const [heightFt, setHeightFt] = useState(storedFtIn ? String(storedFtIn.ft) : '');
  const [heightIn, setHeightIn] = useState(storedFtIn ? String(storedFtIn.inch) : '');
  const [age, setAge] = useState(profile.age !== null ? String(profile.age) : '');
  const [sex, setSex] = useState<'M' | 'F' | ''>(
    profile.biologicalSex === 'M' || profile.biologicalSex === 'F' ? profile.biologicalSex : '',
  );

  const w = num(weight);
  const ft = num(heightFt);
  const inch = num(heightIn);
  // Stored value is always cm, whichever way it was typed.
  const h = imperial
    ? ft === null && inch === null
      ? null
      : ftInToCm(ft ?? 0, inch ?? 0)
    : num(height);
  const a = num(age);
  const valid =
    (w === null || (w > 0 && w < 1200)) &&
    (h === null || (h > 0 && h < 300)) &&
    (inch === null || (inch >= 0 && inch < 12)) &&
    (a === null || (a >= 1 && a <= 150));

  return (
    <Sheet open={open} onClose={onClose} title={t('profile.body_title', 'Body details')}>
      <div className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <DecimalField
            label={t('profile.weight', 'Weight')}
            suffix={weightLabel(weightUnit)}
            placeholder={imperial ? '155' : '70'}
            value={weight}
            onValueChange={setWeight}
          />
          {imperial ? (
            <div>
              <p className="text-[13px] font-semibold text-ink-2 mb-1.5">
                {t('profile.height', 'Height')}
              </p>
              <div className="flex gap-2">
                <DecimalField
                  aria-label={t('profile.height_ft_aria', 'Height, feet')}
                  suffix="ft"
                  placeholder="5"
                  value={heightFt}
                  onValueChange={setHeightFt}
                  containerClassName="flex-1"
                />
                <DecimalField
                  aria-label={t('profile.height_in_aria', 'Height, inches')}
                  suffix="in"
                  placeholder="10"
                  value={heightIn}
                  onValueChange={setHeightIn}
                  containerClassName="flex-1"
                />
              </div>
            </div>
          ) : (
            <DecimalField
              label={t('profile.height', 'Height')}
              suffix="cm"
              placeholder="175"
              value={height}
              onValueChange={setHeight}
            />
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t('profile.age', 'Age')}
            type="text"
            inputMode="numeric"
            placeholder="30"
            value={age}
            onChange={(e) => setAge(e.target.value.replace(/\D/g, ''))}
          />
          <div>
            <p className="text-[13px] font-semibold text-ink-2 mb-1.5">{t('profile.sex', 'Sex')}</p>
            <SegmentedControl<'M' | 'F' | ''>
              aria-label={t('profile.sex', 'Sex')}
              options={[
                { value: 'M', label: t('profile.sex_m', 'M') },
                { value: 'F', label: t('profile.sex_f', 'F') },
                { value: '', label: t('profile.sex_none', 'Skip') },
              ]}
              value={sex}
              onChange={setSex}
            />
          </div>
        </div>
        <p className="text-[13px] text-ink-3 leading-relaxed">
          {t('profile.body_hint', 'Used to estimate your daily burn. Your BMR and body fat are recalculated automatically.')}
        </p>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={saving}
          disabled={!valid}
          onClick={() =>
            onSave({
              currentWeightKg: w !== null ? Math.round(displayToKg(w, weightUnit) * 10) / 10 : null,
              heightCm: h,
              age: a,
              biologicalSex: sex,
              autoCalculateBMR: true,
              autoCalculateBodyFat: true,
            })
          }
        >
          {t('common.save', 'Save')}
        </Button>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Goal                                                                */
/* ------------------------------------------------------------------ */

const GOAL_KEYS: GoalPresetKey[] = ['lose-fast', 'lose-moderate', 'lose-slow', 'maintain', 'gain'];

export function GoalSheet({ open, onClose, profile, onSave, saving }: EditSheetProps) {
  const { t } = useTranslation();
  const { weightUnit } = useUnits();
  const current = matchPreset(String(Math.round(profile.dailyBaseGoalKcal)));
  const [selectedKey, setSelectedKey] = useState<GoalPresetKey | 'custom'>(
    current.isCustom ? 'custom' : (current.preset as GoalPresetKey),
  );
  const [showCustom, setShowCustom] = useState(current.isCustom);
  const [customKg, setCustomKg] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);

  const presets = GOAL_KEYS.map((k) => GOAL_PRESETS.find((p) => p.key === k)!);

  const save = () => {
    if (selectedKey === 'custom') {
      const err = validateCustomKg(customKg, weightUnit);
      if (err) {
        setCustomError(err);
        return;
      }
      const kg = weightUnit === 'lbs' ? Number(customKg) / 2.20462 : Number(customKg);
      onSave({ dailyBaseGoalKcal: kgPerWeekToKcal(kg) });
    } else {
      const preset = presets.find((p) => p.key === selectedKey)!;
      onSave({ dailyBaseGoalKcal: Number(preset.kcal) });
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('profile.goal_title', 'Your goal')}>
      <div className="space-y-2" role="radiogroup" aria-label={t('profile.goal_title', 'Your goal')}>
        {presets.map((p) => {
          const active = selectedKey === p.key;
          return (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setSelectedKey(p.key);
                setShowCustom(false);
              }}
              className={cn(
                'pressable w-full rounded-card px-4 py-3 text-left flex items-center gap-3',
                active ? 'bg-primary-soft ring-2 ring-primary/60' : 'bg-inset',
              )}
            >
              <span className="flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-[15px] font-bold text-ink">{t(`goal.${p.key}`, p.label)}</span>
                  {p.key === 'lose-moderate' && (
                    <span className="text-[10px] font-extrabold uppercase tracking-wide bg-primary text-on-primary rounded-full px-2 py-0.5">
                      {t('goal.recommended', 'Popular')}
                    </span>
                  )}
                </span>
                <span className="block text-[12px] text-ink-2 mt-0.5">
                  {formatKgPerWeekShort(p.kgPerWeek, weightUnit)}
                </span>
              </span>
              {active && <Icon name="checkCircle" size={20} className="text-primary" />}
            </button>
          );
        })}
      </div>

      {!showCustom ? (
        <button
          type="button"
          className="pressable mt-3 text-sm font-semibold text-primary-soft-ink py-1"
          onClick={() => {
            setShowCustom(true);
            setSelectedKey('custom');
          }}
        >
          {t('profile.goal_custom_link', 'Set a custom pace')}
        </button>
      ) : (
        <div className="mt-3">
          <DecimalField
            label={t('profile.goal_custom_label', 'Weekly change ({{unit}}/week)', {
              unit: weightLabel(weightUnit),
            })}
            placeholder={weightUnit === 'lbs' ? '-1.1' : '-0.5'}
            value={customKg}
            onValueChange={(v) => {
              setCustomKg(v);
              setCustomError(null);
              setSelectedKey('custom');
            }}
            error={customError}
            hint={t('profile.goal_custom_hint', 'Negative to lose, positive to gain')}
          />
        </div>
      )}

      <Button variant="primary" size="lg" fullWidth className="mt-4" loading={saving} onClick={save}>
        {t('common.save', 'Save')}
      </Button>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Protein                                                             */
/* ------------------------------------------------------------------ */

export function ProteinSheet({ open, onClose, profile, onSave, saving }: EditSheetProps) {
  const { t } = useTranslation();
  const weight = profile.currentWeightKg;
  const ageMin = getAgeProteinMinimum(profile.age ?? 30);
  const gramsFor = (perKg: number) =>
    weight !== null ? Math.round(weight * Math.max(perKg, ageMin)) : null;

  const [selected, setSelected] = useState<string>('everyday');
  const [showCustom, setShowCustom] = useState(false);
  const [customGrams, setCustomGrams] = useState(
    profile.proteinGoalGrams !== null ? String(Math.round(profile.proteinGoalGrams)) : '',
  );
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (showCustom) {
      const g = num(customGrams);
      if (g === null || g < 40 || g > 300) {
        setError(t('profile.protein_custom_error', 'Enter a value between 40 and 300 grams.'));
        return;
      }
      onSave({ proteinGoalGrams: g, autoCalculateProteinGoal: false });
    } else {
      const preset = PROTEIN_PRESETS.find((p) => p.id === selected)!;
      const g = gramsFor(preset.gramsPerKg);
      if (g === null) {
        setError(t('profile.protein_needs_weight', 'Add your weight first so we can compute grams, or set a custom target.'));
        return;
      }
      onSave({ proteinGoalGrams: g, autoCalculateProteinGoal: false });
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('profile.protein_title', 'Protein target')}>
      <div className="space-y-2" role="radiogroup" aria-label={t('profile.protein_title', 'Protein target')}>
        {PROTEIN_PRESETS.map((p) => {
          const active = !showCustom && selected === p.id;
          const grams = gramsFor(p.gramsPerKg);
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setSelected(p.id);
                setShowCustom(false);
                setError(null);
              }}
              className={cn(
                'pressable w-full rounded-card px-4 py-3 text-left flex items-center gap-3',
                active ? 'bg-primary-soft ring-2 ring-primary/60' : 'bg-inset',
              )}
            >
              <span className="flex-1">
                <span className="text-[15px] font-bold text-ink">
                  {t(`protein.${p.id}`, p.label)}
                </span>
                <span className="block text-[12px] text-ink-2 mt-0.5">
                  {p.gramsPerKg} g/kg{grams !== null ? ` = ${grams} g` : ''}
                </span>
              </span>
              {active && <Icon name="checkCircle" size={20} className="text-primary" />}
            </button>
          );
        })}
      </div>

      {!showCustom ? (
        <button
          type="button"
          className="pressable mt-3 text-sm font-semibold text-primary-soft-ink py-1"
          onClick={() => {
            setShowCustom(true);
            setError(null);
          }}
        >
          {t('profile.protein_custom_link', 'Set custom grams')}
        </button>
      ) : (
        <div className="mt-3">
          <DecimalField
            label={t('profile.protein_custom_label', 'Grams per day')}
            suffix="g"
            placeholder="120"
            value={customGrams}
            onValueChange={(v) => {
              setCustomGrams(v);
              setError(null);
            }}
          />
        </div>
      )}

      {error && <InlineError message={error} />}

      <Button variant="primary" size="lg" fullWidth className="mt-4" loading={saving} onClick={save}>
        {t('common.save', 'Save')}
      </Button>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Sleep & daily movement (NEAT)                                       */
/* ------------------------------------------------------------------ */

export function SleepNeatSheet({ open, onClose, profile, onSave, saving }: EditSheetProps) {
  const { t } = useTranslation();
  const [sleep, setSleep] = useState(profile.sleepHours);
  const [neat, setNeat] = useState(profile.neatHours);

  // Backend rule: at least 1 hour of the day must stay unreserved.
  const total = sleep + neat;
  const valid = total <= 23;

  return (
    <Sheet open={open} onClose={onClose} title={t('profile.sleep_neat_title', 'Sleep & daily movement')}>
      <div className="space-y-4">
        <div>
          <p className="text-[13px] font-semibold text-ink-2 mb-1.5">
            {t('profile.sleep_hours', 'Sleep per night')}
          </p>
          <QuantityField
            value={sleep}
            min={0}
            max={16}
            step={0.5}
            suffix={t('common.hour_suffix', 'h')}
            onCommit={setSleep}
          />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-ink-2 mb-1.5">
            {t('profile.neat_hours', 'Everyday movement')}
          </p>
          <QuantityField
            value={neat}
            min={0}
            max={16}
            step={0.5}
            suffix={t('common.hour_suffix', 'h')}
            onCommit={setNeat}
          />
          <p className="mt-1.5 text-[13px] text-ink-3 leading-relaxed">
            {t('profile.neat_hint', 'Hours you spend up and moving outside workouts: chores, cooking, walking around.')}
          </p>
        </div>

        {!valid && (
          <InlineError
            message={t('profile.sleep_neat_error', 'Sleep plus movement cannot exceed 23 hours. At least 1 hour must remain for everything else.')}
          />
        )}

        <p className="text-[13px] text-ink-3 leading-relaxed">
          {t('profile.sleep_neat_effect', 'These hours shape your estimated daily burn. Changes apply from today; past days keep the numbers they were logged with.')}
        </p>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={saving}
          disabled={!valid}
          onClick={() => onSave({ sleepHours: sleep, neatHours: neat })}
        >
          {t('common.save', 'Save')}
        </Button>
      </div>
    </Sheet>
  );
}

/* CalorieModeSheet moved to @/components/ui/CalorieModeSheet: every calorie
   mode tag in the app opens it, so it can no longer live under profile/. */

/* ------------------------------------------------------------------ */
/* Meal reminders                                                      */
/* ------------------------------------------------------------------ */

interface RemindersSheetProps {
  open: boolean;
  onClose: () => void;
}

export function RemindersSheet({ open, onClose }: RemindersSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} onClose={onClose} title={t('profile.reminders_title', 'Meal reminders')}>
      <RemindersBody />
    </Sheet>
  );
}

function RemindersBody() {
  const { t } = useTranslation();
  const { schedules, updateSchedule } = useNotificationSettings();
  const push = usePushNotifications();

  const mealLabel = (type: string) =>
    type === 'breakfast'
      ? t('profile.reminder_breakfast', 'Breakfast')
      : type === 'lunch'
        ? t('profile.reminder_lunch', 'Lunch')
        : t('profile.reminder_dinner', 'Dinner');

  if (!push.supported) {
    return (
      <p className="text-sm text-ink-2 leading-relaxed">
        {t('profile.push_unsupported', 'This browser does not support notifications. Open the app in Chrome or install it to your home screen to enable reminders.')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {!push.subscribed && (
        <Button
          variant="soft"
          size="md"
          fullWidth
          icon="bell"
          loading={push.loading}
          onClick={() => push.subscribe()}
        >
          {t('profile.push_enable', 'Enable notifications')}
        </Button>
      )}
      {push.permission === 'denied' && (
        <p className="text-[13px] text-warning leading-relaxed">
          {t('profile.push_denied', 'Notifications are blocked. Allow them for this site in your browser settings, then try again.')}
        </p>
      )}
      <div className="rounded-card bg-inset overflow-hidden">
        {schedules.map((s) => (
          <div key={s.type} className="flex items-center gap-3 px-4 py-3">
            <span className="flex-1 text-[15px] font-semibold text-ink">{mealLabel(s.type)}</span>
            <input
              type="time"
              value={toTimeInputValue(s.hour, s.minute)}
              disabled={!s.enabled}
              onChange={(e) => {
                const { hour, minute } = fromTimeInputValue(e.target.value);
                updateSchedule(s.type, { hour, minute });
              }}
              className="bg-card rounded-lg px-2 py-1.5 text-sm text-ink disabled:opacity-40"
              aria-label={t('profile.reminder_time_aria', '{{meal}} reminder time', { meal: mealLabel(s.type) })}
            />
            <Switch
              checked={s.enabled}
              onChange={(on) => updateSchedule(s.type, { enabled: on })}
              label={t('profile.reminder_toggle_aria', 'Enable {{meal}} reminder', { meal: mealLabel(s.type) })}
            />
          </div>
        ))}
      </div>
      <p className="text-[13px] text-ink-3 leading-relaxed">
        {t('profile.reminders_hint', 'A quick nudge at meal times keeps your streak safe.')}
      </p>
    </div>
  );
}
