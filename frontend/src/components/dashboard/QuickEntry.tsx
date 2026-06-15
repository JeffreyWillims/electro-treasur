import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { PlusCircle, Search, Plus, Check, Settings } from 'lucide-react';
import { createTransaction, fetchCategories, createCategory } from '@/api/client';
import type { CategoryRead } from '@/types';
import { getLocalDateString } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { CategoryManagerModal } from './CategoryManagerModal';
import { GlassDatePicker } from '@/components/ui/GlassDatePicker';

const CURRENCIES = ['RUB', 'USD', 'EUR'];

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

const INITIALS_PALETTE = ['#1C3F35', '#FF7A00', '#C5A059', '#3B82F6', '#8B5CF6', '#EC4899'];

function useOnClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return;
      handler();
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}

export function QuickEntry() {
  const queryClient = useQueryClient();
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('RUB');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [subcategory, setSubcategory] = useState('');
  const [date, setDate] = useState(() => getLocalDateString(new Date()));

  const [comboOpen, setComboOpen] = useState(false);
  const [comboInput, setComboInput] = useState('');
  const comboRef = useRef<HTMLDivElement>(null);
  const [pendingCategory, setPendingCategory] = useState<string | null>(null);

  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);

  useOnClickOutside(comboRef, useCallback(() => {
    setComboOpen(false);
    setPendingCategory(null);
  }, []));

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  const filteredCategories = categories
    .filter((c) => c.type === type)
    .filter((c) => {
      if (!comboInput) return true;
      const term = comboInput.toLowerCase();
      return c.name.toLowerCase().includes(term) || getRussianCategoryName(c.name).toLowerCase().includes(term);
    });

  const exactMatch = filteredCategories.some((c) =>
    c.name.toLowerCase() === comboInput.toLowerCase() ||
    getRussianCategoryName(c.name).toLowerCase() === comboInput.toLowerCase()
  );

  const createCategoryMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: async (newCat: CategoryRead) => {
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      setSelectedCategoryId(newCat.id);
      setComboInput(getRussianCategoryName(newCat.name));
      setComboOpen(false);
      setPendingCategory(null);
      toast.success(`Категория «${newCat.name}» создана`);
    },
    onError: (error: Error) => {
      toast.error(`Ошибка создания: ${error.message}`);
      setPendingCategory(null);
    }
  });

  const handleCreateCategory = () => {
    if (!comboInput.trim()) return;
    setPendingCategory(comboInput.trim());
  };

  const handleSelectCategory = (cat: CategoryRead) => {
    setSelectedCategoryId(cat.id);
    setComboInput(getRussianCategoryName(cat.name));
    setComboOpen(false);
  };

  const mutation = useMutation({
    mutationFn: (payload: Parameters<typeof createTransaction>[0]) => createTransaction(payload),
    onSuccess: () => {
      setAmount('');
      setSubcategory('');
      setType('expense');
      setSelectedCategoryId(null);
      setComboInput('');
      toast.success('Транзакция сохранена');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: Error) => toast.error(`Ошибка: ${error.message}`)
  });

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d.,]/g, '').replace(',', '.');
    const parts = raw.split('.');
    let integerPart = parts[0] || '';
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    setAmount(parts.length > 1 ? `${integerPart}.${parts[1]?.slice(0, 2)}` : integerPart);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !selectedCategoryId) return toast.error('Заполните сумму и категорию');
    mutation.mutate({
      amount: parseFloat(amount.replace(/\s/g, '')),
      currency,
      category_id: selectedCategoryId,
      executed_at: date ? `${date}T12:00:00+03:00` : new Date().toISOString(),
      entry_type: 'manual',
      comment: subcategory || undefined,
    });
  };

  const selectedCat = categories.find((c) => c.id === selectedCategoryId);

  const inputWrapperStyle = cn(
    "flex items-center w-full rounded-2xl h-14 md:h-16 px-4 md:px-5 transition-all duration-300",
    "bg-black/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] border border-transparent",
    "dark:bg-black/40 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]",
    "focus-within:bg-white focus-within:shadow-md focus-within:border-[#FF7A00]/50",
    "dark:focus-within:bg-[#1A1A1A] dark:focus-within:shadow-none dark:focus-within:border-[#FF7A00]/50"
  );

  const labelStyle = "block mb-2 text-[14px] md:text-[15px] font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-emerald-400 dark:drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]";

  return (
    <div className="w-full bg-white/40 dark:bg-[#111111]/40 backdrop-blur-3xl border border-black/5 dark:border-white/10 rounded-[2.5rem] p-8 md:p-10 shadow-2xl transition-all duration-300 z-10 relative">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-[#FF7A00]/10 flex items-center justify-center shrink-0">
          <PlusCircle className="w-6 h-6 text-[#FF7A00]" />
        </div>
        <div>
          <h2 className="text-xl md:text-2xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white">Новая операция</h2>
          <p className="text-[11px] md:text-[12px] font-sans font-extrabold uppercase tracking-wide text-[#FF7A00] dark:drop-shadow-[0_0_8px_rgba(255,122,0,0.5)] mt-1">Быстрое добавление</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* ── Type Toggle ── */}
        <div className="relative flex bg-black/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] dark:bg-black/40 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)] border border-black/5 dark:border-white/5 p-1.5 rounded-2xl w-full mb-8">
          <motion.div
            className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white dark:bg-[#222222] border border-black/5 dark:border-white/10 rounded-xl shadow-md"
            animate={{ x: type === 'income' ? '100%' : '0%' }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          />
          <button type="button" onClick={() => { setType('expense'); setSelectedCategoryId(null); setComboInput(''); }} className={`relative z-10 flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${type === 'expense' ? 'text-[#1C3F35] dark:text-white' : 'text-[#1C3F35]/40 dark:text-white/40'}`}>
            Расход
          </button>
          <button type="button" onClick={() => { setType('income'); setSelectedCategoryId(null); setComboInput(''); }} className={`relative z-10 flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#1C3F35]/40 dark:text-white/40'}`}>
            Доход
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-5">
          <div className="flex-1">
            <label className={labelStyle}>Сумма</label>
            <div className={inputWrapperStyle}>
              {/* ИЗМЕНЕНИЯ ЗДЕСЬ: уменьшен шрифт до text-xl md:text-2xl, убран slate, добавлен #1C3F35 */}
              <input
                type="text" inputMode="decimal" value={amount} onChange={handleAmountChange} placeholder="0"
                className="flex-1 w-full outline-none bg-transparent text-left text-xl md:text-2xl font-sans font-black tabular-nums tracking-tighter text-[#1C3F35] dark:text-white placeholder-[#1C3F35]/30 dark:placeholder-white/30 px-2"
              />
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="ml-2 bg-transparent text-sm md:text-base font-bold uppercase tracking-widest text-[#1C3F35] dark:text-white outline-none cursor-pointer">
                {CURRENCIES.map((c) => <option key={c} value={c} className="bg-white dark:bg-[#1A1A1A] text-[#1C3F35] dark:text-white">{c}</option>)}
              </select>
            </div>
          </div>

          <div className="w-full md:w-[170px] shrink-0 relative z-[60]">
            <label className={labelStyle}>Дата</label>
            <div className={cn(inputWrapperStyle, "px-2")}>
              <GlassDatePicker
                value={date}
                onChange={setDate}
                className="flex-1 w-full h-full"
              />
            </div>
          </div>
        </div>

        <div ref={comboRef} className="relative z-50">
          <label className={labelStyle}>Категория</label>
          <div className={inputWrapperStyle}>
            <input
              type="text" value={comboInput}
              onChange={(e) => { setComboInput(e.target.value); setSelectedCategoryId(null); setPendingCategory(null); if (!comboOpen) setComboOpen(true); }}
              onFocus={() => setComboOpen(true)}
              placeholder="Поиск..."
              className="flex-1 w-full outline-none bg-transparent text-left text-lg font-bold text-[#1C3F35] dark:text-white placeholder-black/30 dark:placeholder-white/30 pr-4"
            />
            <span className="pointer-events-none select-none flex items-center justify-center shrink-0">
              {selectedCat ? (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white uppercase shadow-sm" style={{ backgroundColor: selectedCat.icon || '#1C3F35' }}>
                  {getRussianCategoryName(selectedCat.name).charAt(0)}
                </div>
              ) : (
                <Search className="w-5 h-5 text-[#1C3F35]/30 dark:text-white/30" />
              )}
            </span>
          </div>

          <AnimatePresence>
            {comboOpen && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="absolute z-50 w-full mt-2 py-2 rounded-2xl bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-3xl border border-black/5 dark:border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.6)] max-h-[300px] overflow-y-auto">
                <AnimatePresence mode="wait">
                  {pendingCategory ? (
                    <motion.div key="picker" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 mx-2 bg-black/5 dark:bg-white/5 rounded-xl">
                      <div className="flex justify-between items-center mb-3">
                        <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#1C3F35]/50 dark:text-white/50">Дизайн для «{pendingCategory}»</p>
                        <button type="button" onClick={() => setPendingCategory(null)} className="text-[10px] uppercase font-bold text-rose-500 hover:underline">Отмена</button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {INITIALS_PALETTE.map((hex) => (
                          <button key={hex} type="button" disabled={createCategoryMutation.isPending} onClick={() => createCategoryMutation.mutate({ name: pendingCategory, type, icon: hex })} className="w-10 h-10 rounded-full text-white font-bold hover:scale-110 active:scale-95 transition-all shadow-md disabled:opacity-50" style={{ backgroundColor: hex }}>
                            {pendingCategory.charAt(0).toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      {comboInput.trim() && !exactMatch && (
                        <button type="button" onClick={handleCreateCategory} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#FF7A00]/10 transition-colors group">
                          <div className="w-8 h-8 rounded-xl bg-[#FF7A00]/20 flex items-center justify-center group-hover:bg-[#FF7A00]/30"><Plus className="w-4 h-4 text-[#FF7A00]" /></div>
                          <div>
                            <p className="text-sm font-bold text-[#FF7A00]">Создать «{comboInput.trim()}»</p>
                            <p className="text-[10px] font-mono uppercase text-[#1C3F35]/40 dark:text-white/40 mt-0.5">Новая категория</p>
                          </div>
                        </button>
                      )}
                      {filteredCategories.map((cat) => (
                        <button key={cat.id} type="button" onClick={() => handleSelectCategory(cat)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white uppercase shadow-sm shrink-0" style={{ backgroundColor: cat.icon || '#1C3F35' }}>
                            {getRussianCategoryName(cat.name).charAt(0)}
                          </div>
                          <span className="flex-1 text-sm font-bold text-[#1C3F35] dark:text-white">{getRussianCategoryName(cat.name)}</span>
                          {selectedCategoryId === cat.id && <Check className="w-4 h-4 text-[#FF7A00]" />}
                        </button>
                      ))}
                      {filteredCategories.length === 0 && (!comboInput.trim() || exactMatch) && <p className="p-4 text-center text-xs font-bold text-[#1C3F35]/30 dark:text-white/30">Нет категорий</p>}

                      <div className="border-t border-black/5 dark:border-white/5 mt-1 pt-1">
                        <button type="button" onClick={() => { setCategoryManagerOpen(true); setComboOpen(false); }} className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                          <Settings className="w-3.5 h-3.5 text-[#1C3F35]/30 dark:text-white/25 group-hover:text-[#FF7A00] transition-colors" />
                          <span className="text-xs font-semibold text-[#1C3F35]/40 dark:text-white/30 group-hover:text-[#FF7A00] transition-colors">Управление категориями</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Детали ── */}
        <div>
          <label className={labelStyle}>Детали</label>
          <div className={inputWrapperStyle}>
            {/* ИЗМЕНЕНИЯ ЗДЕСЬ: убран slate, добавлен #1C3F35 */}
            <input
              type="text"
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              placeholder={type === 'income' ? 'Аванс, Фриланс...' : 'Пятёрочка, Такси...'}
              className="flex-1 w-full outline-none bg-transparent text-left text-lg font-bold text-[#1C3F35] dark:text-white placeholder-[#1C3F35]/30 dark:placeholder-white/30"
            />
          </div>
        </div>

        {/* ── Submit Button ── */}
        <div className="relative w-full mt-6">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full h-[64px] bg-gradient-to-r from-[#FF7A00] to-[#FFA011] hover:from-[#EA6A00] hover:to-[#FF7A00] text-white rounded-2xl font-bold uppercase tracking-widest text-sm shadow-[0_10px_30px_-5px_rgba(255,122,0,0.4)] transition-all flex items-center justify-center disabled:opacity-70 active:scale-[0.98]"
          >
            {mutation.isPending ? 'Сохранение...' : 'Сохранить запись'}
          </button>
        </div>
      </form>

      {/* ── Category Manager Modal (ВНЕ ФОРМЫ) ─────────────── */}
      <CategoryManagerModal
        isOpen={categoryManagerOpen}
        onClose={() => setCategoryManagerOpen(false)}
      />
    </div>
  );
}