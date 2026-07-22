/**
 * Рекорды игр Citrine Arcade — localStorage + фоновая синхронизация с бэкендом
 * (рейтинг топ-100).
 *
 * Надёжность отправки держится на трёх опорах:
 *  1. Во время партии — дебаунс 4 с, чтобы серия рекордов не спамила API.
 *  2. При уходе со страницы (pagehide / вкладку свернули) — немедленный flush
 *     через keepalive-fetch: иначе результат, поставленный за секунду до
 *     закрытия вкладки, потерялся бы вместе с таймером дебаунса.
 *  3. При каждом открытии аркады — переотправка текущих рекордов из localStorage.
 *     upsert на бэкенде идемпотентен, поэтому это дешёвая страховка: даже если
 *     фоновая отправка во время партии не дошла (обрыв сети), рекорд окажется
 *     на сервере при следующем заходе.
 */

import { submitGameScore } from '@/api/client';
import { queryClient } from '@/lib/queryClient';

export type GameKey = 'match' | 'game512' | 'piggy';

const GAME_KEYS: GameKey[] = ['match', 'game512', 'piggy'];

const STORAGE_PREFIX = 'cv_best_';
const SYNC_DEBOUNCE_MS = 4000;
const SCORE_ENDPOINT = '/api/v1/games/score';

const pendingSync = new Map<GameKey, number>();
const syncTimers = new Map<GameKey, ReturnType<typeof setTimeout>>();

function invalidateLeaderboard(): void {
  // Свой результат мог войти в топ-100 — перечитываем рейтинг, иначе список
  // висит устаревшим до истечения staleTime.
  void queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
}

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
        // Ошибка сети не должна мешать игре; страховкой служит переотправка
        // при следующем открытии аркады (см. syncLocalRecords).
        submitGameScore(game, best).then(invalidateLeaderboard).catch(() => {});
      }
    }, SYNC_DEBOUNCE_MS),
  );
}

/**
 * Немедленно отправляет всё накопленное, отменяя дебаунс. Вызывается, когда
 * страница уходит: keepalive позволяет запросу пережить выгрузку вкладки,
 * а обычный fetch/таймер — нет. Экспортируется ради теста.
 */
export function flushPendingSync(): void {
  if (pendingSync.size === 0) return;
  for (const [game, score] of pendingSync) {
    const timer = syncTimers.get(game);
    if (timer) {
      clearTimeout(timer);
      syncTimers.delete(game);
    }
    try {
      void fetch(SCORE_ENDPOINT, {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game, score }),
      }).catch(() => {});
    } catch {
      /* страница выгружается — отправить уже не выйдет, молчим */
    }
  }
  pendingSync.clear();
}

// pagehide покрывает закрытие/перезагрузку вкладки и bfcache; visibilitychange
// → hidden ловит сворачивание и переключение вкладок (в т.ч. на мобильных, где
// pagehide срабатывает не всегда).
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushPendingSync);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingSync();
  });
}

export function getBest(game: GameKey): number {
  try {
    return Number(localStorage.getItem(STORAGE_PREFIX + game)) || 0;
  } catch {
    return 0;
  }
}

/**
 * Переотправляет на сервер текущие рекорды из localStorage. Зовётся при
 * открытии аркады. Идемпотентно (upsert берёт максимум), поэтому безопасно
 * гонять на каждом заходе — это и есть страховка от потерянных фоновых отправок
 * и способ подтянуть в рейтинг игроков, чей рекорд был поставлен до его появления.
 */
export async function syncLocalRecords(): Promise<void> {
  let stored: (readonly [GameKey, number])[];
  try {
    stored = GAME_KEYS.map((game) => [game, getBest(game)] as const).filter(
      ([, score]) => score > 0,
    );
  } catch {
    return; // приватный режим — синхронизировать нечего
  }
  if (stored.length === 0) return;

  const results = await Promise.allSettled(
    stored.map(([game, score]) => submitGameScore(game, score)),
  );
  // Хотя бы одна отправка дошла — обновляем рейтинг.
  if (results.some((r) => r.status === 'fulfilled')) {
    invalidateLeaderboard();
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
