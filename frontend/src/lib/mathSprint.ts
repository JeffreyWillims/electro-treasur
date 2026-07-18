// frontend/src/lib/mathSprint.ts
// Чистая логика «Устного счёта»: генерация примеров по уровням сложности,
// множитель комбо и очки. Без React/DOM — проверяется отдельно от компонента.

export interface Problem {
  text: string; // «124 + 58»
  answer: number; // 182
}

export const START_SECONDS = 45;
export const TIME_BONUS = 2; // +секунды за верный
export const TIME_PENALTY = 4; // −секунды за ошибку

const BASE_POINTS = [0, 10, 15, 25, 40]; // очки за верный по уровню 1..4

const ri = (rng: () => number, min: number, max: number) =>
  min + Math.floor(rng() * (max - min + 1));

const pick = <T,>(rng: () => number, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]!;

/** Уровень сложности растёт по числу решённых примеров. */
export function levelForSolved(solved: number): number {
  if (solved < 5) return 1;
  if (solved < 12) return 2;
  if (solved < 22) return 3;
  return 4;
}

/** Множитель комбо: каждые 4 верных подряд — +1, максимум ×6. */
export function comboMultiplier(streak: number): number {
  return Math.min(1 + Math.floor(streak / 4), 6);
}

/** Очки за верный ответ на данном уровне при текущем множителе. */
export function pointsFor(level: number, multiplier: number): number {
  return (BASE_POINTS[level] ?? 10) * multiplier;
}

/**
 * Пример нужного уровня. Все ответы — целые неотрицательные:
 *  1: ± двузначные
 *  2: + ± и таблица умножения
 *  3: умножение на двузначное, трёхзначные ±, деление без остатка
 *  4: проценты от круглого, многошаговое a+b×c, умножение до 12×12
 */
export function generateProblem(level: number, rng: () => number = Math.random): Problem {
  switch (level) {
    case 1: {
      if (rng() < 0.5) {
        const a = ri(rng, 10, 99);
        const b = ri(rng, 10, 99);
        return { text: `${a} + ${b}`, answer: a + b };
      }
      let a = ri(rng, 10, 99);
      let b = ri(rng, 10, 99);
      if (b > a) [a, b] = [b, a];
      return { text: `${a} − ${b}`, answer: a - b };
    }
    case 2: {
      const r = rng();
      if (r < 0.4) {
        const a = ri(rng, 10, 99);
        const b = ri(rng, 10, 99);
        return { text: `${a} + ${b}`, answer: a + b };
      }
      if (r < 0.7) {
        const a = ri(rng, 20, 99);
        const b = ri(rng, 10, a);
        return { text: `${a} − ${b}`, answer: a - b };
      }
      const a = ri(rng, 2, 9);
      const b = ri(rng, 2, 9);
      return { text: `${a} × ${b}`, answer: a * b };
    }
    case 3: {
      const r = rng();
      if (r < 0.45) {
        const a = ri(rng, 2, 9);
        const b = ri(rng, 11, 29);
        return { text: `${a} × ${b}`, answer: a * b };
      }
      if (r < 0.75) {
        const a = ri(rng, 100, 999);
        const b = ri(rng, 10, 99);
        return { text: `${a} + ${b}`, answer: a + b };
      }
      const b = ri(rng, 2, 9);
      const q = ri(rng, 2, 12);
      return { text: `${b * q} ÷ ${b}`, answer: q };
    }
    default: {
      const r = rng();
      if (r < 0.4) {
        const pct = pick(rng, [10, 20, 25, 50]);
        const base = ri(rng, 1, 20) * 10; // 10..200
        return { text: `${pct}% от ${base}`, answer: Math.round((base * pct) / 100) };
      }
      if (r < 0.7) {
        const a = ri(rng, 5, 40);
        const b = ri(rng, 2, 9);
        const c = ri(rng, 2, 9);
        return { text: `${a} + ${b}×${c}`, answer: a + b * c };
      }
      const a = ri(rng, 2, 12);
      const b = ri(rng, 2, 12);
      return { text: `${a} × ${b}`, answer: a * b };
    }
  }
}
