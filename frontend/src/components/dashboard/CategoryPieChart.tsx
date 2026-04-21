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
import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

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

// ── Custom Tooltip ─────────────────────────────────────────────────────
const EaterTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 dark:bg-[#1A1A1A]/95 backdrop-blur-2xl border border-[#1C3F35]/10 dark:border-white/10 px-5 py-4 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
        <p className="text-[10px] font-mono text-[#1C3F35]/50 dark:text-white/40 mb-1.5 uppercase font-bold tracking-widest">
          {payload[0].name}
        </p>
        <p className="text-xl font-serif font-bold tracking-tight text-[#1C3F35] dark:text-white">
          {payload[0].value.toLocaleString('ru-RU')}
          <span className="text-xs text-[#C5A059] ml-1">₽</span>
        </p>
      </div>
    );
  }
  return null;
};

// ── Component ──────────────────────────────────────────────────────────
export function CategoryPieChart({ categoryTotals }: CategoryPieChartProps) {
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
      className="bg-white/60 dark:bg-[#0A0A0A]/80 backdrop-blur-3xl border border-[#1C3F35]/[0.06] dark:border-white/[0.04] rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.6)] hover:shadow-[0_16px_50px_rgba(0,0,0,0.07)] dark:hover:shadow-[0_16px_50px_rgba(0,0,0,0.8)] transition-all duration-700 relative overflow-hidden"
    >
      {/* Decorative radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] rounded-full opacity-[0.04] bg-[radial-gradient(circle,_#C5A059_0%,_transparent_70%)] pointer-events-none" />

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="mb-6 relative z-10">
        <h3 className="text-2xl font-serif font-bold text-[#1C3F35] dark:text-white tracking-tight leading-none">
          Главный поглотитель бюджета
        </h3>
        <p className="text-[10px] font-mono text-[#C5A059]/70 dark:text-[#C5A059]/50 uppercase tracking-[0.2em] mt-1.5 font-bold">
          The Money Eater
        </p>
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
                >
                  {categoryTotals.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={RING_COLORS[index % RING_COLORS.length]}
                      className="outline-none"
                      style={{ transition: 'opacity 0.3s ease' }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<EaterTooltip />} isAnimationActive={false} wrapperStyle={{ outline: 'none' }} />
              </PieChart>
            </ResponsiveContainer>

            {/* ── Absolute Center Insight ──────────────────────────────── */}
            {eaterInsight && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.6 }}
                className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
              >
                <p className="text-3xl font-extrabold text-[#1C3F35] dark:text-white tracking-tight leading-none">
                  {eaterInsight.pct}%
                </p>
                <p className="text-xs font-semibold text-[#1C3F35]/60 dark:text-white/50 mt-1 max-w-[100px] text-center leading-tight truncate">
                  {eaterInsight.name}
                </p>
              </motion.div>
            )}
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
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#C5A059]/20" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#C5A059]/50">
                +{categoryTotals.length - 6} ещё
              </span>
            </li>
          )}
        </ul>
      </div>
    </motion.div>
  );
}
