import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { motion } from 'framer-motion';
import { Mountain } from 'lucide-react';

interface DailyFlow {
  day: number;
  income: number;
  expense: number;
}

interface CapitalGrowthChartProps {
  dailyFlows: DailyFlow[];
}

const GrowthTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const val = payload[0]?.value ?? 0;
    const isPositive = val >= 0;
    return (
      <div className="bg-white/95 dark:bg-[#121212]/95 backdrop-blur-3xl border border-black/10 dark:border-white/10 p-5 rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
        <p className="text-[10px] md:text-[11px] font-mono font-bold uppercase tracking-[0.25em] text-[#1C3F35]/50 dark:text-white/40 mb-2.5">
          День {label}
        </p>
        <p className={`text-xl md:text-2xl font-sans font-black tabular-nums tracking-tighter leading-none ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-500'}`}>
          {isPositive ? '+' : ''}{val.toLocaleString('ru-RU')}
          <span className="ml-1.5 text-sm md:text-base font-bold opacity-60 tracking-normal">₽</span>
        </p>
      </div>
    );
  }
  return null;
};

export function CapitalGrowthChart({ dailyFlows }: CapitalGrowthChartProps) {
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

  const finalCapital = capitalData.length ? (capitalData[capitalData.length - 1]?.capital ?? 0) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="bg-white/40 dark:bg-[#111111]/40 backdrop-blur-3xl border border-black/5 dark:border-white/10 rounded-[2.5rem] p-8 md:p-10 shadow-2xl transition-all duration-700 relative overflow-hidden"
    >
      <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="mb-8 md:mb-10 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div className="flex flex-col gap-1.5">
            <h3 className="text-xl md:text-2xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white leading-none">
              Траектория накоплений
            </h3>
            {/* ИСПРАВЛЕНИЕ: Новый шрифт подзаголовка */}
            <p className="text-[11px] md:text-[12px] font-sans font-extrabold uppercase tracking-wide text-[#FF7A00] dark:drop-shadow-[0_0_8px_rgba(255,122,0,0.5)] mt-1">
              Рост капитала
            </p>
          </div>

          <div className="flex items-center gap-3 bg-emerald-500/10 dark:bg-emerald-500/10 border border-emerald-500/20 px-5 py-3.5 rounded-2xl shadow-sm">
            <Mountain className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className={`text-xl font-sans font-black tabular-nums tracking-tighter leading-none ${finalCapital >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-500'}`}>
              {finalCapital >= 0 ? '+' : ''}{finalCapital.toLocaleString('ru-RU')}
              <span className="ml-1 text-sm font-bold opacity-60 tracking-normal">₽</span>
            </span>
          </div>
        </div>
      </div>

      <div className="h-[300px] w-full relative z-10">
        {capitalData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[11px] font-mono font-bold uppercase tracking-[0.25em] text-[#1C3F35]/40 dark:text-white/30">
            Нет данных
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={capitalData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} style={{ outline: 'none' }}>
              <defs>
                <linearGradient id="capitalGrowthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                  <stop offset="50%" stopColor="#10B981" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128, 128, 128, 0.1)" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888', fontWeight: 600, fontFamily: 'monospace' }} tickMargin={12} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888', fontWeight: 600, fontFamily: 'monospace' }} tickFormatter={(v) => Math.abs(v) >= 1000 ? (v / 1000).toLocaleString('ru-RU') + 'k' : `${v}`} tickMargin={8} />
              <Tooltip content={<GrowthTooltip />} cursor={{ stroke: 'rgba(16, 185, 129, 0.2)', strokeWidth: 1.5, strokeDasharray: '4 4' }} isAnimationActive={false} wrapperStyle={{ outline: 'none' }} />
              <Area type="monotone" dataKey="capital" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#capitalGrowthGradient)" animationDuration={1500} animationEasing="ease-in-out" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}