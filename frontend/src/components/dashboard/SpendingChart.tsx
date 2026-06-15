import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Scale } from 'lucide-react';

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

const CashflowTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 dark:bg-[#121212]/95 backdrop-blur-3xl border border-black/10 dark:border-white/10 px-5 py-4 rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] z-50">
        <p className="text-[10px] md:text-[11px] font-mono font-bold text-[#1C3F35]/50 dark:text-white/40 mb-3 uppercase tracking-[0.25em]">
          День {label}
        </p>
        <div className="space-y-3">
          <p className="flex items-baseline gap-2">
            <span className="text-xl font-sans font-black tabular-nums tracking-tighter text-emerald-600 dark:text-emerald-400 leading-none">
              +{(payload[0]?.value ?? 0).toLocaleString('ru-RU')}
              <span className="text-sm font-bold opacity-60 ml-1.5 tracking-normal">₽</span>
            </span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] opacity-50 text-[#1C3F35] dark:text-white">доход</span>
          </p>
          <p className="flex items-baseline gap-2">
            <span className="text-xl font-sans font-black tabular-nums tracking-tighter text-rose-600 dark:text-rose-500 leading-none">
              −{(payload[1]?.value ?? 0).toLocaleString('ru-RU')}
              <span className="text-sm font-bold opacity-60 ml-1.5 tracking-normal">₽</span>
            </span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] opacity-50 text-[#1C3F35] dark:text-white">расход</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export function SpendingChart({ dailyFlows, totalIncome, totalExpense }: SpendingChartProps) {
  const delta = totalIncome - totalExpense;

  const insight = useMemo(() => {
    if (delta > 0) {
      return {
        prefix: 'Вы в плюсе на ',
        amount: Math.abs(delta),
        suffix: '. Отличная работа!',
        color: 'text-emerald-600 dark:text-emerald-400',
        bgColor: 'bg-emerald-500/5 dark:bg-emerald-500/10',
        borderColor: 'border-emerald-500/20',
        Icon: TrendingUp,
      };
    } else if (delta < 0) {
      return {
        prefix: 'Расходы превысили доходы на ',
        amount: Math.abs(delta),
        suffix: '.',
        color: 'text-rose-600 dark:text-rose-400',
        bgColor: 'bg-rose-500/5 dark:bg-rose-500/10',
        borderColor: 'border-rose-500/20',
        Icon: TrendingDown,
      };
    }
    return {
      prefix: 'Идеальный баланс: доходы равны расходам.',
      amount: null,
      suffix: '',
      color: 'text-[#1C3F35]/70 dark:text-white/60',
      bgColor: 'bg-black/5 dark:bg-white/5',
      borderColor: 'border-transparent dark:border-white/5',
      Icon: Scale,
    };
  }, [delta]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.1 }}
      className="bg-white/40 dark:bg-[#111111]/40 backdrop-blur-3xl border border-black/5 dark:border-white/10 rounded-[2.5rem] p-8 md:p-10 shadow-2xl transition-all duration-700"
    >
      <div className="mb-8">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-xl md:text-2xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white leading-none">
            Потоки капитала
          </h3>
          {/* ИСПРАВЛЕНИЕ: Новый шрифт подзаголовка */}
          <p className="text-[11px] md:text-[12px] font-sans font-extrabold uppercase tracking-wide text-[#FF7A00] dark:drop-shadow-[0_0_8px_rgba(255,122,0,0.5)] mt-1">
            Движение средств
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className={`mt-6 flex items-center gap-3 px-5 py-4 rounded-2xl border ${insight.bgColor} ${insight.borderColor} transition-colors duration-500`}
        >
          <insight.Icon className={`w-5 h-5 ${insight.color} flex-shrink-0`} />
          <p className={`text-sm md:text-base font-medium tracking-tight ${insight.color} leading-snug`}>
            {insight.prefix}
            {insight.amount !== null && (
              <span className="font-sans font-black tabular-nums tracking-tighter mx-1">
                {insight.amount.toLocaleString('ru-RU')}
                <span className="text-[11px] font-bold opacity-60 ml-0.5 tracking-normal">₽</span>
              </span>
            )}
            {insight.suffix}
          </p>
        </motion.div>
      </div>

      <div className="h-[300px] w-full">
        {dailyFlows.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[11px] font-mono font-bold uppercase tracking-[0.25em] text-[#1C3F35]/40 dark:text-white/30">
            Нет данных
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyFlows} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barGap={2} style={{ outline: 'none' }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128, 128, 128, 0.1)" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888', fontWeight: 600, fontFamily: 'monospace' }} tickMargin={12} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888', fontWeight: 600, fontFamily: 'monospace' }} tickFormatter={(v) => v >= 1000 ? (v / 1000).toLocaleString('ru-RU') + 'k' : `${v}`} tickMargin={8} />
              <Tooltip content={<CashflowTooltip />} cursor={{ fill: 'rgba(128, 128, 128, 0.05)' }} isAnimationActive={false} wrapperStyle={{ outline: 'none' }} />
              <Bar dataKey="income" fill="#10B981" radius={[6, 6, 6, 6]} maxBarSize={16} animationDuration={1200} animationEasing="ease-in-out" />
              <Bar dataKey="expense" fill="#F43F5E" radius={[6, 6, 6, 6]} maxBarSize={16} animationDuration={1200} animationEasing="ease-in-out" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center md:justify-start gap-8 mt-8 pt-6 border-t border-black/5 dark:border-white/5">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-[#1C3F35]/60 dark:text-white/60">Доходы</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-[#1C3F35]/60 dark:text-white/60">Расходы</span>
        </div>
      </div>
    </motion.div>
  );
}