import { useTranslation } from 'react-i18next';
import { ProgressBar } from '@/components/ui/Progress';
import { Icon, iconOrFallback, type IconName } from '@/components/ui/Icon';
import { useMacros } from '@/hooks/useMacros';
import { formatMacroAmount, macroColor, macroTotalFor, sortKeysByCatalog } from '@/utils/macros';
import { cn } from '@/utils/cn';
import type { DailyLogResponse } from '@/types';

interface MacroBarsProps {
  log: DailyLogResponse;
  /** Own-card macros (water, alcohol, caffeine...) are excluded here: the quick-add card is their bar */
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
 * Bars for the day's tracked nutrient macros, protein included, rendered as
 * one block inside the calorie-ring card. Which bars exist comes from the
 * DAY's frozen targets (a past day shows the macros it was lived under,
 * never today's settings) and how each one looks comes from the catalog.
 * The layout adapts to how many are tracked so one lonely macro never
 * floats in half a card:
 *   1 -> a single full-width bar;
 *   2 -> two full-width bars stacked;
 *   3 -> one full-width bar on top, two half-width below;
 *   4+ -> the two-column grid.
 * "limit" macros flip to the warning color once past the limit; an
 * untargeted one shows the plain amount, judgement-free.
 */
export function MacroBars({ log, className }: MacroBarsProps) {
  const { t } = useTranslation();
  const { get, label } = useMacros();

  const bars: BarModel[] = [];
  const keys = sortKeysByCatalog(log.macroTargets.map((m) => m.macroKey), get);

  for (const key of keys) {
    const def = get(key);
    if (def.hasOwnCard || !def.showInHeroBars) continue;
    const m = log.macroTargets.find((x) => x.macroKey === key)!;
    const value = macroTotalFor(log, key) ?? 0;
    const over = m.target !== null && value > m.target;
    bars.push({
      key,
      icon: iconOrFallback(def.icon),
      color: macroColor(key),
      label: label(def),
      valueText: formatMacroAmount(def, value),
      targetText: m.target !== null ? formatMacroAmount(def, m.target) : null,
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
