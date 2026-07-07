import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { dailyLogService } from "@/services/dailyLogService";
import { foodTemplateService } from "@/services/foodTemplateService";
import { activityService } from "@/services/activityService";
import BarcodeScannerOverlay from "@/components/BarcodeScannerOverlay";
import AiProcessingCard from "@/components/AiProcessingCard";
import { IconSpinner, IconX } from "@/components/icons";
import { extractApiError } from "@/utils/apiError";
import { compressImage } from "@/utils/compressImage";
import { toDateString } from "@/utils/format";
import type { ParsedFoodItem } from "@/types";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface LogComposerProps {
  /** ISO date string, e.g. "2026-07-07". Not required for favorite modes. */
  date?: string;
  /**
   * "meals" / "activities" — logs to the daily log for the given date.
   * "favorite-meals" / "favorite-activities" — creates templates in Favorites.
   */
  mode: "meals" | "activities" | "favorite-meals" | "favorite-activities";
  /** Called after entries are successfully confirmed. Parent should invalidate queries. */
  onSaved: () => void;
  isToday?: boolean;
  /** Whether the native BarcodeDetector API is available in this browser */
  // Note: barcode scanning is only available in "meals" mode (daily log). Ignored for other modes.
  barcodeSupported: boolean;
  /** Opens the template picker dialog — managed by the parent */
  onAddFromTemplates?: () => void;
  /**
   * On mobile the composer portals into the shared #composer-portal-slot.
   * Pass false for the inactive tab so only the active composer is visible in the dock.
   * Defaults to true. Has no effect on desktop (inline rendering is always gated by the
   * parent container's `hidden` class).
   */
  isActive?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum textarea height in px before internal scroll kicks in (~4 lines) */
const MAX_TEXTAREA_HEIGHT = 96;

// ─── Component ────────────────────────────────────────────────────────────────

export default function LogComposer({
  date = "",
  mode,
  onSaved,
  barcodeSupported,
  onAddFromTemplates,
  isActive = true,
}: LogComposerProps) {
  const { t } = useTranslation();

  // ── State ──
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<{ base64: string; mimeType: string } | null>(null);
  const [showOverflow, setShowOverflow] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // ── Mobile dock portal ──
  const [dockEl, setDockEl] = useState<HTMLElement | null>(null);
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia("(max-width: 767px)").matches
  );

  // ── Refs ──
  const composerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // ── Reset on tab switch ──
  useEffect(() => {
    setText("");
    clearImageState();
    setError(null);
    setShowOverflow(false);
    setShowScanner(false);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ResizeObserver: write --composer-height for scroll-container bottom padding ──
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        document.documentElement.style.setProperty(
          "--composer-height",
          `${Math.ceil(entry.contentRect.height)}px`,
        );
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Mobile dock: latch portal slot synchronously to avoid flash ──
  useLayoutEffect(() => {
    setDockEl(document.getElementById("composer-portal-slot"));
  }, []);

  // ── Track breakpoint so desktop renders inline ──
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ── Helpers ──

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
  }

  function clearImageState() {
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
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    try {
      const compressed = await compressImage(file);
      setImageData(compressed);
    } catch {
      setError(t("dailyLog.composer.error"));
      clearImageState();
    }
  }

  async function handleAdd() {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "meals") {
        let parsed: ParsedFoodItem[];
        if (imageData) {
          const { data } = await dailyLogService.parseFoodWithImage(date, {
            imageBase64: imageData.base64,
            mimeType: imageData.mimeType,
            freeText: text.trim() || null,
          });
          if (!data.length) {
            setError(t("dashboard.food_error_image"));
            return;
          }
          parsed = data;
        } else {
          const { data } = await dailyLogService.parseFood(date, { freeText: text });
          if (!data.length) {
            setError(t("dashboard.food_error_text"));
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
      } else if (mode === "activities") {
        const { data } = await dailyLogService.parseActivity(date, { freeText: text });
        if (!data.length) {
          setError(t("dashboard.activity_no_result"));
          return;
        }
        await dailyLogService.confirmParsedActivities(date, {
          items: data.map((p) => ({
            activityName: p.activityName,
            durationMinutes: p.durationMinutes,
            metValue: p.metValue,
          })),
        });
      } else if (mode === "favorite-meals") {
        let parsed: ParsedFoodItem[];
        if (imageData) {
          const { data } = await dailyLogService.parseFoodWithImage(toDateString(), {
            imageBase64: imageData.base64,
            mimeType: imageData.mimeType,
            freeText: text.trim() || null,
          });
          if (!data.length) {
            setError(t("dashboard.food_error_image"));
            return;
          }
          parsed = data;
        } else {
          const { data } = await foodTemplateService.parseFavoriteFood(text.trim());
          if (!data.items.length) {
            setError(t("favorites.ai_input.no_results"));
            return;
          }
          parsed = data.items
            .filter((item) => item.food != null)
            .map((item) => item.food as ParsedFoodItem);
        }
        await Promise.allSettled(
          parsed.map((p) =>
            foodTemplateService.create({
              templateName: p.foodName,
              portionDescription: p.portionDescription ?? "",
              defaultQuantity: p.quantity ?? 1,
              caloriesKcal: p.caloriesKcal,
              proteinGrams: p.proteinGrams,
              fatGrams: p.fatGrams,
              carbsGrams: p.carbsGrams,
              alcoholGrams: p.alcoholGrams,
              autoAddToNewDay: false,
            })
          )
        );
      } else {
        // favorite-activities
        const { data } = await foodTemplateService.parseFavoriteActivity(text.trim());
        if (!data.items.length) {
          setError(t("favorites.ai_input.no_results"));
          return;
        }
        await Promise.allSettled(
          data.items.map((item) =>
            item.activity
              ? activityService.createTemplate({
                  templateName: item.activity.activityName,
                  autoAddToNewDay: false,
                  defaultDurationMinutes: item.activity.durationMinutes,
                  defaultMET: item.activity.metValue,
                })
              : Promise.resolve()
          )
        );
      }
      // ── Success ──
      setText("");
      clearImageState();
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.overflowY = "hidden";
        textareaRef.current.focus();
      }
      onSaved();
    } catch (err) {
      setError(extractApiError(err, t("dailyLog.composer.error")));
    } finally {
      setBusy(false);
    }
  }

  async function handleBarcodeDetected(rawValue: string) {
    setShowScanner(false);
    setBusy(true);
    setError(null);
    try {
      const { data: parsed } = await dailyLogService.lookupBarcode(rawValue);
      if (!parsed.length) {
        setError(t("dashboard.barcode_not_found"));
        return;
      }
      if (mode === "favorite-meals") {
        await Promise.allSettled(
          parsed.map((p) =>
            foodTemplateService.create({
              templateName: p.foodName,
              portionDescription: p.portionDescription ?? "",
              defaultQuantity: p.quantity ?? 1,
              caloriesKcal: p.caloriesKcal,
              proteinGrams: p.proteinGrams,
              fatGrams: p.fatGrams,
              carbsGrams: p.carbsGrams,
              alcoholGrams: p.alcoholGrams,
              autoAddToNewDay: false,
            })
          )
        );
      } else {
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
      }
      onSaved();
    } catch (err: unknown) {
      const apiStatus = (err as { response?: { status?: number } })?.response?.status;
      if (apiStatus === 404) {
        setError(t("dashboard.barcode_not_found"));
      } else {
        setError(extractApiError(err, t("dashboard.barcode_error")));
      }
    } finally {
      setBusy(false);
    }
  }

  // ── Derived values ──
  const hasInput = text.trim().length > 0 || imageData !== null;
  const canSubmit = hasInput && !busy;

  const placeholder =
    imageData !== null
      ? t("dailyLog.composer.placeholderImage")
      : mode === "activities"
        ? t("dailyLog.composer.placeholderActivity")
        : mode === "favorite-activities"
          ? t("favorites.ai_input.placeholder_activities")
          : mode === "favorite-meals"
            ? t("favorites.ai_input.placeholder_foods")
            : t("dailyLog.composer.placeholder");

  // ── Render ──────────────────────────────────────────────────────────────────

  // Composer bar: portaled into #composer-portal-slot on mobile, inline on desktop
  const composerBar = (
    <div
      ref={composerRef}
      role="region"
      aria-label={
        mode === "meals" || mode === "favorite-meals"
          ? t("dashboard.log_food_title")
          : t("dashboard.log_activity_title")
      }
      className={
        isMobile && dockEl
          ? "px-3 py-2"
          : "border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2"
      }
    >
        {/* ── Main bar row: icons | textarea | send ── */}
        <div className="flex gap-2 items-end">

          {/* ── Left: action icons ── */}
          <div className="flex gap-1 items-center shrink-0 pb-0.5">

            {/* Camera (meals + favorite-meals) */}
            {(mode === "meals" || mode === "favorite-meals") && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                aria-label={t("dailyLog.composer.addPhoto")}
                className={`inline-flex items-center justify-center w-10 h-10 rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed ${
                  imageData
                    ? "border-indigo-300 bg-indigo-50 dark:bg-indigo-950 text-indigo-600"
                    : "border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
                }`}
              >
                {/* Camera icon */}
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </button>
            )}

            {/* Barcode (meals / favorite-meals + barcodeSupported only) */}
            {(mode === "meals" || mode === "favorite-meals") && barcodeSupported && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => { setError(null); setShowScanner(true); }}
                  disabled={busy}
                  aria-label={t("dailyLog.composer.scanBarcode")}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {/* Barcode / scanner icon */}
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 9V5a2 2 0 0 1 2-2h4" />
                    <path d="M15 3h4a2 2 0 0 1 2 2v4" />
                    <path d="M21 15v4a2 2 0 0 1-2 2h-4" />
                    <path d="M9 21H5a2 2 0 0 1-2-2v-4" />
                    <line x1="7"    y1="9.5"  x2="7"    y2="14.5" />
                    <line x1="9.5"  y1="9.5"  x2="9.5"  y2="14.5" strokeWidth="1.5" />
                    <line x1="12"   y1="9.5"  x2="12"   y2="14.5" />
                    <line x1="14.5" y1="9.5"  x2="14.5" y2="14.5" strokeWidth="1.5" />
                    <line x1="17"   y1="9.5"  x2="17"   y2="14.5" />
                  </svg>
                </button>
                {/* BETA badge */}
                <span
                  aria-hidden="true"
                  className="absolute -top-1.5 -right-2 px-1 py-px rounded-full text-[8px] font-bold leading-tight tracking-wide bg-amber-400 text-amber-900 pointer-events-none select-none"
                >
                  BETA
                </span>
              </div>
            )}

            {/* More actions overflow trigger — hidden only for favorite-activities (no applicable items) */}
            {mode !== "favorite-activities" && <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowOverflow((v) => !v)}
                disabled={busy}
                aria-label={t("dailyLog.composer.moreActions")}
                aria-haspopup="menu"
                aria-expanded={showOverflow}
                className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {/* Three-dot icon */}
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <circle cx="4"  cy="10" r="1.5" />
                  <circle cx="10" cy="10" r="1.5" />
                  <circle cx="16" cy="10" r="1.5" />
                </svg>
              </button>

              {/* Overflow panel */}
              {showOverflow && (
                <div
                  role="menu"
                  className="absolute bottom-full mb-2 left-0 z-39 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1 min-w-52.5"
                >
                  {mode === "meals" ? (
                    <>
                      <button
                        role="menuitem"
                        type="button"
                        onClick={() => { setShowOverflow(false); galleryInputRef.current?.click(); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2.5 transition-colors"
                      >
                        {/* Photo/gallery icon */}
                        <svg className="w-4 h-4 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </svg>
                        {t("dailyLog.composer.uploadImage")}
                      </button>
                      <button
                        role="menuitem"
                        type="button"
                        onClick={() => { setShowOverflow(false); onAddFromTemplates?.(); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2.5 transition-colors"
                      >
                        {/* Star/template icon */}
                        <svg className="w-4 h-4 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        {t("dailyLog.composer.addFromTemplates")}
                      </button>
                    </>
                  ) : mode === "favorite-meals" ? (
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => { setShowOverflow(false); galleryInputRef.current?.click(); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2.5 transition-colors"
                    >
                      {/* Photo/gallery icon */}
                      <svg className="w-4 h-4 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      {t("dailyLog.composer.uploadImage")}
                    </button>
                  ) : (
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => { setShowOverflow(false); onAddFromTemplates?.(); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2.5 transition-colors"
                    >
                      <svg className="w-4 h-4 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      {t("dailyLog.composer.addActivityFromTemplates")}
                    </button>
                  )}
                </div>
              )}
            </div>}
          </div>

          {/* ── Center: auto-grow textarea ── */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => { setText(e.target.value); autoResize(e.target); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder={placeholder}
            aria-label={placeholder}
            className="flex-1 min-w-0 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-colors resize-none overflow-hidden leading-normal scrollbar-none"
          />

          {/* ── Right: send button ── */}
          <button
            type="button"
            onClick={handleAdd}
            disabled={!canSubmit}
            aria-label={t("dailyLog.composer.send")}
            aria-disabled={!canSubmit}
            className={`inline-flex items-center justify-center w-10 h-10 rounded-full shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 mb-0.5 ${
              busy
                ? "bg-indigo-600 text-white cursor-wait"
                : hasInput
                  ? "bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
            }`}
          >
            {busy ? (
              <IconSpinner className="w-4 h-4" />
            ) : (
              /* Paper-plane / send icon */
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>

        {/* ── Image thumbnail preview strip ── */}
        {imagePreview && (
          <div className="mt-2 flex items-center gap-2">
            <div className="relative shrink-0">
              <img
                src={imagePreview}
                alt={t("dashboard.photo_alt")}
                className="h-12 w-12 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
              />
              <button
                type="button"
                onClick={clearImageState}
                disabled={busy}
                aria-label={t("dashboard.photo_remove_aria")}
                className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gray-700 text-white shadow hover:bg-gray-900 transition-colors focus-visible:outline-2 focus-visible:outline-gray-700 disabled:opacity-50"
              >
                <IconX className="w-2.5 h-2.5" />
              </button>
            </div>
            {!imageData && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                <svg className="inline animate-spin h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t("dashboard.photo_processing")}
              </p>
            )}
          </div>
        )}

        {/* ── Error message ── */}
        {error && (
          <p role="alert" className="mt-1.5 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {/* ── AI processing card ── */}
        {busy && (
          <AiProcessingCard
            context={mode === "activities" || mode === "favorite-activities" ? "activity" : "food"}
            className="mt-2"
          />
        )}
      </div>
  );

  return (
    <>
      {/* Barcode scanner full-screen overlay */}
      {showScanner && (
        <BarcodeScannerOverlay
          onDetected={handleBarcodeDetected}
          onClose={(cameraError) => {
            setShowScanner(false);
            if (cameraError) setError(t("dashboard.barcode_camera_denied"));
          }}
        />
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label={t("dailyLog.composer.addPhoto")}
        className="sr-only"
        onChange={handleImageSelected}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        aria-label={t("dailyLog.composer.uploadImage")}
        className="sr-only"
        onChange={handleImageSelected}
      />

      {/* Overflow backdrop — transparent layer that closes the menu on outside click */}
      {showOverflow && (
        <div
          className="fixed inset-0 z-38"
          onClick={() => setShowOverflow(false)}
          aria-hidden="true"
        />
      )}

      {/* Composer bar: portaled into the bottom dock on mobile, inline on desktop */}
      {isMobile && dockEl
        ? (isActive ? createPortal(composerBar, dockEl) : null)
        : composerBar}
    </>
  );
}
