import { Icon, type IconName } from './Icon';
import { cn } from '@/utils/cn';
import { useHaptics } from '@/hooks/useHaptics';

interface FabProps {
  icon?: IconName;
  /** Short verb so the action is never ambiguous ("Log", "New") */
  label: string;
  onClick: () => void;
  className?: string;
}

/**
 * Extended floating action button, bottom-right above the tab bar.
 * Each page renders its own with a label naming its primary action,
 * so the button never means something different than it says.
 */
export function Fab({ icon = 'plus', label, onClick, className }: FabProps) {
  const haptics = useHaptics();
  return (
    <button
      type="button"
      onClick={() => {
        haptics.tap();
        onClick();
      }}
      className={cn(
        'pressable fixed right-4 z-40 h-13 pl-4 pr-5 rounded-full',
        'bg-primary text-on-primary shadow-lg shadow-primary/30',
        'flex items-center gap-2 text-[15px] font-bold animate-pop',
        className,
      )}
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)' }}
    >
      <Icon name={icon} size={21} strokeWidth={2.4} />
      {label}
    </button>
  );
}
