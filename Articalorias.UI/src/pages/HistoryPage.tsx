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
  const [showDatePicker, setShowDatePicker] = useState(false);

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
      .catch(() => setError("Failed to load history."))
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">History</h1>
        <div className="flex items-center gap-3">
          <button onClick={goPrev} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">&larr; Prev</button>
          <span className="min-w-[160px] text-center text-sm font-semibold text-gray-700">{monthLabel}</span>
          <button onClick={goNext} disabled={isCurrentMonth} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">Next &rarr;</button>
        </div>
      </div>

      {loading && <LoadingSpinner message="Loading history..." />}
      {error && <ErrorMessage message={error} onRetry={load} />}

      {!loading && !error && (
        <>
          {summary && <MonthlySummaryCard summary={summary} />}
          <DailyLogsCard days={days} onDayClick={(d) => navigate("/history/" + d)} />

          <div className="mt-4 pt-4 border-t border-gray-100">
            {!showDatePicker ? (
              <button
                onClick={() => setShowDatePicker(true)}
                disabled={unloggedDays.length === 0}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + Log a past day
              </button>
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Select an unlogged date</label>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) navigate("/history/" + e.target.value);
                      }}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                    >
                      <option value="" disabled>Pick a date...</option>
                      {unloggedDays.map((d) => (
                        <option key={d} value={d}>{formatDayLabel(d)}</option>
                      ))}
                    </select>
                  </div>
                  <button onClick={() => setShowDatePicker(false)} className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
                    Cancel
                  </button>
                </div>
              )}
            </div>
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

  return (
    <Card title="Monthly Summary">
      <div className="space-y-3">
        {/* Avg daily balance */}
        <div className={`rounded-md px-4 py-3 text-sm font-medium ${isDeficit ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {isDeficit
            ? `Average daily deficit: ${fmt(Math.abs(avgBalance))} kcal`
            : `Average daily surplus: ${fmt(avgBalance)} kcal`}
        </div>

        {/* Avg protein per day */}
        <div className="rounded-md px-4 py-3 text-sm font-medium bg-blue-50 text-blue-700">
          Average protein per day: {fmt(avgProtein, 1)} g
        </div>

        {/* Estimated weight change */}
        {weightChange != null && (
          <div className={`rounded-md px-4 py-3 text-sm font-medium ${weightChange <= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {weightChange <= 0
              ? `Estimated loss so far: ${fmt(Math.abs(weightChange), 2)} kg`
              : `Estimated gain so far: ${fmt(weightChange, 2)} kg`}
          </div>
        )}

        {/* Details toggle */}
        <DetailsToggle open={showDetails} onToggle={() => setShowDetails((v) => !v)} label="details" />

        {showDetails && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-100">
            <Stat label="Days logged" value={String(s.daysLogged)} />
            <Stat label="Total consumed" value={fmt(s.totalFoodCaloriesKcal) + " kcal"} />
            <Stat label="Total spent" value={fmt(s.totalActivityCaloriesKcal) + " kcal"} />
            <Stat label="Monthly balance" value={fmt(s.actualMonthlyBalanceKcal) + " kcal"} accent />
            <Stat label="Total protein" value={fmt(s.totalProteinGrams, 1) + " g"} />
            <Stat label="Avg daily food" value={fmt(s.averageDailyFoodCaloriesKcal) + " kcal"} />
            <Stat label="Avg daily expenditure" value={fmt(s.averageDailyExpenditureKcal) + " kcal"} />
          </div>
        )}
      </div>
    </Card>
  );
}

/* --- Daily Logs Card --- */

function DailyLogsCard({ days, onDayClick }: { days: DailyLogResponse[]; onDayClick: (date: string) => void }) {
  const [showFullTable, setShowFullTable] = useState(false);

  return (
    <Card title="Daily Logs">
      {days.length === 0 ? (
        <EmptyState message="No logged days for this month." />
      ) : (
        <>
          <DetailsToggle open={showFullTable} onToggle={() => setShowFullTable((v) => !v)} label="all columns" />

          <div className="overflow-x-auto mt-3">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="pb-2 pr-4">Date</th>
                  {showFullTable && <th className="pb-2 pr-4 text-right">Consumed</th>}
                  {showFullTable && <th className="pb-2 pr-4 text-right">Spent</th>}
                  <th className="pb-2 pr-4 text-right">Balance</th>
                  <th className="pb-2 pr-4 text-right">Protein</th>
                  {showFullTable && <th className="pb-2 text-right">Goal Delta</th>}
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d.logDate} onClick={() => onDayClick(d.logDate)} className="cursor-pointer border-b border-gray-100 hover:bg-indigo-50 transition-colors">
                    <td className="py-2 pr-4 font-medium text-indigo-600">{formatDayLabel(d.logDate)}</td>
                    {showFullTable && <td className="py-2 pr-4 text-right">{fmt(d.totalFoodCaloriesKcal)} kcal</td>}
                    {showFullTable && <td className="py-2 pr-4 text-right">{fmt(d.totalActivityCaloriesKcal)} kcal</td>}
                    <td className="py-2 pr-4 text-right">
                      {showFullTable ? (
                        <span className={"font-semibold " + (d.netBalanceKcal <= 0 ? "text-green-600" : "text-red-500")}>{fmt(d.netBalanceKcal)} kcal</span>
                      ) : (
                        <FriendlyBalance value={d.netBalanceKcal} />
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right">{fmt(d.totalProteinGrams, 1)} g</td>
                    {showFullTable && (
                      <td className={"py-2 text-right " + (d.dailyGoalDeltaKcal <= 0 ? "text-green-600" : "text-red-500")}>
                        {d.dailyGoalDeltaKcal > 0 ? "+" : ""}{fmt(d.dailyGoalDeltaKcal)} kcal
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

/* --- Day Detail --- */

function DayDetail({ date }: { date: string }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/history" className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">&larr; Back</Link>
        <h1 className="text-2xl font-bold text-gray-900">{formatDayLabel(date)}</h1>
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
      {open ? `Hide ${label}` : `Show ${label}`}
    </button>
  );
}

function FriendlyBalance({ value }: { value: number }) {
  const isDeficit = value <= 0;
  return (
    <span className={"font-semibold " + (isDeficit ? "text-green-600" : "text-red-500")}>
      {isDeficit ? "Deficit" : "Surplus"}: {fmt(Math.abs(value))} kcal
    </span>
  );
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("default", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
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
