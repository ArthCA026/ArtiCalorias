import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import { CalorieModeSheet } from '@/components/ui/CalorieModeSheet';
import { useToast } from '@/components/ui/Toast';
import { calorieModeShortLabel, calorieModeTitle } from '@/components/ui/calorieModeLabels';
import { useCalorieMode } from '@/hooks/useCalorieMode';
import { cn } from '@/utils/cn';

interface CalorieModeTagProps {
  className?: string;
}

/**
 * Small pill naming the calorie display mode the numbers beside it are built
 * from, and the way to change it.
 *
 * Every surface showing a mode-dependent figure carries one, so "1,240 left"
 * can never be read as three different things without saying which. Tapping it
 * opens the picker right where the confusion is, rather than sending the user
 * to Profile to find out.
 *
 * Self-contained on purpose: it reads the mode itself and owns its sheet, so
 * dropping one onto a card needs no props and no wiring. It renders a button,
 * so it must be a sibling of any tappable card region, never nested inside one.
 */
export function CalorieModeTag({ className }: CalorieModeTagProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { mode, setMode } = useCalorieMode();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={t('common.calorie_mode_aria', 'Calorie display: {{mode}}. Tap to change.', {
          mode: calorieModeTitle(t, mode),
        })}
        className={cn(
          'pressable shrink-0 inline-flex items-center gap-1 rounded-full bg-inset active:bg-press',
          'px-2 py-1 text-[11px] font-semibold text-ink-3',
          className,
        )}
      >
        <Icon name="chart" size={12} className="shrink-0" />
        {calorieModeShortLabel(t, mode)}
      </button>

      <CalorieModeSheet
        open={open}
        onClose={() => setOpen(false)}
        mode={mode}
        onPick={(m) => {
          setMode(m);
          toast('success', t('common.calorie_mode_changed', 'Calorie display updated'));
        }}
      />
    </>
  );
}
