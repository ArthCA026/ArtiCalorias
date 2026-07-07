interface SkeletonRowProps {
  /**
   * Tailwind width classes for each segment within the row.
   * If omitted, renders a single full-width bar.
   * Example: ["w-3/4", "w-1/4"] renders two adjacent bars at 75% and 25%.
   */
  widths?: string[];
  /**
   * Tailwind height class applied to each bar segment.
   * @default "h-4"
   */
  height?: string;
  /** Additional Tailwind classes applied to the row wrapper. */
  className?: string;
}

export default function SkeletonRow({
  widths,
  height = 'h-4',
  className = '',
}: SkeletonRowProps) {
  const segments = widths ?? ['w-full'];
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {segments.map((w, i) => (
        <div
          key={i}
          className={`${w} ${height} rounded bg-surface-subtle animate-pulse motion-reduce:animate-none`}
        />
      ))}
    </div>
  );
}
