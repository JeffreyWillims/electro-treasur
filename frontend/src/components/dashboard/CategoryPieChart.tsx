import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

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

interface CategoryTotal {
  name: string;
  value: number;
  categoryId: number;
  type?: string;
  color?: string;
}

interface CategoryPieChartProps {
  categoryTotals: CategoryTotal[];
}

const RING_COLORS = [
  '#FF7A00', '#1C3F35', '#C5A059', '#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F43F5E',
];

export function CategoryPieChart({ categoryTotals }: CategoryPieChartProps) {
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const grandTotal = useMemo(
    () => categoryTotals.reduce((s, c) => s + c.value, 0),
    [categoryTotals],
  );

  return (
    <div className="bg-white/40 dark:bg-[#111111]/40 backdrop-blur-3xl border border-black/5 dark:border-white/10 rounded-[2.5rem] p-8 md:p-10 shadow-2xl transition-all duration-700 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full opacity-[0.04] bg-[radial-gradient(circle,_#FF7A00_0%,_transparent_70%)] pointer-events-none" />

      <div className="mb-6 relative z-10 flex flex-col gap-1.5">
        <h3 className="text-xl md:text-2xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white leading-none">
          Структура расходов
        </h3>
        {/* ИСПРАВЛЕНИЕ: Новый шрифт подзаголовка */}
        <p className="text-[11px] md:text-[12px] font-sans font-extrabold uppercase tracking-wide text-[#FF7A00] dark:drop-shadow-[0_0_8px_rgba(255,122,0,0.5)] mt-1">
          Главный поглотитель
        </p>
      </div>

      <div className="relative h-[320px] w-full z-10">
        {categoryTotals.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[#1C3F35]/40 dark:text-white/30 font-mono font-bold text-xs uppercase tracking-widest">
            Нет данных
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart style={{ outline: 'none' }}>
                <Pie
                  data={categoryTotals}
                  cx="50%" cy="50%"
                  innerRadius={80} outerRadius={105}
                  paddingAngle={4} dataKey="value"
                  stroke="transparent"
                  animationDuration={1200}
                  animationEasing="ease-in-out"
                  onMouseEnter={(_, index) => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  cornerRadius={8}
                >
                  {categoryTotals.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color || RING_COLORS[index % RING_COLORS.length]}
                      className="outline-none transition-all duration-300"
                      style={{
                        opacity: hoveredIndex !== null && hoveredIndex !== index ? 0.2 : 1,
                        filter: hoveredIndex === index ? `drop-shadow(0 0 12px ${entry.color || RING_COLORS[index % RING_COLORS.length]})` : 'none'
                      }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
              <AnimatePresence mode="wait">
                {hoveredIndex !== null && categoryTotals[hoveredIndex] ? (
                  <motion.div
                    key={hoveredIndex}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="flex flex-col items-center"
                  >
                    <p className="text-4xl font-sans font-black tabular-nums tracking-tighter text-[#1C3F35] dark:text-white leading-none drop-shadow-sm">
                      {grandTotal > 0
                        ? Math.round((categoryTotals[hoveredIndex].value / grandTotal) * 100)
                        : 0}
                      %
                    </p>
                    <p className="text-[13px] font-sans font-bold text-[#1C3F35]/75 dark:text-white/70 mt-2.5 max-w-[140px] text-center leading-tight px-2">
                      {getRussianCategoryName(categoryTotals[hoveredIndex].name)}
                    </p>
                    <p className="text-sm font-sans font-extrabold tabular-nums tracking-tight text-[#FF7A00] mt-1">
                      {categoryTotals[hoveredIndex].value.toLocaleString('ru-RU')} ₽
                    </p>
                  </motion.div>
                ) : (
                  /* Простой: итог месяца в центре кольца — цифра, ради которой открывают вкладку */
                  <motion.div
                    key="idle-total"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="flex flex-col items-center"
                  >
                    <p className="text-3xl font-sans font-black tabular-nums tracking-tighter text-[#1C3F35] dark:text-white leading-none">
                      {Math.round(grandTotal).toLocaleString('ru-RU')}
                      <span className="text-base font-bold opacity-50 ml-1">₽</span>
                    </p>
                    <p className="text-[11px] font-sans font-bold uppercase tracking-[0.18em] text-[#1C3F35]/45 dark:text-white/40 mt-2">
                      всего расходов
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-black/5 dark:border-white/5 relative z-10">
        {/* Легенда-рейтинг: цветной чип + имя полноценным шрифтом + сумма и доля.
            Текст — чернилами интерфейса, идентичность несёт чип (не серый петит). */}
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6">
          {categoryTotals.slice(0, 6).map((entry, index) => (
            <li
              key={`legend-${index}`}
              className={cn(
                "flex items-center gap-3 group/legend cursor-pointer px-2.5 py-2 -mx-1 rounded-xl transition-colors",
                hoveredIndex === index ? "bg-black/5 dark:bg-white/5" : "hover:bg-black/5 dark:hover:bg-white/5"
              )}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <span
                className="w-3.5 h-3.5 rounded-[5px] flex-shrink-0 shadow-sm transition-transform duration-300"
                style={{
                  backgroundColor: entry.color || RING_COLORS[index % RING_COLORS.length],
                  transform: hoveredIndex === index ? 'scale(1.25)' : 'scale(1)'
                }}
              />
              <span className="flex-1 min-w-0 text-[13px] md:text-sm font-sans font-bold truncate text-[#1C3F35] dark:text-white/90">
                {getRussianCategoryName(entry.name)}
              </span>
              <span className="text-[13px] font-sans font-extrabold tabular-nums text-[#1C3F35]/80 dark:text-white/75 shrink-0">
                {Math.round(entry.value).toLocaleString('ru-RU')} ₽
              </span>
              <span
                className="w-11 text-right text-[11px] font-sans font-black tabular-nums shrink-0"
                style={{ color: entry.color || RING_COLORS[index % RING_COLORS.length] }}
              >
                {grandTotal > 0 ? Math.round((entry.value / grandTotal) * 100) : 0}%
              </span>
            </li>
          ))}
          {categoryTotals.length > 6 && (
            <li className="relative flex items-center">
              <button
                onClick={() => setIsLegendOpen(!isLegendOpen)}
                className="flex items-center gap-2 px-4 py-1.5 bg-[#FF7A00]/10 hover:bg-[#FF7A00]/20 rounded-full transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-[#FF7A00]" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-[#FF7A00]">
                  +{categoryTotals.length - 6} ещё
                </span>
              </button>

              <AnimatePresence>
                {isLegendOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsLegendOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute bottom-[120%] right-0 w-60 p-5 bg-white/95 dark:bg-[#121212]/95 backdrop-blur-3xl border border-black/10 dark:border-white/10 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] z-50"
                    >
                      <ul className="space-y-2">
                        {categoryTotals.slice(6).map((entry, index) => {
                          const actualIndex = index + 6;
                          return (
                            <li
                              key={`popover-${index}`}
                              className={cn(
                                "flex items-center justify-between gap-3 cursor-pointer p-2 rounded-xl transition-colors",
                                hoveredIndex === actualIndex ? "bg-black/5 dark:bg-white/10" : "hover:bg-black/5 dark:hover:bg-white/5"
                              )}
                              onMouseEnter={() => setHoveredIndex(actualIndex)}
                              onMouseLeave={() => setHoveredIndex(null)}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm transition-transform duration-300"
                                  style={{
                                    backgroundColor: entry.color || RING_COLORS[actualIndex % RING_COLORS.length],
                                    transform: hoveredIndex === actualIndex ? 'scale(1.5)' : 'scale(1)'
                                  }}
                                />
                                <span className="text-xs font-bold text-[#1C3F35] dark:text-white/80 truncate">
                                  {getRussianCategoryName(entry.name)}
                                </span>
                              </div>
                              <span className="text-[11px] font-sans font-bold text-[#1C3F35]/60 dark:text-white/50 shrink-0 tabular-nums">
                                {entry.value.toLocaleString('ru-RU')} ₽
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}