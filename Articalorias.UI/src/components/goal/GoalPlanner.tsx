import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { DecimalField } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/utils/cn';
import {
  GOAL_PRESETS,
  TARGET_MAX_DAYS,
  formatKgPerWeekShort,
  formatSignedKcal,
  kgPerWeekToKcal,
  matchPreset,
  minBodyFatPercentFor,
  planForTarget,
  validateCustomKcal,
  validateCustomKg,
  weightForBodyFatTarget,
  type GoalPresetKey,
  type TargetPlan,
} from '@/utils/goalUtils';
import {
  displayToKg,
  kgToDisplay,
  weightLabel,
  formatWeightRate,
  type WeightUnit,
} from '@/utils/units';
import { addDays, parseDate, toDateString } from '@/utils/format';

/** What the planner hands back; null while the current input cannot be saved. */
export interface GoalSelection {
  dailyBaseGoalKcal: number;
  goalTargetWeightKg: number | null;
  goalTargetBodyFatPercent: number | null;
  goalTargetDate: string | null;
}

interface GoalPlannerProps {
  /** Current body data; nulls disable the target mode with a teaching hint. */
  currentWeightKg: number | null;
  heightCm: number | null;
  bodyFatPercent: number | null;
  biologicalSex: string | null;
  weightUnit: WeightUnit;
  /** Prefill: the stored goal (pace preset or target metadata). */
  initialGoalKcal: number;
  initialTargetWeightKg?: number | null;
  initialTargetBfPercent?: number | null;
  initialTargetDate?: string | null;
  /** Fired on every change; null = current input is incomplete or unsafe. */
  onChange: (selection: GoalSelection | null) => void;
  /** Background for the unselected option cards (bg-card on app bg, bg-inset in sheets). */
  optionClassName?: string;
}

const PACE_KEYS: GoalPresetKey[] = ['lose-fast', 'lose-moderate', 'lose-slow', 'maintain', 'gain'];

type PlannerMode = 'pace' | 'target';
type TargetMetric = 'weight' | 'bodyFat';

const num = (raw: string): number | null => {
  if (raw.trim() === '') return null;
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/**
 * The one goal chooser. Two ways to say the same thing:
 *  - a weekly pace (presets + custom), the classic mode;
 *  - a destination: "weigh X (or be X% body fat) by DATE", which the planner
 *    converts to a pace and guards with medical limits (max 1% of body weight
 *    lost per week, max 0.5% gained, BMI 18.5 floor, essential body-fat floor).
 * Unsafe plans never produce a selection: instead the planner proposes the
 * closest safe date, one tap away, so ambition gets redirected, not punished.
 */
export function GoalPlanner({
  currentWeightKg,
  heightCm,
  bodyFatPercent,
  biologicalSex,
  weightUnit,
  initialGoalKcal,
  initialTargetWeightKg,
  initialTargetBfPercent,
  initialTargetDate,
  onChange,
  optionClassName = 'bg-inset',
}: GoalPlannerProps) {
  const { t, i18n } = useTranslation();
  const today = toDateString();

  const hasStoredTarget = Boolean(initialTargetDate && (initialTargetWeightKg || initialTargetBfPercent));
  const canPlanByDate = currentWeightKg !== null && currentWeightKg > 0;
  const canPlanBodyFat = canPlanByDate && bodyFatPercent !== null && bodyFatPercent > 0;

  const [mode, setMode] = useState<PlannerMode>(hasStoredTarget && canPlanByDate ? 'target' : 'pace');

  // ── Pace mode state ──
  const stored = matchPreset(String(Math.round(initialGoalKcal)));
  const [selectedKey, setSelectedKey] = useState<GoalPresetKey | 'custom'>(
    stored.isCustom ? 'custom' : (stored.preset as GoalPresetKey),
  );
  const [showCustom, setShowCustom] = useState(stored.isCustom && !hasStoredTarget);
  // A custom pace can be typed either as weight per week or directly as a
  // daily calorie adjustment; both fields prefill from the STORED goal so
  // reopening the chooser always shows what is currently set.
  const [customMode, setCustomMode] = useState<'kg' | 'kcal'>('kg');
  const [customKg, setCustomKg] = useState(() =>
    stored.isCustom
      ? String(Math.round(kgToDisplay((initialGoalKcal * 7) / 7700, weightUnit) * 100) / 100)
      : '',
  );
  const [customKcal, setCustomKcal] = useState(() =>
    stored.isCustom ? String(Math.round(initialGoalKcal)) : '',
  );
  const [customError, setCustomError] = useState<string | null>(null);

  // ── Target mode state ──
  const [metric, setMetric] = useState<TargetMetric>(
    initialTargetBfPercent ? 'bodyFat' : 'weight',
  );
  const [targetValue, setTargetValue] = useState(() => {
    if (initialTargetBfPercent) return String(initialTargetBfPercent);
    if (initialTargetWeightKg)
      return String(Math.round(kgToDisplay(initialTargetWeightKg, weightUnit) * 10) / 10);
    return '';
  });
  const [targetDate, setTargetDate] = useState(initialTargetDate ?? addDays(today, 91));

  const minDate = addDays(today, 7);
  const maxDate = addDays(today, TARGET_MAX_DAYS);

  // ── Derive the target plan ──
  const target = useMemo(() => {
    if (mode !== 'target' || !canPlanByDate || currentWeightKg === null) return null;

    const v = num(targetValue);
    if (v === null || v <= 0) return { state: 'incomplete' as const };

    let targetKg: number;
    let targetBf: number | null = null;

    if (metric === 'bodyFat') {
      if (!canPlanBodyFat || bodyFatPercent === null) return { state: 'incomplete' as const };
      const floor = minBodyFatPercentFor(biologicalSex);
      if (v >= 100 || v >= bodyFatPercent + 30) return { state: 'incomplete' as const };
      if (v < floor) return { state: 'bf-too-low' as const, floor };
      targetBf = v;
      targetKg = weightForBodyFatTarget(currentWeightKg, bodyFatPercent, v);
    } else {
      targetKg = Math.round(displayToKg(v, weightUnit) * 10) / 10;
      // Losing below the WHO healthy-BMI floor is refused, not warned about.
      if (heightCm !== null && heightCm > 0 && targetKg < currentWeightKg) {
        const minHealthyKg = Math.round(18.5 * (heightCm / 100) ** 2 * 10) / 10;
        if (targetKg < minHealthyKg) return { state: 'weight-too-low' as const, minHealthyKg };
      }
      if (targetKg <= 0 || targetKg >= 1200) return { state: 'incomplete' as const };
    }

    if (!targetDate || targetDate < minDate || targetDate > maxDate)
      return { state: 'bad-date' as const, targetKg, targetBf };

    const plan = planForTarget(currentWeightKg, targetKg, today, targetDate);
    if (plan === null) return { state: 'bad-date' as const, targetKg, targetBf };

    return { state: 'planned' as const, plan, targetKg, targetBf };
  }, [mode, canPlanByDate, canPlanBodyFat, currentWeightKg, bodyFatPercent, biologicalSex, heightCm, metric, targetValue, targetDate, weightUnit, today, minDate, maxDate]);

  // ── Publish the selection upward ──
  useEffect(() => {
    if (mode === 'pace') {
      if (selectedKey === 'custom') {
        let goalKcal: number;
        if (customMode === 'kcal') {
          const err = customKcal.trim() === '' ? 'empty' : validateCustomKcal(customKcal);
          if (err) {
            onChange(null);
            return;
          }
          goalKcal = Math.round(Number(customKcal.replace(',', '.')));
        } else {
          const err = customKg.trim() === '' ? 'empty' : validateCustomKg(customKg, weightUnit);
          if (err) {
            onChange(null);
            return;
          }
          const kg = weightUnit === 'lbs' ? Number(customKg.replace(',', '.')) / 2.20462 : Number(customKg.replace(',', '.'));
          goalKcal = kgPerWeekToKcal(kg);
        }
        onChange({
          dailyBaseGoalKcal: goalKcal,
          goalTargetWeightKg: null,
          goalTargetBodyFatPercent: null,
          goalTargetDate: null,
        });
        return;
      }
      const preset = GOAL_PRESETS.find((p) => p.key === selectedKey);
      onChange(
        preset
          ? {
              dailyBaseGoalKcal: Number(preset.kcal),
              goalTargetWeightKg: null,
              goalTargetBodyFatPercent: null,
              goalTargetDate: null,
            }
          : null,
      );
      return;
    }

    // Target mode: only a safe, complete plan is savable.
    if (!target || target.state !== 'planned' || target.plan.verdict !== null) {
      onChange(null);
      return;
    }
    onChange({
      dailyBaseGoalKcal: target.plan.kcalPerDay,
      goalTargetWeightKg: target.targetBf === null ? target.targetKg : null,
      goalTargetBodyFatPercent: target.targetBf,
      goalTargetDate: targetDate,
    });
    // onChange is a state setter from the parent; identity is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedKey, customMode, customKg, customKcal, weightUnit, target, targetDate]);

  // Live translation of a valid custom value into the other dialect, shown
  // as the field hint: type a pace, see the kcal; type kcal, see the pace.
  const customEquivalence = useMemo(() => {
    if (customMode === 'kg') {
      if (customKg.trim() === '' || validateCustomKg(customKg, weightUnit) !== null) return null;
      const kg = weightUnit === 'lbs' ? Number(customKg.replace(',', '.')) / 2.20462 : Number(customKg.replace(',', '.'));
      return t('goalplan.equiv_kcal', 'That is about {{kcal}} kcal per day.', {
        kcal: formatSignedKcal(kgPerWeekToKcal(kg)),
      });
    }
    if (customKcal.trim() === '' || validateCustomKcal(customKcal) !== null) return null;
    const kcal = Number(customKcal.replace(',', '.'));
    return t('goalplan.equiv_pace', 'That is about {{pace}}.', {
      pace: formatWeightRate((kcal * 7) / 7700, weightUnit),
    });
  }, [customMode, customKg, customKcal, weightUnit, t]);

  const fmtDate = (d: string) =>
    new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }).format(parseDate(d));

  const fmtWeight = (kg: number) =>
    `${Math.round(kgToDisplay(kg, weightUnit) * 10) / 10} ${weightLabel(weightUnit)}`;

  const presets = PACE_KEYS.map((k) => GOAL_PRESETS.find((p) => p.key === k)!);

  return (
    <div className="space-y-3">
      <SegmentedControl<PlannerMode>
        aria-label={t('goalplan.mode_aria', 'How to set your goal')}
        options={[
          { value: 'pace', label: t('goalplan.mode_pace', 'Weekly pace') },
          { value: 'target', label: t('goalplan.mode_target', 'Target by date'), icon: 'flag' },
        ]}
        value={mode}
        onChange={setMode}
      />

      {mode === 'pace' && (
        <>
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
                    active ? 'bg-primary-soft ring-2 ring-primary/60' : optionClassName,
                  )}
                >
                  <span className="flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[15px] font-bold text-ink">{t(`goal.${p.key}`, p.label)}</span>
                      {p.key === 'lose-moderate' && (
                        <span className="text-[10px] font-extrabold uppercase tracking-wide bg-primary text-on-primary rounded-full px-2 py-0.5">
                          {t('goal.recommended', 'Recommended')}
                        </span>
                      )}
                    </span>
                    <span className="block text-[12px] text-ink-2 mt-0.5">
                      {formatKgPerWeekShort(p.kgPerWeek, weightUnit)}
                      {' · '}
                      {t('goalplan.kcal_per_day', '{{kcal}} kcal/day', {
                        kcal: formatSignedKcal(Number(p.kcal)),
                      })}
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
              className="pressable text-sm font-semibold text-primary-soft-ink py-1"
              onClick={() => {
                setShowCustom(true);
                setSelectedKey('custom');
              }}
            >
              {t('profile.goal_custom_link', 'Set a custom pace')}
            </button>
          ) : (
            <div className="space-y-2.5 rounded-card bg-primary-soft/40 p-3">
              {/* Same pace, two dialects: weight per week or kcal per day.
                  Both fields prefill from the stored goal and each shows its
                  translation into the other, so the numbers never feel
                  disconnected. */}
              <SegmentedControl<'kg' | 'kcal'>
                aria-label={t('goalplan.custom_mode_aria', 'Custom pace unit')}
                options={[
                  {
                    value: 'kg',
                    label: t('goalplan.custom_mode_kg', '{{unit}}/week', { unit: weightLabel(weightUnit) }),
                  },
                  { value: 'kcal', label: t('goalplan.custom_mode_kcal', 'kcal/day') },
                ]}
                value={customMode}
                onChange={(m) => {
                  setCustomMode(m);
                  setCustomError(null);
                  setSelectedKey('custom');
                }}
              />
              {customMode === 'kg' ? (
                <DecimalField
                  label={t('profile.goal_custom_label', 'Weekly change ({{unit}}/week)', {
                    unit: weightLabel(weightUnit),
                  })}
                  placeholder={weightUnit === 'lbs' ? '-1.1' : '-0.5'}
                  value={customKg}
                  onValueChange={(v) => {
                    setCustomKg(v);
                    setCustomError(v.trim() === '' ? null : validateCustomKg(v, weightUnit));
                    setSelectedKey('custom');
                  }}
                  error={customError}
                  hint={customEquivalence ?? t('profile.goal_custom_hint', 'Negative to lose, positive to gain')}
                />
              ) : (
                <DecimalField
                  label={t('goalplan.custom_kcal_label', 'Daily change (kcal/day)')}
                  placeholder="-550"
                  value={customKcal}
                  onValueChange={(v) => {
                    setCustomKcal(v);
                    setCustomError(v.trim() === '' ? null : validateCustomKcal(v));
                    setSelectedKey('custom');
                  }}
                  error={customError}
                  hint={customEquivalence ?? t('goalplan.custom_kcal_hint', 'Negative for a deficit, positive for a surplus')}
                />
              )}
            </div>
          )}
        </>
      )}

      {mode === 'target' && !canPlanByDate && (
        <div className="rounded-card bg-inset p-4 flex items-start gap-3">
          <Icon name="scale" size={18} className="text-ink-3 shrink-0 mt-0.5" />
          <p className="text-[13px] text-ink-2 leading-relaxed">
            {t('goalplan.needs_weight', 'Planning by date needs your current weight. Add it and the app turns your target into a daily budget.')}
          </p>
        </div>
      )}

      {mode === 'target' && canPlanByDate && (
        <div className="space-y-3">
          {canPlanBodyFat && (
            <SegmentedControl<TargetMetric>
              aria-label={t('goalplan.metric_aria', 'Target type')}
              options={[
                { value: 'weight', label: t('body.metric_weight', 'Weight'), icon: 'scale' },
                { value: 'bodyFat', label: t('body.metric_bf', 'Body fat'), icon: 'ruler' },
              ]}
              value={metric}
              onChange={(m) => {
                setMetric(m);
                setTargetValue('');
              }}
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <DecimalField
              label={
                metric === 'bodyFat'
                  ? t('goalplan.target_bf_label', 'Target body fat')
                  : t('goalplan.target_weight_label', 'Target weight')
              }
              suffix={metric === 'bodyFat' ? '%' : weightLabel(weightUnit)}
              placeholder={
                metric === 'bodyFat'
                  ? String(Math.max(Math.round((bodyFatPercent ?? 20) - 3), minBodyFatPercentFor(biologicalSex)))
                  : String(Math.round(kgToDisplay((currentWeightKg ?? 70) - 5, weightUnit)))
              }
              value={targetValue}
              onValueChange={setTargetValue}
            />
            <div>
              <p className="text-[13px] font-semibold text-ink-2 mb-1.5">
                {t('goalplan.target_date_label', 'By when')}
              </p>
              <input
                type="date"
                value={targetDate}
                min={minDate}
                max={maxDate}
                onChange={(e) => setTargetDate(e.target.value)}
                aria-label={t('goalplan.target_date_label', 'By when')}
                className="w-full h-12 rounded-card bg-inset px-3.5 text-[15px] font-semibold text-ink outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          <p className="text-[12px] text-ink-3">
            {metric === 'bodyFat' && bodyFatPercent !== null
              ? t('goalplan.current_bf', 'Now: {{bf}}% body fat', { bf: bodyFatPercent })
              : t('goalplan.current_weight', 'Now: {{weight}}', { weight: fmtWeight(currentWeightKg!) })}
          </p>

          {/* Plan verdict — the teaching moment of the whole feature. */}
          {target?.state === 'weight-too-low' && (
            <PlanNote tone="danger" icon="alertTriangle">
              {t('goalplan.weight_too_low', 'That weight is below the healthy range for your height (under {{min}}). Pick a target of at least {{min}}.', {
                min: fmtWeight(target.minHealthyKg),
              })}
            </PlanNote>
          )}

          {target?.state === 'bf-too-low' && (
            <PlanNote tone="danger" icon="alertTriangle">
              {t('goalplan.bf_too_low', 'Below {{floor}}% body fat is essential-fat territory and not a safe target. Pick {{floor}}% or higher.', {
                floor: target.floor,
              })}
            </PlanNote>
          )}

          {target?.state === 'bad-date' && (
            <PlanNote tone="info" icon="calendar">
              {t('goalplan.bad_date', 'Pick a date between one week and two years from now.')}
            </PlanNote>
          )}

          {target?.state === 'planned' && (
            <TargetPlanSummary
              plan={target.plan}
              targetKg={target.targetKg}
              targetBf={target.targetBf}
              weightUnit={weightUnit}
              fmtDate={fmtDate}
              fmtWeight={fmtWeight}
              onUseSafeDate={(d) => setTargetDate(d)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function TargetPlanSummary({
  plan,
  targetKg,
  targetBf,
  weightUnit,
  fmtDate,
  fmtWeight,
  onUseSafeDate,
}: {
  plan: TargetPlan;
  targetKg: number;
  targetBf: number | null;
  weightUnit: WeightUnit;
  fmtDate: (d: string) => string;
  fmtWeight: (kg: number) => string;
  onUseSafeDate: (date: string) => void;
}) {
  const { t } = useTranslation();
  const nearMaintenance = Math.abs(plan.kgPerWeek) < 0.05;

  if (plan.verdict !== null) {
    return (
      <PlanNote tone="warning" icon="alertTriangle">
        <span className="block">
          {plan.verdict === 'too-fast-loss'
            ? t('goalplan.too_fast_loss', 'That needs {{pace}}, faster than the safe limit for your body ({{safe}}). Crash pace costs muscle and rebounds.', {
                pace: formatWeightRate(plan.kgPerWeek, weightUnit),
                safe: formatWeightRate(plan.safeKgPerWeek, weightUnit),
              })
            : t('goalplan.too_fast_gain', 'That needs {{pace}}, faster than a lean-gain pace ({{safe}}). Most of the extra would be fat, not muscle.', {
                pace: formatWeightRate(plan.kgPerWeek, weightUnit),
                safe: formatWeightRate(plan.safeKgPerWeek, weightUnit),
              })}
        </span>
        {plan.safeDate && (
          <button
            type="button"
            onClick={() => onUseSafeDate(plan.safeDate!)}
            className="pressable mt-2 inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[12px] font-bold text-ink"
          >
            <Icon name="calendarCheck" size={14} />
            {t('goalplan.use_safe_date', 'Reachable by {{date}}. Use that date', { date: fmtDate(plan.safeDate) })}
          </button>
        )}
      </PlanNote>
    );
  }

  return (
    <div className="rounded-card bg-primary-soft p-3.5">
      <p className="text-[13px] font-bold text-primary-soft-ink">
        {targetBf !== null
          ? t('goalplan.plan_title_bf', '{{bf}}% body fat (about {{weight}}) by {{date}}', {
              bf: targetBf,
              weight: fmtWeight(targetKg),
              date: fmtDate(planDateOf(plan)),
            })
          : t('goalplan.plan_title_weight', '{{weight}} by {{date}}', {
              weight: fmtWeight(targetKg),
              date: fmtDate(planDateOf(plan)),
            })}
      </p>
      <p className="mt-1 text-[13px] text-primary-soft-ink/90 leading-relaxed">
        {/* Same compact notation as the pace preset cards, so the two modes
            read as one system: "-0.42 kg/wk · -460 kcal/day". */}
        {nearMaintenance
          ? t('goalplan.plan_maintenance', 'You are basically there. This works out to maintenance calories.')
          : `${formatWeightRate(plan.kgPerWeek, weightUnit)} · ${t('goalplan.kcal_per_day', '{{kcal}} kcal/day', {
              kcal: formatSignedKcal(plan.kcalPerDay),
            })}`}
      </p>
    </div>
  );
}

// The summary re-derives its date from the plan's week count so the title and
// the pace can never disagree with each other after rounding.
function planDateOf(plan: TargetPlan): string {
  return addDays(toDateString(), Math.round(plan.weeks * 7));
}

function PlanNote({
  tone,
  icon,
  children,
}: {
  tone: 'info' | 'warning' | 'danger';
  icon: 'alertTriangle' | 'calendar' | 'info';
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-card p-3.5 flex items-start gap-2.5',
        tone === 'warning' && 'bg-warning-soft',
        tone === 'danger' && 'bg-danger-soft',
        tone === 'info' && 'bg-inset',
      )}
    >
      <Icon
        name={icon}
        size={16}
        className={cn(
          'shrink-0 mt-0.5',
          tone === 'warning' && 'text-warning',
          tone === 'danger' && 'text-danger',
          tone === 'info' && 'text-ink-3',
        )}
      />
      <div
        className={cn(
          'text-[13px] leading-relaxed',
          tone === 'warning' && 'text-warning',
          tone === 'danger' && 'text-danger',
          tone === 'info' && 'text-ink-2',
        )}
      >
        {children}
      </div>
    </div>
  );
}
