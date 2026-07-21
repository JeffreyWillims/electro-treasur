/**
 * Рекорды игр Citrine Arcade — localStorage + фоновая синхронизация с бэкендом
 * (рейтинг топ-100). Отправка дебаунсится, чтобы серия рекордов в одной партии
 * не спамила API.
 */

import { submitGameScore } from '@/api/client';
import { queryClient } from '@/lib/queryClient';

export type GameKey = 'match' | 'game512' | 'piggy';

const GAME_KEYS: GameKey[] = ['match', 'game512', 'piggy'];

const STORAGE_PREFIX = 'cv_best_';
const BACKFILL_FLAG = 'cv_best_backfilled';
const SYNC_DEBOUNCE_MS = 4000;

const pendingSync = new Map<GameKey, number>();
const syncTimers = new Map<GameKey, ReturnType<typeof setTimeout>>();

function queueSync(game: GameKey, score: number): void {
  // За окно дебаунса копим максимум: партия может закончиться результатом
  // ниже, чем был в её середине.
  pendingSync.set(game, Math.max(score, pendingSync.get(game) ?? 0));
  if (syncTimers.has(game)) return;
  syncTimers.set(
    game,
    setTimeout(() => {
      syncTimers.delete(game);
      const best = pendingSync.get(game);
      pendingSync.delete(game);
      if (best) {
        // Фоновая отправка: ошибка сети не должна мешать игре.
        submitGameScore(game, best)
          // Свой результат мог войти в топ-100 — перечитываем рейтинг,
          // иначе список висит устаревшим до истечения staleTime.
          .then(() => queryClient.invalidateQueries({ queryKey: ['leaderboard'] }))
          .catch(() => {});
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

/**
 * Разовая догрузка рекордов, накопленных в localStorage до появления рейтинга:
 * без неё такой игрок не попадёт в топ, пока сам не побьёт свой старый результат.
 * Флаг ставится только после успеха, поэтому обрыв сети просто отложит попытку
 * до следующего открытия аркады.
 */
export async function backfillLocalRecords(): Promise<void> {
  try {
    if (localStorage.getItem(BACKFILL_FLAG)) return;
  } catch {
    return; // приватный режим — синхронизировать нечего
  }

  const stored = GAME_KEYS.map((game) => [game, getBest(game)] as const).filter(
    ([, score]) => score > 0,
  );

  const results = await Promise.allSettled(
    stored.map(([game, score]) => submitGameScore(game, score)),
  );
  if (results.some((r) => r.status === 'rejected')) return;

  try {
    localStorage.setItem(BACKFILL_FLAG, '1');
  } catch {
    /* флаг не сохранится — в следующий раз отправим повторно, upsert не пострадает */
  }
  if (stored.length) {
    await queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
  }
}

/** Возвращает true, если установлен новый рекорд. */
export function submitScore(game: GameKey, score: number): boolean {
  const best = getBest(game);
  // Шлём всегда, а не только при локальном рекорде: у игроков, начавших до
  // появления рейтинга, лучший результат уже лежит в localStorage, и по
  // условию `score > best` он не ушёл бы на сервер никогда. Лишнее отсеет
  // upsert — он обновляет строку только при более высоком результате.
  queueSync(game, score);
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
