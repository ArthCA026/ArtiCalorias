import { useId, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface ProgressRingProps {
  /** 0..1 (values above 1 are capped visually) */
  progress: number;
  size?: number;
  strokeWidth?: number;
  /** Override the gradient with a flat color (e.g. var(--t-warning)) */
  color?: string;
  children?: ReactNode;
  label?: string;
}

/**
 * Circular progress with a brand gradient stroke.
 * The visual centerpiece of the Today screen.
 */
export function ProgressRing({
  progress,
  size = 172,
  strokeWidth = 13,
  color,
  children,
  label,
}: ProgressRingProps) {
  const gradId = useId();
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <div
      className="relative inline-flex items-center justify-center"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--t-ring-from)" />
            <stop offset="100%" stopColor="var(--t-ring-to)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--t-ring-track)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color ?? `url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.32, 0.72, 0, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

interface ProgressBarProps {
  progress: number;
  className?: string;
  /** CSS color for the fill; defaults to the brand gradient */
  color?: string;
  height?: number;
  label?: string;
}

export function ProgressBar({ progress, className, color, height = 8, label }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <div
      className={cn('w-full rounded-full bg-ring-track overflow-hidden', className)}
      style={{ height }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-label={label}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${clamped * 100}%`,
          background: color ?? 'linear-gradient(90deg, var(--t-ring-from), var(--t-ring-to))',
          transition: 'width 0.6s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      />
    </div>
  );
}
