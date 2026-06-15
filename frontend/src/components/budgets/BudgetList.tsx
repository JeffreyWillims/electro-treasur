import { BudgetEnvelopes } from '@/components/dashboard/BudgetEnvelopes';
import { SafeToSpend } from '@/components/dashboard/SafeToSpend';
import { motion } from 'framer-motion';

export function BudgetList() {
  const currentMonth = new Date().toLocaleString('ru-RU', { month: 'long' });
  const capitalizedMonth = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="flex flex-col gap-10 w-full mt-4 pb-24"
    >
      {/* ── ЗАГОЛОВОК СТРАНИЦЫ ── */}
      <div className="mb-2">
        <h1 className="text-3xl md:text-4xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white leading-none">
          Бюджеты
        </h1>
      </div>

      {/* ── БЛОК БЕЗОПАСНЫХ ТРАТ ── */}
      <div className="w-full">
        <SafeToSpend />
      </div>

      {/* ── СПИСОК КОНВЕРТОВ ── */}
      <div className="w-full">
        <div className="mb-6 flex flex-col gap-1.5">
          <h2 className="text-xl md:text-2xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white leading-none">
            Конверты на {capitalizedMonth}
          </h2>
          {/* ИЗМЕНЕНО: Шрифт, размер, цвет и свечение как в QuickEntry ("Быстрое добавление") */}
          <p className="text-[11px] md:text-[12px] font-sans font-extrabold uppercase tracking-wide text-[#FF7A00] dark:drop-shadow-[0_0_8px_rgba(255,122,0,0.5)]">
            Актуальные лимиты и перерасходы
          </p>
        </div>

        <BudgetEnvelopes />
      </div>
    </motion.div>
  );
}