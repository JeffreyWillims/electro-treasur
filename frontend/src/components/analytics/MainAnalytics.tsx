/**
 * MainAnalytics.tsx — информационное ядро (единый оркестратор запросов)
 */
import { useState, useMemo } from 'react';
import { GlassDateRangePicker } from '@/components/ui/GlassDateRangePicker';
import { getLocalDateString, getMoscowDate } from '@/lib/dateUtils';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { fetchDashboard, fetchCategories, fetchPsychopassport } from '@/api/client';
import { PsychopassportCard } from '@/components/analytics/PsychopassportCard';
import { AnalyticsHero } from '@/components/analytics/AnalyticsHero';
import type { PersonaCode } from '@/lib/purchaseAdvice';
import { SpendingChart } from '@/components/dashboard/SpendingChart';
import { CategoryPieChart } from '@/components/dashboard/CategoryPieChart';
import { HealthScoreCard } from '@/components/dashboard/HealthScoreCard';
import { PurchaseAdvisor } from '@/components/dashboard/PurchaseAdvisor';
import { DailyTip } from '@/components/analytics/DailyTip';
import { CapitalGrowthChart } from '@/components/analytics/CapitalGrowthChart';
import type { DashboardResponse, CategoryRead, CategoryRowSchema } from '@/types';

// ── УНИФИЦИРОВАННЫЙ СЛОВАРЬ (Citrine Vault Standard) ───────────────────
const CATEGORY_TRANSLATIONS: Record<string, string> = {
  "Operations (Rent/Utility)": "Базовые расходы",
  "Leisure (Lifestyle)": "Лайфстайл",
  "Wellness (Health)": "Здоровье и Уход",
  "Propulsion (Income)": "Поступления",
  "Growth (Investments)": "Инвестиции",
  "Income": "Доход",
};

const getRussianCategoryName = (rawName: string): string => {
  if (CATEGORY_TRANSLATIONS[rawName]) return CATEGORY_TRANSLATIONS[rawName];
  const name = rawName.toLowerCase();
  if (name.includes('leisure') || name.includes('lifestyle')) return 'Лайфстайл';
  if (name.includes('housing')) return 'Жилье';
  if (name.includes('transport') || name.includes('logistics')) return 'Транспорт';
  if (name.includes('food')) return 'Продукты';
  if (name.includes('health') || name.includes('wellness')) return 'Здоровье';
  if (name.includes('income') || name.includes('propulsion')) return 'Доход';
  if (name.includes('shopping')) return 'Покупки';
  if (name.includes('utilit') || name.includes('operation')) return 'ЖКХ и Операции';
  if (name.includes('growth') || name.includes('invest')) return 'Инвестиции';
  return rawName;
};

function HolographicPrism() {
  return (
    <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
      <svg viewBox="0 0 100 100" className="w-12 h-12" fill="none">
        <motion.g animate={{ rotate: 360 }} transition={{ duration: 40, repeat: Infinity, ease: "linear" }} style={{ transformOrigin: "50px 50px" }}>
          <ellipse cx="50" cy="50" rx="42" ry="18" stroke="currentColor" className="text-[#1C3F35]/30 dark:text-emerald-500/30" strokeWidth="1.5" />
        </motion.g>
        <motion.g animate={{ rotate: -360 }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }} style={{ transformOrigin: "50px 50px" }}>
          <ellipse cx="50" cy="50" rx="36" ry="30" stroke="currentColor" className="text-[#1C3F35]/20 dark:text-emerald-500/20" strokeWidth="1" transform="rotate(55 50 50)" />
        </motion.g>
        <motion.g animate={{ rotate: 360 }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }} style={{ transformOrigin: "50px 50px" }}>
          <ellipse cx="50" cy="50" rx="30" ry="24" stroke="currentColor" className="text-[#1C3F35]/10 dark:text-emerald-500/10" strokeWidth="0.8" transform="rotate(-35 50 50)" />
        </motion.g>

        <motion.circle
          cx="50" cy="50" r="15"
          className="fill-[#FF7A00]"
          style={{ filter: "drop-shadow(0 0 10px rgba(255,122,0,0.8))" }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.g animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }} style={{ transformOrigin: "50px 50px" }}>
          <motion.path
            d="M 50 38 L 58 50 L 50 62 L 42 50 Z"
            fill="#FF7A00"
            animate={{ fillOpacity: [0.7, 1, 0.7], scale: [0.95, 1.05, 0.95] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            style={{ filter: "drop-shadow(0 0 6px rgba(255, 122, 0, 0.5))" }}
          />
        </motion.g>
      </svg>
    </div>
  );
}

/**
 * Дневные потоки за период. `day` — офсет от начала диапазона (так считает бэк),
 * `label` — настоящая календарная дата: без неё графики подписывали «12-е»
 * двенадцатым днём периода, а не двенадцатым числом месяца.
 */
function aggregateDailyFlows(
  dashboard: DashboardResponse,
  categories: CategoryRead[],
  startDate: string,
) {
  const incomeIds = new Set(categories.filter(c => c.type === 'income').map(c => c.id));
  const dayCount = dashboard.rows[0]?.days.length || 0;
  const start = new Date(`${startDate}T00:00:00`);
  const days = Array.from({ length: dayCount }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return {
      day: i + 1,
      label: d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
      dayOfMonth: d.getDate(),
      date: getLocalDateString(d),
      income: 0,
      expense: 0,
    };
  });

  dashboard.rows.forEach(row => {
    const isIncome = incomeIds.has(row.category_id);
    row.days?.forEach(cell => {
      const idx = cell.day - 1;
      const amt = parseFloat(cell.amount?.toString() || '0');
      if (idx >= 0 && idx < dayCount && days[idx]) {
        if (isIncome) days[idx].income += amt;
        else days[idx].expense += amt;
      }
    });
  });

  return days;
}

function aggregateCategoryTotals(rows: CategoryRowSchema[], categories: CategoryRead[]) {
  return rows
    .map(r => {
      const catDef = categories.find(c => c.id === r.category_id);
      return {
        name: getRussianCategoryName(r.category_name),
        value: parseFloat(r.fact),
        categoryId: r.category_id,
        type: catDef?.type || 'expense',
        color: catDef?.icon || undefined,
      };
    })
    // ИСПРАВЛЕНИЕ БАГА: Строго фильтруем только расходы (expense)
    .filter(r => r.value > 0 && r.type === 'expense')
    .sort((a, b) => b.value - a.value);
}

export function MainAnalytics() {
  const [startDate, setStartDate] = useState<string>(() => {
    const d = getMoscowDate(); d.setDate(1); return getLocalDateString(d);
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const d = getMoscowDate(); d.setMonth(d.getMonth() + 1); d.setDate(0); return getLocalDateString(d);
  });

  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard', startDate, endDate],
    queryFn: () => fetchDashboard(startDate, endDate),
  });

  const { data: categories = [], isLoading: catLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  const isLoading = dashLoading || catLoading;

  const dailyFlows = useMemo(() => {
    if (!dashboard || !categories.length) return [];
    return aggregateDailyFlows(dashboard, categories, startDate);
  }, [dashboard, categories, startDate]);

  const categoryTotals = useMemo(() => {
    if (!dashboard || !categories.length) return [];
    return aggregateCategoryTotals(dashboard.rows, categories);
  }, [dashboard, categories]);

  const totalIncome = useMemo(() => dailyFlows.reduce((s, d) => s + d.income, 0), [dailyFlows]);
  const totalExpense = useMemo(() => dailyFlows.reduce((s, d) => s + d.expense, 0), [dailyFlows]);

  // Психопаспорт за выбранный период. Считается по требованию, поэтому виден
  // всем, а не только тем, кого успел обработать месячный воркер.
  const { data: psychopassport } = useQuery({
    queryKey: ['psychopassport', startDate, endDate],
    queryFn: () => fetchPsychopassport(startDate, endDate),
    staleTime: 5 * 60_000,
    retry: false,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="flex flex-col gap-10 w-full mt-4 pb-24"
    >
      {/* ═══ ШАПКА ═══ */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-2">
        <div className="flex items-center gap-4">
          <HolographicPrism />
          <div>
            <h1 className="text-3xl md:text-4xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white leading-none">
              Аналитика
            </h1>
            {/* ИСПРАВЛЕНИЕ: Подпись удалена */}
          </div>
        </div>

        <GlassDateRangePicker
          startDate={startDate} endDate={endDate}
          onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
          align="right"
        />
      </div>

      {/* ═══ СОСТОЯНИЕ ЗАГРУЗКИ ═══ */}
      {isLoading && (
        <div className="flex items-center justify-center py-32">
           <motion.div
             className="w-10 h-10 border-2 border-[#1C3F35]/20 dark:border-white/20 border-t-[#FF7A00] rounded-full"
             animate={{ rotate: 360 }}
             transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
           />
        </div>
      )}

      {/* ═══ ТРИ ИСТОРИИ ДАННЫХ ═══ */}
      {!isLoading && (
        <div className="flex flex-col gap-8 w-full">
          <AnalyticsHero
            capital={parseFloat(dashboard?.total_balance_all_time ?? '0') || 0}
            income={totalIncome}
            expense={totalExpense}
          />
          <DailyTip
            income={totalIncome}
            expense={totalExpense}
            topCategory={
              categoryTotals[0]
                ? { name: categoryTotals[0].name, amount: categoryTotals[0].value }
                : null
            }
            persona={(psychopassport?.persona_code ?? null) as PersonaCode | null}
          />
          <PsychopassportCard psychopassport={psychopassport} />
          <PurchaseAdvisor startDate={startDate} endDate={endDate} />
          <HealthScoreCard />
          <SpendingChart dailyFlows={dailyFlows} totalIncome={totalIncome} totalExpense={totalExpense} />
          <CategoryPieChart categoryTotals={categoryTotals} />
          <CapitalGrowthChart dailyFlows={dailyFlows} />
        </div>
      )}
    </motion.div>
  );
}