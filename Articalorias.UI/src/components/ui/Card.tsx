import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * card: standard surface (slightly darker than the page, no border)
   * inset: nested well inside a card
   * soft: brand-tinted highlight card
   * premium: gold-tinted card
   */
  variant?: 'card' | 'inset' | 'soft' | 'premium';
  padded?: boolean;
  children: ReactNode;
}

/** Borderless card. Depth comes from background contrast, not strokes. */
export function Card({ variant = 'card', padded = true, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card',
        variant === 'card' && 'bg-card',
        variant === 'inset' && 'bg-inset',
        variant === 'soft' && 'bg-primary-soft',
        variant === 'premium' && 'bg-premium-soft',
        padded && 'p-4',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
