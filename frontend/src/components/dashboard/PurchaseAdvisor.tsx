/**
 * PurchaseAdvisor — «Стоит ли покупать?»: вердикт — чистая математика на
 * данных дашборда (свободные деньги месяца = доход − расход), фразы —
 * курируемый набор под ситуацию. Мгновенно и без LLM.
 * Живёт на странице «Аналитика» (рядом с DailyTip и финздоровьем).
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { ShoppingBag } from 'lucide-react';
import { fetchDashboard } from '@/api/client';
import { cn } from '@/lib/utils';

type Verdict = 'yes' | 'careful' | 'no';

const VERDICTS: Record<
  Verdict,
  { label: string; tint: string; bg: string; phrases: string[] }
> = {
  yes: {
    label: 'Можно себе позволить',
    tint: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/25',
    phrases: [
      'Покупка легко умещается в свободные деньги месяца — можно порадовать себя без угрызений.',
      'Финансовая подушка не пострадает. Осознанная трата — тоже инвестиция в себя.',
      'Бюджет выдерживает эту покупку без напряжения.',
    ],
  },
  careful: {
    label: 'Осторожно',
    tint: 'text-[#FF7A00]',
    bg: 'bg-[#FF7A00]/10 border-[#FF7A00]/25',
    phrases: [
      'Покупка заберёт заметную часть свободных денег. Подождите пару дней — если желание не остынет, берите.',
      'Сумма впритык. Спросите себя: это «хочу сейчас» или «нужно давно»? Если второе — покупайте.',
      'Можно, но свободных денег почти не останется. Возможно, стоит дождаться скидки.',
    ],
  },
  no: {
    label: 'Лучше отложить',
    tint: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/25',
    phrases: [
      'Сейчас эта покупка ударит по бюджету. Лучше отложить эти деньги на цель.',
      'Свободных денег меньше, чем цена. Покупка в минус — самый короткий путь к долгам.',
      'Запишите покупку в список желаний: через месяц вы либо накопите, либо передумаете.',
    ],
  },
};

export function PurchaseAdvisor({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [priceInput, setPriceInput] = useState('');
  const [checked, setChecked] = useState<{ price: number; verdict: Verdict; phrase: string } | null>(null);

  const { data } = useQuery({
    queryKey: ['dashboard', startDate, endDate],
    queryFn: () => fetchDashboard(startDate, endDate),
  });

  if (!data) return null;

  const income = parseFloat(data.period_income) || 0;
  const expense = parseFloat(data.period_expense) || 0;
  const free = income - expense;

  const check = () => {
    const price = parseFloat(priceInput.replace(',', '.'));
    if (!Number.isFinite(price) || price <= 0) return;
    const verdict: Verdict =
      free <= 0 ? 'no' : price <= free * 0.25 ? 'yes' : price <= free ? 'careful' : 'no';
    const pool = VERDICTS[verdict].phrases;
    setChecked({ price, verdict, phrase: pool[Math.floor(price) % pool.length]! });
  };

  const v = checked ? VERDICTS[checked.verdict] : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-[2.5rem] border border-black/5 dark:border-white/10 bg-white/40 dark:bg-[#111111]/40 backdrop-blur-3xl p-6 md:p-8 shadow-lg"
    >
      <div className="pointer-events-none absolute -top-20 -left-12 w-64 h-64 rounded-full blur-3xl bg-[#FF7A00]/10" />

      <div className="relative z-10">
        {/* Проверка покупки */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="w-9 h-9 rounded-xl bg-[#FF7A00]/10 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-[#FF7A00]" />
            </span>
            <h2 className="text-lg font-sans font-extrabold text-[#1C3F35] dark:text-white">
              Стоит ли покупать?
            </h2>
          </div>

          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-white/40 mb-3">
            Свободно в этом месяце:{' '}
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
            {checked && v && (
              <motion.div
                key={`${checked.price}-${checked.verdict}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className={cn('mt-4 rounded-2xl border p-4', v.bg)}
              >
                <p className={cn('text-sm font-extrabold', v.tint)}>{v.label}</p>
                <p className="text-xs font-medium text-[#1C3F35]/70 dark:text-white/60 leading-relaxed mt-2">
                  {checked.phrase}
                </p>
                {free > 0 && (
                  <p className="text-xs text-[#1C3F35]/55 dark:text-white/45 leading-relaxed mt-3">
                    {checked.price <= free
                      ? `Это ${Math.round((checked.price / free) * 100)}% свободных денег месяца — после покупки в запасе останется ${Math.round(free - checked.price).toLocaleString('ru-RU')} ₽.`
                      : `Пока не хватает ${Math.round(checked.price - free).toLocaleString('ru-RU')} ₽. Добавьте её в список желаний — к следующему месяцу картина может измениться.`}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.section>
  );
}
