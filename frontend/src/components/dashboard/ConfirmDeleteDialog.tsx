/**
 * ConfirmDeleteDialog — CASCADE-safe deletion guard for categories.
 *
 * Renders as a top-layer modal (z-[200]) above CategoryManagerModal.
 *
 * Two safety tiers:
 *   • transaction_count === 0 → soft warning, single click to confirm.
 *   • transaction_count  >  0 → hard block: user must type "УДАЛИТЬ"
 *     before the Confirm button unlocks. Prevents accidental data loss.
 *
 * UX Pattern: Stripe / GitHub destructive confirmation.
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Trash2, X, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { fetchCategoryTransactionCount, deleteCategory } from '@/api/client';
import type { CategoryRead } from '@/types';

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

  // Reset input when dialog reopens for a new category
  useEffect(() => {
    setConfirmInput('');
    if (category) {
      // Small delay to let animation settle before focusing
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [category]);

  // ── Pre-flight: fetch transaction count ───────────────────────────────
  const { data: countData, isLoading: isCountLoading } = useQuery({
    queryKey: ['categoryTxCount', category?.id],
    queryFn: () => fetchCategoryTransactionCount(category!.id),
    enabled: !!category,
    staleTime: 0, // Always fresh — we need an accurate count
  });

  const txCount = countData?.transaction_count ?? 0;
  const isHardDelete = txCount > 0;
  const isConfirmReady = !isHardDelete || confirmInput === CONFIRM_WORD;

  // ── Delete mutation ───────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: () => deleteCategory(category!.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`Категория «${category?.name}» удалена`, {
        description: isHardDelete
          ? `Вместе с ней удалено ${txCount} транзакций`
          : 'Транзакций не было',
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
        // ── Backdrop ───────────────────────────────────────────────────
        <motion.div
          key="confirm-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleteMutation.isPending) onClose();
          }}
        >
          {/* ── Dialog Card ─────────────────────────────────────────── */}
          <motion.div
            key="confirm-card"
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className="relative w-full max-w-md bg-white dark:bg-[#161616] rounded-3xl shadow-[0_32px_80px_rgba(0,0,0,0.4)] border border-slate-200 dark:border-white/10 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Top danger stripe ──────────────────────────────────── */}
            <div
              className={`h-1.5 w-full ${isHardDelete ? 'bg-gradient-to-r from-rose-600 to-red-500' : 'bg-gradient-to-r from-amber-500 to-orange-400'}`}
            />

            <div className="p-6">
              {/* ── Close button ────────────────────────────────────── */}
              <button
                type="button"
                onClick={onClose}
                disabled={deleteMutation.isPending}
                className="absolute top-5 right-5 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* ── Icon + heading ───────────────────────────────────── */}
              <div className="flex items-start gap-4 mb-5">
                <div
                  className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center ${isHardDelete ? 'bg-rose-100 dark:bg-rose-500/15' : 'bg-amber-100 dark:bg-amber-500/15'}`}
                >
                  {isHardDelete ? (
                    <ShieldAlert className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  )}
                </div>
                <div className="pt-0.5">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                    {isHardDelete ? 'Опасное удаление' : 'Удалить категорию?'}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    «{category.name}»
                  </p>
                </div>
              </div>

              {/* ── Count loading skeleton ───────────────────────────── */}
              {isCountLoading ? (
                <div className="h-16 rounded-2xl bg-slate-100 dark:bg-white/5 animate-pulse mb-4" />
              ) : (
                <>
                  {/* ── Warning body ──────────────────────────────────── */}
                  {isHardDelete ? (
                    <div className="mb-5 p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/[0.08] border border-rose-200 dark:border-rose-500/20">
                      <p className="text-sm font-semibold text-rose-700 dark:text-rose-300 mb-1">
                        Это действие удалит <span className="font-black">{txCount} транзакций</span>
                      </p>
                      <p className="text-xs text-rose-600/80 dark:text-rose-400/70 leading-relaxed">
                        Все финансовые записи, привязанные к этой категории, будут безвозвратно
                        удалены. Восстановление невозможно.
                      </p>
                    </div>
                  ) : (
                    <div className="mb-5 p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/[0.08] border border-amber-200 dark:border-amber-500/20">
                      <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
                        Категория не содержит транзакций и будет удалена безвозвратно.
                      </p>
                    </div>
                  )}

                  {/* ── Hard confirmation input ───────────────────────── */}
                  {isHardDelete && (
                    <div className="mb-5">
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                        Введите «{CONFIRM_WORD}» для подтверждения
                      </label>
                      <input
                        ref={inputRef}
                        type="text"
                        value={confirmInput}
                        onChange={(e) => setConfirmInput(e.target.value.toUpperCase())}
                        placeholder={CONFIRM_WORD}
                        disabled={deleteMutation.isPending}
                        className="w-full bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-base font-mono font-bold tracking-widest text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-white/20 outline-none focus:border-rose-400 dark:focus:border-rose-500 focus:ring-2 focus:ring-rose-400/20 transition-all duration-200 disabled:opacity-50"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && isConfirmReady && !deleteMutation.isPending) {
                            deleteMutation.mutate();
                          }
                        }}
                      />
                      {/* Live match indicator */}
                      <div className="mt-2 flex items-center gap-1.5">
                        <div
                          className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${confirmInput === CONFIRM_WORD ? 'bg-rose-500' : 'bg-slate-300 dark:bg-white/20'}`}
                        />
                        <span className="text-[10px] font-mono text-slate-400 dark:text-white/30 uppercase tracking-widest">
                          {confirmInput === CONFIRM_WORD
                            ? 'Подтверждение получено'
                            : `${confirmInput.length} / ${CONFIRM_WORD.length}`}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── Action buttons ───────────────────────────────────── */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={deleteMutation.isPending}
                  className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-600 dark:text-white/60 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors duration-200 disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate()}
                  disabled={!isConfirmReady || deleteMutation.isPending || isCountLoading}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all duration-200
                    ${
                      isConfirmReady && !deleteMutation.isPending
                        ? isHardDelete
                          ? 'bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-500/20 cursor-pointer'
                          : 'bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20 cursor-pointer'
                        : 'bg-slate-200 dark:bg-white/10 text-slate-400 dark:text-white/30 cursor-not-allowed'
                    }`}
                >
                  {deleteMutation.isPending ? (
                    <span className="animate-pulse">Удаление...</span>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Подтвердить
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
