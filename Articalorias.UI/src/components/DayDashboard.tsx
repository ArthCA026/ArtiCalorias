import { useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router";
import { DecimalInput } from "@/components/DecimalInput";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Toast, useToast } from "@/components/Toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { IconEdit, IconTrash, IconCheck, IconX } from "@/components/icons";
import { ModalShell } from "@/components/ModalShell";
import { SectionCard } from "@/components/SectionCard";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { dailyLogService } from "@/services/dailyLogService";
import { foodService } from "@/services/foodService";
import { activityService } from "@/services/activityService";
import { foodTemplateService } from "@/services/foodTemplateService";
import TemplatePickerDialog from "@/components/TemplatePickerDialog";
import type {
  DailyDashboardResponse,
  FoodEntryResponse,
  UpdateFoodEntryRequest,
  ActivityEntryResponse,
  UpdateActivityEntryRequest,
  ParsedFoodItem,
} from "@/types";
import { fmt, toDateString } from "@/utils/format";
import { useUnits } from "@/hooks/useUnits";
import { formatEnergy, energyLabel, kcalToDisplay, displayToKcal } from "@/utils/units";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import { extractApiError, isNotFound } from "@/utils/apiError";
import { queryKeys } from "@/lib/queryKeys";
import { compressImage } from "@/utils/compressImage";
import { useCalorieMode } from "@/hooks/useCalorieMode";
import type { CalorieMode } from "@/hooks/useCalorieMode";
import StreakBadge from "@/components/StreakIndicator";
import { useGetStreak } from "@/hooks/useStreak";
import { ProfileCompletionBanner } from "@/components/ProfileCompletionBanner";

interface DayDashboardProps {
  date: string;
}

export default function DayDashboard({ date }: DayDashboardProps) {
  const { t } = useTranslation();
  const queryClientInstance = useQueryClient();
  const dashQuery = useQuery({
    queryKey: queryKeys.dashboard(date),
    queryFn: async () => {
      try {
        const { data } = await dailyLogService.getDashboard(date);
        return data;
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
  const dash = dashQuery.data ?? null;

  const [activeTab, setActiveTab] = useState<"meals" | "activities">("meals");
  const { mode: chartMode } = useCalorieMode();
  const isToday = useMemo(() => date === toDateString(), [date]);

  const { toast, exiting, showToast } = useToast();

  const { data: streak } = useGetStreak();
  const streakCount = isToday && streak?.streakEnabled ? (streak.currentStreak ?? 0) : 0;

  function handleChanged() {
    queryClientInstance.invalidateQueries({ queryKey: queryKeys.dashboard(date) });
    queryClientInstance.invalidateQueries({ queryKey: queryKeys.historyAll() });
    queryClientInstance.invalidateQueries({ queryKey: queryKeys.streak() });
  }

  if (dashQuery.isPending) return <LoadingSpinner message={t('dashboard.loading_day')} />;
  if (dashQuery.isError) return <ErrorMessage message={extractApiError(dashQuery.error, t('dashboard.failed_load_dashboard'))} onRetry={() => dashQuery.refetch()} />;

  return (
    <div className="space-y-2">
      <CompactDayProgress dash={dash} isToday={isToday} chartMode={chartMode} streakCount={streakCount} />
      <DailyLogWorkspace date={date} dash={dash} onChanged={handleChanged} isToday={isToday} activeTab={activeTab} onTabChange={setActiveTab} onToast={showToast} />
      {toast && <Toast message={toast.message} type={toast.type} exiting={exiting} />}
    </div>
  );
}

/* --- Compact Day Progress --- */
function CompactDayProgress({ dash, isToday, chartMode, streakCount }: { dash: DailyDashboardResponse | null; isToday: boolean; chartMode: CalorieMode; streakCount: number }) {
  if (!dash) return null;
  const { t } = useTranslation();
  const { energyUnit } = useUnits();
  const navigate = useNavigate();

  const effectiveMode = chartMode;

  const dailyBudget =
    effectiveMode === "net"  ? dash.totalDailyExpenditureKcal :
    effectiveMode === "goal" ? dash.totalFoodCaloriesKcal + dash.caloriesRemainingToDailyTargetKcal :
    dash.totalDailyExpenditureKcal + dash.suggestedDailyAverageRemainingKcal;

  const budgetNote =
    effectiveMode === "net"  ? "· vs. TDEE" :
    effectiveMode === "goal" ? "· daily goal" :
    "· weekly adjusted";
  const foodCal = dash.totalFoodCaloriesKcal;
  const calRemaining = dailyBudget - foodCal;
  const calOver = calRemaining < 0;
  const calAbs = Math.abs(calRemaining);

  const protRemaining = dash.proteinRemainingGrams;
  const protGoalReached = protRemaining <= 0;
  const protAbs = Math.abs(protRemaining);

  // Status line · a quick, human-friendly take on the numbers
  const protPct = dash.snapshotProteinGoalGrams > 0 ? dash.totalProteinGrams / dash.snapshotProteinGoalGrams : 1;

  const calPct = dailyBudget > 0 ? Math.round((foodCal / dailyBudget) * 100) : 0;
  const protPctDisplay = Math.round(protPct * 100);

  return (
    <SectionCard
      title={isToday ? t('dashboard.today') : t('dashboard.day_summary')}
      variant="primary"
      compact
      headerAction={isToday ? <StreakBadge streakCount={streakCount} /> : undefined}
    >
      <div className="space-y-1.5">

        {/* Calorie + Protein — combined banner when both estimates are unavailable */}
        {(() => {
          const showCaloriePrompt = !dash.hasCalorieBudgetEstimate;
          const showProteinPrompt = !dash.hasProteinGoal;
          const showCombined = showCaloriePrompt && showProteinPrompt;
          return (
            <>
              {/* Calorie section */}
              {showCombined ? (
                <ProfileCompletionBanner
                  icon="🎯"
                  title={isToday ? t('dashboard.personalized_goals_setup_title') : t('dashboard.historical_personalized_goals_unavailable_title')}
                  body={isToday ? t('dashboard.personalized_goals_setup_body') : t('dashboard.historical_personalized_goals_unavailable_body')}
                  ctaLabel={isToday ? t('dashboard.complete_profile_cta') : undefined}
                  onCta={isToday ? () => navigate("/profile") : undefined}
                />
              ) : showCaloriePrompt ? (
                <ProfileCompletionBanner
                  title={isToday ? t('dashboard.unlock_calorie_estimates_title') : t('dashboard.historical_calorie_budget_unavailable_title')}
                  body={isToday ? t('dashboard.unlock_calorie_estimates_body') : t('dashboard.historical_calorie_budget_unavailable_body')}
                  ctaLabel={isToday ? t('dashboard.complete_profile_cta') : undefined}
                  onCta={isToday ? () => navigate("/profile") : undefined}
                />
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-fg-secondary shrink-0">{t('dashboard.calories_label')}</p>
                    <span className={`text-xs font-semibold tabular-nums ${calOver ? "text-amber-600" : "text-green-700"}`}>
                      {calOver ? t('dashboard.calorie_over_budget', { amount: formatEnergy(calAbs, energyUnit) }) : t('dashboard.calorie_under_budget', { amount: formatEnergy(calAbs, energyUnit) })}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-subtle overflow-hidden" role="progressbar" aria-valuenow={foodCal} aria-valuemin={0} aria-valuemax={dailyBudget} aria-label={t('dashboard.calorie_budget_aria')}>
                    <div className={`h-full rounded-full transition-all duration-500 ${calOver ? "bg-amber-400" : "bg-green-500"}`} style={{ width: `${Math.min(calPct, 100)}%` }} />
                  </div>
                  <p className="text-[11px] tabular-nums text-fg-subtle">{t('dashboard.calorie_progress', { percentage: calPct, consumed: formatEnergy(foodCal, energyUnit), budget: formatEnergy(dailyBudget, energyUnit) })}<span className="ml-1 opacity-50">{budgetNote}</span></p>
                </div>
              )}

              {/* Protein section — hidden when combined banner already handles both */}
              {!showCombined && (
                showProteinPrompt ? (
                  <ProfileCompletionBanner
                    title={isToday ? t('dashboard.unlock_protein_goal_title') : t('dashboard.historical_protein_goal_unavailable_title')}
                    body={isToday ? t('dashboard.unlock_protein_goal_body') : t('dashboard.historical_protein_goal_unavailable_body')}
                    ctaLabel={isToday ? t('dashboard.complete_profile_cta') : undefined}
                    onCta={isToday ? () => navigate("/profile") : undefined}
                  />
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-fg-secondary shrink-0">{t('dashboard.protein_label')}</p>
                      <span className={`text-xs font-semibold tabular-nums ${protGoalReached ? "text-green-700" : "text-indigo-600"}`}>
                        {protGoalReached
                          ? `${protAbs > 0 ? t('dashboard.protein_extra', { amount: fmt(protAbs, 1) }) : t('dashboard.protein_goal_reached')}`
                          : (isToday ? t('dashboard.protein_to_go', { amount: fmt(protAbs, 1) }) : t('dashboard.protein_short', { amount: fmt(protAbs, 1) }))}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-accent-track overflow-hidden" role="progressbar" aria-valuenow={dash.totalProteinGrams} aria-valuemin={0} aria-valuemax={dash.snapshotProteinGoalGrams} aria-label={t('dashboard.protein_aria')}>
                      <div className={`h-full rounded-full transition-all duration-500 ${protGoalReached ? "bg-green-500" : "bg-indigo-500"}`} style={{ width: `${Math.min(protPctDisplay, 100)}%` }} />
                    </div>
                    <p className="text-[11px] tabular-nums text-fg-subtle">{t('dashboard.protein_progress', { percentage: protPctDisplay, consumed: fmt(dash.totalProteinGrams, 1), goal: fmt(dash.snapshotProteinGoalGrams, 1) })}</p>
                  </div>
                )
              )}
            </>
          );
        })()}

      </div>
    </SectionCard>
  );
}

/* --- Next Action Hint --- */
/* --- SVG Icon Helpers --- */
function IconUtensils({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
    </svg>
  );
}

function IconCamera({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function IconPhoto({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function IconStar({ className = "w-4 h-4", filled = false }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

/* --- Food Input (parse free text or image) --- */
function FoodInput({ date, onSaved, isToday, noCard }: { date: string; onSaved: () => void; isToday: boolean; noCard?: boolean }) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Image state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<{ base64: string; mimeType: string } | null>(null);

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function clearImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setImageData(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  }

  async function handleImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setImagePreview(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
    try {
      const compressed = await compressImage(file);
      setImageData(compressed);
    } catch {
    setError("Failed to process the image. Please try a different file.");
      clearImage();
    }
  }

  async function handleAdd() {
    if (!imageData && !text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      let parsed: ParsedFoodItem[];

      if (imageData) {
        const { data } = await dailyLogService.parseFoodWithImage(date, {
          imageBase64: imageData.base64,
          mimeType: imageData.mimeType,
          freeText: text.trim() || null,
        });
        if (!data.length) {
          setError(t('dashboard.food_error_image'));
          return;
        }
        parsed = data;
      } else {
        const { data } = await dailyLogService.parseFood(date, { freeText: text });
        if (!data.length) {
          setError(t('dashboard.food_error_text'));
          return;
        }
        parsed = data;
      }

      await dailyLogService.confirmParsedFoods(date, {
        items: parsed.map((p) => ({
          foodName: p.foodName,
          portionDescription: p.portionDescription,
          quantity: p.quantity,
          caloriesKcal: p.caloriesKcal,
          proteinGrams: p.proteinGrams,
          fatGrams: p.fatGrams,
          carbsGrams: p.carbsGrams,
          alcoholGrams: p.alcoholGrams,
        })),
      });
      setText("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      clearImage();
      onSaved();
    } catch (err) {
      setError(extractApiError(err, "Something went wrong adding your food. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  }

  const hasImage = imageData !== null;
  const canSubmit = hasImage || text.trim().length > 0;

  const foodBody = (
    <>
      {/* Hidden file input · triggers native camera on mobile via capture="environment" */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label={t('dashboard.photo_aria')}
        className="sr-only"
        onChange={handleImageSelected}
      />
      {/* Hidden file input · opens gallery/file picker (no capture attribute) */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        aria-label={t('dashboard.gallery_aria')}
        className="sr-only"
        onChange={handleImageSelected}
      />

      <div className="flex gap-2 items-center">
        {/* Camera button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          aria-label={t('dashboard.photo_aria')}
          title={t('dashboard.photo_title')}
          className={`inline-flex items-center justify-center shrink-0 w-9 h-9 rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed ${
            hasImage
              ? "border-indigo-300 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900"
              : "border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
          }`}
        >
          <IconCamera className="w-4 h-4" />
        </button>

        {/* Gallery button */}
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={busy}
          aria-label={t('dashboard.gallery_aria')}
          title={t('dashboard.gallery_title')}
          className={`inline-flex items-center justify-center shrink-0 w-9 h-9 rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed ${
            hasImage
              ? "border-indigo-300 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900"
              : "border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
          }`}
        >
          <IconPhoto className="w-4 h-4" />
        </button>

        {/* Auto-growing textarea */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => { setText(e.target.value); autoResize(e.target); }}
          onKeyDown={handleKeyDown}
          placeholder={hasImage ? t('dashboard.food_placeholder_image') : t('dashboard.food_placeholder_text')}
          className="flex-1 min-w-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-colors resize-none overflow-hidden leading-normal"
          aria-label={isToday ? t('dashboard.food_aria_today') : t('dashboard.food_aria_past')}
        />

        {/* Log button */}
        <button
          onClick={handleAdd}
          disabled={busy || !canSubmit}
          className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {busy ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          )}
        </button>
      </div>

      {/* Image thumbnail preview */}
      {imagePreview && (
        <div className="mt-2 flex items-center gap-2">
          <div className="relative shrink-0">
            <img
              src={imagePreview}
              alt={t('dashboard.photo_alt')}
              className="h-12 w-12 rounded-lg object-cover border border-gray-200"
            />
            <button
              type="button"
              onClick={clearImage}
              disabled={busy}
              aria-label={t('dashboard.photo_remove_aria')}
              className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gray-700 text-white shadow hover:bg-gray-900 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-700 disabled:opacity-50"
            >
              <IconX className="w-2.5 h-2.5" />
            </button>
          </div>
          {!imageData && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              <svg className="inline animate-spin h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              {t('dashboard.photo_processing')}
            </p>
          )}
        </div>
      )}

      {error && <p className="mt-1.5 text-sm text-red-600" role="alert">{error}</p>}
    </>
  );

  if (noCard) return foodBody;
  return (
    <SectionCard
      title={isToday ? t('dashboard.log_food_title') : t('dashboard.add_food_title')}
      subtitle={isToday ? t('dashboard.log_food_subtitle') : t('dashboard.add_food_subtitle')}
      icon={<IconUtensils className="w-5 h-5" />}
    >
      {foodBody}
    </SectionCard>
  );
}

/* --- Activity Input (parse free text) --- */
function ActivityInput({ date, onSaved, isToday, noCard }: { date: string; onSaved: () => void; isToday: boolean; noCard?: boolean }) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  async function handleAdd() {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await dailyLogService.parseActivity(date, { freeText: text });
      if (!data.length) {
        setError(t('dashboard.activity_no_result'));
        return;
      }
      const items = data.map((p) => ({
        activityName: p.activityName,
        durationMinutes: p.durationMinutes,
        metValue: p.metValue,
      }));
      await dailyLogService.confirmParsedActivities(date, { items });
      setText("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      onSaved();
    } catch (err) {
      setError(extractApiError(err, t('dashboard.activity_error')));
    } finally {
      setBusy(false);
    }
  }

  const activityBody = (
    <>
      <div className="flex gap-2 items-center">
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => { setText(e.target.value); autoResize(e.target); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAdd(); } }}
          placeholder={t('dashboard.activity_placeholder')}
          aria-label={t('dashboard.activity_aria')}
          className="flex-1 min-w-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-colors resize-none overflow-hidden leading-normal"
        />
        <button
          onClick={handleAdd}
          disabled={busy || !text.trim()}
          className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          {busy ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          )}
        </button>
      </div>
      {error && <p className="mt-1.5 text-sm text-red-600" role="alert">{error}</p>}
    </>
  );

  if (noCard) return activityBody;
  return (
    <SectionCard title={isToday ? t('dashboard.log_activity_title') : t('dashboard.add_activity_title')} subtitle={isToday ? t('dashboard.log_activity_subtitle') : t('dashboard.add_activity_subtitle')}>
      {activityBody}
    </SectionCard>
  );
}

/* --- Nutrition Summary Chips --- */
/* --- Activity Summary Chips --- */
/* --- Activity Coverage Summary --- */
function ActivityMobileCard({
  a,
  onEdit,
  onDelete,
  busy,
  onToggleFavorite,
  favState,
  isFavorite,
  hasCalorieEstimate = true,
}: {
  a: ActivityEntryResponse;
  onEdit: () => void;
  onDelete: () => void;
  busy: boolean;
  onToggleFavorite: () => void;
  favState: 'idle' | 'saving' | 'saved' | 'error';
  isFavorite: boolean;
  hasCalorieEstimate?: boolean;
}) {
  const { t } = useTranslation();
  const { energyUnit } = useUnits();
  const isFav = isFavorite || favState === 'saved';
  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 dark:text-gray-100 text-sm leading-snug">{a.activityName}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {a.durationMinutes != null ? (a.durationMinutes >= 60 ? `${+(a.durationMinutes / 60).toFixed(1)}h` : `${fmt(a.durationMinutes)} min`) : "\u2013"}
          </p>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <button onClick={favState !== 'saving' ? onToggleFavorite : undefined} disabled={favState === 'saving'} title={isFav ? t('dashboard.remove_from_favorites') : t('dashboard.save_as_favorite')} aria-label={isFav ? t('dashboard.remove_from_favorites') : t('dashboard.save_as_favorite')} className={`rounded-md p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 ${isFav ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : favState === 'error' ? 'text-red-500 disabled:opacity-50' : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50'}`}>{favState === 'saving' ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : <IconStar className="w-4 h-4" filled={isFav} />}</button>
          <button onClick={onEdit} title={t('common.edit')} aria-label={t('dashboard.edit_aria', { name: a.activityName })} className="rounded-md p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"><IconEdit className="w-4 h-4" /></button>
          <button onClick={onDelete} disabled={busy} title={t('common.delete')} aria-label={t('dashboard.delete_aria', { name: a.activityName })} className="rounded-md p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"><IconTrash className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-50 dark:border-gray-800">
        <MobileStat label={a.calculatedCaloriesKcal < 0 ? t('dashboard.activity_below_resting') : t('dashboard.activity_burned')} value={hasCalorieEstimate ? formatEnergy(a.calculatedCaloriesKcal, energyUnit) : '\u2013'} accent />
        <MobileStat label={t('dashboard.activity_duration')} value={a.durationMinutes != null ? (a.durationMinutes >= 60 ? `${+(a.durationMinutes / 60).toFixed(1)}h` : `${fmt(a.durationMinutes)} min`) : "\u2013"} />
      </div>
    </div>
  );
}

/* --- Meal Mobile Card (single food entry) --- */
function MealMobileCard({
  f,
  onEdit,
  onDelete,
  busy,
  isQtyEditing,
  qtyEditValue,
  qtyBusy,
  onQtyEditStart,
  onQtyEditChange,
  onQtyEditConfirm,
  onQtyEditCancel,
  onToggleFavorite,
  favState,
  isFavorite,
}: {
  f: FoodEntryResponse;
  onEdit: () => void;
  onDelete: () => void;
  busy: boolean;
  isQtyEditing: boolean;
  qtyEditValue: string;
  qtyBusy: boolean;
  onQtyEditStart: () => void;
  onQtyEditChange: (v: string) => void;
  onQtyEditConfirm: () => void;
  onQtyEditCancel: () => void;
  onToggleFavorite: () => void;
  favState: 'idle' | 'saving' | 'saved' | 'error';
  isFavorite: boolean;
}) {
  const { t } = useTranslation();
  const { energyUnit } = useUnits();
  const isFav = isFavorite || favState === 'saved';
  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      {/* Header: name + actions */}
      <div className="flex items-start justify-between gap-2 px-3 pt-2 pb-0.5">
        <p className="font-medium text-gray-900 dark:text-gray-100 text-sm leading-snug">{f.foodName}</p>
        <div className="flex gap-0.5 shrink-0 -mt-0.5">
          <button
            onClick={favState !== 'saving' ? onToggleFavorite : undefined}
            disabled={favState === 'saving'}
            title={isFav ? t('dashboard.remove_from_favorites') : t('dashboard.save_as_favorite')}
            aria-label={isFav ? t('dashboard.remove_from_favorites') : t('dashboard.save_as_favorite')}
            className={`rounded-md p-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 ${isFav ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : favState === 'error' ? 'text-red-500 disabled:opacity-50' : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50'}`}
          >
            {favState === 'saving' ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : <IconStar className="w-4 h-4" filled={isFav} />}
          </button>
          <button
            onClick={onEdit}
            title={t('common.edit')}
            aria-label={t('dashboard.edit_aria', { name: f.foodName })}
            className="rounded-md p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
          >
            <IconEdit className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            disabled={busy}
            title={t('common.delete')}
            aria-label={t('dashboard.delete_aria', { name: f.foodName })}
            className="rounded-md p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
          >
            <IconTrash className="w-4 h-4" />
          </button>
        </div>
      </div>
      {/* Qty row · tappable chip */}
      <div className="px-3 pb-1.5">
        {isQtyEditing ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*[.,]?[0-9]*"
              autoFocus
              value={qtyEditValue}
              onChange={(e) => onQtyEditChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onQtyEditConfirm();
                if (e.key === "Escape") onQtyEditCancel();
              }}
              disabled={qtyBusy}
              className="w-16 rounded-md border border-indigo-300 dark:border-indigo-700 px-2 py-1 text-sm font-semibold text-center bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              aria-label="Quantity"
            />
            <button
              onClick={onQtyEditConfirm}
              disabled={qtyBusy}
              title={t('dashboard.qty_save')}
              aria-label={t('dashboard.qty_save')}
              className="rounded-full p-1 bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {qtyBusy ? (
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              ) : (
                <IconCheck className="w-3 h-3" />
              )}
            </button>
            <button
              onClick={onQtyEditCancel}
              title={t('common.cancel')}
              aria-label={t('dashboard.qty_cancel')}
              className="rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <IconX className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={onQtyEditStart}
              title={t('dashboard.meal_header_qty_tooltip')}
              aria-label={`${t('dashboard.meal_header_qty')}: ${f.quantity != null ? fmt(f.quantity, 1) : "not set"}. ${t('common.click_to_edit')}`}
              className="inline-flex items-center gap-1 group/qty rounded-md border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 text-left hover:border-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
            >
              <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 group-hover/qty:text-indigo-900 dark:group-hover/qty:text-indigo-100 tabular-nums transition-colors leading-snug">
                {f.quantity != null ? fmt(f.quantity, 1) : "\u2013"}
              </span>
              <IconEdit className="w-2.5 h-2.5 text-indigo-300 group-hover/qty:text-indigo-500 transition-colors" />
            </button>
            {f.portionDescription && (
              <>
                <span aria-hidden="true" className="text-gray-300 dark:text-gray-600 select-none text-xs">·</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{f.portionDescription}</span>
              </>
            )}
          </div>
        )}
      </div>
      {/* Macros grid */}
      <div className="grid grid-cols-4 border-t border-gray-100 dark:border-gray-800">
        <div className="text-center py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">{energyLabel(energyUnit)}</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{Math.round(kcalToDisplay(f.caloriesKcal, energyUnit)).toLocaleString()}</p>
        </div>
        <div className="text-center py-1.5 border-l border-gray-100 dark:border-gray-800">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">{t('dashboard.meal_macros_prot')}</p>
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">{fmt(f.proteinGrams, 1)}</p>
        </div>
        <div className="text-center py-1.5 border-l border-gray-100 dark:border-gray-800">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">{t('dashboard.meal_macros_fat')}</p>
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">{fmt(f.fatGrams, 1)}</p>
        </div>
        <div className="text-center py-1.5 border-l border-gray-100 dark:border-gray-800">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">{t('dashboard.meal_macros_carbs')}</p>
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">{fmt(f.carbsGrams, 1)}</p>
        </div>
      </div>
    </div>
  );
}

function MobileStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</p>
      <p className={`text-sm font-semibold ${accent ? "text-gray-900 dark:text-gray-100" : "text-gray-600 dark:text-gray-300"}`}>{value}</p>
    </div>
  );
}

/* --- Meals Table --- */
function MealsTable({ date, foods, onChanged, isToday: _isToday, noCard, onToast }: { date: string; foods: FoodEntryResponse[]; onChanged: () => void; isToday: boolean; noCard?: boolean; onToast: (msg: string, type: 'success' | 'error') => void }) {
  const { t } = useTranslation();
  const { energyUnit } = useUnits();
  const queryClient = useQueryClient();
  const { data: foodTemplates = [] } = useQuery({
    queryKey: queryKeys.foodTemplates(),
    queryFn: () => foodTemplateService.getAll().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<UpdateFoodEntryRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [qtyEditId, setQtyEditId] = useState<number | null>(null);
  const [qtyEditValue, setQtyEditValue] = useState<string>("");
  const [qtyBusy, setQtyBusy] = useState(false);
  const [favStates, setFavStates] = useState<Record<number, 'idle' | 'saving' | 'saved' | 'error'>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  async function saveFoodTemplate(f: FoodEntryResponse) {
    setFavStates(s => ({ ...s, [f.foodEntryId]: 'saving' }));
    try {
      await foodTemplateService.create({
        templateName: f.foodName,
        portionDescription: f.portionDescription ?? '',
        defaultQuantity: f.quantity ?? 1,
        caloriesKcal: f.caloriesKcal,
        proteinGrams: f.proteinGrams,
        fatGrams: f.fatGrams,
        carbsGrams: f.carbsGrams,
        alcoholGrams: f.alcoholGrams,
        autoAddToNewDay: false,
      });
      setFavStates(s => ({ ...s, [f.foodEntryId]: 'saved' }));
      queryClient.invalidateQueries({ queryKey: queryKeys.foodTemplates() });
      onToast(t('dashboard.toast_food_template_saved', { name: f.foodName }), 'success');
      setTimeout(() => setFavStates(s => ({ ...s, [f.foodEntryId]: 'idle' })), 2000);
    } catch {
      setFavStates(s => ({ ...s, [f.foodEntryId]: 'error' }));
      onToast(t('dashboard.toast_food_template_error'), 'error');
      setTimeout(() => setFavStates(s => ({ ...s, [f.foodEntryId]: 'idle' })), 2000);
    }
  }

  async function removeFoodTemplate(f: FoodEntryResponse) {
    const d = (a: number, b: number) => Math.abs(a - b) < 0.5;
    const matchingTemplate = foodTemplates.find(t =>
      t.isActive &&
      t.templateName.toLowerCase() === f.foodName.toLowerCase() &&
      d(f.caloriesKcal, t.caloriesKcal) &&
      d(f.proteinGrams, t.proteinGrams) &&
      d(f.fatGrams, t.fatGrams) &&
      d(f.carbsGrams, t.carbsGrams) &&
      d(f.alcoholGrams, t.alcoholGrams)
    );
    const tmpl = matchingTemplate ?? foodTemplates.find(t => t.isActive && t.templateName.toLowerCase() === f.foodName.toLowerCase());
    if (!tmpl) return;
    setFavStates(s => ({ ...s, [f.foodEntryId]: 'saving' }));
    try {
      await foodTemplateService.remove(tmpl.foodTemplateId);
      setFavStates(s => ({ ...s, [f.foodEntryId]: 'idle' }));
      queryClient.invalidateQueries({ queryKey: queryKeys.foodTemplates() });
    } catch {
      setFavStates(s => ({ ...s, [f.foodEntryId]: 'error' }));
      setTimeout(() => setFavStates(s => ({ ...s, [f.foodEntryId]: 'idle' })), 2000);
    }
  }

  function foodEditMatchesTemplate(form: UpdateFoodEntryRequest): boolean {
    const tmpl = foodTemplates.find(t => t.isActive && t.templateName.toLowerCase() === form.foodName.toLowerCase());
    if (!tmpl) return false;
    const d = (a: number, b: number) => Math.abs(a - b) < 0.5;
    return d(form.caloriesKcal, tmpl.caloriesKcal) &&
      d(form.proteinGrams, tmpl.proteinGrams) &&
      d(form.fatGrams, tmpl.fatGrams) &&
      d(form.carbsGrams, tmpl.carbsGrams) &&
      d(form.alcoholGrams, tmpl.alcoholGrams);
  }

  function foodEntryMatchesTemplate(f: FoodEntryResponse): boolean {
    const d = (a: number, b: number) => Math.abs(a - b) < 0.5;
    return foodTemplates.some(t =>
      t.isActive &&
      t.templateName.toLowerCase() === f.foodName.toLowerCase() &&
      d(f.caloriesKcal, t.caloriesKcal) &&
      d(f.proteinGrams, t.proteinGrams) &&
      d(f.fatGrams, t.fatGrams) &&
      d(f.carbsGrams, t.carbsGrams) &&
      d(f.alcoholGrams, t.alcoholGrams)
    );
  }

  function startEdit(f: FoodEntryResponse) {
    setQtyEditId(null);
    setQtyEditValue("");
    setEditId(f.foodEntryId);
    setEditForm({
      foodName: f.foodName,
      portionDescription: f.portionDescription,
      quantity: f.quantity,
      caloriesKcal: f.caloriesKcal,
      proteinGrams: f.proteinGrams,
      fatGrams: f.fatGrams,
      carbsGrams: f.carbsGrams,
      alcoholGrams: f.alcoholGrams,
      notes: f.notes,
      scaleByQuantity: false,
    });
  }

  async function saveQtyEdit(f: FoodEntryResponse) {
    const parsed = qtyEditValue !== "" ? parseFloat(qtyEditValue.replace(",", ".")) : null;
    const newQty = parsed !== null && !isNaN(parsed) && parsed > 0 ? parsed : null;
    if (newQty === f.quantity) {
      setQtyEditId(null);
      setQtyEditValue("");
      return;
    }
    setQtyBusy(true);
    try {
      await foodService.update(date, f.foodEntryId, {
        foodName: f.foodName,
        portionDescription: f.portionDescription,
        quantity: newQty,
        caloriesKcal: f.caloriesKcal,
        proteinGrams: f.proteinGrams,
        fatGrams: f.fatGrams,
        carbsGrams: f.carbsGrams,
        alcoholGrams: f.alcoholGrams,
        notes: f.notes,
        scaleByQuantity: true,
      });
      setQtyEditId(null);
      setQtyEditValue("");
      onChanged();
    } catch { /* ignore */ }
    setQtyBusy(false);
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
    setDeleteConfirmId(null);
    setBusy(true);
    try {
      await foodService.remove(date, id);
      onChanged();
    } catch { /* ignore */ }
    setBusy(false);
  }

  const mealsContent = foods.length === 0 ? (
    noCard
      ? <p className="text-sm text-gray-400 dark:text-gray-500 py-1">{t('dashboard.meals_empty_short')}</p>
      : (
        <div className="flex flex-col items-center justify-center py-4 sm:py-8 text-center">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('dashboard.meals_empty_title')}</p>
          <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">{t('dashboard.meals_empty_hint')}</p>
          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500 italic">{t('dashboard.meals_empty_example')}</p>
        </div>
      )
  ) : (
    <>
          {/* -- Desktop table (hidden on small screens) -- */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800">
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
                <tr className="bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 sticky top-0 z-10">
                  <th className="py-1.5 px-3 text-left">{t('dashboard.meal_header_food')}</th>
                  <th className="py-1.5 px-2 text-right" title={t('dashboard.meal_header_qty_tooltip')}>{t('dashboard.meal_header_qty')}</th>
                  <th className="py-1.5 px-2 text-left text-gray-400 font-medium">{t('dashboard.meal_header_portion')}</th>
                  <th className="py-1.5 px-2 text-right" title={t('dashboard.meal_header_kcal_tooltip')}>{energyLabel(energyUnit)}</th>
                  <th className="py-1.5 px-2 text-right" title={t('dashboard.meal_header_prot_tooltip')}>{t('dashboard.meal_macros_prot')}</th>
                  <th className="py-1.5 px-2 text-right font-medium text-gray-400" title={t('dashboard.meal_header_fat_tooltip')}>{t('dashboard.meal_macros_fat')}</th>
                  <th className="py-1.5 px-2 text-right font-medium text-gray-400" title={t('dashboard.meal_header_carbs_tooltip')}>{t('dashboard.meal_macros_carbs')}</th>
                  <th className="py-1.5 px-2 text-right font-medium text-gray-400" title={t('dashboard.meal_header_alc_tooltip')}>{t('dashboard.meal_macros_alc')}</th>
                  <th className="py-1.5 px-2 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {foods.map((f, idx) => (
                    <tr
                      key={f.foodEntryId}
                      className={`group transition-colors hover:bg-indigo-50/30 ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}
                    >
                      <td className="py-1.5 px-3 font-medium text-gray-900 max-w-[200px]">
                        <span className="line-clamp-2">{f.foodName}</span>
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        {qtyEditId === f.foodEntryId ? (
                          <div className="flex items-center gap-0.5 justify-end">
                            <input
                              type="text"
                              inputMode="decimal"
                              pattern="[0-9]*[.,]?[0-9]*"
                              autoFocus
                              value={qtyEditValue}
                              onChange={(e) => setQtyEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveQtyEdit(f);
                                if (e.key === "Escape") { setQtyEditId(null); setQtyEditValue(""); }
                              }}
                              disabled={qtyBusy}
                              className="w-14 rounded border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-1 py-0.5 text-right text-sm tabular-nums focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                              aria-label="Quantity"
                            />
                            <button onClick={() => saveQtyEdit(f)} disabled={qtyBusy} title="Save quantity" aria-label="Save quantity" className="rounded p-0.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 disabled:opacity-50 transition-colors">
                              <IconCheck className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => { setQtyEditId(null); setQtyEditValue(""); }} title={t('common.cancel')} aria-label={t('dashboard.qty_cancel')} className="rounded p-0.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                              <IconX className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditId(null); setEditForm(null); setQtyEditId(f.foodEntryId); setQtyEditValue(f.quantity != null ? String(f.quantity) : ""); }}
                            title="Click to change quantity · scales all macros"
                            aria-label={`Quantity: ${f.quantity != null ? fmt(f.quantity, 1) : "not set"}. Click to edit.`}
                            className="group/qty tabular-nums text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                          >
                            <span className="group-hover/qty:underline group-hover/qty:underline-offset-2">
                              {f.quantity != null ? fmt(f.quantity, 1) : "\u2013"}
                            </span>
                          </button>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-gray-400 text-xs truncate max-w-[100px]">{f.portionDescription ?? "\u2013"}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums font-semibold text-gray-900">{Math.round(kcalToDisplay(f.caloriesKcal, energyUnit)).toLocaleString()}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums font-medium text-gray-700" title={t('dashboard.meal_header_prot_tooltip')}>{fmt(f.proteinGrams, 1)}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-gray-400">{fmt(f.fatGrams, 1)}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-gray-400">{fmt(f.carbsGrams, 1)}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-gray-400">{fmt(f.alcoholGrams, 1)}</td>
                      <td className="py-1.5 px-2">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => { const isMatch = foodEntryMatchesTemplate(f); const state = favStates[f.foodEntryId] ?? 'idle'; if (isMatch && state === 'idle') removeFoodTemplate(f); else if (!isMatch && !['saving','saved'].includes(state)) saveFoodTemplate(f); }}
                            disabled={favStates[f.foodEntryId] === 'saving'}
                            title={(foodEntryMatchesTemplate(f) || favStates[f.foodEntryId] === 'saved') ? t('dashboard.remove_from_favorites') : t('dashboard.save_as_favorite')}
                            aria-label={(foodEntryMatchesTemplate(f) || favStates[f.foodEntryId] === 'saved') ? t('dashboard.remove_from_favorites') : t('dashboard.save_as_favorite')}
                            className={`rounded-md p-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 ${(foodEntryMatchesTemplate(f) || favStates[f.foodEntryId] === 'saved') ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : favStates[f.foodEntryId] === 'error' ? 'text-red-500 disabled:opacity-50' : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50'}`}
                          >
                            {favStates[f.foodEntryId] === 'saving' ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : <IconStar className="w-4 h-4" filled={foodEntryMatchesTemplate(f) || favStates[f.foodEntryId] === 'saved'} />}
                          </button>
                          <button
                            onClick={() => startEdit(f)}
                            title={t('common.edit')}
                            aria-label={t('dashboard.edit_aria', { name: f.foodName })}
                            className="rounded-md p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
                          >
                            <IconEdit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(f.foodEntryId)}
                            disabled={busy}
                            title={t('common.delete')}
                            aria-label={t('dashboard.delete_aria', { name: f.foodName })}
                            className="rounded-md p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
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

          <p className="hidden md:block mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">{t('dashboard.meal_footer_note', { energyUnit: energyLabel(energyUnit) })}</p>

          {/* -- Mobile stacked cards (visible on small screens) -- */}
          <div className="md:hidden space-y-2">
            {foods.map((f) => (
                <MealMobileCard
                  key={f.foodEntryId}
                  f={f}
                  onEdit={() => startEdit(f)}
                  onDelete={() => setDeleteConfirmId(f.foodEntryId)}
                  busy={busy}
                  onToggleFavorite={() => {
                    const isMatch = foodEntryMatchesTemplate(f);
                    const state = favStates[f.foodEntryId] ?? 'idle';
                    if (isMatch && state === 'idle') removeFoodTemplate(f);
                    else if (!isMatch && !['saving', 'saved'].includes(state)) saveFoodTemplate(f);
                  }}
                  favState={favStates[f.foodEntryId] ?? 'idle'}
                  isFavorite={foodEntryMatchesTemplate(f)}
                  isQtyEditing={qtyEditId === f.foodEntryId}
                  qtyEditValue={qtyEditValue}
                  qtyBusy={qtyBusy}
                  onQtyEditStart={() => { setEditId(null); setEditForm(null); setQtyEditId(f.foodEntryId); setQtyEditValue(f.quantity != null ? String(f.quantity) : ""); }}
                  onQtyEditChange={setQtyEditValue}
                  onQtyEditConfirm={() => saveQtyEdit(f)}
                  onQtyEditCancel={() => { setQtyEditId(null); setQtyEditValue(""); }}
                />
            ))}
          </div>
        </>
      );

  const foodEditModal = editId !== null && editForm !== null ? (
    <ModalShell onClose={() => { setEditId(null); setEditForm(null); }}>
        <h3 className="text-sm font-semibold text-fg-primary">{t('common.edit')}</h3>
        <div>
          <label className="text-xs font-medium text-fg-secondary mb-1 block">Food name</label>
          <input value={editForm.foodName} onChange={(e) => setEditForm({ ...editForm, foodName: e.target.value })} className="w-full rounded-md border border-input-border bg-input-bg text-fg-primary px-2.5 py-1.5 text-sm focus:border-accent-soft focus:ring-1 focus:ring-accent-soft focus:outline-none" aria-label="Food name" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-fg-secondary mb-1 block">Portion</label>
            <input value={editForm.portionDescription ?? ""} onChange={(e) => setEditForm({ ...editForm, portionDescription: e.target.value })} className="w-full rounded-md border border-input-border bg-input-bg text-fg-primary px-2.5 py-1.5 text-sm focus:border-accent-soft focus:ring-1 focus:ring-accent-soft focus:outline-none" aria-label="Portion description" />
          </div>
          <div>
            <label className="text-xs font-medium text-fg-secondary mb-1 block">{energyLabel(energyUnit)}</label>
            <DecimalInput value={Math.round(kcalToDisplay(editForm.caloriesKcal, energyUnit)) as number} onChange={(n) => setEditForm({ ...editForm, caloriesKcal: displayToKcal(typeof n === 'number' ? n : 0, energyUnit) })} className="w-full rounded-md border border-input-border bg-input-bg text-fg-primary px-2.5 py-1.5 text-sm text-right focus:border-accent-soft focus:ring-1 focus:ring-accent-soft focus:outline-none" aria-label="Calories" />
          </div>
          <div>
            <label className="text-xs font-medium text-fg-secondary mb-1 block">Prot</label>
            <DecimalInput value={editForm.proteinGrams} onChange={(n) => setEditForm({ ...editForm, proteinGrams: typeof n === 'number' ? n : 0 })} className="w-full rounded-md border border-input-border bg-input-bg text-fg-primary px-2.5 py-1.5 text-sm text-right focus:border-accent-soft focus:ring-1 focus:ring-accent-soft focus:outline-none" aria-label="Protein" />
          </div>
          <div>
            <label className="text-xs font-medium text-fg-secondary mb-1 block">Fat</label>
            <DecimalInput value={editForm.fatGrams} onChange={(n) => setEditForm({ ...editForm, fatGrams: typeof n === 'number' ? n : 0 })} className="w-full rounded-md border border-input-border bg-input-bg text-fg-primary px-2.5 py-1.5 text-sm text-right focus:border-accent-soft focus:ring-1 focus:ring-accent-soft focus:outline-none" aria-label="Fat" />
          </div>
          <div>
            <label className="text-xs font-medium text-fg-secondary mb-1 block">Carbs</label>
            <DecimalInput value={editForm.carbsGrams} onChange={(n) => setEditForm({ ...editForm, carbsGrams: typeof n === 'number' ? n : 0 })} className="w-full rounded-md border border-input-border bg-input-bg text-fg-primary px-2.5 py-1.5 text-sm text-right focus:border-accent-soft focus:ring-1 focus:ring-accent-soft focus:outline-none" aria-label="Carbs" />
          </div>
          <div>
            <label className="text-xs font-medium text-fg-secondary mb-1 block">Alc</label>
            <DecimalInput value={editForm.alcoholGrams} onChange={(n) => setEditForm({ ...editForm, alcoholGrams: typeof n === 'number' ? n : 0 })} className="w-full rounded-md border border-input-border bg-input-bg text-fg-primary px-2.5 py-1.5 text-sm text-right focus:border-accent-soft focus:ring-1 focus:ring-accent-soft focus:outline-none" aria-label="Alcohol" />
          </div>
        </div>
        <div className="flex items-center justify-between pt-2">
          <span title={foodEditMatchesTemplate(editForm) ? t('dashboard.template_matches') : t('dashboard.template_differs')} className={`p-1 pointer-events-none ${foodEditMatchesTemplate(editForm) ? 'text-amber-400' : 'text-fg-subtle'}`}><IconStar className="w-4 h-4" filled={foodEditMatchesTemplate(editForm)} /></span>
          <div className="flex gap-2">
            <button onClick={() => { setEditId(null); setEditForm(null); }} className="rounded-xl py-2.5 px-4 text-sm text-fg-secondary hover:bg-surface-subtle transition-colors">{t('common.cancel')}</button>
            <button onClick={saveEdit} disabled={busy} className="rounded-xl bg-indigo-600 py-2.5 px-4 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors">{t('common.save')}</button>
          </div>
        </div>
    </ModalShell>
  ) : null;

  if (noCard) return <><div>{mealsContent}</div><DeleteConfirmDialog open={deleteConfirmId !== null} message={t('dashboard.delete_food_confirm')} onConfirm={() => { if (deleteConfirmId !== null) void handleDelete(deleteConfirmId); }} onClose={() => setDeleteConfirmId(null)} isPending={busy} />{foodEditModal}</>;
  return (
    <SectionCard
      title={t('dashboard.meals_title')}
      icon={
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12h20" /><path d="M20 12c0-4.4-3.6-8-8-8s-8 3.6-8 8" /><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
        </svg>
      }
    >
      {mealsContent}
      <DeleteConfirmDialog open={deleteConfirmId !== null} message={t('dashboard.delete_food_confirm')} onConfirm={() => { if (deleteConfirmId !== null) void handleDelete(deleteConfirmId); }} onClose={() => setDeleteConfirmId(null)} isPending={busy} />
      {foodEditModal}
    </SectionCard>
  );
}

/* --- Activity Section --- */
function ActivitySection({ date, activities, onChanged, isToday: _isToday, noCard, onToast, hasCalorieEstimate = true }: { date: string; activities: ActivityEntryResponse[]; onChanged: () => void; isToday: boolean; noCard?: boolean; onToast: (msg: string, type: 'success' | 'error') => void; hasCalorieEstimate?: boolean }) {
  const { t } = useTranslation();
  const { energyUnit } = useUnits();
  const queryClientInstance = useQueryClient();
  const { data: templates = [] } = useQuery({
    queryKey: queryKeys.activityTemplates(),
    queryFn: () => activityService.getTemplates().then(r => r.data),
    staleTime: 10 * 60 * 1000,
  });
  const [addError, setAddError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addingFromTemplate, setAddingFromTemplate] = useState(false);
  const [showActivityPicker, setShowActivityPicker] = useState(false);
  const [alwaysShowAdvanced] = useState(() => {
    try { return localStorage.getItem("articalorias:showAdvancedActivity") === "true"; } catch { return false; }
  });
  const [editDurationUnit, setEditDurationUnit] = useState<"minutes" | "hours">("minutes");
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<UpdateActivityEntryRequest | null>(null);
  const [showEditAdvanced, setShowEditAdvanced] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [favStates, setFavStates] = useState<Record<number, 'idle' | 'saving' | 'saved' | 'error'>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  async function saveActivityTemplate(a: ActivityEntryResponse) {
    setFavStates(s => ({ ...s, [a.activityEntryId]: 'saving' }));
    try {
      await activityService.createTemplate({
        templateName: a.activityName,
        autoAddToNewDay: false,
        defaultDurationMinutes: a.durationMinutes,
        defaultMET: a.metValue,
      });
      setFavStates(s => ({ ...s, [a.activityEntryId]: 'saved' }));
      queryClientInstance.invalidateQueries({ queryKey: queryKeys.activityTemplates() });
      onToast(t('dashboard.toast_activity_template_saved', { name: a.activityName }), 'success');
      setTimeout(() => setFavStates(s => ({ ...s, [a.activityEntryId]: 'idle' })), 2000);
    } catch {
      setFavStates(s => ({ ...s, [a.activityEntryId]: 'error' }));
      onToast(t('dashboard.toast_activity_template_error'), 'error');
      setTimeout(() => setFavStates(s => ({ ...s, [a.activityEntryId]: 'idle' })), 2000);
    }
  }

  async function removeActivityTemplate(a: ActivityEntryResponse) {
    // Prefer the template whose values match the current entry (handles multiple same-name templates)
    const matchingTemplate = templates.find(t =>
      t.isActive &&
      t.templateName.toLowerCase() === a.activityName.toLowerCase() &&
      !(a.metValue != null && t.defaultMET != null && Math.abs(a.metValue - t.defaultMET) >= 0.1) &&
      !(a.durationMinutes != null && t.defaultDurationMinutes != null && Math.abs(a.durationMinutes - t.defaultDurationMinutes) >= 1)
    );
    const templateId = matchingTemplate?.activityTemplateId
      ?? templates.find(tmpl => tmpl.isActive && tmpl.templateName.toLowerCase() === a.activityName.toLowerCase())?.activityTemplateId
      ?? a.activityTemplateId;
    if (!templateId) return;
    setFavStates(s => ({ ...s, [a.activityEntryId]: 'saving' }));
    try {
      await activityService.removeTemplate(templateId);
      setFavStates(s => ({ ...s, [a.activityEntryId]: 'idle' }));
      queryClientInstance.invalidateQueries({ queryKey: queryKeys.activityTemplates() });
    } catch {
      setFavStates(s => ({ ...s, [a.activityEntryId]: 'error' }));
      setTimeout(() => setFavStates(s => ({ ...s, [a.activityEntryId]: 'idle' })), 2000);
    }
  }

  function activityEditMatchesTemplate(form: UpdateActivityEntryRequest): boolean {
    return templates.some(t =>
      t.isActive &&
      t.templateName.toLowerCase() === form.activityName.toLowerCase() &&
      !(form.durationMinutes != null && t.defaultDurationMinutes != null && Math.abs(form.durationMinutes - t.defaultDurationMinutes) >= 1) &&
      !(form.metValue != null && t.defaultMET != null && Math.abs(form.metValue - t.defaultMET) >= 0.1)
    );
  }

  function activityEntryMatchesTemplate(a: ActivityEntryResponse): boolean {
    return templates.some(t =>
      t.isActive &&
      t.templateName.toLowerCase() === a.activityName.toLowerCase() &&
      !(a.metValue != null && t.defaultMET != null && Math.abs(a.metValue - t.defaultMET) >= 0.1) &&
      !(a.durationMinutes != null && t.defaultDurationMinutes != null && Math.abs(a.durationMinutes - t.defaultDurationMinutes) >= 1)
    );
  }

  async function addFromTemplate(id: string) {
    const tpl = templates.find((tpl) => tpl.activityTemplateId === +id);
    if (!tpl) return;
    setBusy(true);
    setAddingFromTemplate(true);
    setAddError(null);
    try {
      await activityService.create(date, {
        activityTemplateId: tpl.activityTemplateId,
        activityName: tpl.templateName,
        durationMinutes: tpl.defaultDurationMinutes,
        metValue: tpl.defaultMET,
      });
      onChanged();
      onToast(t('dashboard.toast_activity_added', { name: tpl.templateName }), 'success');
    } catch (err) {
      setAddError(extractApiError(err, t('dashboard.activity_error')));
    }
    setBusy(false);
    setAddingFromTemplate(false);
  }

  function startEditActivity(a: ActivityEntryResponse) {
    setEditId(a.activityEntryId);
    setEditDurationUnit("minutes");
    setShowEditAdvanced(false);
    setEditError(null);
    setEditForm({
      activityName: a.activityName,
      durationMinutes: a.durationMinutes,
      metValue: a.metValue,
    });
  }

  async function saveEditActivity() {
    if (!editForm || editId === null) return;
    setBusy(true);
    setEditError(null);
    try {
      await activityService.update(date, editId, editForm);
      setEditId(null);
      setEditForm(null);
      onChanged();
    } catch (err) {
      setEditError(extractApiError(err, t('dashboard.activity_error')));
    }
    setBusy(false);
  }

  async function handleDelete(id: number) {
    setDeleteConfirmId(null);
    setBusy(true);
    try {
      await activityService.remove(date, id);
      onChanged();
    } catch { /* ignore */ }
    setBusy(false);
  }

  const userActivities = activities.filter(a =>
    a.activityName !== "Daily movement"
  );

  const activitiesContent = (
    <>
      {activities.length === 0 && (
        noCard
          ? <p className="text-sm text-gray-400 dark:text-gray-500 py-1">{t('dashboard.activities_empty_short')}</p>
          : (
            <div className="flex flex-col items-center justify-center py-4 sm:py-8 text-center">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('dashboard.activities_empty_title')}</p>
              <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">{t('dashboard.activities_empty_hint')}</p>
              <p className="mt-3 text-xs text-gray-400 dark:text-gray-500 italic">{t('dashboard.activities_empty_example')}</p>
            </div>
          )
      )}

      {activities.length > 0 && (
        <>
          <div className="space-y-5">
            <div>
              {userActivities.length === 0 ? null : (
                <>
                  {/* -- Desktop table (hidden on small screens) -- */}
                  <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800">
                    <table className="w-full text-sm">
                      <colgroup>
                        <col />
                        <col className="w-24" />
                        <col className="w-24" />
                        <col className="w-28" />
                      </colgroup>
                      <thead>
                        <tr className="bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 sticky top-0 z-10">
                          <th className="py-1.5 px-3 text-left">{t('dashboard.activity_header_name')}</th>
                          <th className="py-1.5 px-2 text-right">{t('dashboard.activity_header_dur')}</th>
                          <th className="py-1.5 px-2 text-right">{energyLabel(energyUnit)}</th>
                          <th className="py-1.5 px-2 text-right"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {userActivities.map((a, idx) => (
                            <tr
                              key={a.activityEntryId}
                              className={`group transition-colors hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 ${idx % 2 === 1 ? "bg-gray-50/40 dark:bg-gray-800/30" : ""}`}
                            >
                              <td className="py-1.5 px-3 font-medium text-gray-900 dark:text-gray-100 max-w-[200px]">
                                <span className="line-clamp-2">{a.activityName}</span>
                              </td>
                              <td className="py-1.5 px-2 text-right tabular-nums text-gray-700">{a.durationMinutes != null ? (a.durationMinutes >= 60 ? `${+(a.durationMinutes / 60).toFixed(1)}h` : `${fmt(a.durationMinutes)} min`) : "\u2013"}</td>
                              <td className={`py-1.5 px-2 text-right tabular-nums font-semibold ${hasCalorieEstimate && a.calculatedCaloriesKcal < 0 ? "text-blue-600" : "text-gray-900"}`} title={hasCalorieEstimate && a.calculatedCaloriesKcal < 0 ? "Below resting rate · burns less than your baseline" : undefined}>{hasCalorieEstimate ? Math.round(kcalToDisplay(a.calculatedCaloriesKcal, energyUnit)).toLocaleString() : "\u2013"}</td>
                              <td className="py-1.5 px-2">
                                <div className="flex gap-1 justify-end">
                                  <button onClick={() => { const isMatch = activityEntryMatchesTemplate(a); const state = favStates[a.activityEntryId] ?? 'idle'; if (isMatch && state === 'idle') removeActivityTemplate(a); else if (!isMatch && !['saving','saved'].includes(state)) saveActivityTemplate(a); }} disabled={favStates[a.activityEntryId] === 'saving'} title={(activityEntryMatchesTemplate(a) || favStates[a.activityEntryId] === 'saved') ? t('dashboard.remove_from_favorites') : t('dashboard.save_as_favorite')} aria-label={(activityEntryMatchesTemplate(a) || favStates[a.activityEntryId] === 'saved') ? t('dashboard.remove_from_favorites') : t('dashboard.save_as_favorite')} className={`rounded-md p-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 ${(activityEntryMatchesTemplate(a) || favStates[a.activityEntryId] === 'saved') ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : favStates[a.activityEntryId] === 'error' ? 'text-red-500 disabled:opacity-50' : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50'}`}>{favStates[a.activityEntryId] === 'saving' ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : <IconStar className="w-4 h-4" filled={activityEntryMatchesTemplate(a) || favStates[a.activityEntryId] === 'saved'} />}</button>
                                  <button onClick={() => startEditActivity(a)} title={t('common.edit')} aria-label={t('dashboard.edit_aria', { name: a.activityName })} className="rounded-md p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"><IconEdit className="w-4 h-4" /></button>
                                  <button onClick={() => setDeleteConfirmId(a.activityEntryId)} disabled={busy} title={t('common.delete')} aria-label={t('dashboard.delete_aria', { name: a.activityName })} className="rounded-md p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"><IconTrash className="w-4 h-4" /></button>
                                </div>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* -- Mobile stacked cards (visible on small screens) -- */}
                  <div className="md:hidden space-y-2">
                    {userActivities.map((a) => (
                        <ActivityMobileCard
                          key={a.activityEntryId}
                          a={a}
                          onEdit={() => startEditActivity(a)}
                          onDelete={() => setDeleteConfirmId(a.activityEntryId)}
                          busy={busy}
                          onToggleFavorite={() => {
                            const isMatch = activityEntryMatchesTemplate(a);
                            const state = favStates[a.activityEntryId] ?? 'idle';
                            if (isMatch && state === 'idle') removeActivityTemplate(a);
                            else if (!isMatch && !['saving', 'saved'].includes(state)) saveActivityTemplate(a);
                          }}
                          favState={favStates[a.activityEntryId] ?? 'idle'}
                          isFavorite={activityEntryMatchesTemplate(a)}
                          hasCalorieEstimate={hasCalorieEstimate}
                        />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      <div className="mt-3">
        <button
          onClick={() => setShowActivityPicker(true)}
          disabled={busy}
          className="rounded-md border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-indigo-700 dark:text-indigo-300 font-medium w-full hover:bg-indigo-50 dark:hover:bg-indigo-900/30 disabled:opacity-50 transition-colors text-left"
        >
          {addingFromTemplate ? t('common.adding') : t('dashboard.add_from_templates')}
        </button>
        {addError && <p className="mt-1 text-xs text-red-600" role="alert">{addError}</p>}
        <TemplatePickerDialog
          open={showActivityPicker}
          title={t('dashboard.add_from_templates')}
          items={templates.filter(t => t.isActive).map(t => ({
            id: t.activityTemplateId,
            label: t.templateName,
            meta: t.defaultDurationMinutes ? `${t.defaultDurationMinutes} min` : undefined,
          }))}
          onSelect={id => addFromTemplate(id.toString())}
          onClose={() => setShowActivityPicker(false)}
          busy={addingFromTemplate}
        />
      </div>
    </>
  );

  const activityEditModal = editId !== null && editForm !== null ? (
    <ModalShell onClose={() => { setEditId(null); setEditForm(null); setEditError(null); }}>
        <h3 className="text-sm font-semibold text-fg-primary">{userActivities.find(a => a.activityEntryId === editId)?.activityName}</h3>
        <div>
          <label className="text-xs font-medium text-fg-secondary mb-1 block">{t('dashboard.activity_header_dur')}</label>
          <div className="flex gap-2">
            <DecimalInput value={editForm.durationMinutes != null ? (editDurationUnit === "hours" ? parseFloat((editForm.durationMinutes / 60).toFixed(2)) : editForm.durationMinutes) : ""} onChange={(n) => { const v = typeof n === 'number' ? n : null; setEditForm({ ...editForm, durationMinutes: v != null ? (editDurationUnit === "hours" ? v * 60 : v) : null }); }} aria-label="Duration" className="w-full rounded-md border border-input-border bg-input-bg text-fg-primary px-2.5 py-1.5 text-sm focus:border-accent-soft focus:ring-1 focus:ring-accent-soft focus:outline-none" />
            <select value={editDurationUnit} onChange={(e) => setEditDurationUnit(e.target.value as "minutes" | "hours")} aria-label="Duration unit" className="rounded-md border border-input-border bg-input-bg text-fg-primary px-2.5 py-1.5 text-sm">
              <option value="minutes">min</option>
              <option value="hours">hr</option>
            </select>
          </div>
        </div>
        {editError && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{editError}</p>}
        {!alwaysShowAdvanced && (
          <button type="button" onClick={() => setShowEditAdvanced(v => !v)} aria-expanded={showEditAdvanced} className="flex items-center gap-1 text-xs text-fg-secondary hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors">
            <svg className={`h-3.5 w-3.5 transition-transform ${showEditAdvanced ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
            {t('dashboard.activity_advanced_options')}
          </button>
        )}
        {(alwaysShowAdvanced || showEditAdvanced) && (
          <div className="rounded-md border border-border bg-surface-muted px-3 py-2.5">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-fg-secondary whitespace-nowrap">MET</label>
              <DecimalInput value={editForm.metValue ?? ""} onChange={(n) => setEditForm({ ...editForm, metValue: typeof n === 'number' ? n : null })} placeholder="Auto" aria-label="MET value" className="w-20 rounded border border-input-border bg-input-bg text-fg-primary px-1.5 py-1 text-right text-sm placeholder:text-fg-subtle focus:border-accent-soft focus:ring-1 focus:ring-accent-soft focus:outline-none" />
              <p className="text-xs text-fg-subtle">{t('dashboard.activity_met_hint')}</p>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between pt-2">
          <span title={activityEditMatchesTemplate(editForm) ? t('dashboard.template_matches') : t('dashboard.template_differs')} className={`p-1 pointer-events-none ${activityEditMatchesTemplate(editForm) ? 'text-amber-400' : 'text-fg-subtle'}`}><IconStar className="w-4 h-4" filled={activityEditMatchesTemplate(editForm)} /></span>
          <div className="flex gap-2">
            <button onClick={() => { setEditId(null); setEditForm(null); setEditError(null); }} className="rounded-xl py-2.5 px-4 text-sm text-fg-secondary hover:bg-surface-subtle transition-colors">{t('common.cancel')}</button>
            <button onClick={saveEditActivity} disabled={busy} className="rounded-xl bg-indigo-600 py-2.5 px-4 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors">{t('common.save')}</button>
          </div>
        </div>
    </ModalShell>
  ) : null;

  if (noCard) return <><div>{activitiesContent}</div><DeleteConfirmDialog open={deleteConfirmId !== null} message={t('dashboard.delete_activity_confirm')} onConfirm={() => { if (deleteConfirmId !== null) void handleDelete(deleteConfirmId); }} onClose={() => setDeleteConfirmId(null)} isPending={busy} />{activityEditModal}</>;
  return (
    <SectionCard
      title={t('dashboard.activities_section')}
      subtitle={t('dashboard.activities_subtitle')}
      icon={
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      }
    >
      {activitiesContent}
      <DeleteConfirmDialog open={deleteConfirmId !== null} message={t('dashboard.delete_activity_confirm')} onConfirm={() => { if (deleteConfirmId !== null) void handleDelete(deleteConfirmId); }} onClose={() => setDeleteConfirmId(null)} isPending={busy} />
      {activityEditModal}
    </SectionCard>
  );
}


/* --- Daily Log Workspace --- */
function DailyLogWorkspace({
  date,
  dash,
  onChanged,
  isToday,
  activeTab,
  onTabChange,
  onToast,
}: {
  date: string;
  dash: DailyDashboardResponse | null;
  onChanged: () => void;
  isToday: boolean;
  activeTab: "meals" | "activities";
  onTabChange: (tab: "meals" | "activities") => void;
  onToast: (msg: string, type: 'success' | 'error') => void;
}) {
  const { t } = useTranslation();
  const tab = activeTab;
  const setTab = onTabChange;
  const foods = dash?.foodEntries ?? [];
  const activities = dash?.activityEntries ?? [];
  const hasCalorieEstimate = dash?.hasCalorieEstimate ?? true;
  const mealCount = foods.length;
  const activityCount = activities.length;

  const { data: foodTemplates = [] } = useQuery({
    queryKey: queryKeys.foodTemplates(),
    queryFn: () => foodTemplateService.getAll().then(r => r.data),
    staleTime: 10 * 60 * 1000,
  });
  const activeFoodTemplates = foodTemplates.filter(ft => ft.isActive);
  const [showFoodPicker, setShowFoodPicker] = useState(false);
  const [addingFromFoodTemplate, setAddingFromFoodTemplate] = useState(false);
  const [foodAddError, setFoodAddError] = useState<string | null>(null);

  async function addFromFoodTemplate(id: number) {
    const tpl = activeFoodTemplates.find(ft => ft.foodTemplateId === id);
    if (!tpl) return;
    setAddingFromFoodTemplate(true);
    setFoodAddError(null);
    try {
      await foodService.create(date, {
        foodName: tpl.templateName,
        portionDescription: tpl.portionDescription,
        quantity: tpl.defaultQuantity,
        caloriesKcal: tpl.caloriesKcal,
        proteinGrams: tpl.proteinGrams,
        fatGrams: tpl.fatGrams,
        carbsGrams: tpl.carbsGrams,
        alcoholGrams: tpl.alcoholGrams,
        foodTemplateId: tpl.foodTemplateId,
      });
      onChanged();
      onToast(t('dashboard.toast_food_added', { name: tpl.templateName }), 'success');
    } catch (err) {
      setFoodAddError(extractApiError(err, t('dashboard.confirm_food_error')));
    }
    setAddingFromFoodTemplate(false);
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      {/* Card header: title + tab switch */}
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/60 px-3 py-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('dashboard.daily_log_title')}</h2>
        <SegmentedTabs
          variant="icon"
          activeTab={tab}
          onChange={key => setTab(key as "meals" | "activities")}
          tabs={[
            {
              key: "meals",
              label: t('dashboard.tab_meals'),
              icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" /></svg>,
              count: mealCount,
            },
            {
              key: "activities",
              label: t('dashboard.tab_activities'),
              icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>,
              count: activityCount,
            },
          ]}
        />
      </div>

      {/* Tab content · both panels stay mounted to preserve typed input on tab switch */}
      <div className="p-3">
        <div className={`space-y-4${tab !== "meals" ? " hidden" : ""}`}>
          <FoodInput date={date} onSaved={onChanged} isToday={isToday} noCard />
          <MealsTable date={date} foods={foods} onChanged={onChanged} isToday={isToday} noCard onToast={onToast} />
          <div className="mt-1">
            <button
              onClick={() => setShowFoodPicker(true)}
              disabled={addingFromFoodTemplate}
              className="rounded-md border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-indigo-700 dark:text-indigo-300 font-medium w-full hover:bg-indigo-50 dark:hover:bg-indigo-900/30 disabled:opacity-50 transition-colors text-left"
            >
              {addingFromFoodTemplate ? t('common.adding') : t('dashboard.add_food_from_templates')}
            </button>
            {foodAddError && <p className="mt-1 text-xs text-red-600" role="alert">{foodAddError}</p>}
            <TemplatePickerDialog
              open={showFoodPicker}
              title={t('dashboard.add_food_from_templates')}
              items={activeFoodTemplates.map(ft => ({
                id: ft.foodTemplateId,
                label: ft.templateName,
                meta: `${ft.defaultQuantity}${ft.portionDescription ? ' ' + ft.portionDescription : ''} · ${Math.round(ft.caloriesKcal)} kcal`,
              }))}
              onSelect={addFromFoodTemplate}
              onClose={() => setShowFoodPicker(false)}
              busy={addingFromFoodTemplate}
            />
          </div>
        </div>
        <div className={`space-y-4${tab !== "activities" ? " hidden" : ""}`}>
          <ActivityInput date={date} onSaved={onChanged} isToday={isToday} noCard />
          <ActivitySection date={date} activities={activities} onChanged={onChanged} isToday={isToday} noCard onToast={onToast} hasCalorieEstimate={hasCalorieEstimate} />
        </div>
      </div>
    </div>
  );
}



