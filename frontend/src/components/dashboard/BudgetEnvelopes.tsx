import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { fetchDashboard, deleteBudget } from '@/api/client';
import { cn } from '@/lib/utils';
import { getLocalDateString, getMoscowDate } from '@/lib/dateUtils'; // 🔥 ИСПРАВЛЕНИЕ МСК
import { Plus, Pencil, Trash } from 'lucide-react';
import type { CategoryRowSchema } from '@/types';
import { BudgetConfigModal } from './BudgetConfigModal';
import { getRussianCategoryName } from '@/lib/categories'; // 🔥 ИМПОРТ ЕДИНОГО СЛОВАРЯ

export function BudgetEnvelopes() {
  const [selectedRow, setSelectedRow] = useState<CategoryRowSchema | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const queryClient = useQueryClient();

  // 🔥 ИСПРАВЛЕНИЕ МСК ВРЕМЕНИ ДЛЯ ЗАПРОСОВ (BUG-2 & BUG-3)
  const d = getMoscowDate();
  const start = getLocalDateString(new Date(d.getFullYear(), d.getMonth(), 1));
  const end = getLocalDateString(new Date(d.getFullYear(), d.getMonth() + 1, 0));

  const deleteMutation = useMutation({
    mutationFn: ({ categoryId, month, year }: { categoryId: number, month: number, year: number }) =>
      deleteBudget(categoryId, month, year),
    onSuccess: () => {
      // ИСПРАВЛЕНИЕ: Инвалидируем правильный полный ключ кэша
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard', start, end], // 🔥 ИСПРАВЛЕНИЕ BUG-2
    queryFn: () => fetchDashboard(start, end),
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

  const expenseRows = dashboard?.rows.filter((r: CategoryRowSchema) => {
    const planned = parseFloat(r.planned);
    return planned > 0;
  }) || [];

  const ghostCardClass = "bg-black/5 dark:bg-white/5 backdrop-blur-sm rounded-[2.5rem] p-8 min-h-[220px] flex flex-col items-center justify-center border-2 border-dashed border-black/10 dark:border-white/10 hover:border-[#FF7A00]/50 hover:bg-[#FF7A00]/5 cursor-pointer transition-all group shadow-sm hover:shadow-md";

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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6 w-full">
      {expenseRows.map((row: CategoryRowSchema, index: number) => {
        const planned = parseFloat(row.planned);
        const fact = parseFloat(row.fact);
        const percent = planned > 0 ? (fact / planned) * 100 : 0;

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
                <h3 className="text-[11px] font-mono font-bold uppercase tracking-[0.25em] text-[#1C3F35]/50 dark:text-white/40 leading-tight text-center">
                  {getRussianCategoryName(row.category_name)}
                </h3>
              </div>
              <div className="text-[#1C3F35] dark:text-white flex flex-col items-center">
                <span className="text-3xl md:text-4xl font-sans font-black tabular-nums tracking-tighter leading-none">
                  {fact.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                </span>
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-[#1C3F35]/40 dark:text-white/40 mt-2">
                  ИЗ {planned.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽
                </span>
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