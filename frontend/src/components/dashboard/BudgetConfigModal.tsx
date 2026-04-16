import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { upsertBudget } from '@/api/client';
import { cn } from '@/lib/utils';
import type { CategoryRowSchema } from '@/types';

interface BudgetConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: CategoryRowSchema | null;
}

export function BudgetConfigModal({ isOpen, onClose, row }: BudgetConfigModalProps) {
  const queryClient = useQueryClient();
  const [amountStr, setAmountStr] = useState<string>('');

  useEffect(() => {
    if (row && isOpen) {
      const planned = parseFloat(row.planned);
      setAmountStr(planned > 0 ? planned.toString() : '');
    }
  }, [row, isOpen]);

  const mutation = useMutation({
    mutationFn: async (val: number) => {
      if (!row) return;
      const d = new Date();
      await upsertBudget({
        category_id: row.category_id,
        amount_limit: val,
        month: d.getMonth() + 1,
        year: d.getFullYear(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
  });

  if (!row) return null;

  const fact = parseFloat(row.fact);
  const currentVal = parseFloat(amountStr.replace(/\s/g, '')) || 0;
  
  const isBelowFact = currentVal > 0 && currentVal < fact;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    setAmountStr(raw);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmountStr(e.target.value);
  };

  const formattedAmount = currentVal > 0 ? currentVal.toLocaleString('ru-RU') : '';

  // Max scale for the slider based on the fact to make it useful
  const sliderMax = Math.max(fact * 2, 50000);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-[60] bg-white dark:bg-[#111111] border-t border-white/20 rounded-t-3xl p-6 shadow-2xl h-[50vh] flex flex-col"
          >
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-2xl font-serif font-bold text-[#1C3F35] dark:text-[#FDFBF7]">
                  Установка лимита
                </h3>
                <p className="text-sm text-[#FF7A00]/80 font-mono tracking-wider uppercase mt-1">
                  {row.category_name}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 bg-slate-100 dark:bg-white/5 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-[#1C3F35] dark:text-[#FDFBF7]" />
              </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center space-y-6">
              <input
                type="text"
                value={formattedAmount}
                onChange={handleInputChange}
                placeholder="0"
                className="text-4xl font-black text-center bg-transparent border-none outline-none w-full mb-4 text-[#1C3F35] dark:text-[#FDFBF7] placeholder-slate-300 dark:placeholder-slate-700"
              />

              <div className="w-full max-w-md space-y-2">
                <input
                  type="range"
                  min="0"
                  max={sliderMax}
                  step="100"
                  value={currentVal}
                  onChange={handleSliderChange}
                  className="accent-emerald-600 dark:accent-[#FF7A00] w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                />
                
                <div className="text-center mt-2 h-6">
                  {isBelowFact ? (
                    <motion.p 
                      initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                      className="text-rose-500 font-bold text-xs font-mono"
                    >
                      Внимание: Лимит ниже фактических трат!
                    </motion.p>
                  ) : (
                    <p className="font-mono text-xs text-slate-500 Space Mono">
                      Текущие траты: {fact.toLocaleString('ru-RU')} ₽. Установите лимит с небольшим запасом.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => mutation.mutate(currentVal)}
              disabled={mutation.isPending || currentVal === 0}
              className="mt-6 w-full flex items-center justify-center gap-2 bg-[#FF7A00] hover:bg-[#E66E00] text-white py-4 rounded-xl font-bold uppercase tracking-wider font-mono disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {mutation.isPending ? 'Сохранение...' : (
                <>
                  <Save className="w-5 h-5" /> Сохранить лимит
                </>
              )}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
