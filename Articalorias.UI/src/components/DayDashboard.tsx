import { useEffect, useState, useCallback } from "react";
import { dailyLogService } from "@/services/dailyLogService";
import { foodService } from "@/services/foodService";
import { activityService } from "@/services/activityService";
import type {
  DailyDashboardResponse,
  FoodEntryResponse,
  UpdateFoodEntryRequest,
  ActivityEntryResponse,
  CreateActivityEntryRequest,
  UpdateActivityEntryRequest,
  ActivityTemplateResponse,
} from "@/types";
import { fmt } from "@/utils/format";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import EmptyState from "@/components/EmptyState";
import { extractApiError, isNotFound } from "@/utils/apiError";

interface DayDashboardProps {
  date: string;
}

export default function DayDashboard({ date }: DayDashboardProps) {
  const [dash, setDash] = useState<DailyDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    dailyLogService
      .getDashboard(date)
      .then(({ data }) => setDash(data))
      .catch((err) => {
        if (isNotFound(err)) {
          setDash(null);
        } else {
          setError(extractApiError(err, "Failed to load dashboard."));
        }
      })
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(load, [load]);

  if (loading) return <LoadingSpinner message="Loading day..." />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <DayProgress dash={dash} />
      <FoodInput date={date} onSaved={load} />
      <MealsTable date={date} foods={dash?.foodEntries ?? []} onChanged={load} />
      <ActivityInput date={date} onSaved={load} />
      <ActivitySection date={date} activities={dash?.activityEntries ?? []} onChanged={load} />
      <CalculationBreakdown dash={dash} />
    </div>
  );
}

/* --- Day's Progress --- */
function DayProgress({ dash }: { dash: DailyDashboardResponse | null }) {
  const [showDetails, setShowDetails] = useState(false);

  if (!dash) return <Card title="Day's Progress"><EmptyState message="No data for this day yet." /></Card>;

  const calRemaining = dash.caloriesRemainingToDailyTargetKcal;
  const calOver = calRemaining < 0;
  const calAbs = Math.abs(calRemaining);

  const protRemaining = dash.proteinRemainingGrams;
  const protOver = protRemaining < 0;
  const protAbs = Math.abs(protRemaining);

  return (
    <Card title="Day's Progress">
      <div className="space-y-3">
        {/* Calorie status */}
        <div className={`rounded-md px-4 py-3 text-sm font-medium ${calOver ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
          {calOver
            ? `You are ${fmt(calAbs)} kcal over the target.`
            : `${fmt(calAbs)} kcal remaining to target.`}
        </div>

        {/* Protein status */}
        <div className={`rounded-md px-4 py-3 text-sm font-medium ${protOver ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
          {protOver
            ? `${fmt(protAbs, 1)} g over the protein goal.`
            : `${fmt(protAbs, 1)} g of protein remaining.`}
        </div>

        {/* Expandable details */}
        <button
          onClick={() => setShowDetails((v) => !v)}
          className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          <svg
            className={`h-4 w-4 transition-transform ${showDetails ? "rotate-90" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          {showDetails ? "Hide details" : "Show details"}
        </button>

        {showDetails && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-100">
            <Stat label="Calories burned" value={`${fmt(dash.totalDailyExpenditureKcal)} kcal`} />
            <Stat label="Calories eaten" value={`${fmt(dash.totalFoodCaloriesKcal)} kcal`} />
            <Stat label="Daily target" value={`${fmt(dash.snapshotDailyBaseGoalKcal)} kcal`} />
            <Stat label="Adjusted daily target" value={`${fmt(dash.suggestedDailyAverageRemainingKcal)} kcal`} />
            <Stat label="Protein goal" value={`${fmt(dash.snapshotProteinGoalGrams, 1)} g`} />
            <Stat label="Protein eaten" value={`${fmt(dash.totalProteinGrams, 1)} g`} />
          </div>
        )}
      </div>
    </Card>
  );
}

/* --- Food Input (parse free text) --- */
function FoodInput({ date, onSaved }: { date: string; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await dailyLogService.parseFood(date, { freeText: text });
      if (!data.length) {
        setError("No food items were recognized. Try rephrasing.");
        return;
      }
      await dailyLogService.confirmParsedFoods(date, {
        items: data.map((p) => ({
          foodName: p.foodName,
          portionDescription: p.portionDescription,
          quantity: p.quantity,
          unit: p.unit,
          caloriesKcal: p.caloriesKcal,
          proteinGrams: p.proteinGrams,
          fatGrams: p.fatGrams,
          carbsGrams: p.carbsGrams,
          alcoholGrams: p.alcoholGrams,
          sourceType: "AI",
        })),
      });
      setText("");
      onSaved();
    } catch (err) {
      setError(extractApiError(err, "Failed to add food."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Add Food" subtitle="Describe what you ate in plain text — AI will log it for you">
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe what you ate, e.g. '2 eggs, 1 toast with butter, coffee with milk'"
          rows={2}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none resize-none"
        />
        <button
          onClick={handleAdd}
          disabled={busy || !text.trim()}
          className="self-end rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {busy ? "Adding..." : "Add"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Card>
  );
}

/* --- Activity Input (parse free text) --- */
function ActivityInput({ date, onSaved }: { date: string; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await dailyLogService.parseActivity(date, { freeText: text });
      if (!data.length) {
        setError("No activities were recognized. Try rephrasing.");
        return;
      }
      await dailyLogService.confirmParsedActivities(date, {
        items: data.map((p) => ({
          activityType: p.activityType,
          activityName: p.activityName,
          durationMinutes: p.durationMinutes,
          metValue: p.metValue,
          notes: p.notes,
          segments: p.segments.map((s) => ({
            segmentOrder: s.segmentOrder,
            segmentName: s.segmentName,
            metValue: s.metValue,
            durationMinutes: s.durationMinutes,
          })),
        })),
      });
      setText("");
      onSaved();
    } catch (err) {
      setError(extractApiError(err, "Failed to add activity."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Quick Add Activity" subtitle="Describe your activities in plain text — AI will log them for you">
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe your activities, e.g. '30 min running, 15 min stretching'"
          rows={2}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none resize-none"
        />
        <button
          onClick={handleAdd}
          disabled={busy || !text.trim()}
          className="self-end rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {busy ? "Adding..." : "Add"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Card>
  );
}

/* --- Meals Table --- */
function MealsTable({ date, foods, onChanged }: { date: string; foods: FoodEntryResponse[]; onChanged: () => void }) {
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<UpdateFoodEntryRequest | null>(null);
  const [busy, setBusy] = useState(false);

  function startEdit(f: FoodEntryResponse) {
    setEditId(f.foodEntryId);
    setEditForm({
      foodName: f.foodName,
      portionDescription: f.portionDescription,
      quantity: f.quantity,
      unit: f.unit,
      caloriesKcal: f.caloriesKcal,
      proteinGrams: f.proteinGrams,
      fatGrams: f.fatGrams,
      carbsGrams: f.carbsGrams,
      alcoholGrams: f.alcoholGrams,
      notes: f.notes,
    });
  }

  async function saveEdit() {
    if (!editForm || editId === null) return;
    setBusy(true);
    try {
      await foodService.update(date, editId, editForm);
      setEditId(null);
      setEditForm(null);
      onChanged();
    } catch { /* ignore */ }
    setBusy(false);
  }

  async function handleDelete(id: number) {
    setBusy(true);
    try {
      await foodService.remove(date, id);
      onChanged();
    } catch { /* ignore */ }
    setBusy(false);
  }

  return (
    <Card title="Meals">
      {foods.length === 0 ? (
        <EmptyState message="No meals logged yet." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col />
              <col className="w-16" />
              <col className="w-24" />
              <col className="w-16" />
              <col className="w-12" />
              <col className="w-12" />
              <col className="w-12" />
              <col className="w-12" />
              <col className="w-14" />
            </colgroup>
            <thead>
              <tr className="border-b text-left text-xs text-gray-500">
                <th className="pb-2 pr-2">Food</th>
                <th className="pb-2 pr-2 text-right">Qty</th>
                <th className="pb-2 pr-2">Portion</th>
                <th className="pb-2 pr-2 text-right">Kcal</th>
                <th className="pb-2 pr-2 text-right">Prot</th>
                <th className="pb-2 pr-2 text-right">Fat</th>
                <th className="pb-2 pr-2 text-right">Carbs</th>
                <th className="pb-2 pr-2 text-right">Alc</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {foods.map((f) =>
                editId === f.foodEntryId && editForm ? (
                  <tr key={f.foodEntryId} className="border-b border-gray-100 bg-indigo-50/30">
                    <td className="py-1.5 pr-2"><input value={editForm.foodName} onChange={(e) => setEditForm({ ...editForm, foodName: e.target.value })} className="w-full rounded border border-gray-200 px-1.5 py-1 text-sm" /></td>
                    <td className="py-1.5 pr-2"><input type="number" step="0.1" value={editForm.quantity ?? ""} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value ? +e.target.value : null })} className="w-full rounded border border-gray-200 px-1.5 py-1 text-right text-sm" /></td>
                    <td className="py-1.5 pr-2"><input value={editForm.portionDescription ?? ""} onChange={(e) => setEditForm({ ...editForm, portionDescription: e.target.value })} className="w-full rounded border border-gray-200 px-1.5 py-1 text-sm" /></td>
                    <td className="py-1.5 pr-2"><input type="number" value={editForm.caloriesKcal} onChange={(e) => setEditForm({ ...editForm, caloriesKcal: +e.target.value })} className="w-full rounded border border-gray-200 px-1.5 py-1 text-right text-sm" /></td>
                    <td className="py-1.5 pr-2"><input type="number" value={editForm.proteinGrams} onChange={(e) => setEditForm({ ...editForm, proteinGrams: +e.target.value })} className="w-full rounded border border-gray-200 px-1.5 py-1 text-right text-sm" /></td>
                    <td className="py-1.5 pr-2"><input type="number" value={editForm.fatGrams} onChange={(e) => setEditForm({ ...editForm, fatGrams: +e.target.value })} className="w-full rounded border border-gray-200 px-1.5 py-1 text-right text-sm" /></td>
                    <td className="py-1.5 pr-2"><input type="number" value={editForm.carbsGrams} onChange={(e) => setEditForm({ ...editForm, carbsGrams: +e.target.value })} className="w-full rounded border border-gray-200 px-1.5 py-1 text-right text-sm" /></td>
                    <td className="py-1.5 pr-2"><input type="number" value={editForm.alcoholGrams} onChange={(e) => setEditForm({ ...editForm, alcoholGrams: +e.target.value })} className="w-full rounded border border-gray-200 px-1.5 py-1 text-right text-sm" /></td>
                    <td className="py-1.5">
                      <div className="flex gap-1 justify-end">
                        <button onClick={saveEdit} disabled={busy} title="Save" className="text-green-600 hover:text-green-800 disabled:opacity-50"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button>
                        <button onClick={() => { setEditId(null); setEditForm(null); }} title="Cancel" className="text-gray-400 hover:text-gray-600"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={f.foodEntryId} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-1.5 pr-2 font-medium text-gray-800">{f.foodName}</td>
                    <td className="py-1.5 pr-2 text-right">{f.quantity != null ? fmt(f.quantity, 1) : "-"}</td>
                    <td className="py-1.5 pr-2 text-gray-500">{f.portionDescription ?? "-"}</td>
                    <td className="py-1.5 pr-2 text-right">{fmt(f.caloriesKcal)}</td>
                    <td className="py-1.5 pr-2 text-right">{fmt(f.proteinGrams, 1)}</td>
                    <td className="py-1.5 pr-2 text-right">{fmt(f.fatGrams, 1)}</td>
                    <td className="py-1.5 pr-2 text-right">{fmt(f.carbsGrams, 1)}</td>
                    <td className="py-1.5 pr-2 text-right">{fmt(f.alcoholGrams, 1)}</td>
                    <td className="py-1.5">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => startEdit(f)} title="Edit" className="text-indigo-500 hover:text-indigo-700"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                        <button onClick={() => handleDelete(f.foodEntryId)} disabled={busy} title="Delete" className="text-red-400 hover:text-red-600 disabled:opacity-50"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* --- Activity Section --- */
function ActivitySection({ date, activities, onChanged }: { date: string; activities: ActivityEntryResponse[]; onChanged: () => void }) {
  const [templates, setTemplates] = useState<ActivityTemplateResponse[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [autoMet, setAutoMet] = useState(true);
  const [estimatingMet, setEstimatingMet] = useState(false);
  const [metExplanation, setMetExplanation] = useState<string | null>(null);
  const [durationUnit, setDurationUnit] = useState<"minutes" | "hours">("minutes");
  const [editDurationUnit, setEditDurationUnit] = useState<"minutes" | "hours">("minutes");
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<UpdateActivityEntryRequest | null>(null);

  const [form, setForm] = useState<CreateActivityEntryRequest>({
    activityType: "MET_SIMPLE",
    activityName: "",
    durationMinutes: null,
    metValue: null,
    notes: null,
    segments: [],
  });

  useEffect(() => {
    activityService.getTemplates().then(({ data }) => setTemplates(data)).catch(() => {});
  }, []);

  function applyTemplate(id: string) {
    const t = templates.find((tpl) => tpl.activityTemplateId === +id);
    if (!t) return;
    setAutoMet(false);
    setMetExplanation(null);
    setForm({
      activityTemplateId: t.activityTemplateId,
      activityType: t.activityType,
      activityName: t.templateName,
      durationMinutes: t.defaultDurationMinutes,
      metValue: t.defaultMET,
      notes: null,
      segments: t.segments.map((s) => ({
        segmentOrder: s.segmentOrder,
        segmentName: s.segmentName,
        metValue: s.metValue,
        durationMinutes: s.durationMinutes,
      })),
    });
  }

  async function handleEstimateMet() {
    if (!form.activityName.trim()) return;
    setEstimatingMet(true);
    setMetExplanation(null);
    try {
      const { data } = await activityService.estimateMet({
        activityName: form.activityName,
        durationMinutes: form.durationMinutes,
      });
      setForm((prev) => ({ ...prev, metValue: data.metValue }));
      setMetExplanation(data.explanation);
    } catch { /* ignore */ }
    setEstimatingMet(false);
  }

  async function handleAdd() {
    if (!form.activityName.trim()) return;
    setBusy(true);
    let submitForm = { ...form };
    if (autoMet && !form.metValue) {
      setEstimatingMet(true);
      try {
        const { data } = await activityService.estimateMet({
          activityName: form.activityName,
          durationMinutes: form.durationMinutes,
        });
        submitForm = { ...submitForm, metValue: data.metValue };
      } catch { /* ignore */ }
      setEstimatingMet(false);
    }
    try {
      await activityService.create(date, submitForm);
      setShowAdd(false);
      setForm({ activityType: "MET_SIMPLE", activityName: "", durationMinutes: null, metValue: null, notes: null, segments: [] });
      setDurationUnit("minutes");
      setMetExplanation(null);
      onChanged();
    } catch { /* ignore */ }
    setBusy(false);
  }

  function startEditActivity(a: ActivityEntryResponse) {
    setEditId(a.activityEntryId);
    setEditDurationUnit("minutes");
    setEditForm({
      activityType: a.activityType,
      activityName: a.activityName,
      durationMinutes: a.durationMinutes,
      metValue: a.metValue,
      notes: a.notes,
      segments: a.segments.map((s) => ({
        segmentOrder: s.segmentOrder,
        segmentName: s.segmentName,
        metValue: s.metValue,
        durationMinutes: s.durationMinutes,
      })),
    });
  }

  async function saveEditActivity() {
    if (!editForm || editId === null) return;
    setBusy(true);
    try {
      await activityService.update(date, editId, editForm);
      setEditId(null);
      setEditForm(null);
      onChanged();
    } catch { /* ignore */ }
    setBusy(false);
  }

  async function handleDelete(id: number) {
    setBusy(true);
    try {
      await activityService.remove(date, id);
      onChanged();
    } catch { /* ignore */ }
    setBusy(false);
  }

  return (
    <Card title="Activities">
      {activities.length === 0 && !showAdd && <EmptyState message="No activities logged yet." />}

      {activities.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col />
              <col className="w-28" />
              <col className="w-16" />
              <col className="w-16" />
              <col className="w-14" />
            </colgroup>
            <thead>
              <tr className="border-b text-left text-xs text-gray-500">
                <th className="pb-2 pr-2">Activity</th>
                <th className="pb-2 pr-2 text-right">Duration</th>
                <th className="pb-2 pr-2 text-right">MET</th>
                <th className="pb-2 pr-2 text-right">Kcal</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a) =>
                editId === a.activityEntryId && editForm ? (
                  <tr key={a.activityEntryId} className="border-b border-gray-100 bg-indigo-50/30">
                    <td className="py-1.5 pr-2 font-medium text-gray-800 truncate">
                      {a.activityName}
                      {(a.isGlobalDefault || a.isFromSystemTemplate) && <span className="ml-1.5 text-xs text-amber-600 italic">modify only duration</span>}
                    </td>
                    <td className="py-1.5 pr-2">
                      <div className="flex gap-1 justify-end">
                        <input type="number" step={editDurationUnit === "hours" ? "0.25" : "1"} value={editForm.durationMinutes != null ? (editDurationUnit === "hours" ? +(editForm.durationMinutes / 60).toFixed(2) : editForm.durationMinutes) : ""} onChange={(e) => { const v = e.target.value ? +e.target.value : null; setEditForm({ ...editForm, durationMinutes: v != null ? (editDurationUnit === "hours" ? v * 60 : v) : null }); }} className="w-16 rounded border border-gray-200 px-1.5 py-1 text-right text-sm" />
                        <select value={editDurationUnit} onChange={(e) => setEditDurationUnit(e.target.value as "minutes" | "hours")} className="rounded border border-gray-200 px-1 py-1 text-xs">
                          <option value="minutes">min</option>
                          <option value="hours">hr</option>
                        </select>
                      </div>
                    </td>
                    <td className="py-1.5 pr-2 text-right">
                      {(a.isGlobalDefault || a.isFromSystemTemplate) ? (
                        <span className="text-gray-400 text-sm">{a.metValue != null ? a.metValue.toFixed(1) : "-"}</span>
                      ) : (
                        <input type="number" step="0.1" value={editForm.metValue ?? ""} onChange={(e) => setEditForm({ ...editForm, metValue: e.target.value ? +e.target.value : null })} className="w-full rounded border border-gray-200 px-1.5 py-1 text-right text-sm" />
                      )}
                    </td>
                    <td className="py-1.5 pr-2 text-right text-gray-400 text-xs italic">auto</td>
                    <td className="py-1.5">
                      <div className="flex gap-1 justify-end">
                        <button onClick={saveEditActivity} disabled={busy} title="Save" className="text-green-600 hover:text-green-800 disabled:opacity-50"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button>
                        <button onClick={() => { setEditId(null); setEditForm(null); }} title="Cancel" className="text-gray-400 hover:text-gray-600"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={a.activityEntryId} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-1.5 pr-2 font-medium text-gray-800 truncate">
                      {a.activityName}
                      {(a.isGlobalDefault || a.isFromSystemTemplate) && <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">default</span>}
                    </td>
                    <td className="py-1.5 pr-2 text-right">{a.durationMinutes != null ? (a.durationMinutes >= 60 ? `${+(a.durationMinutes / 60).toFixed(1)}h` : `${fmt(a.durationMinutes)} min`) : "-"}</td>
                    <td className="py-1.5 pr-2 text-right">{a.metValue != null ? fmt(a.metValue, 1) : "-"}</td>
                    <td className="py-1.5 pr-2 text-right">{fmt(a.calculatedCaloriesKcal)}</td>
                    <td className="py-1.5">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => startEditActivity(a)} title="Edit" className="text-indigo-500 hover:text-indigo-700"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                        <button onClick={() => handleDelete(a.activityEntryId)} disabled={busy} title="Delete" className="text-red-400 hover:text-red-600 disabled:opacity-50"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div className="mt-3 space-y-3 rounded-md border border-gray-200 bg-gray-50 p-4">
          {templates.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">From template</label>
              <select onChange={(e) => applyTemplate(e.target.value)} defaultValue="" className="rounded-md border border-gray-300 px-2 py-1.5 text-sm w-full">
                <option value="" disabled>Select a template...</option>
                {templates.filter((t) => t.isActive).map((t) => (
                  <option key={t.activityTemplateId} value={t.activityTemplateId}>{t.templateName}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500">Name *</label>
              <input value={form.activityName} onChange={(e) => setForm({ ...form, activityName: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Type</label>
              <select value={form.activityType} onChange={(e) => setForm({ ...form, activityType: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                <option value="MET_SIMPLE">MET Simple</option>
                <option value="MET_MULTIPLE">MET Multiple</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500">Duration</label>
              <div className="mt-1 flex gap-1">
                <input type="number" step={durationUnit === "hours" ? "0.25" : "1"} value={form.durationMinutes != null ? (durationUnit === "hours" ? +(form.durationMinutes / 60).toFixed(2) : form.durationMinutes) : ""} onChange={(e) => { const v = e.target.value ? +e.target.value : null; setForm({ ...form, durationMinutes: v != null ? (durationUnit === "hours" ? v * 60 : v) : null }); }} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                <select value={durationUnit} onChange={(e) => setDurationUnit(e.target.value as "minutes" | "hours")} className="rounded-md border border-gray-300 px-1 py-1.5 text-xs">
                  <option value="minutes">min</option>
                  <option value="hours">hr</option>
                </select>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-gray-500">MET</label>
                <label className="flex items-center gap-1 text-xs text-gray-400">
                  <input type="checkbox" checked={autoMet} onChange={(e) => { setAutoMet(e.target.checked); if (e.target.checked) { setForm({ ...form, metValue: null }); setMetExplanation(null); } }} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3 w-3" />
                  Auto
                </label>
              </div>
              {autoMet ? (
                <div className="mt-1 flex gap-1">
                  <input type="number" step="0.1" value={form.metValue ?? ""} readOnly placeholder="Auto" className="w-full rounded-md border border-gray-200 bg-gray-100 px-2 py-1.5 text-sm text-gray-500" />
                  <button type="button" onClick={handleEstimateMet} disabled={estimatingMet || !form.activityName.trim()} className="rounded-md bg-indigo-100 px-2 py-1.5 text-xs text-indigo-700 hover:bg-indigo-200 disabled:opacity-50 whitespace-nowrap">
                    {estimatingMet ? "..." : "Estimate"}
                  </button>
                </div>
              ) : (
                <input type="number" step="0.1" value={form.metValue ?? ""} onChange={(e) => setForm({ ...form, metValue: e.target.value ? +e.target.value : null })} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
              )}
              {metExplanation && <p className="mt-1 text-xs text-gray-400 italic">{metExplanation}</p>}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
            <button onClick={handleAdd} disabled={busy || !form.activityName.trim()} className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors">
              {busy ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-3">
        <button onClick={() => setShowAdd(!showAdd)} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
          {showAdd ? "" : "+ Add activity manually"}
        </button>
      </div>
    </Card>
  );
}


/* --- Calculation Breakdown --- */
function CalculationBreakdown({ dash }: { dash: DailyDashboardResponse | null }) {
  const [open, setOpen] = useState(false);

  if (!dash) return null;

  const d = dash;

  // TEF constants (mirror backend TefConstants)
  const kcalPerGProtein = 4;
  const kcalPerGFat = 9;
  const kcalPerGCarbs = 4;
  const kcalPerGAlcohol = 7;
  const tefProtein = 0.25;
  const tefFat = 0.02;
  const tefCarbs = 0.08;
  const tefAlcohol = 0.15;

  // Idle time constants
  const idleMet = 1.2;
  const restingMet = 1.0;

  // TEF sub-values
  const tefProteinKcal = d.totalProteinGrams * kcalPerGProtein * tefProtein;
  const tefFatKcal = d.totalFatGrams * kcalPerGFat * tefFat;
  const tefCarbsKcal = d.totalCarbsGrams * kcalPerGCarbs * tefCarbs;
  const tefAlcoholKcal = d.totalAlcoholGrams * kcalPerGAlcohol * tefAlcohol;

  return (
    <Card title="Calculation Breakdown" subtitle="All variables, constants, and formulas used for this day's numbers">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
      >
        <svg
          className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        {open ? "Hide breakdown" : "Show full breakdown"}
      </button>

      {open && (
        <div className="mt-4 space-y-6 text-sm">
          {/* ── System Constants ── */}
          <Section title="System Constants">
            <Row label="Kcal / g protein" value={`${kcalPerGProtein}`} />
            <Row label="Kcal / g fat" value={`${kcalPerGFat}`} />
            <Row label="Kcal / g carbs" value={`${kcalPerGCarbs}`} />
            <Row label="Kcal / g alcohol" value={`${kcalPerGAlcohol}`} />
            <Row label="TEF rate – protein" value={`${(tefProtein * 100).toFixed(0)}%`} />
            <Row label="TEF rate – fat" value={`${(tefFat * 100).toFixed(0)}%`} />
            <Row label="TEF rate – carbs" value={`${(tefCarbs * 100).toFixed(0)}%`} />
            <Row label="TEF rate – alcohol" value={`${(tefAlcohol * 100).toFixed(0)}%`} />
            <Row label="Idle MET" value={`${idleMet}`} />
            <Row label="Resting MET (in BMR)" value={`${restingMet}`} />
            <Row label="Weight-change factor" value="1 kg ≈ 7,700 kcal" />
          </Section>

          {/* ── Snapshot (profile values used) ── */}
          <Section title="Profile Snapshot (values used)">
            <Row label="Weight" value={`${fmt(d.snapshotWeightKg, 1)} kg`} />
            <Row label="Height" value={`${fmt(d.snapshotHeightCm, 1)} cm`} />
            <Row label="BMR" value={`${fmt(d.snapshotBMRKcal)} kcal`} />
            {d.snapshotBodyFatPercent != null && (
              <Row label="Body fat" value={`${fmt(d.snapshotBodyFatPercent, 1)}%`} />
            )}
            <Row label="Daily base goal" value={`${fmt(d.snapshotDailyBaseGoalKcal)} kcal`} />
            <Row label="Protein goal" value={`${fmt(d.snapshotProteinGoalGrams, 1)} g`} />
          </Section>

          {/* ── Intake ── */}
          <Section title="Intake (sum of food entries)">
            <Formula
              label="Total food calories"
              formula="Σ food.caloriesKcal"
              result={`${fmt(d.totalFoodCaloriesKcal)} kcal`}
            />
            <Formula
              label="Total protein"
              formula="Σ food.proteinGrams"
              result={`${fmt(d.totalProteinGrams, 1)} g`}
            />
            <Formula
              label="Total fat"
              formula="Σ food.fatGrams"
              result={`${fmt(d.totalFatGrams, 1)} g`}
            />
            <Formula
              label="Total carbs"
              formula="Σ food.carbsGrams"
              result={`${fmt(d.totalCarbsGrams, 1)} g`}
            />
            <Formula
              label="Total alcohol"
              formula="Σ food.alcoholGrams"
              result={`${fmt(d.totalAlcoholGrams, 1)} g`}
            />
          </Section>

          {/* ── Expenditure ── */}
          <Section title="Expenditure">
            <Formula
              label="Activity calories"
              formula="Σ activity.calculatedCaloriesKcal"
              result={`${fmt(d.totalActivityCaloriesKcal)} kcal`}
            />
            <Formula
              label="Hours remaining in day"
              formula="max(0, 24 − Σ activity.durationMinutes / 60)"
              result={`${fmt(d.hoursRemainingInDay, 2)} h`}
            />
            <Formula
              label="Idle-time calories"
              formula={`(${idleMet} − ${restingMet}) × ${fmt(d.snapshotWeightKg, 1)} kg × ${fmt(d.hoursRemainingInDay, 2)} h`}
              result={`${fmt(d.idleTimeCaloriesKcal)} kcal`}
            />
            <div className="pl-4 space-y-1 border-l-2 border-indigo-100">
              <p className="text-xs font-medium text-gray-500">TEF breakdown</p>
              <Formula
                label="Protein TEF"
                formula={`${fmt(d.totalProteinGrams, 1)} g × ${kcalPerGProtein} kcal/g × ${tefProtein}`}
                result={`${fmt(tefProteinKcal, 1)} kcal`}
              />
              <Formula
                label="Fat TEF"
                formula={`${fmt(d.totalFatGrams, 1)} g × ${kcalPerGFat} kcal/g × ${tefFat}`}
                result={`${fmt(tefFatKcal, 1)} kcal`}
              />
              <Formula
                label="Carbs TEF"
                formula={`${fmt(d.totalCarbsGrams, 1)} g × ${kcalPerGCarbs} kcal/g × ${tefCarbs}`}
                result={`${fmt(tefCarbsKcal, 1)} kcal`}
              />
              <Formula
                label="Alcohol TEF"
                formula={`${fmt(d.totalAlcoholGrams, 1)} g × ${kcalPerGAlcohol} kcal/g × ${tefAlcohol}`}
                result={`${fmt(tefAlcoholKcal, 1)} kcal`}
              />
            </div>
            <Formula
              label="Total TEF"
              formula="proteinTEF + fatTEF + carbsTEF + alcoholTEF"
              result={`${fmt(d.tefKcal)} kcal`}
            />
            <Formula
              label="Total daily expenditure"
              formula={`BMR (${fmt(d.snapshotBMRKcal)}) + activity (${fmt(d.totalActivityCaloriesKcal)}) + idle (${fmt(d.idleTimeCaloriesKcal)}) + TEF (${fmt(d.tefKcal)})`}
              result={`${fmt(d.totalDailyExpenditureKcal)} kcal`}
              highlight
            />
          </Section>

          {/* ── Balance ── */}
          <Section title="Balance & Remaining">
            <Formula
              label="Net balance"
              formula={`foodCalories (${fmt(d.totalFoodCaloriesKcal)}) − expenditure (${fmt(d.totalDailyExpenditureKcal)})`}
              result={`${fmt(d.netBalanceKcal)} kcal`}
              highlight
            />
            <Formula
              label="Daily goal delta"
              formula={`netBalance (${fmt(d.netBalanceKcal)}) − dailyBaseGoal (${fmt(d.snapshotDailyBaseGoalKcal)})`}
              result={`${fmt(d.dailyGoalDeltaKcal)} kcal`}
            />
            <Formula
              label="Calories remaining to target"
              formula={`(expenditure (${fmt(d.totalDailyExpenditureKcal)}) + dailyBaseGoal (${fmt(d.snapshotDailyBaseGoalKcal)})) − foodCalories (${fmt(d.totalFoodCaloriesKcal)})`}
              result={`${fmt(d.caloriesRemainingToDailyTargetKcal)} kcal`}
              highlight
            />
            <Formula
              label="Protein remaining"
              formula={`proteinGoal (${fmt(d.snapshotProteinGoalGrams, 1)}) − proteinEaten (${fmt(d.totalProteinGrams, 1)})`}
              result={`${fmt(d.proteinRemainingGrams, 1)} g`}
            />
          </Section>

          {/* ── Weekly Context ── */}
          <Section title="Weekly Context">
            <Row label="Week" value={`${d.weekStartDate} → ${d.weekEndDate}`} />
            <Formula
              label="Weekly target"
              formula={`dailyBaseGoal (${fmt(d.snapshotDailyBaseGoalKcal)}) × 7`}
              result={`${fmt(d.weeklyTargetKcal)} kcal`}
            />
            <Formula
              label="Weekly expected to date"
              formula="dailyBaseGoal × dayOfWeek"
              result={`${fmt(d.weeklyExpectedToDateKcal)} kcal`}
            />
            <Formula
              label="Weekly actual to date"
              formula="Σ weekLogs.netBalance"
              result={`${fmt(d.weeklyActualToDateKcal)} kcal`}
            />
            <Formula
              label="Weekly difference"
              formula="weeklyActual − weeklyExpected"
              result={`${fmt(d.weeklyDifferenceKcal)} kcal`}
            />
            <Formula
              label="Weekly remaining target"
              formula="weeklyTarget − weeklyActual"
              result={`${fmt(d.weeklyRemainingTargetKcal)} kcal`}
            />
            <Formula
              label="Suggested daily average remaining"
              formula="weeklyRemaining / daysRemaining"
              result={`${fmt(d.suggestedDailyAverageRemainingKcal)} kcal`}
            />
          </Section>
        </div>
      )}
    </Card>
  );
}

/* --- Breakdown helpers --- */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-indigo-500 mb-2">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}

function Formula({ label, formula, result, highlight }: { label: string; formula: string; result: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5">
      <div>
        <span className="text-gray-700 font-medium">{label}</span>
        <span className="ml-2 text-xs text-gray-400 font-mono">= {formula}</span>
      </div>
      <span className={`font-semibold whitespace-nowrap ${highlight ? "text-indigo-600" : "text-gray-800"}`}>{result}</span>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
      {subtitle && <p className="mb-4 text-xs text-gray-400">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-lg font-semibold ${accent ? "text-indigo-600" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}
