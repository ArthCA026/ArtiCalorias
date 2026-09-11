import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/Progress';
import { Icon, iconOrFallback } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { useHaptics } from '@/hooks/useHaptics';
import { useMacros } from '@/hooks/useMacros';
import { foodService } from '@/services/foodService';
import { invalidateDayData } from '@/lib/queryKeys';
import { extractApiError } from '@/utils/apiError';
import {
  coreZeros,
  dayTargetFor,
  filterMacrosForDay,
  formatMacroAmount,
  isGoalReached,
  isOverLimit,
  macroColor,
  macroSoftColor,
  macroTotalFor,
  pickLabel,
  sortKeysByCatalog,
  trackedKeysFromTargets,
} from '@/utils/macros';
import { cn } from '@/utils/cn';
import type { DailyLogResponse, MacroDefinition, MacroQuickAdd } from '@/types';

interface QuickAddCardProps {
  date: string;
  log: DailyLogResponse;
}

/**
 * One card with a row per tracked macro that has quick-add presets (water,
 * alcohol, caffeine...), each with its own bar. One tap logs a ready-made
 * entry as a regular meal row (editable and deletable like anything else),
 * so there is no hidden second bookkeeping system. Which rows show is
 * decided by the DAY's frozen targets, so a past day reads as it was lived.
 * Own-card macros are excluded from the hero bars: this row IS their bar.
 */
export function QuickAddCard({ date, log }: QuickAddCardProps) {
  const { get, defs } = useMacros();

  const tracked = trackedKeysFromTargets(log.macroTargets);
  const rows = sortKeysByCatalog(tracked, get)
    .map(get)
    .filter((d) => d.hasOwnCard);

  if (rows.length === 0) return null;

  return (
    <Card padded={false} className="px-4 py-1">
      {rows.map((def) => (
        <QuickAddRow key={def.key} date={date} log={log} def={def} tracked={tracked} allDefs={defs} />
      ))}
    </Card>
  );
}

interface QuickAddRowProps {
  date: string;
  log: DailyLogResponse;
  def: MacroDefinition;
  tracked: Set<string>;
  allDefs: MacroDefinition[];
}

function QuickAddRow({ date, log, def, tracked, allDefs }: QuickAddRowProps) {
  const { t, i18n } = useTranslation();
  const { get, label } = useMacros();
  const { toast } = useToast();
  const haptics = useHaptics();
  const queryClient = useQueryClient();

  const target = dayTargetFor(log, def.key);
  const total = macroTotalFor(log, def.key) ?? 0;
  const goal = target?.target ?? null;
  const over = isOverLimit(def, total, goal);
  const reached = isGoalReached(def, total, goal);
  const color = macroColor(def.key);
  const soft = macroSoftColor(def.key);
  const name = label(def);

  const add = useMutation({
    mutationFn: (q: MacroQuickAdd) =>
      foodService.create(date, {
        foodName: pickLabel(q.labels.name, i18n.language, name),
        portionDescription: pickLabel(q.labels.portion, i18n.language),
        quantity: 1,
        caloriesKcal: q.caloriesKcal,
        // Only the macros this day tracks are written (plus core zeros), so
        // a coffee credits water only for someone who tracks water.
        macros: filterMacrosForDay({ ...coreZeros(allDefs), ...q.macros }, tracked, get),
      }),
    onSuccess: () => {
      haptics.success();
      invalidateDayData(queryClient);
    },
    onError: (err) =>
      toast('error', extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.'))),
  });

  return (
    <div className="py-3 border-b border-hairline/50 last:border-b-0">
      <div className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: soft, color }}
        >
          <Icon name={iconOrFallback(def.icon)} size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-semibold text-ink-2 truncate">{name}</span>
            <span className={cn('text-[13px] font-bold tabular-nums shrink-0', over ? 'text-warning' : 'text-ink')}>
              {formatMacroAmount(def, total)}
              {goal !== null && (
                <span className="text-ink-3 font-medium">
                  {' '}
                  {def.direction === 'limit'
                    ? t('macros.of_limit', 'of {{limit}} limit', { limit: formatMacroAmount(def, goal) })
                    : `/ ${formatMacroAmount(def, goal)}`}
                </span>
              )}
            </span>
          </div>
          <div className="mt-1.5">
            {goal !== null ? (
              <ProgressBar
                progress={goal > 0 ? total / goal : 0}
                height={6}
                color={over ? 'var(--t-warning)' : color}
                label={t('macros.bar_aria', '{{macro}} progress', { macro: name })}
              />
            ) : (
              <div className="h-1.5 rounded-full" style={{ background: 'var(--t-ring-track)' }} aria-hidden="true" />
            )}
          </div>
        </div>
      </div>

      {def.quickAdds.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {def.quickAdds.map((q) => {
            const qName = pickLabel(q.labels.name, i18n.language, name);
            const qPortion = pickLabel(q.labels.portion, i18n.language);
            return (
              <button
                key={q.id}
                type="button"
                disabled={add.isPending}
                onClick={() => add.mutate(q)}
                className={cn(
                  'pressable inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold',
                  add.isPending && 'opacity-50',
                )}
                style={{ background: soft, color }}
                aria-label={t('macros.quick_add_aria', 'Add {{name}} ({{portion}})', {
                  name: qName,
                  portion: qPortion,
                })}
              >
                +<Icon name={iconOrFallback(q.icon)} size={14} />
                <span>{qName}</span>
              </button>
            );
          })}
        </div>
      )}

      {over && (
        <p className="mt-2 text-[12px] font-semibold text-warning">
          {t('macros.over_limit', 'Past your limit for this day.')}
        </p>
      )}
      {reached && (
        <p className="mt-2 text-[12px] font-semibold text-success">
          {t('macros.goal_reached', 'Goal reached. Well done!')}
        </p>
      )}
    </div>
  );
}
