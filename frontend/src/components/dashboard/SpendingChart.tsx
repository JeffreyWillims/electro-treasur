/* eslint-disable */
/**
 * SpendingChart.tsx — "Cashflow Pulse" Data Story
 *
 * Architecture: DUMB COMPONENT. Zero internal fetching.
 * Receives pre-aggregated daily flows + totals from parent Data Cortex.
 *
 * Visual: Capsule BarChart (Income vs Expense), dynamic financial insight.
 * Aesthetic: California Organic Luxury — glass card, premium typography.
 */
import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Scale } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────
interface DailyFlow {
  day: number;
  income: number;
  expense: number;
}

interface SpendingChartProps {
  dailyFlows: DailyFlow[];
  totalIncome: number;
  totalExpense: number;
}

// ── Custom Tooltip ─────────────────────────────────────────────────────
const CashflowTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 dark:bg-[#1A1A1A]/95 backdrop-blur-2xl border border-[#1C3F35]/10 dark:border-white/10 px-5 py-4 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
        <p className="text-[10px] font-mono text-[#1C3F35]/50 dark:text-white/40 mb-2.5 uppercase font-bold tracking-widest">
          День {label}
        </p>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-[#1C3F35] dark:text-emerald-400 tracking-tight">
            + {(payload[0]?.value ?? 0).toLocaleString('ru-RU')} ₽
            <span className="text-[10px] font-normal opacity-60 ml-1.5">доход</span>
          </p>
          <p className="text-sm font-semibold text-[#FF7A00] dark:text-orange-400 tracking-tight">
            − {(payload[1]?.value ?? 0).toLocaleString('ru-RU')} ₽
            <span className="text-[10px] font-normal opacity-60 ml-1.5">расход</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

// ── Component ──────────────────────────────────────────────────────────
export function SpendingChart({ dailyFlows, totalIncome, totalExpense }: SpendingChartProps) {
  const delta = totalIncome - totalExpense;

  const insight = useMemo(() => {
    if (delta > 0) {
      return {
        text: `Вы в плюсе на ${Math.abs(delta).toLocaleString('ru-RU')} ₽. Отличная работа!`,
        color: 'text-emerald-600 dark:text-emerald-400',
        bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
        borderColor: 'border-emerald-200/60 dark:border-emerald-500/20',
        Icon: TrendingUp,
      };
    } else if (delta < 0) {
      return {
        text: `Расходы превысили доходы на ${Math.abs(delta).toLocaleString('ru-RU')} ₽.`,
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-50 dark:bg-orange-500/10',
        borderColor: 'border-orange-200/60 dark:border-orange-500/20',
        Icon: TrendingDown,
      };
    }
    return {
      text: 'Идеальный баланс: доходы равны расходам.',
      color: 'text-[#1C3F35]/70 dark:text-white/60',
      bgColor: 'bg-slate-50 dark:bg-white/5',
      borderColor: 'border-slate-200/60 dark:border-white/10',
      Icon: Scale,
    };
  }, [delta]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.1 }}
      className="bg-white/60 dark:bg-[#0A0A0A]/80 backdrop-blur-3xl border border-[#1C3F35]/[0.06] dark:border-white/[0.04] rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.6)] hover:shadow-[0_16px_50px_rgba(0,0,0,0.07)] dark:hover:shadow-[0_16px_50px_rgba(0,0,0,0.8)] transition-all duration-700"
    >
      {/* ── Header + Insight ──────────────────────────────────────────── */}
      <div className="mb-8">
        <h3 className="text-2xl font-serif font-bold text-[#1C3F35] dark:text-white tracking-tight leading-none">
          Потоки капитала
        </h3>
        <p className="text-[10px] font-mono text-[#C5A059]/70 dark:text-[#C5A059]/50 uppercase tracking-[0.2em] mt-1.5 font-bold">
          Cashflow Pulse
        </p>

        {/* Dynamic Insight Banner */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className={`mt-5 flex items-center gap-3 px-5 py-3 rounded-2xl border ${insight.bgColor} ${insight.borderColor} transition-colors duration-500`}
        >
          <insight.Icon className={`w-5 h-5 ${insight.color} flex-shrink-0`} />
          <p className={`text-sm font-semibold tracking-tight ${insight.color}`}>
            {insight.text}
          </p>
        </motion.div>
      </div>

      {/* ── Chart ─────────────────────────────────────────────────────── */}
      <div className="h-[300px] w-full">
        {dailyFlows.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[#1C3F35]/30 dark:text-white/20 font-serif italic text-sm">
            Нет данных для визуализации
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyFlows} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barGap={2} style={{ outline: 'none' }}>
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
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}
                tickMargin={8}
                style={{ fontFamily: 'ui-monospace, monospace' }}
              />
              <Tooltip
                content={<CashflowTooltip />}
                cursor={{ fill: 'rgba(28, 63, 53, 0.03)' }}
                isAnimationActive={false}
                wrapperStyle={{ outline: 'none' }}
              />
              <Bar
                dataKey="income"
                fill="#1C3F35"
                radius={[6, 6, 6, 6]}
                maxBarSize={18}
                animationDuration={1200}
                animationEasing="ease-in-out"
              />
              <Bar
                dataKey="expense"
                fill="#FF7A00"
                radius={[6, 6, 6, 6]}
                maxBarSize={18}
                animationDuration={1200}
                animationEasing="ease-in-out"
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-6 mt-6 pt-5 border-t border-[#1C3F35]/[0.06] dark:border-white/[0.04]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#1C3F35]" />
          <span className="text-xs font-semibold text-[#1C3F35]/70 dark:text-white/60">Доходы</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF7A00]" />
          <span className="text-xs font-semibold text-[#1C3F35]/70 dark:text-white/60">Расходы</span>
        </div>
      </div>
    </motion.div>
  );
}
