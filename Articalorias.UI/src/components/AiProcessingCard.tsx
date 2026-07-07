import { useTranslation } from 'react-i18next';

interface AiProcessingCardProps {
  /**
   * Controls the displayed copy:
   * - 'analyzing': shows primary text + subtitle
   * - 'preparing': shows primary text only
   * @default 'analyzing'
   */
  phase?: 'analyzing' | 'preparing';
  /**
   * Selects domain-specific copy for the analyzing phase.
   * - 'food' (default): food/nutrition-focused message
   * - 'activity': activity/duration-focused message
   * @default 'food'
   */
  context?: 'food' | 'activity';
  /** Additional Tailwind classes applied to the card wrapper. */
  className?: string;
}

export default function AiProcessingCard({
  phase = 'analyzing',
  context = 'food',
  className = '',
}: AiProcessingCardProps) {
  const { t } = useTranslation();

  const statusText =
    phase === 'preparing'
      ? t('dashboard.ai_processing.preparing')
      : context === 'activity'
        ? t('dashboard.ai_processing.analyzing_activity')
        : t('dashboard.ai_processing.analyzing');

  const subtitleText =
    context === 'activity'
      ? t('dashboard.ai_processing.subtitle_activity')
      : t('dashboard.ai_processing.subtitle');

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`rounded-xl border border-border bg-surface p-4 ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg-primary">{statusText}</p>
          {phase === 'analyzing' && (
            <p className="mt-0.5 text-xs text-fg-secondary">
              {subtitleText}
            </p>
          )}
        </div>
        {/* Animated dots */}
        <div className="flex items-center gap-1 shrink-0" aria-hidden="true">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-bounce motion-reduce:animate-none"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
