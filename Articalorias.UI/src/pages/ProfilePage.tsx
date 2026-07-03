import { useEffect, useState, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { profileService } from "@/services/profileService";
import { dailyLogService } from "@/services/dailyLogService";
import type { UserProfileRequest, UserProfileResponse } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import { extractApiError } from "@/utils/apiError";
import { kgPerWeekToKcal } from "@/utils/goalUtils";
import { useUnits } from "@/hooks/useUnits";
import { weightLabel, energyRateLabel, kgToDisplay, displayToKg, kcalToDisplay, displayToKcal } from "@/utils/units";
import GoalSelector from "@/components/goal/GoalSelector";
import { PROTEIN_PRESETS, getAgeProteinMinimum } from "@/config/proteinPresets";
import ProteinPresetSelector from "@/components/protein/ProteinPresetSelector";
import type { ProteinPresetId } from "@/config/proteinPresets";
import { queryKeys } from "@/lib/queryKeys";
import { toDateString } from "@/utils/format";
import StreakDetail from "@/components/StreakDetail";

type FormState = {
  currentWeightKg: string;
  heightCm: string;
  age: string;
  biologicalSex: string;
  bmrKcal: string;
  bodyFatPercent: string;
  autoCalculateBMR: boolean;
  autoCalculateBodyFat: boolean;
  dailyBaseGoalKcal: string;
  proteinGoalGrams: string;
  proteinPresetId: string;  // one of ProteinPresetId or "" for custom
  autoCalculateProteinGoal: boolean;
  country: string;
  calorieDisplayMode: 'net' | 'goal' | 'adjusted';
  minCaloriesSafeguardEnabled: boolean;
  // Sleep & NEAT
  sleepHours: string;
  neatHours: string;
};

const emptyForm: FormState = {
  currentWeightKg: "", heightCm: "", age: "", biologicalSex: "",
  bmrKcal: "", bodyFatPercent: "", autoCalculateBMR: true, autoCalculateBodyFat: true,
  dailyBaseGoalKcal: String(kgPerWeekToKcal(-0.50)), proteinGoalGrams: "",
  proteinPresetId: "muscle-gain", autoCalculateProteinGoal: true, country: "",
  calorieDisplayMode: "adjusted",
  minCaloriesSafeguardEnabled: true,
  sleepHours: "8", neatHours: "3",
};


/**
 * Reverse-engineers which preset produced the stored proteinGoalGrams by
 * checking Math.round(weight × gramsPerKg) against the stored value — the
 * same formula used in handlePresetClick and on the backend.
 * Returns the matching preset id, or "" when the value is truly custom.
 */
function detectProteinPresetId(data: UserProfileResponse): string {
  if (data.autoCalculateProteinGoal) return "muscle-gain";
  if (data.proteinGoalGrams == null) return "";
  if (data.currentWeightKg == null) return "";
  const weight = Number(data.currentWeightKg);
  if (weight <= 0) return "";
  const storedGrams = Math.round(Number(data.proteinGoalGrams));
  const ageMin = data.age != null ? getAgeProteinMinimum(data.age) : 0;
  const match = PROTEIN_PRESETS.find(
    (p) => Math.round(weight * Math.max(p.gramsPerKg, ageMin)) === storedGrams,
  );
  return match?.id ?? "";
}

function toFormState(data: UserProfileResponse): FormState {
  const goalKcalStr = String(data.dailyBaseGoalKcal);
  return {
    currentWeightKg: data.currentWeightKg != null ? String(data.currentWeightKg) : "",
    heightCm: data.heightCm != null ? String(data.heightCm) : "",
    age: data.age != null ? String(data.age) : "",
    biologicalSex: data.biologicalSex ?? "",
    bmrKcal: String(data.bmrKcal),
    bodyFatPercent: data.bodyFatPercent != null ? String(data.bodyFatPercent) : "",
    autoCalculateBMR: data.autoCalculateBMR,
    autoCalculateBodyFat: data.autoCalculateBodyFat,
    dailyBaseGoalKcal: goalKcalStr,
    proteinGoalGrams: data.proteinGoalGrams != null ? String(data.proteinGoalGrams) : "",
    proteinPresetId: detectProteinPresetId(data),
    autoCalculateProteinGoal: data.autoCalculateProteinGoal,
    country: data.country ?? "",
    calorieDisplayMode: data.calorieDisplayMode,
    minCaloriesSafeguardEnabled: data.minCaloriesSafeguardEnabled,
    sleepHours: String(data.sleepHours),
    neatHours: String(data.neatHours),
  };
}

function buildRequest(f: FormState): UserProfileRequest {
  return {
    currentWeightKg: f.currentWeightKg ? parseFloat(f.currentWeightKg) : null,
    heightCm: f.heightCm ? parseFloat(f.heightCm) : null,
    age: f.age ? parseInt(f.age) : null,
    biologicalSex: f.biologicalSex || null,
    bmrKcal: f.bmrKcal ? parseFloat(f.bmrKcal) : null,
    bodyFatPercent: f.bodyFatPercent ? parseFloat(f.bodyFatPercent) : null,
    autoCalculateBMR: f.autoCalculateBMR,
    autoCalculateBodyFat: f.autoCalculateBodyFat,
    dailyBaseGoalKcal: f.dailyBaseGoalKcal ? parseFloat(f.dailyBaseGoalKcal) : null,
    proteinGoalGrams: f.proteinGoalGrams ? parseFloat(f.proteinGoalGrams) : null,
    autoCalculateProteinGoal: f.autoCalculateProteinGoal,
    country: f.country || null,
    calorieDisplayMode: f.calorieDisplayMode,
    minCaloriesSafeguardEnabled: f.minCaloriesSafeguardEnabled,
    sleepHours: parseFloat(f.sleepHours) || 8,
    neatHours: parseFloat(f.neatHours) || 3,
  };
}

function validateAll(f: FormState, t: (key: string) => string): Record<string, string> {
  const errors: Record<string, string> = {};
  const weight = parseFloat(f.currentWeightKg);
  const height = parseFloat(f.heightCm);
  if (f.currentWeightKg && (isNaN(weight) || weight <= 0)) errors.currentWeightKg = t('profile.validation_weight_empty');
  else if (f.currentWeightKg && weight > 500) errors.currentWeightKg = t('profile.validation_weight_high');
  if (f.heightCm && (isNaN(height) || height <= 0)) errors.heightCm = t('profile.validation_height_empty');
  else if (f.heightCm && height > 300) errors.heightCm = t('profile.validation_height_high');
  if (f.age) { const age = parseInt(f.age); if (age < 1) errors.age = t('profile.validation_age_low'); else if (age > 150) errors.age = t('profile.validation_age_high'); }
  if (!f.autoCalculateBMR) {
    const bmr = parseFloat(f.bmrKcal);
    if (!f.bmrKcal || isNaN(bmr) || bmr <= 0) errors.bmrKcal = t('profile.validation_bmr_empty');
    else if (bmr < 500) errors.bmrKcal = t('profile.validation_bmr_low');
    else if (bmr > 10000) errors.bmrKcal = t('profile.validation_bmr_high');
  }
  if (!f.autoCalculateBodyFat) {
    const bf = parseFloat(f.bodyFatPercent);
    if (!f.bodyFatPercent || isNaN(bf)) errors.bodyFatPercent = t('profile.validation_bf_empty');
    else if (bf < 3) errors.bodyFatPercent = t('profile.validation_bf_low');
    else if (bf > 60) errors.bodyFatPercent = t('profile.validation_bf_high');
  }
  const sleepH = parseFloat(f.sleepHours);
  const neatH  = parseFloat(f.neatHours);
  if (isNaN(sleepH) || sleepH < 0 || sleepH > 23) errors.sleepHours = t('profile.validation_sleep_range');
  if (isNaN(neatH)  || neatH  < 0 || neatH  > 23) errors.neatHours  = t('profile.validation_neat_range');
  if (!isNaN(sleepH) && !isNaN(neatH) && sleepH + neatH > 23) {
    errors.sleepHours = t('profile.validation_sleep_neat_exceed');
    errors.neatHours  = t('profile.validation_sleep_neat_exceed');
  }
  return errors;
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const { weightUnit, energyUnit } = useUnits();
  const queryClientInstance = useQueryClient();
  const profileQuery = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => profileService.get().then(r => r.data),
    staleTime: 15 * 60 * 1000,
  });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState<FormState>(emptyForm);
  const [original, setOriginal] = useState<FormState>(emptyForm);
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());
  const [savingField, setSavingField] = useState<string | null>(null);

  const [showAdvanced, setShowAdvanced] = useState(false);

  // Initialize form once when profile data first arrives; skip on background refetches
  // to avoid clobbering in-progress edits.
  const isFormInitialized = useRef(false);
  useEffect(() => {
    if (profileQuery.data && !isFormInitialized.current) {
      isFormInitialized.current = true;
      const f = toFormState(profileQuery.data);
      setForm(f);
      setOriginal(f);
      setShowAdvanced(!profileQuery.data.autoCalculateBMR || !profileQuery.data.autoCalculateBodyFat);
    }
  }, [profileQuery.data]);

  function setField(field: keyof FormState, value: string | boolean, orig: FormState = original) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      setDirtyFields((prevDirty) => {
        const d = new Set(prevDirty);
        if (String(next[field]) !== String(orig[field])) d.add(field);
        else d.delete(field);
        return d;
      });
      return next;
    });
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function revertField(field: keyof FormState) {
    setForm((prev) => ({ ...prev, [field]: original[field] }));
    setDirtyFields((prev) => { const d = new Set(prev); d.delete(field); return d; });
    setFieldErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
  }

  /**
   * Refreshes today's DailyLog snapshot fields from the current profile, then
   * invalidates the dashboard and history caches so the Today page immediately
   * reflects the new calorie goal (or any other profile change).
   *
   * Also fires a background call to fix any historical DailyLogs whose weight /
   * height snapshots were null (i.e. created before the user completed their
   * profile). This heals the "Missing profile details" banner in History without
   * any extra user action. The call is fire-and-forget; history is re-invalidated
   * when it completes so rows update automatically.
   *
   * Error policy: all sub-calls are swallowed on failure — they are non-critical
   * and self-correct on the next food/activity mutation (Constitution X).
   */
  async function refreshTodaySnapshot() {
    const today = toDateString(); // local YYYY-MM-DD — must match queryKeys.dashboard(today)
    try {
      await dailyLogService.refreshSnapshot(today);
    } catch {
      // Non-critical — snapshot will correct itself on next food/activity log.
    }
    queryClientInstance.invalidateQueries({ queryKey: queryKeys.dashboard(today) });
    queryClientInstance.invalidateQueries({ queryKey: queryKeys.historyAll() });

    // Silently heal historical logs that were created before weight/height were set.
    dailyLogService.refreshStaleSnapshots()
      .then(() => queryClientInstance.invalidateQueries({ queryKey: queryKeys.historyAll() }))
      .catch(() => {});
  }

  async function confirmField(field: keyof FormState) {
    const errors = validateAll(form, t);
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    setError(null);
    setSavingField(field);
    try {
      const { data: updated } = await profileService.update(buildRequest(form));
      const newForm = toFormState(updated);
      setForm(newForm);
      setOriginal(newForm);
      setDirtyFields((prev) => { const d = new Set(prev); d.delete(field); return d; });
      queryClientInstance.setQueryData(queryKeys.profile(), updated);
      await refreshTodaySnapshot();
    } catch (err) {
      setError(extractApiError(err, t('profile.failed_save')));
    } finally {
      setSavingField(null);
    }
  }

  async function saveImmediate(overrideForm: FormState) {
    const errors = validateAll(overrideForm, t);
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    setError(null);
    setSavingField("__immediate__");
    try {
      const { data: updated } = await profileService.update(buildRequest(overrideForm));
      // toFormState can't recover proteinPresetId from the server response (the server
      // only stores proteinGoalGrams / autoCalculateProteinGoal, not which preset was
      // selected). Preserve it from overrideForm so the scale stays highlighted.
      const newForm = { ...toFormState(updated), proteinPresetId: overrideForm.proteinPresetId };
      setForm(newForm);
      setOriginal(newForm);
      setDirtyFields(new Set());
      queryClientInstance.setQueryData(queryKeys.profile(), updated);
      await refreshTodaySnapshot();
    } catch (err) {
      setError(extractApiError(err, t('profile.failed_save')));
    } finally {
      setSavingField(null);
    }
  }

  const isSaving = savingField !== null;

  const estimate = useMemo(() => {
    const weight = parseFloat(form.currentWeightKg);
    const height = parseFloat(form.heightCm);
    const age = parseInt(form.age);
    const sex = form.biologicalSex;
    if (!weight || !height || !age) return null;
    // Neutral offset (-78) is the midpoint of male (+5) and female (-161),
    // matching the backend's ApplyAutoCalculations fallback.
    const sexOffset = sex === "M" ? 5 : sex === "F" ? -161 : -78;
    const bmr = Math.round(10 * weight + 6.25 * height - 5 * age + sexOffset);
    const maintenance = Math.round(bmr + 4.8 * weight);
    const goalKcal = parseFloat(form.dailyBaseGoalKcal) || 0;
    const dailyTarget = Math.round(maintenance + goalKcal);
    // Body-fat (Deurenberg) requires a known sex; skip it for "Prefer not to say".
    if (!sex) return { maintenance, dailyTarget, bmr, bodyFat: null };
    const heightM = height / 100;
    const bmi = weight / (heightM * heightM);
    const sexFactor = sex === "M" ? 1 : 0;
    const bodyFat = Math.round((1.20 * bmi + 0.23 * age - 10.8 * sexFactor - 5.4) * 10) / 10;
    return { maintenance, dailyTarget, bmr, bodyFat: bodyFat >= 0 && bodyFat <= 100 ? bodyFat : null };
  }, [form.currentWeightKg, form.heightCm, form.age, form.biologicalSex, form.dailyBaseGoalKcal]);

  if (profileQuery.isPending) return <LoadingSpinner />;
  if (profileQuery.isError && form === emptyForm) return <ErrorMessage message={t('profile.failed_load')} />;

  return (
    <div className="space-y-3 w-full min-w-0">
      <div className="space-y-3">
        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>
        )}

        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm divide-y divide-gray-100 dark:divide-gray-800 w-full min-w-0 overflow-x-hidden">

          {/* ── Basic details ── */}
          <div className="p-4 sm:p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('profile.section_basic')}</h2>
                <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{t('profile.section_basic_subtitle')}</p>
              </div>
              <span className="shrink-0 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-medium text-gray-400 dark:text-gray-500">
                {t('profile.required')}
              </span>
            </div>

            {/* 2×2 metric tile grid */}
            <div className="grid grid-cols-2 gap-2">

              {/* Weight */}
              <MetricTile
                label={t('profile.field_weight')}
                inputId="field-weight"
                type="text"
                step="0.1"
                inputMode="decimal"
                pattern="[0-9]*[.,]?[0-9]*"
                value={weightUnit === "lbs" ? (form.currentWeightKg ? String(Math.round(kgToDisplay(parseFloat(form.currentWeightKg), "lbs") * 10) / 10) : "") : form.currentWeightKg}
                unit={weightLabel(weightUnit)}
                dirty={dirtyFields.has("currentWeightKg")}
                saving={savingField === "currentWeightKg"}
                error={fieldErrors.currentWeightKg}
                disabled={isSaving}
                ariaLabel={t('profile.aria_weight')}
                onChange={(v) => setField("currentWeightKg", weightUnit === "lbs" ? (v ? String(displayToKg(parseFloat(v), "lbs")) : "") : v)}
                onConfirm={() => confirmField("currentWeightKg")}
                onRevert={() => revertField("currentWeightKg")}
              />

              {/* Height */}
              <MetricTile
                label={t('profile.field_height')}
                inputId="field-height"
                type="text"
                step="0.1"
                inputMode="decimal"
                pattern="[0-9]*[.,]?[0-9]*"
                value={form.heightCm}
                unit="cm"
                dirty={dirtyFields.has("heightCm")}
                saving={savingField === "heightCm"}
                error={fieldErrors.heightCm}
                disabled={isSaving}
                ariaLabel={t('profile.aria_height')}
                onChange={(v) => setField("heightCm", v)}
                onConfirm={() => confirmField("heightCm")}
                onRevert={() => revertField("heightCm")}
              />

              {/* Age */}
              <MetricTile
                label={t('profile.field_age')}
                inputId="field-age"
                type="text"
                step="1"
                inputMode="numeric"
                pattern="[0-9]*"
                value={form.age}
                unit="yrs"
                dirty={dirtyFields.has("age")}
                saving={savingField === "age"}
                error={fieldErrors.age}
                disabled={isSaving}
                ariaLabel={t('profile.aria_age')}
                required={false}
                onChange={(v) => setField("age", v)}
                onConfirm={() => confirmField("age")}
                onRevert={() => revertField("age")}
              />

              {/* Sex — auto-saves on change, no confirm/revert */}
              <div className={[
                "rounded-xl border p-3 transition-colors",
                fieldErrors.biologicalSex
                  ? "border-red-300 dark:border-red-700 bg-red-50/40 dark:bg-red-900/10"
                  : "border-border bg-surface-muted",
              ].join(" ")}>
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">{t('profile.field_sex')}</span>
                <div className="relative mt-2">
                  <select
                    value={form.biologicalSex}
                    onChange={(e) => {
                      const newForm = { ...form, biologicalSex: e.target.value };
                      setForm(newForm);
                      saveImmediate(newForm);
                    }}
                    disabled={isSaving}
                    aria-label={t('profile.aria_sex')}
                    aria-required="false"
                    className="w-full appearance-none bg-transparent border-0 p-0 pr-5 text-2xl font-bold text-fg-primary focus:ring-0 focus:outline-none disabled:opacity-50"
                  >
                    <option value="">{t('common.prefer_not_to_say')}</option>
                    <option value="M">{t('common.male')}</option>
                    <option value="F">{t('common.female')}</option>
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center text-fg-subtle" aria-hidden="true">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                  </span>
                </div>
                {fieldErrors.biologicalSex && (
                  <p className="mt-1.5 text-[10px] leading-tight text-red-500">{fieldErrors.biologicalSex}</p>
                )}
              </div>

            </div>
          </div>

          {/* ── Your goal ── */}
          <div className="p-4 sm:p-5 space-y-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('profile.section_goal')}</h2>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{t('profile.section_goal_subtitle')}</p>
            </div>

            <GoalSelector
              selectedKcal={form.dailyBaseGoalKcal}
              onGoalChange={(kcal) => {
                const newForm = { ...form, dailyBaseGoalKcal: kcal };
                setForm(newForm);
                saveImmediate(newForm);
              }}
              disabled={isSaving}
            />
          </div>

          {/* ── Your protein target ── */}
          <div className="p-4 sm:p-5 space-y-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('profile.section_protein')}</h2>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{t('profile.section_protein_subtitle')}</p>
            </div>

            <ProteinPresetSelector
              savedPresetId={form.proteinPresetId}
              savedGrams={form.proteinGoalGrams}
              weightKg={form.currentWeightKg}
              goalKcal={form.dailyBaseGoalKcal}
              age={form.age}
              disabled={isSaving}
              onPresetSelect={(presetId: ProteinPresetId, computedGrams: string) => {
                const newForm: FormState = {
                  ...form,
                  proteinPresetId: presetId,
                  proteinGoalGrams: computedGrams,
                  autoCalculateProteinGoal: false,
                };
                setForm(newForm);
                saveImmediate(newForm);
              }}
              onCustomApply={(grams: string) => {
                const newForm: FormState = {
                  ...form,
                  proteinPresetId: "",
                  proteinGoalGrams: grams,
                  autoCalculateProteinGoal: false,
                };
                setForm(newForm);
                saveImmediate(newForm);
              }}
            />
          </div>

          {/* ── Personalization ── */}
          <div className="p-4 sm:p-5 space-y-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('profile.section_personalization')}</h2>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{t('profile.section_personalization_subtitle')}</p>
            </div>

            <FieldWrap
              label={<>{t('profile.field_country_optional')}</>}
              dirty={dirtyFields.has("country")}
              saving={savingField === "country"}
              onConfirm={() => confirmField("country")}
              onRevert={() => revertField("country")}
              hint={t('profile.country_hint')}
            >
              <input
                type="text"
                value={form.country}
                onChange={(e) => setField("country", e.target.value)}
                disabled={isSaving}
                placeholder={t('profile.country_placeholder')}
                className={fieldCls(false, dirtyFields.has("country"))}
              />
            </FieldWrap>
          </div>

          {/* ── Sleep & NEAT ── */}
          <div className="p-4 sm:p-5 space-y-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('profile.section_sleep')}</h2>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                {t('profile.section_sleep_subtitle')}
              </p>
            </div>

            {(() => {
              const sh = parseFloat(form.sleepHours);
              const nh = parseFloat(form.neatHours);
              if (!isNaN(sh) && !isNaN(nh) && sh + nh > 23) {
                return (
                  <p className="text-xs text-amber-500">
                    {t('profile.sleep_neat_warning', { n: (sh + nh).toFixed(1) })}
                  </p>
                );
              }
              return null;
            })()}

            <FieldWrap
              label={t('profile.sleep_hours_label')}
              dirty={dirtyFields.has("sleepHours")}
              saving={savingField === "sleepHours"}
              onConfirm={() => confirmField("sleepHours")}
              onRevert={() => revertField("sleepHours")}
              error={fieldErrors.sleepHours}
            >
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.,]?[0-9]*"
                  min={0} max={23}
                  value={form.sleepHours}
                  onChange={(e) => setField("sleepHours", e.target.value)}
                  disabled={isSaving}
                  className={suffixInputCls(!!fieldErrors.sleepHours, dirtyFields.has("sleepHours"))}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-400 dark:text-gray-500">{t('common.hrs')}</span>
              </div>
            </FieldWrap>

            <FieldWrap
              label={t('profile.neat_hours_label')}
              dirty={dirtyFields.has("neatHours")}
              saving={savingField === "neatHours"}
              onConfirm={() => confirmField("neatHours")}
              onRevert={() => revertField("neatHours")}
              error={fieldErrors.neatHours}
              hint={t('profile.neat_hint')}
            >
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.,]?[0-9]*"
                  min={0} max={23}
                  value={form.neatHours}
                  onChange={(e) => setField("neatHours", e.target.value)}
                  disabled={isSaving}
                  className={suffixInputCls(!!fieldErrors.neatHours, dirtyFields.has("neatHours"))}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-400 dark:text-gray-500">{t('common.hrs')}</span>
              </div>
            </FieldWrap>
          </div>

          {/* ── Advanced estimates ── */}
          <div className="p-4 sm:p-5 space-y-3">
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('profile.section_advanced')}</h2>
                <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{t('profile.section_advanced_subtitle')}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="self-start sm:shrink-0 flex items-center gap-1 rounded px-2 py-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:bg-indigo-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-expanded={showAdvanced}
                aria-controls="advanced-estimates-content"
              >
                <svg className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                {showAdvanced ? t('profile.advanced_hide') : t('profile.advanced_show')}
              </button>
            </div>

            {showAdvanced && (
              <div id="advanced-estimates-content" className="divide-y divide-gray-100 dark:divide-gray-800 rounded-lg border border-gray-100 dark:border-gray-800 w-full min-w-0 overflow-x-hidden">
                <CalculatedEstimateRow
                  label={t('profile.bmr_label')}
                  explanation={t('profile.bmr_explanation')}
                  value={
                    !form.autoCalculateBMR
                      ? (form.bmrKcal ? `${Math.round(kcalToDisplay(parseFloat(form.bmrKcal), energyUnit)).toLocaleString()} ${energyRateLabel(energyUnit)}` : null)
                      : (estimate ? `${Math.round(kcalToDisplay(estimate.bmr, energyUnit)).toLocaleString()} ${energyRateLabel(energyUnit)}` : null)
                  }
                  isCustom={!form.autoCalculateBMR}
                  disabled={isSaving}
                  onSwitchToCustom={() => setField("autoCalculateBMR", false)}
                  onRevertToAuto={() => {
                    const newForm = { ...form, autoCalculateBMR: true };
                    setForm(newForm);
                    saveImmediate(newForm);
                  }}
                  inputStep="1"
                  inputMode="numeric"
                  inputValue={energyUnit === "kJ" ? String(Math.round(kcalToDisplay(parseFloat(form.bmrKcal) || 0, "kJ"))) : form.bmrKcal}
                  inputPlaceholder={t('profile.bmr_placeholder')}
                  unit={energyRateLabel(energyUnit)}
                  onInputChange={(v) => setField("bmrKcal", energyUnit === "kJ" ? String(displayToKcal(parseFloat(v) || 0, "kJ")) : v)}
                  isDirty={dirtyFields.has("bmrKcal")}
                  isSaving={savingField === "bmrKcal"}
                  error={fieldErrors.bmrKcal}
                  onConfirm={() => confirmField("bmrKcal")}
                  onRevert={() => { revertField("bmrKcal"); revertField("autoCalculateBMR"); }}
                />

                <CalculatedEstimateRow
                  label={t('profile.body_fat_label')}
                  explanation={t('profile.body_fat_explanation')}
                  value={
                    !form.autoCalculateBodyFat
                      ? (form.bodyFatPercent ? `${parseFloat(form.bodyFatPercent).toFixed(1)}%` : null)
                      : (estimate?.bodyFat != null ? `${estimate.bodyFat.toFixed(1)}%` : null)
                  }
                  isCustom={!form.autoCalculateBodyFat}
                  disabled={isSaving}
                  onSwitchToCustom={() => setField("autoCalculateBodyFat", false)}
                  onRevertToAuto={() => {
                    const newForm = { ...form, autoCalculateBodyFat: true };
                    setForm(newForm);
                    saveImmediate(newForm);
                  }}
                  inputStep="0.1"
                  inputMode="decimal"
                  inputValue={form.bodyFatPercent}
                  inputPlaceholder={t('profile.body_fat_placeholder')}
                  unit="%"
                  onInputChange={(v) => setField("bodyFatPercent", v)}
                  isDirty={dirtyFields.has("bodyFatPercent")}
                  isSaving={savingField === "bodyFatPercent"}
                  error={fieldErrors.bodyFatPercent}
                  onConfirm={() => confirmField("bodyFatPercent")}
                  onRevert={() => { revertField("bodyFatPercent"); revertField("autoCalculateBodyFat"); }}
                />
              </div>
            )}
          </div>

          {/* plan section removed */}
        </section>
      </div>

      <StreakDetail />
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

// ── CalculatedEstimateRow ─────────────────────────────────────────────────

interface CalculatedEstimateRowProps {
  label: string;
  explanation: string;
  /** Formatted value without the "~" prefix, e.g. "1,721 kcal/day" or "17.4%". Null while profile data is incomplete. */
  value: string | null;
  /** True when the user has an active manual override (autoCalculate = false). */
  isCustom: boolean;
  disabled: boolean;
  /** Called when user clicks "Use my own" — should set autoCalculate=false and save. */
  onSwitchToCustom: () => void;
  /** Called when user clicks "← Estimate for me" — should set autoCalculate=true and save. */
  onRevertToAuto: () => void;
  inputStep: string;
  inputMode: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  inputValue: string;
  inputPlaceholder: string;
  /** Unit suffix shown inside the edit input, e.g. "kcal/day" or "%". */
  unit?: string;
  onInputChange: (v: string) => void;
  isDirty: boolean;
  isSaving: boolean;
  error?: string;
  onConfirm: () => void;
  onRevert: () => void;
}

function CalculatedEstimateRow({
  label, explanation, value, isCustom, disabled,
  onSwitchToCustom, onRevertToAuto,
  inputStep, inputMode, inputValue, inputPlaceholder, unit,
  onInputChange, isDirty, isSaving, error, onConfirm, onRevert,
}: CalculatedEstimateRowProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);

  // Close the edit panel if the field is switched back to auto by the parent.
  useEffect(() => {
    if (!isCustom) setIsEditing(false);
  }, [isCustom]);

  function handleUseOwn() {
    onSwitchToCustom();
    setIsEditing(true);
  }

  function handleConfirm() {
    onConfirm();
    setIsEditing(false);
  }

  function handleRevert() {
    onRevert();
    setIsEditing(false);
  }

  return (
    <div className="px-3 py-2.5 min-w-0">
      {/* Display row — hidden while editing */}
      {!isEditing && (
        <div className="min-w-0">
          {/* Row 1 (mobile): label — Row 1 (desktop): all cols inline */}
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-4">
            {/* Col 1: label + explanation */}
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
              <span className="mt-0.5 block text-[11px] text-gray-400 dark:text-gray-500 sm:mt-0 sm:inline sm:ml-1.5">{explanation}</span>
            </div>

            {/* Mobile row 2: value + badge side-by-side; desktop: separate cols */}
            <div className="flex items-center gap-2 sm:contents">
              {/* Col 2: value */}
              <div className="sm:w-40 sm:shrink-0 sm:text-right">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {value != null
                    ? <>{isCustom ? "" : "~"}{value}</>
                    : <span className="text-xs font-normal text-gray-400 dark:text-gray-500">—</span>
                  }
                </span>
              </div>

              {/* Col 3: badge */}
              <div className="sm:w-24 sm:shrink-0 sm:text-center">
                <span className={[
                  "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none",
                  isCustom
                    ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400"
                    : "border-indigo-100 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400",
                ].join(" ")}>
                  {isCustom ? t('profile.badge_custom') : t('profile.badge_estimated')}
                </span>
              </div>
            </div>

            {/* Col 4: action */}
            <div className="sm:w-28 sm:shrink-0 sm:text-right">
              {isCustom ? (
                <div className="flex items-center sm:flex-col sm:items-end gap-x-3 gap-y-0.5">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setIsEditing(true)}
                    className="text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 disabled:opacity-50"
                  >
                    {t('common.edit')}
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={onRevertToAuto}
                    className="text-xs text-gray-400 dark:text-gray-500 transition-colors hover:text-gray-600 dark:hover:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 disabled:opacity-50"
                  >
                    {t('profile.use_estimate')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={handleUseOwn}
                  className="text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 disabled:opacity-50"
                >
                  {t('profile.use_own')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit panel — shown while editing */}
      {isEditing && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</p>
          <div className="relative">
            <input
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              type="text"
              step={inputStep}
              inputMode={inputMode}
              pattern={inputMode === "numeric" ? "[0-9]*" : "[0-9]*[.,]?[0-9]*"}
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              disabled={disabled || isSaving}
              placeholder={inputPlaceholder}
              className={[
                "block w-full rounded-md border bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 transition-colors focus:outline-none",
                "disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-400 dark:disabled:text-gray-500",
                unit ? "pr-16" : "pr-3",
                error
                  ? "border-red-300 hover:border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-400/20"
                  : isDirty
                    ? "border-indigo-300 dark:border-indigo-600 bg-indigo-50/40 dark:bg-indigo-900/20 hover:border-indigo-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20",
              ].join(" ")}
            />
            {unit && (
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center select-none text-xs text-gray-400 dark:text-gray-500">
                {unit}
              </span>
            )}
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={disabled || isSaving || !isDirty}
              onClick={handleConfirm}
              className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
            >
              {isSaving ? t('common.saving') : t('common.save')}
            </button>
            <button
              type="button"
              disabled={disabled || isSaving}
              onClick={handleRevert}
              className="text-xs text-gray-500 dark:text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <span className="flex-1" />
            <button
              type="button"
              disabled={disabled || isSaving}
              onClick={onRevertToAuto}
              className="text-xs text-gray-400 dark:text-gray-500 transition-colors hover:text-gray-600 dark:hover:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 disabled:opacity-50"
            >
              {t('profile.revert_auto')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function fieldCls(hasError: boolean, isDirty: boolean): string {
  const base = "mt-1 block w-full rounded-md border bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 transition-colors focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-400 dark:disabled:text-gray-500";
  if (hasError) return `${base} border-red-300 hover:border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-400/20`;
  if (isDirty)  return `${base} border-indigo-300 dark:border-indigo-600 bg-indigo-50/40 dark:bg-indigo-900/20 hover:border-indigo-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20`;
  return `${base} border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20`;
}

// Same as fieldCls but without mt-1 (margin lives on the wrapper) and with pr-10 for unit suffix
function suffixInputCls(hasError: boolean, isDirty: boolean): string {
  const base = "block w-full rounded-md border bg-white dark:bg-gray-800 px-3 py-2 pr-10 text-sm text-gray-900 dark:text-gray-100 transition-colors focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-400 dark:disabled:text-gray-500";
  if (hasError) return `${base} border-red-300 hover:border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-400/20`;
  if (isDirty)  return `${base} border-indigo-300 dark:border-indigo-600 bg-indigo-50/40 dark:bg-indigo-900/20 hover:border-indigo-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20`;
  return `${base} border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20`;
}

interface FieldWrapProps {
  label?: React.ReactNode;
  dirty: boolean;
  saving: boolean;
  error?: string;
  hint?: string;
  onConfirm: () => void;
  onRevert: () => void;
  children: React.ReactNode;
}

function FieldWrap({ label, dirty, saving, error, hint, onConfirm, onRevert, children }: FieldWrapProps) {
  const { t } = useTranslation();
  return (
    <div>
      {label && <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>}
      {children}
      {saving ? (
        <p className="mt-1.5 text-xs text-indigo-400">{t('common.saving')}</p>
      ) : dirty ? (
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={onRevert}
            className="rounded-lg bg-gray-100 dark:bg-gray-700 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-indigo-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-600 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
          >
            {t('common.save')}
          </button>
        </div>
      ) : null}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      {hint && !dirty && !error && <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
    </div>
  );
}

// ── MetricTile ───────────────────────────────────────────────────────────

interface MetricTileProps {
  label: string;
  inputId: string;
  type: string;
  step: string;
  inputMode: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  pattern?: string;
  value: string;
  unit: string;
  dirty: boolean;
  saving: boolean;
  error?: string;
  disabled: boolean;
  ariaLabel: string;
  required?: boolean;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onRevert: () => void;
}

function MetricTile({
  label, inputId, type, step, inputMode, pattern, value, unit,
  dirty, saving, error, disabled, ariaLabel, required = true,
  onChange, onConfirm, onRevert,
}: MetricTileProps) {
  const { t } = useTranslation();
  const borderCls = error
    ? "border-red-300 dark:border-red-700 bg-red-50/40 dark:bg-red-900/10"
    : dirty
      ? "border-indigo-300 dark:border-indigo-600 bg-indigo-50/40 dark:bg-indigo-900/20"
      : "border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40";

  return (
    <div className={`rounded-xl border p-3 transition-colors ${borderCls}`}>
      <label htmlFor={inputId} className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {label}
      </label>
      <div className="mt-2 flex items-baseline gap-1">
        <input
          id={inputId}
          type={type}
          step={step}
          inputMode={inputMode}
          pattern={pattern}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-required={required}
          placeholder="—"
          className="min-w-0 flex-1 bg-transparent border-0 p-0 text-2xl font-bold text-gray-900 dark:text-gray-100 focus:ring-0 focus:outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600 disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="shrink-0 text-xs font-medium text-gray-400 dark:text-gray-500" aria-hidden="true">{unit}</span>
      </div>
      {error ? (
        <p className="mt-2 text-[10px] leading-tight text-red-500">{error}</p>
      ) : saving ? (
        <p className="mt-2 text-[10px] text-indigo-400">{t('common.saving')}</p>
      ) : dirty ? (
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={onRevert}
            className="rounded-lg bg-gray-100 dark:bg-gray-700 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-indigo-500 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-600 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
          >
            {t('common.save')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

