/**
 * Рекорды игр Citrine Arcade — localStorage + фоновая синхронизация с бэкендом
 * (рейтинг топ-100). Отправка дебаунсится, чтобы серия рекордов в одной партии
 * не спамила API.
 */

import { submitGameScore } from '@/api/client';

export type GameKey = 'match' | 'game512' | 'piggy';

const STORAGE_PREFIX = 'cv_best_';
const SYNC_DEBOUNCE_MS = 4000;

const pendingSync = new Map<GameKey, number>();
const syncTimers = new Map<GameKey, ReturnType<typeof setTimeout>>();

function queueSync(game: GameKey, score: number): void {
  pendingSync.set(game, score);
  if (syncTimers.has(game)) return;
  syncTimers.set(
    game,
    setTimeout(() => {
      syncTimers.delete(game);
      const best = pendingSync.get(game);
      pendingSync.delete(game);
      if (best) {
        // Фоновая отправка: ошибка сети не должна мешать игре.
        submitGameScore(game, best).catch(() => {});
      }
    }, SYNC_DEBOUNCE_MS),
  );
}

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
    queueSync(game, score);
    return true;
  }
  return false;
}
