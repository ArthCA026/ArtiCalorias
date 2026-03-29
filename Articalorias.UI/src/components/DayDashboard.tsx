import { useEffect, useState, useCallback, useMemo } from "react";
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
  ActivityTemplateRequest,
} from "@/types";
import { fmt, toDateString } from "@/utils/format";
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
  const isToday = useMemo(() => date === toDateString(), [date]);

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
    <div className="space-y-3">
      {/* Primary — most important */}
      <DayProgress dash={dash} isToday={isToday} />
      {isToday && <NextActionHint dash={dash} />}

      {/* Secondary — core daily actions */}
      <FoodInput date={date} onSaved={load} isToday={isToday} />
      <MealsTable date={date} foods={dash?.foodEntries ?? []} onChanged={load} isToday={isToday} />

      {/* Medium — activities */}
      <ActivityInput date={date} onSaved={load} isToday={isToday} />
      <ActivitySection date={date} activities={dash?.activityEntries ?? []} onChanged={load} isToday={isToday} />

      {/* Tertiary — advanced / reference */}
      <CalculationBreakdown dash={dash} isToday={isToday} />
    </div>
  );
}

/* --- Day's Progress --- */
function DayProgress({ dash, isToday }: { dash: DailyDashboardResponse | null; isToday: boolean }) {
  const [showDetails, setShowDetails] = useState(false);

  if (!dash) return <Card title={isToday ? "How you're doing today" : "How this day went"} variant="primary"><EmptyState message={isToday ? "Nothing logged yet — add your first meal to get started!" : "Nothing was logged for this day."} /></Card>;

  const calRemaining = dash.caloriesRemainingToDailyTargetKcal;
  const calOver = calRemaining < 0;
  const calAbs = Math.abs(calRemaining);

  const protRemaining = dash.proteinRemainingGrams;
  const protGoalReached = protRemaining <= 0;
  const protAbs = Math.abs(protRemaining);

  // Status line — a quick, human-friendly take on the numbers
  const foodCal = dash.totalFoodCaloriesKcal;
  const dailyBudget = foodCal + calRemaining;
  const usedPct = !calOver && dailyBudget > 0 ? foodCal / dailyBudget : 0;
  const calPctDisplay = dailyBudget > 0 ? Math.round((foodCal / dailyBudget) * 100) : 0;
  const protPct = dash.snapshotProteinGoalGrams > 0 ? dash.totalProteinGrams / dash.snapshotProteinGoalGrams : 1;
  const protPctDisplay = Math.round(protPct * 100);
  const activityCount = dash.activityEntries.length;

  // Goal delta for past-day verdict
  const goalDelta = dash.dailyGoalDeltaKcal;
  const hitGoal = goalDelta <= 0;
  const deltaAbs = Math.abs(goalDelta);

  let statusText: string;
  if (isToday) {
    if (foodCal === 0) {
      statusText = "Start by logging your first meal or snack";
    } else if (calOver) {
      statusText = "You're above today's target — that's okay, every day is a chance to adjust";
    } else if (usedPct > 0.5 && protPct < 0.4) {
      statusText = "Protein is still low — try adding some protein-rich foods";
    } else if (usedPct < 0.25) {
      statusText = "You still have plenty of room for today";
    } else if (usedPct < 0.75) {
      statusText = "You're on track — keep going!";
    } else {
      statusText = "You're getting close to your calorie target — nice work!";
    }
  } else {
    if (foodCal === 0) {
      statusText = "No meals were logged for this day";
    } else if (hitGoal) {
      statusText = deltaAbs > 200
        ? `You were ${fmt(deltaAbs)} kcal under your target — great discipline`
        : "You were right on target — well done";
    } else {
      statusText = deltaAbs > 200
        ? `You were ${fmt(deltaAbs)} kcal over your target — it happens, the weekly picture is what counts`
        : `You were slightly over your target — close enough`;
    }
  }

  return (
    <Card title={isToday ? "How you're doing today" : "How this day went"} variant="primary">
      <div className="space-y-2.5">
        {/* Coaching / verdict status line */}
        <p className="text-sm text-gray-500 italic">{statusText}</p>

        {/* Calorie progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{isToday ? "Today's calorie budget" : "Calorie budget"}</p>
            <p className="text-xs tabular-nums text-gray-400"><span className={`font-semibold ${calOver ? "text-amber-500" : "text-gray-500"}`}>{calPctDisplay}%</span> <span className="mx-0.5 text-gray-300">·</span> {fmt(foodCal)} of {fmt(dailyBudget)} kcal {isToday ? "spent" : "eaten"}</p>
          </div>
          <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={foodCal} aria-valuemin={0} aria-valuemax={dailyBudget} aria-label="Calorie budget progress">
            <div className={`h-full rounded-full transition-all duration-500 ${calOver ? "bg-amber-400" : "bg-green-500"}`} style={{ width: `${calOver ? 100 : Math.min(Math.round(usedPct * 100), 100)}%` }} />
          </div>
          <p className={`text-sm font-medium ${calOver ? "text-amber-600" : "text-green-700"}`}>
            {isToday
              ? (calOver ? `${fmt(calAbs)} kcal over your budget` : `${fmt(calAbs)} kcal left in your budget`)
              : (calOver ? `${fmt(calAbs)} kcal over budget` : `${fmt(calAbs)} kcal under budget`)}
          </p>
          {calOver && isToday && (
            <p className="text-xs text-amber-500/80 italic">One day over doesn't derail your progress — it all balances out over the week</p>
          )}
        </div>

        {/* Protein progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500" title="Eating enough protein helps you feel full longer and protect muscle">Protein goal</p>
            <p className="text-xs tabular-nums text-gray-400"><span className={`font-semibold ${protGoalReached ? "text-green-600" : "text-indigo-500"}`}>{protPctDisplay}%</span> <span className="mx-0.5 text-gray-300">·</span> {fmt(dash.totalProteinGrams, 1)} of {fmt(dash.snapshotProteinGoalGrams, 1)} g goal</p>
          </div>
          <div className="h-2.5 rounded-full bg-indigo-50 overflow-hidden" role="progressbar" aria-valuenow={dash.totalProteinGrams} aria-valuemin={0} aria-valuemax={dash.snapshotProteinGoalGrams} aria-label="Protein goal progress">
            <div className={`h-full rounded-full transition-all duration-500 ${protGoalReached ? "bg-green-500" : "bg-indigo-500"}`} style={{ width: `${Math.min(Math.round(protPct * 100), 100)}%` }} />
          </div>
          <p className={`text-sm font-medium ${protGoalReached ? "text-green-700" : "text-indigo-600"}`}>
            {protGoalReached
              ? `Goal reached!${protAbs > 0 ? ` ${fmt(protAbs, 1)} g extra` : ""} — nice work`
              : (isToday ? `${fmt(protAbs, 1)} g to go` : `${fmt(protAbs, 1)} g short of goal`)}
          </p>
          {isToday && <p className="text-xs text-gray-400 italic">Protein helps you stay fuller for longer and keeps your muscles strong</p>}
        </div>

        {isToday && <p className="text-[11px] text-gray-400">These are estimates — they adjust as you log food and activity throughout the day</p>}

        {/* Expandable details */}
        <button
          onClick={() => setShowDetails((v) => !v)}
          aria-expanded={showDetails}
          aria-controls="day-progress-details"
          className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
        >
          <svg
            className={`h-4 w-4 transition-transform ${showDetails ? "rotate-90" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          {showDetails ? "Hide the numbers" : "See the numbers"}
        </button>

        {showDetails && (
          <div id="day-progress-details" role="region" aria-label="Detailed daily numbers" className="space-y-4 pt-2.5 border-t border-gray-100">
            {/* Summary */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">{isToday ? "Today so far" : "This day's totals"}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Stat label="Calories eaten" value={`${fmt(dash.totalFoodCaloriesKcal)} kcal`} />
                <Stat label="Protein eaten" value={`${fmt(dash.totalProteinGrams, 1)} g`} />
                {activityCount > 0 && (
                  <Stat label="Activities logged" value={`${activityCount}`} />
                )}
                <div>
                  <p className="text-xs text-gray-400">Net balance</p>
                  <p className={`text-lg font-semibold ${dash.netBalanceKcal <= 0 ? "text-green-700" : "text-amber-600"}`}>
                    {fmt(Math.abs(dash.netBalanceKcal))} kcal {dash.netBalanceKcal <= 0 ? "under" : "over"}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Calories eaten minus all calories burned</p>
                </div>
              </div>
            </div>

            {/* How the target is calculated / how the day compared */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                {isToday ? "How your target is calculated" : "How this day compared"}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <Stat label="Calories your body uses" value={`${fmt(dash.totalDailyExpenditureKcal)} kcal`} />
                  <p className="text-[11px] text-gray-400 mt-0.5">Includes rest, movement, and exercise</p>
                </div>
                <div>
                  <Stat label="Your weight goal" value={`${fmt(dash.snapshotDailyBaseGoalKcal)} kcal`} />
                  <p className="text-[11px] text-gray-400 mt-0.5">Daily calorie adjustment for your goal</p>
                </div>
                {isToday ? (
                  <div>
                    <Stat label="Today's calorie budget" value={`${fmt(dash.suggestedDailyAverageRemainingKcal)} kcal`} />
                    <p className="text-[11px] text-gray-400 mt-0.5">Adjusted based on how your week is going</p>
                  </div>
                ) : (
                  <div>
                    <Stat label="vs. daily goal" value={`${hitGoal ? "" : "+"}${fmt(goalDelta)} kcal`} />
                    <p className="text-[11px] text-gray-400 mt-0.5">{hitGoal ? "Under your target" : "Over your target"}</p>
                  </div>
                )}
                <div>
                  <Stat label="Protein goal" value={`${fmt(dash.snapshotProteinGoalGrams, 1)} g`} />
                  <p className="text-[11px] text-gray-400 mt-0.5">Eating enough protein helps you feel full longer and protect muscle as you lose weight</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

/* --- Next Action Hint --- */
function NextActionHint({ dash }: { dash: DailyDashboardResponse | null }) {
  let hint: string;

  if (!dash || dash.foodEntries.length === 0) {
    hint = "Log your first meal or snack to get started";
  } else if (dash.foodEntries.length === 1) {
    hint = "Add your next meal or snack when you're ready";
  } else {
    const hasUserActivities = dash.activityEntries.some(
      (a) => !a.isGlobalDefault && !a.isFromSystemTemplate,
    );
    if (!hasUserActivities) {
      hint = "Log a workout or activity if you did one today";
    } else if (dash.caloriesRemainingToDailyTargetKcal > 200) {
      hint = "Check your remaining calories before your next meal";
    } else {
      return null;
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg bg-indigo-50/60 px-3.5 py-2 text-sm text-indigo-700">
      <span className="font-semibold text-indigo-600">Next:</span>
      <span>{hint}</span>
    </div>
  );
}

/* ─── SVG Icon Helpers ─── */
function IconUtensils({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
    </svg>
  );
}

function IconEdit({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconTrash({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function IconCheck({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconX({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconBookmark({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconBookmarkFilled({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

/* --- Food Input (parse free text) --- */
function FoodInput({ date, onSaved, isToday }: { date: string; onSaved: () => void; isToday: boolean }) {
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
        setError("We couldn't recognize any food. Try describing it a bit differently.");
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
      setError(extractApiError(err, "Something went wrong adding your food. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <Card
      title={isToday ? "Log food" : "Add food"}
      subtitle={isToday ? "Describe what you ate — we'll estimate the calories for you" : "Add what you ate that day — we'll estimate the calories"}
      icon={<IconUtensils className="w-5 h-5" />}
    >
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isToday ? 'e.g. "2 eggs and toast with butter"' : 'e.g. "2 eggs and toast with butter"'}
          className="flex-1 rounded-lg border border-gray-300 bg-gray-50/50 px-4 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-colors"
          aria-label={isToday ? "Describe the food you ate" : "Describe the food you ate that day"}
        />
        <button
          onClick={handleAdd}
          disabled={busy || !text.trim()}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors sm:w-auto w-full"
        >
          {busy ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Logging…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Log
            </>
          )}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-gray-400">You can always edit entries later if the numbers aren't quite right</p>
      {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}
    </Card>
  );
}

/* --- Activity Input (parse free text) --- */
interface LastLoggedActivity {
  activityName: string;
  activityType: string;
  durationMinutes: number | null;
  metValue: number | null;
  segments: { segmentOrder: number; segmentName: string; metValue: number; durationMinutes: number }[];
}

function ActivityInput({ date, onSaved, isToday }: { date: string; onSaved: () => void; isToday: boolean }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLogged, setLastLogged] = useState<LastLoggedActivity[] | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [editingTemplateName, setEditingTemplateName] = useState(false);
  const [templateName, setTemplateName] = useState("");

  // Auto-dismiss the template prompt after 8s if the user ignores it
  useEffect(() => {
    if (!lastLogged || editingTemplateName) return;
    const id = setTimeout(() => setLastLogged(null), 8000);
    return () => clearTimeout(id);
  }, [lastLogged, editingTemplateName]);

  // Auto-dismiss the success confirmation after 4s
  useEffect(() => {
    if (!templateSaved) return;
    const id = setTimeout(() => setTemplateSaved(false), 4000);
    return () => clearTimeout(id);
  }, [templateSaved]);

  async function handleAdd() {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    setLastLogged(null);
    setTemplateSaved(false);
    setEditingTemplateName(false);
    setTemplateName("");
    try {
      const { data } = await dailyLogService.parseActivity(date, { freeText: text });
      if (!data.length) {
        setError("We couldn't recognize the activity. Try describing it differently.");
        return;
      }
      const items = data.map((p) => ({
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
      }));
      await dailyLogService.confirmParsedActivities(date, { items });
      setLastLogged(data.map((p) => ({
        activityName: p.activityName,
        activityType: p.activityType,
        durationMinutes: p.durationMinutes,
        metValue: p.metValue,
        segments: p.segments.map((s) => ({
          segmentOrder: s.segmentOrder,
          segmentName: s.segmentName,
          metValue: s.metValue,
          durationMinutes: s.durationMinutes,
        })),
      })));
      setText("");
      onSaved();
    } catch (err) {
      setError(extractApiError(err, "Something went wrong adding your activity. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  function startTemplateSave() {
    if (!lastLogged?.length) return;
    setTemplateName(lastLogged.length === 1 ? lastLogged[0].activityName : "");
    setEditingTemplateName(true);
  }

  async function confirmTemplateSave() {
    if (!lastLogged?.length) return;
    const name = templateName.trim();
    if (!name && lastLogged.length === 1) return;
    setSavingTemplate(true);
    try {
      for (const a of lastLogged) {
        const req: ActivityTemplateRequest = {
          templateScope: "USER",
          activityType: a.activityType,
          templateName: lastLogged.length === 1 ? name : a.activityName,
          autoAddToNewDay: false,
          defaultDurationMinutes: a.durationMinutes,
          defaultMET: a.metValue,
          segments: a.segments,
        };
        await activityService.createTemplate(req);
      }
      setTemplateSaved(true);
      setLastLogged(null);
      setEditingTemplateName(false);
      setTemplateName("");
    } catch { /* ignore */ }
    setSavingTemplate(false);
  }

  function dismissTemplatePrompt() {
    setLastLogged(null);
    setTemplateSaved(false);
    setEditingTemplateName(false);
    setTemplateName("");
  }

  return (
    <Card title={isToday ? "Log activity" : "Add activity"} subtitle={isToday ? "Describe what you did and for how long — we'll estimate calories for you" : "Add what you did that day — we'll estimate the calories"}>
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. '30 min walking, 20 min cleaning'"
          rows={2}
          aria-label="Describe the activity you did"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none resize-none"
        />
        <button
          onClick={handleAdd}
          disabled={busy || !text.trim()}
          className="self-end rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          {busy ? "Logging..." : "Log"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}

      {/* Post-success template prompt — step 1: subtle suggestion */}
      {lastLogged && !templateSaved && !editingTemplateName && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-indigo-50/40 px-3 py-2 text-sm text-indigo-600">
          <IconBookmark className="w-3.5 h-3.5 flex-shrink-0 text-indigo-400" />
          <span className="flex-1 text-gray-500">Do this often?</span>
          <button
            onClick={startTemplateSave}
            className="text-xs font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-800 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
          >
            Save as template
          </button>
          <button
            onClick={dismissTemplatePrompt}
            aria-label="Dismiss"
            className="rounded-md p-0.5 text-gray-300 hover:text-gray-500 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
          >
            <IconX className="w-3 h-3" />
          </button>
        </div>
      )}
      {/* Step 2: inline name input (only after user opts in) */}
      {lastLogged && editingTemplateName && (
        <div className="mt-2 rounded-lg bg-indigo-50/50 px-3 py-2.5 space-y-2">
          <label className="block text-xs font-medium text-gray-500">Name your template</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmTemplateSave(); if (e.key === "Escape") dismissTemplatePrompt(); }}
              autoFocus
              placeholder="e.g. Morning run"
              aria-label="Template name"
              className="flex-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
            <button
              onClick={confirmTemplateSave}
              disabled={savingTemplate || !templateName.trim()}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
            >
              {savingTemplate ? "Saving…" : "Save"}
            </button>
            <button
              onClick={dismissTemplatePrompt}
              className="rounded-md px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {/* Compact success confirmation (auto-dismisses after 4s) */}
      {templateSaved && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-green-50/40 px-3 py-1.5 text-xs text-green-600">
          <IconCheck className="w-3.5 h-3.5 flex-shrink-0 text-green-500" />
          <span>Saved — you'll find it in the activity list next time.</span>
        </div>
      )}
    </Card>
  );
}

/* ─── Nutrition Summary Chips ─── */
function NutritionSummary({ foods, isToday }: { foods: FoodEntryResponse[]; isToday: boolean }) {
  const totals = foods.reduce(
    (acc, f) => ({
      kcal: acc.kcal + f.caloriesKcal,
      protein: acc.protein + f.proteinGrams,
      fat: acc.fat + f.fatGrams,
      carbs: acc.carbs + f.carbsGrams,
    }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0 },
  );

  const chips: { label: string; value: string; color: string; title?: string }[] = [
    { label: "Kcal", value: fmt(totals.kcal), color: "bg-amber-50 text-amber-700 ring-amber-200" },
    { label: "Protein", value: `${fmt(totals.protein, 1)}g`, color: "bg-blue-50 text-blue-700 ring-blue-200", title: "Protein helps you stay full and preserve muscle" },
    { label: "Carbs", value: `${fmt(totals.carbs, 1)}g`, color: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
    { label: "Fat", value: `${fmt(totals.fat, 1)}g`, color: "bg-orange-50 text-orange-700 ring-orange-200" },
  ];

  return (
    <div className="mb-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-1.5">{isToday ? "Logged so far today" : "Logged for this day"}</p>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <span
            key={c.label}
            title={c.title}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${c.color}`}
          >
            {c.label}
            <span className="font-bold">{c.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Activity Summary Chips ─── */
function ActivitySummary({ activities, isToday }: { activities: ActivityEntryResponse[]; isToday: boolean }) {
  const totalKcal = activities.reduce((s, a) => s + a.calculatedCaloriesKcal, 0);
  const totalMin = activities.reduce((s, a) => s + (a.durationMinutes ?? 0), 0);
  const count = activities.length;

  const burnedColor = totalKcal >= 0
    ? "bg-rose-50 text-rose-700 ring-rose-200"
    : "bg-blue-50 text-blue-700 ring-blue-200";

  const chips: { label: string; value: string; color: string }[] = [
    { label: "Net activity", value: `${fmt(totalKcal)} kcal`, color: burnedColor },
    { label: "Duration", value: totalMin >= 60 ? `${+(totalMin / 60).toFixed(1)}h` : `${fmt(totalMin)} min`, color: "bg-sky-50 text-sky-700 ring-sky-200" },
    { label: "Activities", value: `${count}`, color: "bg-violet-50 text-violet-700 ring-violet-200" },
  ];

  return (
    <div className="mb-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-1.5">{isToday ? "Activity so far today" : "Activity for this day"}</p>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <span
            key={c.label}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${c.color}`}
          >
            {c.label}
            <span className="font-bold">{c.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Activity Coverage Summary ─── */
function ActivityCoverage({ activities }: { activities: ActivityEntryResponse[] }) {
  const totalMin = activities.reduce((s, a) => s + (a.durationMinutes ?? 0), 0);
  const accountedHours = +(totalMin / 60).toFixed(1);

  return (
    <div className="mb-4 space-y-1.5">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400" title="Includes logged activities and any auto-included ones like sleep or daily movement">Activity coverage</p>
        <p className="text-xs tabular-nums text-gray-400"><span className="font-semibold text-gray-500">{Math.round((accountedHours / 24) * 100)}%</span> <span className="mx-0.5 text-gray-300">·</span> {accountedHours} of 24 h</p>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={accountedHours} aria-valuemin={0} aria-valuemax={24} aria-label="Activity coverage">
        <div className="h-full rounded-full bg-slate-300 transition-all duration-500" style={{ width: `${Math.min(Math.round((accountedHours / 24) * 100), 100)}%` }} />
      </div>
      <p className="text-[11px] text-gray-400">The rest of the day calories are estimated from your baseline activity level</p>
    </div>
  );
}

/* ─── Activity Mobile Card (single activity entry) ─── */
function ActivityMobileCard({
  a,
  onEdit,
  onDelete,
  onSaveTemplate,
  onRemoveTemplate,
  isSavedTemplate,
  busy,
}: {
  a: ActivityEntryResponse;
  onEdit: () => void;
  onDelete: () => void;
  onSaveTemplate: () => void;
  onRemoveTemplate: () => void;
  isSavedTemplate: boolean;
  busy: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 text-sm leading-snug">{a.activityName}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {a.durationMinutes != null ? (a.durationMinutes >= 60 ? `${+(a.durationMinutes / 60).toFixed(1)}h` : `${fmt(a.durationMinutes)} min`) : "\u2013"}
          </p>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          {isSavedTemplate ? (
            <button onClick={onRemoveTemplate} disabled={busy} title="Remove template" aria-label={`Remove ${a.activityName} template`} className="rounded-md p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"><IconBookmarkFilled className="w-4 h-4" /></button>
          ) : (
            <button onClick={onSaveTemplate} disabled={busy} title="Save as template" aria-label={`Save ${a.activityName} as template`} className="rounded-md p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"><IconBookmark className="w-4 h-4" /></button>
          )}
          <button onClick={onEdit} title="Edit" aria-label={`Edit ${a.activityName}`} className="rounded-md p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"><IconEdit className="w-4 h-4" /></button>
          <button onClick={onDelete} disabled={busy} title="Delete" aria-label={`Delete ${a.activityName}`} className="rounded-md p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"><IconTrash className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-50">
        <MobileStat label={a.calculatedCaloriesKcal < 0 ? "Below resting" : "Burned"} value={`${fmt(a.calculatedCaloriesKcal)} kcal`} accent />
        <MobileStat label="Duration" value={a.durationMinutes != null ? (a.durationMinutes >= 60 ? `${+(a.durationMinutes / 60).toFixed(1)}h` : `${fmt(a.durationMinutes)} min`) : "\u2013"} />
      </div>
    </div>
  );
}

/* ─── Meal Mobile Card (single food entry) ─── */
function MealMobileCard({
  f,
  onEdit,
  onDelete,
  busy,
}: {
  f: FoodEntryResponse;
  onEdit: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 text-sm leading-snug">{f.foodName}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {f.quantity != null ? fmt(f.quantity, 1) : "\u2013"}{" "}
            <span className="text-gray-300">&middot;</span>{" "}
            {f.portionDescription ?? "\u2013"}
          </p>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <button
            onClick={onEdit}
            title="Edit"
            aria-label={`Edit ${f.foodName}`}
            className="rounded-md p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
          >
            <IconEdit className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            disabled={busy}
            title="Delete"
            aria-label={`Delete ${f.foodName}`}
            className="rounded-md p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
          >
            <IconTrash className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-gray-50">
        <MobileStat label={f.quantity != null && f.quantity > 1 ? "Total kcal" : "Kcal"} value={fmt(f.caloriesKcal)} accent />
        <MobileStat label="Prot" value={fmt(f.proteinGrams, 1)} />
        <MobileStat label="Fat" value={fmt(f.fatGrams, 1)} />
        <MobileStat label="Carbs" value={fmt(f.carbsGrams, 1)} />
      </div>
    </div>
  );
}

function MobileStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`text-sm font-semibold ${accent ? "text-gray-900" : "text-gray-600"}`}>{value}</p>
    </div>
  );
}

/* --- Meals Table --- */
function MealsTable({ date, foods, onChanged, isToday }: { date: string; foods: FoodEntryResponse[]; onChanged: () => void; isToday: boolean }) {
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
    <Card
      title="Your meals"
      icon={
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12h20" /><path d="M20 12c0-4.4-3.6-8-8-8s-8 3.6-8 8" /><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
        </svg>
      }
    >
      {foods.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm font-medium text-gray-500">No meals logged yet</p>
          <p className="mt-1 text-sm text-gray-400">Describe what you ate in the box above — even a rough description works</p>
          <p className="mt-3 text-xs text-gray-400 italic">Try something like: "2 eggs, toast with butter, and a coffee with milk"</p>
        </div>
      ) : (
        <>
          {/* Nutrition summary chips */}
          <NutritionSummary foods={foods} isToday={isToday} />

          {/* ── Desktop table (hidden on small screens) ── */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full text-sm">
              <colgroup>
                <col />
                <col className="w-14" />
                <col className="w-24" />
                <col className="w-16" />
                <col className="w-14" />
                <col className="w-14" />
                <col className="w-14" />
                <col className="w-12" />
                <col className="w-24" />
              </colgroup>
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-xs font-semibold uppercase tracking-wider text-gray-500 sticky top-0 z-10">
                  <th className="py-2.5 px-3 text-left">Food</th>
                  <th className="py-2.5 px-2 text-right">Qty</th>
                  <th className="py-2.5 px-2 text-left text-gray-400 font-medium">Portion</th>
                  <th className="py-2.5 px-2 text-right" title="Total calories for the full quantity">Kcal</th>
                  <th className="py-2.5 px-2 text-right" title="Total protein for the full quantity — helps you stay full and preserve muscle">Prot</th>
                  <th className="py-2.5 px-2 text-right font-medium text-gray-400" title="Total fat for the full quantity">Fat</th>
                  <th className="py-2.5 px-2 text-right font-medium text-gray-400" title="Total carbs for the full quantity">Carbs</th>
                  <th className="py-2.5 px-2 text-right font-medium text-gray-400" title="Total alcohol for the full quantity">Alc</th>
                  <th className="py-2.5 px-2 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {foods.map((f, idx) =>
                  editId === f.foodEntryId && editForm ? (
                    <tr key={f.foodEntryId} className="bg-indigo-50/40">
                      <td className="py-2 px-3"><input value={editForm.foodName} onChange={(e) => setEditForm({ ...editForm, foodName: e.target.value })} className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" aria-label="Food name" /></td>
                      <td className="py-2 px-2"><input type="number" step="0.1" value={editForm.quantity ?? ""} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value ? +e.target.value : null })} className="w-full rounded-md border border-gray-200 px-1.5 py-1 text-right text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" aria-label="Quantity" /></td>
                      <td className="py-2 px-2"><input value={editForm.portionDescription ?? ""} onChange={(e) => setEditForm({ ...editForm, portionDescription: e.target.value })} className="w-full rounded-md border border-gray-200 px-1.5 py-1 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" aria-label="Portion" /></td>
                      <td className="py-2 px-2"><input type="number" value={editForm.caloriesKcal} onChange={(e) => setEditForm({ ...editForm, caloriesKcal: +e.target.value })} className="w-full rounded-md border border-gray-200 px-1.5 py-1 text-right text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" aria-label="Calories" /></td>
                      <td className="py-2 px-2"><input type="number" value={editForm.proteinGrams} onChange={(e) => setEditForm({ ...editForm, proteinGrams: +e.target.value })} className="w-full rounded-md border border-gray-200 px-1.5 py-1 text-right text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" aria-label="Protein" /></td>
                      <td className="py-2 px-2"><input type="number" value={editForm.fatGrams} onChange={(e) => setEditForm({ ...editForm, fatGrams: +e.target.value })} className="w-full rounded-md border border-gray-200 px-1.5 py-1 text-right text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" aria-label="Fat" /></td>
                      <td className="py-2 px-2"><input type="number" value={editForm.carbsGrams} onChange={(e) => setEditForm({ ...editForm, carbsGrams: +e.target.value })} className="w-full rounded-md border border-gray-200 px-1.5 py-1 text-right text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" aria-label="Carbs" /></td>
                      <td className="py-2 px-2"><input type="number" value={editForm.alcoholGrams} onChange={(e) => setEditForm({ ...editForm, alcoholGrams: +e.target.value })} className="w-full rounded-md border border-gray-200 px-1.5 py-1 text-right text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" aria-label="Alcohol" /></td>
                      <td className="py-2 px-2">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={saveEdit}
                            disabled={busy}
                            title="Save changes"
                            aria-label="Save changes"
                            className="rounded-md p-1.5 text-green-600 hover:bg-green-50 hover:text-green-700 disabled:opacity-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-500"
                          >
                            <IconCheck className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setEditId(null); setEditForm(null); }}
                            title="Cancel editing"
                            aria-label="Cancel editing"
                            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500"
                          >
                            <IconX className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={f.foodEntryId}
                      className={`group transition-colors hover:bg-indigo-50/30 ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}
                    >
                      <td className="py-2.5 px-3 font-medium text-gray-900 max-w-[200px]">
                        <span className="line-clamp-2">{f.foodName}</span>
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-gray-700">{f.quantity != null ? fmt(f.quantity, 1) : "\u2013"}</td>
                      <td className="py-2.5 px-2 text-gray-400 text-xs truncate max-w-[100px]">{f.portionDescription ?? "\u2013"}</td>
                      <td className="py-2.5 px-2 text-right tabular-nums font-semibold text-gray-900">{fmt(f.caloriesKcal)}</td>
                      <td className="py-2.5 px-2 text-right tabular-nums font-medium text-gray-700" title="Protein helps you stay full and preserve muscle">{fmt(f.proteinGrams, 1)}</td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-gray-400">{fmt(f.fatGrams, 1)}</td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-gray-400">{fmt(f.carbsGrams, 1)}</td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-gray-400">{fmt(f.alcoholGrams, 1)}</td>
                      <td className="py-2.5 px-2">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => startEdit(f)}
                            title="Edit"
                            aria-label={`Edit ${f.foodName}`}
                            className="rounded-md p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
                          >
                            <IconEdit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(f.foodEntryId)}
                            disabled={busy}
                            title="Delete"
                            aria-label={`Delete ${f.foodName}`}
                            className="rounded-md p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
                          >
                            <IconTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          <p className="hidden md:block mt-1.5 text-[11px] text-gray-400">All values (kcal, protein, fat, carbs) are totals for the full quantity — not per unit</p>

          {/* ── Mobile stacked cards (visible on small screens) ── */}
          <div className="md:hidden space-y-2">
            {foods.map((f) =>
              editId === f.foodEntryId && editForm ? (
                <div key={f.foodEntryId} className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-3 space-y-2">
                  <input value={editForm.foodName} onChange={(e) => setEditForm({ ...editForm, foodName: e.target.value })} className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm font-medium focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" aria-label="Food name" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-gray-400">Qty</label>
                      <input type="number" step="0.1" value={editForm.quantity ?? ""} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value ? +e.target.value : null })} aria-label="Quantity" className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-gray-400">Portion</label>
                      <input value={editForm.portionDescription ?? ""} onChange={(e) => setEditForm({ ...editForm, portionDescription: e.target.value })} aria-label="Portion description" className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-gray-400">Kcal</label>
                      <input type="number" value={editForm.caloriesKcal} onChange={(e) => setEditForm({ ...editForm, caloriesKcal: +e.target.value })} aria-label="Calories" className="w-full rounded-md border border-gray-200 px-1.5 py-1 text-sm text-right focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-gray-400">Prot</label>
                      <input type="number" value={editForm.proteinGrams} onChange={(e) => setEditForm({ ...editForm, proteinGrams: +e.target.value })} aria-label="Protein" className="w-full rounded-md border border-gray-200 px-1.5 py-1 text-sm text-right focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-gray-400">Fat</label>
                      <input type="number" value={editForm.fatGrams} onChange={(e) => setEditForm({ ...editForm, fatGrams: +e.target.value })} aria-label="Fat" className="w-full rounded-md border border-gray-200 px-1.5 py-1 text-sm text-right focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-gray-400">Carbs</label>
                      <input type="number" value={editForm.carbsGrams} onChange={(e) => setEditForm({ ...editForm, carbsGrams: +e.target.value })} aria-label="Carbs" className="w-full rounded-md border border-gray-200 px-1.5 py-1 text-sm text-right focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button onClick={() => { setEditId(null); setEditForm(null); }} aria-label="Cancel editing" className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">Cancel</button>
                    <button onClick={saveEdit} disabled={busy} aria-label="Save changes" className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Save</button>
                  </div>
                </div>
              ) : (
                <MealMobileCard
                  key={f.foodEntryId}
                  f={f}
                  onEdit={() => startEdit(f)}
                  onDelete={() => handleDelete(f.foodEntryId)}
                  busy={busy}
                />
              )
            )}
          </div>
        </>
      )}
    </Card>
  );
}

/* --- Activity Section --- */
function ActivitySection({ date, activities, onChanged, isToday }: { date: string; activities: ActivityEntryResponse[]; onChanged: () => void; isToday: boolean }) {
  const [templates, setTemplates] = useState<ActivityTemplateResponse[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [autoMet] = useState(true);
  const [alwaysShowAdvanced, setAlwaysShowAdvanced] = useState(() => {
    try { return localStorage.getItem("articalorias:showAdvancedActivity") === "true"; } catch { return false; }
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const advancedVisible = alwaysShowAdvanced || showAdvanced;
  const [durationUnit, setDurationUnit] = useState<"minutes" | "hours">("minutes");
  const [editDurationUnit, setEditDurationUnit] = useState<"minutes" | "hours">("minutes");
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<UpdateActivityEntryRequest | null>(null);
  const [showEditAdvanced, setShowEditAdvanced] = useState(false);
  const [templateSaveTarget, setTemplateSaveTarget] = useState<ActivityEntryResponse | null>(null);
  const [templateSaveName, setTemplateSaveName] = useState("");

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
  }, [activities]);

  function applyTemplate(id: string) {
    const t = templates.find((tpl) => tpl.activityTemplateId === +id);
    if (!t) return;
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

  async function handleAdd() {
    if (!form.activityName.trim()) return;
    setBusy(true);
    let submitForm = { ...form };
    if (autoMet && !form.metValue) {
      try {
        const { data } = await activityService.estimateMet({
          activityName: form.activityName,
          durationMinutes: form.durationMinutes,
        });
        submitForm = { ...submitForm, metValue: data.metValue };
      } catch { /* ignore */ }
    }
    try {
      await activityService.create(date, submitForm);
      setShowAdd(false);
      setForm({ activityType: "MET_SIMPLE", activityName: "", durationMinutes: null, metValue: null, notes: null, segments: [] });
      setDurationUnit("minutes");
      onChanged();
    } catch { /* ignore */ }
    setBusy(false);
  }

  function startEditActivity(a: ActivityEntryResponse) {
    setEditId(a.activityEntryId);
    setEditDurationUnit("minutes");
    setShowEditAdvanced(false);
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

  async function handleRemoveTemplate(a: ActivityEntryResponse) {
    const match = templates.find(t => t.isActive && t.templateName.toLowerCase() === a.activityName.toLowerCase());
    if (!match) return;
    setBusy(true);
    try {
      await activityService.removeTemplate(match.activityTemplateId);
      activityService.getTemplates().then(({ data }) => setTemplates(data)).catch(() => {});
    } catch { /* ignore */ }
    setBusy(false);
  }

  function startTemplateSave(a: ActivityEntryResponse) {
    setTemplateSaveTarget(a);
    setTemplateSaveName(a.activityName);
  }

  async function confirmTemplateSave() {
    if (!templateSaveTarget) return;
    const name = templateSaveName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const req: ActivityTemplateRequest = {
        templateScope: "USER",
        activityType: templateSaveTarget.activityType,
        templateName: name,
        autoAddToNewDay: false,
        defaultDurationMinutes: templateSaveTarget.durationMinutes,
        defaultMET: templateSaveTarget.metValue,
        segments: templateSaveTarget.segments.map((s) => ({
          segmentOrder: s.segmentOrder,
          segmentName: s.segmentName,
          metValue: s.metValue,
          durationMinutes: s.durationMinutes,
        })),
      };
      await activityService.createTemplate(req);
      activityService.getTemplates().then(({ data }) => setTemplates(data)).catch(() => {});
      setTemplateSaveTarget(null);
      setTemplateSaveName("");
    } catch { /* ignore */ }
    setBusy(false);
  }

  const autoActivities = activities.filter(a => a.isGlobalDefault || a.isFromSystemTemplate);
  const userActivities = activities.filter(a => !a.isGlobalDefault && !a.isFromSystemTemplate);
  const savedTemplateNames = new Set(
    templates.filter(t => t.isActive).map(t => t.templateName.toLowerCase()),
  );

  return (
    <Card
      title="Your activities"
      subtitle="Logging activities helps fine-tune your daily calorie estimate"
      icon={
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      }
    >
      {activities.length === 0 && !showAdd && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm font-medium text-gray-500">No activities logged yet</p>
          <p className="mt-1 text-sm text-gray-400">Describe what you did in the box above — even a rough description works</p>
          <p className="mt-3 text-xs text-gray-400 italic">Try something like: "30 min walking"</p>
        </div>
      )}

      {activities.length > 0 && (
        <>
          {/* Activity summary chips */}
          <ActivitySummary activities={activities} isToday={isToday} />

          {/* Activity coverage — hours breakdown */}
          <ActivityCoverage activities={activities} />

          <div className="space-y-5">
            {/* ── Automatic daily activities ── */}
            {autoActivities.length > 0 && (
              <div>
                <div className="mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Included in your daily estimate</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Things like sleep and daily movement are part of everyone's day — including them helps your calorie estimate stay accurate. You can adjust the duration if needed.</p>
                  {autoActivities.some(a => a.calculatedCaloriesKcal < 0) && (
                    <p className="text-xs text-blue-400 mt-0.5">Negative values mean the activity burns less than your resting rate — like sleep, where your body uses less energy than when awake.</p>
                  )}
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50/50 divide-y divide-gray-100">
                  {autoActivities.map((a) =>
                    editId === a.activityEntryId && editForm ? (
                      <div key={a.activityEntryId} className="px-3 py-2.5 bg-indigo-50/30 space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-700">{a.activityName}</p>
                            <p className="text-xs text-gray-400 mt-0.5">You can adjust the duration</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <input type="number" step={editDurationUnit === "hours" ? "0.25" : "1"} value={editForm.durationMinutes != null ? (editDurationUnit === "hours" ? +(editForm.durationMinutes / 60).toFixed(2) : editForm.durationMinutes) : ""} onChange={(e) => { const v = e.target.value ? +e.target.value : null; setEditForm({ ...editForm, durationMinutes: v != null ? (editDurationUnit === "hours" ? v * 60 : v) : null }); }} aria-label="Duration" className="w-16 rounded border border-gray-200 px-1.5 py-1 text-right text-sm" />
                            <select value={editDurationUnit} onChange={(e) => setEditDurationUnit(e.target.value as "minutes" | "hours")} aria-label="Duration unit" className="rounded border border-gray-200 px-1 py-1 text-xs">
                              <option value="minutes">min</option>
                              <option value="hours">hr</option>
                            </select>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={saveEditActivity} disabled={busy} title="Save" aria-label="Save changes" className="rounded-md p-1.5 text-green-600 hover:bg-green-50 disabled:opacity-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-500"><IconCheck className="w-4 h-4" /></button>
                            <button onClick={() => { setEditId(null); setEditForm(null); }} title="Cancel" aria-label="Cancel editing" className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500"><IconX className="w-4 h-4" /></button>
                          </div>
                        </div>
                        {!alwaysShowAdvanced && (
                          <button
                            onClick={() => setShowEditAdvanced((v) => !v)}
                            aria-expanded={showEditAdvanced}
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 font-medium rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 transition-colors"
                          >
                            <svg className={`h-3.5 w-3.5 transition-transform ${showEditAdvanced ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
                            Advanced options
                          </button>
                        )}
                        {(alwaysShowAdvanced || showEditAdvanced) && (
                          <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white/60 px-2.5 py-1.5">
                            <label className="text-xs font-medium text-gray-500 whitespace-nowrap">MET</label>
                            <input type="number" step="0.1" min="0.5" max="50" value={editForm.metValue ?? ""} onChange={(e) => setEditForm({ ...editForm, metValue: e.target.value ? +e.target.value : null })} placeholder="Auto" aria-label="MET value" className="w-20 rounded border border-gray-200 px-1.5 py-1 text-right text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
                            <p className="text-xs text-gray-400">Only change this if you want to fine-tune the calorie estimate</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div key={a.activityEntryId} className="flex items-center gap-3 px-3 py-2.5 group hover:bg-gray-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-600">{a.activityName}</p>
                        </div>
                        <span className="text-xs text-gray-400 tabular-nums">{a.durationMinutes != null ? (a.durationMinutes >= 60 ? `${+(a.durationMinutes / 60).toFixed(1)}h` : `${fmt(a.durationMinutes)} min`) : "-"}</span>
                        <span className={`text-xs tabular-nums w-16 text-right ${a.calculatedCaloriesKcal < 0 ? "text-blue-500" : "text-gray-400"}`} title={a.calculatedCaloriesKcal < 0 ? "Below resting rate — burns less than your baseline" : undefined}>{fmt(a.calculatedCaloriesKcal)} kcal</span>
                        <button onClick={() => startEditActivity(a)} title="Adjust duration" aria-label={`Adjust duration for ${a.activityName}`} className="rounded-md p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"><IconEdit className="w-4 h-4" /></button>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* ── User-logged activities ── */}
            <div>
              {autoActivities.length > 0 && (
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Logged by you</h3>
              )}
              {userActivities.length === 0 ? (
                <p className="text-sm text-gray-400 italic py-2">Activities you log will appear here</p>
              ) : (
                <>
                  {/* ── Desktop table (hidden on small screens) ── */}
                  <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-100">
                    <table className="w-full text-sm">
                      <colgroup>
                        <col />
                        <col className="w-24" />
                        <col className="w-24" />
                        <col className="w-28" />
                      </colgroup>
                      <thead>
                        <tr className="bg-gray-50/80 border-b border-gray-200 text-xs font-semibold uppercase tracking-wider text-gray-500 sticky top-0 z-10">
                          <th className="py-2.5 px-3 text-left">Activity</th>
                          <th className="py-2.5 px-2 text-right">Duration</th>
                          <th className="py-2.5 px-2 text-right">Calories</th>
                          <th className="py-2.5 px-2 text-right"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {userActivities.map((a, idx) =>
                          editId === a.activityEntryId && editForm ? (
                            <tr key={a.activityEntryId} className="bg-indigo-50/40">
                              <td className="py-2.5 px-3">
                                <span className="font-medium text-gray-900">{a.activityName}</span>
                                {!alwaysShowAdvanced && (
                                  <button
                                    onClick={() => setShowEditAdvanced((v) => !v)}
                                    aria-expanded={showEditAdvanced}
                                    className="mt-1 flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 font-medium rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 transition-colors"
                                  >
                                    <svg className={`h-3.5 w-3.5 transition-transform ${showEditAdvanced ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
                                    Advanced options
                                  </button>
                                )}
                                {(alwaysShowAdvanced || showEditAdvanced) && (
                                  <div className="mt-2 space-y-2 rounded-md border border-gray-200 bg-white/60 px-2.5 py-1.5">
                                    <div className="flex items-center gap-2">
                                      <label className="text-xs font-medium text-gray-500 whitespace-nowrap">MET</label>
                                      <input type="number" step="0.1" min="0.5" max="50" value={editForm.metValue ?? ""} onChange={(e) => setEditForm({ ...editForm, metValue: e.target.value ? +e.target.value : null })} placeholder="Auto" aria-label="MET value" className="w-20 rounded border border-gray-200 px-1.5 py-1 text-right text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
                                      <p className="text-xs text-gray-400">Only change this if you want to fine-tune the calorie estimate</p>
                                    </div>
                                    {!savedTemplateNames.has(a.activityName.toLowerCase()) && (
                                      <button
                                        onClick={() => startTemplateSave(a)}
                                        disabled={busy}
                                        aria-label={`Save ${a.activityName} as template`}
                                        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
                                      >
                                        <IconBookmark className="w-3 h-3" />
                                        Save as template
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-2">
                                <div className="flex gap-1 justify-end">
                                  <input type="number" step={editDurationUnit === "hours" ? "0.25" : "1"} value={editForm.durationMinutes != null ? (editDurationUnit === "hours" ? +(editForm.durationMinutes / 60).toFixed(2) : editForm.durationMinutes) : ""} onChange={(e) => { const v = e.target.value ? +e.target.value : null; setEditForm({ ...editForm, durationMinutes: v != null ? (editDurationUnit === "hours" ? v * 60 : v) : null }); }} aria-label="Duration" className="w-16 rounded-md border border-gray-200 px-1.5 py-1 text-right text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
                                  <select value={editDurationUnit} onChange={(e) => setEditDurationUnit(e.target.value as "minutes" | "hours")} aria-label="Duration unit" className="rounded-md border border-gray-200 px-1 py-1 text-xs">
                                    <option value="minutes">min</option>
                                    <option value="hours">hr</option>
                                  </select>
                                </div>
                              </td>
                              <td className={`py-2.5 px-2 text-right tabular-nums font-semibold ${a.calculatedCaloriesKcal < 0 ? "text-blue-600" : "text-gray-900"}`}>{fmt(a.calculatedCaloriesKcal)}</td>
                              <td className="py-2.5 px-2">
                                <div className="flex gap-1 justify-end">
                                  <button onClick={saveEditActivity} disabled={busy} title="Save changes" aria-label="Save changes" className="rounded-md p-1.5 text-green-600 hover:bg-green-50 hover:text-green-700 disabled:opacity-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-500"><IconCheck className="w-4 h-4" /></button>
                                  <button onClick={() => { setEditId(null); setEditForm(null); }} title="Cancel editing" aria-label="Cancel editing" className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500"><IconX className="w-4 h-4" /></button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            <tr
                              key={a.activityEntryId}
                              className={`group transition-colors hover:bg-indigo-50/30 ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}
                            >
                              <td className="py-2.5 px-3 font-medium text-gray-900 max-w-[200px]">
                                <span className="line-clamp-2">{a.activityName}</span>
                              </td>
                              <td className="py-2.5 px-2 text-right tabular-nums text-gray-700">{a.durationMinutes != null ? (a.durationMinutes >= 60 ? `${+(a.durationMinutes / 60).toFixed(1)}h` : `${fmt(a.durationMinutes)} min`) : "\u2013"}</td>
                              <td className={`py-2.5 px-2 text-right tabular-nums font-semibold ${a.calculatedCaloriesKcal < 0 ? "text-blue-600" : "text-gray-900"}`} title={a.calculatedCaloriesKcal < 0 ? "Below resting rate — burns less than your baseline" : undefined}>{fmt(a.calculatedCaloriesKcal)}</td>
                              <td className="py-2.5 px-2">
                                <div className="flex gap-1 justify-end">
                                  {savedTemplateNames.has(a.activityName.toLowerCase()) ? (
                                    <button onClick={() => handleRemoveTemplate(a)} disabled={busy} title="Remove template" aria-label={`Remove ${a.activityName} template`} className="rounded-md p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"><IconBookmarkFilled className="w-4 h-4" /></button>
                                  ) : (
                                    <button onClick={() => startTemplateSave(a)} disabled={busy} title="Save as template" aria-label={`Save ${a.activityName} as template`} className="rounded-md p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"><IconBookmark className="w-4 h-4" /></button>
                                  )}
                                  <button onClick={() => startEditActivity(a)} title="Edit" aria-label={`Edit ${a.activityName}`} className="rounded-md p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"><IconEdit className="w-4 h-4" /></button>
                                  <button onClick={() => handleDelete(a.activityEntryId)} disabled={busy} title="Delete" aria-label={`Delete ${a.activityName}`} className="rounded-md p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"><IconTrash className="w-4 h-4" /></button>
                                </div>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* ── Mobile stacked cards (visible on small screens) ── */}
                  <div className="md:hidden space-y-2">
                    {userActivities.map((a) =>
                      editId === a.activityEntryId && editForm ? (
                        <div key={a.activityEntryId} className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-3 space-y-2">
                          <p className="text-sm font-medium text-gray-900">{a.activityName}</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] uppercase tracking-wide text-gray-400">Duration</label>
                              <div className="flex gap-1">
                                <input type="number" step={editDurationUnit === "hours" ? "0.25" : "1"} value={editForm.durationMinutes != null ? (editDurationUnit === "hours" ? +(editForm.durationMinutes / 60).toFixed(2) : editForm.durationMinutes) : ""} onChange={(e) => { const v = e.target.value ? +e.target.value : null; setEditForm({ ...editForm, durationMinutes: v != null ? (editDurationUnit === "hours" ? v * 60 : v) : null }); }} aria-label="Duration" className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
                                <select value={editDurationUnit} onChange={(e) => setEditDurationUnit(e.target.value as "minutes" | "hours")} aria-label="Duration unit" className="rounded-md border border-gray-200 px-1 py-1 text-xs">
                                  <option value="minutes">min</option>
                                  <option value="hours">hr</option>
                                </select>
                              </div>
                            </div>
                          </div>
                          {!alwaysShowAdvanced && (
                            <button
                              onClick={() => setShowEditAdvanced((v) => !v)}
                              aria-expanded={showEditAdvanced}
                              className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 font-medium rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 transition-colors"
                            >
                              <svg className={`h-3.5 w-3.5 transition-transform ${showEditAdvanced ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
                              Advanced options
                            </button>
                          )}
                          {(alwaysShowAdvanced || showEditAdvanced) && (
                            <div className="rounded-md border border-gray-200 bg-white/60 px-2.5 py-1.5">
                              <div className="flex items-center gap-2">
                                <label className="text-xs font-medium text-gray-500 whitespace-nowrap">MET</label>
                                <input type="number" step="0.1" min="0.5" max="50" value={editForm.metValue ?? ""} onChange={(e) => setEditForm({ ...editForm, metValue: e.target.value ? +e.target.value : null })} placeholder="Auto" aria-label="MET value" className="w-20 rounded border border-gray-200 px-1.5 py-1 text-right text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
                              </div>
                            </div>
                          )}
                          <div className="flex justify-end gap-2 pt-1">
                            <button onClick={() => { setEditId(null); setEditForm(null); }} aria-label="Cancel editing" className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">Cancel</button>
                            <button onClick={saveEditActivity} disabled={busy} aria-label="Save changes" className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Save</button>
                          </div>
                        </div>
                      ) : (
                        <ActivityMobileCard
                          key={a.activityEntryId}
                          a={a}
                          onEdit={() => startEditActivity(a)}
                          onDelete={() => handleDelete(a.activityEntryId)}
                          onSaveTemplate={() => startTemplateSave(a)}
                          onRemoveTemplate={() => handleRemoveTemplate(a)}
                          isSavedTemplate={savedTemplateNames.has(a.activityName.toLowerCase())}
                          busy={busy}
                        />
                      )
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {templateSaveTarget && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-indigo-50/50 px-3 py-2.5">
          <IconBookmark className="w-3.5 h-3.5 flex-shrink-0 text-indigo-400" />
          <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Template name</label>
          <input
            type="text"
            value={templateSaveName}
            onChange={(e) => setTemplateSaveName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") confirmTemplateSave(); if (e.key === "Escape") { setTemplateSaveTarget(null); setTemplateSaveName(""); } }}
            autoFocus
            aria-label="Template name"
            className="flex-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          />
          <button
            onClick={confirmTemplateSave}
            disabled={busy || !templateSaveName.trim()}
            className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            Save
          </button>
          <button
            onClick={() => { setTemplateSaveTarget(null); setTemplateSaveName(""); }}
            className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
          >
            Cancel
          </button>
        </div>
      )}

      {showAdd && (
        <div className="mt-3 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
          {templates.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Use a saved activity</label>
              <select onChange={(e) => applyTemplate(e.target.value)} defaultValue="" aria-label="Choose a saved activity" className="rounded-md border border-gray-300 px-2 py-1.5 text-sm w-full">
                <option value="" disabled>Choose one...</option>
                {templates.filter((t) => t.isActive).map((t) => (
                  <option key={t.activityTemplateId} value={t.activityTemplateId}>{t.templateName}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500">Activity name *</label>
              <input value={form.activityName} onChange={(e) => setForm({ ...form, activityName: e.target.value })} placeholder='e.g. "Running", "Yoga"' aria-label="Activity name" className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm placeholder:text-gray-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">How long</label>
              <div className="mt-1 flex gap-1">
                <input type="number" step={durationUnit === "hours" ? "0.25" : "1"} value={form.durationMinutes != null ? (durationUnit === "hours" ? +(form.durationMinutes / 60).toFixed(2) : form.durationMinutes) : ""} onChange={(e) => { const v = e.target.value ? +e.target.value : null; setForm({ ...form, durationMinutes: v != null ? (durationUnit === "hours" ? v * 60 : v) : null }); }} aria-label="Duration" className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                <select value={durationUnit} onChange={(e) => setDurationUnit(e.target.value as "minutes" | "hours")} aria-label="Duration unit" className="rounded-md border border-gray-300 px-1 py-1.5 text-xs">
                  <option value="minutes">min</option>
                  <option value="hours">hr</option>
                </select>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400">We'll estimate how many calories you burned based on the activity and duration.</p>

          {/* Advanced options — progressive disclosure */}
          {!alwaysShowAdvanced && (
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              aria-expanded={showAdvanced}
              aria-controls="advanced-activity-options"
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 font-medium rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 transition-colors"
            >
              <svg
                className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              Advanced options
            </button>
          )}

          {advancedVisible && (
            <div
              id="advanced-activity-options"
              role="region"
              aria-label="Advanced activity options"
              className="space-y-3 rounded-lg border border-gray-200 bg-white/60 p-3"
            >
              <div>
                <label className="block text-xs font-medium text-gray-500">MET (intensity)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="50"
                  value={form.metValue ?? ""}
                  onChange={(e) => setForm({ ...form, metValue: e.target.value ? +e.target.value : null })}
                  placeholder="Auto"
                  aria-label="MET value"
                  className="mt-1 w-full max-w-[10rem] rounded-md border border-gray-300 px-2 py-1.5 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-400">Only change this if you want to fine-tune the calorie estimate. Leave blank to use the default.</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={alwaysShowAdvanced}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setAlwaysShowAdvanced(next);
                    try { localStorage.setItem("articalorias:showAdvancedActivity", String(next)); } catch { /* ignore */ }
                  }}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs text-gray-500">Always show advanced controls</span>
              </label>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 transition-colors">Cancel</button>
            <button onClick={handleAdd} disabled={busy || !form.activityName.trim()} className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
              {busy ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      )}

      {!showAdd && (
        <div className="mt-3">
          <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add custom activity
          </button>
        </div>
      )}
    </Card>
  );
}


/* --- Calculation Breakdown --- */
function CalculationBreakdown({ dash, isToday }: { dash: DailyDashboardResponse | null; isToday: boolean }) {
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
    <Card
      title={isToday ? "How today's numbers were calculated" : "How this day's numbers were calculated"}
      subtitle="For the curious — a detailed look at the math behind your daily targets"
      variant="muted"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="calc-breakdown-details"
        className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
      >
        <svg
          className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        {open ? "Hide the math" : "Show the math"}
      </button>

      {open && (
        <div id="calc-breakdown-details" role="region" aria-label="Calculation breakdown details" className="mt-4 space-y-6 text-sm">
          {/* ── System Constants ── */}
          <BreakdownSection title="Constants we use">
            <Row label="Kcal / g protein" value={`${kcalPerGProtein}`} />
            <Row label="Kcal / g fat" value={`${kcalPerGFat}`} />
            <Row label="Kcal / g carbs" value={`${kcalPerGCarbs}`} />
            <Row label="Kcal / g alcohol" value={`${kcalPerGAlcohol}`} />
            <Row label="Digestion cost – protein" value={`${(tefProtein * 100).toFixed(0)}%`} />
            <Row label="Digestion cost – fat" value={`${(tefFat * 100).toFixed(0)}%`} />
            <Row label="Digestion cost – carbs" value={`${(tefCarbs * 100).toFixed(0)}%`} />
            <Row label="Digestion cost – alcohol" value={`${(tefAlcohol * 100).toFixed(0)}%`} />
            <Row label="Daily movement factor" value={`${idleMet}`} />
            <Row label="Resting metabolism factor" value={`${restingMet}`} />
            <Row label="Weight-change factor" value="1 kg ≈ 7,700 kcal" />
          </BreakdownSection>

          {/* ── Snapshot (profile values used) ── */}
          <BreakdownSection title="Your profile values">
            <Row label="Weight" value={`${fmt(d.snapshotWeightKg, 1)} kg`} />
            <Row label="Height" value={`${fmt(d.snapshotHeightCm, 1)} cm`} />
            <Row label="Resting calorie burn" value={`${fmt(d.snapshotBMRKcal)} kcal`} />
            {d.snapshotBodyFatPercent != null && (
              <Row label="Body fat" value={`${fmt(d.snapshotBodyFatPercent, 1)}%`} />
            )}
            <Row label="Daily calorie goal" value={`${fmt(d.snapshotDailyBaseGoalKcal)} kcal`} />
            <Row label="Protein goal" value={`${fmt(d.snapshotProteinGoalGrams, 1)} g`} />
          </BreakdownSection>

          {/* ── Intake ── */}
          <BreakdownSection title="What you ate">
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
          </BreakdownSection>

          {/* ── Expenditure ── */}
          <BreakdownSection title="What your body used">
            <Formula
              label="Activity calories"
              formula="Σ activity.calculatedCaloriesKcal"
              result={`${fmt(d.totalActivityCaloriesKcal)} kcal`}
            />
            {d.totalActivityCaloriesKcal < 0 && (
              <p className="text-xs text-blue-400 -mt-1 ml-1">Negative because low-intensity activities (like sleep) burn less than your resting rate</p>
            )}
            <Formula
              label="Hours remaining in day"
              formula="max(0, 24 − Σ activity.durationMinutes / 60)"
              result={`${fmt(d.hoursRemainingInDay, 2)} h`}
            />
            <Formula
              label="Calories from daily movement"
              formula={`(${idleMet} − ${restingMet}) × ${fmt(d.snapshotWeightKg, 1)} kg × ${fmt(d.hoursRemainingInDay, 2)} h`}
              result={`${fmt(d.idleTimeCaloriesKcal)} kcal`}
            />
            <p className="text-xs text-gray-400 -mt-1 ml-1">Walking around, chores, errands, and other non-exercise movement</p>
            <div className="pl-4 space-y-1 border-l-2 border-indigo-100">
              <p className="text-xs font-medium text-gray-500">Energy used to digest food</p>
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
              label="Total calories your body used"
              formula={`BMR (${fmt(d.snapshotBMRKcal)}) + activity (${fmt(d.totalActivityCaloriesKcal)}) + idle (${fmt(d.idleTimeCaloriesKcal)}) + TEF (${fmt(d.tefKcal)})`}
              result={`${fmt(d.totalDailyExpenditureKcal)} kcal`}
              highlight
            />
          </BreakdownSection>

          {/* ── Balance ── */}
          <BreakdownSection title="Your balance">
            <Formula
              label="Net calorie balance"
              formula={`foodCalories (${fmt(d.totalFoodCaloriesKcal)}) − expenditure (${fmt(d.totalDailyExpenditureKcal)})`}
              result={`${fmt(d.netBalanceKcal)} kcal`}
              highlight
            />
            <Formula
              label="Difference from your goal"
              formula={`netBalance (${fmt(d.netBalanceKcal)}) − dailyBaseGoal (${fmt(d.snapshotDailyBaseGoalKcal)})`}
              result={`${fmt(d.dailyGoalDeltaKcal)} kcal`}
            />
            <Formula
              label={isToday ? "Calories you can still eat" : "Calories remaining vs. target"}
              formula={`(expenditure (${fmt(d.totalDailyExpenditureKcal)}) + dailyBaseGoal (${fmt(d.snapshotDailyBaseGoalKcal)})) − foodCalories (${fmt(d.totalFoodCaloriesKcal)})`}
              result={`${fmt(d.caloriesRemainingToDailyTargetKcal)} kcal`}
              highlight
            />
            <Formula
              label={isToday ? "Protein you still need" : "Protein vs. goal"}
              formula={`proteinGoal (${fmt(d.snapshotProteinGoalGrams, 1)}) − proteinEaten (${fmt(d.totalProteinGrams, 1)})`}
              result={`${fmt(d.proteinRemainingGrams, 1)} g`}
            />
          </BreakdownSection>

          {/* ── Weekly Context ── */}
          <BreakdownSection title={isToday ? "Your week so far" : "Weekly context"}>
            <Row label="Week" value={`${d.weekStartDate} → ${d.weekEndDate}`} />
            <Formula
              label="Weekly calorie goal"
              formula={`dailyBaseGoal (${fmt(d.snapshotDailyBaseGoalKcal)}) × 7`}
              result={`${fmt(d.weeklyTargetKcal)} kcal`}
            />
            {isToday && (
              <Formula
                label="Where you should be this week"
                formula="dailyBaseGoal × dayOfWeek"
                result={`${fmt(d.weeklyExpectedToDateKcal)} kcal`}
              />
            )}
            <Formula
              label={isToday ? "Where you actually are" : "Actual weekly balance"}
              formula="Σ weekLogs.netBalance"
              result={`${fmt(d.weeklyActualToDateKcal)} kcal`}
            />
            <Formula
              label="Ahead or behind"
              formula="weeklyActual − weeklyExpected"
              result={`${fmt(d.weeklyDifferenceKcal)} kcal`}
            />
            {isToday && (
              <>
                <Formula
                  label="What's left this week"
                  formula="weeklyTarget − weeklyActual"
                  result={`${fmt(d.weeklyRemainingTargetKcal)} kcal`}
                />
                <Formula
                  label="Suggested daily calories for the rest of the week"
                  formula="weeklyRemaining / daysRemaining"
                  result={`${fmt(d.suggestedDailyAverageRemainingKcal)} kcal`}
                />
              </>
            )}
          </BreakdownSection>
        </div>
      )}
    </Card>
  );
}

/* --- Breakdown helpers --- */
function BreakdownSection({ title, children }: { title: string; children: React.ReactNode }) {
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

function Card({ title, subtitle, icon, compact, variant, children }: { title: string; subtitle?: string; icon?: React.ReactNode; compact?: boolean; variant?: "primary" | "muted"; children: React.ReactNode }) {
  const sectionClass = variant === "primary"
    ? "rounded-xl border-2 border-indigo-200 bg-white shadow-md ring-1 ring-indigo-100"
    : variant === "muted"
      ? "rounded-xl border border-gray-100 bg-gray-50/60 shadow-none"
      : "rounded-xl border border-gray-200 bg-white shadow-sm";
  const titleClass = variant === "primary"
    ? "text-sm font-bold uppercase tracking-wide text-indigo-600"
    : variant === "muted"
      ? "text-xs font-semibold uppercase tracking-wide text-gray-400"
      : "text-sm font-semibold uppercase tracking-wide text-gray-500";

  return (
    <section className={`${sectionClass} ${compact ? "p-3.5 sm:p-4" : "p-4 sm:p-5"}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon && <span className="text-indigo-500 flex-shrink-0">{icon}</span>}
        <h2 className={titleClass}>{title}</h2>
      </div>
      {subtitle && <p className="mb-3 text-xs text-gray-400">{subtitle}</p>}
      {!subtitle && <div className="mb-2" />}
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
