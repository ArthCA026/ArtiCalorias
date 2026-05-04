import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Cell,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea,
  Tooltip,
  type TooltipProps,
} from "recharts";
import { historyService } from "@/services/historyService";
import { dailyLogService } from "@/services/dailyLogService";
import type { DailyLogResponse } from "@/types/dailyLog";
import type { MonthlySummaryResponse } from "@/types/history";
import { fmt, toDateString } from "@/utils/format";
import { extractApiError } from "@/utils/apiError";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import EmptyState from "@/components/EmptyState";
import DayDashboard from "@/components/DayDashboard";

export default function HistoryPage() {
  const { date } = useParams<{ date: string }>();
  if (date) return <DayDetail date={date} />;
  return <MonthlyView />;
}

/* --- Monthly View --- */

function MonthlyView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const now = new Date();

  // Seed year/month from ?m=YYYY-MM when returning from a day detail
  const mParam = searchParams.get("m");
  const initYear  = mParam ? parseInt(mParam.slice(0, 4))  : now.getFullYear();
  const initMonth = mParam ? parseInt(mParam.slice(5, 7))  : now.getMonth() + 1;

  const [year, setYear] = useState(initYear);
  const [month, setMonth] = useState(initMonth);
  const [days, setDays] = useState<DailyLogResponse[]>([]);
  const [summary, setSummary] = useState<MonthlySummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const monthLabel = new Date(year, month - 1).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const from = year + "-" + String(month).padStart(2, "0") + "-01";
    const lastDay = new Date(year, month, 0).getDate();
    const to = year + "-" + String(month).padStart(2, "0") + "-" + String(lastDay).padStart(2, "0");

    Promise.all([
      historyService.getDailyRange(from, to).then(({ data }) => data),
      historyService.getMonthly(year, month).then(({ data }) => data).catch(() => null),
    ])
      .then(([dailyData, monthlyData]) => {
        setDays(dailyData);
        setSummary(monthlyData);
      })
      .catch(() => setError("Couldn't load your history — please try again."))
      .finally(() => setLoading(false));
  }, [year, month]);

  useEffect(load, [load]);

  function goPrev() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else { setMonth((m) => m - 1); }
  }

  function goNext() {
    if (isCurrentMonth) return;
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else { setMonth((m) => m + 1); }
  }

  // Build the set of dates that already have logs
  const loggedDates = new Set(days.map((d) => d.logDate));

  // Build list of unlogged past days in the displayed month
  const lastDay = new Date(year, month, 0).getDate();
  const todayStr = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  const unloggedDays: string[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const dateStr = year + "-" + String(month).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    if (dateStr < todayStr && !loggedDates.has(dateStr)) {
      unloggedDays.push(dateStr);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Your Month 📅</h1>
          <div className="flex items-center gap-3">
            <button onClick={goPrev} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">&larr; Prev</button>
            <span className="min-w-[160px] text-center text-sm font-semibold text-gray-700">{monthLabel}</span>
            <button onClick={goNext} disabled={isCurrentMonth} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">Next &rarr;</button>
          </div>
        </div>
        <p className="mt-1.5 text-sm text-gray-400">
          See how your month is shaping up. The more days you log, the clearer the picture gets.
        </p>
      </div>

      {loading && <LoadingSpinner message="Loading your month..." />}
      {error && <ErrorMessage message={error} onRetry={load} />}

      {!loading && !error && (
        <>
          {days.length >= 1 && <BalanceTrend days={days} />}
          {(days.length > 0 || unloggedDays.length > 0) && (
            <DailyLogsCard days={days} unloggedDays={unloggedDays} onDayClick={(d) => navigate("/history/" + d)} onDayDeleted={load} />
          )}
          {summary && <MonthlySummaryCard summary={summary} />}
        </>
      )}
    </div>
  );
}

/* --- Monthly Summary Card --- */

function MonthlySummaryCard({ summary: s }: { summary: MonthlySummaryResponse }) {
  const [open, setOpen] = useState(false);

  const avgBalance = s.averageDailyBalanceKcal;
  const avgProtein = s.daysLogged > 0 ? s.totalProteinGrams / s.daysLogged : 0;
  const weightChange = s.estimatedWeightChangeKg;
  const today = new Date();
  const daysInMonth = new Date(s.yearNumber, s.monthNumber, 0).getDate();
  const isCurrent = s.yearNumber === today.getFullYear() && s.monthNumber === today.getMonth() + 1;
  const totalDays = isCurrent ? today.getDate() : daysInMonth;

  return (
    <Card title="How your month is going" variant="primary">
      <div className="space-y-2.5">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
        >
          <svg
            className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          {open ? "Hide the numbers" : "Show the numbers"}
        </button>

        {open && (
          <div className="pt-2.5 border-t border-gray-100">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Stat label="Days logged" value={`${s.daysLogged} of ${totalDays}`} />
              <Stat label="Avg. daily balance" value={`${fmt(avgBalance)} kcal`} accent />
              <Stat label="Avg. protein / day" value={`${fmt(avgProtein, 1)} g`} />
              {weightChange != null && (
                <Stat label="Est. weight change" value={`${weightChange <= 0 ? "−" : "+"}${fmt(Math.abs(weightChange), 2)} kg`} />
              )}
              <Stat label="Calories eaten" value={`${fmt(s.totalFoodCaloriesKcal)} kcal`} />
              <Stat label="Total burned" value={`${fmt(s.totalExpenditureKcal)} kcal`} hint="BMR + activities + thermic effect" />
              <Stat label="Net calories" value={`${fmt(s.actualMonthlyBalanceKcal)} kcal`} accent />
              <Stat label="Avg. eaten / day" value={`${fmt(s.averageDailyFoodCaloriesKcal)} kcal`} />
              <Stat label="Avg. burned / day" value={`${fmt(s.averageDailyExpenditureKcal)} kcal`} hint="BMR + activities + thermic effect" />
              <Stat label="Total protein" value={`${fmt(s.totalProteinGrams, 1)} g`} />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

/* --- Daily Logs Card --- */

function DailyLogsCard({ days, unloggedDays, onDayClick, onDayDeleted }: { days: DailyLogResponse[]; unloggedDays: string[]; onDayClick: (date: string) => void; onDayDeleted: () => void }) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const todayStr = toDateString();

  function handleDeleteClick(e: React.MouseEvent, date: string) {
    e.stopPropagation();
    setDeleteTarget(date);
    setDeleteError(null);
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    dailyLogService
      .deleteDay(deleteTarget)
      .then(() => { setDeleteTarget(null); onDayDeleted(); })
      .catch((err) => setDeleteError(extractApiError(err, "Failed to delete this day. Please try again.")))
      .finally(() => setDeleting(false));
  }

  return (
    <Card title="Your logged days" subtitle="Click any day to see how it went">
      {days.length === 0 ? (
        <EmptyState message="No logged days yet — you can add a missed day below." />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-xs font-semibold uppercase tracking-wider text-gray-500 sticky top-0 z-10">
                  <th className="py-2.5 px-3 text-left">Date</th>
                  <th className="py-2.5 px-2 text-right">Result</th>
                  <th className="py-2.5 px-2 text-right">vs. Goal</th>
                  <th className="py-2.5 px-2 text-right">Protein</th>
                  <th className="py-2.5 px-2 text-center w-10"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {days.map((d, idx) => (
                  <tr
                    key={d.logDate}
                    onClick={() => onDayClick(d.logDate)}
                    className={`cursor-pointer group transition-colors hover:bg-indigo-50/30 ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}
                  >
                    <td className="py-2.5 px-3 font-medium text-indigo-600">
                      <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 align-middle ${d.netBalanceKcal <= 0 ? "bg-green-400" : "bg-amber-400"}`} aria-hidden="true" />
                      {formatDayLabel(d.logDate)}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <FriendlyBalance value={d.netBalanceKcal} />
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <FriendlyGoalDelta value={d.dailyGoalDeltaKcal} />
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums font-medium text-gray-700">{fmt(d.totalProteinGrams, 1)} g</td>
                    <td className="py-2.5 px-2 text-center">
                      {d.logDate !== todayStr && (
                        <button
                          onClick={(e) => handleDeleteClick(e, d.logDate)}
                          title="Delete this day"
                          className="inline-flex items-center justify-center rounded p-1 text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
                        >
                          <TrashIcon />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile stacked cards */}
          <div className="sm:hidden space-y-2 mt-3">
            {days.map((d) => (
              <div
                key={d.logDate}
                onClick={() => onDayClick(d.logDate)}
                className="cursor-pointer rounded-lg border border-gray-100 bg-white p-3 hover:bg-indigo-50/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-medium text-indigo-600 text-sm">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 align-middle ${d.netBalanceKcal <= 0 ? "bg-green-400" : "bg-amber-400"}`} aria-hidden="true" />
                    {formatDayLabel(d.logDate)}
                  </span>
                  <div className="flex items-center gap-2">
                    <FriendlyBalance value={d.netBalanceKcal} />
                    {d.logDate !== todayStr && (
                      <button
                        onClick={(e) => handleDeleteClick(e, d.logDate)}
                        title="Delete this day"
                        className="inline-flex items-center justify-center rounded p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                  <span>Protein: <span className="font-medium text-gray-700">{fmt(d.totalProteinGrams, 1)} g</span></span>
                  <span>vs. Goal: <FriendlyGoalDelta value={d.dailyGoalDeltaKcal} /></span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Integrated action: add a missed day */}
      {unloggedDays.length > 0 && (
        <div className={days.length > 0 ? "mt-3 pt-3 border-t border-gray-100" : "mt-4"}>
          {!showDatePicker ? (
            <button
              onClick={() => setShowDatePicker(true)}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
            >
              + Add a missed day
            </button>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Which day would you like to log?</label>
                <select
                  defaultValue=""
                  onChange={(e) => { if (e.target.value) onDayClick(e.target.value); }}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="" disabled>Choose a date...</option>
                  {unloggedDays.map((d) => (
                    <option key={d} value={d}>{formatDayLabel(d)}</option>
                  ))}
                </select>
              </div>
              <button onClick={() => setShowDatePicker(false)} className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500">
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <DeleteDayDialog
          date={deleteTarget}
          deleting={deleting}
          error={deleteError}
          onConfirm={handleDeleteConfirm}
          onCancel={() => { setDeleteTarget(null); setDeleteError(null); }}
        />
      )}
    </Card>
  );
}
/* --- Balance Trend Chart --- */

interface TrendPoint {
  date: string;
  label: string;
  /** How far above/below the user's personal goal for *this specific day* (dailyGoalDeltaKcal). Zero = exactly on goal. */
  goalDelta: number;
  rollingAvg: number | null;
}

function calculateRollingAverage(values: number[], index: number, window = 7): number {
  const start = Math.max(0, index - window + 1);
  const slice = values.slice(start, index + 1);
  return slice.reduce((s, v) => s + v, 0) / slice.length;
}

function formatCalorieDelta(value: number): string {
  const abs = Math.abs(Math.round(value));
  if (abs < 5) return "Right on goal";
  return value <= 0 ? `${abs} kcal under goal` : `${abs} kcal over goal`;
}

function getTrendColor(rollingAvg: number | null): string {
  if (rollingAvg === null) return "#6366f1";
  return rollingAvg <= 0 ? "#16a34a" : "#f97316";
}

/**
 * Picks a clean symmetric Y-axis domain around zero.
 * e.g. max abs 680 → step 300, domain [-900, +900], ticks [-900,-600,-300,0,300,600,900]
 */
function calculateSymmetricDomain(values: number[]): {
  yMin: number;
  yMax: number;
  step: number;
  ticks: number[];
} {
  const maxAbs = Math.max(...values.map((v) => Math.abs(v)), 1);
  const step =
    maxAbs <= 300  ? 100 :
    maxAbs <= 900  ? 300 :
    maxAbs <= 1500 ? 500 :
    1000;
  const bound = Math.ceil(maxAbs / step) * step;
  const ticks: number[] = [];
  for (let v = -bound; v <= bound; v += step) ticks.push(v);
  return { yMin: -bound, yMax: bound, step, ticks };
}

function formatYAxisTick(value: number): string {
  if (value === 0) return "Goal";
  const abs = Math.abs(value);
  return value < 0 ? `${abs} under` : `${abs} over`;
}

function formatYAxisTickMobile(value: number): string {
  if (value === 0) return "Goal";
  const abs = Math.abs(value);
  const label = abs >= 1000 ? `${abs / 1000}k` : `${abs}`;
  return value < 0 ? `−${label}` : `+${label}`;
}

function BalanceTrend({ days }: { days: DailyLogResponse[] }) {
  if (days.length === 0) return null;

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const sorted = [...days].sort((a, b) => a.logDate.localeCompare(b.logDate));
  // goalDelta = how far above/below the user's personal goal for THAT day.
  // Uses each day's snapshotted goal so goal changes mid-month are handled correctly.
  // Zero = hit goal exactly. Negative = better than goal. Positive = fell short.
  const goalDeltas = sorted.map((d) => d.dailyGoalDeltaKcal);
  const hasEnoughForFullWindow = days.length >= 7;

  const points: TrendPoint[] = sorted.map((d, i) => ({
    date: d.logDate,
    label: new Date(d.logDate + "T00:00:00").toLocaleDateString("default", { month: "short", day: "numeric" }),
    goalDelta: d.dailyGoalDeltaKcal,
    rollingAvg: calculateRollingAverage(goalDeltas, i, 7),
  }));

  const lastRolling = points[points.length - 1]?.rollingAvg ?? null;
  const lineColor = getTrendColor(lastRolling);

  // Symmetric domain with clean step — same absolute bound above and below zero
  const allValues = points.flatMap((p) => [p.goalDelta, p.rollingAvg ?? p.goalDelta]);
  const domain = calculateSymmetricDomain(allValues);

  // X-axis tick thinning for mobile
  const tickStep = points.length <= 10 ? 1 : points.length <= 20 ? 2 : Math.ceil(points.length / 10);
  const xTicks = points.filter((_, i) => i % tickStep === 0).map((p) => p.label);

  function TooltipContent({ active, payload }: TooltipProps<number, string>) {
    if (!active || !payload || payload.length === 0) return null;
    const point = payload[0]?.payload as TrendPoint | undefined;
    if (!point) return null;
    const daily = point.goalDelta;
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg text-xs max-w-[180px]">
        <p className="font-semibold text-gray-700 mb-1">{point.label}</p>
        <p className="text-gray-400">
          That day:{" "}
          <span className={daily <= 0 ? "text-green-600 font-semibold" : "text-orange-500 font-semibold"}>
            {formatCalorieDelta(daily)}
          </span>
        </p>
      </div>
    );
  }

  return (
    <Card
      title="Are you staying on track?"
      subtitle="Each bar shows how far above or below your personal calorie goal you were. Adjusts automatically when your settings change."
      variant="muted"
    >
      {points.length < 2 ? (
        <p className="text-xs text-gray-400 text-center py-4">Log at least 2 days to see the trend.</p>
      ) : (
        <>
          {!hasEnoughForFullWindow && (
            <p className="mb-2 text-[10px] text-gray-400">
              Building trend — {days.length} day{days.length !== 1 ? "s" : ""} logged
            </p>
          )}

          <div className="w-full" style={{ height: isMobile ? 220 : 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              {/* tabIndex={-1} + outline none prevents the browser focus ring on click */}
              <ComposedChart data={points} margin={{ top: 4, right: isMobile ? 8 : 16, left: 4, bottom: 4 }} barCategoryGap="30%" style={{ outline: "none" }} tabIndex={-1}>
                {/* Background zones */}
                <ReferenceArea y1={0} y2={domain.yMax} fill="#fef3c7" fillOpacity={0.3} ifOverflow="hidden" />
                <ReferenceArea y1={domain.yMin} y2={0} fill="#dcfce7" fillOpacity={0.3} ifOverflow="hidden" />

                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="label"
                  ticks={xTicks}
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[domain.yMin, domain.yMax]}
                  ticks={domain.ticks}
                  tick={{ fontSize: 9, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={isMobile ? formatYAxisTickMobile : formatYAxisTick}
                  width={isMobile ? 40 : 68}
                />
                {/* Goal line — zero is the user's personal calorie goal for each specific day */}
                <ReferenceLine
                  y={0}
                  stroke="#6b7280"
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  label={{ value: "Your goal", position: "insideTopRight", fontSize: 9, fill: "#6b7280", fontWeight: 600 }}
                />
                <Tooltip
                  content={<TooltipContent />}
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                  allowEscapeViewBox={{ x: false, y: false }}
                  wrapperStyle={{ zIndex: 10 }}
                />

                {/* Daily deviation bars — green = under goal, orange = over goal */}
                <Bar dataKey="goalDelta" name="daily" maxBarSize={18} radius={[2, 2, 2, 2]}>
                  {points.map((p) => (
                    <Cell
                      key={p.date}
                      fill={p.goalDelta <= 0 ? "#86efac" : "#fdba74"}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>

                {/* Rolling average — main trend line drawn on top of bars */}
                <Line
                  type="monotone"
                  dataKey="rollingAvg"
                  name="rolling"
                  stroke={lineColor}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: isMobile ? 7 : 5, fill: lineColor, stroke: "#fff", strokeWidth: 2 }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="mt-1 flex justify-center gap-4 text-[10px] text-gray-400">
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-2.5 rounded-sm bg-green-300" />
              Under goal
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-2.5 rounded-sm bg-orange-200" />
              Over goal
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-4 rounded" style={{ backgroundColor: lineColor }} />
              Trend
            </span>
          </div>
        </>
      )}
    </Card>
  );
}

/* --- Day Detail --- */

function DayDetail({ date }: { date: string }) {
  const backTo = "/history?m=" + date.slice(0, 7); // e.g. /history?m=2025-04
  return (
    <div className="space-y-6">
      <div>
        <Link to={backTo} className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">
          &larr; Back to month
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{formatDayLabel(date)}</h1>
        <p className="mt-1.5 text-sm text-gray-400">Review and edit this day's meals and activities.</p>
      </div>

      <DayDashboard date={date} />
    </div>
  );
}

/* --- Delete Day Confirmation Dialog --- */

function DeleteDayDialog({ date, deleting, error, onConfirm, onCancel }: {
  date: string;
  deleting: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
      <div className="relative w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50">
            <svg className="h-5 w-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
          <div className="min-w-0">
            <h3 id="delete-dialog-title" className="text-base font-semibold text-gray-900">Delete this day?</h3>
            <p className="mt-1.5 text-sm text-gray-500">
              All meals, activities, and data for <span className="font-medium text-gray-700">{formatDayLabel(date)}</span> will be permanently removed. Your weekly and monthly summaries will be recalculated.
            </p>
            <p className="mt-1 text-xs text-gray-400">This action cannot be undone.</p>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="rounded-md border border-gray-300 px-3.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="rounded-md bg-red-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
          >
            {deleting ? "Deleting…" : "Yes, delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function FriendlyBalance({ value }: { value: number }) {
  const isUnder = value <= 0;
  return (
    <span className={"text-sm tabular-nums font-semibold " + (isUnder ? "text-green-700" : "text-amber-600")}>
      {fmt(Math.abs(value))} kcal {isUnder ? "under" : "over"}
    </span>
  );
}

function FriendlyGoalDelta({ value }: { value: number }) {
  if (Math.abs(value) < 1) return <span className="text-gray-400">On target</span>;
  const isUnder = value <= 0;
  return (
    <span className={"tabular-nums " + (isUnder ? "text-green-700/70" : "text-amber-500")}>
      {fmt(Math.abs(value))} {isUnder ? "under" : "over"}
    </span>
  );
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("default", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function Card({ title, subtitle, variant, children }: { title: string; subtitle?: string; variant?: "primary" | "muted"; children: React.ReactNode }) {
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
    <section className={`${sectionClass} p-4 sm:p-5`}>
      <h2 className={`${titleClass} mb-1`}>{title}</h2>
      {subtitle && <p className="mb-3 text-xs text-gray-400">{subtitle}</p>}
      {!subtitle && <div className="mb-2" />}
      {children}
    </section>
  );
}

function Stat({ label, value, accent, hint }: { label: string; value: string; accent?: boolean; hint?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={"text-lg font-semibold " + (accent ? "text-indigo-600" : "text-gray-900")}>{value}</p>
      {hint && <p className="text-[10px] text-gray-400/70 leading-tight">{hint}</p>}
    </div>
  );
}
