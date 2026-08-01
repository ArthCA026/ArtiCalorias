import { HALF, TIP_W, XBAND_H, columnCentre } from './deltaScale';

export interface DayTipModel {
  /** 0..6, which weekday column the tip points at */
  index: number;
  /** "Wednesday" */
  title: string;
  /** "+240", or null on a day with nothing on it */
  value: string | null;
  /** "over plan" / "under plan" / "right on plan" / "Nothing logged" */
  caption: string;
  /** Three micro stats, omitted on days with nothing on them */
  stats?: { label: string; value: string }[];
  /** "Deficit day" / "Surplus day". Decodes the color rule in context. */
  goalType?: string;
  /** true: sit below the plan line (up bar). false: sit above it (down bar). */
  below: boolean;
}

/**
 * Very small readout that sits over the tapped bar, always on the empty side
 * of the plan line so it never covers the bar it describes.
 *
 * Position is pure CSS calc and clamp against the chart's own width, so it
 * needs no measurement and never flashes mispositioned on first paint.
 *
 * Hidden from assistive tech on purpose: the same sentence is already the
 * bar button's accessible name, so nothing here is gated behind a tap.
 */
export function DayDeltaPopover({ model }: { model: DayTipModel }) {
  const { index, below } = model;
  const centre = columnCentre(index);
  // clamp() IS the edge clamping: Mon and Tue pin left, Sat and Sun pin
  // right, the middle three centre exactly.
  const left = `clamp(0px, calc(${centre} - ${TIP_W / 2}px), calc(100% - ${TIP_W}px))`;

  const boxPos = below ? { top: HALF + 5 } : { bottom: XBAND_H + HALF + 5 };
  const caretPos = below ? { top: HALF + 1 } : { bottom: XBAND_H + HALF + 1 };

  return (
    <div aria-hidden="true" className="pointer-events-none">
      {/* Caret first in the DOM so the box paints over its inner half. It uses
          the unclamped centre, so it still points at the right column even
          when the box has been pinned to an edge. */}
      <span
        className="absolute z-10 h-2 w-2 rotate-45 rounded-[1px] bg-tip"
        style={{ ...caretPos, left: centre, marginLeft: -4 }}
      />
      <div
        className={`absolute z-10 rounded-xl bg-tip px-2.5 py-2 shadow-lg animate-pop ${
          below ? 'origin-top' : 'origin-bottom'
        }`}
        style={{ ...boxPos, left, width: TIP_W }}
      >
        <p className="text-[11px] font-semibold capitalize truncate text-tip-ink-2">
          {model.title}
        </p>
        <p className="mt-0.5 flex items-baseline gap-1.5">
          {model.value && (
            <span className="text-[15px] font-extrabold tabular-nums text-tip-ink">
              {model.value}
            </span>
          )}
          <span className="text-[11px] truncate text-tip-ink-2">{model.caption}</span>
        </p>
        {model.stats && (
          <div className="mt-1.5 grid grid-cols-3 gap-1">
            {model.stats.map((s) => (
              <div key={s.label} className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wide truncate text-tip-ink-2">
                  {s.label}
                </p>
                <p className="text-[11px] font-semibold tabular-nums truncate text-tip-ink">
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        )}
        {model.goalType && (
          <p className="mt-1.5 text-[9px] font-bold uppercase tracking-wide truncate text-tip-ink-2">
            {model.goalType}
          </p>
        )}
      </div>
    </div>
  );
}
