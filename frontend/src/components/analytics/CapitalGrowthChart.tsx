/* eslint-disable */
/**
 * CapitalGrowthChart.tsx — "Capital Growth" Data Story (California Hill)
 *
 * Architecture: DUMB COMPONENT. Receives pre-aggregated daily flows.
 * Calculates cumulative capital trajectory (income − expense) over time.
 *
 * Visual: Monotone AreaChart with emerald gradient fill — the "Hill" effect.
 * Aesthetic: California Organic Luxury.
 */
import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { motion } from 'framer-motion';
import { Mountain } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────
interface DailyFlow {
  day: number;
  income: number;
  expense: number;
}

interface CapitalGrowthChartProps {
  dailyFlows: DailyFlow[];
}

// ── Custom Tooltip ─────────────────────────────────────────────────────
const GrowthTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const val = payload[0]?.value ?? 0;
    const isPositive = val >= 0;
    return (
      <div className="bg-white/95 dark:bg-[#1A1A1A]/95 backdrop-blur-2xl border border-[#1C3F35]/10 dark:border-white/10 px-5 py-4 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
        <p className="text-[10px] font-mono text-[#1C3F35]/50 dark:text-white/40 mb-1.5 uppercase font-bold tracking-widest">
          День {label}
        </p>
        <p className={`text-xl font-serif font-bold tracking-tight ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}>
          {isPositive ? '+' : ''}{val.toLocaleString('ru-RU')}
          <span className="text-xs text-[#C5A059] ml-1">₽</span>
        </p>
      </div>
    );
  }
  return null;
};

// ── Component ──────────────────────────────────────────────────────────
export function CapitalGrowthChart({ dailyFlows }: CapitalGrowthChartProps) {
  // ── Cumulative Capital Trajectory ────────────────────────────────────
  const capitalData = useMemo(() => {
    let cumulative = 0;
    return dailyFlows.map(d => {
      cumulative += (d.income - d.expense);
      return {
        day: d.day,
        capital: Math.round(cumulative * 100) / 100,
      };
    });
  }, [dailyFlows]);

  const finalCapital = capitalData.length
    ? (capitalData[capitalData.length - 1]?.capital ?? 0)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="bg-white/60 dark:bg-[#0A0A0A]/80 backdrop-blur-3xl border border-[#1C3F35]/[0.06] dark:border-white/[0.04] rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.6)] hover:shadow-[0_16px_50px_rgba(0,0,0,0.07)] dark:hover:shadow-[0_16px_50px_rgba(0,0,0,0.8)] transition-all duration-700"
    >
      {/* ── Header + Insight ──────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-serif font-bold text-[#1C3F35] dark:text-white tracking-tight leading-none">
              Траектория накоплений
            </h3>
            <p className="text-[10px] font-mono text-[#C5A059]/70 dark:text-[#C5A059]/50 uppercase tracking-[0.2em] mt-1.5 font-bold">
              Capital Growth
            </p>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/50 dark:border-emerald-500/20 px-4 py-2 rounded-xl">
            <Mountain className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className={`text-sm font-bold tracking-tight ${
              finalCapital >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-orange-600 dark:text-orange-400'
            }`}>
              {finalCapital >= 0 ? '+' : ''}{finalCapital.toLocaleString('ru-RU')} ₽
            </span>
          </div>
        </div>

        <p className="text-sm text-[#1C3F35]/50 dark:text-white/40 mt-4 font-medium leading-relaxed">
          Траектория роста вашего капитала за выбранный период
        </p>
      </div>

      {/* ── Chart ─────────────────────────────────────────────────────── */}
      <div className="h-[300px] w-full">
        {capitalData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[#1C3F35]/30 dark:text-white/20 font-serif italic text-sm">
            Нет данных для траектории
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={capitalData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} style={{ outline: 'none' }}>
              <defs>
                <linearGradient id="capitalGrowthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="50%" stopColor="#10b981" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="rgba(28, 63, 53, 0.05)"
              />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.35 }}
                tickMargin={12}
                style={{ fontFamily: 'ui-monospace, monospace' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.35 }}
                tickFormatter={(v) => {
                  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
                  return `${v}`;
                }}
                tickMargin={8}
                style={{ fontFamily: 'ui-monospace, monospace' }}
              />
              <Tooltip
                content={<GrowthTooltip />}
                cursor={{ stroke: 'rgba(16, 185, 129, 0.15)', strokeWidth: 1 }}
                isAnimationActive={false}
                wrapperStyle={{ outline: 'none' }}
              />
              <Area
                type="monotone"
                dataKey="capital"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#capitalGrowthGradient)"
                animationDuration={1500}
                animationEasing="ease-in-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}
