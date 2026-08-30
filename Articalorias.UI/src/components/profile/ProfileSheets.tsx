import { useEffect, useState } from 'react';
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

interface BodySheetProps extends EditSheetProps {
  /** Open with the advanced (BMR / body fat) section expanded */
  initialAdvanced?: boolean;
}

export function BodySheet({ open, onClose, profile, onSave, saving, initialAdvanced }: BodySheetProps) {
  const { t } = useTranslation();
  const { system, weightUnit } = useUnits();
  const imperial = system === 'imperial';

  const usesManualDetails = !profile.autoCalculateBMR || !profile.autoCalculateBodyFat;

  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'M' | 'F' | ''>('');
  // Advanced: manual BMR / body fat for people who know their real numbers
  // (DEXA scan, smart scale, lab test). Auto stays the smart default.
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [bmrMode, setBmrMode] = useState<'auto' | 'manual'>('auto');
  const [bmrValue, setBmrValue] = useState('');
  const [bfMode, setBfMode] = useState<'auto' | 'manual'>('auto');
  const [bfValue, setBfValue] = useState('');

  // Re-derive every field each time the sheet opens: the profile may have
  // been saved elsewhere, and the unit system may have been switched since
  // mount. Without this, "70" typed as kg silently reopens labeled lbs — and
  // saving it would corrupt the stored weight by a factor of 2.2.
  /* eslint-disable react-hooks/set-state-in-effect -- resetting draft fields
     on the open transition is a bounded, intentional props→state sync */
  useEffect(() => {
    if (!open) return;
    setWeight(
      profile.currentWeightKg !== null
        ? String(Math.round(kgToDisplay(profile.currentWeightKg, weightUnit) * 10) / 10)
        : '',
    );
    setHeight(profile.heightCm !== null ? String(profile.heightCm) : '');
    const storedFtIn = profile.heightCm !== null ? cmToFtIn(profile.heightCm) : null;
    setHeightFt(storedFtIn ? String(storedFtIn.ft) : '');
    setHeightIn(storedFtIn ? String(storedFtIn.inch) : '');
    setAge(profile.age !== null ? String(profile.age) : '');
    setSex(profile.biologicalSex === 'M' || profile.biologicalSex === 'F' ? profile.biologicalSex : '');
    setShowAdvanced(!!initialAdvanced || usesManualDetails);
    setBmrMode(profile.autoCalculateBMR ? 'auto' : 'manual');
    setBmrValue(!profile.autoCalculateBMR && profile.bmrKcal > 0 ? String(Math.round(profile.bmrKcal)) : '');
    setBfMode(profile.autoCalculateBodyFat ? 'auto' : 'manual');
    setBfValue(
      !profile.autoCalculateBodyFat && profile.bodyFatPercent !== null
        ? String(profile.bodyFatPercent)
        : '',
    );
  }, [open, profile, weightUnit, initialAdvanced, usesManualDetails]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
  const bmr = num(bmrValue);
  const bf = num(bfValue);
  const valid =
    (w === null || (w > 0 && w < 1200)) &&
    (h === null || (h > 0 && h < 300)) &&
    (inch === null || (inch >= 0 && inch < 12)) &&
    (a === null || (a >= 1 && a <= 150)) &&
    (bmrMode === 'auto' || (bmr !== null && bmr >= 500 && bmr <= 8000)) &&
    (bfMode === 'auto' || (bf !== null && bf >= 1 && bf <= 75));

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
                  // Single digit on purpose: the inches field is only half a
                  // grid column wide, so a two-digit placeholder gets clipped.
                  placeholder="8"
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

        {/* Special details: progressive disclosure keeps the everyday path
            two fields long while gym-goers with real measurements get full
            control one tap deeper. */}
        <button
          type="button"
          aria-expanded={showAdvanced}
          className="pressable flex items-center gap-1 text-sm font-semibold text-primary-soft-ink py-1"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          <Icon name={showAdvanced ? 'chevronUp' : 'chevronDown'} size={16} />
          {t('profile.advanced_toggle', 'Special details: BMR & body fat')}
        </button>

        {showAdvanced && (
          <div className="space-y-3.5 rounded-card bg-inset p-3.5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[13px] font-semibold text-ink-2">
                  {t('profile.bmr_label', 'BMR (calories at rest)')}
                </p>
                <SegmentedControl<'auto' | 'manual'>
                  aria-label={t('profile.bmr_mode_aria', 'BMR mode')}
                  options={[
                    { value: 'auto', label: t('profile.mode_auto', 'Auto') },
                    { value: 'manual', label: t('profile.mode_manual', 'Manual') },
                  ]}
                  value={bmrMode}
                  onChange={setBmrMode}
                />
              </div>
              {bmrMode === 'auto' ? (
                <p className="text-[13px] text-ink-3 leading-relaxed">
                  {profile.bmrKcal > 0
                    ? t('profile.bmr_auto_value', 'Calculated for you: {{kcal}} kcal (Mifflin-St Jeor).', {
                        kcal: Math.round(profile.bmrKcal).toLocaleString(),
                      })
                    : t('profile.bmr_auto_pending', 'Calculated from weight, height, age and sex once they are set.')}
                </p>
              ) : (
                <DecimalField
                  aria-label={t('profile.bmr_label', 'BMR (calories at rest)')}
                  suffix="kcal"
                  placeholder="1700"
                  value={bmrValue}
                  onValueChange={setBmrValue}
                  hint={t('profile.bmr_manual_hint', 'From a metabolic test or your own tracking. Used for every calorie calculation.')}
                />
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[13px] font-semibold text-ink-2">
                  {t('profile.bf_label', 'Body fat')}
                </p>
                <SegmentedControl<'auto' | 'manual'>
                  aria-label={t('profile.bf_mode_aria', 'Body fat mode')}
                  options={[
                    { value: 'auto', label: t('profile.mode_auto', 'Auto') },
                    { value: 'manual', label: t('profile.mode_manual', 'Manual') },
                  ]}
                  value={bfMode}
                  onChange={setBfMode}
                />
              </div>
              {bfMode === 'auto' ? (
                <p className="text-[13px] text-ink-3 leading-relaxed">
                  {profile.bodyFatPercent !== null
                    ? t('profile.bf_auto_value', 'Estimated for you: {{pct}}% (formula, not a measurement).', {
                        pct: profile.bodyFatPercent,
                      })
                    : t('profile.bf_auto_pending', 'Estimated from your BMI, age and sex once they are set.')}
                </p>
              ) : (
                <DecimalField
                  aria-label={t('profile.bf_label', 'Body fat')}
                  suffix="%"
                  placeholder="18"
                  value={bfValue}
                  onValueChange={setBfValue}
                  hint={t('profile.bf_manual_hint', 'From a smart scale, caliper or DEXA scan. Sharpens the safety floors.')}
                />
              )}
            </div>
          </div>
        )}

        <p className="text-[13px] text-ink-3 leading-relaxed">
          {t('profile.body_hint_v2', 'These size your daily burn. On Auto, BMR and body fat recalculate whenever your body details change.')}
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
              autoCalculateBMR: bmrMode === 'auto',
              bmrKcal: bmrMode === 'manual' ? bmr : null,
              autoCalculateBodyFat: bfMode === 'auto',
              bodyFatPercent: bfMode === 'manual' ? bf : null,
            })
          }
        >
          {t('common.save', 'Save')}
        </Button>
      </div>
    </Sheet>
  );
}

/* The goal chooser moved to its own page (/profile/goal): the pace-vs-target
   planner outgrew a bottom sheet. See src/pages/GoalPage.tsx. */

/* ------------------------------------------------------------------ */
/* Protein                                                             */
/* ------------------------------------------------------------------ */

export function ProteinSheet({ open, onClose, profile, onSave, saving }: EditSheetProps) {
  const { t } = useTranslation();
  const weight = profile.currentWeightKg;
  const ageMin = getAgeProteinMinimum(profile.age ?? 30);
  const gramsFor = (perKg: number) =>
    weight !== null ? Math.round(weight * Math.max(perKg, ageMin)) : null;

  // Preselect the stored preset when the profile is in auto mode.
  const storedPreset =
    profile.autoCalculateProteinGoal && profile.proteinGoalGramsPerKg !== null
      ? PROTEIN_PRESETS.find((p) => p.gramsPerKg === profile.proteinGoalGramsPerKg)?.id
      : undefined;

  const [selected, setSelected] = useState<string>(storedPreset ?? 'everyday');
  const [showCustom, setShowCustom] = useState(
    !profile.autoCalculateProteinGoal && profile.proteinGoalGrams !== null,
  );
  const [customGrams, setCustomGrams] = useState(
    profile.proteinGoalGrams !== null ? String(Math.round(profile.proteinGoalGrams)) : '',
  );
  const [error, setError] = useState<string | null>(null);

  // Re-derive on every open: the target may have been saved since mount.
  /* eslint-disable react-hooks/set-state-in-effect -- bounded open-transition reset */
  useEffect(() => {
    if (!open) return;
    setCustomGrams(profile.proteinGoalGrams !== null ? String(Math.round(profile.proteinGoalGrams)) : '');
    setShowCustom(!profile.autoCalculateProteinGoal && profile.proteinGoalGrams !== null);
    setError(null);
  }, [open, profile.proteinGoalGrams, profile.autoCalculateProteinGoal]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const save = () => {
    if (showCustom) {
      const g = num(customGrams);
      if (g === null || g < 40 || g > 300) {
        setError(t('profile.protein_custom_error', 'Enter a value between 40 and 300 grams.'));
        return;
      }
      onSave({ proteinGoalGrams: g, autoCalculateProteinGoal: false, proteinGoalGramsPerKg: null });
    } else {
      // A preset stores its multiplier: the goal follows the weight from now
      // on, and if there is no weight yet it activates the moment one is set.
      const preset = PROTEIN_PRESETS.find((p) => p.id === selected)!;
      onSave({
        proteinGoalGrams: null,
        autoCalculateProteinGoal: true,
        proteinGoalGramsPerKg: preset.gramsPerKg,
      });
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

      {!showCustom && weight === null && (
        <p className="mt-3 text-[13px] text-ink-3 leading-relaxed">
          {t('profile.protein_no_weight_hint', 'No weight on your profile yet: the target switches on by itself the moment you add one.')}
        </p>
      )}

      {error && <InlineError message={error} />}

      <Button variant="primary" size="lg" fullWidth className="mt-4" loading={saving} onClick={save}>
        {t('common.save', 'Save')}
      </Button>

      {/* Protein is optional like any other macro: turning it off clears the
          goal, hides the bar from today on, and past days keep theirs. */}
      {(profile.proteinGoalGrams !== null || profile.autoCalculateProteinGoal) && (
        <Button
          variant="ghost"
          size="md"
          fullWidth
          className="mt-2"
          loading={saving}
          onClick={() => onSave({ proteinGoalGrams: null, autoCalculateProteinGoal: false })}
        >
          {t('profile.protein_turn_off', 'Stop tracking protein')}
        </Button>
      )}
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

  // Re-derive on every open: the hours may have been saved since mount.
  /* eslint-disable react-hooks/set-state-in-effect -- bounded open-transition reset */
  useEffect(() => {
    if (!open) return;
    setSleep(profile.sleepHours);
    setNeat(profile.neatHours);
  }, [open, profile.sleepHours, profile.neatHours]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
