import { Sheet } from './Sheet';
import { Icon, type IconName } from './Icon';
import { Button } from './Button';
import { cn } from '@/utils/cn';

export interface SheetAction {
  icon: IconName;
  label: string;
  onSelect: () => void;
  destructive?: boolean;
}

interface ActionSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  actions: SheetAction[];
}

/** Context menu sheet: opened via long press on cards/rows. */
export function ActionSheet({ open, onClose, title, actions }: ActionSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="rounded-card bg-inset overflow-hidden">
        {actions.map((a, i) => (
          <button
            key={i}
            type="button"
            className={cn(
              'pressable w-full flex items-center gap-3 px-4 h-13 text-left text-[15px] font-semibold',
              'active:bg-press',
              a.destructive ? 'text-danger' : 'text-ink',
              i > 0 && 'border-t border-hairline/60',
            )}
            onClick={() => {
              onClose();
              a.onSelect();
            }}
          >
            <Icon name={a.icon} size={19} className={a.destructive ? 'text-danger' : 'text-ink-2'} />
            {a.label}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

interface ConfirmSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Explain the consequence, especially what will be lost */
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}

/** Confirmation for destructive or hard-to-reverse actions. */
export function ConfirmSheet({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive = true,
  loading = false,
  onConfirm,
}: ConfirmSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="text-[15px] text-ink-2 leading-relaxed">{body}</p>
      <div className="mt-5 space-y-2.5">
        <Button
          variant={destructive ? 'danger' : 'primary'}
          size="lg"
          fullWidth
          loading={loading}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
        <Button variant="secondary" size="lg" fullWidth onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
      </div>
    </Sheet>
  );
}
