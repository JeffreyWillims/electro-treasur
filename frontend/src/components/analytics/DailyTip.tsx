/**
 * DailyTip — «Совет дня» в Аналитике.
 *
 * Подсказка собирается правилами из реальных цифр периода (см. dailyTipRules):
 * раньше это были девять захардкоженных фраз, которые ротировались по дню года
 * и никогда не ссылались на данные пользователя. Теперь у совета есть повод и
 * следующее действие. Период и цифры приходят сверху — своего запроса нет.
 */
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Lightbulb } from 'lucide-react';
import { pickDailyTip, type TipContext } from '@/lib/dailyTipRules';
import type { PersonaCode } from '@/lib/purchaseAdvice';

function dayOfYear(): number {
  const now = new Date();
  return Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000);
}

interface Props {
  income: number;
  expense: number;
  topCategory?: { name: string; amount: number } | null;
  persona?: PersonaCode | null;
}

export function DailyTip({ income, expense, topCategory = null, persona = null }: Props) {
  const ctx: TipContext = { income, expense, topCategory, persona };
  const tip = pickDailyTip(ctx, dayOfYear());
  const savingsRate = income > 0 ? (income - expense) / income : 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-[2.5rem] border border-black/5 dark:border-white/10 bg-white/40 dark:bg-[#111111]/40 backdrop-blur-3xl p-6 md:p-8 shadow-lg"
    >
      <div className="pointer-events-none absolute -top-20 -left-12 w-64 h-64 rounded-full blur-3xl bg-[#FF7A00]/10" />
      <div className="relative z-10 flex items-start gap-4">
        <span className="w-9 h-9 rounded-xl bg-[#FF7A00]/10 flex items-center justify-center shrink-0">
          <Lightbulb className="w-5 h-5 text-[#FF7A00]" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-sans font-extrabold text-[#1C3F35] dark:text-white">
            Совет дня
          </h2>

          <motion.p
            key={tip.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="text-sm md:text-base font-medium text-[#1C3F35]/75 dark:text-white/70 leading-relaxed mt-2"
          >
            {tip.text}
          </motion.p>

          <div className="flex flex-wrap items-center gap-4 mt-4">
            {tip.cta && (
              <Link
                to={tip.cta.to}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl bg-gradient-to-r from-[#FF7A00] to-[#FFA011] text-white text-xs font-bold uppercase tracking-wide hover:opacity-90 active:scale-95 transition-all"
              >
                {tip.cta.label}
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-white/40">
              Норма сбережений за период:{' '}
              <span
                className={
                  savingsRate >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                }
              >
                {Math.round(savingsRate * 100)}%
              </span>
            </p>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
