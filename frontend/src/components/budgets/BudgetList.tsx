import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, RotateCcw } from 'lucide-react';
import {
  BudgetDiscipline,
  BudgetEnvelopes,
  Safe,
  type EnvelopeFilter,
} from '@/components/dashboard/BudgetEnvelopes';
import { SafeToSpend } from '@/components/dashboard/SafeToSpend';
import { GoalsProgress } from '@/components/dashboard/GoalsProgress';
import { fetchDashboard } from '@/api/client';
import { getLocalDateString, getMoscowDate } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import type { CategoryRowSchema } from '@/types';

/**
 * AutoBudgetCard — один из двух всегда видимых авто-конвертов 80/20.
 * Лимит по умолчанию — доля от дохода месяца; клик по сумме — ручной оверрайд,
 * который хранится в localStorage (`cv_budget8020_{life|save}:{YYYY-MM}`),
 * кнопка «↺ авто» сбрасывает к расчётному значению.
 */
function AutoBudgetCard({
  storageKey,
  title,
  autoLimit,
  fact,
  factLabel,
  accent,
  overIsGood = false,
}: {
  storageKey: string;
  title: string;
  autoLimit: number;
  fact: number;
  factLabel: string;
  accent: string;
  /** Для карточки сбережений превышение лимита — победа, а не перерасход. */
  overIsGood?: boolean;
}) {
  const [override, setOverride] = useState<number | null>(() => {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw === null ? NaN : parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const limit = override ?? autoLimit;
  const percent = limit > 0 ? (fact / limit) * 100 : 0;
  const isOver = limit > 0 && fact > limit;
  // Зоны индикатора: <75% — зелёный, 75–100% — жёлтый, >100% — красный;
  // на карточке сбережений перевыполнение — зелёная победа.
  const barColor = isOver
    ? overIsGood ? '#10B981' : '#FB923C'
    : percent >= 75 ? '#F59E0B' : '#10B981';
  const statusSuffix = isOver ? (overIsGood ? ' · цель перевыполнена' : ' · над планом') : '';
  // «2000% лимита» кричит и пугает; спокойное «×N» читается мягче и понятнее.
  const percentLabel = percent >= 200
    ? `${Math.round(percent / 100)}× лимита`
    : `${Math.round(percent)}% лимита`;

  const commitDraft = () => {
    setEditing(false);
    const value = parseInt(draft.replace(/\D/g, ''), 10);
    if (Number.isFinite(value) && value > 0) {
      localStorage.setItem(storageKey, String(value));
      setOverride(value);
    }
  };

  const resetToAuto = () => {
    localStorage.removeItem(storageKey);
    setOverride(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative overflow-hidden bg-white/40 dark:bg-[#111111]/40 backdrop-blur-3xl border border-black/5 dark:border-white/10 rounded-[2.5rem] p-6 md:p-8 shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className="text-[11px] md:text-[12px] font-sans font-extrabold uppercase tracking-wide"
            style={{ color: accent }}
          >
            {title}
          </p>
          <p className="text-xs font-bold text-[#1C3F35]/50 dark:text-white/40 mt-1">
            {override !== null
              ? 'своя сумма'
              : autoLimit > 0
                ? 'авто-расчёт от дохода месяца'
                : 'дохода пока нет — задай сумму кликом по «0 ₽»'}
          </p>
        </div>
        {override !== null && (
          <button
            type="button"
            onClick={resetToAuto}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/10 text-[10px] font-mono font-bold uppercase tracking-widest text-[#1C3F35]/60 dark:text-white/60 hover:text-[#FF7A00] transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> авто
          </button>
        )}
      </div>

      <div className="mt-4 flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl md:text-3xl font-sans font-extrabold tabular-nums tracking-tight text-[#1C3F35] dark:text-white leading-none">
          {Math.round(fact).toLocaleString('ru-RU')}
          <span className="text-base font-bold opacity-50 ml-1">₽</span>
        </span>
        <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-white/40">
          {factLabel} из
        </span>
        {editing ? (
          <input
            autoFocus
            type="text"
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitDraft();
              if (e.key === 'Escape') setEditing(false);
            }}
            className="w-32 rounded-xl bg-black/5 dark:bg-white/10 px-3 py-1 text-lg font-sans font-black tabular-nums text-[#1C3F35] dark:text-white outline-none focus:ring-2 ring-[#FF7A00]/40"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(String(Math.round(limit)));
              setEditing(true);
            }}
            title="Изменить лимит"
            className="text-lg font-sans font-black tabular-nums tracking-tight text-[#1C3F35]/70 dark:text-white/60 border-b border-dashed border-[#FF7A00]/50 hover:text-[#FF7A00] transition-colors"
          >
            {Math.round(limit).toLocaleString('ru-RU')} ₽
          </button>
        )}
      </div>

      <div className="mt-5 h-2.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(2, percent))}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background: `linear-gradient(90deg, ${barColor}, ${barColor}bb)`,
            boxShadow: `0 0 12px ${barColor}66`,
          }}
        />
      </div>
      <p className="mt-2 text-xs font-bold uppercase tracking-widest">
        <span
          className={isOver ? undefined : 'text-gray-500 dark:text-white/40'}
          style={isOver ? { color: barColor } : undefined}
        >
          {percentLabel}{statusSuffix}
        </span>
      </p>
    </motion.div>
  );
}

/**
 * AutoBudgets8020 — правило 80/20 от дохода текущего месяца: «Бюджет на жизнь»
 * (80%, факт = расходы месяца) и «Бюджет на сбережения» (20%, факт = отложено,
 * т.е. доход − расход, не меньше 0). Видны всегда, даже без конвертов.
 */
function AutoBudgets8020({ income, expense, monthKey }: { income: number; expense: number; monthKey: string }) {
  const saved = Math.max(income - expense, 0);

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Заголовок-инструкция: правило одной строкой, живыми цифрами месяца */}
      <div className="px-2">
        <h2 className="text-xl md:text-2xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white leading-none">
          Правило 80/20
        </h2>
        <p className="mt-2 text-[13px] font-sans font-semibold leading-relaxed text-[#1C3F35]/60 dark:text-white/50 max-w-2xl">
          {income > 0 ? (
            <>
              Из дохода {Math.round(income).toLocaleString('ru-RU')} ₽ этот месяц живёт на{' '}
              <span className="text-[#FF7A00] font-extrabold">
                {Math.round(income * 0.8).toLocaleString('ru-RU')} ₽
              </span>
              , а{' '}
              <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                {Math.round(income * 0.2).toLocaleString('ru-RU')} ₽
              </span>{' '}
              уходит в сбережения. Лимиты пересчитываются сами; клик по сумме — свой лимит,
              кнопка «↺ авто» вернёт расчётный.
            </>
          ) : (
            <>
              Добавьте доход этого месяца — и лимиты «на жизнь» и «на сбережения» посчитаются
              сами. Или задайте суммы вручную кликом по «0 ₽».
            </>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
      <AutoBudgetCard
        storageKey={`cv_budget8020_life:${monthKey}`}
        title="Бюджет на жизнь · 80%"
        autoLimit={Math.round(income * 0.8)}
        fact={expense}
        factLabel="потрачено"
        accent="#FF7A00"
      />
      <AutoBudgetCard
        storageKey={`cv_budget8020_save:${monthKey}`}
        title="Бюджет на сбережения · 20%"
        autoLimit={Math.round(income * 0.2)}
        fact={saved}
        factLabel="отложено"
        accent="#10B981"
        overIsGood
      />
      </div>
    </div>
  );
}

const ENVELOPES_OPEN_KEY = 'cv_envelopes_open';

const FILTER_TABS: { value: EnvelopeFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'ok', label: 'В норме' },
  { value: 'over', label: 'Перерасход' },
];

export function BudgetList() {
  const currentMonth = new Date().toLocaleString('ru-RU', { month: 'long' });
  const capitalizedMonth = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);

  // 🔥 МСК-границы месяца — тот же ключ кеша ['dashboard', start, end], что и у дашборда
  const d = getMoscowDate();
  const start = getLocalDateString(new Date(d.getFullYear(), d.getMonth(), 1));
  const end = getLocalDateString(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard', start, end],
    queryFn: () => fetchDashboard(start, end),
  });

  const expenseRows =
    dashboard?.rows.filter(
      // Только расходные: доходная категория с планом не должна попадать в
      // конверты и искажать индекс дисциплины (находка QA-агента).
      (r: CategoryRowSchema) => parseFloat(r.planned) > 0 && r.type !== 'income',
    ) || [];

  const [envelopesOpen, setEnvelopesOpen] = useState(
    () => localStorage.getItem(ENVELOPES_OPEN_KEY) !== '0',
  );
  const [filter, setFilter] = useState<EnvelopeFilter>('all');

  const toggleEnvelopes = () => {
    setEnvelopesOpen((open) => {
      localStorage.setItem(ENVELOPES_OPEN_KEY, open ? '0' : '1');
      return !open;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="flex flex-col gap-10 w-full mt-4 pb-24"
    >
      {/* ── ЗАГОЛОВОК СТРАНИЦЫ ── */}
      <div className="mb-2">
        <h1 className="text-3xl md:text-4xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white leading-none">
          Бюджеты
        </h1>
      </div>

      {/* ── БЛОК БЕЗОПАСНЫХ ТРАТ ── */}
      <div className="w-full">
        <SafeToSpend />
      </div>

      {/* ── МОИ ЦЕЛИ (переехали с главной: копим — значит бюджетируем) ── */}
      <GoalsProgress />

      {/* ── ДИСЦИПЛИНА И СЕЙФ (выше конвертов, рендерятся ровно один раз) ── */}
      {expenseRows.length > 0 && <BudgetDiscipline rows={expenseRows} />}
      {expenseRows.length > 0 && <Safe rows={expenseRows} />}

      {/* ── АВТО-БЮДЖЕТЫ 80/20 ── */}
      <AutoBudgets8020
        income={parseFloat(dashboard?.period_income ?? '0') || 0}
        expense={parseFloat(dashboard?.period_expense ?? '0') || 0}
        monthKey={monthKey}
      />

      {/* ── ОКНО КОНВЕРТОВ: живое стекло, сворачиваемое ── */}
      <section className="w-full bg-white/40 dark:bg-[#111111]/40 backdrop-blur-3xl border border-black/5 dark:border-white/10 rounded-[2.5rem] shadow-lg overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-6 md:p-8">
          <div className="flex-1 flex flex-col gap-1.5">
            <h2 className="text-xl md:text-2xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white leading-none">
              Конверты на {capitalizedMonth}
            </h2>
            <p className="text-[11px] md:text-[12px] font-sans font-extrabold uppercase tracking-wide text-[#FF7A00] dark:drop-shadow-[0_0_8px_rgba(255,122,0,0.5)]">
              Актуальные лимиты и перерасходы
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Вкладки-фильтры */}
            <div className="flex items-center gap-1 p-1 rounded-full bg-black/5 dark:bg-white/10">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setFilter(tab.value)}
                  className={cn(
                    'px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap',
                    filter === tab.value
                      ? 'bg-[#FF7A00] text-white shadow-[0_4px_12px_rgba(255,122,0,0.35)]'
                      : 'text-[#1C3F35]/60 dark:text-white/50 hover:text-[#FF7A00]',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Шеврон открыть/закрыть */}
            <button
              type="button"
              onClick={toggleEnvelopes}
              aria-label={envelopesOpen ? 'Свернуть конверты' : 'Развернуть конверты'}
              className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-[#1C3F35]/60 dark:text-white/60 hover:text-[#FF7A00] transition-colors"
            >
              <motion.span
                animate={{ rotate: envelopesOpen ? 180 : 0 }}
                transition={{ duration: 0.3 }}
                className="flex"
              >
                <ChevronDown className="w-5 h-5" />
              </motion.span>
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {envelopesOpen && (
            <motion.div
              key="envelopes"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="px-6 md:px-8 pb-6 md:pb-8">
                <BudgetEnvelopes rows={expenseRows} isLoading={isLoading} filter={filter} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </motion.div>
  );
}
