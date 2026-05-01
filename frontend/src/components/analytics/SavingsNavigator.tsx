/* eslint-disable */
/**
 * SavingsNavigator.tsx — "Горизонт Капитала" (Capital Horizon)
 *
 * Time Machine: compound interest + inflation simulator.
 * Dual Reality AreaChart: piggybank vs investment (inflation-adjusted).
 * Bank presets, horizon pills, Apple-style sliders.
 * Performance: useDeferredValue for zero-latency slider interaction.
 *
 * Aesthetic: California Organic Luxury.
 */
import { useState, useMemo, useDeferredValue } from 'react';
import { getLocalDateString } from '@/lib/dateUtils';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { motion } from 'framer-motion';
import { fetchDashboard, fetchAnalyticsProfile } from '@/api/client';

// ── Chronos Core SVG ───────────────────────────────────────────────────
// Infinity symbol centered in 100×100 viewBox.
// Path: left lobe + right lobe, both passing through center (50,50).
const INFINITY_PATH = "M50,50 C50,32 28,32 28,50 C28,68 50,68 50,50 C50,32 72,32 72,50 C72,68 50,68 50,50";

function ChronosCore() {
  return (
    <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
      <svg viewBox="0 0 100 100" className="w-14 h-14" fill="none">
        {/* Infinity outline */}
        <path
          d={INFINITY_PATH}
          stroke="#1C3F35"
          strokeOpacity="0.25"
          strokeWidth="1.2"
          fill="none"
        />
        {/* Running golden dot */}
        <circle r="2.5" fill="#FF7A00" style={{ filter: 'drop-shadow(0 0 4px rgba(255,122,0,0.65))' }}>
          <animateMotion
            dur="5s"
            repeatCount="indefinite"
            path={INFINITY_PATH}
            calcMode="spline"
            keyTimes="0;0.5;1"
            keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
          />
        </circle>
      </svg>
    </div>
  );
}

// ── Bank Presets ────────────────────────────────────────────────────────
const BANK_PRESETS = [
  { name: 'Альфа-Банк', rate: 16, color: '#EF3124' },
  { name: 'Т-Банк', rate: 15, color: '#FFDD2D' },
  { name: 'Сбер', rate: 14, color: '#21A038' },
  { name: 'ВТБ', rate: 13, color: '#002882' },
  { name: 'Газпромбанк', rate: 12, color: '#0071CE' },
];

// ── Horizon Options ────────────────────────────────────────────────────
const HORIZONS = [
  { label: '5 лет', months: 60 },
  { label: '10 лет', months: 120 },
  { label: '15 лет', months: 180 },
];

// ── Custom Tooltip ─────────────────────────────────────────────────────
const HorizonTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length >= 2) {
    return (
      <div className="bg-white/95 dark:bg-[#1A1A1A]/95 backdrop-blur-2xl border border-[#1C3F35]/10 dark:border-white/10 px-5 py-4 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
        <p className="text-[10px] font-mono text-[#1C3F35]/50 dark:text-white/40 mb-2 uppercase font-bold tracking-widest">
          {label}
        </p>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tracking-tight">
            {Math.round(payload[0]?.value ?? 0).toLocaleString('ru-RU')} ₽
            <span className="text-[10px] font-normal opacity-60 ml-1.5">инвестиции</span>
          </p>
          <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 tracking-tight">
            {Math.round(payload[1]?.value ?? 0).toLocaleString('ru-RU')} ₽
            <span className="text-[10px] font-normal opacity-60 ml-1.5">копилка</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

// ── Input Formatting Utility ──────────────────────────────────────────
const formatSum = (val: string): string =>
  val.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');

const parseSum = (formatted: string): number =>
  parseFloat(formatted.replace(/[^\d.]/g, '')) || 0;

// ── Main Component ─────────────────────────────────────────────────────
export function SavingsNavigator() {
  // ── Initial data from DB ─────────────────────────────────────────────
  const { startDateStr, endDateStr } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    return {
      startDateStr: getLocalDateString(start),
      endDateStr: getLocalDateString(end),
    };
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

  // ── User-Editable State ──────────────────────────────────────────────
  const [startCapital, setStartCapital] = useState<string>('');
  const [monthlyIncome, setMonthlyIncome] = useState<string>('');
  const [monthlyExpense, setMonthlyExpense] = useState<string>('');
  const [horizonMonths, setHorizonMonths] = useState(120);
  const [annualYield, setAnnualYield] = useState(16);
  const [inflation, setInflation] = useState(8);

  // Effective values: user override or DB fallback
  const effCapital = startCapital !== '' ? parseSum(startCapital) : dbBalance;
  const effIncome = monthlyIncome !== '' ? parseSum(monthlyIncome) : dbIncome;
  const effExpense = monthlyExpense !== '' ? parseSum(monthlyExpense) : dbExpense;

  // ── Predictive Math Engine ───────────────────────────────────────────
  const chartData = useMemo(() => {
    const data: { label: string; invested: number; piggybank: number }[] = [];
    const monthlySaving = Math.max(effIncome - effExpense, 0);
    const monthlyRate = annualYield / 100 / 12;
    const monthlyInflation = inflation / 100 / 12;

    let investedNominal = effCapital;
    let piggyNominal = effCapital;

    for (let m = 0; m <= horizonMonths; m++) {
      if (m > 0) {
        investedNominal = investedNominal * (1 + monthlyRate) + monthlySaving;
        piggyNominal = piggyNominal + monthlySaving;
      }

      // Real value adjusted for inflation
      const deflator = Math.pow(1 + monthlyInflation, m);
      const investedReal = investedNominal / deflator;
      const piggyReal = piggyNominal / deflator;

      // Label every 12 months
      const d = new Date();
      d.setMonth(d.getMonth() + m);
      const lbl = d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });

      data.push({
        label: lbl,
        invested: Math.round(investedReal),
        piggybank: Math.round(piggyReal),
      });
    }
    return data;
  }, [effCapital, effIncome, effExpense, horizonMonths, annualYield, inflation]);

  // ── useDeferredValue: sliders instant, chart renders in background ───
  const deferredData = useDeferredValue(chartData);
  const isStale = deferredData !== chartData;

  const finalInvested = deferredData[deferredData.length - 1]?.invested ?? 0;
  const finalPiggy = deferredData[deferredData.length - 1]?.piggybank ?? 0;
  const advantage = finalInvested - finalPiggy;

  if (isDashLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-10 h-10 border-2 border-[#C5A059]/20 border-t-[#C5A059] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="max-w-7xl mx-auto space-y-10 py-8"
    >
      {/* ═══ HEADER: Chronos Core + Title (V.I.A. Standard) ═══ */}
      <div className="flex items-center gap-4">
        <ChronosCore />
        <div>
          <h1 className="text-[2.5rem] font-extrabold tracking-tight text-[#1C3F35] dark:text-white leading-none font-serif mb-1">
            Горизонт Капитала
          </h1>
          <p className="text-[10px] font-mono text-[#C5A059]/70 uppercase tracking-[0.3em] font-bold">
            Capital Horizon
          </p>
        </div>
      </div>

      {/* ═══ THE CONTROL DECK ═══ */}
      <div className="backdrop-blur-3xl bg-white/40 dark:bg-[#111111]/60 border border-[#1C3F35]/[0.06] dark:border-white/[0.04] rounded-[2rem] p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.6)]">

        {/* Block 1: Source Data Inputs — Glass Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {/* Стартовый капитал */}
          <div className="flex flex-col gap-2 p-5 bg-white/40 dark:bg-black/20 border border-white/20 dark:border-white/5 rounded-2xl shadow-sm">
            <label className="text-xs font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest">
              Стартовый капитал
            </label>
            <div className="flex items-baseline gap-1.5">
              <input
                type="text"
                inputMode="numeric"
                value={formatSum(startCapital)}
                onChange={(e) => setStartCapital(e.target.value.replace(/\D/g, ''))}
                className="text-2xl font-mono font-bold bg-transparent outline-none w-full text-[#1C3F35] dark:text-white"
              />
              <span className="text-sm font-semibold text-[#C5A059]/60 flex-shrink-0">₽</span>
            </div>
          </div>

          {/* Ежемесячный Доход */}
          <div className="flex flex-col gap-2 p-5 bg-white/40 dark:bg-black/20 border border-white/20 dark:border-white/5 rounded-2xl shadow-sm">
            <label className="text-xs font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest">
              Ежемесячный Доход
            </label>
            <div className="flex items-baseline gap-1.5">
              <input
                type="text"
                inputMode="numeric"
                value={formatSum(monthlyIncome)}
                onChange={(e) => setMonthlyIncome(e.target.value.replace(/\D/g, ''))}
                className="text-2xl font-mono font-bold bg-transparent outline-none w-full text-[#1C3F35] dark:text-white"
              />
              <span className="text-sm font-semibold text-[#C5A059]/60 flex-shrink-0">₽/мес</span>
            </div>
          </div>

          {/* Ежемесячные Расходы */}
          <div className="flex flex-col gap-2 p-5 bg-white/40 dark:bg-black/20 border border-white/20 dark:border-white/5 rounded-2xl shadow-sm">
            <label className="text-xs font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest">
              Ежемесячные Расходы
            </label>
            <div className="flex items-baseline gap-1.5">
              <input
                type="text"
                inputMode="numeric"
                value={formatSum(monthlyExpense)}
                onChange={(e) => setMonthlyExpense(e.target.value.replace(/\D/g, ''))}
                className="text-2xl font-mono font-bold bg-transparent outline-none w-full text-[#1C3F35] dark:text-white"
              />
              <span className="text-sm font-semibold text-[#C5A059]/60 flex-shrink-0">₽/мес</span>
            </div>
          </div>
        </div>

        {/* Block 2: Horizon Pills + Sliders */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Left: Horizon + Sliders */}
          <div className="space-y-8">
            {/* Horizon Pills */}
            <div>
              <label className="text-[10px] font-mono font-bold text-[#1C3F35]/50 dark:text-white/40 uppercase tracking-widest block mb-3">
                Горизонт Планирования
              </label>
              <div className="flex gap-2">
                {HORIZONS.map((h) => (
                  <button
                    key={h.months}
                    onClick={() => setHorizonMonths(h.months)}
                    className={`px-5 py-2.5 rounded-full text-sm font-bold tracking-tight transition-all duration-300 ${
                      horizonMonths === h.months
                        ? 'bg-[#FF7A00] text-white shadow-[0_4px_20px_rgba(255,122,0,0.35)]'
                        : 'bg-[#1C3F35]/[0.04] dark:bg-white/[0.04] text-[#1C3F35]/60 dark:text-white/50 hover:bg-[#1C3F35]/[0.08] dark:hover:bg-white/[0.08]'
                    }`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Annual Yield Slider */}
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <label className="text-[10px] font-mono font-bold text-[#1C3F35]/50 dark:text-white/40 uppercase tracking-widest">
                  Годовая Доходность
                </label>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {annualYield}%
                </span>
              </div>
              <input
                type="range" min="0" max="30" step="0.5"
                value={annualYield}
                onChange={(e) => setAnnualYield(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="text-[10px] font-mono text-[#1C3F35]/30 dark:text-white/20 flex justify-between font-bold">
                <span>0%</span><span>сложный процент</span><span>30%</span>
              </div>
            </div>

            {/* Inflation Slider */}
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <label className="text-[10px] font-mono font-bold text-[#1C3F35]/50 dark:text-white/40 uppercase tracking-widest">
                  Ожидаемая Инфляция
                </label>
                <span className="text-2xl font-black text-orange-500 dark:text-orange-400 tabular-nums">
                  {inflation}%
                </span>
              </div>
              <input
                type="range" min="0" max="20" step="0.5"
                value={inflation}
                onChange={(e) => setInflation(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <div className="text-[10px] font-mono text-[#1C3F35]/30 dark:text-white/20 flex justify-between font-bold">
                <span>0%</span><span>обесценивание</span><span>20%</span>
              </div>
            </div>
          </div>

          {/* Right: Bank Presets */}
          <div>
            <label className="text-[10px] font-mono font-bold text-[#1C3F35]/50 dark:text-white/40 uppercase tracking-widest block mb-3">
              Банковские Пресеты
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BANK_PRESETS.map((bank) => (
                <motion.button
                  key={bank.name}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setAnnualYield(bank.rate)}
                  className={`flex items-center gap-3 px-5 py-4 rounded-2xl border transition-all duration-300 text-left ${
                    annualYield === bank.rate
                      ? 'bg-[#FF7A00]/10 border-[#FF7A00]/30 shadow-[0_4px_20px_rgba(255,122,0,0.12)]'
                      : 'bg-white/30 dark:bg-white/[0.02] border-[#1C3F35]/[0.06] dark:border-white/[0.04] hover:border-[#1C3F35]/10 dark:hover:border-white/10'
                  }`}
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: bank.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#1C3F35] dark:text-white truncate">{bank.name}</p>
                  </div>
                  <span className={`text-lg font-black tabular-nums flex-shrink-0 ${
                    annualYield === bank.rate
                      ? 'text-[#FF7A00]'
                      : 'text-[#1C3F35]/60 dark:text-white/50'
                  }`}>
                    {bank.rate}%
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ RESULT BANNER ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Инвестиции (реальн.)', val: finalInvested, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Просто копилка (реальн.)', val: finalPiggy, color: 'text-slate-500 dark:text-slate-400' },
          { label: 'Преимущество инвестиций', val: advantage, color: 'text-[#FF7A00]' },
        ].map((m) => (
          <div
            key={m.label}
            className="bg-white/60 dark:bg-[#0A0A0A]/80 backdrop-blur-3xl border border-[#1C3F35]/[0.06] dark:border-white/[0.04] rounded-2xl p-6 text-center"
          >
            <p className="text-[10px] font-mono font-bold text-[#1C3F35]/40 dark:text-white/30 uppercase tracking-widest mb-2">
              {m.label}
            </p>
            <p className={`text-2xl font-extrabold tabular-nums tracking-tight ${m.color}`}>
              {m.val >= 0 ? '+' : ''}{m.val.toLocaleString('ru-RU')} ₽
            </p>
          </div>
        ))}
      </div>

      {/* ═══ DUAL REALITY CHART ═══ */}
      <div
        className={`bg-white/60 dark:bg-[#0A0A0A]/80 backdrop-blur-3xl border border-[#1C3F35]/[0.06] dark:border-white/[0.04] rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.6)] transition-opacity duration-300 ${isStale ? 'opacity-70' : 'opacity-100'}`}
      >
        <div className="mb-6">
          <h2 className="text-2xl font-serif font-bold text-[#1C3F35] dark:text-white tracking-tight">
            Двойная Реальность
          </h2>
        </div>

        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={deferredData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} style={{ outline: 'none' }}>
              <defs>
                {/* Neon Fade: emerald → neon-lime → transparent */}
                <linearGradient id="investGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="60%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#84cc16" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="investStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="70%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#84cc16" stopOpacity={0.4} />
                </linearGradient>
                <linearGradient id="investFillV" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(28, 63, 53, 0.05)" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.35 }}
                tickMargin={12}
                interval={Math.max(Math.floor(horizonMonths / 8), 1)}
                style={{ fontFamily: 'ui-monospace, monospace' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.35 }}
                tickFormatter={(v) => {
                  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
                  return `${v}`;
                }}
                tickMargin={8}
                style={{ fontFamily: 'ui-monospace, monospace' }}
              />
              <Tooltip
                content={<HorizonTooltip />}
                cursor={{ stroke: 'rgba(16, 185, 129, 0.15)', strokeWidth: 1 }}
                isAnimationActive={false}
                wrapperStyle={{ outline: 'none' }}
              />
              {/* Line 1: Invested (emerald neon) */}
              <Area
                type="monotone"
                dataKey="invested"
                stroke="url(#investStroke)"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#investFillV)"
                isAnimationActive={false}
                activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981', style: { filter: 'drop-shadow(0 0 6px rgba(16,185,129,0.7))' } }}
              />
              {/* Line 2: Piggybank (grey dashed) */}
              <Area
                type="monotone"
                dataKey="piggybank"
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="6 4"
                fillOpacity={0}
                fill="transparent"
                isAnimationActive={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: '#94a3b8' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 mt-6 pt-5 border-t border-[#1C3F35]/[0.06] dark:border-white/[0.04]">
          <div className="flex items-center gap-2">
            <span className="w-5 h-0.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-[#1C3F35]/70 dark:text-white/60">Инвестиции (реальн.)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-0.5 rounded-full bg-slate-400" style={{ borderTop: '2px dashed #94a3b8', background: 'none' }} />
            <span className="text-xs font-semibold text-[#1C3F35]/70 dark:text-white/60">Копилка (реальн.)</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
