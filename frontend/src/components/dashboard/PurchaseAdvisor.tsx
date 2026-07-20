/**
 * PurchaseAdvisor — «Стоит ли покупать?».
 *
 * Вердикт остаётся честной арифметикой на свободных деньгах периода, но пороги
 * и аргументы зависят от психопаспорта: одна и та же сумма для копителя и для
 * гедониста значит разное. Вместо приговора одной фразой — весы: доля от
 * свободных денег наглядно и две колонки «за/против» с конкретными фактами.
 * Решение остаётся за человеком.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { ShoppingBag, ThumbsUp, ThumbsDown } from 'lucide-react';
import { fetchDashboard, fetchPsychopassport } from '@/api/client';
import { cn } from '@/lib/utils';
import {
  buildArguments,
  decideVerdict,
  ruleFor,
  VERDICT_LABEL,
  type PersonaCode,
  type Verdict,
} from '@/lib/purchaseAdvice';

const VERDICT_STYLE: Record<Verdict, { tint: string; bg: string; bar: string }> = {
  yes: {
    tint: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/25',
    bar: 'from-emerald-500 to-emerald-400',
  },
  careful: {
    tint: 'text-[#FF7A00]',
    bg: 'bg-[#FF7A00]/10 border-[#FF7A00]/25',
    bar: 'from-[#FF7A00] to-[#FFA011]',
  },
  no: {
    tint: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/25',
    bar: 'from-rose-500 to-rose-400',
  },
};

export function PurchaseAdvisor({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [priceInput, setPriceInput] = useState('');
  const [checked, setChecked] = useState<{ price: number; verdict: Verdict } | null>(null);

  const { data } = useQuery({
    queryKey: ['dashboard', startDate, endDate],
    queryFn: () => fetchDashboard(startDate, endDate),
  });

  // Психопаспорт за тот же период. Считается по требованию, поэтому доступен
  // сразу — раньше он появлялся только после месячного воркера.
  const { data: passport } = useQuery({
    queryKey: ['psychopassport', startDate, endDate],
    queryFn: () => fetchPsychopassport(startDate, endDate),
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (!data) return null;

  const income = parseFloat(data.period_income) || 0;
  const expense = parseFloat(data.period_expense) || 0;
  const free = income - expense;
  const persona = (passport?.persona_code ?? null) as PersonaCode | null;
  const rule = ruleFor(persona);

  const dayCount = data.rows[0]?.days.length || 0;
  const avgDailyExpense = dayCount > 0 ? expense / dayCount : 0;

  const check = () => {
    const price = parseFloat(priceInput.replace(',', '.'));
    if (!Number.isFinite(price) || price <= 0) return;
    setChecked({ price, verdict: decideVerdict(price, free, persona) });
  };

  const style = checked ? VERDICT_STYLE[checked.verdict] : null;
  const args = checked
    ? buildArguments({
        price: checked.price,
        free,
        income,
        expense,
        avgDailyExpense,
        persona,
        personaTitle: passport?.persona_title,
      })
    : null;
  // Доля покупки от свободных денег — ширина «откушенного» куска на весах.
  const share = checked && free > 0 ? Math.min(1, checked.price / free) : checked ? 1 : 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-[2.5rem] border border-black/5 dark:border-white/10 bg-white/40 dark:bg-[#111111]/40 backdrop-blur-3xl p-6 md:p-8 shadow-lg"
    >
      <div className="pointer-events-none absolute -top-20 -left-12 w-64 h-64 rounded-full blur-3xl bg-[#FF7A00]/10" />

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-9 h-9 rounded-xl bg-[#FF7A00]/10 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-[#FF7A00]" />
          </span>
          <h2 className="text-lg font-sans font-extrabold text-[#1C3F35] dark:text-white">
            Стоит ли покупать?
          </h2>
        </div>

        {/* Чип персоны — почему советы звучат именно так */}
        {passport && (
          <div className="inline-flex items-center gap-2.5 mb-4 pl-2.5 pr-4 py-2 rounded-2xl bg-[#1C3F35]/[0.06] dark:bg-white/5 border border-[#1C3F35]/10 dark:border-white/10">
            <span className="text-lg leading-none">{rule.emoji}</span>
            <span className="text-xs font-sans font-bold text-[#1C3F35] dark:text-white">
              {passport.persona_title}
              <span className="font-medium text-[#1C3F35]/55 dark:text-white/45"> · {rule.hint}</span>
            </span>
          </div>
        )}

        <p className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-white/40 mb-3">
          Свободно за период:{' '}
          <span className={free >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}>
            {Math.round(free).toLocaleString('ru-RU')} ₽
          </span>
        </p>

        <div className="flex gap-2">
          <input
            type="number"
            min="1"
            placeholder="Цена, ₽"
            value={priceInput}
            onChange={(e) => { setPriceInput(e.target.value); setChecked(null); }}
            onKeyDown={(e) => e.key === 'Enter' && check()}
            className="flex-1 min-w-0 h-12 px-4 rounded-2xl bg-black/5 dark:bg-black/40 border border-transparent focus:border-[#FF7A00]/50 outline-none text-lg font-sans font-black tabular-nums text-[#1C3F35] dark:text-white placeholder-[#1C3F35]/30 dark:placeholder-white/30 transition-colors"
          />
          <button
            type="button"
            onClick={check}
            className="h-12 px-5 rounded-2xl bg-gradient-to-r from-[#FF7A00] to-[#FFA011] text-white text-sm font-bold uppercase tracking-wide active:scale-95 transition-transform whitespace-nowrap"
          >
            Проверить
          </button>
        </div>

        <AnimatePresence mode="wait">
          {checked && style && args && (
            <motion.div
              key={`${checked.price}-${checked.verdict}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className={cn('mt-4 rounded-2xl border p-5', style.bg)}
            >
              <p className={cn('text-base font-sans font-extrabold', style.tint)}>
                {VERDICT_LABEL[checked.verdict]}
              </p>

              {/* Весы: сколько свободных денег «съедает» покупка */}
              {free > 0 && (
                <div className="mt-4">
                  <div className="h-3 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${share * 100}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className={cn('h-full rounded-full bg-gradient-to-r', style.bar)}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-[11px] font-mono font-bold uppercase tracking-widest text-[#1C3F35]/50 dark:text-white/40">
                    <span>
                      покупка {Math.round(checked.price).toLocaleString('ru-RU')} ₽
                    </span>
                    <span>{Math.round(share * 100)}% свободных</span>
                  </div>
                </div>
              )}

              {/* Две чаши весов вместо одного приговора */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                <div>
                  <p className="flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-2.5">
                    <ThumbsUp className="w-3.5 h-3.5" /> За
                  </p>
                  <ul className="space-y-2">
                    {args.pros.map((text, i) => (
                      <motion.li
                        key={text}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + i * 0.07 }}
                        className="flex items-start gap-2 text-xs font-medium text-[#1C3F35]/75 dark:text-white/65 leading-relaxed"
                      >
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        {text}
                      </motion.li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-widest text-rose-600 dark:text-rose-400 mb-2.5">
                    <ThumbsDown className="w-3.5 h-3.5" /> Против
                  </p>
                  <ul className="space-y-2">
                    {args.cons.map((text, i) => (
                      <motion.li
                        key={text}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + i * 0.07 }}
                        className="flex items-start gap-2 text-xs font-medium text-[#1C3F35]/75 dark:text-white/65 leading-relaxed"
                      >
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                        {text}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </div>

              <p className="mt-4 pt-3 border-t border-black/5 dark:border-white/10 text-[11px] font-medium text-[#1C3F35]/50 dark:text-white/40 leading-relaxed">
                Решение всегда за вами — это лишь взгляд на цифры со стороны.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
