import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { upsertBudget, fetchCategories } from '@/api/client';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import type { CategoryRowSchema } from '@/types';

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

  const { data: dashboard } = useQuery({
    queryKey: ['dashboard', 'current'],
    enabled: isOpen && !row,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    enabled: isOpen && !row,
  });

  const budgetedCategoryIds = dashboard?.rows.filter((r: CategoryRowSchema) => parseFloat(r.planned) > 0).map((r: CategoryRowSchema) => r.category_id) || [];
  const availableCategories = categories?.filter((c) => !budgetedCategoryIds.includes(c.id) && c.type === 'expense') || [];

  useEffect(() => {
    if (isOpen) {
      if (row) {
        const planned = parseFloat(row.planned);
        // eslint-disable-next-line react-hooks/set-state-in-effect
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
    const d = new Date();
    const currentMonth = d.getMonth() + 1;
    const currentYear = d.getFullYear();

    // 1. Проверка сырых данных
    const catId = row ? row.category_id : selectedCategoryId;
    console.log("DEBUG PAYLOAD:", { catId, val, currentMonth, currentYear });
    
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
      // 2. Отправка мутации
      await upsertBudgetMutation.mutateAsync({
        category_id: catId,
        amount_limit: val, // Убедись, что это Number, а не строка с пробелами
        month: currentMonth,
        year: currentYear
      });
      
      toast.success("Бюджет успешно сохранен!");
      onClose();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // 3. Агрессивный перехват ошибок
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
    setAmountStr(raw);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmountStr(e.target.value);
  };

  const formattedAmount = currentVal > 0 ? currentVal.toLocaleString('ru-RU') : '';

  const sliderMax = Math.max(fact * 2, 50000);
  const selectedCat = availableCategories.find(c => c.id === selectedCategoryId);

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
                  {row ? "Изменение лимита" : "Создание конверта"}
                </h3>
                <p className="text-sm text-[#FF7A00]/80 font-mono tracking-wider uppercase mt-1">
                  {row ? row.category_name : "Новое бюджетирование"}
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
              {!row && (
                <div className="w-full max-w-md mb-2 relative z-[70]">
                  <div 
                    className="w-full p-4 bg-slate-100/50 dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-xl text-[#1C3F35] dark:text-[#FDFBF7] font-bold cursor-pointer flex justify-between items-center transition-all hover:bg-slate-200/50 dark:hover:bg-white/10 shadow-sm"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  >
                    <span>{selectedCat ? selectedCat.name : "Выберите категорию..."}</span>
                    <ChevronDown className={cn("w-5 h-5 text-slate-400 transition-transform", isDropdownOpen && "rotate-180")} />
                  </div>
                  <AnimatePresence>
                    {isDropdownOpen && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-white/80 dark:bg-[#1A1A1A]/90 backdrop-blur-3xl border border-slate-200 dark:border-white/10 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] overflow-hidden max-h-[200px] overflow-y-auto"
                      >
                        {availableCategories.length === 0 ? (
                          <div className="p-4 text-center text-sm font-mono text-slate-500">Все категории уже распределены</div>
                        ) : (
                          availableCategories.map(c => (
                            <div 
                              key={c.id} 
                              className="px-4 py-3 hover:bg-[#1C3F35]/5 dark:hover:bg-emerald-500/10 cursor-pointer font-bold text-[#1C3F35] dark:text-[#FDFBF7] transition-colors"
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
              )}

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
                      {row ? `Текущие траты: ${fact.toLocaleString('ru-RU')} ₽.` : "Установите стартовый лимит на этот месяц."}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || currentVal === 0 || (!row && !selectedCategoryId)}
              className="mt-6 w-full flex items-center justify-center gap-2 bg-[#FF7A00] hover:bg-[#E66E00] text-white py-4 rounded-xl font-bold uppercase tracking-wider font-mono disabled:opacity-50 disabled:cursor-not-allowed transition-all relative z-10"
            >
              {isSubmitting ? 'Сохранение...' : (
                <>
                  <Save className="w-5 h-5" /> {row ? "Сохранить лимит" : "Создать конверт"}
                </>
              )}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
