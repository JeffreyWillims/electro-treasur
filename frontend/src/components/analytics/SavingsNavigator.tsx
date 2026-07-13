/**
 * SavingsNavigator.tsx — "Горизонт Капитала" (Capital Horizon)
 */
import { useState, useMemo, useDeferredValue } from 'react';
import { getLocalDateString, getMoscowDate } from '@/lib/dateUtils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  fetchDashboard, fetchAnalyticsProfile,
  fetchBankOffers, clickBankOffer, fetchLatestInsight, createGoal,
  downloadFinancialPlanPdf,
} from '@/api/client';
import { InsightHistory } from '@/components/insights/InsightHistory';
import { PsychopassportCard } from '@/components/analytics/PsychopassportCard';
import { TaxGuide } from '@/components/tax/TaxGuide';
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

type BankCard = {
  id: number | null;
  name: string;
  rate: number;
  color: string;
  partnerUrl: string | null;
};

// Фолбэк, если API офферов недоступен — актуальные ставки живут в БД (SQLAdmin).
const BANK_FALLBACK: BankCard[] = [
  { id: null, name: 'Альфа-Банк', rate: 16, color: '#EF3124', partnerUrl: null },
  { id: null, name: 'Т-Банк', rate: 15, color: '#FFDD2D', partnerUrl: null },
  { id: null, name: 'Сбер', rate: 14, color: '#21A038', partnerUrl: null },
  { id: null, name: 'ВТБ', rate: 13, color: '#002882', partnerUrl: null },
  { id: null, name: 'Газпромбанк', rate: 12, color: '#0071CE', partnerUrl: null },
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
  const { data: offersData } = useQuery({
    queryKey: ['bankOffers'],
    queryFn: fetchBankOffers,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const { data: aiInsight } = useQuery({
    queryKey: ['latestInsight'],
    queryFn: fetchLatestInsight,
    staleTime: 60_000,
    retry: 1,
  });

  const banks: BankCard[] = useMemo(
    () => offersData && offersData.length > 0
      ? offersData.map(o => ({
          id: o.id, name: o.name, rate: parseFloat(o.rate),
          color: o.color, partnerUrl: o.partner_url,
        }))
      : BANK_FALLBACK,
    [offersData],
  );

  const dbBalance = parseFloat(dashboard?.total_balance_all_time || '0');
  const dbExpense = parseFloat(dashboard?.period_expense || '0');
  const dbIncome = parseFloat(profile?.avg_income || '0');

  const [startCapital, setStartCapital] = useState<string>('');
  const [monthlyIncome, setMonthlyIncome] = useState<string>('');
  const [monthlyExpense, setMonthlyExpense] = useState<string>('');
  const [horizonMonths, setHorizonMonths] = useState(120);
  const [annualYield, setAnnualYield] = useState(16);
  const [inflation, setInflation] = useState(8);
  const [goalSum, setGoalSum] = useState<string>('');
  const [goalName, setGoalName] = useState<string>('');
  const [taxOpen, setTaxOpen] = useState(false);
  const queryClient = useQueryClient();

  const effCapital = startCapital !== '' ? parseSum(startCapital) : dbBalance;
  const effIncome = monthlyIncome !== '' ? parseSum(monthlyIncome) : dbIncome;
  const effExpense = monthlyExpense !== '' ? parseSum(monthlyExpense) : dbExpense;

  const monthlySaving = Math.max(effIncome - effExpense, 0);
  const cashflowNegative = effIncome > 0 && effExpense > effIncome;

  // Режим «Цель-Мечта»: обратный расчёт — сколько откладывать в месяц (номинально)
  const goalTarget = parseSum(goalSum);
  const requiredMonthly = useMemo(() => {
    if (goalTarget <= 0) return null;
    const n = horizonMonths;
    const r = annualYield / 100 / 12;
    const growth = Math.pow(1 + r, n);
    const req = r === 0
      ? (goalTarget - effCapital) / n
      : ((goalTarget - effCapital * growth) * r) / (growth - 1);
    return Math.max(Math.ceil(req), 0);
  }, [goalTarget, horizonMonths, annualYield, effCapital]);

  // Сохранить цель в приложение (ретеншн): target_date = сегодня + горизонт.
  const saveGoal = useMutation({
    mutationFn: () => {
      const due = getMoscowDate();
      due.setMonth(due.getMonth() + horizonMonths);
      return createGoal({
        name: goalName.trim() || 'Моя цель',
        target_amount: String(goalTarget),
        target_date: getLocalDateString(due),
        monthly_plan: requiredMonthly !== null ? String(requiredMonthly) : null,
      });
    },
    onSuccess: (g) => {
      setGoalName('');
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      toast.success(`Цель «${g.name}» сохранена — прогресс на дашборде`);
    },
    onError: (e: Error) => toast.error(`Ошибка: ${e.message}`),
  });

  // Сценарии: пессимист / база / оптимист (±4 п.п. к доходности), в реальных деньгах
  const scenarios = useMemo(() => {
    const n = horizonMonths;
    const deflator = Math.pow(1 + inflation / 100 / 12, n);
    return [
      { label: 'Пессимист', delta: -4 },
      { label: 'База', delta: 0 },
      { label: 'Оптимист', delta: 4 },
    ].map(({ label, delta }) => {
      const y = Math.max(annualYield + delta, 0);
      const r = y / 100 / 12;
      const growth = Math.pow(1 + r, n);
      const fv = r === 0
        ? effCapital + monthlySaving * n
        : effCapital * growth + (monthlySaving * (growth - 1)) / r;
      return { label, yieldPct: y, real: Math.round(fv / deflator) };
    });
  }, [effCapital, monthlySaving, horizonMonths, annualYield, inflation]);

  const openOffer = (bank: BankCard) => {
    if (!bank.partnerUrl) return;
    if (bank.id !== null) clickBankOffer(bank.id).catch(() => {});
    window.open(bank.partnerUrl, '_blank', 'noopener');
  };

  const chartData = useMemo(() => {
    const data: { label: string; invested: number; piggybank: number }[] = [];
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
  }, [effCapital, monthlySaving, horizonMonths, annualYield, inflation]);

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
  const premiumLabelStyle = "block mb-2 text-[14px] md:text-[15px] font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white";

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }} className="flex flex-col gap-10 w-full mt-4 pb-24">

      {/* ═══ ШАПКА ═══ */}
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

      {/* ═══ ПАНЕЛЬ УПРАВЛЕНИЯ ═══ */}
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

        {/* ═══ ЦЕЛЬ-МЕЧТА: обратный расчёт ═══ */}
        <div className="mb-12">
          <label className={premiumLabelStyle}>Цель-Мечта · сколько хочу накопить</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className={inputWrapperStyle}>
              <input
                type="text" inputMode="numeric" value={formatSum(goalSum)}
                onChange={(e) => setGoalSum(e.target.value.replace(/\D/g, ''))}
                className={inputStyles} placeholder="12 000 000"
              />
              <span className="text-lg font-bold opacity-40 text-[#1C3F35] dark:text-white tracking-normal ml-2">₽</span>
            </div>
            {requiredMonthly !== null && (
              <div className="px-5">
                <p className="text-[11px] font-sans font-extrabold uppercase tracking-wide text-[#1C3F35]/60 dark:text-white/50 mb-1">
                  Нужно откладывать
                </p>
                <p className={cn(
                  'text-2xl md:text-3xl font-sans font-black tabular-nums tracking-tighter leading-none',
                  requiredMonthly <= monthlySaving ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-500',
                )}>
                  {requiredMonthly.toLocaleString('ru-RU')}
                  <span className="text-sm font-bold opacity-60 tracking-normal ml-1">₽/мес</span>
                </p>
                <p className="text-[11px] font-sans font-extrabold text-[#1C3F35]/50 dark:text-white/40 mt-1">
                  {requiredMonthly <= monthlySaving
                    ? `Вы уже откладываете ${monthlySaving.toLocaleString('ru-RU')} ₽ — цель достижима ✓`
                    : `Сейчас откладываете ${monthlySaving.toLocaleString('ru-RU')} ₽ — не хватает ${(requiredMonthly - monthlySaving).toLocaleString('ru-RU')} ₽/мес`}
                </p>
              </div>
            )}
          </div>

          {/* Сохранить цель в приложение (ретеншн) */}
          {goalTarget > 0 && (
            <div className="flex flex-col sm:flex-row items-stretch gap-3 mt-6">
              <input
                type="text"
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
                maxLength={128}
                placeholder="Название цели (напр. «Ипотека»)"
                className="flex-1 min-w-0 rounded-full bg-black/5 dark:bg-white/10 px-5 py-3 text-sm outline-none focus:ring-2 ring-[#FF7A00]/40 text-[#1C3F35] dark:text-white"
              />
              <button
                type="button"
                onClick={() => saveGoal.mutate()}
                disabled={saveGoal.isPending}
                className="bg-[#1C3F35] dark:bg-[#FF7A00] text-white text-sm font-semibold py-3 px-6 rounded-full active:scale-[0.98] transition-transform disabled:opacity-50 whitespace-nowrap"
              >
                Сохранить цель
              </button>
            </div>
          )}
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
            <label className={premiumLabelStyle}>Вклады партнёров · подставить ставку</label>
            <div className="grid grid-cols-1 gap-3">
              {banks.map((bank) => (
                <div
                  key={bank.name}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-300 ${annualYield === bank.rate ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_10px_20px_rgba(16,185,129,0.1)]' : 'bg-black/5 dark:bg-white/5 border-transparent'}`}
                >
                  <button onClick={() => setAnnualYield(bank.rate)} className="flex items-center gap-3 flex-1 min-w-0 text-left outline-none">
                    <div className="w-4 h-4 rounded-full flex-shrink-0 shadow-inner" style={{ backgroundColor: bank.color }} />
                    <p className="text-sm md:text-base font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white truncate flex-1">{bank.name}</p>
                    <span className={`text-xl font-sans font-black tabular-nums flex-shrink-0 tracking-tighter ${annualYield === bank.rate ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#1C3F35]/50 dark:text-white/50'}`}>
                      {bank.rate}<span className="text-sm font-bold opacity-60 tracking-normal ml-0.5">%</span>
                    </span>
                  </button>
                  {bank.partnerUrl ? (
                    <motion.button
                      whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                      onClick={() => openOffer(bank)}
                      className="flex-shrink-0 px-4 py-2 rounded-xl text-white text-[11px] font-sans font-extrabold uppercase tracking-wide outline-none"
                      style={{ background: 'linear-gradient(135deg, #FF7A00, #FFB020)' }}
                    >
                      Открыть →
                    </motion.button>
                  ) : (
                    <span className="flex-shrink-0 px-3 py-2 text-[10px] font-sans font-bold uppercase tracking-wide text-[#1C3F35]/30 dark:text-white/25">
                      скоро
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ CASHFLOW-ОТРИЦАТЕЛЬНЫЙ АЛЕРТ ═══ */}
      {cashflowNegative && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center gap-4 bg-rose-500/10 border border-rose-500/30 rounded-[2rem] p-6 md:p-8"
        >
          <div className="flex-1">
            <p className="text-base md:text-lg font-sans font-black text-rose-600 dark:text-rose-400 tracking-tight">
              Вы тратите больше, чем зарабатываете
            </p>
            <p className="text-[12px] font-sans font-extrabold text-[#1C3F35]/60 dark:text-white/50 mt-1">
              Расходы {effExpense.toLocaleString('ru-RU')} ₽ &gt; доход {effIncome.toLocaleString('ru-RU')} ₽. Капитал не растёт — сначала закройте кассовый разрыв.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => toast.info('ИИ-план спасения появится, как только отработает ночная аналитика.')}
            className="flex-shrink-0 px-6 py-3 rounded-2xl text-white text-xs font-sans font-extrabold uppercase tracking-wide outline-none"
            style={{ background: 'linear-gradient(135deg, #F43F5E, #FB7185)' }}
          >
            План спасения от ИИ →
          </motion.button>
        </motion.div>
      )}

      {/* ═══ ИТОГОВЫЙ БАННЕР ═══ */}
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

      {/* ═══ ГРАФИК ДВОЙНОЙ РЕАЛЬНОСТИ ═══ */}
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

      {/* ═══ СЦЕНАРИИ: пессимист / база / оптимист ═══ */}
      <div>
        <p className="text-[11px] md:text-[12px] font-sans font-extrabold uppercase tracking-wide text-[#1C3F35]/60 dark:text-white/50 mb-4 px-2">
          Три сценария на {HORIZONS.find(h => h.months === horizonMonths)?.label ?? ''} · реальные деньги
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {scenarios.map((s, i) => (
            <div
              key={s.label}
              className={cn(
                'rounded-[2rem] p-6 text-center border shadow-lg backdrop-blur-3xl',
                i === 1
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-white/40 dark:bg-[#111111]/40 border-black/5 dark:border-white/10',
              )}
            >
              <p className="text-[11px] font-sans font-extrabold uppercase tracking-wide text-[#1C3F35]/70 dark:text-white/60">
                {s.label}
              </p>
              <p className="text-[10px] font-sans font-bold text-[#1C3F35]/40 dark:text-white/30 mb-2">
                {s.yieldPct}% годовых
              </p>
              <p className={cn(
                'text-xl md:text-2xl font-sans font-black tabular-nums tracking-tighter',
                i === 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#1C3F35] dark:text-white',
              )}>
                {s.real.toLocaleString('ru-RU')}
                <span className="text-sm font-bold opacity-60 tracking-normal ml-1">₽</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ ИИ-ПЛАН (Cashflow Prophet) ═══ */}
      {aiInsight && (
        <div className="bg-gradient-to-br from-[#FF7A00]/10 to-[#FFB020]/5 border border-[#FF7A00]/20 rounded-[2.5rem] p-8 md:p-10 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🤖</span>
            <div>
              <h2 className="text-lg md:text-xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white">
                Персональный план от ИИ
              </h2>
              <p className="text-[10px] font-sans font-extrabold uppercase tracking-wide text-[#FF7A00]">
                На основе ваших транзакций · {aiInsight.period_start} — {aiInsight.period_end}
              </p>
            </div>
          </div>
          <p className="text-sm md:text-base font-sans font-medium text-[#1C3F35]/90 dark:text-white/85 leading-relaxed whitespace-pre-line">
            {aiInsight.advice}
          </p>
        </div>
      )}

      <PsychopassportCard psychopassport={aiInsight?.psychopassport} />

      <InsightHistory />

      {/* ═══ ПОДЕЛИТЬСЯ ═══ */}
      <div className="flex flex-wrap justify-center gap-3">
        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => {
            const year = getMoscowDate().getFullYear() + Math.round(horizonMonths / 12);
            const text = `К ${year} у меня будет ${finalInvested.toLocaleString('ru-RU')} ₽ 🚀 — рассчитано в Citrine Vault`;
            if (navigator.share) {
              navigator.share({ text }).catch(() => {});
            } else {
              navigator.clipboard?.writeText(text);
              toast.success('Скопировано — делитесь!');
            }
          }}
          className="px-8 py-3.5 rounded-2xl text-white text-xs font-sans font-extrabold uppercase tracking-widest outline-none shadow-lg"
          style={{ background: 'linear-gradient(135deg, #1C3F35, #2d5f4f)' }}
        >
          Поделиться результатом
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => {
            toast.promise(downloadFinancialPlanPdf(), {
              loading: 'Формируем PDF…',
              success: 'PDF скачан',
              error: 'Не удалось сформировать PDF',
            });
          }}
          className="px-8 py-3.5 rounded-2xl text-[#1C3F35] dark:text-white text-xs font-sans font-extrabold uppercase tracking-widest outline-none shadow-lg border border-[#1C3F35]/20 dark:border-white/20"
        >
          Скачать PDF-план
        </motion.button>
      </div>

      {/* ═══ НАЛОГИ И ВЫЧЕТЫ (спрятано, раскрывается по клику) ═══ */}
      <div className="rounded-[2rem] border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/5 overflow-hidden">
        <button
          onClick={() => setTaxOpen((o) => !o)}
          className="w-full flex items-center justify-between px-7 py-5"
        >
          <span className="flex items-center gap-3 font-sans font-extrabold text-[#1C3F35] dark:text-white">
            <span className="text-xl">📚</span>
            Налоги и вычеты
            <span className="text-[11px] font-bold text-[#1C3F35]/40 dark:text-white/40 uppercase tracking-wide">
              калькулятор + поиск норм
            </span>
          </span>
          <motion.span animate={{ rotate: taxOpen ? 180 : 0 }} className="text-[#1C3F35]/40 dark:text-white/40">
            ▾
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {taxOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-7 pb-7">
                <TaxGuide embedded />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}