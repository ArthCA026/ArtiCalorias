import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger' | 'premium';
type Size = 'lg' | 'md' | 'sm';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and disables the button. Always give feedback while working. */
  loading?: boolean;
  icon?: IconName;
  fullWidth?: boolean;
  children?: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary active:bg-primary-press font-semibold',
  secondary: 'bg-inset text-ink active:bg-press font-semibold',
  soft: 'bg-primary-soft text-primary-soft-ink active:bg-press font-semibold',
  ghost: 'bg-transparent text-ink-2 active:bg-inset font-medium',
  danger: 'bg-danger-soft text-danger active:bg-press font-semibold',
  premium: 'bg-premium text-white active:opacity-90 font-semibold',
};

const sizeClasses: Record<Size, string> = {
  lg: 'h-13 px-6 text-base rounded-control',
  md: 'h-11 px-5 text-[15px] rounded-control',
  sm: 'h-9 px-3.5 text-sm rounded-xl',
};

export function Spinner({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn('animate-spin', className)}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'pressable inline-flex items-center justify-center gap-2 whitespace-nowrap',
        'disabled:opacity-50 disabled:pointer-events-none',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : icon ? <Icon name={icon} size={size === 'sm' ? 16 : 19} /> : null}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
  size?: number;
  iconSize?: number;
  variant?: 'plain' | 'inset' | 'primary';
}

/** Square icon-only button with a mandatory accessible label. Minimum 44px touch target. */
export function IconButton({
  icon,
  label,
  size = 44,
  iconSize = 21,
  variant = 'plain',
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      style={{ width: size, height: size }}
      className={cn(
        'pressable inline-flex items-center justify-center rounded-full shrink-0',
        variant === 'plain' && 'text-ink-2 active:bg-inset',
        variant === 'inset' && 'bg-inset text-ink active:bg-press',
        variant === 'primary' && 'bg-primary text-on-primary active:bg-primary-press',
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={iconSize} />
    </button>
  );
}
