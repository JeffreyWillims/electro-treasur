/**
 * Регрессионные тесты синхронизации рекордов Citrine Arcade.
 *
 * Стерегут именно тот баг, из-за которого новые игроки не появлялись в
 * рейтинге: отправка на сервер шла только при побитом ЛОКАЛЬНОМ рекорде,
 * поэтому у игрока с уже сохранённым результатом POST /score не уходил никогда.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// submitGameScore и queryClient мокаем — тестируем логику синка, не сеть.
vi.mock('@/api/client', () => ({
  submitGameScore: vi.fn(() => Promise.resolve({ status: 'ok' })),
}));
vi.mock('@/lib/queryClient', () => ({
  queryClient: { invalidateQueries: vi.fn(() => Promise.resolve()) },
}));

// Модуль хранит debounce-таймеры в module-scope — сбрасываем состояние на каждый тест.
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks(); // сбрасываем историю вызовов моков между тестами
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const DEBOUNCE = 4000;

describe('submitScore', () => {
  it('шлёт результат на сервер даже когда локальный рекорд НЕ побит (главный баг)', async () => {
    localStorage.setItem('cv_best_match', '500'); // уже есть высокий рекорд
    const { submitScore } = await import('@/lib/gameRecords');
    const { submitGameScore } = await import('@/api/client');

    const isNewBest = submitScore('match', 200); // ниже локального — но слать всё равно надо
    expect(isNewBest).toBe(false);

    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    expect(submitGameScore).toHaveBeenCalledWith('match', 200);
  });

  it('при новом рекорде сохраняет в localStorage, шлёт на сервер и обновляет рейтинг', async () => {
    const { submitScore } = await import('@/lib/gameRecords');
    const { submitGameScore } = await import('@/api/client');
    const { queryClient } = await import('@/lib/queryClient');

    expect(submitScore('game512', 1000)).toBe(true);
    expect(localStorage.getItem('cv_best_game512')).toBe('1000');

    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    expect(submitGameScore).toHaveBeenCalledWith('game512', 1000);
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['leaderboard'] });
  });

  it('за окно debounce копит МАКСИМУМ и шлёт один запрос', async () => {
    const { submitScore } = await import('@/lib/gameRecords');
    const { submitGameScore } = await import('@/api/client');

    submitScore('piggy', 100);
    submitScore('piggy', 30); // партия закончилась хуже пика — не должна затереть 100

    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    expect(submitGameScore).toHaveBeenCalledTimes(1);
    expect(submitGameScore).toHaveBeenCalledWith('piggy', 100);
  });
});

describe('syncLocalRecords', () => {
  it('отправляет непустые рекорды из localStorage и обновляет рейтинг', async () => {
    localStorage.setItem('cv_best_match', '150');
    localStorage.setItem('cv_best_piggy', '80');
    // cv_best_game512 отсутствует → 0 → не отправляем.

    const { syncLocalRecords } = await import('@/lib/gameRecords');
    const { submitGameScore } = await import('@/api/client');
    const { queryClient } = await import('@/lib/queryClient');

    await syncLocalRecords();

    expect(submitGameScore).toHaveBeenCalledTimes(2);
    expect(submitGameScore).toHaveBeenCalledWith('match', 150);
    expect(submitGameScore).toHaveBeenCalledWith('piggy', 80);
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['leaderboard'] });
  });

  it('переотправляет при каждом вызове (идемпотентно, страховка от потерь)', async () => {
    localStorage.setItem('cv_best_match', '150');
    const { syncLocalRecords } = await import('@/lib/gameRecords');
    const { submitGameScore } = await import('@/api/client');

    await syncLocalRecords();
    await syncLocalRecords();

    expect(submitGameScore).toHaveBeenCalledTimes(2);
  });
});

describe('resetGameRecordsForUser', () => {
  it('чистит локальные рекорды при смене пользователя', async () => {
    localStorage.setItem('cv_best_match', '1170');
    localStorage.setItem('cv_best_game512', '3526');
    localStorage.setItem('cv_best_user', '1'); // прошлый пользователь
    const { resetGameRecordsForUser, getBest } = await import('@/lib/gameRecords');

    resetGameRecordsForUser(2); // залогинился другой пользователь

    expect(getBest('match')).toBe(0);
    expect(getBest('game512')).toBe(0);
    expect(localStorage.getItem('cv_best_user')).toBe('2');
  });

  it('сохраняет рекорды, если пользователь тот же', async () => {
    localStorage.setItem('cv_best_match', '1170');
    localStorage.setItem('cv_best_user', '7');
    const { resetGameRecordsForUser, getBest } = await import('@/lib/gameRecords');

    resetGameRecordsForUser(7); // тот же пользователь

    expect(getBest('match')).toBe(1170);
  });
});

describe('flushPendingSync', () => {
  it('немедленно шлёт накопленное через keepalive при уходе со страницы', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true } as Response));
    vi.stubGlobal('fetch', fetchMock);

    const { submitScore, flushPendingSync } = await import('@/lib/gameRecords');
    submitScore('match', 300); // ставит рекорд в очередь дебаунса
    flushPendingSync(); // имитируем pagehide до срабатывания таймера

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/games/score',
      expect.objectContaining({ keepalive: true, method: 'POST' }),
    );
    vi.unstubAllGlobals();
  });
});
