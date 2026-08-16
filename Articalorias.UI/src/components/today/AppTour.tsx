import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { useHaptics } from '@/hooks/useHaptics';
import { cn } from '@/utils/cn';

interface TourStep {
  /** data-tour anchor to spotlight; null centers the card (no spotlight) */
  target: string | null;
  title: string;
  body: string;
}

interface AppTourProps {
  /** Called once, on finish or skip alike */
  onDone: () => void;
}

interface SpotRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const SPOT_PADDING = 8;

/**
 * First-run spotlight tour: five short stops over the real screen, so the
 * user learns the app on the app, not on illustrations. Skippable from every
 * step, under a minute end to end, shown exactly once per account.
 */
export function AppTour({ onDone }: AppTourProps) {
  const { t } = useTranslation();
  const haptics = useHaptics();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<SpotRect | null>(null);

  const steps = useMemo<TourStep[]>(
    () => [
      {
        target: 'ring',
        title: t('tour.ring_title', 'Your day in one ring'),
        body: t('tour.ring_body', 'The big number is what you can still eat today. Tap the ring any time for the full math behind it.'),
      },
      {
        target: 'log',
        title: t('tour.log_title', 'Log in plain words'),
        body: t('tour.log_body', 'Tap Log and type "2 eggs and coffee with milk". The AI fills in calories and macros. Photos and barcodes work too.'),
      },
      {
        target: 'lists',
        title: t('tour.lists_title', 'Meals and activities'),
        body: t('tour.lists_body', 'Switch between what you ate and what you burned. Moving raises your budget for the day.'),
      },
      {
        target: 'tab-templates',
        title: t('tour.templates_title', 'Save your repeat meals'),
        body: t('tour.templates_body', 'Anything you eat often becomes a template: log it again with one tap, or let it add itself every day.'),
      },
      {
        target: 'tab-progress',
        title: t('tour.progress_title', 'Weeks beat perfect days'),
        body: t('tour.progress_body', 'Progress shows your week and every past day. You can open any old day to review or fix it.'),
      },
    ],
    [t],
  );

  const step = steps[index];
  const isLast = index === steps.length - 1;

  // Measure the current target. Re-measured on resize/scroll so the hole
  // follows the element; a missing target simply centers the card.
  const measure = useCallback(() => {
    if (!step.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({
      top: r.top - SPOT_PADDING,
      left: r.left - SPOT_PADDING,
      width: r.width + SPOT_PADDING * 2,
      height: r.height + SPOT_PADDING * 2,
    });
  }, [step.target]);

  /* eslint-disable react-hooks/set-state-in-effect -- measuring a DOM target
     and storing its rect IS the external-system sync this effect exists for;
     it settles in one extra render per step change. */
  useLayoutEffect(() => {
    // Bring in-page targets into view first, then measure where they landed.
    const el = step.target
      ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
      : null;
    if (el) {
      const r = el.getBoundingClientRect();
      const fixed = ['log', 'tab-templates', 'tab-progress'].includes(step.target ?? '');
      if (!fixed && (r.top < 80 || r.bottom > window.innerHeight - 200)) {
        window.scrollTo({ top: window.scrollY + r.top - 120, behavior: 'auto' });
      }
    }
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure, step.target]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // The tour is modal: freeze the page behind it.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const next = () => {
    haptics.tap();
    if (isLast) {
      onDone();
      return;
    }
    setIndex((i) => i + 1);
  };

  // Card below the spotlight when the target sits in the top half, above when
  // it sits in the bottom half (fab, tab bar), centered when there is none.
  const cardBelow = rect !== null && rect.top + rect.height / 2 < window.innerHeight / 2;
  const cardStyle: React.CSSProperties =
    rect === null
      ? { top: '50%', transform: 'translateY(-50%)' }
      : cardBelow
        ? { top: Math.min(rect.top + rect.height + 14, window.innerHeight - 260) }
        : { bottom: Math.max(window.innerHeight - rect.top + 14, 96) };

  return createPortal(
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={t('tour.aria', 'App tour')}>
      {/* Spotlight: one rounded hole punched by an oversized shadow. */}
      {rect ? (
        <div
          aria-hidden="true"
          className="absolute rounded-2xl transition-all duration-300 ease-out pointer-events-none"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            boxShadow: '0 0 0 9999px var(--t-overlay)',
          }}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-overlay" />
      )}

      <div className="absolute inset-x-0 px-5 transition-all duration-300 ease-out" style={cardStyle}>
        <div className="mx-auto max-w-md rounded-card bg-card p-5 shadow-xl animate-pop">
          <p className="text-[12px] font-bold text-primary-soft-ink uppercase tracking-wide">
            {t('tour.step_counter', '{{n}} of {{total}}', { n: index + 1, total: steps.length })}
          </p>
          <h2 className="mt-1 text-[18px] font-extrabold text-ink leading-tight">{step.title}</h2>
          <p className="mt-1.5 text-[14px] text-ink-2 leading-relaxed">{step.body}</p>

          <div className="mt-4 flex items-center gap-3">
            <div className="flex items-center gap-1.5 flex-1" aria-hidden="true">
              {steps.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    i === index ? 'w-5 bg-primary' : 'w-1.5 bg-press',
                  )}
                />
              ))}
            </div>
            {!isLast && (
              <button
                type="button"
                onClick={onDone}
                className="pressable text-[13px] font-semibold text-ink-3 px-2 py-2"
              >
                {t('tour.skip', 'Skip')}
              </button>
            )}
            <Button variant="primary" size="md" onClick={next}>
              {isLast ? t('tour.done', 'Start logging') : t('tour.next', 'Next')}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
