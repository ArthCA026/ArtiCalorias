import { memo, useEffect, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScaleOption {
  key: string;
  /** Label shown in the desktop grid cell. */
  label: string;
  /** Shorter label for the mobile scroll card. Falls back to `label` if omitted. */
  mobileLabel?: string;
  /** Optional secondary line shown below the label in the desktop cell. */
  desktopSecondaryValue?: string;
  /** Optional secondary line shown below the label in the mobile card. Falls back to `desktopSecondaryValue` if omitted. */
  mobileSecondaryValue?: string;
  /** Full descriptive text for the visually-hidden radio input's aria-label. */
  fullAriaLabel: string;
}

interface ResponsiveScaleSelectorProps {
  options: ScaleOption[];
  selectedKey: string;
  onChange: (key: string) => void;
  disabled: boolean;
  /** name attribute prefix for the radio groups — must be unique per page. */
  radioGroupName: string;
  /** aria-label for the wrapping role="group" element. */
  ariaLabel?: string;
  /** Minimum width (px) for each mobile option card. Default: 120. */
  mobileOptionMinWidth?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

function ResponsiveScaleSelector({
  options,
  selectedKey,
  onChange,
  disabled,
  radioGroupName,
  ariaLabel,
  mobileOptionMinWidth = 120,
}: ResponsiveScaleSelectorProps) {
  const selectedIndex = options.findIndex((o) => o.key === selectedKey);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLLabelElement | null)[]>([]);

  // ── Auto-scroll: center selected mobile card without overscrolling ────────
  useEffect(() => {
    const container = scrollContainerRef.current;
    const selectedOption = optionRefs.current[selectedIndex];

    if (!container || !selectedOption || selectedIndex < 0) return;

    window.requestAnimationFrame(() => {
      const maxScrollLeft = container.scrollWidth - container.clientWidth;

      if (maxScrollLeft <= 0) return;

      const containerRect = container.getBoundingClientRect();
      const optionRect = selectedOption.getBoundingClientRect();

      const optionLeftInsideContainer =
        optionRect.left - containerRect.left + container.scrollLeft;

      const targetScroll =
        optionLeftInsideContainer -
        (container.clientWidth - optionRect.width) / 2;

      const clampedScroll = Math.min(
        Math.max(targetScroll, 0),
        maxScrollLeft
      );

      container.scrollTo({
        left: clampedScroll,
        behavior: "smooth",
      });
    });
  }, [selectedKey, selectedIndex]);

  // ── Shared cell appearance helper ─────────────────────────────────────────
  function cellCls(isSelected: boolean, isAdjacent: boolean): string {
    return [
      "relative flex cursor-pointer select-none flex-col items-center justify-center touch-manipulation",
      "px-1 py-2.5 text-center text-xs font-medium leading-tight",
      "transition-colors duration-200",
      "focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500",
      isSelected
        ? "bg-indigo-600 text-white font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
        : isAdjacent
          ? "bg-indigo-50 text-indigo-500"
          : "bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700",
      disabled ? "pointer-events-none opacity-50" : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return (
    <div role="group" aria-label={ariaLabel} className="w-full max-w-full min-w-0">
      {/* ── Desktop grid (sm+) — equal-width columns ──────────────────────── */}
      <div
        className="hidden overflow-hidden bg-gray-200 sm:grid sm:gap-px"
        style={{
          gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        }}
      >
        {options.map((opt, i) => {
          const isSelected = opt.key === selectedKey;
          const isAdjacent =
            selectedIndex >= 0 && Math.abs(i - selectedIndex) === 1;

          return (
            <label
              key={opt.key}
              title={opt.fullAriaLabel}
              className={[cellCls(isSelected, isAdjacent), "min-h-11"].join(" ")}
            >
              <input
                type="radio"
                name={`${radioGroupName}-desktop`}
                value={opt.key}
                checked={isSelected}
                onChange={() => onChange(opt.key)}
                disabled={disabled}
                aria-label={opt.fullAriaLabel}
                className="sr-only"
              />

              <span className="leading-tight">{opt.label}</span>

              {opt.desktopSecondaryValue && (
                <span
                  className={[
                    "mt-0.5 text-[10px] font-normal leading-tight",
                    isSelected ? "text-indigo-200" : "text-gray-400",
                  ].join(" ")}
                >
                  {opt.desktopSecondaryValue}
                </span>
              )}
            </label>
          );
        })}
      </div>

      {/* ── Mobile horizontal scroll (below sm) ───────────────────────────── */}
      <div className="relative w-full max-w-full min-w-0 rounded-xl bg-gray-200 sm:hidden">
        {/* Right-edge fade affordance */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-20 w-8 bg-gradient-to-l from-white to-transparent"
          aria-hidden="true"
        />

        <div
          ref={scrollContainerRef}
          className={[
            "flex w-full max-w-full min-w-0 gap-px overflow-x-auto overflow-y-hidden bg-gray-200",
            "scrollbar-none overscroll-x-contain touch-pan-x",
          ].join(" ")}
          style={{
            WebkitOverflowScrolling: "touch",
            overscrollBehaviorX: "contain",
          }}
        >
          {options.map((opt, i) => {
            const isSelected = opt.key === selectedKey;
            const isAdjacent =
              selectedIndex >= 0 && Math.abs(i - selectedIndex) === 1;

            const mobileLabel = opt.mobileLabel ?? opt.label;
            const mobileSecondary =
              opt.mobileSecondaryValue ?? opt.desktopSecondaryValue;

            return (
              <label
                key={opt.key}
                ref={(el) => {
                  optionRefs.current[i] = el;
                }}
                title={opt.fullAriaLabel}
                style={{
                  flex: `0 0 ${mobileOptionMinWidth}px`,
                }}
                className={[cellCls(isSelected, isAdjacent), "min-h-14"].join(" ")}
              >
                <input
                  type="radio"
                  name={`${radioGroupName}-mobile`}
                  value={opt.key}
                  checked={isSelected}
                  onChange={() => onChange(opt.key)}
                  disabled={disabled}
                  aria-label={opt.fullAriaLabel}
                  className="absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0"
                />

                <span className="pointer-events-none relative z-0 leading-tight">
                  {mobileLabel}
                </span>

                {mobileSecondary && (
                  <span
                    className={[
                      "pointer-events-none relative z-0 mt-0.5 text-[10px] font-normal leading-tight",
                      isSelected ? "text-indigo-200" : "text-gray-400",
                    ].join(" ")}
                  >
                    {mobileSecondary}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default memo(ResponsiveScaleSelector);