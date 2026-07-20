// frontend/src/lib/purchaseAdvice.ts
// Логика советника покупок с учётом психопаспорта: вердикт остаётся честной
// арифметикой, но пороги и аргументы зависят от того, как человек тратит.
// Чистые функции без React — проверяются отдельно от интерфейса.

export type PersonaCode =
  | 'investor'
  | 'saver'
  | 'lifestyle_spender'
  | 'survivor'
  | 'balanced';

export type Verdict = 'yes' | 'careful' | 'no';

export interface PersonaRule {
  /** До какой доли свободных денег покупка считается лёгкой. */
  easyShare: number;
  /** До какой доли — «осторожно»; выше — «лучше отложить». */
  cautiousShare: number;
  emoji: string;
  /** Короткая подпись под чипом персоны в советнике. */
  hint: string;
}

/**
 * Пороги под тип трат. Одинаковые 25% для всех были несправедливы: для
 * копителя такая покупка — редкое исключение, которое он может себе позволить,
 * а для гедониста — седьмая за месяц.
 */
export const PERSONA_RULES: Record<PersonaCode, PersonaRule> = {
  saver: {
    easyShare: 0.35,
    cautiousShare: 1,
    emoji: '🏦',
    hint: 'вы стабильно откладываете — можно чуть смелее',
  },
  investor: {
    easyShare: 0.35,
    cautiousShare: 1,
    emoji: '🌱',
    hint: 'капитал работает на вас — запас прочности есть',
  },
  balanced: {
    easyShare: 0.25,
    cautiousShare: 1,
    emoji: '⚖️',
    hint: 'траты без перекосов — обычные ориентиры',
  },
  lifestyle_spender: {
    easyShare: 0.15,
    cautiousShare: 0.7,
    emoji: '🎭',
    hint: 'крупные разовые покупки — ваша зона риска',
  },
  survivor: {
    easyShare: 0.1,
    cautiousShare: 0.5,
    emoji: '🧱',
    hint: 'сейчас основное уходит на обязательное — бережём запас',
  },
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  yes: 'Можно себе позволить',
  careful: 'Стоит подумать',
  no: 'Лучше отложить',
};

export function ruleFor(persona: PersonaCode | null | undefined): PersonaRule {
  return PERSONA_RULES[persona ?? 'balanced'] ?? PERSONA_RULES.balanced;
}

export function decideVerdict(
  price: number,
  free: number,
  persona: PersonaCode | null | undefined,
): Verdict {
  if (!Number.isFinite(price) || price <= 0) return 'no';
  if (free <= 0) return 'no';
  const rule = ruleFor(persona);
  if (price <= free * rule.easyShare) return 'yes';
  if (price <= free * rule.cautiousShare) return 'careful';
  return 'no';
}

export interface AdviceContext {
  price: number;
  free: number;
  income: number;
  expense: number;
  /** Средний расход в день за период — для перевода цены в «дни жизни». */
  avgDailyExpense: number;
  persona: PersonaCode | null | undefined;
  personaTitle?: string | null;
}

export interface AdviceArguments {
  pros: string[];
  cons: string[];
}

const money = (v: number) => `${Math.round(v).toLocaleString('ru-RU')} ₽`;
const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * Аргументы «за» и «против» — вместо одной случайной фразы. Приложение не
 * запрещает покупку, а показывает обе чаши весов: решение остаётся за человеком.
 */
export function buildArguments(ctx: AdviceContext): AdviceArguments {
  const { price, free, expense, avgDailyExpense, persona, personaTitle } = ctx;
  const pros: string[] = [];
  const cons: string[] = [];
  const share = free > 0 ? price / free : Infinity;

  // ── За ──
  if (free > 0 && price <= free) {
    pros.push(`Покупка укладывается в свободные деньги — останется ${money(free - price)}`);
  }
  if (free > 0 && share <= 0.15) {
    pros.push(`Это всего ${pct(share)} свободных денег — почти незаметно для бюджета`);
  }
  if ((persona === 'saver' || persona === 'investor') && free > 0 && price <= free) {
    pros.push('Вы стабильно откладываете — разовая трата не собьёт траекторию');
  }
  if (ctx.income > 0 && ctx.income > expense) {
    pros.push(`Период закрыт в плюс: доход выше расхода на ${money(ctx.income - expense)}`);
  }
  if (pros.length === 0) {
    pros.push('Если это давняя потребность, а не импульс, — покупка может быть оправдана');
  }

  // ── Против ──
  if (free <= 0) {
    cons.push('Пока расходы обогнали доходы — покупка уводит период глубже в минус');
  } else if (price > free) {
    cons.push(`Не хватает ${money(price - free)} — покупка выйдет за пределы свободных денег`);
  } else if (share >= 0.5) {
    cons.push(`Заберёт ${pct(share)} свободных денег — запас станет заметно тоньше`);
  }

  if (persona === 'lifestyle_spender' && personaTitle) {
    cons.push(`Ваш профиль — «${personaTitle}»: крупные разовые покупки чаще всего импульсные`);
  }
  if (persona === 'survivor') {
    cons.push('Сейчас основное уходит на обязательные платежи — запас лучше поберечь');
  }
  if (avgDailyExpense > 0) {
    const days = Math.round(price / avgDailyExpense);
    if (days >= 1) cons.push(`Это примерно ${days} ${dayWord(days)} вашей обычной жизни`);
  }
  if (cons.length === 0) {
    cons.push('Возьмите паузу до завтра: если желание останется — оно точно не импульс');
  }

  return { pros, cons };
}

/** 1 день / 2 дня / 5 дней — согласование числительного. */
export function dayWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
  return 'дней';
}
