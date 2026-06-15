/**
 * BudgetMatrix — Premium responsive table: Category → Plan → Fact → Delta.
 * Highlights overspend (negative delta) in red.
 */
import { BUDGET_ROWS } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

// ── УНИФИЦИРОВАННЫЙ СЛОВАРЬ (Citrine Vault Standard) ───────────────────
const CATEGORY_TRANSLATIONS: Record<string, string> = {
  "Operations (Rent/Utility)": "Базовые расходы",
  "Leisure (Lifestyle)": "Лайфстайл",
  "Wellness (Health)": "Здоровье и Уход",
  "Propulsion (Income)": "Поступления",
  "Growth (Investments)": "Инвестиции",
  "Income": "Доход",
};

const getRussianCategoryName = (rawName: string) => {
  if (CATEGORY_TRANSLATIONS[rawName]) return CATEGORY_TRANSLATIONS[rawName];
  const name = rawName.toLowerCase();
  if (name.includes('leisure') || name.includes('lifestyle')) return 'Лайфстайл';
  if (name.includes('housing')) return 'Жилье';
  if (name.includes('transport') || name.includes('logistics')) return 'Транспорт';
  if (name.includes('food')) return 'Продукты';
  if (name.includes('health') || name.includes('wellness')) return 'Здоровье';
  if (name.includes('income') || name.includes('propulsion')) return 'Доход';
  if (name.includes('shopping')) return 'Покупки';
  if (name.includes('utilit') || name.includes('operation')) return 'ЖКХ и Операции';
  if (name.includes('growth') || name.includes('invest')) return 'Инвестиции';
  return rawName;
};

export function BudgetMatrix() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="bg-white/40 dark:bg-[#111111]/40 backdrop-blur-3xl border border-black/5 dark:border-white/10 rounded-[2.5rem] p-8 md:p-10 overflow-hidden shadow-2xl z-10 relative"
    >
      {/* ── Header ── */}
      <div className="mb-8 flex flex-col gap-1.5">
        <h3 className="text-xl md:text-2xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white leading-none">
          Матрица бюджета
        </h3>
        <p className="text-[11px] font-mono font-bold uppercase tracking-[0.25em] text-[#FF7A00]">
          План vs Факт
        </p>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-black/10 dark:scrollbar-thumb-white/10">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/10">
              <th className="text-left pb-4 px-2 text-[10px] font-mono font-bold text-[#1C3F35]/40 dark:text-white/40 uppercase tracking-[0.25em] whitespace-nowrap">
                Категория
              </th>
              <th className="text-right pb-4 px-2 text-[10px] font-mono font-bold text-[#1C3F35]/40 dark:text-white/40 uppercase tracking-[0.25em] whitespace-nowrap">
                План
              </th>
              <th className="text-right pb-4 px-2 text-[10px] font-mono font-bold text-[#1C3F35]/40 dark:text-white/40 uppercase tracking-[0.25em] whitespace-nowrap">
                Факт
              </th>
              <th className="text-right pb-4 px-2 text-[10px] font-mono font-bold text-[#1C3F35]/40 dark:text-white/40 uppercase tracking-[0.25em] whitespace-nowrap">
                Дельта
              </th>
            </tr>
          </thead>
          <tbody>
            {BUDGET_ROWS.map((row, idx) => {
              const delta = parseFloat(row.delta);
              const isPositive = delta >= 0;

              return (
                <tr
                  key={row.category_id}
                  className={cn(
                    "border-b border-black/5 dark:border-white/5 transition-colors duration-300",
                    "hover:bg-black/5 dark:hover:bg-white/5",
                    idx === BUDGET_ROWS.length - 1 && "border-0"
                  )}
                >
                  {/* Category Name */}
                  <td className="py-5 px-2 text-sm font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white whitespace-nowrap">
                    {getRussianCategoryName(row.category_name)}
                  </td>

                  {/* Plan */}
                  <td className="py-5 px-2 text-right whitespace-nowrap">
                    <span className="text-lg font-sans font-black tabular-nums tracking-tighter text-[#1C3F35]/60 dark:text-white/60">
                      {parseFloat(row.planned).toLocaleString('ru-RU')}
                    </span>
                    <span className="text-[11px] font-bold opacity-50 tracking-normal ml-1.5 text-[#1C3F35]/60 dark:text-white/60">₽</span>
                  </td>

                  {/* Fact */}
                  <td className="py-5 px-2 text-right whitespace-nowrap">
                    <span className="text-lg font-sans font-black tabular-nums tracking-tighter text-[#1C3F35] dark:text-white">
                      {parseFloat(row.fact).toLocaleString('ru-RU')}
                    </span>
                    <span className="text-[11px] font-bold opacity-50 tracking-normal ml-1.5 text-[#1C3F35] dark:text-white">₽</span>
                  </td>

                  {/* Delta */}
                  <td className="py-5 px-2 text-right whitespace-nowrap">
                    <span className={cn(
                      'text-lg font-sans font-black tabular-nums tracking-tighter',
                      isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-500'
                    )}>
                      {isPositive ? '+' : ''}{delta.toLocaleString('ru-RU')}
                    </span>
                    <span className={cn(
                      "text-[11px] font-bold opacity-60 tracking-normal ml-1.5",
                      isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-500'
                    )}>₽</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}