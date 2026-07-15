/**
 * Утилита clsx + tailwind-merge для условного объединения классов.
 * Предотвращает конфликты Tailwind-классов (например `p-4` против `p-2`).
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
