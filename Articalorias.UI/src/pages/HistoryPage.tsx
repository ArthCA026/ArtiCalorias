import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { historyService } from "@/services/historyService";
import type { DailyLogResponse } from "@/types/dailyLog";
import type { MonthlySummaryResponse } from "@/types/history";
import { fmt } from "@/utils/format";
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
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
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
          {summary ? (
            <MonthlySummaryCard summary={summary} />
          ) : (
            <Card title="How your month is going" variant="primary">
              <p className="text-sm text-gray-500 italic">
                No data for this month yet — head to your{" "}
                <Link to="/today" className="font-medium text-indigo-600 hover:text-indigo-800 not-italic">Daily page</Link>
                {" "}to start logging.
              </p>
            </Card>
          )}
          {days.length >= 2 && (
            <div className="space-y-3">
              <TrendCues days={days} />
              <BalanceTrend days={days} />
            </div>
          )}
          {(days.length > 0 || unloggedDays.length > 0) && (
            <DailyLogsCard days={days} unloggedDays={unloggedDays} onDayClick={(d) => navigate("/history/" + d)} />
          )}
        </>
      )}
    </div>
  );
}

/* --- Monthly Summary Card --- */

function MonthlySummaryCard({ summary: s }: { summary: MonthlySummaryResponse }) {
  const [showDetails, setShowDetails] = useState(false);

  const avgBalance = s.averageDailyBalanceKcal;
  const isDeficit = avgBalance <= 0;
  const avgProtein = s.daysLogged > 0 ? s.totalProteinGrams / s.daysLogged : 0;
  const weightChange = s.estimatedWeightChangeKg;
  const monthName = new Date(s.yearNumber, s.monthNumber - 1).toLocaleString("default", { month: "long" });
  const today = new Date();
  const daysInMonth = new Date(s.yearNumber, s.monthNumber, 0).getDate();
  const isCurrent = s.yearNumber === today.getFullYear() && s.monthNumber === today.getMonth() + 1;
  const totalDays = isCurrent ? today.getDate() : daysInMonth;

  // Coaching status — friendly, supportive
  let statusText: string;
  if (s.daysLogged === 0) {
    statusText = "No days logged yet — your monthly picture builds as you track each day";
  } else if (s.daysLogged <= 3) {
    statusText = "Just getting started — your averages will get more accurate as you log more days";
  } else if (isDeficit) {
    statusText = Math.abs(avgBalance) > 300
      ? "You're making solid progress this month — keep it up!"
      : "You're in a slight deficit — steady and sustainable wins the race";
  } else {
    statusText = avgBalance > 300
      ? "You're trending above your target — small adjustments can make a big difference"
      : "You're close to maintenance — a small tweak could get you back on track";
  }

  if (s.daysLogged === 0) {
    return (
      <Card title="How your month is going" variant="primary">
        <div className="space-y-2.5">
          <p className="text-sm text-gray-500 italic">{statusText}</p>
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-600">
            0 of {totalDays} {totalDays === 1 ? "day" : "days"} logged
          </span>
          <p className="text-sm text-gray-400">
            Head to your{" "}
            <Link to="/today" className="font-medium text-indigo-600 hover:text-indigo-800">Daily page</Link>
            {" "}to log your first day — it only takes a minute.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card title="How your month is going" variant="primary">
      <div className="space-y-2.5">
        {/* Coaching status */}
        <p className="text-sm text-gray-500 italic">{statusText}</p>

        {/* Consistency cue */}
        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-600">
          {s.daysLogged} of {totalDays} {totalDays === 1 ? "day" : "days"} logged
        </span>

        {/* Calories per day — primary metric */}
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Calories per day</p>
          <p className={`text-sm font-medium ${isDeficit ? "text-green-700" : "text-amber-600"}`}>
            {isDeficit
              ? `${fmt(Math.abs(avgBalance))} kcal under your target per day — you're heading in the right direction`
              : `${fmt(avgBalance)} kcal over your target per day — that's okay, small shifts add up over time`}
          </p>
        </div>

        {/* Protein per day — secondary metric */}
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Protein per day</p>
          <p className="text-sm font-medium text-indigo-600">
            {fmt(avgProtein, 1)} g per day
          </p>
          <p className="text-xs text-gray-400 italic">Protein helps you stay fuller and protects muscle while losing weight</p>
        </div>

        {/* How your weight is trending */}
        {weightChange != null && (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">How your weight is trending</p>
            <p className={`text-sm font-medium ${weightChange <= 0 ? "text-green-700" : "text-amber-600"}`}>
              {weightChange <= 0
                ? `About ${fmt(Math.abs(weightChange), 2)} kg lost so far this month`
                : `About ${fmt(weightChange, 2)} kg gained so far this month`}
            </p>
            {weightChange > 0 && (
              <p className="text-xs text-amber-500/80 italic">Weight fluctuates — focus on the overall trend over weeks</p>
            )}
          </div>
        )}

        {/* Trust note */}
        <p className="text-[11px] text-gray-400">
          Based on {s.daysLogged} logged {s.daysLogged === 1 ? "day" : "days"} in {monthName} · These are estimates that update as you log more
        </p>

        {/* Expandable details */}
        <button
          onClick={() => setShowDetails((v) => !v)}
          aria-expanded={showDetails}
          aria-controls="monthly-summary-details"
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
          <div id="monthly-summary-details" role="region" aria-label="Detailed monthly numbers" className="space-y-4 pt-2.5 border-t border-gray-100">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">This month so far</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Stat label="Days logged" value={String(s.daysLogged)} />
                <Stat label="Calories eaten" value={fmt(s.totalFoodCaloriesKcal) + " kcal"} />
                <Stat label="Calories burned" value={fmt(s.totalActivityCaloriesKcal) + " kcal"} />
                <Stat label="Net calories" value={fmt(s.actualMonthlyBalanceKcal) + " kcal"} accent />
                <Stat label="Protein eaten" value={fmt(s.totalProteinGrams, 1) + " g"} />
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Your daily averages</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Stat label="Calories eaten per day" value={fmt(s.averageDailyFoodCaloriesKcal) + " kcal"} />
                <Stat label="Calories burned per day" value={fmt(s.averageDailyExpenditureKcal) + " kcal"} />
                <Stat label="Net calories per day" value={fmt(s.averageDailyBalanceKcal) + " kcal"} accent />
              </div>
            </div>
            <p className="text-[11px] text-gray-400 italic">Averages get more reliable as you log more days — consistency is what matters most</p>
          </div>
        )}
      </div>
    </Card>
  );
}

/* --- Daily Logs Card --- */

function DailyLogsCard({ days, unloggedDays, onDayClick }: { days: DailyLogResponse[]; unloggedDays: string[]; onDayClick: (date: string) => void }) {
  const [showFullTable, setShowFullTable] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  return (
    <Card title="Your logged days" subtitle="Click any day to see how it went">
      {days.length === 0 ? (
        <EmptyState message="No logged days yet — you can add a missed day below." />
      ) : (
        <>
          <DetailsToggle open={showFullTable} onToggle={() => setShowFullTable((v) => !v)} label="the details" />

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto mt-3 rounded-lg border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-xs font-semibold uppercase tracking-wider text-gray-500 sticky top-0 z-10">
                  <th className="py-2.5 px-3 text-left">Date</th>
                  {showFullTable && <th className="py-2.5 px-2 text-right">Eaten</th>}
                  {showFullTable && <th className="py-2.5 px-2 text-right font-medium text-gray-400">Burned</th>}
                  <th className="py-2.5 px-2 text-right">Result</th>
                  <th className="py-2.5 px-2 text-right">Protein</th>
                  {showFullTable && <th className="py-2.5 px-2 text-right font-medium text-gray-400">vs. Goal</th>}
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
                    {showFullTable && <td className="py-2.5 px-2 text-right tabular-nums font-semibold text-gray-900">{fmt(d.totalFoodCaloriesKcal)} kcal</td>}
                    {showFullTable && <td className="py-2.5 px-2 text-right tabular-nums text-gray-400">{fmt(d.totalActivityCaloriesKcal)} kcal</td>}
                    <td className="py-2.5 px-2 text-right">
                      <FriendlyBalance value={d.netBalanceKcal} />
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums font-medium text-gray-700">{fmt(d.totalProteinGrams, 1)} g</td>
                    {showFullTable && (
                      <td className="py-2.5 px-2 text-right">
                        <FriendlyGoalDelta value={d.dailyGoalDeltaKcal} />
                      </td>
                    )}
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
                  <FriendlyBalance value={d.netBalanceKcal} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                  <span>Protein: <span className="font-medium text-gray-700">{fmt(d.totalProteinGrams, 1)} g</span></span>
                  {showFullTable && (
                    <span>Eaten: <span className="font-medium text-gray-700">{fmt(d.totalFoodCaloriesKcal)} kcal</span></span>
                  )}
                </div>
                {showFullTable && (
                  <div className="mt-1.5 pt-1.5 border-t border-gray-50 flex flex-wrap items-center gap-x-3 text-xs text-gray-400">
                    <span>Burned: {fmt(d.totalActivityCaloriesKcal)} kcal</span>
                    <span>vs. Goal: <FriendlyGoalDelta value={d.dailyGoalDeltaKcal} /></span>
                  </div>
                )}
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
    </Card>
  );
}

/* --- Trend Cues --- */

function TrendCues({ days }: { days: DailyLogResponse[] }) {
  if (days.length < 2) return null;

  const cues: { icon: string; text: string }[] = [];

  // Deficit / surplus pattern
  const deficitCount = days.filter((d) => d.netBalanceKcal <= 0).length;
  if (deficitCount === days.length) {
    cues.push({ icon: "✅", text: `All ${days.length} logged days were under your target` });
  } else if (deficitCount > 0) {
    cues.push({ icon: "📊", text: `${deficitCount} of ${days.length} logged days were under your target` });
  } else {
    cues.push({ icon: "📊", text: "Your logged days were above target — small adjustments can shift the trend" });
  }

  // Best protein day
  const best = days.reduce((a, b) => (b.totalProteinGrams > a.totalProteinGrams ? b : a), days[0]);
  if (best.totalProteinGrams > 0) {
    const label = new Date(best.logDate + "T00:00:00").toLocaleDateString("default", { weekday: "short", month: "short", day: "numeric" });
    cues.push({ icon: "💪", text: `Best protein day: ${label} (${fmt(best.totalProteinGrams, 0)} g)` });
  }

  if (cues.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {cues.map((c, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50/60 px-3.5 py-2 text-sm text-indigo-700"
        >
          <span aria-hidden="true">{c.icon}</span>
          {c.text}
        </span>
      ))}
    </div>
  );
}

/* --- Balance Trend Chart --- */

function BalanceTrend({ days }: { days: DailyLogResponse[] }) {
  if (days.length < 2) return null;

  const sorted = [...days].sort((a, b) => a.logDate.localeCompare(b.logDate));
  const maxAbs = Math.max(...sorted.map((d) => Math.abs(d.netBalanceKcal)), 1);

  const n = sorted.length;
  const vbW = 400;
  const gap = 4;
  const barW = Math.min(28, Math.max(6, Math.floor((vbW - (n - 1) * gap) / n)));
  const contentW = n * barW + (n - 1) * gap;
  const offsetX = (vbW - contentW) / 2;
  const halfH = 26;
  const midY = halfH;
  const labelH = 11;
  const vbH = halfH * 2 + labelH;

  return (
    <Card title="How each day went" variant="muted">
      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        className="w-full max-w-lg mx-auto"
        role="img"
        aria-label="Daily calorie balance trend chart"
        preserveAspectRatio="xMidYMid meet"
      >
        <line x1={offsetX} y1={midY} x2={offsetX + contentW} y2={midY} stroke="#e5e7eb" strokeWidth={0.5} />
        {sorted.map((d, i) => {
          const x = offsetX + i * (barW + gap);
          const ratio = d.netBalanceKcal / maxAbs;
          const barH = Math.max(Math.abs(ratio) * halfH, 1.5);
          const isDeficit = d.netBalanceKcal <= 0;
          const y = isDeficit ? midY : midY - barH;
          const fill = isDeficit ? "#22c55e" : "#f59e0b";
          const day = new Date(d.logDate + "T00:00:00").getDate();
          return (
            <g key={d.logDate}>
              <rect x={x} y={y} width={barW} height={barH} rx={2} fill={fill} opacity={0.55} />
              <text x={x + barW / 2} y={vbH - 1} textAnchor="middle" fontSize={7} fill="#9ca3af">{day}</text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1.5 flex justify-center gap-4 text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-sm bg-green-500/60" />Under target</span>
        <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-sm bg-amber-500/60" />Over target</span>
      </div>
    </Card>
  );
}

/* --- Day Detail --- */

function DayDetail({ date }: { date: string }) {
  return (
    <div className="space-y-6">
      <div>
        <Link to="/history" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">
          &larr; Back to month
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{formatDayLabel(date)}</h1>
        <p className="mt-1.5 text-sm text-gray-400">Review and edit this day's meals and activities.</p>
      </div>

      <DayDashboard date={date} />
    </div>
  );
}

/* --- Helpers --- */

function DetailsToggle({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      onClick={onToggle}
      aria-expanded={open}
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
      {open ? `Hide ${label}` : `See ${label}`}
    </button>
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

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={"text-lg font-semibold " + (accent ? "text-indigo-600" : "text-gray-900")}>{value}</p>
    </div>
  );
}
