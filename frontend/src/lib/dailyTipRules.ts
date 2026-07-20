// frontend/src/lib/dailyTipRules.ts
// «Совет дня» на правилах: вместо девяти захардкоженных фраз — подсказки,
// собранные из реальных цифр периода. Тон поддерживающий: дефицит подаётся
// как поправимая ситуация, без упрёков и запретов.

import type { PersonaCode } from '@/lib/purchaseAdvice';

export interface TipContext {
  income: number;
  expense: number;
  /** Топ-категория расходов периода. */
  topCategory: { name: string; amount: number } | null;
  persona: PersonaCode | null;
}

export interface Tip {
  id: string;
  text: string;
  /** Куда вести за действием — маршрут приложения. */
  cta?: { label: string; to: string };
}

interface Rule {
  id: string;
  /** Чем выше, тем важнее: из применимых берутся самые приоритетные. */
  priority: number;
  applies: (ctx: TipContext) => boolean;
  build: (ctx: TipContext) => Tip;
}

const money = (v: number) => `${Math.round(v).toLocaleString('ru-RU')} ₽`;

const savingsRateOf = (ctx: TipContext) =>
  ctx.income > 0 ? (ctx.income - ctx.expense) / ctx.income : 0;

const shareOfExpense = (ctx: TipContext, amount: number) =>
  ctx.expense > 0 ? amount / ctx.expense : 0;

const RULES: Rule[] = [
  {
    id: 'no-data',
    priority: 100,
    applies: (ctx) => ctx.income === 0 && ctx.expense === 0,
    build: () => ({
      id: 'no-data',
      text: 'За этот период пока нет операций. Добавьте первую — и я покажу, куда уходят деньги и где есть запас.',
      cta: { label: 'Добавить операцию', to: '/' },
    }),
  },
  {
    id: 'deficit',
    priority: 90,
    applies: (ctx) => ctx.income > 0 && ctx.expense > ctx.income,
    build: (ctx) => ({
      id: 'deficit',
      // Тёплая подача: не «вы в минусе», а «разрыв, который видно и можно закрыть».
      text: `Расходы превысили доход на ${money(ctx.expense - ctx.income)}. Такое бывает — важно, что вы это видите. Загляните в бюджеты: обычно разрыв закрывают одна-две категории.`,
      cta: { label: 'Открыть бюджеты', to: '/budgets' },
    }),
  },
  {
    id: 'top-category-dominates',
    priority: 80,
    applies: (ctx) =>
      ctx.topCategory !== null && shareOfExpense(ctx, ctx.topCategory.amount) >= 0.35,
    build: (ctx) => {
      const top = ctx.topCategory!;
      const share = Math.round(shareOfExpense(ctx, top.amount) * 100);
      const saved = top.amount * 0.15;
      return {
        id: 'top-category-dominates',
        text: `Больше всего ушло в «${top.name}» — ${money(top.amount)}, это ${share}% всех трат. Урезав категорию на 15%, вы бы освободили ${money(saved)}.`,
        cta: { label: 'Посмотреть операции', to: '/transactions' },
      };
    },
  },
  {
    id: 'strong-savings',
    priority: 70,
    applies: (ctx) => savingsRateOf(ctx) >= 0.2,
    build: (ctx) => ({
      id: 'strong-savings',
      text: `Вы отложили ${money(ctx.income - ctx.expense)} — это ${Math.round(savingsRateOf(ctx) * 100)}% дохода. Отличный уровень; теперь пусть эти деньги работают, а не лежат.`,
      cta: { label: 'Горизонт капитала', to: '/savings-navigator' },
    }),
  },
  {
    id: 'thin-savings',
    priority: 60,
    applies: (ctx) => {
      const rate = savingsRateOf(ctx);
      return ctx.income > 0 && rate > 0 && rate < 0.1;
    },
    build: (ctx) => ({
      id: 'thin-savings',
      text: `В запасе осталось ${money(ctx.income - ctx.expense)} — это ${Math.round(savingsRateOf(ctx) * 100)}% дохода. Начните с малого: даже 10% дохода, отложенные в день зарплаты, за год превращаются в подушку.`,
      cta: { label: 'Поставить цель', to: '/savings-navigator' },
    }),
  },
  {
    id: 'lifestyle-persona',
    priority: 50,
    applies: (ctx) => ctx.persona === 'lifestyle_spender',
    build: () => ({
      id: 'lifestyle-persona',
      text: 'Вы умеете жить и тратить на удовольствия — это не порок. Попробуйте автоперевод 10% дохода в день зарплаты: будущему вам тоже хочется хорошего.',
      cta: { label: 'Настроить бюджеты', to: '/budgets' },
    }),
  },
  {
    id: 'steady',
    priority: 10,
    applies: () => true,
    build: (ctx) => ({
      id: 'steady',
      text: `Доход ${money(ctx.income)}, расход ${money(ctx.expense)} — курс ровный. Правило суток работает безотказно: перед незапланированной покупкой возьмите паузу до завтра.`,
    }),
  },
];

/** Все применимые советы, самые важные первыми. */
export function applicableTips(ctx: TipContext): Tip[] {
  return RULES.filter((rule) => rule.applies(ctx))
    .sort((a, b) => b.priority - a.priority)
    .map((rule) => rule.build(ctx));
}

/**
 * Совет дня: из применимых берутся три самых важных и ротируются по дню года,
 * чтобы подсказка менялась, но всегда оставалась уместной.
 */
export function pickDailyTip(ctx: TipContext, dayOfYear: number): Tip {
  const tips = applicableTips(ctx);
  const pool = tips.slice(0, 3);
  return pool[dayOfYear % pool.length]!;
}
