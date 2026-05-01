/**
 * BudgetEnvelopes — Premium "envelope" budget visualization cards.
 * Each category is a visual "envelope" showing fill level with animated progress.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { fetchDashboard, deleteBudget } from '@/api/client';
import { cn } from '@/lib/utils';
import { getLocalDateString } from '@/lib/dateUtils';
import { Plus, Pencil, Trash } from 'lucide-react';
import type { CategoryRowSchema } from '@/types';
import { BudgetConfigModal } from './BudgetConfigModal';

const ENVELOPE_ICONS = ['🏠', '🛒', '🚗', '📱', '🎭', '💊', '🎓', '✈️'];

const getRussianCategoryName = (rawName: string) => {
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
  return rawName; // Fallback
};

export function BudgetEnvelopes() {
  const [selectedRow, setSelectedRow] = useState<CategoryRowSchema | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: ({ categoryId, month, year }: { categoryId: number, month: number, year: number }) => 
      deleteBudget(categoryId, month, year),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => {
      const d = new Date();
      const start = getLocalDateString(new Date(d.getFullYear(), d.getMonth(), 1));
      const end = getLocalDateString(new Date(d.getFullYear(), d.getMonth() + 1, 0));
      return fetchDashboard(start, end);
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="premium-card p-6 animate-pulse backdrop-blur-3xl backdrop-saturate-150 bg-white/40 dark:bg-[#111111]/40 border border-white/20">
            <div className="h-4 w-1/3 bg-[#FF7A00]/10 rounded mb-4" />
            <div className="h-8 w-2/3 bg-[#FF7A00]/10 rounded mb-6" />
            <div className="h-1 bg-[#FF7A00]/10 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  const expenseRows = dashboard?.rows.filter((r: CategoryRowSchema) => {
    const planned = parseFloat(r.planned);
    return planned > 0;
  }) || [];

  if (expenseRows.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <motion.div
           onClick={() => setIsCreateModalOpen(true)}
           className="premium-card p-10 min-h-[240px] flex flex-col items-center justify-center backdrop-blur-sm bg-white/10 dark:bg-[#111111]/10 border-2 border-dashed border-[#FF7A00]/30 hover:border-[#FF7A00]/60 cursor-pointer transition-all group"
         >
           <div className="w-16 h-16 rounded-full bg-[#FF7A00]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
             <Plus className="w-8 h-8 text-[#FF7A00]" />
           </div>
           <span className="font-serif font-bold text-lg text-[#1C3F35] dark:text-[#FDFBF7]">Создать Бюджет</span>
           <span className="text-[10px] font-mono text-[#FF7A00]/70 uppercase tracking-widest mt-2 font-bold">Первый конверт</span>
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {expenseRows.map((row: CategoryRowSchema, index: number) => {
        const planned = parseFloat(row.planned);
        const fact = parseFloat(row.fact);
        const percent = planned > 0 ? (fact / planned) * 100 : 0;
        
        // Guilt-Free Logic
        const categoryLower = row.category_name.toLowerCase();
        const isGuiltFree = categoryLower.includes('отдых') || categoryLower.includes('развлечения') || categoryLower.includes('leisure') || categoryLower.includes('бары') || categoryLower.includes('кафе');

        const isOver = fact > planned;
        const isWarning = percent > 75 && !isOver;
        const icon = isGuiltFree ? '🍸' : ENVELOPE_ICONS[index % ENVELOPE_ICONS.length];

        // Predictive Math
        const todayDate = new Date().getDate();
        const percentTimeElapsed = (todayDate / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()) * 100;
        const isBurnWarning = percent > (percentTimeElapsed + 10) && !isOver;

        const fillBgClasses = isGuiltFree
          ? "bg-gradient-to-t from-yellow-400/40 to-amber-300/10"
          : isOver
          ? "bg-gradient-to-t from-rose-500/30 to-rose-400/10"
          : isWarning
          ? "bg-gradient-to-t from-amber-500/30 to-amber-400/10"
          : "bg-gradient-to-t from-emerald-500/30 to-emerald-400/10";

        return (
          <motion.div
            key={row.category_id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "premium-card p-6 min-h-[220px] flex flex-col justify-between overflow-hidden relative group backdrop-blur-3xl backdrop-saturate-150 bg-white/40 dark:bg-[#111111]/40 border border-white/20",
              "shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.02)] transition-all",
              "hover:shadow-[0_0_30px_rgba(255,122,0,0.25)] hover:border-[#FF7A00]/40 z-10 hover:-translate-y-1 hover:scale-[1.02] duration-300 ease-out",
              isOver && "border-rose-500/30"
            )}
          >
            {/* Action Buttons */}
            <div className="absolute top-4 right-4 z-50 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={(e) => { e.stopPropagation(); setSelectedRow(row); }} className="p-2 bg-white/20 hover:bg-[#FF7A00]/80 rounded-full backdrop-blur transition-colors text-slate-500 hover:text-white">
                <Pencil className="w-4 h-4" />
              </button>
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  const today = new Date();
                  deleteMutation.mutate({ categoryId: row.category_id, month: today.getMonth() + 1, year: today.getFullYear() }); 
                }} 
                className="p-2 bg-white/20 hover:bg-rose-500/80 rounded-full backdrop-blur transition-colors text-rose-500 hover:text-white"
              >
                <Trash className="w-4 h-4" />
              </button>
            </div>

            {/* Prediction Badge */}
            {(isGuiltFree || isBurnWarning) && (
              <div className="absolute top-4 left-4 z-20 w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs shadow-sm">
                {isGuiltFree ? '🍸' : '🔥'}
              </div>
            )}

            <div className="relative z-10 flex flex-col justify-center items-center h-full gap-2 mt-auto mb-auto">
              <div className="text-4xl filter drop-shadow-md mb-2">{icon}</div>
              <h3 className="text-lg font-serif font-bold text-[#1C3F35] dark:text-[#FDFBF7] text-center leading-tight">
                {getRussianCategoryName(row.category_name)}
              </h3>
              <div className="mt-2 text-[#1C3F35] dark:text-[#FDFBF7]">
                <span className="text-2xl font-bold">{fact.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽</span>
                <span className="text-sm font-mono text-[#1C3F35]/50 dark:text-[#FDFBF7]/50 ml-1 font-bold">/ {planned.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽</span>
              </div>
            </div>

            {/* The Liquid Fill Minimal */}
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${Math.min(100, Math.max(3, percent))}%` }}
              transition={{ delay: index * 0.1, type: 'spring', damping: 20, mass: 0.8 }}
              className={cn(
                "absolute bottom-0 left-0 w-full opacity-30 pointer-events-none z-0",
                fillBgClasses
              )}
            />
          </motion.div>
        );
      })}

      {/* Create Envelope Ghost Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.02 }}
        transition={{ delay: expenseRows.length * 0.08, duration: 0.4 }}
        onClick={() => setIsCreateModalOpen(true)}
        className="premium-card p-8 min-h-[240px] flex flex-col items-center justify-center backdrop-blur-sm bg-white/5 dark:bg-[#111111]/20 border-2 border-dashed border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/5 cursor-pointer transition-all group"
      >
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          <Plus className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <span className="font-serif font-bold text-lg text-emerald-800 dark:text-emerald-300">Новый Конверт</span>
        <span className="text-[10px] font-mono text-emerald-600/70 uppercase tracking-widest mt-2 font-bold text-center">Выделить средства</span>
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
