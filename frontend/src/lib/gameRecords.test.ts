/**
 * Регрессионные тесты рекордов Citrine Arcade.
 *
 * Стерегут два бага:
 *  1. Отправка на сервер шла только при побитом ЛОКАЛЬНОМ рекорде — игрок с уже
 *     сохранённым результатом не попадал в рейтинг.
 *  2. Рекорды хранились per-browser, поэтому новый пользователь на том же
 *     браузере наследовал чужие очки. Теперь ключи неймспейснуты по userId.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// submitGameScore и queryClient мокаем — тестируем логику, не сеть.
vi.mock('@/api/client', () => ({
  submitGameScore: vi.fn(() => Promise.resolve({ status: 'ok' })),
}));
vi.mock('@/lib/queryClient', () => ({
  queryClient: { invalidateQueries: vi.fn(() => Promise.resolve()) },
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const DEBOUNCE = 4000;

describe('submitScore', () => {
  it('шлёт результат даже когда локальный рекорд НЕ побит (главный баг)', async () => {
    const { submitScore, setGameRecordsUser } = await import('@/lib/gameRecords');
    const { submitGameScore } = await import('@/api/client');
    setGameRecordsUser('u1');
    localStorage.setItem('cv_best_u1_match', '500'); // уже есть высокий рекорд

    const isNewBest = submitScore('match', 200); // ниже локального — но слать всё равно
    expect(isNewBest).toBe(false);

    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    expect(submitGameScore).toHaveBeenCalledWith('match', 200);
  });

  it('при новом рекорде сохраняет в namespace, шлёт на сервер и обновляет рейтинг', async () => {
    const { submitScore, setGameRecordsUser } = await import('@/lib/gameRecords');
    const { submitGameScore } = await import('@/api/client');
    const { queryClient } = await import('@/lib/queryClient');
    setGameRecordsUser('u1');

    expect(submitScore('game512', 1000)).toBe(true);
    expect(localStorage.getItem('cv_best_u1_game512')).toBe('1000');

    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    expect(submitGameScore).toHaveBeenCalledWith('game512', 1000);
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['leaderboard'] });
  });

  it('за окно debounce копит МАКСИМУМ и шлёт один запрос', async () => {
    const { submitScore, setGameRecordsUser } = await import('@/lib/gameRecords');
    const { submitGameScore } = await import('@/api/client');
    setGameRecordsUser('u1');

    submitScore('piggy', 100);
    submitScore('piggy', 30); // хуже пика — не должна затереть 100

    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    expect(submitGameScore).toHaveBeenCalledTimes(1);
    expect(submitGameScore).toHaveBeenCalledWith('piggy', 100);
  });
});

describe('неймспейс по пользователю', () => {
  it('новый пользователь НЕ видит рекорды другого в том же браузере', async () => {
    const { submitScore, getBest, setGameRecordsUser } = await import('@/lib/gameRecords');

    setGameRecordsUser('1');
    submitScore('match', 1170);
    submitScore('game512', 3526);
    expect(getBest('match')).toBe(1170);

    // Тот же браузер, другой аккаунт → рекорды невидимы.
    setGameRecordsUser('2');
    expect(getBest('match')).toBe(0);
    expect(getBest('game512')).toBe(0);

    // Вернулись к первому — его рекорды на месте.
    setGameRecordsUser('1');
    expect(getBest('match')).toBe(1170);
  });

  it('syncLocalRecords без пользователя ничего не шлёт', async () => {
    const { syncLocalRecords } = await import('@/lib/gameRecords');
    const { submitGameScore } = await import('@/api/client');

    await syncLocalRecords(); // currentUserId == null

    expect(submitGameScore).not.toHaveBeenCalled();
  });
});

describe('syncLocalRecords', () => {
  it('отправляет непустые рекорды текущего пользователя и обновляет рейтинг', async () => {
    const { syncLocalRecords, setGameRecordsUser } = await import('@/lib/gameRecords');
    const { submitGameScore } = await import('@/api/client');
    const { queryClient } = await import('@/lib/queryClient');
    setGameRecordsUser('u1');
    localStorage.setItem('cv_best_u1_match', '150');
    localStorage.setItem('cv_best_u1_piggy', '80');

    await syncLocalRecords();

    expect(submitGameScore).toHaveBeenCalledTimes(2);
    expect(submitGameScore).toHaveBeenCalledWith('match', 150);
    expect(submitGameScore).toHaveBeenCalledWith('piggy', 80);
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['leaderboard'] });
  });

  it('переотправляет при каждом вызове (идемпотентно, страховка от потерь)', async () => {
    const { syncLocalRecords, setGameRecordsUser } = await import('@/lib/gameRecords');
    const { submitGameScore } = await import('@/api/client');
    setGameRecordsUser('u1');
    localStorage.setItem('cv_best_u1_match', '150');

    await syncLocalRecords();
    await syncLocalRecords();

    expect(submitGameScore).toHaveBeenCalledTimes(2);
  });
});

describe('flushPendingSync', () => {
  it('немедленно шлёт накопленное через keepalive при уходе со страницы', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true } as Response));
    vi.stubGlobal('fetch', fetchMock);

    const { submitScore, flushPendingSync, setGameRecordsUser } = await import('@/lib/gameRecords');
    setGameRecordsUser('u1');
    submitScore('match', 300); // ставит рекорд в очередь дебаунса
    flushPendingSync(); // имитируем pagehide до срабатывания таймера

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/games/score',
      expect.objectContaining({ keepalive: true, method: 'POST' }),
    );
    vi.unstubAllGlobals();
  });
});
