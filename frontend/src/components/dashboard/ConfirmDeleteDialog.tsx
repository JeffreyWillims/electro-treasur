/**
 * ConfirmDeleteDialog — Premium CASCADE-safe deletion guard for categories.
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Trash2, X, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { fetchCategoryTransactionCount, deleteCategory } from '@/api/client';
import type { CategoryRead } from '@/types';
import { cn } from '@/lib/utils';

// ── УНИФИЦИРОВАННЫЙ СЛОВАРЬ (Citrine Vault Standard) ───────────────────
const CATEGORY_TRANSLATIONS: Record<string, string> = {
  "Operations (Rent/Utility)": "Базовые расходы",
  "Leisure (Lifestyle)": "Лайфстайл",
  "Wellness (Health)": "Здоровье и Уход",
  "Propulsion (Income)": "Поступления",
  "Growth (Investments)": "Инвестиции",
  "Income": "Доход",
};

const getRussianCategoryName = (rawName: string) => {
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

const CONFIRM_WORD = 'УДАЛИТЬ';

interface ConfirmDeleteDialogProps {
  category: CategoryRead | null;
  onClose: () => void;
  onDeleted: () => void;
}

export function ConfirmDeleteDialog({ category, onClose, onDeleted }: ConfirmDeleteDialogProps) {
  const queryClient = useQueryClient();
  const [confirmInput, setConfirmInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setConfirmInput('');
    if (category) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [category]);

  const { data: countData, isLoading: isCountLoading } = useQuery({
    queryKey: ['categoryTxCount', category?.id],
    queryFn: () => fetchCategoryTransactionCount(category!.id),
    enabled: !!category,
    staleTime: 0,
  });

  const txCount = countData?.transaction_count ?? 0;
  const isHardDelete = txCount > 0;
  const isConfirmReady = !isHardDelete || confirmInput === CONFIRM_WORD;

  const deleteMutation = useMutation({
    mutationFn: () => deleteCategory(category!.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`Категория «${getRussianCategoryName(category!.name)}» удалена`, {
        description: isHardDelete ? `Вместе с ней удалено ${txCount} транзакций` : 'Транзакций не было',
      });
      onDeleted();
    },
    onError: (err: Error) => {
      toast.error(`Ошибка удаления: ${err.message}`);
    },
  });

  if (!category) return null;

  return (
    <AnimatePresence>
      {category && (
        <motion.div
          key="confirm-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleteMutation.isPending) onClose();
          }}
        >
          <motion.div
            key="confirm-card"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative w-full max-w-md bg-white/95 dark:bg-[#111111]/95 backdrop-blur-3xl border border-black/5 dark:border-white/10 rounded-[2.5rem] shadow-[0_32px_80px_rgba(0,0,0,0.15)] dark:shadow-[0_32px_80px_rgba(0,0,0,0.6)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top danger stripe */}
            <div className={cn("h-1.5 w-full", isHardDelete ? 'bg-gradient-to-r from-rose-500 to-rose-400' : 'bg-gradient-to-r from-amber-500 to-[#FF7A00]')} />

            <div className="p-8">
              {/* Close button */}
              <button
                type="button"
                onClick={onClose}
                disabled={deleteMutation.isPending}
                className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/5 text-[#1C3F35]/50 dark:text-white/50 hover:bg-black/10 dark:hover:bg-white/10 hover:text-[#1C3F35] dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Icon + heading */}
              <div className="flex items-center gap-5 mb-8">
                <div className={cn("shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner", isHardDelete ? 'bg-rose-500/10 dark:bg-rose-500/20' : 'bg-[#FF7A00]/10 dark:bg-[#FF7A00]/20')}>
                  {isHardDelete ? <ShieldAlert className="w-7 h-7 text-rose-500" /> : <AlertTriangle className="w-7 h-7 text-[#FF7A00]" />}
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white leading-none mb-1.5">
                    {isHardDelete ? 'Опасное удаление' : 'Удалить категорию?'}
                  </h3>
                  <p className="text-[11px] font-mono font-bold uppercase tracking-[0.25em] text-[#1C3F35]/50 dark:text-white/40">
                    «{getRussianCategoryName(category.name)}»
                  </p>
                </div>
              </div>

              {isCountLoading ? (
                <div className="h-20 rounded-2xl bg-black/5 dark:bg-white/5 animate-pulse mb-6" />
              ) : (
                <>
                  {/* Warning body */}
                  {isHardDelete ? (
                    <div className="mb-8 p-5 rounded-[1.5rem] bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20">
                      <p className="text-sm font-bold text-rose-600 dark:text-rose-400 mb-2">
                        Будет удалено <span className="font-sans font-black tabular-nums">{txCount} транзакций</span>
                      </p>
                      <p className="text-xs text-rose-600/70 dark:text-rose-400/70 leading-relaxed font-medium">
                        Все финансовые записи, привязанные к этой категории, будут безвозвратно удалены. Восстановление невозможно.
                      </p>
                    </div>
                  ) : (
                    <div className="mb-8 p-5 rounded-[1.5rem] bg-[#FF7A00]/5 dark:bg-[#FF7A00]/10 border border-[#FF7A00]/20">
                      <p className="text-sm font-medium text-[#FF7A00] dark:text-[#FFA011] leading-relaxed">
                        Категория не содержит транзакций и будет удалена безвозвратно.
                      </p>
                    </div>
                  )}

                  {/* Hard confirmation input */}
                  {isHardDelete && (
                    <div className="mb-10">
                      <label className="block text-[11px] font-mono font-bold uppercase tracking-[0.25em] text-[#1C3F35]/50 dark:text-white/50 mb-3 text-center">
                        Введите «{CONFIRM_WORD}»
                      </label>
                      <input
                        ref={inputRef}
                        type="text"
                        value={confirmInput}
                        onChange={(e) => setConfirmInput(e.target.value.toUpperCase())}
                        placeholder={CONFIRM_WORD}
                        disabled={deleteMutation.isPending}
                        className={cn(
                          "w-full h-14 px-5 text-xl font-mono font-black tracking-[0.2em] text-center uppercase rounded-2xl transition-all duration-300 outline-none text-[#1C3F35] dark:text-white placeholder-[#1C3F35]/20 dark:placeholder-white/20",
                          "bg-black/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] border border-transparent disabled:opacity-50",
                          "dark:bg-black/40 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]",
                          "focus:bg-white focus:shadow-md focus:border-rose-500/50",
                          "dark:focus:bg-[#1A1A1A] dark:focus:shadow-none dark:focus:border-rose-500/50"
                        )}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && isConfirmReady && !deleteMutation.isPending) {
                            deleteMutation.mutate();
                          }
                        }}
                      />
                      {/* Live match indicator */}
                      <div className="mt-4 flex items-center justify-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full transition-colors duration-300 shadow-sm", confirmInput === CONFIRM_WORD ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 'bg-black/10 dark:bg-white/20')} />
                        <span className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-[#1C3F35]/40 dark:text-white/30">
                          {confirmInput === CONFIRM_WORD ? 'Подтверждено' : `${confirmInput.length} / ${CONFIRM_WORD.length}`}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Action buttons */}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={deleteMutation.isPending}
                  className="flex-1 h-14 rounded-2xl bg-black/5 dark:bg-white/5 text-xs font-bold uppercase tracking-widest text-[#1C3F35]/60 dark:text-white/60 hover:bg-black/10 dark:hover:bg-white/10 hover:text-[#1C3F35] dark:hover:text-white transition-colors duration-200 disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate()}
                  disabled={!isConfirmReady || deleteMutation.isPending || isCountLoading}
                  className={cn(
                    "flex-1 h-14 rounded-2xl text-xs font-bold uppercase tracking-widest text-white flex items-center justify-center gap-2 transition-all duration-300",
                    isConfirmReady && !deleteMutation.isPending
                      ? isHardDelete
                        ? 'bg-rose-500 hover:bg-rose-600 shadow-[0_10px_20px_-5px_rgba(244,63,94,0.4)] active:scale-[0.98]'
                        : 'bg-gradient-to-r from-[#FF7A00] to-[#FFA011] hover:from-[#EA6A00] hover:to-[#FF7A00] shadow-[0_10px_30px_-5px_rgba(255,122,0,0.4)] active:scale-[0.98]'
                      : 'bg-black/10 dark:bg-white/10 text-[#1C3F35]/30 dark:text-white/30 shadow-none cursor-not-allowed'
                  )}
                >
                  {deleteMutation.isPending ? (
                    <motion.div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Удалить
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}