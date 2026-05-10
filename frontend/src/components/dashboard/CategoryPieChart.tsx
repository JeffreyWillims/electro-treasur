/* eslint-disable */
/**
 * CategoryPieChart.tsx — "The Money Eater" Data Story
 *
 * Architecture: DUMB COMPONENT. Zero internal fetching.
 * Receives pre-aggregated category totals from parent Data Cortex.
 *
 * Visual: Thin ring donut chart with central insight showing
 * the hungriest budget category and its percentage.
 * Aesthetic: California Organic Luxury.
 */
import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ──────────────────────────────────────────────────────────────
interface CategoryTotal {
  name: string;
  value: number;
  categoryId: number;
  type?: string;
}

interface CategoryPieChartProps {
  categoryTotals: CategoryTotal[];
}

// ── Palette ────────────────────────────────────────────────────────────
const RING_COLORS = [
  '#1C3F35',  // pine
  '#FF7A00',  // citrine
  '#C5A059',  // gold
  '#2A6041',  // emerald
  '#D4B46E',  // gold-light
  '#8B5E3C',  // warm earth
  '#3A7A57',  // mint-pine
  '#A0522D',  // sienna
];



// ── Component ──────────────────────────────────────────────────────────
export function CategoryPieChart({ categoryTotals }: CategoryPieChartProps) {
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  // ── Central Insight: The Money Eater ─────────────────────────────────
  const eaterInsight = useMemo(() => {
    if (!categoryTotals.length) return null;

    const total = categoryTotals.reduce((s, c) => s + c.value, 0);
    const top = categoryTotals[0];
    if (!top) return null;
    const pct = total > 0 ? Math.round((top.value / total) * 100) : 0;

    return {
      name: top.name,
      pct,
      amount: top.value,
    };
  }, [categoryTotals]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="bg-white/60 dark:bg-[#0A0A0A]/80 backdrop-blur-3xl border border-[#1C3F35]/[0.06] dark:border-white/[0.04] rounded-[2.5rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.6)] hover:shadow-[0_16px_50px_rgba(0,0,0,0.07)] dark:hover:shadow-[0_16px_50px_rgba(0,0,0,0.8)] transition-all duration-700 relative overflow-hidden"
    >
      {/* Decorative radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] rounded-full opacity-[0.04] bg-[radial-gradient(circle,_#C5A059_0%,_transparent_70%)] pointer-events-none" />

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="mb-6 relative z-10">
        <div>
          <h3 className="text-2xl font-serif font-bold text-[#1C3F35] dark:text-white tracking-tight leading-none mb-1.5">Главный поглотитель бюджета</h3>
          <p className="text-xs font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold">Структура расходов</p>
        </div>
      </div>

      {/* ── Ring Chart with Central Insight ────────────────────────────── */}
      <div className="relative h-[320px] w-full z-10">
        {categoryTotals.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[#1C3F35]/30 dark:text-white/20 font-serif italic text-sm">
            Нет данных для анализа структуры
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart style={{ outline: 'none' }}>
                <Pie
                  data={categoryTotals}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="transparent"
                  animationDuration={1200}
                  animationEasing="ease-in-out"
                  onMouseEnter={(_, index) => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {categoryTotals.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={RING_COLORS[index % RING_COLORS.length]}
                      className="outline-none"
                      style={{
                        transition: 'opacity 0.25s ease',
                        opacity: hoveredIndex !== null && hoveredIndex !== index ? 0.3 : 1,
                      }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* ── Interactive Core (Apple Fitness Style) ─────────────────── */}
            {eaterInsight && (() => {
              const active = hoveredIndex !== null ? categoryTotals[hoveredIndex] : null;
              const total = categoryTotals.reduce((s, c) => s + c.value, 0);
              const displayPct = active
                ? (total > 0 ? Math.round((active.value / total) * 100) : 0)
                : eaterInsight.pct;
              const displayName = active ? active.name : eaterInsight.name;
              const displayAmount = active ? active.value : eaterInsight.amount;
              return (
                <motion.div
                  key={hoveredIndex ?? 'default'}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0"
                >
                  <p className="text-4xl font-black tabular-nums tracking-tighter text-[#1C3F35] dark:text-emerald-50 leading-none">
                    {displayPct}%
                  </p>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-2 max-w-[120px] text-center leading-tight">
                    {displayName}
                  </p>
                  <p className="text-[10px] font-mono font-bold text-[#C5A059] mt-1">
                    {displayAmount.toLocaleString('ru-RU')} ₽
                  </p>
                </motion.div>
              );
            })()}

          </>
        )}
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────── */}
      <div className="mt-4 pt-4 border-t border-[#1C3F35]/[0.06] dark:border-white/[0.04] relative z-10">
        <ul className="grid grid-cols-2 lg:grid-cols-3 gap-y-3 gap-x-6">
          {categoryTotals.slice(0, 6).map((entry, index) => (
            <li key={`legend-${index}`} className="flex items-center gap-2 group/legend cursor-default">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: RING_COLORS[index % RING_COLORS.length] }}
              />
              <span className="text-xs font-semibold text-[#1C3F35]/70 dark:text-white/60 truncate group-hover/legend:text-[#1C3F35] dark:group-hover/legend:text-white transition-colors">
                {entry.name}
              </span>
            </li>
          ))}
          {categoryTotals.length > 6 && (
            <li className="relative flex items-center">
              <button
                onClick={() => setIsLegendOpen(!isLegendOpen)}
                className="flex items-center gap-2 px-3 py-1 bg-[#C5A059]/10 hover:bg-[#C5A059]/20 rounded-full transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-[#C5A059]/50" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#C5A059] dark:text-[#C5A059]/80">
                  +{categoryTotals.length - 6} ещё
                </span>
              </button>
              <AnimatePresence>
                {isLegendOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsLegendOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-[120%] right-0 w-48 p-4 bg-white/95 dark:bg-[#121212]/95 backdrop-blur-2xl border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-50"
                    >
                      <ul className="space-y-3">
                        {categoryTotals.slice(6).map((entry, index) => (
                          <li key={`popover-${index}`} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 truncate">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                              <span className="text-xs font-semibold text-slate-700 dark:text-white/70 truncate">{entry.name}</span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 shrink-0">{entry.value.toLocaleString('ru-RU')} ₽</span>
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </li>
          )}
        </ul>
      </div>
    </motion.div>
  );
}
