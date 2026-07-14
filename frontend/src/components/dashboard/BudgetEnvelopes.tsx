import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { toast } from 'sonner';
import { deleteBudget, fetchGoals, contributeGoal } from '@/api/client';
import { cn } from '@/lib/utils';
import { getMoscowDate } from '@/lib/dateUtils'; // 🔥 ИСПРАВЛЕНИЕ МСК
import { Plus, Pencil, Trash } from 'lucide-react';
import type { CategoryRowSchema } from '@/types';
import { BudgetConfigModal } from './BudgetConfigModal';
import { getRussianCategoryName } from '@/lib/categories'; // 🔥 ИМПОРТ ЕДИНОГО СЛОВАРЯ

/** Фильтр карточек-конвертов (вкладки «Все / В норме / Перерасход»). */
export type EnvelopeFilter = 'all' | 'ok' | 'over';

/**
 * BudgetDiscipline — «Индекс дисциплины бюджета» (MVP-геймификация).
 * Считается из уже загруженных строк дашборда, без обращений к API:
 * доля конвертов «в норме» → индекс 0–100, тир-звание, сэкономлено/перерасход.
 */
export function BudgetDiscipline({ rows }: { rows: CategoryRowSchema[] }) {
  const total = rows.length;
  const onTrack = rows.filter((r) => parseFloat(r.fact) <= parseFloat(r.planned)).length;
  const overspent = rows.reduce((s, r) => s + Math.max(parseFloat(r.fact) - parseFloat(r.planned), 0), 0);
  const score = total ? Math.round((onTrack / total) * 100) : 0;

  const tier =
    score >= 90 ? 'Мастер бюджета'
    : score >= 70 ? 'Под контролем'
    : score >= 40 ? 'В балансе'
    : 'Зона риска';

  const barColor = score >= 70 ? '#10B981' : score >= 40 ? '#FF7A00' : '#F43F5E';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative overflow-hidden bg-white/40 dark:bg-[#111111]/40 backdrop-blur-3xl border border-black/5 dark:border-white/10 rounded-[2.5rem] p-6 md:p-8 shadow-lg"
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-10 w-64 h-64 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${barColor}33 0%, transparent 70%)` }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6">
        <div className="flex items-center gap-5">
          <div className="flex flex-col items-center shrink-0">
            <span className="text-5xl font-sans font-black tabular-nums leading-none" style={{ color: barColor }}>
              {score}
            </span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-[#1C3F35]/40 dark:text-white/40 mt-1">
              индекс
            </span>
          </div>
          <div>
            <p className="text-xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white leading-none">
              {tier}
            </p>
            <p className="text-[11px] md:text-[12px] font-sans font-extrabold uppercase tracking-wide text-[#FF7A00] mt-1.5">
              Дисциплина бюджета
            </p>
            <p className="text-xs font-bold text-[#1C3F35]/60 dark:text-white/50 mt-2">
              {onTrack} из {total} конвертов в норме
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col sm:flex-row items-stretch gap-4 md:justify-end">
          {overspent > 0 && (
            <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 px-5 py-3 text-center min-w-[140px]">
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-rose-600/70 dark:text-rose-400/70">
                Перерасход
              </p>
              <p className="text-lg font-sans font-black tabular-nums text-rose-600 dark:text-rose-500 tracking-tight">
                {Math.round(overspent).toLocaleString('ru-RU')}
                <span className="text-xs font-bold opacity-60 ml-1">₽</span>
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 mt-6 h-2.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          style={{ background: `linear-gradient(90deg, ${barColor}, ${barColor}bb)`, boxShadow: `0 0 12px ${barColor}66` }}
        />
      </div>
    </motion.div>
  );
}

// Детерминированный разлёт: 10 частиц по кругу (без Math.random — чистый рендер).
const CONFETTI_PIECES = [
  { x: -60, y: -72, rotate: 220, color: '#FF7A00', delay: 0.00, duration: 1.15 },
  { x: 55, y: -80, rotate: -180, color: '#10B981', delay: 0.05, duration: 1.30 },
  { x: -82, y: -22, rotate: 140, color: '#C5A059', delay: 0.02, duration: 1.05 },
  { x: 78, y: -30, rotate: -240, color: '#3B82F6', delay: 0.08, duration: 1.25 },
  { x: -34, y: -96, rotate: 300, color: '#EC4899', delay: 0.11, duration: 1.20 },
  { x: 30, y: -100, rotate: -120, color: '#FF7A00', delay: 0.04, duration: 1.35 },
  { x: -70, y: 30, rotate: 180, color: '#10B981', delay: 0.09, duration: 1.10 },
  { x: 65, y: 34, rotate: -200, color: '#C5A059', delay: 0.06, duration: 1.28 },
  { x: 6, y: -58, rotate: 260, color: '#3B82F6', delay: 0.13, duration: 1.18 },
  { x: -16, y: 44, rotate: -160, color: '#EC4899', delay: 0.07, duration: 1.22 },
];

/**
 * ConfettiBurst — лёгкий одноразовый разлёт частиц (framer-motion, без npm-пакетов).
 * Играет один раз при монтировании; используется на конвертах, закрытых «в плюс».
 */
function ConfettiBurst() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-30">
      {CONFETTI_PIECES.map((p, i) => (
        <motion.span
          key={i}
          className="absolute top-1/2 left-1/2 w-1.5 h-2.5 rounded-[1px]"
          style={{ backgroundColor: p.color }}
          initial={{ opacity: 0, x: 0, y: 0, rotate: 0, scale: 1 }}
          animate={{ opacity: [0, 1, 1, 0], x: p.x, y: p.y, rotate: p.rotate, scale: 0.5 }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

/**
 * SafeDoorIcon — дверца сейфа: круг со штурвалом-ручкой, золотое «дышащее»
 * свечение (#FF7A00/#FFD75E) и медленно вращающийся штурвал. Чистый SVG +
 * framer-motion, без картинок.
 */
function SafeDoorIcon() {
  // Спицы штурвала: 6 лучей от r=7 до r=12 (детерминированная геометрия).
  const spokes = [0, 60, 120, 180, 240, 300].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return {
      x1: 24 + 7 * Math.cos(rad),
      y1: 24 + 7 * Math.sin(rad),
      x2: 24 + 12 * Math.cos(rad),
      y2: 24 + 12 * Math.sin(rad),
    };
  });

  return (
    <div className="relative w-12 h-12 shrink-0" aria-hidden>
      {/* Дышащее золотое свечение */}
      <motion.div
        className="absolute -inset-1.5 rounded-2xl blur-md pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(255,215,94,0.45) 0%, rgba(255,122,0,0.22) 55%, transparent 80%)',
        }}
        animate={{ opacity: [0.45, 0.95, 0.45], scale: [1, 1.08, 1] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <svg viewBox="0 0 48 48" className="relative w-12 h-12">
        {/* Корпус дверцы */}
        <rect x="3" y="3" width="42" height="42" rx="11" fill="none" stroke="#FF7A00" strokeWidth="2.5" />
        {/* Петли */}
        <line x1="10" y1="12" x2="10" y2="18" stroke="#FFD75E" strokeWidth="2" strokeLinecap="round" />
        <line x1="10" y1="30" x2="10" y2="36" stroke="#FFD75E" strokeWidth="2" strokeLinecap="round" />
        {/* Обод замка */}
        <circle cx="24" cy="24" r="14" fill="none" stroke="#FFD75E" strokeWidth="2" opacity="0.9" />
        {/* Штурвал-ручка: медленно поворачивается */}
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        >
          <circle cx="24" cy="24" r="7" fill="none" stroke="#FF7A00" strokeWidth="2.5" />
          {spokes.map((s, i) => (
            <line
              key={i}
              x1={s.x1}
              y1={s.y1}
              x2={s.x2}
              y2={s.y2}
              stroke="#FF7A00"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          ))}
        </motion.g>
      </svg>
    </div>
  );
}

/**
 * Safe — «Сейф»: сэкономленное за месяц по конвертам (та же величина, что
 * в индексе дисциплины) + явное действие «Отложить в цель». Пополняет существующую
 * цель через PATCH /v1/goals/{id}/contribute (сумма строкой). Без авто-переносов.
 */
export function Safe({ rows }: { rows: CategoryRowSchema[] }) {
  const savedInt = Math.round(
    rows.reduce((s, r) => s + Math.max(parseFloat(r.planned) - parseFloat(r.fact), 0), 0),
  );
  const queryClient = useQueryClient();
  const { data: goals = [] } = useQuery({ queryKey: ['goals'], queryFn: fetchGoals, staleTime: 60_000 });
  const activeGoals = goals.filter((g) => g.progress_pct < 100);
  const [goalId, setGoalId] = useState<number | null>(null);
  // Защита от повторного переноса: `saved` не убывает после взноса, поэтому без
  // этого флага кнопку можно жать повторно и дублировать сумму в цели.
  const [allocated, setAllocated] = useState(false);

  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 90, damping: 22 });
  const savedDisplay = useTransform(spring, (v) => Math.round(v).toLocaleString('ru-RU'));
  useEffect(() => { mv.set(savedInt); }, [savedInt, mv]);

  const contribute = useMutation({
    mutationFn: (id: number) => contributeGoal(id, String(savedInt)),
    onSuccess: (g) => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      // Взнос теперь создаёт расходную транзакцию «Цель: …» — обновляем расходы.
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setAllocated(true);
      toast.success(`Отложено ${savedInt.toLocaleString('ru-RU')} ₽ в «${g.name}»`);
    },
    onError: (e: Error) => toast.error(`Ошибка: ${e.message}`),
  });

  if (savedInt <= 0) return null;

  const targetId = goalId ?? activeGoals[0]?.id ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative overflow-hidden bg-emerald-500/[0.07] dark:bg-emerald-500/[0.06] border border-emerald-500/20 rounded-[2.5rem] p-6 md:p-8 shadow-lg"
    >
      <div className="flex flex-col md:flex-row md:items-center gap-6">
        <div className="flex items-center gap-4">
          <SafeDoorIcon />
          <div>
            <p className="text-[11px] md:text-[12px] font-sans font-extrabold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              Сейф · сэкономлено за месяц
            </p>
            <p className="text-3xl md:text-4xl font-sans font-black tabular-nums tracking-tighter text-emerald-600 dark:text-emerald-400 leading-none mt-1">
              <motion.span>{savedDisplay}</motion.span>
              <span className="text-base font-bold opacity-60 ml-1.5">₽</span>
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col sm:flex-row items-stretch gap-3 md:justify-end">
          {activeGoals.length === 0 ? (
            <p className="self-center text-xs font-bold text-[#1C3F35]/50 dark:text-white/50 text-center sm:text-right max-w-[240px]">
              Создайте цель в «Горизонте капитала», чтобы откладывать сэкономленное.
            </p>
          ) : (
            <>
              <select
                value={targetId ?? ''}
                onChange={(e) => setGoalId(Number(e.target.value))}
                className="h-12 min-w-[160px] rounded-2xl bg-white/70 dark:bg-black/30 border border-emerald-500/20 px-4 text-sm font-bold text-[#1C3F35] dark:text-white outline-none cursor-pointer"
              >
                {activeGoals.map((g) => (
                  <option key={g.id} value={g.id} className="bg-white dark:bg-[#1A1A1A]">{g.name}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={contribute.isPending || targetId === null || allocated}
                onClick={() => targetId !== null && contribute.mutate(targetId)}
                className="h-12 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold uppercase tracking-wide shadow-[0_10px_20px_rgba(16,185,129,0.25)] transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {allocated ? 'Отложено ✓' : 'Отложить в цель'}
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * BudgetEnvelopes — грид карточек-конвертов. Данные дашборда получает сверху
 * (BudgetList делает единственный useQuery ['dashboard', start, end]);
 * `filter` — активная вкладка «Все / В норме / Перерасход».
 */
export function BudgetEnvelopes({
  rows,
  isLoading,
  filter = 'all',
}: {
  rows: CategoryRowSchema[];
  isLoading: boolean;
  filter?: EnvelopeFilter;
}) {
  const [selectedRow, setSelectedRow] = useState<CategoryRowSchema | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: ({ categoryId, month, year }: { categoryId: number, month: number, year: number }) =>
      deleteBudget(categoryId, month, year),
    onSuccess: () => {
      // ИСПРАВЛЕНИЕ: Инвалидируем правильный полный ключ кэша
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6 w-full">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-black/5 dark:bg-white/5 rounded-[2rem] p-6 min-h-[220px] animate-pulse border border-transparent">
            <div className="h-4 w-1/3 bg-black/10 dark:bg-white/10 rounded-lg mt-8 mx-auto" />
            <div className="h-10 w-2/3 bg-black/10 dark:bg-white/10 rounded-xl mt-4 mx-auto" />
            <div className="h-3 w-1/2 bg-black/10 dark:bg-white/10 rounded-lg mt-4 mx-auto" />
          </div>
        ))}
      </div>
    );
  }

  const expenseRows = rows.filter((r: CategoryRowSchema) => {
    if (filter === 'ok') return parseFloat(r.fact) <= parseFloat(r.planned);
    if (filter === 'over') return parseFloat(r.fact) > parseFloat(r.planned);
    return true;
  });

  const ghostCardClass = "bg-black/5 dark:bg-white/5 backdrop-blur-sm rounded-[2.5rem] p-8 min-h-[220px] flex flex-col items-center justify-center border-2 border-dashed border-black/10 dark:border-white/10 hover:border-[#FF7A00]/50 hover:bg-[#FF7A00]/5 cursor-pointer transition-all group shadow-sm hover:shadow-md";

  // На фильтрующих вкладках пустой результат — не приглашение создать конверт.
  if (expenseRows.length === 0 && filter !== 'all') {
    return (
      <p className="py-10 text-center text-sm font-bold text-[#1C3F35]/50 dark:text-white/40">
        {filter === 'ok' ? 'Нет конвертов в норме.' : 'Перерасходов нет — отличная дисциплина.'}
      </p>
    );
  }

  if (expenseRows.length === 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6 w-full">
        <motion.div
           onClick={() => setIsCreateModalOpen(true)}
           className={ghostCardClass}
         >
           <div className="w-16 h-16 rounded-2xl bg-[#FF7A00]/10 flex items-center justify-center mb-4 group-hover:scale-110 group-active:scale-95 transition-all">
             <Plus className="w-8 h-8 text-[#FF7A00]" />
           </div>
           <span className="font-sans font-extrabold tracking-tight text-lg text-[#1C3F35] dark:text-white">Создать Бюджет</span>
           <span className="text-[10px] font-mono text-[#FF7A00] uppercase tracking-[0.25em] mt-2 font-bold">Первый конверт</span>
       </motion.div>
       <BudgetConfigModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          row={null}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6 w-full">
      {expenseRows.map((row: CategoryRowSchema, index: number) => {
        const planned = parseFloat(row.planned);
        const fact = parseFloat(row.fact);
        const percent = planned > 0 ? (fact / planned) * 100 : 0;
        const isPositive = fact < planned; // конверт закрыт «в плюс» — есть экономия

        const categoryLower = row.category_name.toLowerCase();
        const isGuiltFree = categoryLower.includes('отдых') || categoryLower.includes('развлечения') || categoryLower.includes('leisure') || categoryLower.includes('бары') || categoryLower.includes('кафе') || categoryLower.includes('лайфстайл');

        const isOver = fact > planned;
        const isWarning = percent > 75 && !isOver;

        // 🔥 ИСПРАВЛЕНИЕ BUG-3: Burn Rate расчет по МСК времени
        const currentMsk = getMoscowDate();
        const todayDate = currentMsk.getDate();
        const daysInMonth = new Date(currentMsk.getFullYear(), currentMsk.getMonth() + 1, 0).getDate();
        const percentTimeElapsed = (todayDate / daysInMonth) * 100;
        const isBurnWarning = percent > (percentTimeElapsed + 10) && !isOver;

        // Прогноз закрытия: средний расход за прошедшие дни → день, когда
        // остаток обнулится. null, если тратить ещё не начинали (темпа нет).
        const dailyBurn = fact / Math.max(1, todayDate);
        const runOutDay =
          !isOver && dailyBurn > 0
            ? todayDate + Math.ceil((planned - fact) / dailyBurn)
            : null;

        const fillBgClasses = isGuiltFree
          ? "bg-gradient-to-t from-[#C5A059]/30 to-[#C5A059]/10"
          : isOver
          ? "bg-gradient-to-t from-rose-500/30 to-rose-400/10"
          : isWarning
          ? "bg-gradient-to-t from-[#FF7A00]/30 to-[#FF7A00]/10"
          : "bg-gradient-to-t from-emerald-500/30 to-emerald-400/10";

        return (
          <motion.div
            key={row.category_id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "bg-white/40 dark:bg-[#111111]/40 backdrop-blur-3xl border border-black/5 dark:border-white/10 rounded-[2.5rem]",
              "p-6 min-h-[220px] flex flex-col justify-between overflow-hidden relative group",
              "shadow-lg hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)] transition-all",
              "hover:border-[#FF7A00]/40 z-10 hover:-translate-y-1 hover:scale-[1.02] duration-300 ease-out",
              isOver && "border-rose-500/30 dark:border-rose-500/30"
            )}
          >
            {isPositive && <ConfettiBurst />}

            <div className="absolute top-4 right-4 z-50 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedRow(row); }}
                className="w-8 h-8 flex items-center justify-center bg-white/80 dark:bg-black/50 hover:bg-[#FF7A00] rounded-full backdrop-blur transition-colors text-[#1C3F35]/50 dark:text-white/50 hover:text-white"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // 🔥 ИСПРАВЛЕНИЕ МСК
                  const msktoday = getMoscowDate();
                  deleteMutation.mutate({ categoryId: row.category_id, month: msktoday.getMonth() + 1, year: msktoday.getFullYear() });
                }}
                className="w-8 h-8 flex items-center justify-center bg-white/80 dark:bg-black/50 hover:bg-rose-500 rounded-full backdrop-blur transition-colors text-rose-500/70 hover:text-white"
              >
                <Trash className="w-3.5 h-3.5" />
              </button>
            </div>

            {isBurnWarning && !isOver && (
              <div className="absolute top-5 left-6 z-20 px-2.5 py-1 bg-[#FF7A00]/10 border border-[#FF7A00]/20 rounded-lg flex items-center gap-1 shadow-sm">
                <span className="text-[9px] font-mono font-bold text-[#FF7A00] uppercase tracking-widest leading-none">Burn Rate</span>
              </div>
            )}

            <div className="relative z-10 flex flex-col justify-center items-center h-full gap-2 mt-auto mb-auto pointer-events-none">
              <div className="flex flex-col items-center gap-2 justify-center mb-1">
                {/* Индустриальная типографика: имя категории — крупный extrabold sans */}
                <h3 className="text-sm md:text-base font-sans font-extrabold tracking-tight text-[#1C3F35]/80 dark:text-white/80 leading-tight text-center">
                  {getRussianCategoryName(row.category_name)}
                </h3>
              </div>
              <div className="text-[#1C3F35] dark:text-white flex flex-col items-center">
                <span className="text-4xl md:text-5xl font-sans font-black tabular-nums tracking-tighter leading-none">
                  {fact.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                </span>
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-[#1C3F35]/40 dark:text-white/40 mt-2">
                  ИЗ {planned.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽
                </span>
                {/* Живой ритм конверта: сколько осталось и дневной темп до конца месяца */}
                <span
                  className={cn(
                    'text-[11px] font-sans font-bold mt-2.5 px-3 py-1 rounded-full',
                    isOver
                      ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10'
                      : 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10',
                  )}
                >
                  {isOver
                    ? `перерасход ${Math.round(fact - planned).toLocaleString('ru-RU')} ₽`
                    : `осталось ${Math.round(planned - fact).toLocaleString('ru-RU')} ₽ · ${Math.max(
                        0,
                        Math.floor((planned - fact) / Math.max(1, daysInMonth - todayDate + 1)),
                      ).toLocaleString('ru-RU')} ₽/день`}
                </span>

                {/* Прогноз закрытия: при текущем темпе трат конверт кончится … */}
                {!isOver && runOutDay !== null && (
                  <span
                    className={cn(
                      'text-[11px] font-sans font-semibold mt-1.5',
                      runOutDay <= daysInMonth
                        ? 'text-[#FF7A00]'
                        : 'text-[#1C3F35]/45 dark:text-white/40',
                    )}
                  >
                    {runOutDay <= daysInMonth
                      ? `⚡ при таком темпе кончится ${runOutDay}-го`
                      : 'при таком темпе хватит до конца месяца'}
                  </span>
                )}
              </div>
            </div>

            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${Math.min(100, Math.max(3, percent))}%` }}
              transition={{ delay: index * 0.1, type: 'spring', damping: 20, mass: 0.8 }}
              className={cn(
                "absolute bottom-0 left-0 w-full opacity-40 pointer-events-none z-0",
                fillBgClasses
              )}
            />
          </motion.div>
        );
      })}

      {filter === 'all' && (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: expenseRows.length * 0.08, duration: 0.4 }}
        onClick={() => setIsCreateModalOpen(true)}
        className={ghostCardClass}
      >
        <div className="w-16 h-16 rounded-2xl bg-[#FF7A00]/10 flex items-center justify-center mb-4 group-hover:scale-110 group-active:scale-95 transition-all">
          <Plus className="w-8 h-8 text-[#FF7A00]" />
        </div>
        <span className="font-sans font-extrabold tracking-tight text-lg text-[#1C3F35] dark:text-white">Новый Конверт</span>
        <span className="text-[10px] font-mono text-[#FF7A00]/80 uppercase tracking-[0.25em] mt-2 font-bold text-center">Выделить средства</span>
      </motion.div>
      )}
      </div>

      <BudgetConfigModal
        isOpen={!!selectedRow || isCreateModalOpen}
        onClose={() => {
          setSelectedRow(null);
          setIsCreateModalOpen(false);
        }}
        row={selectedRow}
      />
    </div>
  );
}