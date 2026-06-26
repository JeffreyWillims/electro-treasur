/**
 * SavingsNavigator.tsx — "Горизонт Капитала" (Capital Horizon)
 */
import { useState, useMemo, useDeferredValue } from 'react';
import { getLocalDateString, getMoscowDate } from '@/lib/dateUtils';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { motion } from 'framer-motion';
import { fetchDashboard, fetchAnalyticsProfile } from '@/api/client';
import { cn } from '@/lib/utils';

const INFINITY_PATH = "M50,50 C50,32 28,32 28,50 C28,68 50,68 50,50 C50,32 72,32 72,50 C72,68 50,68 50,50";

function ChronosCore() {
  return (
    <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
      <svg viewBox="0 0 100 100" className="w-14 h-14" fill="none">
        <path d={INFINITY_PATH} stroke="currentColor" className="text-[#1C3F35]/20 dark:text-emerald-500/20" strokeWidth="1.5" fill="none" />
        <circle r="3" fill="#FF7A00" style={{ filter: 'drop-shadow(0 0 6px rgba(255,122,0,0.8))' }}>
          <animateMotion dur="5s" repeatCount="indefinite" path={INFINITY_PATH} calcMode="spline" keyTimes="0;0.5;1" keySplines="0.4 0 0.6 1; 0.4 0 0.6 1" />
        </circle>
      </svg>
    </div>
  );
}

const BANK_PRESETS = [
  { name: 'Альфа-Банк', rate: 16, color: '#EF3124' },
  { name: 'Т-Банк', rate: 15, color: '#FFDD2D' },
  { name: 'Сбер', rate: 14, color: '#21A038' },
  { name: 'ВТБ', rate: 13, color: '#002882' },
  { name: 'Газпромбанк', rate: 12, color: '#0071CE' },
];

const HORIZONS = [
  { label: '5 лет', months: 60 },
  { label: '10 лет', months: 120 },
  { label: '15 лет', months: 180 },
];

const HorizonTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length >= 2) {
    return (
      <div className="bg-white/95 dark:bg-[#121212]/95 backdrop-blur-3xl border border-black/10 dark:border-white/10 px-5 py-4 rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] z-50">
        <p className="text-[10px] md:text-[11px] font-sans font-extrabold text-[#1C3F35]/70 dark:text-white/60 mb-3 uppercase tracking-[0.25em]">
          {label}
        </p>
        <div className="space-y-3">
          <p className="text-xl font-sans font-black text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tighter leading-none">
            {Math.round(payload[0]?.value ?? 0).toLocaleString('ru-RU')}
            <span className="text-sm font-bold opacity-60 ml-1.5 tracking-normal">₽</span>
            <span className="text-[10px] font-sans font-extrabold opacity-70 ml-2.5 uppercase tracking-wide text-[#1C3F35] dark:text-white">Инвестиции</span>
          </p>
          <p className="text-xl font-sans font-black text-[#1C3F35]/90 dark:text-white/90 tabular-nums tracking-tighter leading-none">
            {Math.round(payload[1]?.value ?? 0).toLocaleString('ru-RU')}
            <span className="text-sm font-bold opacity-60 ml-1.5 tracking-normal">₽</span>
            <span className="text-[10px] font-sans font-extrabold opacity-70 ml-2.5 uppercase tracking-wide text-[#1C3F35] dark:text-white">Копилка</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

const formatSum = (val: string): string => val.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const parseSum = (formatted: string): number => parseFloat(formatted.replace(/[^\d.]/g, '')) || 0;

export function SavingsNavigator() {
  const { startDateStr, endDateStr } = useMemo(() => {
    const end = getMoscowDate();
    const start = getMoscowDate();
    start.setDate(end.getDate() - 30);
    return { startDateStr: getLocalDateString(start), endDateStr: getLocalDateString(end) };
  }, []);

  const { data: dashboard, isLoading: isDashLoading } = useQuery({
    queryKey: ['dashboard', startDateStr, endDateStr],
    queryFn: () => fetchDashboard(startDateStr, endDateStr),
  });
  const { data: profile } = useQuery({
    queryKey: ['analyticsProfile'],
    queryFn: fetchAnalyticsProfile,
  });

  const dbBalance = parseFloat(dashboard?.total_balance_all_time || '0');
  const dbExpense = parseFloat(dashboard?.period_expense || '0');
  const dbIncome = parseFloat(profile?.avg_income || '0');

  const [startCapital, setStartCapital] = useState<string>('');
  const [monthlyIncome, setMonthlyIncome] = useState<string>('');
  const [monthlyExpense, setMonthlyExpense] = useState<string>('');
  const [horizonMonths, setHorizonMonths] = useState(120);
  const [annualYield, setAnnualYield] = useState(16);
  const [inflation, setInflation] = useState(8);

  const effCapital = startCapital !== '' ? parseSum(startCapital) : dbBalance;
  const effIncome = monthlyIncome !== '' ? parseSum(monthlyIncome) : dbIncome;
  const effExpense = monthlyExpense !== '' ? parseSum(monthlyExpense) : dbExpense;

  const chartData = useMemo(() => {
    const data: { label: string; invested: number; piggybank: number }[] = [];
    const monthlySaving = Math.max(effIncome - effExpense, 0);
    const monthlyRate = annualYield / 100 / 12;
    const monthlyInflation = inflation / 100 / 12;

    let investedNominal = effCapital;
    let piggyNominal = effCapital;

    const baseDate = getMoscowDate();

    for (let m = 0; m <= horizonMonths; m++) {
      if (m > 0) {
        investedNominal = investedNominal * (1 + monthlyRate) + monthlySaving;
        piggyNominal = piggyNominal + monthlySaving;
      }
      const deflator = Math.pow(1 + monthlyInflation, m);

      const d = new Date(baseDate);
      d.setMonth(baseDate.getMonth() + m);

      data.push({
        label: d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }),
        invested: Math.round(investedNominal / deflator),
        piggybank: Math.round(piggyNominal / deflator),
      });
    }
    return data;
  }, [effCapital, effIncome, effExpense, horizonMonths, annualYield, inflation]);

  const deferredData = useDeferredValue(chartData);
  const isStale = deferredData !== chartData;

  const finalInvested = deferredData[deferredData.length - 1]?.invested ?? 0;
  const finalPiggy = deferredData[deferredData.length - 1]?.piggybank ?? 0;
  const advantage = finalInvested - finalPiggy;

  if (isDashLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <motion.div
          className="w-10 h-10 border-2 border-[#1C3F35]/20 dark:border-white/20 border-t-[#FF7A00] rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  const inputWrapperStyle = cn(
    "flex items-center w-full rounded-2xl h-14 md:h-16 px-4 md:px-5 transition-all duration-300",
    "bg-black/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] border border-transparent",
    "dark:bg-black/40 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]",
    "focus-within:bg-white focus-within:shadow-md focus-within:border-[#FF7A00]/50",
    "dark:focus-within:bg-[#1A1A1A] dark:focus-within:shadow-none dark:focus-within:border-[#FF7A00]/50"
  );

  const inputStyles = "flex-1 w-full bg-transparent outline-none text-xl md:text-2xl font-sans font-black tabular-nums tracking-tighter text-[#1C3F35] dark:text-white placeholder-[#1C3F35]/30 dark:placeholder-white/30";

  // 🔥 ЭТАЛОННЫЙ ШРИФТ ИЗ QUICK ENTRY
  const premiumLabelStyle = "block mb-2 text-[14px] md:text-[15px] font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-emerald-400 dark:drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]";

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }} className="flex flex-col gap-10 w-full mt-4 pb-24">

      {/* ═══ HEADER ═══ */}
      <div className="flex items-center gap-5 mb-2">
        <div className="bg-white/40 dark:bg-[#111111]/40 backdrop-blur-3xl rounded-2xl p-2 border border-black/5 dark:border-white/10 shadow-sm shrink-0">
           <ChronosCore />
        </div>
        <div>
          <h1 className="text-3xl md:text-4xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white leading-none">
            Горизонт Капитала
          </h1>
        </div>
      </div>

      {/* ═══ THE CONTROL DECK ═══ */}
      <div className="bg-white/40 dark:bg-[#111111]/40 backdrop-blur-3xl border border-black/5 dark:border-white/10 rounded-[2.5rem] p-8 md:p-10 shadow-2xl">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Стартовый капитал */}
          <div>
            <label className={premiumLabelStyle}>Стартовый капитал</label>
            <div className={inputWrapperStyle}>
              <input type="text" inputMode="numeric" value={formatSum(startCapital)} onChange={(e) => setStartCapital(e.target.value.replace(/\D/g, ''))} className={inputStyles} placeholder={dbBalance.toLocaleString('ru-RU')} />
              <span className="text-lg font-bold opacity-40 text-[#1C3F35] dark:text-white tracking-normal ml-2">₽</span>
            </div>
          </div>

          {/* Ежемесячный Доход */}
          <div>
            <label className={premiumLabelStyle}>Ежемесячный Доход</label>
            <div className={inputWrapperStyle}>
              <input type="text" inputMode="numeric" value={formatSum(monthlyIncome)} onChange={(e) => setMonthlyIncome(e.target.value.replace(/\D/g, ''))} className={inputStyles} placeholder={dbIncome.toLocaleString('ru-RU')} />
              <span className="text-lg font-bold opacity-40 text-[#1C3F35] dark:text-white tracking-normal ml-2">₽</span>
            </div>
          </div>

          {/* Ежемесячные Расходы */}
          <div>
            <label className={premiumLabelStyle}>Ежемесячные Расходы</label>
            <div className={inputWrapperStyle}>
              <input type="text" inputMode="numeric" value={formatSum(monthlyExpense)} onChange={(e) => setMonthlyExpense(e.target.value.replace(/\D/g, ''))} className={inputStyles} placeholder={dbExpense.toLocaleString('ru-RU')} />
              <span className="text-lg font-bold opacity-40 text-[#1C3F35] dark:text-white tracking-normal ml-2">₽</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-10">
            <div>
              <label className={premiumLabelStyle}>Горизонт Планирования</label>
              <div className="flex gap-3">
                {HORIZONS.map((h) => (
                  <button
                    key={h.months} onClick={() => setHorizonMonths(h.months)}
                    className={`px-6 py-3 rounded-2xl text-[12px] font-sans font-extrabold uppercase tracking-wide transition-all duration-300 ${horizonMonths === h.months ? 'bg-[#FF7A00] text-white shadow-[0_10px_20px_rgba(255,122,0,0.4)] dark:drop-shadow-[0_0_8px_rgba(255,122,0,0.8)]' : 'bg-black/5 dark:bg-white/5 text-[#1C3F35]/70 dark:text-white/70 hover:bg-black/10 dark:hover:bg-white/10'}`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-end mb-3">
                <label className={cn(premiumLabelStyle, "mb-0")}>Годовая Доходность</label>
                <span className="text-3xl md:text-4xl font-sans font-black tabular-nums tracking-tighter text-emerald-600 dark:text-emerald-400 leading-none">
                  {annualYield}<span className="text-lg md:text-xl font-bold opacity-60 tracking-normal ml-1">%</span>
                </span>
              </div>
              <input type="range" min="0" max="30" step="0.5" value={annualYield} onChange={(e) => setAnnualYield(parseFloat(e.target.value))} className="apple-slider bg-black/10 dark:bg-white/10" style={{ background: `linear-gradient(to right, #10B981 ${(annualYield / 30) * 100}%, rgba(128,128,128,0.1) ${(annualYield / 30) * 100}%)` }} />
              <div className="text-[11px] font-sans font-extrabold uppercase tracking-wide text-[#1C3F35]/60 dark:text-white/50 flex justify-between">
                <span>0%</span><span>Сложный процент</span><span>30%</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-end mb-3">
                <label className={cn(premiumLabelStyle, "mb-0")}>Ожидаемая Инфляция</label>
                <span className="text-3xl md:text-4xl font-sans font-black tabular-nums tracking-tighter text-rose-600 dark:text-rose-500 leading-none">
                  {inflation}<span className="text-lg md:text-xl font-bold opacity-60 tracking-normal ml-1">%</span>
                </span>
              </div>
              <input type="range" min="0" max="20" step="0.5" value={inflation} onChange={(e) => setInflation(parseFloat(e.target.value))} className="apple-slider bg-black/10 dark:bg-white/10" style={{ background: `linear-gradient(to right, #F43F5E ${(inflation / 20) * 100}%, rgba(128,128,128,0.1) ${(inflation / 20) * 100}%)` }} />
              <div className="text-[11px] font-sans font-extrabold uppercase tracking-wide text-[#1C3F35]/60 dark:text-white/50 flex justify-between">
                <span>0%</span><span>Обесценивание</span><span>20%</span>
              </div>
            </div>
          </div>

          <div>
            <label className={premiumLabelStyle}>Банковские Пресеты</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {BANK_PRESETS.map((bank) => (
                <motion.button
                  key={bank.name} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setAnnualYield(bank.rate)}
                  className={`flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all duration-300 text-left ${annualYield === bank.rate ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_10px_20px_rgba(16,185,129,0.1)]' : 'bg-black/5 dark:bg-white/5 border-transparent hover:bg-black/10 dark:hover:bg-white/10'}`}
                >
                  <div className="w-4 h-4 rounded-full flex-shrink-0 shadow-inner" style={{ backgroundColor: bank.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm md:text-base font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white truncate">{bank.name}</p>
                  </div>
                  <span className={`text-xl font-sans font-black tabular-nums flex-shrink-0 tracking-tighter ${annualYield === bank.rate ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#1C3F35]/50 dark:text-white/50'}`}>
                    {bank.rate}<span className="text-sm font-bold opacity-60 tracking-normal ml-0.5">%</span>
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ RESULT BANNER ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Инвестиции (реальн.)', val: finalInvested, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Просто копилка (реальн.)', val: finalPiggy, color: 'text-[#1C3F35] dark:text-white' },
          { label: 'Преимущество', val: advantage, color: 'text-[#FF7A00]' },
        ].map((m) => (
          <div key={m.label} className="bg-white/40 dark:bg-[#111111]/40 backdrop-blur-3xl border border-black/5 dark:border-white/10 rounded-[2.5rem] p-8 text-center shadow-lg">
            <p className="text-[12px] font-sans font-extrabold text-[#1C3F35]/80 dark:text-white/80 uppercase tracking-wide mb-3">
              {m.label}
            </p>
            <p className={`text-2xl md:text-3xl font-sans font-black tabular-nums tracking-tighter ${m.color}`}>
              {m.val >= 0 ? '+' : ''}{m.val.toLocaleString('ru-RU')}
              <span className="text-sm md:text-base font-bold opacity-60 tracking-normal ml-1.5">₽</span>
            </p>
          </div>
        ))}
      </div>

      {/* ═══ DUAL REALITY CHART ═══ */}
      <div className={`bg-white/40 dark:bg-[#111111]/40 backdrop-blur-3xl border border-black/5 dark:border-white/10 rounded-[2.5rem] p-8 md:p-10 shadow-2xl transition-opacity duration-300 ${isStale ? 'opacity-50' : 'opacity-100'}`}>
        <div className="mb-8">
          <h2 className="text-xl md:text-2xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white">
            Двойная Реальность
          </h2>
          {/* 🔥 ИСПРАВЛЕНИЕ: Эталонный стиль подзаголовка из QuickEntry */}
          <p className="text-[11px] md:text-[12px] font-sans font-extrabold uppercase tracking-wide text-[#FF7A00] dark:drop-shadow-[0_0_8px_rgba(255,122,0,0.5)] mt-1">
            Инвестиции против Инфляции
          </p>
        </div>

        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={deferredData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} style={{ outline: 'none' }}>
              <defs>
                <linearGradient id="investFillV" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128, 128, 128, 0.1)" />
              {/* 🔥 ИСПРАВЛЕНИЕ: Красивый шрифт осей (inherit унаследует Plus Jakarta Sans) */}
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888', fontWeight: 800, fontFamily: 'inherit' }} tickMargin={12} interval={Math.max(Math.floor(horizonMonths / 8), 1)} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888', fontWeight: 800, fontFamily: 'inherit' }} tickFormatter={(v) => { if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`; if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`; return `${v}`; }} tickMargin={8} />
              <Tooltip content={<HorizonTooltip />} cursor={{ stroke: 'rgba(16, 185, 129, 0.2)', strokeWidth: 1.5, strokeDasharray: '4 4' }} isAnimationActive={false} wrapperStyle={{ outline: 'none' }} />
              <Area type="monotone" dataKey="invested" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#investFillV)" isAnimationActive={false} activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981', style: { filter: 'drop-shadow(0 0 6px rgba(16,185,129,0.7))' } }} />
              <Area type="monotone" dataKey="piggybank" stroke="#94a3b8" strokeWidth={2} strokeDasharray="6 4" fillOpacity={0} fill="transparent" isAnimationActive={false} activeDot={{ r: 4, strokeWidth: 0, fill: '#94a3b8' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-wrap items-center gap-8 mt-8 pt-6 border-t border-black/5 dark:border-white/5">
          <div className="flex items-center gap-3">
            <span className="w-5 h-1 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
            <span className="text-[10px] md:text-[11px] font-sans font-extrabold uppercase tracking-wide text-[#1C3F35]/90 dark:text-white/80">Инвестиции (с поправкой на инфляцию)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-5 h-1 rounded-full bg-slate-400 border-t-2 border-dashed border-slate-500" style={{ background: 'none' }} />
            <span className="text-[10px] md:text-[11px] font-sans font-extrabold uppercase tracking-wide text-[#1C3F35]/90 dark:text-white/80">Просто копилка</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}