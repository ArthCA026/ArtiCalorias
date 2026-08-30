import { useTranslation } from 'react-i18next';
import { ProgressBar } from '@/components/ui/Progress';
import { Icon, type IconName } from '@/components/ui/Icon';
import { MACRO_META, PROTEIN_META, formatMacroAmount, macroLabel, macroTotalFor } from '@/utils/macros';
import { cn } from '@/utils/cn';
import type { DailyLogResponse, MacroKey } from '@/types';

interface MacroBarsProps {
  log: DailyLogResponse;
  /** Water and alcohol are excluded here: each has its own quick-add card */
  className?: string;
}

interface BarModel {
  key: string;
  icon: IconName;
  color: string;
  label: string;
  valueText: string;
  targetText: string | null;
  progress: number | null;
  warn: boolean;
}

/**
 * Bars for the day's tracked NUTRIENT macros, protein included, rendered as
 * one block inside the calorie-ring card. The layout adapts to how many are
 * tracked so one lonely macro never floats in half a card:
 *   1 -> a single full-width bar (the classic protein look);
 *   2 -> two full-width bars stacked;
 *   3 -> one full-width bar on top, two half-width below;
 *   4 -> the two-by-two grid.
 * Targets come frozen from the day itself: a past day shows the macros it
 * was lived under, never today's settings. Water and alcohol live in their
 * own quick-add cards. "limit" macros (sugar) flip to the warning color once
 * past the limit; an untargeted one shows the plain amount, judgement-free.
 * Renders nothing when the day tracked no nutrient macro at all.
 */
export function MacroBars({ log, className }: MacroBarsProps) {
  const { t } = useTranslation();

  const bars: BarModel[] = [];

  if (log.snapshotProteinGoalGrams > 0) {
    bars.push({
      key: 'protein',
      icon: PROTEIN_META.icon,
      color: PROTEIN_META.color,
      label: t('today.protein', 'Protein'),
      valueText: `${Math.round(log.totalProteinGrams)}g`,
      targetText: `${Math.round(log.snapshotProteinGoalGrams)}g`,
      progress:
        log.snapshotProteinGoalGrams > 0
          ? log.totalProteinGrams / log.snapshotProteinGoalGrams
          : 0,
      warn: false,
    });
  }

  for (const m of log.macroTargets) {
    if (m.macroKey === 'water' || m.macroKey === 'alcohol') continue;
    const key = m.macroKey as MacroKey;
    const meta = MACRO_META[key];
    const value = macroTotalFor(log, key) ?? 0;
    const over = m.target !== null && value > m.target;
    bars.push({
      key,
      icon: meta.icon,
      color: meta.color,
      label: macroLabel(t, key),
      valueText: formatMacroAmount(key, value),
      targetText: m.target !== null ? formatMacroAmount(key, m.target) : null,
      progress: m.target !== null ? (m.target > 0 ? value / m.target : 0) : null,
      warn: m.direction === 'limit' && over,
    });
  }

  if (bars.length === 0) return null;

  // Which bars stretch across both columns (see the layout table above).
  const fullWidth = (index: number) =>
    bars.length <= 2 || (bars.length === 3 && index === 0);

  return (
    <div className={cn('grid grid-cols-2 gap-x-4 gap-y-3.5', className)}>
      {bars.map((bar, i) => (
        <div key={bar.key} className={cn(fullWidth(i) && 'col-span-2')}>
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-2 min-w-0">
              <Icon name={bar.icon} size={13} style={{ color: bar.color }} />
              <span className="truncate">{bar.label}</span>
            </span>
            <span
              className={cn(
                'text-[12px] font-bold tabular-nums shrink-0',
                bar.warn ? 'text-warning' : 'text-ink',
              )}
            >
              {bar.valueText}
              {bar.targetText !== null && (
                <span className="text-ink-3 font-medium"> / {bar.targetText}</span>
              )}
            </span>
          </div>
          {bar.progress !== null ? (
            <ProgressBar
              progress={bar.progress}
              height={6}
              color={bar.warn ? 'var(--t-warning)' : bar.color}
              label={t('macros.bar_aria', '{{macro}} progress', { macro: bar.label })}
            />
          ) : (
            <div className="h-1.5 rounded-full" style={{ background: 'var(--t-ring-track)' }} aria-hidden="true" />
          )}
        </div>
      ))}
    </div>
  );
}
