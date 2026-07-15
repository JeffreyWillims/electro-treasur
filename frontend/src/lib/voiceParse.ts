// frontend/src/lib/voiceParse.ts
// Разбор фразы голосового ввода: «15000 зарплата» → сумма 15000 + категория «Зарплата».
// Чистая функция без DOM — чтобы логику можно было проверять отдельно от компонента.
import type { CategoryRead } from '@/types';
import { getRussianCategoryName } from '@/lib/categories';

export interface VoiceParse {
  /** Сумма строкой с группировкой разрядов («15 000»), null — не расслышали. */
  amount: string | null;
  /** Найденная категория пользователя, null — совпадений нет. */
  category: CategoryRead | null;
  /** Текст для поля «Категория», когда точного совпадения нет. */
  categoryQuery: string;
  /** Остаток фразы для поля «Детали» (то, что не сумма и не категория). */
  details: string;
}

// Слова-паразиты, которые не несут смысла ни для категории, ни для деталей.
const NOISE_WORDS = new Set([
  'рублей', 'рубля', 'рубль', 'руб', 'р', '₽', 'копеек',
  'на', 'за', 'в', 'по', 'и', 'потратил', 'потратила', 'получил', 'получила',
]);

const THOUSAND_RE = /^(тысяч[аи]?|тыс\.?|к|k)$/i;

// Народные названия → подстроки имён категорий (русских или исходных).
// Покрывают дефолтные категории; свои категории матчатся напрямую по имени.
const SYNONYMS: Record<string, string[]> = {
  зарплата: ['зарплата', 'доход', 'поступления', 'income'],
  аванс: ['зарплата', 'доход', 'поступления', 'income'],
  премия: ['зарплата', 'доход', 'поступления', 'income'],
  получка: ['зарплата', 'доход', 'поступления', 'income'],
  фриланс: ['доход', 'поступления', 'income'],
  еда: ['продукты', 'food'],
  магазин: ['продукты', 'покупки', 'shopping'],
  коммуналка: ['жкх', 'базовые', 'utility'],
  квартплата: ['жкх', 'базовые', 'жилье', 'housing'],
  такси: ['транспорт', 'transport'],
  аптека: ['здоровье', 'health'],
  врач: ['здоровье', 'health'],
};

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

// Грубый «стемминг»: отрезаем окончание, чтобы «зарплату» совпала с «зарплата».
const stem = (w: string) => (w.length >= 6 ? w.slice(0, -2) : w.length >= 5 ? w.slice(0, -1) : w);

const wordsAlike = (a: string, b: string) =>
  a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(stem(b)) || b.startsWith(stem(a))));

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const groupDigits = (n: number) => {
  const [int, frac] = String(n).split('.');
  const grouped = (int ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return frac ? `${grouped}.${frac.slice(0, 2)}` : grouped;
};

/** Значимые слова из имени категории (русского и исходного). */
function categoryWords(cat: CategoryRead): string[] {
  const source = `${getRussianCategoryName(cat.name)} ${cat.name}`;
  return norm(source)
    .split(/[^a-zа-я0-9]+/)
    .filter((w) => w.length >= 3);
}

function findCategory(words: string[], categories: CategoryRead[]) {
  let best: { cat: CategoryRead; score: number; matched: Set<string> } | null = null;
  for (const cat of categories) {
    const names = categoryWords(cat);
    let score = 0;
    const matched = new Set<string>();
    for (const w of words) {
      // Прямое совпадение с именем категории либо через словарь синонимов.
      const direct = names.some((n) => wordsAlike(w, n));
      const viaSynonym = (SYNONYMS[w] ?? SYNONYMS[stem(w)] ?? []).some((s) =>
        names.some((n) => n.includes(s)),
      );
      if (direct || viaSynonym) {
        score += direct ? 2 : 1;
        matched.add(w);
      }
    }
    if (score > 0 && (!best || score > best.score)) best = { cat, score, matched };
  }
  return best;
}

export function parseVoiceInput(text: string, categories: CategoryRead[]): VoiceParse {
  const tokens = norm(text).split(/\s+/).filter(Boolean);

  let amount: number | null = null;
  const restWords: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = (tokens[i] ?? '').replace(',', '.');
    const numMatch = t.match(/^(\d+(?:\.\d+)?)(к|k)?$/);
    if (amount === null && numMatch?.[1]) {
      amount = parseFloat(numMatch[1]);
      // «15 000» распознаётся двумя токенами — склеиваем группы по три цифры.
      let next = tokens[i + 1];
      while (!numMatch[2] && next && /^\d{3}$/.test(next)) {
        amount = amount * 1000 + parseInt(next, 10);
        i++;
        next = tokens[i + 1];
      }
      if (numMatch[2]) amount *= 1000;
      // «15 тысяч» → множитель следующим словом.
      if (next && THOUSAND_RE.test(next)) {
        amount *= 1000;
        i++;
      }
      continue;
    }
    if (!NOISE_WORDS.has(t)) restWords.push(t);
  }

  const found = findCategory(restWords, categories);
  const leftover = found ? restWords.filter((w) => !found.matched.has(w)) : restWords;

  return {
    amount: amount !== null && amount > 0 ? groupDigits(amount) : null,
    category: found?.cat ?? null,
    categoryQuery: found ? '' : capitalize(restWords.join(' ')),
    details: found ? capitalize(leftover.join(' ')) : '',
  };
}
