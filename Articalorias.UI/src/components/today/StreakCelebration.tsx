import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import { useHaptics } from '@/hooks/useHaptics';

interface StreakCelebrationProps {
  /** The new streak count being celebrated */
  streak: number;
  onDone: () => void;
}

/**
 * The moment the first food of the day lands and the streak grows: a short
 * full-screen burst. Micro-reward dopamine on the exact action we want
 * repeated, kept under 3 seconds so it never gets in the way of logging.
 *
 * Deterministic confetti (no Math.random): trajectories are derived from the
 * particle index so renders are stable and testable. Tapping anywhere skips it,
 * and prefers-reduced-motion collapses it to a simple fade (see index.css).
 */
const PARTICLE_COLORS = [
  'var(--t-streak)',
  'var(--t-primary)',
  'var(--t-success)',
  'var(--t-protein)',
];

const PARTICLES = Array.from({ length: 18 }, (_, i) => {
  // Fan the particles around the circle with alternating reach and drift so
  // the burst reads organic without randomness.
  const angle = (i / 18) * 2 * Math.PI + (i % 3) * 0.35;
  const distance = 110 + (i % 5) * 26;
  return {
    x: `${Math.round(Math.cos(angle) * distance)}px`,
    y: `${Math.round(Math.sin(angle) * distance - 40)}px`, // slight upward bias
    rotate: `${((i * 97) % 360) - 180}deg`,
    delay: `${(i % 6) * 45}ms`,
    color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
    round: i % 3 === 0,
  };
});

export function StreakCelebration({ streak, onDone }: StreakCelebrationProps) {
  const { t } = useTranslation();
  const haptics = useHaptics();

  useEffect(() => {
    haptics.success();
    const timer = setTimeout(onDone, 2600);
    return () => clearTimeout(timer);
    // Fire-once on mount: the celebration owns its own lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      onClick={onDone}
      className="fixed inset-0 z-[70] flex items-center justify-center animate-fade-in"
    >
      {/* Soft scrim so the burst reads on any screen without hiding it */}
      <div className="absolute inset-0 bg-black/25" aria-hidden="true" />

      <div className="relative flex flex-col items-center">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`confetti-piece absolute top-1/2 left-1/2 ${p.round ? 'w-2 h-2 rounded-full' : 'w-1.5 h-3 rounded-[2px]'}`}
            style={{
              backgroundColor: p.color,
              animation: `confetti-burst 1.3s cubic-bezier(0.16, 0.84, 0.44, 1) ${p.delay} both`,
              ['--cf-x' as string]: p.x,
              ['--cf-y' as string]: p.y,
              ['--cf-r' as string]: p.rotate,
            }}
          />
        ))}

        <div className="animate-streak-pop flex flex-col items-center rounded-card bg-card px-8 py-6 shadow-xl">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-streak-soft text-streak">
            <Icon name="flame" size={34} className="animate-celebrate" />
          </span>
          <p className="mt-3 text-[26px] font-extrabold text-ink leading-none tabular-nums">
            {streak === 1
              ? t('streak.celebrate_first', 'Streak started!')
              : t('streak.celebrate_day', 'Day {{n}}!', { n: streak })}
          </p>
          <p className="mt-2 text-[13px] font-semibold text-ink-2 text-center max-w-[15rem]">
            {t('streak.celebrate_sub', 'First log of the day is in. See you tomorrow to keep it burning.')}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
