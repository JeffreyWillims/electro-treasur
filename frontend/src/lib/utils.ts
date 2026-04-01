/**
 * clsx + tailwind-merge utility for conditional class merging.
 * Prevents Tailwind class conflicts (e.g. `p-4` vs `p-2`).
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
