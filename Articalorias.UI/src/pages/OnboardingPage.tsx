import { useState, useMemo } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { profileService } from "@/services/profileService";
import type { UserProfileRequest } from "@/types";
import { extractApiError } from "@/utils/apiError";
import { useUnits } from "@/hooks/useUnits";
import { energyRateLabel, kgToDisplay, displayToKg, kcalToDisplay, displayToKcal } from "@/utils/units";
import GoalSelector from "@/components/goal/GoalSelector";
import ProteinPresetSelector from "@/components/protein/ProteinPresetSelector";
import { PROTEIN_PRESETS, getAgeProteinMinimum } from "@/config/proteinPresets";
import type { ProteinPresetId } from "@/config/proteinPresets";

export default function OnboardingPage() {
  const { t } = useTranslation();
  const { weightUnit, energyUnit } = useUnits();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [form, setForm] = useState({
    currentWeightKg: "",
    heightCm: "",
    age: "",
    biologicalSex: "",
    bmrKcal: "",
    bodyFatPercent: "",
    autoCalculateBMR: true,
    autoCalculateBodyFat: true,
    dailyBaseGoalKcal: "-500",
    proteinGoalGrams: "",
    proteinPresetId: "muscle-gain",
    autoCalculateProteinGoal: true,
    country: "",
  });

  function set(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  const estimate = useMemo(() => {
    const weight = parseFloat(form.currentWeightKg);
    const height = parseFloat(form.heightCm);
    const age = parseInt(form.age);
    const sex = form.biologicalSex;

    if (!weight || !height || !age || !sex) return null;

    const sexOffset = sex === "M" ? 5 : -161;
    const bmr = Math.round(10 * weight + 6.25 * height - 5 * age + sexOffset);
    const maintenance = Math.round(bmr + 4.8 * weight);
    const goalKcal = parseFloat(form.dailyBaseGoalKcal) || 0;
    const dailyTarget = Math.round(maintenance + goalKcal);

    const protein =
      !form.autoCalculateProteinGoal && form.proteinGoalGrams
        ? Math.round(parseFloat(form.proteinGoalGrams))
        : Math.round(weight * 2.0);

    const heightM = height / 100;
    const bmi = weight / (heightM * heightM);
    const sexFactor = sex === "M" ? 1 : 0;
    const bodyFat = Math.round((1.20 * bmi + 0.23 * age - 10.8 * sexFactor - 5.4) * 10) / 10;

    return { maintenance, dailyTarget, protein, bmr, bodyFat };
  }, [
    form.currentWeightKg,
    form.heightCm,
    form.age,
    form.biologicalSex,
    form.dailyBaseGoalKcal,
    form.autoCalculateProteinGoal,
    form.proteinGoalGrams,
  ]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const errors: Record<string, string> = {};
    const weight = parseFloat(form.currentWeightKg);
    const height = parseFloat(form.heightCm);

    if (form.currentWeightKg && (isNaN(weight) || weight <= 0)) {
      errors.currentWeightKg = t('profile.validation_weight_empty');
    } else if (form.currentWeightKg && weight > 500) {
      errors.currentWeightKg = t('profile.validation_weight_high');
    }

    if (form.heightCm && (isNaN(height) || height <= 0)) {
      errors.heightCm = t('profile.validation_height_empty');
    } else if (form.heightCm && height > 300) {
      errors.heightCm = t('profile.validation_height_high');
    }

    if (form.age) {
      const age = parseInt(form.age);
      if (isNaN(age) || age < 1) errors.age = t('onboarding.age_low');
      else if (age > 150) errors.age = t('onboarding.age_high');
    }
    if (!form.autoCalculateBMR) {
      const bmr = parseFloat(form.bmrKcal);
      if (!form.bmrKcal || !bmr || bmr <= 0) {
        errors.bmrKcal = t('onboarding.advanced_bmr_hint');
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    // Resolve the final protein grams from the current (validated) weight so
    // a stale computedGrams value stored when the preset was first clicked
    // (possibly before weight was entered) can never reach the API.
    let resolvedProteinGrams: number | null = null;
    if (!form.autoCalculateProteinGoal) {
      if (form.proteinPresetId) {
        const preset = PROTEIN_PRESETS.find((p) => p.id === form.proteinPresetId);
        const ageNum = form.age ? parseInt(form.age) : NaN;
        const ageMin = !isNaN(ageNum) && ageNum > 0 ? getAgeProteinMinimum(ageNum) : 0;
        if (preset) resolvedProteinGrams = Math.round(weight * Math.max(preset.gramsPerKg, ageMin));
      } else {
        resolvedProteinGrams = form.proteinGoalGrams ? parseFloat(form.proteinGoalGrams) : null;
      }
    }

    const data: UserProfileRequest = {
      currentWeightKg: form.currentWeightKg ? weight : null,
      heightCm: form.heightCm ? height : null,
      age: form.age ? parseInt(form.age) : null,
      biologicalSex: form.biologicalSex || null,
      bmrKcal: form.bmrKcal ? parseFloat(form.bmrKcal) : null,
      bodyFatPercent: form.bodyFatPercent ? parseFloat(form.bodyFatPercent) : null,
      autoCalculateBMR: form.autoCalculateBMR,
      autoCalculateBodyFat: form.autoCalculateBodyFat,
      dailyBaseGoalKcal: form.dailyBaseGoalKcal ? parseFloat(form.dailyBaseGoalKcal) : null,
      proteinGoalGrams: resolvedProteinGrams,
      autoCalculateProteinGoal: form.autoCalculateProteinGoal,
      country: form.country || null,
      calorieDisplayMode: 'net',
      minCaloriesSafeguardEnabled: true,
      sleepHours: 8,
      neatHours: 3,
    };

    setLoading(true);
    try {
      await profileService.update(data);
      navigate("/today", { replace: true });
    } catch (err) {
      setError(extractApiError(err, t('onboarding.server_error')));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full min-w-0">
      <div className="text-center mb-4 sm:mb-8 max-w-xl mx-auto">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/40">
          <svg className="h-6 w-6 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{t('onboarding.title')}</h1>
        <p className="mt-3 text-base text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          {t('onboarding.subtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>
        )}

        {/* ── Section 1: Basic details ── */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 sm:p-8 shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white flex-shrink-0 mt-0.5">1</span>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('onboarding.section1_title')}</h2>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{t('onboarding.section1_subtitle')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('onboarding.weight_label')}</label>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.,]?[0-9]*"
                value={weightUnit === "lbs" ? (form.currentWeightKg ? String(Math.round(kgToDisplay(parseFloat(form.currentWeightKg), "lbs") * 10) / 10) : "") : form.currentWeightKg}
                onChange={(e) => { const raw = e.target.value.replace(",", "."); set("currentWeightKg", weightUnit === "lbs" ? (raw ? String(displayToKg(parseFloat(raw), "lbs")) : "") : e.target.value); }}
                placeholder={t('onboarding.weight_placeholder')}
                className={`mt-1 block w-full rounded-md border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm shadow-sm focus:ring-1 focus:outline-none ${fieldErrors.currentWeightKg ? "border-red-300 dark:border-red-600 focus:border-red-500 focus:ring-red-500" : "border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500"}`}
              />
              {fieldErrors.currentWeightKg && <p className="mt-1 text-xs text-red-600">{fieldErrors.currentWeightKg}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('onboarding.height_label')}</label>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.,]?[0-9]*"
                value={form.heightCm}
                onChange={(e) => set("heightCm", e.target.value)}
                placeholder={t('onboarding.height_placeholder')}
                className={`mt-1 block w-full rounded-md border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm shadow-sm focus:ring-1 focus:outline-none ${fieldErrors.heightCm ? "border-red-300 dark:border-red-600 focus:border-red-500 focus:ring-red-500" : "border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500"}`}
              />
              {fieldErrors.heightCm && <p className="mt-1 text-xs text-red-600">{fieldErrors.heightCm}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('onboarding.age_label')}</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={form.age}
                onChange={(e) => set("age", e.target.value)}
                className={`mt-1 block w-full rounded-md border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm shadow-sm focus:ring-1 focus:outline-none ${fieldErrors.age ? "border-red-300 dark:border-red-600 focus:border-red-500 focus:ring-red-500" : "border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500"}`}
              />
              {fieldErrors.age && <p className="mt-1 text-xs text-red-600">{fieldErrors.age}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('onboarding.sex_label')}</label>
              <select
                value={form.biologicalSex}
                onChange={(e) => set("biologicalSex", e.target.value)}
                className={`mt-1 block w-full rounded-md border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm shadow-sm focus:ring-1 focus:outline-none ${fieldErrors.biologicalSex ? "border-red-300 dark:border-red-600 focus:border-red-500 focus:ring-red-500" : "border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500"}`}
              >
                <option value="">{t('common.prefer_not_to_say')}</option>
                <option value="M">{t('common.male')}</option>
                <option value="F">{t('common.female')}</option>
              </select>
              {fieldErrors.biologicalSex && <p className="mt-1 text-xs text-red-600">{fieldErrors.biologicalSex}</p>}
            </div>
          </div>
        </div>

        {/* ── Section 2: Your goal ── */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 sm:p-8 shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white flex-shrink-0 mt-0.5">2</span>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('onboarding.section2_title')}</h2>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{t('onboarding.section2_subtitle')}</p>
            </div>
          </div>

          <GoalSelector
            selectedKcal={form.dailyBaseGoalKcal}
            onGoalChange={(kcal) => set("dailyBaseGoalKcal", kcal)}
            disabled={loading}
          />

          {/* Protein target */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">{t('onboarding.protein_label')}</p>
            <ProteinPresetSelector
              savedPresetId={form.proteinPresetId}
              savedGrams={form.proteinGoalGrams}
              weightKg={form.currentWeightKg}
              goalKcal={form.dailyBaseGoalKcal}
              age={form.age}
              disabled={loading}
              onPresetSelect={(presetId: ProteinPresetId, computedGrams: string) => {
                setForm((prev) => ({
                  ...prev,
                  proteinPresetId: presetId,
                  proteinGoalGrams: computedGrams,
                  autoCalculateProteinGoal: false,
                }));
              }}
              onCustomApply={(grams: string) => {
                setForm((prev) => ({
                  ...prev,
                  proteinPresetId: "",
                  proteinGoalGrams: grams,
                  autoCalculateProteinGoal: false,
                }));
              }}
            />
          </div>
        </div>

        {/* ── Section 3: Optional details ── */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 sm:p-8 shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white flex-shrink-0 mt-0.5">3</span>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('onboarding.section3_title')}</h2>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{t('onboarding.section3_subtitle')}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('onboarding.country_label')}</label>
            <input
              type="text"
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
              placeholder={t('onboarding.country_placeholder')}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{t('onboarding.section3_country_hint')}</p>
          </div>

          {/* ── Advanced options (collapsible) ── */}
          <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1.5 py-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              <svg
                className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              {showAdvanced ? t('onboarding.advanced_toggle_hide') : t('onboarding.advanced_toggle')}
            </button>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{t('onboarding.section3_hint')}</p>

            {showAdvanced && (
              <div className="mt-4 space-y-5">
                {/* BMR override */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {form.autoCalculateBMR ? t('onboarding.bmr_label_full') : t('onboarding.bmr_label_with_unit')}
                  </label>
                  {form.autoCalculateBMR ? (
                    <>
                      <div className="mt-1.5 flex items-center gap-2 rounded-md border border-indigo-100 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/40 px-3 py-2.5 text-sm">
                        <svg className="h-4 w-4 text-indigo-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        <span className="text-gray-600 dark:text-gray-400">
                          {estimate
                            ? <>{t('onboarding.bmr_calculated', { kcal: Math.round(kcalToDisplay(estimate.bmr, energyUnit)).toLocaleString(), energyUnit: energyRateLabel(energyUnit) })}</>
                            : t('onboarding.bmr_auto_note')}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">{t('onboarding.bmr_info')}</p>
                      <button type="button" onClick={() => set("autoCalculateBMR", false)} className="mt-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                        {t('onboarding.bmr_enter')}
                      </button>
                    </>
                  ) : (
                    <>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={energyUnit === "kJ" ? String(Math.round(kcalToDisplay(parseFloat(form.bmrKcal) || 0, "kJ"))) : form.bmrKcal}
                        onChange={(e) => set("bmrKcal", energyUnit === "kJ" ? String(displayToKcal(parseFloat(e.target.value) || 0, "kJ")) : e.target.value)}
                        placeholder={energyUnit === "kJ" ? "e.g. 7113" : "e.g. 1700"}
                        className={`mt-1 block w-full rounded-md border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm shadow-sm focus:ring-1 focus:outline-none ${fieldErrors.bmrKcal ? "border-red-300 dark:border-red-600 focus:border-red-500 focus:ring-red-500" : "border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500"}`}
                      />
                      {fieldErrors.bmrKcal && <p className="mt-1 text-xs text-red-600">{fieldErrors.bmrKcal}</p>}
                      <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">{t('onboarding.bmr_info')}</p>
                      <button type="button" onClick={() => set("autoCalculateBMR", true)} className="mt-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                        {t('onboarding.bmr_calc_for_me')}
                      </button>
                    </>
                  )}
                </div>

                {/* Body fat override */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('onboarding.body_fat_label')}{!form.autoCalculateBodyFat && " — %"}
                  </label>
                  {form.autoCalculateBodyFat ? (
                    <>
                      <div className="mt-1.5 flex items-center gap-2 rounded-md border border-indigo-100 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/40 px-3 py-2.5 text-sm">
                        <svg className="h-4 w-4 text-indigo-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        <span className="text-gray-600 dark:text-gray-400">
                          {estimate
                            ? <>{t('onboarding.body_fat_calculated', { pct: estimate.bodyFat.toFixed(1) })}</>
                            : t('onboarding.body_fat_auto_note')}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">{t('onboarding.body_fat_info')}</p>
                      <button type="button" onClick={() => set("autoCalculateBodyFat", false)} className="mt-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                        {t('onboarding.body_fat_enter')}
                      </button>
                    </>
                  ) : (
                    <>
                      <input
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]*[.,]?[0-9]*"
                        value={form.bodyFatPercent}
                        onChange={(e) => set("bodyFatPercent", e.target.value)}
                        placeholder="e.g. 25"
                        className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                      <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">{t('onboarding.body_fat_optional_info')}</p>
                      <button type="button" onClick={() => set("autoCalculateBodyFat", true)} className="mt-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                        {t('onboarding.body_fat_calc_for_me')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {estimate && (
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-700 bg-gradient-to-br from-indigo-50 dark:from-indigo-950/40 to-white dark:to-gray-900 p-5 sm:p-8 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('onboarding.summary_title')}</h2>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">{t('onboarding.summary_maintain')}</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{Math.round(kcalToDisplay(estimate.maintenance, energyUnit)).toLocaleString()} {energyRateLabel(energyUnit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">{t('onboarding.summary_reach_goal')}</span>
                <span className="font-semibold text-indigo-600">{Math.round(kcalToDisplay(estimate.dailyTarget, energyUnit)).toLocaleString()} {energyRateLabel(energyUnit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">{t('onboarding.protein_label')}</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{estimate.protein} g</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 pt-3 border-t border-indigo-100 dark:border-indigo-800">{t('onboarding.summary_note_bottom')}</p>
          </div>
        )}

        <div className="space-y-3">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            {loading ? t('onboarding.submitting_text') : t('onboarding.submit')}
          </button>
          <p className="text-center text-xs text-gray-400 dark:text-gray-500">{t('onboarding.summary_note_bottom')}</p>
        </div>
      </form>
    </div>
  );
}
