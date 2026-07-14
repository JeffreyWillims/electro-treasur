import { useMemo } from 'react';
import {
  ComposedChart, Bar, Line, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import { motion } from 'framer-motion';
import { Activity, TrendingDown, TrendingUp } from 'lucide-react';

/**
 * «Пульс капитала» — замена «Траектории накоплений».
 * Водопад по дням (зелёный столбик — день в плюс, розовый — в минус) +
 * кумулятивная линия капитала поверх. Одна ось (₽): видно и «какие дни
 * съели деньги», и общий тренд месяца — две истории в одном взгляде.
 */

interface DailyFlow {
  day: number;
  income: number;
  expense: number;
}

interface CapitalGrowthChartProps {
  dailyFlows: DailyFlow[];
}

/** capital — факт (обрывается на сегодня), forecast — пунктир до конца месяца. */
type PulsePoint = { day: number; net: number; capital: number | null; forecast: number | null };

const PulseTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const p: PulsePoint | undefined = payload[0]?.payload;
  if (!p) return null;
  const isForecast = p.capital === null;
  const total = p.capital ?? p.forecast ?? 0;
  const netPositive = p.net >= 0;
  return (
    <div className="bg-white/95 dark:bg-[#121212]/95 backdrop-blur-3xl border border-black/10 dark:border-white/10 p-5 rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
      <p className="text-[11px] font-sans font-bold uppercase tracking-[0.18em] text-[#1C3F35]/50 dark:text-white/40 mb-2.5">
        День {label}
        {isForecast && <span className="ml-2 text-[#FF7A00]">прогноз</span>}
      </p>
      {!isForecast && (
        <p className={`text-lg font-sans font-black tabular-nums tracking-tight leading-none ${netPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-500'}`}>
          {netPositive ? '+' : ''}{Math.round(p.net).toLocaleString('ru-RU')}
          <span className="ml-1 text-xs font-bold opacity-60">₽ за день</span>
        </p>
      )}
      <p className="mt-2 text-sm font-sans font-extrabold tabular-nums text-[#1C3F35] dark:text-white">
        {total >= 0 ? '+' : ''}{Math.round(total).toLocaleString('ru-RU')}
        <span className="ml-1 text-[11px] font-bold opacity-50">
          {isForecast ? '₽ ожидается к этому дню' : '₽ с начала месяца'}
        </span>
      </p>
    </div>
  );
};

export function CapitalGrowthChart({ dailyFlows }: CapitalGrowthChartProps) {
  const { pulseData, projectedEnd } = useMemo<{
    pulseData: PulsePoint[];
    projectedEnd: number | null;
  }>(() => {
    // Последний день с операциями = «сегодня» периода: дальше факта нет, только прогноз.
    const lastActive = dailyFlows.reduce(
      (last, d) => (d.income !== 0 || d.expense !== 0 ? d.day : last),
      0,
    );

    let cumulative = 0;
    const factual = dailyFlows.map((d) => {
      const net = d.income - d.expense;
      if (d.day <= lastActive) cumulative += net;
      return {
        day: d.day,
        net: Math.round(net * 100) / 100,
        capital: d.day <= lastActive ? Math.round(cumulative * 100) / 100 : null,
        forecast: null as number | null,
      };
    });

    // Средний дневной темп по прожитым дням → пунктир до конца периода.
    const capitalNow = cumulative;
    const avgPerDay = lastActive > 0 ? capitalNow / lastActive : 0;
    const totalDays = dailyFlows.length;
    const hasFuture = lastActive > 0 && lastActive < totalDays;

    if (hasFuture) {
      for (const p of factual) {
        if (p.day === lastActive) {
          // Стык: пунктир начинается ровно там, где обрывается факт.
          p.forecast = Math.round(capitalNow * 100) / 100;
        } else if (p.day > lastActive) {
          p.forecast = Math.round((capitalNow + avgPerDay * (p.day - lastActive)) * 100) / 100;
        }
      }
    }

    const projected = hasFuture
      ? Math.round(capitalNow + avgPerDay * (totalDays - lastActive))
      : null;

    return { pulseData: factual, projectedEnd: projected };
  }, [dailyFlows]);

  const factualPoints = pulseData.filter((p) => p.capital !== null);
  const finalCapital = factualPoints.length
    ? (factualPoints[factualPoints.length - 1]?.capital ?? 0)
    : 0;
  const activeDays = pulseData.filter((p) => p.net !== 0);
  const bestDay = activeDays.reduce<PulsePoint | null>(
    (best, p) => (best === null || p.net > best.net ? p : best), null,
  );
  const worstDay = activeDays.reduce<PulsePoint | null>(
    (worst, p) => (worst === null || p.net < worst.net ? p : worst), null,
  );

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
              Пульс капитала
            </h3>
            <p className="text-[11px] md:text-[12px] font-sans font-extrabold uppercase tracking-wide text-[#FF7A00] dark:drop-shadow-[0_0_8px_rgba(255,122,0,0.5)] mt-1">
              Дни в плюс и в минус · линия — итог месяца
            </p>
            {projectedEnd !== null && (
              <p className="text-[13px] font-sans font-semibold text-[#1C3F35]/60 dark:text-white/50 mt-2">
                При текущем темпе к концу месяца —{' '}
                <span
                  className={`font-black tabular-nums ${
                    projectedEnd >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-500'
                  }`}
                >
                  {projectedEnd >= 0 ? '+' : ''}
                  {projectedEnd.toLocaleString('ru-RU')} ₽
                </span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 bg-emerald-500/10 dark:bg-emerald-500/10 border border-emerald-500/20 px-5 py-3.5 rounded-2xl shadow-sm">
            <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className={`text-xl font-sans font-black tabular-nums tracking-tighter leading-none ${finalCapital >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-500'}`}>
              {finalCapital >= 0 ? '+' : ''}{Math.round(finalCapital).toLocaleString('ru-RU')}
              <span className="ml-1 text-sm font-bold opacity-60 tracking-normal">₽</span>
            </span>
          </div>
        </div>
      </div>

      <div className="h-[300px] w-full relative z-10">
        {pulseData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[11px] font-mono font-bold uppercase tracking-[0.25em] text-[#1C3F35]/40 dark:text-white/30">
            Нет данных
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={pulseData} margin={{ top: 10, right: 10, left: -14, bottom: 0 }} style={{ outline: 'none' }} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128, 128, 128, 0.1)" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888', fontWeight: 700 }} tickMargin={12} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888', fontWeight: 700 }} tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? (v / 1000).toLocaleString('ru-RU') + 'k' : `${v}`)} tickMargin={8} />
              <ReferenceLine y={0} stroke="rgba(128,128,128,0.35)" strokeWidth={1} />
              <Tooltip content={<PulseTooltip />} cursor={{ fill: 'rgba(255,122,0,0.06)' }} isAnimationActive={false} wrapperStyle={{ outline: 'none' }} />
              <Bar dataKey="net" radius={[4, 4, 4, 4]} animationDuration={900}>
                {pulseData.map((p) => (
                  <Cell key={p.day} fill={p.net >= 0 ? '#10B981' : '#F43F5E'} fillOpacity={0.75} />
                ))}
              </Bar>
              <Line type="monotone" dataKey="capital" stroke="#FF7A00" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} animationDuration={1200} connectNulls={false} />
              {/* Пунктир: тот же капитал, но по среднему темпу — до конца месяца */}
              <Line type="monotone" dataKey="forecast" stroke="#FF7A00" strokeWidth={2} strokeDasharray="5 5" strokeOpacity={0.55} dot={false} activeDot={{ r: 4 }} animationDuration={1200} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Лучший и худший день месяца — быстрые истории под графиком */}
      {(bestDay || worstDay) && (
        <div className="relative z-10 mt-6 flex flex-wrap gap-3">
          {bestDay && bestDay.net > 0 && (
            <div className="flex items-center gap-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-[13px] font-sans font-bold text-[#1C3F35]/75 dark:text-white/70">
                Лучший день — {bestDay.day}-е:{' '}
                <span className="font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                  +{Math.round(bestDay.net).toLocaleString('ru-RU')} ₽
                </span>
              </span>
            </div>
          )}
          {worstDay && worstDay.net < 0 && (
            <div className="flex items-center gap-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5">
              <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-500 shrink-0" />
              <span className="text-[13px] font-sans font-bold text-[#1C3F35]/75 dark:text-white/70">
                Самый затратный — {worstDay.day}-е:{' '}
                <span className="font-black tabular-nums text-rose-600 dark:text-rose-500">
                  {Math.round(worstDay.net).toLocaleString('ru-RU')} ₽
                </span>
              </span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
