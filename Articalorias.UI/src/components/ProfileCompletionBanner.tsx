interface ProfileCompletionBannerProps {
  icon?: string;
  title: string;
  body?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

/**
 * Non-alarming informational banner shown when a calorie or protein estimate
 * cannot be displayed because required profile data is missing.
 *
 * Uses subtle indigo styling to distinguish from error states (red/amber).
 * When `ctaLabel` + `onCta` are provided a small action button is rendered.
 * When `icon` is provided it appears inline before the title.
 */
export function ProfileCompletionBanner({
  icon,
  title,
  body,
  ctaLabel,
  onCta,
}: ProfileCompletionBannerProps) {
  return (
    <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/30 px-4 py-3 text-sm">
      <p className="font-medium text-indigo-700 dark:text-indigo-300">
        {icon && <span className="mr-1.5" aria-hidden="true">{icon}</span>}
        {title}
      </p>
      {body && <p className="mt-0.5 text-indigo-600/80 dark:text-indigo-400/80 text-xs">{body}</p>}
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          className="mt-2 rounded-md bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 transition-colors"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
