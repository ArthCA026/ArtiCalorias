import { useEffect, useState, useMemo } from "react";
import { profileService } from "@/services/profileService";
import { dailyLogService } from "@/services/dailyLogService";
import type { UserProfileRequest, UserProfileResponse } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import { extractApiError } from "@/utils/apiError";
import { kgPerWeekToKcal } from "@/utils/goalUtils";
import GoalSelector from "@/components/goal/GoalSelector";
import { PROTEIN_PRESETS, getAgeProteinMinimum } from "@/config/proteinPresets";
import ProteinPresetSelector from "@/components/protein/ProteinPresetSelector";
import type { ProteinPresetId } from "@/config/proteinPresets";

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
  // Sleep & NEAT
  sleepHours: string;
  neatHours: string;
};

const emptyForm: FormState = {
  currentWeightKg: "", heightCm: "", age: "", biologicalSex: "",
  bmrKcal: "", bodyFatPercent: "", autoCalculateBMR: true, autoCalculateBodyFat: true,
  dailyBaseGoalKcal: String(kgPerWeekToKcal(-0.50)), proteinGoalGrams: "",
  proteinPresetId: "muscle-gain", autoCalculateProteinGoal: true, country: "",
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
    currentWeightKg: String(data.currentWeightKg),
    heightCm: String(data.heightCm),
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
    sleepHours: String(data.sleepHours),
    neatHours: String(data.neatHours),
  };
}

function buildRequest(f: FormState): UserProfileRequest {
  return {
    currentWeightKg: parseFloat(f.currentWeightKg),
    heightCm: parseFloat(f.heightCm),
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
    sleepHours: parseFloat(f.sleepHours) || 8,
    neatHours: parseFloat(f.neatHours) || 3,
  };
}

function validateAll(f: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  const weight = parseFloat(f.currentWeightKg);
  const height = parseFloat(f.heightCm);
  if (!f.currentWeightKg || isNaN(weight) || weight <= 0) errors.currentWeightKg = "Enter your weight in kg";
  else if (weight > 500) errors.currentWeightKg = "That weight looks too high";
  if (!f.heightCm || isNaN(height) || height <= 0) errors.heightCm = "Enter your height in cm";
  else if (height > 300) errors.heightCm = "That height looks too high";
  if (!f.age) errors.age = "Enter your age";
  else { const age = parseInt(f.age); if (age < 1) errors.age = "Too low"; else if (age > 150) errors.age = "Too high"; }
  if (!f.biologicalSex) errors.biologicalSex = "Select your sex";
  if (!f.autoCalculateBMR) {
    const bmr = parseFloat(f.bmrKcal);
    if (!f.bmrKcal || isNaN(bmr) || bmr <= 0) errors.bmrKcal = "Enter a value, or use the estimate";
    else if (bmr < 500) errors.bmrKcal = "Too low — typical values are 1,000–4,000 kcal/day";
    else if (bmr > 10000) errors.bmrKcal = "Too high — typical values are 1,000–4,000 kcal/day";
  }
  if (!f.autoCalculateBodyFat) {
    const bf = parseFloat(f.bodyFatPercent);
    if (!f.bodyFatPercent || isNaN(bf)) errors.bodyFatPercent = "Enter a value, or use the estimate";
    else if (bf < 3) errors.bodyFatPercent = "Too low — minimum is 3%";
    else if (bf > 60) errors.bodyFatPercent = "Too high — maximum is 60%";
  }
  const sleepH = parseFloat(f.sleepHours);
  const neatH  = parseFloat(f.neatHours);
  if (isNaN(sleepH) || sleepH < 0 || sleepH > 23) errors.sleepHours = "Enter a value between 0 and 23";
  if (isNaN(neatH)  || neatH  < 0 || neatH  > 23) errors.neatHours  = "Enter a value between 0 and 23";
  if (!isNaN(sleepH) && !isNaN(neatH) && sleepH + neatH > 23) {
    errors.sleepHours = "Sleep + NEAT cannot exceed 23 hours";
    errors.neatHours  = "Sleep + NEAT cannot exceed 23 hours";
  }
  return errors;
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState<FormState>(emptyForm);
  const [original, setOriginal] = useState<FormState>(emptyForm);
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());
  const [savingField, setSavingField] = useState<string | null>(null);

  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    profileService
      .get()
      .then(({ data }) => {
        const f = toFormState(data);
        setForm(f);
        setOriginal(f);
        setShowAdvanced(!data.autoCalculateBMR || !data.autoCalculateBodyFat);
      })
      .catch(() => setError("Failed to load profile."))
      .finally(() => setLoading(false));
  }, []);

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

  /** Fire-and-forget: refreshes today's daily log snapshot after a profile save. */
  function refreshTodaySnapshot() {
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    dailyLogService.refreshSnapshot(today).catch(() => {
      // Non-critical — the user can recalculate manually. Silently ignore.
    });
  }

  async function confirmField(field: keyof FormState) {
    const errors = validateAll(form);
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
      refreshTodaySnapshot();
    } catch (err) {
      setError(extractApiError(err, "Failed to save."));
    } finally {
      setSavingField(null);
    }
  }

  async function saveImmediate(overrideForm: FormState) {
    const errors = validateAll(overrideForm);
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
      refreshTodaySnapshot();
    } catch (err) {
      setError(extractApiError(err, "Failed to save."));
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
    if (!weight || !height || !age || !sex) return null;
    const sexOffset = sex === "M" ? 5 : -161;
    const bmr = Math.round(10 * weight + 6.25 * height - 5 * age + sexOffset);
    const maintenance = Math.round(bmr + 4.8 * weight);
    const goalKcal = parseFloat(form.dailyBaseGoalKcal) || 0;
    const dailyTarget = Math.round(maintenance + goalKcal);
    const heightM = height / 100;
    const bmi = weight / (heightM * heightM);
    const sexFactor = sex === "M" ? 1 : 0;
    const bodyFat = Math.round((1.20 * bmi + 0.23 * age - 10.8 * sexFactor - 5.4) * 10) / 10;
    return { maintenance, dailyTarget, bmr, bodyFat };
  }, [form.currentWeightKg, form.heightCm, form.age, form.biologicalSex, form.dailyBaseGoalKcal]);

  if (loading) return <LoadingSpinner />;
  if (error && form === emptyForm) return <ErrorMessage message={error} />;

  return (
    <div className="space-y-3 w-full min-w-0">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Your profile</h1>
        <p className="mt-0.5 text-sm text-gray-400">
          These details help estimate your daily calories and protein target.
        </p>
      </div>

      <div className="space-y-3">
        {error && (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <section className="rounded-xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-100 w-full min-w-0 overflow-x-hidden">

          {/* ── Basic details ── */}
          <div className="p-4 sm:p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Basic details</h2>
                <p className="mt-0.5 text-xs text-gray-400">Used to estimate your daily calorie needs.</p>
              </div>
              <span className="shrink-0 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-400">
                Required
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FieldWrap
                label="Weight *"
                dirty={dirtyFields.has("currentWeightKg")}
                saving={savingField === "currentWeightKg"}
                error={fieldErrors.currentWeightKg}
                onConfirm={() => confirmField("currentWeightKg")}
                onRevert={() => revertField("currentWeightKg")}
              >
                <div className="relative mt-1">
                  <input
                    type="number" step="0.1" inputMode="decimal"
                    value={form.currentWeightKg}
                    onChange={(e) => setField("currentWeightKg", e.target.value)}
                    disabled={isSaving}
                    aria-label="Weight in kilograms"
                    aria-required="true"
                    className={suffixInputCls(!!fieldErrors.currentWeightKg, dirtyFields.has("currentWeightKg"))}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-400 select-none" aria-hidden="true">kg</span>
                </div>
              </FieldWrap>

              <FieldWrap
                label="Height *"
                dirty={dirtyFields.has("heightCm")}
                saving={savingField === "heightCm"}
                error={fieldErrors.heightCm}
                onConfirm={() => confirmField("heightCm")}
                onRevert={() => revertField("heightCm")}
              >
                <div className="relative mt-1">
                  <input
                    type="number" step="0.1" inputMode="decimal"
                    value={form.heightCm}
                    onChange={(e) => setField("heightCm", e.target.value)}
                    disabled={isSaving}
                    aria-label="Height in centimetres"
                    aria-required="true"
                    className={suffixInputCls(!!fieldErrors.heightCm, dirtyFields.has("heightCm"))}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-400 select-none" aria-hidden="true">cm</span>
                </div>
              </FieldWrap>

              <FieldWrap
                label="Age *"
                dirty={dirtyFields.has("age")}
                saving={savingField === "age"}
                error={fieldErrors.age}
                onConfirm={() => confirmField("age")}
                onRevert={() => revertField("age")}
              >
                <div className="relative mt-1">
                  <input
                    type="number" step="1" inputMode="numeric"
                    value={form.age}
                    onChange={(e) => setField("age", e.target.value)}
                    disabled={isSaving}
                    aria-label="Age in years"
                    aria-required="true"
                    className={suffixInputCls(!!fieldErrors.age, dirtyFields.has("age"))}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-400 select-none" aria-hidden="true">yrs</span>
                </div>
              </FieldWrap>

              <FieldWrap
                label="Sex *"
                dirty={false}
                saving={false}
                error={fieldErrors.biologicalSex}
                onConfirm={() => {}}
                onRevert={() => {}}
              >
                <div className="relative mt-1">
                  <select
                    value={form.biologicalSex}
                    onChange={(e) => {
                      const newForm = { ...form, biologicalSex: e.target.value };
                      setForm(newForm);
                      saveImmediate(newForm);
                    }}
                    disabled={isSaving}
                    aria-label="Biological sex"
                    aria-required="true"
                    className={selectCls(!!fieldErrors.biologicalSex)}
                  >
                    <option value="">—</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400" aria-hidden="true">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </div>
              </FieldWrap>
            </div>
            <p className="text-xs text-gray-400">
              These values are used to estimate your baseline calorie needs. You can update them anytime.
            </p>
          </div>

          {/* ── Your goal ── */}
          <div className="p-4 sm:p-5 space-y-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Your weight goal</h2>
              <p className="mt-0.5 text-xs text-gray-400">Choose how fast you want your calorie target to change.</p>
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
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Your protein target</h2>
              <p className="mt-0.5 text-xs text-gray-400">Choose how much protein you want to aim for each day.</p>
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
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Personalization</h2>
              <p className="mt-0.5 text-xs text-gray-400">Optional details that help the app recognize your food context.</p>
            </div>

            <FieldWrap
              label={<>Country <span className="text-gray-400 font-normal">(optional)</span></>}
              dirty={dirtyFields.has("country")}
              saving={savingField === "country"}
              onConfirm={() => confirmField("country")}
              onRevert={() => revertField("country")}
              hint="Helps recognize local foods, brands, and portions."
            >
              <input
                type="text"
                value={form.country}
                onChange={(e) => setField("country", e.target.value)}
                disabled={isSaving}
                placeholder="e.g. Mexico, Spain, USA"
                className={fieldCls(false, dirtyFields.has("country"))}
              />
            </FieldWrap>
          </div>

          {/* ── Sleep & NEAT ── */}
          <div className="p-4 sm:p-5 space-y-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sleep &amp; NEAT</h2>
              <p className="mt-0.5 text-xs text-gray-400">
                Daily hours reserved for sleep and non-exercise activity (NEAT). Both reduce idle time and contribute their own calorie estimates.
              </p>
            </div>

            {(() => {
              const sh = parseFloat(form.sleepHours);
              const nh = parseFloat(form.neatHours);
              if (!isNaN(sh) && !isNaN(nh) && sh + nh > 23) {
                return (
                  <p className="text-xs text-amber-500">
                    Sleep + NEAT total {(sh + nh).toFixed(1)}h — combined cannot exceed 23 hours.
                  </p>
                );
              }
              return null;
            })()}

            <FieldWrap
              label="Sleep hours"
              dirty={dirtyFields.has("sleepHours")}
              saving={savingField === "sleepHours"}
              onConfirm={() => confirmField("sleepHours")}
              onRevert={() => revertField("sleepHours")}
              error={fieldErrors.sleepHours}
            >
              <div className="relative">
                <input
                  type="number"
                  min={0} max={23} step={0.5}
                  value={form.sleepHours}
                  onChange={(e) => setField("sleepHours", e.target.value)}
                  disabled={isSaving}
                  className={suffixInputCls(!!fieldErrors.sleepHours, dirtyFields.has("sleepHours"))}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-400">hrs</span>
              </div>
            </FieldWrap>

            <FieldWrap
              label="NEAT hours"
              dirty={dirtyFields.has("neatHours")}
              saving={savingField === "neatHours"}
              onConfirm={() => confirmField("neatHours")}
              onRevert={() => revertField("neatHours")}
              error={fieldErrors.neatHours}
              hint="Non-exercise activity thermogenesis — daily movement outside formal exercise."
            >
              <div className="relative">
                <input
                  type="number"
                  min={0} max={23} step={0.5}
                  value={form.neatHours}
                  onChange={(e) => setField("neatHours", e.target.value)}
                  disabled={isSaving}
                  className={suffixInputCls(!!fieldErrors.neatHours, dirtyFields.has("neatHours"))}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-400">hrs</span>
              </div>
            </FieldWrap>
          </div>

          {/* ── Advanced estimates ── */}
          <div className="p-4 sm:p-5 space-y-3">
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Advanced estimates</h2>
                <p className="mt-0.5 text-xs text-gray-400">Calculated automatically. Edit only if you know your measured values.</p>
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
                {showAdvanced ? "Hide advanced estimates" : "Show advanced estimates"}
              </button>
            </div>

            {showAdvanced && (
              <div id="advanced-estimates-content" className="divide-y divide-gray-100 rounded-lg border border-gray-100 w-full min-w-0 overflow-x-hidden">
                <CalculatedEstimateRow
                  label="Calories burned at rest"
                  explanation="Your baseline burn before daily movement or exercise."
                  value={
                    !form.autoCalculateBMR
                      ? (form.bmrKcal ? `${parseFloat(form.bmrKcal).toLocaleString()} kcal/day` : null)
                      : (estimate ? `${estimate.bmr.toLocaleString()} kcal/day` : null)
                  }
                  isCustom={!form.autoCalculateBMR}
                  disabled={isSaving}
                  onSwitchToCustom={() => {
                    const newForm = { ...form, autoCalculateBMR: false };
                    setForm(newForm);
                    saveImmediate(newForm);
                  }}
                  onRevertToAuto={() => {
                    const newForm = { ...form, autoCalculateBMR: true };
                    setForm(newForm);
                    saveImmediate(newForm);
                  }}
                  inputStep="1"
                  inputMode="numeric"
                  inputValue={form.bmrKcal}
                  inputPlaceholder="e.g. 1700"
                  unit="kcal/day"
                  onInputChange={(v) => setField("bmrKcal", v)}
                  isDirty={dirtyFields.has("bmrKcal")}
                  isSaving={savingField === "bmrKcal"}
                  error={fieldErrors.bmrKcal}
                  onConfirm={() => confirmField("bmrKcal")}
                  onRevert={() => revertField("bmrKcal")}
                />

                <CalculatedEstimateRow
                  label="Body fat"
                  explanation="Estimated from your profile details."
                  value={
                    !form.autoCalculateBodyFat
                      ? (form.bodyFatPercent ? `${parseFloat(form.bodyFatPercent).toFixed(1)}%` : null)
                      : (estimate ? `${estimate.bodyFat.toFixed(1)}%` : null)
                  }
                  isCustom={!form.autoCalculateBodyFat}
                  disabled={isSaving}
                  onSwitchToCustom={() => {
                    const newForm = { ...form, autoCalculateBodyFat: false };
                    setForm(newForm);
                    saveImmediate(newForm);
                  }}
                  onRevertToAuto={() => {
                    const newForm = { ...form, autoCalculateBodyFat: true };
                    setForm(newForm);
                    saveImmediate(newForm);
                  }}
                  inputStep="0.1"
                  inputMode="decimal"
                  inputValue={form.bodyFatPercent}
                  inputPlaceholder="e.g. 25"
                  unit="%"
                  onInputChange={(v) => setField("bodyFatPercent", v)}
                  isDirty={dirtyFields.has("bodyFatPercent")}
                  isSaving={savingField === "bodyFatPercent"}
                  error={fieldErrors.bodyFatPercent}
                  onConfirm={() => confirmField("bodyFatPercent")}
                  onRevert={() => revertField("bodyFatPercent")}
                />
              </div>
            )}
          </div>

          {/* plan section removed */}
        </section>
      </div>
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
              <span className="text-xs font-medium text-gray-700">{label}</span>
              <span className="mt-0.5 block text-[11px] text-gray-400 sm:mt-0 sm:inline sm:ml-1.5">{explanation}</span>
            </div>

            {/* Mobile row 2: value + badge side-by-side; desktop: separate cols */}
            <div className="flex items-center gap-2 sm:contents">
              {/* Col 2: value */}
              <div className="sm:w-40 sm:shrink-0 sm:text-right">
                <span className="text-sm font-semibold text-gray-800">
                  {value != null
                    ? <>{isCustom ? "" : "~"}{value}</>
                    : <span className="text-xs font-normal text-gray-400">—</span>
                  }
                </span>
              </div>

              {/* Col 3: badge */}
              <div className="sm:w-24 sm:shrink-0 sm:text-center">
                <span className={[
                  "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none",
                  isCustom
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-indigo-100 bg-indigo-50 text-indigo-600",
                ].join(" ")}>
                  {isCustom ? "Custom" : "Estimated"}
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
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={onRevertToAuto}
                    className="text-xs text-gray-400 transition-colors hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 disabled:opacity-50"
                  >
                    Use estimate
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={handleUseOwn}
                  className="text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 disabled:opacity-50"
                >
                  Use my own
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit panel — shown while editing */}
      {isEditing && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-700">{label}</p>
          <div className="relative">
            <input
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              type="number"
              step={inputStep}
              inputMode={inputMode}
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              disabled={disabled || isSaving}
              placeholder={inputPlaceholder}
              className={[
                "block w-full rounded-md border bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:outline-none",
                "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400",
                unit ? "pr-16" : "pr-3",
                error
                  ? "border-red-300 hover:border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-400/20"
                  : isDirty
                    ? "border-indigo-300 bg-indigo-50/40 hover:border-indigo-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    : "border-gray-200 hover:border-gray-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20",
              ].join(" ")}
            />
            {unit && (
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center select-none text-xs text-gray-400">
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
              {isSaving ? "Saving\u2026" : "Save"}
            </button>
            <button
              type="button"
              disabled={disabled || isSaving}
              onClick={handleRevert}
              className="text-xs text-gray-500 transition-colors hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:opacity-50"
            >
              Cancel
            </button>
            <span className="flex-1" />
            <button
              type="button"
              disabled={disabled || isSaving}
              onClick={onRevertToAuto}
              className="text-xs text-gray-400 transition-colors hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 disabled:opacity-50"
            >
              ← Use estimate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function fieldCls(hasError: boolean, isDirty: boolean): string {
  const base = "mt-1 block w-full rounded-md border bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400";
  if (hasError) return `${base} border-red-300 hover:border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-400/20`;
  if (isDirty)  return `${base} border-indigo-300 bg-indigo-50/40 hover:border-indigo-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20`;
  return `${base} border-gray-200 hover:border-gray-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20`;
}

// Same as fieldCls but without mt-1 (margin lives on the wrapper) and with pr-10 for unit suffix
function suffixInputCls(hasError: boolean, isDirty: boolean): string {
  const base = "block w-full rounded-md border bg-white px-3 py-2 pr-10 text-sm text-gray-900 transition-colors focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400";
  if (hasError) return `${base} border-red-300 hover:border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-400/20`;
  if (isDirty)  return `${base} border-indigo-300 bg-indigo-50/40 hover:border-indigo-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20`;
  return `${base} border-gray-200 hover:border-gray-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20`;
}

// For the Sex <select>: no mt-1 (wrapper handles it), appearance-none, pr-8 for custom chevron
function selectCls(hasError: boolean): string {
  const base = "block w-full appearance-none rounded-md border bg-white px-3 py-2 pr-8 text-sm text-gray-900 transition-colors focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400";
  if (hasError) return `${base} border-red-300 hover:border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-400/20`;
  return `${base} border-gray-200 hover:border-gray-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20`;
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
  return (
    <div>
      {label && <label className="block text-xs font-medium text-gray-600">{label}</label>}
      <div className="flex items-start gap-1.5">
        <div className="flex-1 min-w-0">{children}</div>
        {/* Always reserve 2 button slots so input width never shifts */}
        <div className={`flex gap-1 mt-1 shrink-0 transition-opacity ${dirty && !saving ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <button
            type="button"
            onClick={onConfirm}
            title="Save change"
            className="flex h-7 w-7 items-center justify-center rounded-md text-green-600 hover:bg-green-50 hover:text-green-700 transition-colors focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-1 focus-visible:outline-none"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onRevert}
            title="Revert change"
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-1 focus-visible:outline-none"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

