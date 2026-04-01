/**
 * Reusable Card component — glassmorphism-inspired surface.
 */
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-surface-border bg-white/80 backdrop-blur-sm p-6 shadow-card hover:shadow-elevated transition-shadow duration-300',
        className,
      )}
    >
      {children}
    </div>
  );
}
