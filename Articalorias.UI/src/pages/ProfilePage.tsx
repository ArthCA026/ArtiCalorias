import { useEffect, useState, useMemo } from "react";
import type { FormEvent } from "react";
import { profileService } from "@/services/profileService";
import type { UserProfileRequest, UserProfileResponse } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import { extractApiError } from "@/utils/apiError";

const GOAL_PRESETS = [
  { key: "lose-fast",     label: "Lose weight faster",           desc: "~0.75 kg per week — more aggressive", kcal: "-750" },
  { key: "lose-moderate", label: "Lose weight",                  desc: "~0.5 kg per week — recommended",       kcal: "-500" },
  { key: "lose-slow",     label: "Lose weight slowly",           desc: "~0.25 kg per week — gentle pace",      kcal: "-250" },
  { key: "maintain",      label: "Maintain my current weight",   desc: "Stay where you are",                   kcal: "0" },
  { key: "gain",          label: "Gain weight",                  desc: "~0.3 kg per week",                     kcal: "300" },
] as const;

function matchPreset(kcalValue: string): { preset: string; isCustom: boolean } {
  const match = GOAL_PRESETS.find((p) => p.kcal === kcalValue);
  if (match) return { preset: match.key, isCustom: false };
  return { preset: "", isCustom: true };
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);
  const [goalPreset, setGoalPreset] = useState<string>("lose-moderate");
  const [showCustomGoal, setShowCustomGoal] = useState(false);
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
    autoCalculateProteinGoal: true,
    country: "",
  });

  useEffect(() => {
    profileService
      .get()
      .then(({ data }) => {
        setProfile(data);
        const goalKcalStr = String(data.dailyBaseGoalKcal);
        const { preset, isCustom } = matchPreset(goalKcalStr);
        setGoalPreset(preset);
        setShowCustomGoal(isCustom);

        const hasAdvancedOverrides =
          !data.autoCalculateBMR || !data.autoCalculateBodyFat || isCustom;
        setShowAdvanced(hasAdvancedOverrides);

        setForm({
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
          autoCalculateProteinGoal: data.autoCalculateProteinGoal,
          country: data.country ?? "",
        });
      })
      .catch(() => setError("Failed to load profile."))
      .finally(() => setLoading(false));
  }, []);

  function set(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSuccess(false);
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function selectGoalPreset(key: string) {
    setGoalPreset(key);
    setShowCustomGoal(false);
    const preset = GOAL_PRESETS.find((p) => p.key === key);
    if (preset) {
      setForm((prev) => ({ ...prev, dailyBaseGoalKcal: preset.kcal }));
    }
    setSuccess(false);
  }

  function switchToCustomGoal() {
    setGoalPreset("");
    setShowCustomGoal(true);
    setSuccess(false);
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
    setSuccess(false);

    const errors: Record<string, string> = {};
    const weight = parseFloat(form.currentWeightKg);
    const height = parseFloat(form.heightCm);

    if (!form.currentWeightKg || !weight || weight <= 0) {
      errors.currentWeightKg = "Enter your weight in kg";
    } else if (weight > 500) {
      errors.currentWeightKg = "That weight looks too high";
    }

    if (!form.heightCm || !height || height <= 0) {
      errors.heightCm = "Enter your height in cm";
    } else if (height > 300) {
      errors.heightCm = "That height looks too high";
    }

    if (!form.age) {
      errors.age = "Enter your age";
    } else {
      const age = parseInt(form.age);
      if (age < 1) errors.age = "That age looks too low";
      else if (age > 150) errors.age = "That age looks too high";
    }
    if (!form.biologicalSex) {
      errors.biologicalSex = "Select your sex";
    }

    if (!form.autoCalculateBMR) {
      const bmr = parseFloat(form.bmrKcal);
      if (!form.bmrKcal || !bmr || bmr <= 0) {
        errors.bmrKcal = "Enter your resting calorie burn, or let us calculate it";
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    const data: UserProfileRequest = {
      currentWeightKg: weight,
      heightCm: height,
      age: form.age ? parseInt(form.age) : null,
      biologicalSex: form.biologicalSex || null,
      bmrKcal: form.bmrKcal ? parseFloat(form.bmrKcal) : null,
      bodyFatPercent: form.bodyFatPercent ? parseFloat(form.bodyFatPercent) : null,
      autoCalculateBMR: form.autoCalculateBMR,
      autoCalculateBodyFat: form.autoCalculateBodyFat,
      dailyBaseGoalKcal: form.dailyBaseGoalKcal ? parseFloat(form.dailyBaseGoalKcal) : null,
      proteinGoalGrams: form.proteinGoalGrams ? parseFloat(form.proteinGoalGrams) : null,
      autoCalculateProteinGoal: form.autoCalculateProteinGoal,
      country: form.country || null,
    };

    setSaving(true);
    try {
      const { data: updated } = await profileService.update(data);
      setProfile(updated);
      const goalKcalStr = String(updated.dailyBaseGoalKcal);
      const { preset, isCustom } = matchPreset(goalKcalStr);
      setGoalPreset(preset);
      setShowCustomGoal(isCustom);
      setForm({
        currentWeightKg: String(updated.currentWeightKg),
        heightCm: String(updated.heightCm),
        age: updated.age != null ? String(updated.age) : "",
        biologicalSex: updated.biologicalSex ?? "",
        bmrKcal: String(updated.bmrKcal),
        bodyFatPercent: updated.bodyFatPercent != null ? String(updated.bodyFatPercent) : "",
        autoCalculateBMR: updated.autoCalculateBMR,
        autoCalculateBodyFat: updated.autoCalculateBodyFat,
        dailyBaseGoalKcal: goalKcalStr,
        proteinGoalGrams: updated.proteinGoalGrams != null ? String(updated.proteinGoalGrams) : "",
        autoCalculateProteinGoal: updated.autoCalculateProteinGoal,
        country: updated.country ?? "",
      });
      setSuccess(true);
    } catch (err) {
      setError(extractApiError(err, "Failed to save."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (error && !profile) return <ErrorMessage message={error} />;

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-6 sm:mb-10">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
          <svg className="h-6 w-6 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Your profile</h1>
        <p className="mt-3 text-base text-gray-500 max-w-md mx-auto">
          Review and update your details so we can keep your calorie and protein targets accurate.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
        {error && (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">Profile saved successfully.</div>
        )}

        {/* ── Section 1: Basic details ── */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex items-start gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white flex-shrink-0 mt-0.5">1</span>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Basic details</h2>
              <p className="mt-0.5 text-xs text-gray-400">We use these to estimate how many calories your body burns each day.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Your weight (kg) *</label>
              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                value={form.currentWeightKg}
                onChange={(e) => set("currentWeightKg", e.target.value)}
                className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:ring-1 focus:outline-none ${fieldErrors.currentWeightKg ? "border-red-300 focus:border-red-500 focus:ring-red-500" : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"}`}
              />
              {fieldErrors.currentWeightKg && <p className="mt-1 text-xs text-red-600">{fieldErrors.currentWeightKg}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Your height (cm) *</label>
              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                value={form.heightCm}
                onChange={(e) => set("heightCm", e.target.value)}
                className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:ring-1 focus:outline-none ${fieldErrors.heightCm ? "border-red-300 focus:border-red-500 focus:ring-red-500" : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"}`}
              />
              {fieldErrors.heightCm && <p className="mt-1 text-xs text-red-600">{fieldErrors.heightCm}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Age *</label>
              <input
                type="number"
                step="1"
                inputMode="numeric"
                value={form.age}
                onChange={(e) => set("age", e.target.value)}
                className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:ring-1 focus:outline-none ${fieldErrors.age ? "border-red-300 focus:border-red-500 focus:ring-red-500" : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"}`}
              />
              {fieldErrors.age && <p className="mt-1 text-xs text-red-600">{fieldErrors.age}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Sex *</label>
              <select
                value={form.biologicalSex}
                onChange={(e) => set("biologicalSex", e.target.value)}
                className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:ring-1 focus:outline-none ${fieldErrors.biologicalSex ? "border-red-300 focus:border-red-500 focus:ring-red-500" : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"}`}
              >
                <option value="">—</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
              {fieldErrors.biologicalSex && <p className="mt-1 text-xs text-red-600">{fieldErrors.biologicalSex}</p>}
            </div>
          </div>
        </div>

        {/* ── Section 2: Your goal ── */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex items-start gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white flex-shrink-0 mt-0.5">2</span>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Your goal</h2>
              <p className="mt-0.5 text-xs text-gray-400">What would you like to do? This affects how many calories you should eat each day.</p>
            </div>
          </div>

          {/* Goal preset cards */}
          <fieldset className="space-y-2">
            <legend className="sr-only">Choose your weight goal</legend>
            {GOAL_PRESETS.map((p) => (
              <label
                key={p.key}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                  goalPreset === p.key && !showCustomGoal
                    ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name="goalPreset"
                  value={p.key}
                  checked={goalPreset === p.key && !showCustomGoal}
                  onChange={() => selectGoalPreset(p.key)}
                  className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-900">{p.label}</span>
                  <span className="block text-xs text-gray-400">{p.desc}</span>
                </div>
              </label>
            ))}
          </fieldset>

          {/* Protein target */}
          <div className="pt-2 border-t border-gray-100">
            <label className="block text-sm font-medium text-gray-700">
              Daily protein target{!form.autoCalculateProteinGoal && " (g) *"}
            </label>
            {form.autoCalculateProteinGoal ? (
              <>
                <div className="mt-1.5 flex items-center gap-2 rounded-md border border-indigo-100 bg-indigo-50/60 px-3 py-2.5 text-sm">
                  <svg className="h-4 w-4 text-indigo-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  <span className="text-gray-600">
                    {estimate
                      ? <>We'll set this to about <strong className="text-gray-900">{estimate.protein} g</strong> based on your weight</>
                      : "Calculated automatically based on your weight"}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-gray-400">Protein helps you stay full and keep muscle while losing weight</p>
                <button type="button" onClick={() => set("autoCalculateProteinGoal", false)} className="mt-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                  I want to set my own →
                </button>
              </>
            ) : (
              <>
                <input
                  type="number"
                  step="1"
                  inputMode="numeric"
                  value={form.proteinGoalGrams}
                  onChange={(e) => set("proteinGoalGrams", e.target.value)}
                  placeholder="e.g. 130"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
                <p className="mt-1.5 text-xs text-gray-400">Protein helps you stay full and keep muscle while losing weight</p>
                <button type="button" onClick={() => set("autoCalculateProteinGoal", true)} className="mt-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                  ← Calculate this for me
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Section 3: Optional details ── */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex items-start gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white flex-shrink-0 mt-0.5">3</span>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Optional details</h2>
              <p className="mt-0.5 text-xs text-gray-400">These help us be more accurate, but you can skip anything you're unsure about.</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Country <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              type="text"
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
              placeholder="e.g. Mexico, Spain, USA"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-gray-400">We use this to better recognize local foods and brands — it helps us give more accurate calorie estimates</p>
          </div>

          {/* ── Advanced options (collapsible) ── */}
          <div className="pt-3 border-t border-gray-100">
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
              {showAdvanced ? "Hide advanced options" : "Advanced options"}
            </button>
            <p className="mt-1 text-xs text-gray-400">Fine-tune your setup if you know your exact numbers.</p>

            {showAdvanced && (
              <div className="mt-4 space-y-5">
                {/* Custom calorie adjustment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Daily calorie adjustment</label>
                  {!showCustomGoal ? (
                    <>
                      <div className="mt-1.5 flex items-center gap-2 rounded-md border border-indigo-100 bg-indigo-50/60 px-3 py-2.5 text-sm">
                        <svg className="h-4 w-4 text-indigo-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        <span className="text-gray-600">
                          Set by your goal: <strong className="text-gray-900">{form.dailyBaseGoalKcal} kcal/day</strong>
                        </span>
                      </div>
                      <button type="button" onClick={switchToCustomGoal} className="mt-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                        I want to set a custom value →
                      </button>
                    </>
                  ) : (
                    <>
                      <input
                        type="number"
                        step="1"
                        inputMode="numeric"
                        value={form.dailyBaseGoalKcal}
                        onChange={(e) => set("dailyBaseGoalKcal", e.target.value)}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                      <p className="mt-1 text-xs text-gray-400">Negative = eat less to lose weight (e.g. −500). Positive = eat more to gain weight.</p>
                      <button type="button" onClick={() => selectGoalPreset("lose-moderate")} className="mt-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                        ← Back to preset goals
                      </button>
                    </>
                  )}
                </div>

                {/* BMR override */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Calories your body burns at rest{!form.autoCalculateBMR && " (kcal) *"}
                  </label>
                  {form.autoCalculateBMR ? (
                    <>
                      <div className="mt-1.5 flex items-center gap-2 rounded-md border border-indigo-100 bg-indigo-50/60 px-3 py-2.5 text-sm">
                        <svg className="h-4 w-4 text-indigo-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        <span className="text-gray-600">
                          {estimate
                            ? <>Calculated at about <strong className="text-gray-900">{estimate.bmr.toLocaleString()} kcal/day</strong></>
                            : "Calculated automatically from your details"}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-gray-400">This is your base metabolism — most people let us calculate it</p>
                      <button type="button" onClick={() => set("autoCalculateBMR", false)} className="mt-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                        I know this value — let me enter it →
                      </button>
                    </>
                  ) : (
                    <>
                      <input
                        type="number"
                        step="1"
                        inputMode="numeric"
                        value={form.bmrKcal}
                        onChange={(e) => set("bmrKcal", e.target.value)}
                        placeholder="e.g. 1700"
                        className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:ring-1 focus:outline-none ${fieldErrors.bmrKcal ? "border-red-300 focus:border-red-500 focus:ring-red-500" : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"}`}
                      />
                      {fieldErrors.bmrKcal && <p className="mt-1 text-xs text-red-600">{fieldErrors.bmrKcal}</p>}
                      <p className="mt-1.5 text-xs text-gray-400">This is your base metabolism — most people let us calculate it</p>
                      <button type="button" onClick={() => set("autoCalculateBMR", true)} className="mt-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                        ← Calculate this for me
                      </button>
                    </>
                  )}
                </div>

                {/* Body fat override */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Estimated body fat <span className="text-gray-400 font-normal">(optional)</span>{!form.autoCalculateBodyFat && " — %"}
                  </label>
                  {form.autoCalculateBodyFat ? (
                    <>
                      <div className="mt-1.5 flex items-center gap-2 rounded-md border border-indigo-100 bg-indigo-50/60 px-3 py-2.5 text-sm">
                        <svg className="h-4 w-4 text-indigo-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        <span className="text-gray-600">
                          {estimate
                            ? <>Estimated at about <strong className="text-gray-900">{estimate.bodyFat.toFixed(1)}%</strong> from your details</>
                            : "Estimated automatically from your details"}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-gray-400">Totally optional — we'll estimate it in the background if needed</p>
                      <button type="button" onClick={() => set("autoCalculateBodyFat", false)} className="mt-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                        I know my body fat — let me enter it →
                      </button>
                    </>
                  ) : (
                    <>
                      <input
                        type="number"
                        step="0.1"
                        inputMode="decimal"
                        value={form.bodyFatPercent}
                        onChange={(e) => set("bodyFatPercent", e.target.value)}
                        placeholder="e.g. 25"
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                      <p className="mt-1.5 text-xs text-gray-400">Totally optional — you can leave this blank if you're not sure</p>
                      <button type="button" onClick={() => set("autoCalculateBodyFat", true)} className="mt-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                        ← Estimate this for me
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {estimate && (
          <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
              <h2 className="text-base font-semibold text-gray-900">Your current plan</h2>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">To maintain your weight</span>
                <span className="font-semibold text-gray-900">{estimate.maintenance.toLocaleString()} kcal/day</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">To reach your goal</span>
                <span className="font-semibold text-indigo-600">{estimate.dailyTarget.toLocaleString()} kcal/day</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Daily protein target</span>
                <span className="font-semibold text-gray-900">{estimate.protein} g</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 pt-3 border-t border-indigo-100">This is an estimate based on your current settings.</p>
          </div>
        )}

        <div className="space-y-3">
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            {saving ? "Saving..." : "Save profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
