import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { DecimalField, Field } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ProgressBar } from '@/components/ui/Progress';
import { Icon, type IconName } from '@/components/ui/Icon';
import { InlineError } from '@/components/ui/States';
import { useAuth } from '@/hooks/useAuth';
import { useUnits } from '@/hooks/useUnits';
import { profileService } from '@/services/profileService';
import { queryKeys } from '@/lib/queryKeys';
import { displayToKg, weightLabel, kgToDisplay } from '@/utils/units';
import {
  GOAL_PRESETS,
  formatKgPerWeekShort,
  type GoalPresetKey,
} from '@/utils/goalUtils';
import { PROTEIN_PRESETS, getAgeProteinMinimum, type ProteinPresetId } from '@/config/proteinPresets';
import { extractApiError } from '@/utils/apiError';
import { cn } from '@/utils/cn';

/**
 * Onboarding wizard. Endowed progress: the bar starts at 25% because
 * creating the account already counts as the first step. Each screen
 * offers a handful of obvious choices with a recommended smart default
 * preselected, so finishing takes under a minute.
 */

const GOAL_KEYS: GoalPresetKey[] = ['lose-fast', 'lose-moderate', 'lose-slow', 'maintain', 'gain'];
const TOTAL_STEPS = 4; // account (done), body, goal, protein

const num = (raw: string): number | null => {
  if (raw.trim() === '') return null;
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export default function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const { weightUnit } = useUnits();

  const [step, setStep] = useState(0); // 0=body, 1=goal, 2=protein, 3=summary
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'M' | 'F' | ''>('');
  const [goalKey, setGoalKey] = useState<GoalPresetKey>('lose-moderate');
  const [proteinId, setProteinId] = useState<ProteinPresetId>('everyday');
  const [error, setError] = useState<string | null>(null);

  const w = num(weight);
  const h = num(height);
  const a = num(age);
  const weightKg = w !== null ? Math.round(displayToKg(w, weightUnit) * 10) / 10 : null;

  const goal = GOAL_PRESETS.find((p) => p.key === goalKey)!;
  const proteinPreset = PROTEIN_PRESETS.find((p) => p.id === proteinId)!;
  const proteinGrams =
    weightKg !== null
      ? Math.round(weightKg * Math.max(proteinPreset.gramsPerKg, getAgeProteinMinimum(a ?? 30)))
      : null;

  // Local preview with the same formulas the server uses (Mifflin-St Jeor)
  const bmrPreview = (() => {
    if (weightKg === null || h === null) return null;
    const offset = sex === 'M' ? 5 : sex === 'F' ? -161 : -78;
    return Math.round(10 * weightKg + 6.25 * h - 5 * (a ?? 30) + offset);
  })();
  const maintenancePreview = bmrPreview !== null && weightKg !== null
    ? Math.round(bmrPreview + 4.8 * weightKg)
    : null;
  const budgetPreview = maintenancePreview !== null
    ? maintenancePreview + Number(goal.kcal)
    : null;

  const save = useMutation({
    mutationFn: () =>
      profileService
        .update({
          currentWeightKg: weightKg,
          heightCm: h,
          age: a,
          biologicalSex: sex,
          autoCalculateBMR: true,
          autoCalculateBodyFat: true,
          dailyBaseGoalKcal: Number(goal.kcal),
          proteinGoalGrams: proteinGrams,
          autoCalculateProteinGoal: proteinGrams === null,
          calorieDisplayMode: 'adjusted',
          minCaloriesSafeguardEnabled: true,
          sleepHours: 8,
          neatHours: 3,
        })
        .then((r) => r.data),
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.profile(), profile);
      navigate('/today', { replace: true });
    },
    onError: (err) =>
      setError(extractApiError(err, t('onboarding.save_error', 'Could not save your profile. Check your connection and try again.'))),
  });

  const stepValid =
    step !== 0 ||
    ((w === null || (w > 0 && w < 1200)) &&
      (h === null || (h > 0 && h < 300)) &&
      (a === null || (a >= 1 && a <= 150)));

  const progress = (step + 1) / (TOTAL_STEPS + 1);

  return (
    <main className="mx-auto max-w-md min-h-dvh px-5 pt-6 pb-10 pt-safe flex flex-col">
      <header className="flex items-center gap-3">
        {step > 0 ? (
          <IconButton icon="arrowLeft" label={t('common.back', 'Back')} onClick={() => setStep(step - 1)} />
        ) : (
          <span className="w-11" />
        )}
        <div className="flex-1">
          <ProgressBar progress={progress} label={t('onboarding.progress_aria', 'Setup progress')} />
        </div>
        <button
          type="button"
          className="pressable text-[13px] font-semibold text-ink-3 px-1"
          onClick={() => logout()}
        >
          {t('profile.row_logout', 'Sign out')}
        </button>
      </header>
      <p className="mt-2 text-[12px] font-semibold text-primary-soft-ink text-center">
        {step < 3
          ? t('onboarding.progress_note', 'Account created. You are already {{pct}}% done.', {
              pct: Math.round(progress * 100),
            })
          : t('onboarding.progress_almost', 'Almost there, one tap to go')}
      </p>

      <div className="flex-1 mt-6">
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-extrabold text-ink">
                {t('onboarding.body_title', 'A little about you')}
              </h1>
              <p className="text-sm text-ink-2 mt-1">
                {t('onboarding.body_sub', 'This sizes your daily calorie budget. You can change everything later.')}
              </p>
            </div>
            <Card className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <DecimalField
                  label={t('profile.weight', 'Weight')}
                  suffix={weightLabel(weightUnit)}
                  placeholder={weightUnit === 'lbs' ? '155' : '70'}
                  value={weight}
                  onValueChange={setWeight}
                />
                <DecimalField
                  label={t('profile.height', 'Height')}
                  suffix="cm"
                  placeholder="175"
                  value={height}
                  onValueChange={setHeight}
                />
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
            </Card>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-extrabold text-ink">
                {t('onboarding.goal_title', 'What is your goal?')}
              </h1>
              <p className="text-sm text-ink-2 mt-1">
                {t('onboarding.goal_sub', 'Most members pick a steady pace. Slow and consistent wins.')}
              </p>
            </div>
            <div className="space-y-2" role="radiogroup" aria-label={t('onboarding.goal_title', 'What is your goal?')}>
              {GOAL_KEYS.map((key) => {
                const p = GOAL_PRESETS.find((g) => g.key === key)!;
                const active = goalKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setGoalKey(key)}
                    className={cn(
                      'pressable w-full rounded-card px-4 py-3 text-left flex items-center gap-3',
                      active ? 'bg-primary-soft ring-2 ring-primary/60' : 'bg-card',
                    )}
                  >
                    <span className="flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-[15px] font-bold text-ink">{t(`goal.${p.key}`, p.label)}</span>
                        {key === 'lose-moderate' && (
                          <span className="text-[10px] font-extrabold uppercase tracking-wide bg-primary text-on-primary rounded-full px-2 py-0.5">
                            {t('onboarding.goal_popular', '62% choose this')}
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
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-extrabold text-ink">
                {t('onboarding.protein_title', 'Protein matters too')}
              </h1>
              <p className="text-sm text-ink-2 mt-1">
                {t('onboarding.protein_sub', 'It keeps you full and protects muscle. Pick what fits your routine.')}
              </p>
            </div>
            <div className="space-y-2" role="radiogroup" aria-label={t('onboarding.protein_title', 'Protein matters too')}>
              {PROTEIN_PRESETS.map((p) => {
                const active = proteinId === p.id;
                const grams =
                  weightKg !== null
                    ? Math.round(weightKg * Math.max(p.gramsPerKg, getAgeProteinMinimum(a ?? 30)))
                    : null;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setProteinId(p.id)}
                    className={cn(
                      'pressable w-full rounded-card px-4 py-3 text-left flex items-center gap-3',
                      active ? 'bg-primary-soft ring-2 ring-primary/60' : 'bg-card',
                    )}
                  >
                    <span className="flex-1">
                      <span className="text-[15px] font-bold text-ink">{t(`protein.${p.id}`, p.label)}</span>
                      <span className="block text-[12px] text-ink-2 mt-0.5">
                        {p.gramsPerKg} g/kg{grams !== null ? ` = ${grams} g` : ''}
                      </span>
                    </span>
                    {active && <Icon name="checkCircle" size={20} className="text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="text-center">
              <span className="inline-flex w-14 h-14 rounded-2xl bg-primary-soft text-primary-soft-ink items-center justify-center animate-pop">
                <Icon name="checkCircle" size={28} />
              </span>
              <h1 className="mt-3 text-xl font-extrabold text-ink">
                {t('onboarding.summary_title', 'Your plan is ready')}
              </h1>
              <p className="text-sm text-ink-2 mt-1">
                {t('onboarding.summary_sub', 'Here is what your week looks like. Log your first meal to make it real.')}
              </p>
            </div>
            <Card className="space-y-3">
              <SummaryRow
                icon="target"
                label={t('onboarding.summary_goal', 'Goal')}
                value={t(`goal.${goal.key}`, goal.label)}
              />
              {budgetPreview !== null && (
                <SummaryRow
                  icon="chart"
                  label={t('onboarding.summary_budget', 'Daily budget')}
                  value={`~${budgetPreview.toLocaleString()} kcal`}
                />
              )}
              {proteinGrams !== null && (
                <SummaryRow
                  icon="zap"
                  label={t('onboarding.summary_protein', 'Protein target')}
                  value={`${proteinGrams} g`}
                />
              )}
              {weightKg !== null && (
                <SummaryRow
                  icon="scale"
                  label={t('profile.weight', 'Weight')}
                  value={`${Math.round(kgToDisplay(weightKg, weightUnit) * 10) / 10} ${weightLabel(weightUnit)}`}
                />
              )}
              {budgetPreview === null && (
                <p className="text-[13px] text-ink-2 leading-relaxed">
                  {t('onboarding.summary_no_body', 'You skipped your body details, so your budget stays locked for now. Add them any time in Profile.')}
                </p>
              )}
            </Card>
          </div>
        )}
      </div>

      {error && <InlineError message={error} className="mb-2" />}

      <div className="mt-6">
        {step < 3 ? (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!stepValid}
            onClick={() => setStep(step + 1)}
          >
            {t('common.continue', 'Continue')}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            {t('onboarding.finish', 'Start tracking')}
          </Button>
        )}
        {step === 0 && (
          <button
            type="button"
            className="pressable w-full text-center text-[13px] font-semibold text-ink-3 py-3 mt-1"
            onClick={() => setStep(1)}
          >
            {t('onboarding.skip_body', 'Skip for now')}
          </button>
        )}
      </div>
    </main>
  );
}

function SummaryRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 h-8 rounded-xl bg-inset text-ink-2 flex items-center justify-center shrink-0">
        <Icon name={icon} size={16} />
      </span>
      <span className="flex-1 text-[14px] font-semibold text-ink-2">{label}</span>
      <span className="text-[15px] font-bold text-ink">{value}</span>
    </div>
  );
}
