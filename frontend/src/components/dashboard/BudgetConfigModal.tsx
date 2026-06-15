import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { upsertBudget, fetchCategories } from '@/api/client';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import type { CategoryRowSchema } from '@/types';
import { getRussianCategoryName } from '@/lib/categories'; // 🔥 ИМПОРТ ЕДИНОГО СЛОВАРЯ
import { getMoscowDate } from '@/lib/dateUtils'; // 🔥 ИСПРАВЛЕНИЕ МСК

interface BudgetConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: CategoryRowSchema | null;
}

export function BudgetConfigModal({ isOpen, onClose, row }: BudgetConfigModalProps) {
  const queryClient = useQueryClient();
  const [amountStr, setAmountStr] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    enabled: isOpen,
  });

  const availableCategories = categories || [];

  useEffect(() => {
    if (isOpen) {
      if (row) {
        const planned = parseFloat(row.planned);
        setAmountStr(planned > 0 ? planned.toString() : '');
        setSelectedCategoryId(row.category_id);
      } else {
        setAmountStr('');
        setSelectedCategoryId(null);
        setIsDropdownOpen(false);
      }
    }
  }, [row, isOpen]);

  const upsertBudgetMutation = useMutation({
    mutationFn: (payload: Parameters<typeof upsertBudget>[0]) => upsertBudget(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const val = parseFloat(amountStr.replace(/\s/g, '')) || 0;
    // 🔥 ИСПРАВЛЕНИЕ МСК ВРЕМЕНИ
    const d = getMoscowDate();
    const currentMonth = d.getMonth() + 1;
    const currentYear = d.getFullYear();

    const catId = selectedCategoryId;

    if (!catId) {
      toast.error("Ошибка: Категория не выбрана!");
      return;
    }
    if (val <= 0) {
      toast.error("Ошибка: Лимит должен быть больше 0!");
      return;
    }

    setIsSubmitting(true);
    try {
      await upsertBudgetMutation.mutateAsync({
        category_id: catId,
        amount_limit: val,
        month: currentMonth,
        year: currentYear
      });

      toast.success("Бюджет успешно сохранен!");
      onClose();
    } catch (error: any) {
      console.error("BUDGET UPSERT ERROR:", error);
      toast.error(`Ошибка сервера: ${error.message || JSON.stringify(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const fact = row ? parseFloat(row.fact) : 0;
  const currentVal = parseFloat(amountStr.replace(/\s/g, '')) || 0;

  const isBelowFact = currentVal > 0 && currentVal < fact;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    setAmountStr(raw ? String(parseInt(raw, 10)) : '');
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmountStr(e.target.value);
  };

  const formattedAmount = currentVal > 0 ? currentVal.toLocaleString('ru-RU') : '';

  const sliderMax = Math.max(fact * 2, 50000);
  const selectedCat = availableCategories.find((c) => c.id === selectedCategoryId);

  const dropdownWrapperStyle = cn(
    "w-full rounded-2xl h-14 md:h-16 px-4 md:px-5 transition-all duration-300 flex justify-between items-center cursor-pointer text-sm font-bold text-[#1C3F35] dark:text-white",
    "bg-black/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] border border-transparent",
    "dark:bg-black/40 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]",
    isDropdownOpen
      ? "bg-white shadow-md border-[#FF7A00]/50 dark:bg-[#1A1A1A] dark:shadow-none dark:border-[#FF7A00]/50"
      : "hover:bg-black/10 dark:hover:bg-white/5"
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 40 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-[440px] bg-white/90 dark:bg-[#111111]/95 backdrop-blur-3xl border border-black/5 dark:border-white/10 rounded-[2.5rem] p-8 md:p-10 shadow-[0_32px_80px_rgba(0,0,0,0.15)] dark:shadow-[0_32px_80px_rgba(0,0,0,0.6)] flex flex-col z-10"
          >
            <div className="flex justify-between items-start mb-8">
              <div className="flex flex-col gap-1.5">
                <h3 className="text-xl md:text-2xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white leading-none">
                  {row ? "Изменение лимита" : "Создание конверта"}
                </h3>
                <p className="text-[12px] md:text-[13px] font-sans font-extrabold uppercase tracking-widest text-[#1C3F35] dark:text-emerald-500 mt-1">
                  {row ? getRussianCategoryName(row.category_name) : "Новое бюджетирование"}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-[#1C3F35]/50 dark:text-white/50" />
              </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center space-y-6">
              {/* Category dropdown */}
              <div className="w-full relative z-[70]">
                <div className={dropdownWrapperStyle} onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                  <span className={!selectedCat ? "opacity-50" : ""}>
                    {selectedCat ? getRussianCategoryName(selectedCat.name) : "Выберите категорию..."}
                  </span>
                  <ChevronDown className={cn("w-5 h-5 text-[#1C3F35]/40 dark:text-white/30 transition-transform", isDropdownOpen && "rotate-180 text-[#FF7A00]")} />
                </div>

                <AnimatePresence>
                  {isDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-white/95 dark:bg-[#121212]/95 backdrop-blur-3xl border border-black/10 dark:border-white/10 rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden max-h-[240px] overflow-y-auto z-50"
                    >
                      {availableCategories.length === 0 ? (
                        <div className="p-5 text-center text-[10px] uppercase tracking-[0.25em] font-bold font-mono text-[#1C3F35]/40 dark:text-white/40">
                          Нет доступных категорий
                        </div>
                      ) : (
                        availableCategories.map((c) => (
                          <div
                            key={c.id}
                            className={cn(
                              "px-5 py-4 cursor-pointer text-sm font-bold transition-colors",
                              c.id === selectedCategoryId
                                ? "bg-[#FF7A00]/10 text-[#FF7A00]"
                                : "text-[#1C3F35] dark:text-white hover:bg-black/5 dark:hover:bg-white/5"
                            )}
                            onClick={() => {
                              setSelectedCategoryId(c.id);
                              setIsDropdownOpen(false);
                            }}
                          >
                            {getRussianCategoryName(c.name)}
                          </div>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Amount Input */}
              <div className="flex items-baseline justify-center gap-2 mb-2 w-full mt-2">
                <input
                  type="text"
                  value={formattedAmount}
                  onChange={handleInputChange}
                  placeholder="0"
                  className="text-4xl md:text-5xl font-sans font-black tabular-nums tracking-tighter text-center bg-transparent border-none outline-none text-[#1C3F35] dark:text-white placeholder-[#1C3F35]/20 dark:placeholder-white/20 w-full"
                />
                <span className="text-xl md:text-2xl font-bold text-[#1C3F35] dark:text-white opacity-40">₽</span>
              </div>

              {/* Slider */}
              <div className="w-full space-y-4">
                <input
                  type="range"
                  min="0"
                  max={sliderMax}
                  step="100"
                  value={currentVal}
                  onChange={handleSliderChange}
                  className="apple-slider bg-black/10 dark:bg-white/10"
                  style={{
                    background: `linear-gradient(to right, #FF7A00 ${(currentVal / sliderMax) * 100}%, rgba(128,128,128,0.1) ${(currentVal / sliderMax) * 100}%)`
                  }}
                />

                <div className="text-center h-6 flex items-center justify-center">
                  {isBelowFact ? (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                      className="text-rose-600 dark:text-rose-500 font-sans font-extrabold text-[11px] md:text-[12px] uppercase tracking-widest"
                    >
                      Внимание: Лимит ниже фактических трат!
                    </motion.p>
                  ) : (
                    // 🔥 ИСПРАВЛЕНИЕ BUG-1 (убран JSX-комментарий из тернарника, который ломал билд)
                    <p className="text-[11px] md:text-[12px] font-sans font-extrabold uppercase tracking-widest text-[#1C3F35] dark:text-emerald-500">
                      {row ? `Траты: ${fact.toLocaleString('ru-RU')} ₽` : "Установите стартовый лимит"}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || currentVal === 0 || !selectedCategoryId}
              className="mt-8 w-full h-[64px] bg-gradient-to-r from-[#FF7A00] to-[#FFA011] hover:from-[#EA6A00] hover:to-[#FF7A00] text-white rounded-2xl font-bold uppercase tracking-widest text-sm shadow-[0_10px_30px_-5px_rgba(255,122,0,0.4)] transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                 <motion.div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
              ) : (
                <>
                  <Save className="w-4 h-4" /> {row ? "Сохранить лимит" : "Создать конверт"}
                </>
              )}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}