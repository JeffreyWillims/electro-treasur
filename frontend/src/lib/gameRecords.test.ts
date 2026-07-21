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

describe('backfillLocalRecords', () => {
  it('единожды догружает непустые рекорды из localStorage и обновляет рейтинг', async () => {
    localStorage.setItem('cv_best_match', '150');
    localStorage.setItem('cv_best_piggy', '80');
    // cv_best_game512 отсутствует → 0 → не отправляем.

    const { backfillLocalRecords } = await import('@/lib/gameRecords');
    const { submitGameScore } = await import('@/api/client');
    const { queryClient } = await import('@/lib/queryClient');

    await backfillLocalRecords();

    expect(submitGameScore).toHaveBeenCalledTimes(2);
    expect(submitGameScore).toHaveBeenCalledWith('match', 150);
    expect(submitGameScore).toHaveBeenCalledWith('piggy', 80);
    expect(localStorage.getItem('cv_best_backfilled')).toBe('1');
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['leaderboard'] });
  });

  it('повторный вызов ничего не шлёт (флаг уже стоит)', async () => {
    localStorage.setItem('cv_best_match', '150');
    const { backfillLocalRecords } = await import('@/lib/gameRecords');
    const { submitGameScore } = await import('@/api/client');

    await backfillLocalRecords();
    await backfillLocalRecords();

    expect(submitGameScore).toHaveBeenCalledTimes(1);
  });
});
