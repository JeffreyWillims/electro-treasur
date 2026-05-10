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

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    enabled: isOpen,
  });

  // All categories available — user may reassign an envelope
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
    const d = new Date();
    const currentMonth = d.getMonth() + 1;
    const currentYear = d.getFullYear();

    // 1. Проверка сырых данных
    const catId = selectedCategoryId;
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
    setAmountStr(raw ? String(parseInt(raw, 10)) : '');
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmountStr(e.target.value);
  };

  const formattedAmount = currentVal > 0 ? currentVal.toLocaleString('ru-RU') : '';

  const sliderMax = Math.max(fact * 2, 50000);
  const selectedCat = availableCategories.find((c) => c.id === selectedCategoryId);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="relative w-full max-w-[440px] bg-white/60 dark:bg-[#111111]/80 backdrop-blur-3xl backdrop-saturate-200 border border-white/40 dark:border-white/10 rounded-[2.5rem] p-10 shadow-2xl flex flex-col z-10"
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
              {/* Category dropdown — always shown in both create and edit modes */}
              <div className="w-full max-w-md mb-2 relative z-[70]">
                <div 
                  className="w-full p-4 bg-slate-100/50 dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-xl text-[#1C3F35] dark:text-[#FDFBF7] font-bold cursor-pointer flex justify-between items-center transition-all hover:bg-slate-200/50 dark:hover:bg-white/10 shadow-sm"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  <span>{selectedCat ? getRussianCategoryName(selectedCat.name) : "Выберите категорию..."}</span>
                  <ChevronDown className={cn("w-5 h-5 text-slate-400 transition-transform", isDropdownOpen && "rotate-180")} />
                </div>
                <AnimatePresence>
                  {isDropdownOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-white/80 dark:bg-[#1A1A1A]/90 backdrop-blur-3xl border border-slate-200 dark:border-white/10 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] overflow-hidden max-h-[200px] overflow-y-auto"
                    >
                      {availableCategories.length === 0 ? (
                        <div className="p-4 text-center text-sm font-mono text-slate-500">Нет доступных категорий</div>
                      ) : (
                        availableCategories.map((c) => (
                          <div 
                            key={c.id} 
                            className={cn(
                              "px-4 py-3 cursor-pointer font-bold text-[#1C3F35] dark:text-[#FDFBF7] transition-colors",
                              c.id === selectedCategoryId
                                ? "bg-[#FF7A00]/10 text-[#FF7A00]"
                                : "hover:bg-[#1C3F35]/5 dark:hover:bg-emerald-500/10"
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

              <div className="flex items-baseline justify-center gap-2 mb-8">
                <input
                  type="text"
                  value={formattedAmount}
                  onChange={handleInputChange}
                  placeholder="0"
                  className="text-4xl font-black text-center bg-transparent border-none outline-none text-[#1C3F35] dark:text-[#FDFBF7] placeholder-slate-300 dark:placeholder-slate-700 w-full"
                />
                <span className="text-2xl font-bold text-[#1C3F35]/40 dark:text-white/30">₽</span>
              </div>

              <div className="w-full max-w-md space-y-2">
                <input
                  type="range"
                  min="0"
                  max={sliderMax}
                  step="100"
                  value={currentVal}
                  onChange={handleSliderChange}
                  className="apple-slider"
                  style={{
                    background: `linear-gradient(to right, #FF7A00 ${(currentVal / sliderMax) * 100}%, rgba(28,63,53,0.1) ${(currentVal / sliderMax) * 100}%)`
                  }}
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
              disabled={isSubmitting || currentVal === 0 || !selectedCategoryId}
              className="mt-6 w-full flex items-center justify-center gap-2 bg-[#FF7A00] hover:bg-[#E66E00] text-white py-4 rounded-xl font-bold uppercase tracking-wider font-mono disabled:opacity-50 disabled:cursor-not-allowed transition-all relative z-10"
            >
              {isSubmitting ? 'Сохранение...' : (
                <>
                  <Save className="w-5 h-5" /> {row ? "Сохранить лимит" : "Создать конверт"}
                </>
              )}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
