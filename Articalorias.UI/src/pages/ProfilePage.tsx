import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { profileService } from "@/services/profileService";
import type { UserProfileRequest, UserProfileResponse } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import { extractApiError } from "@/utils/apiError";

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    currentWeightKg: "",
    heightCm: "",
    age: "",
    biologicalSex: "",
    bmrKcal: "",
    bodyFatPercent: "",
    autoCalculateBMR: false,
    autoCalculateBodyFat: false,
    dailyBaseGoalKcal: "",
    proteinGoalGrams: "",
    autoCalculateProteinGoal: true,
    country: "",
  });

  useEffect(() => {
    profileService
      .get()
      .then(({ data }) => {
        setProfile(data);
        setForm({
          currentWeightKg: String(data.currentWeightKg),
          heightCm: String(data.heightCm),
          age: data.age != null ? String(data.age) : "",
          biologicalSex: data.biologicalSex ?? "",
          bmrKcal: String(data.bmrKcal),
          bodyFatPercent: data.bodyFatPercent != null ? String(data.bodyFatPercent) : "",
          autoCalculateBMR: data.autoCalculateBMR,
          autoCalculateBodyFat: data.autoCalculateBodyFat,
          dailyBaseGoalKcal: String(data.dailyBaseGoalKcal),
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
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const weight = parseFloat(form.currentWeightKg);
    const height = parseFloat(form.heightCm);

    if (!weight || !height) {
      setError("Weight and height are required.");
      return;
    }

    if ((form.autoCalculateBMR || form.autoCalculateBodyFat) && (!form.age || !form.biologicalSex)) {
      setError("Age and biological sex are required for auto-calculations.");
      return;
    }

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
      setForm({
        currentWeightKg: String(updated.currentWeightKg),
        heightCm: String(updated.heightCm),
        age: updated.age != null ? String(updated.age) : "",
        biologicalSex: updated.biologicalSex ?? "",
        bmrKcal: String(updated.bmrKcal),
        bodyFatPercent: updated.bodyFatPercent != null ? String(updated.bodyFatPercent) : "",
        autoCalculateBMR: updated.autoCalculateBMR,
        autoCalculateBodyFat: updated.autoCalculateBodyFat,
        dailyBaseGoalKcal: String(updated.dailyBaseGoalKcal),
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
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
      <p className="mt-1 text-sm text-gray-500">View and edit your physiological data and goals.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">Profile saved successfully.</div>}

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Weight (kg) *</label>
              <input type="number" step="0.1" value={form.currentWeightKg} onChange={(e) => set("currentWeightKg", e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Height (cm) *</label>
              <input type="number" step="0.1" value={form.heightCm} onChange={(e) => set("heightCm", e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Age</label>
              <input type="number" step="1" value={form.age} onChange={(e) => set("age", e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Biological sex</label>
              <select value={form.biologicalSex} onChange={(e) => set("biologicalSex", e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none">
                <option value="">—</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                 </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Country</label>
                <input type="text" value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="e.g. Mexico, Spain, USA" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
                <p className="mt-1 text-xs text-gray-400">Used for better food calorie estimation</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">BMR (kcal){!form.autoCalculateBMR ? " *" : ""}</label>
            <input type="number" step="1" value={form.bmrKcal} onChange={(e) => set("bmrKcal", e.target.value)} disabled={form.autoCalculateBMR} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400" />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.autoCalculateBMR} onChange={(e) => set("autoCalculateBMR", e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            Auto-calculate BMR (Mifflin–St Jeor)
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700">Body fat %</label>
            <input type="number" step="0.1" value={form.bodyFatPercent} onChange={(e) => set("bodyFatPercent", e.target.value)} disabled={form.autoCalculateBodyFat} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400" />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.autoCalculateBodyFat} onChange={(e) => set("autoCalculateBodyFat", e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            Auto-calculate body fat % (Deurenberg)
          </label>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Daily goal (kcal)</label>
              <input type="number" step="1" value={form.dailyBaseGoalKcal} onChange={(e) => set("dailyBaseGoalKcal", e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
              <p className="mt-1 text-xs text-gray-400">Negative = deficit</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Protein goal (g)</label>
              <input type="number" step="1" value={form.proteinGoalGrams} onChange={(e) => set("proteinGoalGrams", e.target.value)} disabled={form.autoCalculateProteinGoal} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.autoCalculateProteinGoal} onChange={(e) => set("autoCalculateProteinGoal", e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            Auto-calculate protein goal from weight
          </label>
        </div>

        <button type="submit" disabled={saving} className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors">
          {saving ? "Saving..." : "Save profile"}
        </button>
      </form>
    </div>
  );
}
