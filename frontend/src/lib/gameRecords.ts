/**
 * Рекорды игр Citrine Arcade — localStorage, без бэкенда.
 */

export type GameKey = 'match' | 'game512' | 'snake';

const STORAGE_PREFIX = 'cv_best_';

export function getBest(game: GameKey): number {
  try {
    return Number(localStorage.getItem(STORAGE_PREFIX + game)) || 0;
  } catch {
    return 0;
  }
}

/** Возвращает true, если установлен новый рекорд. */
export function submitScore(game: GameKey, score: number): boolean {
  const best = getBest(game);
  if (score > best) {
    try {
      localStorage.setItem(STORAGE_PREFIX + game, String(score));
    } catch {
      /* приватный режим — рекорд просто не сохранится */
    }
    return true;
  }
  return false;
}
