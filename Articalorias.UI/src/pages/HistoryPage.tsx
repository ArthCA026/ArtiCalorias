import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, useSearchParams, Link } from "react-router";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
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
} from "recharts";
import { historyService } from "@/services/historyService";
import { dailyLogService } from "@/services/dailyLogService";
import type { DailyLogResponse } from "@/types/dailyLog";
import { fmt, toDateString } from "@/utils/format";
import { useUnits } from "@/hooks/useUnits";
import { formatEnergy, kcalToDisplay } from "@/utils/units";
import { extractApiError } from "@/utils/apiError";
import { queryKeys } from "@/lib/queryKeys";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import EmptyState from "@/components/EmptyState";
import DayDashboard from "@/components/DayDashboard";
import { useTheme } from "@/hooks/useTheme";
import { useCalorieMode } from "@/hooks/useCalorieMode";
import type { CalorieMode } from "@/hooks/useCalorieMode";

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
  const queryClientInstance = useQueryClient();

  const from = year + "-" + String(month).padStart(2, "0") + "-01";
  const lastDay = new Date(year, month, 0).getDate();
  const to = year + "-" + String(month).padStart(2, "0") + "-" + String(lastDay).padStart(2, "0");

  const historyQuery = useQuery({
    queryKey: queryKeys.history(from, to),
    queryFn: () => historyService.getDailyRange(from, to).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const days = historyQuery.data ?? [];
  const loading = historyQuery.isPending;
  const error = historyQuery.isError ? "history.load_error" : null;

  const monthLabel = new Date(year, month - 1).toLocaleString(i18n.language, {
    month: "long",
    year: "numeric",
  });

  const { t } = useTranslation();
  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;

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
  const todayStr = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  const unloggedDays: string[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const dateStr = year + "-" + String(month).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    if (dateStr < todayStr && !loggedDates.has(dateStr)) {
      unloggedDays.push(dateStr);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 p-1 gap-0.5">
          <button
            onClick={goPrev}
            aria-label={t('history.prev_month')}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 hover:shadow-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <span className="min-w-[148px] text-center text-sm font-semibold text-gray-800 dark:text-gray-200 select-none px-1">
            {monthLabel}
          </span>
          <button
            onClick={goNext}
            disabled={isCurrentMonth}
            aria-label={t('history.next_month')}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 hover:shadow-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      </div>

      {loading && <LoadingSpinner message={t('history.loading')} />}
      {error && <ErrorMessage message={t(error)} onRetry={() => historyQuery.refetch()} />}

      {!loading && !error && (
        <>
          {days.length >= 1 && <BalanceTrend days={days} />}
          {(days.length > 0 || unloggedDays.length > 0) && (
            <DailyLogsCard days={days} unloggedDays={unloggedDays} onDayClick={(d) => navigate(d === toDateString() ? "/today" : "/history/" + d)} onDayDeleted={() => queryClientInstance.invalidateQueries({ queryKey: queryKeys.history(from, to) })} />
          )}
        </>
      )}
    </div>
  );
}

/* --- Daily Logs Card --- */

function DailyLogsCard({ days, unloggedDays, onDayClick, onDayDeleted }: { days: DailyLogResponse[]; unloggedDays: string[]; onDayClick: (date: string) => void; onDayDeleted: () => void }) {
  const { t } = useTranslation();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const todayStr = toDateString();
  const { mode: chartMode } = useCalorieMode();

  const tableColumnLabel =
    chartMode === "net" ? t('history.table_net') :
    chartMode === "goal" ? t('history.table_goal') :
    t('history.table_adjusted');

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
      .catch((err) => setDeleteError(extractApiError(err, t('history.delete_error_default'))))
      .finally(() => setDeleting(false));
  }

  return (
    <Card title={t('history.logs_title')}>

      {days.length === 0 ? (
        <EmptyState message={t('history.no_logs')} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 sticky top-0 z-10">
                  <th className="py-2.5 px-3 text-left">{t('history.table_date')}</th>
                  <th className="py-2.5 px-2 text-right">{tableColumnLabel}</th>
                  <th className="py-2.5 px-2 text-right">{t('history.table_protein')}</th>
                  <th className="py-2.5 px-2 text-center w-10"><span className="sr-only">{t('history.table_actions')}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {days.map((d, idx) => (
                  <tr
                    key={d.logDate}
                    onClick={() => onDayClick(d.logDate)}
                    className={`cursor-pointer group transition-colors hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 ${idx % 2 === 1 ? "bg-gray-50/40 dark:bg-gray-900/30" : "dark:bg-transparent"}`}
                  >
                    <td className="py-2.5 px-3 font-medium text-indigo-600">
                      <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 align-middle ${getTableDelta(d, chartMode) <= 0 ? "bg-green-400" : "bg-amber-400"}`} aria-hidden="true" />
                      {formatDayLabel(d.logDate, i18n.language)}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <FriendlyGoalDelta value={getTableDelta(d, chartMode)} />
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums font-medium text-gray-700 dark:text-gray-300">{fmt(d.totalProteinGrams, 1)} g</td>
                    <td className="py-2.5 px-2 text-center">
                      {d.logDate !== todayStr && (
                        <button
                          onClick={(e) => handleDeleteClick(e, d.logDate)}
                          title={t('history.delete_title')}
                          className="inline-flex items-center justify-center rounded p-1 text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
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
                className="cursor-pointer rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-medium text-indigo-600 text-sm">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 align-middle ${getTableDelta(d, chartMode) <= 0 ? "bg-green-400" : "bg-amber-400"}`} aria-hidden="true" />
                    {formatDayLabel(d.logDate, i18n.language)}
                  </span>
                  <div className="flex items-center gap-2">
                    {d.logDate !== todayStr && (
                      <button
                        onClick={(e) => handleDeleteClick(e, d.logDate)}
                        title={t('history.delete_title')}
                        className="inline-flex items-center justify-center rounded p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                  <span>{t('history.mobile_protein')} <span className="font-medium text-gray-700 dark:text-gray-300">{fmt(d.totalProteinGrams, 1)} g</span></span>
                  <span>{tableColumnLabel}: <FriendlyGoalDelta value={getTableDelta(d, chartMode)} /></span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Integrated action: add a missed day */}
      {unloggedDays.length > 0 && (
          <div className={days.length > 0 ? "pt-3 border-t border-gray-100 dark:border-gray-800" : "mt-3"}>
          {!showDatePicker ? (
            <button
              onClick={() => setShowDatePicker(true)}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
            >
              {t('history.add_missed_day')}
            </button>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('history.which_day')}</label>
                <select
                  defaultValue=""
                  onChange={(e) => { if (e.target.value) onDayClick(e.target.value); }}
                  className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none">
                  <option value="" disabled>{t('history.choose_date')}</option>
                  {unloggedDays.map((d) => (
                    <option key={d} value={d}>{formatDayLabel(d, i18n.language)}</option>
                  ))}
                </select>
              </div>
              <button onClick={() => setShowDatePicker(false)} className="rounded-md px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500">
                {t('common.cancel')}
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

type ChartMode = CalorieMode;

const CHART_MODE_CONFIG: Record<ChartMode, {
  zeroLabelKey: string;
  zeroLabelShortKey: string;
  subtitleKey: string;
  tooltipZeroKey: string;
  tooltipUnderKey: string;
  tooltipOverKey: string;
}> = {
  net: {
    zeroLabelKey: "history.net_zero_label",
    zeroLabelShortKey: "history.net_zero_short",
    subtitleKey: "history.net_subtitle",
    tooltipZeroKey: "history.net_tooltip_zero",
    tooltipUnderKey: "history.net_tooltip_under",
    tooltipOverKey: "history.net_tooltip_over",
  },
  goal: {
    zeroLabelKey: "history.goal_zero_label",
    zeroLabelShortKey: "history.goal_zero_short",
    subtitleKey: "history.goal_subtitle",
    tooltipZeroKey: "history.goal_tooltip_zero",
    tooltipUnderKey: "history.goal_tooltip_under",
    tooltipOverKey: "history.goal_tooltip_over",
  },
  adjusted: {
    zeroLabelKey: "history.adjusted_zero_label",
    zeroLabelShortKey: "history.adjusted_zero_short",
    subtitleKey: "history.adjusted_subtitle",
    tooltipZeroKey: "history.adjusted_tooltip_zero",
    tooltipUnderKey: "history.adjusted_tooltip_under",
    tooltipOverKey: "history.adjusted_tooltip_over",
  },
};

interface TrendPoint {
  date: string;
  label: string;
  /** Deviation from zero for the active chart mode. Negative = below target. */
  value: number;
  rollingAvg: number | null;
}

function calculateRollingAverage(values: number[], index: number, window = 7): number {
  const start = Math.max(0, index - window + 1);
  const slice = values.slice(start, index + 1);
  return slice.reduce((s, v) => s + v, 0) / slice.length;
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

function formatYAxisTick(value: number, zeroLabel = "Goal"): string {
  if (value === 0) return zeroLabel;
  const abs = Math.abs(value);
  return value < 0 ? `${abs} under` : `${abs} over`;
}

function formatYAxisTickMobile(value: number, zeroLabel = "Goal"): string {
  if (value === 0) return zeroLabel;
  const abs = Math.abs(value);
  const label = abs >= 1000 ? `${abs / 1000}k` : `${abs}`;
  return value < 0 ? `−${label}` : `+${label}`;
}

function BalanceTrend({ days }: { days: DailyLogResponse[] }) {
  if (days.length === 0) return null;

  const { t } = useTranslation();
  const { theme } = useTheme();
  const { energyUnit } = useUnits();
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const gridStroke = isDark ? "#374151" : "#e5e7eb";
  const axisTickFill = isDark ? "#6b7280" : "#9ca3af";
  const refLineStroke = isDark ? "#9ca3af" : "#6b7280";

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const { mode: chartMode } = useCalorieMode();

  const cfg = CHART_MODE_CONFIG[chartMode];

  function getChartValue(d: DailyLogResponse): number {
    if (chartMode === "net")  return d.totalFoodCaloriesKcal - d.totalDailyExpenditureKcal;
    if (chartMode === "goal") return d.dailyGoalDeltaKcal;
    // adjusted: net balance minus the weekly-adjusted target
    return (d.totalFoodCaloriesKcal - d.totalDailyExpenditureKcal) - d.suggestedDailyAverageRemainingKcal;
  }

  const sorted = [...days].sort((a, b) => a.logDate.localeCompare(b.logDate));
  const values = sorted.map(getChartValue);
  const hasEnoughForFullWindow = days.length >= 7;

  const points: TrendPoint[] = sorted.map((d, i) => ({
    date: d.logDate,
    label: new Date(d.logDate + "T00:00:00").toLocaleDateString(i18n.language, { month: "short", day: "numeric" }),
    value: getChartValue(d),
    rollingAvg: calculateRollingAverage(values, i, 7),
  }));

  const lastRolling = points[points.length - 1]?.rollingAvg ?? null;
  const lineColor = getTrendColor(lastRolling);

  const allValues = points.flatMap((p) => [p.value, p.rollingAvg ?? p.value]);
  const domain = calculateSymmetricDomain(allValues);

  const tickStep = points.length <= 10 ? 1 : points.length <= 20 ? 2 : Math.ceil(points.length / 10);
  const xTicks = points.filter((_, i) => i % tickStep === 0).map((p) => p.label);

  function TooltipContent({ active, payload }: { active?: boolean; payload?: { payload?: TrendPoint }[] }) {
    if (!active || !payload || payload.length === 0) return null;
    const point = payload[0]?.payload;
    if (!point) return null;
    const daily = point.value;
    const abs = Math.abs(daily);
    const text =
      abs < 5    ? t(cfg.tooltipZeroKey)
      : daily <= 0 ? `${formatEnergy(abs, energyUnit)} ${t(cfg.tooltipUnderKey)}`
      :               `${formatEnergy(abs, energyUnit)} ${t(cfg.tooltipOverKey)}`;
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 shadow-lg text-xs max-w-[180px]">
        <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{point.label}</p>
        <p className="text-gray-400 dark:text-gray-500">
          {t('history.chart_today')}{" "}
          <span className={daily <= 0 ? "text-green-600 font-semibold" : "text-orange-500 font-semibold"}>
            {text}
          </span>
        </p>
      </div>
    );
  }

  const underLabel = chartMode === "net" ? t('history.chart_deficit') : t('history.chart_under');
  const overLabel  = chartMode === "net" ? t('history.chart_surplus') : t('history.chart_over');

  return (
    <Card title={t('history.chart_title')} subtitle={t(cfg.subtitleKey)} variant="muted">

      {points.length < 2 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">{t('history.chart_min_data')}</p>
      ) : (
        <>
          {!hasEnoughForFullWindow && (
            <p className="mb-2 text-[10px] text-gray-400 dark:text-gray-500">
              {t('history.building_trend', { count: days.length })}
            </p>
          )}

          <div className="w-full" style={{ height: isMobile ? 220 : 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={points} margin={{ top: 4, right: isMobile ? 8 : 16, left: 4, bottom: 4 }} barCategoryGap="30%" style={{ outline: "none" }} tabIndex={-1}>
                <ReferenceArea y1={0} y2={domain.yMax} fill="#fef3c7" fillOpacity={0.3} ifOverflow="hidden" />
                <ReferenceArea y1={domain.yMin} y2={0} fill="#dcfce7" fillOpacity={0.3} ifOverflow="hidden" />

                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis
                  dataKey="label"
                  ticks={xTicks}
                  tick={{ fontSize: 10, fill: axisTickFill }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[domain.yMin, domain.yMax]}
                  ticks={domain.ticks}
                  tick={{ fontSize: 9, fill: axisTickFill }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={isMobile
                    ? (v) => formatYAxisTickMobile(kcalToDisplay(v, energyUnit), t(cfg.zeroLabelShortKey))
                    : (v) => formatYAxisTick(kcalToDisplay(v, energyUnit), t(cfg.zeroLabelShortKey))
                  }
                  width={isMobile ? 40 : 68}
                />
                <ReferenceLine
                  y={0}
                  stroke={refLineStroke}
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  label={{ value: t(cfg.zeroLabelKey), position: "insideTopRight", fontSize: 9, fill: refLineStroke, fontWeight: 600 }}
                />
                <Tooltip
                  content={<TooltipContent />}
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                  allowEscapeViewBox={{ x: false, y: false }}
                  wrapperStyle={{ zIndex: 10 }}
                />

                <Bar dataKey="value" name="daily" maxBarSize={18} radius={[2, 2, 2, 2]}>
                  {points.map((p) => (
                    <Cell
                      key={p.date}
                      fill={p.value <= 0 ? "#86efac" : "#fdba74"}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>

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
          <div className="mt-1 flex justify-center gap-4 text-[10px] text-gray-400 dark:text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-2.5 rounded-sm bg-green-300" />
              {underLabel}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-2.5 rounded-sm bg-orange-200" />
              {overLabel}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-4 rounded" style={{ backgroundColor: lineColor }} />
              {t('history.chart_legend_trend')}
            </span>
          </div>
        </>
      )}
    </Card>
  );
}

/* --- Day Detail --- */

function DayDetail({ date }: { date: string }) {
  const { t } = useTranslation();
  const backTo = "/history?m=" + date.slice(0, 7);
  return (
    <div className="space-y-4">
      <div>
        <Link to={backTo} className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">
          {t('history.back_to_month')}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{formatDayLabel(date, i18n.language)}</h1>
        <p className="mt-1.5 text-sm text-gray-400 dark:text-gray-500">{t('history.day_detail_subtitle')}</p>
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
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
      <div className="relative w-full max-w-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-xl">
        <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/30">
            <svg className="h-5 w-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
          <div className="min-w-0">
            <h3 id="delete-dialog-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('history.delete_title')}</h3>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
              {t('history.delete_body_prefix')} <span className="font-medium text-gray-700 dark:text-gray-300">{formatDayLabel(date, i18n.language)}</span> {t('history.delete_body_suffix')}
            </p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{t('history.delete_warning')}</p>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-md bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="rounded-md border border-gray-300 dark:border-gray-600 px-3.5 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="rounded-md bg-red-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
          >
            {deleting ? t('history.deleting') : t('history.delete_confirm')}
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

function getAdjustedDelta(d: DailyLogResponse): number {
  return (d.totalFoodCaloriesKcal - d.totalDailyExpenditureKcal) - d.suggestedDailyAverageRemainingKcal;
}

function getTableDelta(d: DailyLogResponse, mode: ChartMode): number {
  if (mode === "net")  return d.totalFoodCaloriesKcal - d.totalDailyExpenditureKcal;
  if (mode === "goal") return d.dailyGoalDeltaKcal;
  return getAdjustedDelta(d);
}

function FriendlyGoalDelta({ value }: { value: number }) {
  const { t } = useTranslation();
  const { energyUnit } = useUnits();
  if (Math.abs(value) < 1) return <span className="text-gray-400">{t('history.on_target')}</span>;
  const isUnder = value <= 0;
  return (
    <span className={"tabular-nums " + (isUnder ? "text-green-700/70" : "text-amber-500")}>
      {formatEnergy(Math.abs(value), energyUnit)} {isUnder ? t('history.under') : t('history.over')}
    </span>
  );
}

function formatDayLabel(dateStr: string, language = "default"): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(language, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function Card({ title, subtitle, variant, headerAction, children }: { title: string; subtitle?: string; variant?: "primary" | "muted"; headerAction?: React.ReactNode; children: React.ReactNode }) {
  const sectionClass = variant === "primary"
    ? "rounded-xl border-2 border-indigo-200 dark:border-indigo-700 bg-white dark:bg-gray-900 shadow-md ring-1 ring-indigo-100 dark:ring-indigo-900"
    : variant === "muted"
      ? "rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40 shadow-none"
      : "rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm";
  const titleClass = variant === "primary"
    ? "text-sm font-bold uppercase tracking-wide text-indigo-600"
    : variant === "muted"
      ? "text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500"
      : "text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400";

  return (
    <section className={`${sectionClass} p-4 sm:p-5`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <h2 className={titleClass}>{title}</h2>
        {headerAction && <div className="flex items-center">{headerAction}</div>}
      </div>
      {subtitle && <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>}
      {!subtitle && <div className="mb-2" />}
      {children}
    </section>
  );
}
