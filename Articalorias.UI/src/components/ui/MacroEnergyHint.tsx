import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import { useMacros } from '@/hooks/useMacros';
import { macroEnergyKcal, macrosExceedCalories, parseMacroFields } from '@/utils/macros';
import { cn } from '@/utils/cn';

interface MacroEnergyHintProps {
  /** Raw calories field, exactly as typed */
  calories: string;
  /** Raw macro fields keyed by macro key, exactly as typed */
  macros: Record<string, string>;
  className?: string;
}

/**
 * A heads-up under a meal form when the typed macros cannot belong to the
 * typed calories (300 g of protein on a 200 kcal snack): almost always a
 * slipped digit, caught while it is still one keystroke to fix. It never
 * blocks saving, because labels and estimates do disagree a little and the
 * user may know better; the server prices digestion from the calories either
 * way, so a typo that slips through can no longer inflate the day's budget.
 * Silent while the calories are blank, and when macros are merely missing.
 */
export function MacroEnergyHint({ calories, macros, className }: MacroEnergyHintProps) {
  const { t } = useTranslation();
  const { get } = useMacros();

  const kcal = Number(calories.trim().replace(',', '.'));
  if (calories.trim() === '' || !Number.isFinite(kcal) || kcal < 0) return null;

  const macroKcal = macroEnergyKcal(parseMacroFields(macros), get);
  if (!macrosExceedCalories(macroKcal, kcal)) return null;

  return (
    <p role="status" className={cn('flex items-start gap-1.5 text-[13px] text-warning leading-relaxed', className)}>
      <Icon name="alertCircle" size={15} className="mt-px shrink-0" />
      <span>
        {t(
          'log.macro_energy_hint',
          'These macros add up to about {{macroKcal}} kcal, more than the {{kcal}} kcal entered. Worth a second look for a slipped digit.',
          { macroKcal: Math.round(macroKcal).toLocaleString(), kcal: Math.round(kcal).toLocaleString() },
        )}
      </span>
    </p>
  );
}
