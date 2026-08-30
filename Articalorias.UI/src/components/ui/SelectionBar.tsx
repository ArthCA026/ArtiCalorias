import { Icon, type IconName } from '@/components/ui/Icon';
import { useHaptics } from '@/hooks/useHaptics';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';

export interface SelectionAction {
  icon: IconName;
  label: string;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface SelectionBarProps {
  /** How many items are currently selected */
  count: number;
  actions: SelectionAction[];
  /** Leaves select mode */
  onClear: () => void;
  /** Disables every action while a bulk operation runs */
  busy?: boolean;
}

/**
 * Bottom bar shown while multi-selecting (long-press starts it). Floats where
 * the Fab lives so the selected list stays visible; each action is icon +
 * label, never icon alone. Stays visible at zero selected (actions disabled)
 * so the X can always leave select mode.
 */
export function SelectionBar({ count, actions, onClear, busy = false }: SelectionBarProps) {
  const { t } = useTranslation();
  const haptics = useHaptics();

  return (
    <div
      // z-45: above each page's own Fab (z-40, same corner) so the bulk bar
      // fully replaces it while selecting, still under sheets/dialogs (z-50).
      className="fixed inset-x-3 z-45 animate-pop"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)' }}
      role="toolbar"
      aria-label={t('select.bar_aria', 'Actions for the selected items')}
    >
      <div className="mx-auto max-w-md rounded-2xl bg-card shadow-lg shadow-black/20 p-2 flex items-center gap-1">
        <button
          type="button"
          onClick={onClear}
          aria-label={t('select.clear', 'Cancel selection')}
          className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-inset text-ink-2 active:bg-press"
        >
          <Icon name="close" size={18} />
        </button>
        <span className="shrink-0 px-1.5 text-[14px] font-extrabold text-ink tabular-nums">
          {count}
        </span>
        <div className="flex flex-1 justify-end gap-1">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              disabled={busy || a.disabled || count === 0}
              onClick={() => {
                haptics.tap();
                a.onSelect();
              }}
              className={cn(
                'pressable flex flex-col items-center justify-center gap-0.5 rounded-xl px-2.5 py-1.5 min-w-16',
                'active:bg-press disabled:opacity-40 disabled:pointer-events-none',
                a.destructive ? 'text-danger' : 'text-ink-2',
              )}
            >
              <Icon name={a.icon} size={18} />
              <span className="text-[11px] font-bold leading-none">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
