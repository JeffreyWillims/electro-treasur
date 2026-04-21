/* eslint-disable */
/**
 * MainAnalytics.tsx — Data Cortex (Single Query Orchestrator)
 *
 * Architecture: ONE useQuery fetches dashboard + categories.
 * All child charts receive pre-calculated data via props.
 * Zero redundant network calls. Zero local fetch logic in children.
 *
 * Aesthetic: "California Organic Luxury" — glass panels, organic typography,
 * muted pine/gold palette with premium micro-animations.
 */
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { fetchDashboard, fetchCategories } from '@/api/client';
import { SpendingChart } from '@/components/dashboard/SpendingChart';
import { CategoryPieChart } from '@/components/dashboard/CategoryPieChart';
import { CapitalGrowthChart } from '@/components/analytics/CapitalGrowthChart';
import type { DashboardResponse, CategoryRead, CategoryRowSchema } from '@/types';

// ── Russian Category Localization ──────────────────────────────────────
const getRussianCategoryName = (rawName: string): string => {
  const name = rawName.toLowerCase();
  if (name.includes('leisure') || name.includes('lifestyle')) return 'Отдых и развлечения';
  if (name.includes('housing')) return 'Жилье';
  if (name.includes('transport')) return 'Транспорт';
  if (name.includes('food')) return 'Еда и продукты';
  if (name.includes('health')) return 'Здоровье';
  if (name.includes('income')) return 'Доход';
  if (name.includes('shopping')) return 'Покупки';
  if (name.includes('utilit') || name.includes('operation')) return 'ЖКХ и Операции';
  if (name.includes('growth') || name.includes('invest')) return 'Инвестиции';
  return rawName;
};

// ── Holographic Prism SVG ──────────────────────────────────────────────
function HolographicPrism() {
  return (
    <div className="relative w-12 h-12 flex items-center justify-center">
      <svg viewBox="0 0 100 100" className="w-12 h-12" fill="none">
        {/* Orbital Ellipses — Pine Rings */}
        <ellipse
          cx="50" cy="50" rx="42" ry="18"
          stroke="#1C3F35" strokeOpacity="0.25" strokeWidth="1.2"
        />
        <ellipse
          cx="50" cy="50" rx="36" ry="30"
          stroke="#1C3F35" strokeOpacity="0.18" strokeWidth="1"
          transform="rotate(55 50 50)"
        />
        <ellipse
          cx="50" cy="50" rx="30" ry="24"
          stroke="#1C3F35" strokeOpacity="0.12" strokeWidth="0.8"
          transform="rotate(-35 50 50)"
        />

        {/* Pulsing Glow Core */}
        <motion.circle
          cx="50" cy="50" r="15"
          fill="#FF7A00" fillOpacity="0.1"
          filter="blur(6px)"
          animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Citrine Rhombus — Levitating Core */}
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "50px 50px" }}
        >
          <motion.path
            d="M 50 38 L 58 50 L 50 62 L 42 50 Z"
            fill="#FF7A00"
            fillOpacity="0.9"
            animate={{
              fillOpacity: [0.7, 1, 0.7],
              scale: [0.95, 1.05, 0.95],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "50px 50px", filter: "drop-shadow(0 0 6px rgba(255, 122, 0, 0.5))" }}
          />
        </motion.g>
      </svg>
    </div>
  );
}

// ── Data Aggregation Utilities ─────────────────────────────────────────
function aggregateDailyFlows(
  dashboard: DashboardResponse,
  categories: CategoryRead[],
) {
  const incomeIds = new Set(
    categories.filter(c => c.type === 'income').map(c => c.id),
  );

  const dayCount = dashboard.rows[0]?.days.length || 0;
  const days = Array.from({ length: dayCount }, (_, i) => ({
    day: i + 1,
    income: 0,
    expense: 0,
  }));

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

function aggregateCategoryTotals(rows: CategoryRowSchema[]) {
  return rows
    .map(r => ({
      name: getRussianCategoryName(r.category_name),
      value: parseFloat(r.fact),
      categoryId: r.category_id,
      type: r.type,
    }))
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value);
}

// ── Main Component ─────────────────────────────────────────────────────
export function MainAnalytics() {
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0] as string;
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return d.toISOString().split('T')[0] as string;
  });

  // ── DATA CORTEX: Single Orchestrated Query ───────────────────────────
  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard', startDate, endDate],
    queryFn: () => fetchDashboard(startDate, endDate),
  });

  const { data: categories = [], isLoading: catLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  const isLoading = dashLoading || catLoading;

  // ── Pre-Calculated Data Tensors ──────────────────────────────────────
  const dailyFlows = useMemo(() => {
    if (!dashboard || !categories.length) return [];
    return aggregateDailyFlows(dashboard, categories);
  }, [dashboard, categories]);

  const categoryTotals = useMemo(() => {
    if (!dashboard) return [];
    return aggregateCategoryTotals(dashboard.rows);
  }, [dashboard]);

  const totalIncome = useMemo(() =>
    dailyFlows.reduce((s, d) => s + d.income, 0),
    [dailyFlows],
  );

  const totalExpense = useMemo(() =>
    dailyFlows.reduce((s, d) => s + d.expense, 0),
    [dailyFlows],
  );

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="max-w-7xl mx-auto space-y-14 py-8"
    >
      {/* ═══ HEADER: Holographic Prism + Title + Date Picker ═══ */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <HolographicPrism />
          <div>
            <h1 className="text-[2.5rem] font-extrabold tracking-tight text-[#1C3F35] dark:text-white leading-none font-serif">
              Аналитика
            </h1>
            <p className="text-[10px] font-mono text-[#1C3F35] dark:text-emerald-500 uppercase tracking-[0.3em] font-bold mt-1">
              V.I.A. Data Cortex
            </p>
          </div>
        </div>

        {/* Glass Date Picker */}
        <div className="flex items-center gap-3 bg-white/60 dark:bg-[#111111]/80 backdrop-blur-xl border border-[#1C3F35]/10 dark:border-white/5 p-1.5 rounded-full shadow-sm transition-colors">
          <div className="flex items-center gap-2 px-3">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="appearance-none bg-transparent text-[#1C3F35] dark:text-white/80 text-sm font-semibold outline-none cursor-pointer"
              style={{ colorScheme: 'light dark' }}
            />
            <span className="text-[#1C3F35]/20 dark:text-white/20 font-medium text-sm">—</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="appearance-none bg-transparent text-[#1C3F35] dark:text-white/80 text-sm font-semibold outline-none cursor-pointer"
              style={{ colorScheme: 'light dark' }}
            />
          </div>
        </div>
      </div>

      {/* ═══ LOADING STATE ═══ */}
      {isLoading && (
        <div className="flex items-center justify-center py-32">
          <div className="w-10 h-10 border-2 border-aura-gold/20 border-t-aura-gold rounded-full animate-spin" />
        </div>
      )}

      {/* ═══ THE THREE DATA STORIES ═══ */}
      {!isLoading && (
        <div className="flex flex-col gap-14">
          {/* Story 1: Cashflow Pulse */}
          <SpendingChart
            dailyFlows={dailyFlows}
            totalIncome={totalIncome}
            totalExpense={totalExpense}
          />

          {/* Story 2: The Money Eater */}
          <CategoryPieChart categoryTotals={categoryTotals} />

          {/* Story 3: Capital Growth */}
          <CapitalGrowthChart dailyFlows={dailyFlows} />
        </div>
      )}
    </motion.div>
  );
}
