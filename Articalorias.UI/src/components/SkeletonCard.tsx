import SkeletonRow from './SkeletonRow';

interface SkeletonCardProps {
  /**
   * Number of SkeletonRow instances to render inside the card body.
   * @default 3
   */
  rows?: number;
  /**
   * If true, renders an extra-wide header row before the body rows.
   * @default false
   */
  hasHeader?: boolean;
  /** Additional Tailwind classes applied to the card wrapper. */
  className?: string;
}

const BODY_WIDTHS = [
  ['w-full'],
  ['w-3/4'],
  ['w-1/2'],
  ['w-2/3'],
  ['w-5/6'],
];

export default function SkeletonCard({
  rows = 3,
  hasHeader = false,
  className = '',
}: SkeletonCardProps) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface p-4 space-y-3 ${className}`}
    >
      {hasHeader && <SkeletonRow height="h-5" widths={['w-1/2']} />}
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} widths={BODY_WIDTHS[i % BODY_WIDTHS.length]} />
      ))}
    </div>
  );
}
