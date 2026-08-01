import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet';
import { Icon } from '@/components/ui/Icon';
import { calorieModeTitle } from '@/components/ui/calorieModeLabels';
import { cn } from '@/utils/cn';
import type { CalorieMode } from '@/hooks/useCalorieMode';

interface CalorieModeSheetProps {
  open: boolean;
  onClose: () => void;
  mode: CalorieMode;
  onPick: (mode: CalorieMode) => void;
}

/**
 * The calorie display picker. Lives in ui/ rather than profile/ because every
 * mode tag in the app opens it, not just the Profile row.
 */
export function CalorieModeSheet({ open, onClose, mode, onPick }: CalorieModeSheetProps) {
  const { t } = useTranslation();
  const options: Array<{ id: CalorieMode; desc: string }> = [
    {
      id: 'adjusted',
      desc: t('profile.mode_adjusted_desc', 'Your daily budget rebalances over the week. A heavy day just shrinks the next days a little. Recommended.'),
    },
    {
      id: 'goal',
      desc: t('profile.mode_goal_desc', 'The same target every day, based on your goal.'),
    },
    {
      id: 'net',
      desc: t('profile.mode_net_desc', 'Budget equals what you burn. Eat less to lose, more to gain.'),
    },
  ];
  return (
    <Sheet open={open} onClose={onClose} title={t('profile.mode_title', 'Calorie display')}>
      <p className="mb-3 text-[13px] text-ink-2 leading-relaxed">
        {t(
          'profile.mode_intro',
          'This is the number every screen compares your day against, on Today and across Progress.',
        )}
      </p>
      <div className="space-y-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => {
              onPick(o.id);
              onClose();
            }}
            className={cn(
              'pressable w-full rounded-card px-4 py-3.5 text-left flex items-start gap-3',
              mode === o.id ? 'bg-primary-soft ring-2 ring-primary/60' : 'bg-inset',
            )}
          >
            <span className="flex-1">
              <span className="text-[15px] font-bold text-ink">{calorieModeTitle(t, o.id)}</span>
              <span className="block text-[13px] text-ink-2 mt-0.5 leading-relaxed">{o.desc}</span>
            </span>
            {mode === o.id && <Icon name="checkCircle" size={20} className="text-primary mt-0.5" />}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
