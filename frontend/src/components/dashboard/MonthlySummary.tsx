/**
 * MonthlySummary — Premium Total In / Total Out cards with mini bar charts.
 */
import { MONTHLY_SUMMARY } from '@/data/mockData';
import { TrendingUp } from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, XAxis } from 'recharts';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function MonthlySummary() {
  const { totalIn, totalOut, inChange, outChange, dailyData } = MONTHLY_SUMMARY;
  const currentMonth = new Date().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', '');

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full relative z-10"
    >
      {/* ── ДОХОДЫ (Total In) ── */}
      <div className={cn(
        "relative bg-white/40 dark:bg-[#111111]/40 backdrop-blur-3xl border border-black/5 dark:border-white/10 rounded-[2.5rem] p-8 overflow-hidden",
        "shadow-lg hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)] group transition-all duration-300 hover:-translate-y-1"
      )}>
        {/* Фоновое свечение */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />

        <div className="relative z-10">
          <p className="text-[11px] font-mono font-bold text-[#1C3F35]/50 dark:text-white/40 uppercase tracking-[0.25em]">
            Доходы · {currentMonth}
          </p>
          <div className="mt-3 mb-2 flex flex-wrap items-baseline">
            <p className="text-4xl md:text-5xl font-sans font-black tabular-nums tracking-tighter text-emerald-600 dark:text-emerald-400 leading-none">
              +{totalIn.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
            </p>
            <span className="text-sm font-bold text-emerald-600/60 dark:text-emerald-400/60 ml-1.5 tracking-normal">₽</span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[10px] font-mono font-bold tracking-[0.1em] text-emerald-600 dark:text-emerald-400">+{Math.abs(inChange)}%</span>
            </div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#1C3F35]/40 dark:text-white/30">к прошлому месяцу</span>
          </div>

          {/* Мини-график */}
          <div className="mt-8 h-24 w-full opacity-60 group-hover:opacity-100 transition-opacity duration-300">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData.slice(0, 15)} barGap={2}>
                <XAxis dataKey="day" hide />
                <Bar dataKey="income" fill="#10B981" radius={[4, 4, 4, 4]} maxBarSize={12} />
                <Bar dataKey="expense" fill="rgba(16, 185, 129, 0.15)" radius={[4, 4, 4, 4]} maxBarSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── РАСХОДЫ (Total Out) ── */}
      <div className={cn(
        "relative bg-white/40 dark:bg-[#111111]/40 backdrop-blur-3xl border border-black/5 dark:border-white/10 rounded-[2.5rem] p-8 overflow-hidden",
        "shadow-lg hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)] group transition-all duration-300 hover:-translate-y-1"
      )}>
        {/* Фоновое свечение */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/10 dark:bg-rose-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />

        <div className="relative z-10">
          <p className="text-[11px] font-mono font-bold text-[#1C3F35]/50 dark:text-white/40 uppercase tracking-[0.25em]">
            Расходы · {currentMonth}
          </p>
          <div className="mt-3 mb-2 flex flex-wrap items-baseline">
            <p className="text-4xl md:text-5xl font-sans font-black tabular-nums tracking-tighter text-rose-600 dark:text-rose-500 leading-none">
              -{totalOut.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
            </p>
            <span className="text-sm font-bold text-rose-600/60 dark:text-rose-500/60 ml-1.5 tracking-normal">₽</span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1 px-2 py-1 bg-rose-500/10 border border-rose-500/20 rounded-lg">
              <TrendingUp className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span className="text-[10px] font-mono font-bold tracking-[0.1em] text-rose-600 dark:text-rose-400">+{outChange}%</span>
            </div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#1C3F35]/40 dark:text-white/30">к прошлому месяцу</span>
          </div>

          {/* Мини-график */}
          <div className="mt-8 h-24 w-full opacity-60 group-hover:opacity-100 transition-opacity duration-300">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData.slice(0, 15)} barGap={2}>
                <XAxis dataKey="day" hide />
                <Bar dataKey="expense" fill="#F43F5E" radius={[4, 4, 4, 4]} maxBarSize={12} />
                <Bar dataKey="income" fill="rgba(244, 63, 94, 0.15)" radius={[4, 4, 4, 4]} maxBarSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </motion.div>
  );
}