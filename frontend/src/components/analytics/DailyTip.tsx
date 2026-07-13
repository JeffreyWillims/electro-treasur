/**
 * DailyTip — «Совет дня» в Аналитике: детерминированная подсказка по норме
 * сбережений текущего месяца, ротация по дню года (без LLM). Переехал сюда
 * с главного дашборда — советы живут рядом с остальной аналитикой.
 */
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Lightbulb } from 'lucide-react';
import { fetchDashboard } from '@/api/client';
import { getLocalDateString, getMoscowDate } from '@/lib/dateUtils';

const DAILY_TIPS: Record<'strong' | 'mid' | 'low', string[]> = {
  strong: [
    'Вы сберегаете больше 20% дохода — отличный уровень. Проверьте, работают ли эти деньги на вас.',
    'Отличный запас прочности. Свободные деньги любят цели — загляните в «Горизонт капитала».',
    'Сбережения растут — самое время автоматизировать: сначала платите себе.',
  ],
  mid: [
    'Каждый отложенный рубль — кирпич в фундамент вашей свободы. Начните с 10% дохода.',
    'Правило суток: перед незапланированной покупкой возьмите паузу до завтра. Работает безотказно.',
    'Маленькие траты съедают большие мечты. Проверьте подписки — там часто прячется лишнее.',
  ],
  low: [
    'Минус — это сигнал, а не приговор. Начните с конвертов в «Бюджетах»: что видно, то под контролем.',
    'Расходы обгоняют доход. Найдите три самые прожорливые категории в структуре расходов.',
    'Для начала фиксируйте траты неделю, а затем решите, какие из них действительно ваши, а какие — по привычке.',
  ],
};

function dayOfYear(): number {
  const now = new Date();
  return Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000);
}

export function DailyTip() {
  const d = getMoscowDate();
  const start = getLocalDateString(new Date(d.getFullYear(), d.getMonth(), 1));
  const end = getLocalDateString(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  const { data } = useQuery({
    queryKey: ['dashboard', start, end],
    queryFn: () => fetchDashboard(start, end),
  });

  if (!data) return null;

  const income = parseFloat(data.period_income) || 0;
  const expense = parseFloat(data.period_expense) || 0;
  const free = income - expense;
  const savingsRate = income > 0 ? free / income : 0;

  const tipPool =
    savingsRate >= 0.2 ? DAILY_TIPS.strong : savingsRate >= 0 ? DAILY_TIPS.mid : DAILY_TIPS.low;
  const tip = tipPool[dayOfYear() % tipPool.length]!;

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
          <p className="text-sm md:text-base font-medium text-[#1C3F35]/75 dark:text-white/70 leading-relaxed mt-2">
            {tip}
          </p>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-white/40 mt-4">
            Свободно в этом месяце:{' '}
            <span className={free >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}>
              {Math.round(free).toLocaleString('ru-RU')} ₽
            </span>
          </p>
        </div>
      </div>
    </motion.section>
  );
}
