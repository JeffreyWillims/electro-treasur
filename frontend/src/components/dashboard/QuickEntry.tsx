/**
 * QuickEntry — Premium transaction entry with Magic Combobox.
 *
 * Features:
 *   • Zero-Latency Emoji via getCategoryIcon() — instant visual feedback.
 *   • Smart Combobox with fuzzy filter + "Create on the fly" option.
 *   • useOnClickOutside hook for closing the dropdown.
 *   • POST /categories integration for dynamic category creation.
 *   • Two-Phase Creation: Initials Picker (Monzo/Revolut pattern).
 *   • Race Condition Fix: async invalidateQueries + comboInput reset.
 *   • Citrine Vault California Organic Luxury aesthetic.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { PlusCircle, Tag, Search, Plus, Check, Settings } from 'lucide-react';
import { createTransaction, fetchCategories, createCategory } from '@/api/client';
import type { CategoryRead } from '@/types';
import { getLocalDateString } from '@/lib/dateUtils';
import { CategoryManagerModal } from './CategoryManagerModal';

const CURRENCIES = ['RUB', 'USD', 'EUR'];

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
  return rawName;
};

// ── Initials Picker Palette — Fintech Grade ───────────────────────────
const INITIALS_PALETTE = [
  '#1C3F35',
  '#FF7A00',
  '#C5A059',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
];

// ── useOnClickOutside Hook ─────────────────────────────────────────────
function useOnClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  handler: () => void,
) {
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
  const [isSuccessAnim, setIsSuccessAnim] = useState(false);

  // ── Combobox State ────────────────────────────────────────────────────
  const [comboOpen, setComboOpen] = useState(false);
  const [comboInput, setComboInput] = useState('');

  // ── Category Manager Modal ────────────────────────────────────────────
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);

  // ── Two-Phase Creation: Phase 1 stores the name, Phase 2 picks color ──
  const [pendingCategory, setPendingCategory] = useState<string | null>(null);

  useOnClickOutside(comboRef, useCallback(() => {
    setComboOpen(false);
    setPendingCategory(null);
  }, []));

  // ── Queries ───────────────────────────────────────────────────────────
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  const filteredCategories = categories
    .filter((c) => c.type === type)
    .filter((c) => {
      if (!comboInput) return true;
      const term = comboInput.toLowerCase();
      const catName = c.name.toLowerCase();
      const translated = getRussianCategoryName(c.name).toLowerCase();
      return catName.includes(term) || translated.includes(term);
    });

  const exactMatch = filteredCategories.some((c) => {
    const catName = c.name.toLowerCase();
    const translated = getRussianCategoryName(c.name).toLowerCase();
    const term = comboInput.toLowerCase();
    return catName === term || translated === term;
  });

  // ── Create Category Mutation ──────────────────────────────────────────
  // PHASE 1: async invalidateQueries — cache fully refreshes before
  //           isPending drops, eliminating the "ghost button" flicker.
  // PHASE 2: setComboInput(newCat.name) — cache is already hydrated via
  //           awaited invalidateQueries, so exactMatch fires immediately,
  //           suppressing the "Создать" button. User sees what they created.
  const createCategoryMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: async (newCat: CategoryRead) => {
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      setSelectedCategoryId(newCat.id);
      setComboInput(newCat.name);
      setComboOpen(false);
      setPendingCategory(null);
      toast.success(`Категория «${newCat.name}» создана`, {
        description: `${newCat.type === 'income' ? 'Доход' : 'Расход'}`,
      });
    },
    onError: (error: Error) => {
      toast.error(`Ошибка создания: ${error.message}`);
      setPendingCategory(null);
    },
  });

  // ── Phase 1: Intercept creation, store pending name ───────────────────
  const handleCreateCategory = () => {
    if (!comboInput.trim()) return;
    setPendingCategory(comboInput.trim());
  };

  const handleSelectCategory = (cat: CategoryRead) => {
    setSelectedCategoryId(cat.id);
    setComboInput(getRussianCategoryName(cat.name));
    setComboOpen(false);
  };

  // ── Transaction Mutation ──────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: (payload: Parameters<typeof createTransaction>[0]) => createTransaction(payload),
    onSuccess: () => {
      setIsSuccessAnim(true);
      setTimeout(() => {
        setIsSuccessAnim(false);
        setAmount('');
        setSubcategory('');
        setType('expense');
        setSelectedCategoryId(null);
        setComboInput('');
      }, 1500);
      toast.success('Транзакция сохранена', {
        description: `${type === 'income' ? '+' : '-'}${amount} ${currency}`,
      });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d.,]/g, '').replace(',', '.');
    const parts = raw.split('.');
    let integerPart = parts[0] || '';
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    let formatted = integerPart;
    if (parts.length > 1 && parts[1] !== undefined) {
      formatted += '.' + parts[1].slice(0, 2);
    }
    setAmount(formatted);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !selectedCategoryId) {
      toast.error('Заполните сумму и категорию');
      return;
    }
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

  return (
    <div className="w-full bg-white/70 dark:bg-[#111111]/80 backdrop-blur-3xl border border-vault-pine/[0.04] dark:border-white/5 shadow-[0_8px_30px_rgba(28,63,53,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.8)] rounded-3xl p-8 transition-all duration-300 ease-out">
      <div className="flex items-center gap-3 mb-7">
        <div className="p-2.5 bg-[#FF7A00]/[0.08] rounded-xl">
          <PlusCircle className="w-[18px] h-[18px] text-[#FF7A00]" />
        </div>
        <div>
          <h2 className="text-xl font-bold leading-tight text-[#1C3F35] dark:text-white">Новая операция</h2>
          <p className="text-sm font-medium text-vault-pine/40 dark:text-white/30 mt-1">
            Быстрое добавление
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Type Toggle */}
        <div className="relative flex bg-vault-pine/5 dark:bg-white/5 p-1 rounded-xl w-full mb-6 transition-colors duration-500">
          <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white dark:bg-[#FF7A00] border border-vault-pine/10 dark:border-[#FF7A00]/50 rounded-lg transition-transform duration-300 ease-out shadow-sm ${type === 'income' ? 'translate-x-full left-0' : 'translate-x-0 left-1'}`} />
          <button
            type="button"
            onClick={() => { setType('expense'); setSelectedCategoryId(null); setComboInput(''); setPendingCategory(null); }}
            className={`relative z-10 flex-1 py-3 text-lg font-bold transition-colors duration-300 ${type === 'expense' ? 'text-[#1C3F35] dark:text-[#050505]' : 'text-vault-pine/30 hover:text-vault-pine/50 dark:text-white/30 dark:hover:text-white/50'}`}
          >
            Расход
          </button>
          <button
            type="button"
            onClick={() => { setType('income'); setSelectedCategoryId(null); setComboInput(''); setPendingCategory(null); }}
            className={`relative z-10 flex-1 py-3 text-lg font-bold transition-colors duration-300 ${type === 'income' ? 'text-[#1C3F35] dark:text-[#050505]' : 'text-vault-pine/30 hover:text-vault-pine/50 dark:text-white/30 dark:hover:text-white/50'}`}
          >
            Доход
          </button>
        </div>

        {/* Row 2: Amount (70%) + Date (30%) */}
        <div className="flex gap-4 items-end">
          <div className="w-[70%]">
            <label className="block mb-2 text-sm font-semibold text-[#1C3F35]/70 dark:text-white/60">Сумма</label>
            <div className="flex bg-white/40 dark:bg-black/20 rounded-2xl px-4 items-center h-16 focus-within:ring-2 focus-within:ring-[#1C3F35]/10 dark:focus-within:ring-[#FF7A00]/20 transition-all duration-300">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0.00"
                className="flex-1 w-full outline-none bg-transparent text-[#1C3F35] dark:text-white text-2xl font-bold tabular-nums placeholder:text-vault-pine/15 dark:placeholder:text-white/10"
              />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="ml-3 bg-transparent text-sm font-bold text-slate-400 outline-none cursor-pointer"
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="w-[30%]">
            <label className="block mb-2 text-sm font-semibold text-[#1C3F35]/70 dark:text-white/60">Дата</label>
            <div className="bg-white/40 dark:bg-black/20 border border-white/20 rounded-2xl h-16 flex items-center justify-center focus-within:ring-2 focus-within:ring-[#1C3F35]/10 dark:focus-within:ring-[#FF7A00]/20 transition-all duration-300">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-transparent outline-none text-center text-lg font-semibold text-slate-800 dark:text-white cursor-pointer px-2"
                style={{ colorScheme: 'light dark' }}
              />
            </div>
          </div>
        </div>

        {/* Row 3: Magic Combobox */}
        <div ref={comboRef} className="relative">
          <label className="block mb-2 text-sm font-semibold text-[#1C3F35]/70 dark:text-white/60">Категория</label>
          <div className="relative flex items-center bg-white/40 dark:bg-black/20 border border-white/40 dark:border-white/10 rounded-2xl focus-within:border-[#1C3F35]/30 focus-within:ring-2 focus-within:ring-[#1C3F35]/10 dark:focus-within:border-[#FF7A00]/30 dark:focus-within:ring-[#FF7A00]/20 transition-all duration-300 overflow-hidden">
            {/* Custom Color Initials Avatar */}
            <span className="pl-4 pointer-events-none select-none flex items-center justify-center">
              {selectedCat ? (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white uppercase shadow-sm shrink-0"
                  style={{ backgroundColor: selectedCat.icon || '#1C3F35' }}
                >
                  {getRussianCategoryName(selectedCat.name).charAt(0)}
                </div>
              ) : (
                <span className="text-lg">📑</span>
              )}
            </span>
            <input
              type="text"
              value={comboInput}
              onChange={(e) => {
                setComboInput(e.target.value);
                setSelectedCategoryId(null);
                setPendingCategory(null);
                if (!comboOpen) setComboOpen(true);
              }}
              onFocus={() => setComboOpen(true)}
              placeholder="Поиск или создание..."
              className="flex-1 px-3 py-4 outline-none text-base font-semibold bg-transparent text-[#1C3F35] dark:text-white placeholder:text-vault-pine/20 dark:placeholder:text-white/15"
            />
            <Search className="mr-4 w-4 h-4 text-[#FF7A00]/40 pointer-events-none" />
          </div>

          {/* Dropdown */}
          <AnimatePresence>
            {comboOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute z-50 w-full mt-2 py-2 rounded-2xl bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-2xl border border-vault-pine/[0.08] dark:border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.6)] max-h-[300px] overflow-y-auto"
              >
                <AnimatePresence mode="wait">
                  {/* ── Phase 2: Initials Picker Panel ──────────────────── */}
                  {pendingCategory ? (
                    <motion.div
                      key="picker"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                      className="p-5 bg-white/70 dark:bg-black/40 backdrop-blur-2xl rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl mx-2 my-1"
                    >
                      <div className="flex justify-between items-center mb-4">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                          Дизайн для «{pendingCategory}»
                        </p>
                        <button
                          type="button"
                          onClick={() => setPendingCategory(null)}
                          className="text-xs text-rose-500 font-semibold hover:underline"
                        >
                          Отмена
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {INITIALS_PALETTE.map((hexColor) => (
                          <button
                            key={hexColor}
                            type="button"
                            disabled={createCategoryMutation.isPending}
                            onClick={() => {
                              createCategoryMutation.mutate({
                                name: pendingCategory,
                                type,
                                icon: hexColor,
                              });
                            }}
                            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg hover:scale-110 active:scale-95 transition-transform shadow-md border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ backgroundColor: hexColor }}
                          >
                            {pendingCategory.charAt(0).toUpperCase()}
                          </button>
                        ))}
                      </div>
                      {createCategoryMutation.isPending && (
                        <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-3 text-center animate-pulse">
                          Создание...
                        </p>
                      )}
                    </motion.div>
                  ) : (
                    /* ── Phase 1: Normal dropdown list ─────────────────── */
                    <motion.div
                      key="list"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.1 }}
                    >
                      {/* Create option — shown when no exact match */}
                      {comboInput.trim() && !exactMatch && (
                        <button
                          type="button"
                          onClick={handleCreateCategory}
                          className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-[#FF7A00]/[0.06] dark:hover:bg-[#FF7A00]/10 transition-colors duration-150 group"
                        >
                          <div className="w-9 h-9 rounded-xl bg-[#FF7A00]/10 flex items-center justify-center group-hover:bg-[#FF7A00]/20 transition-colors">
                            <Plus className="w-4 h-4 text-[#FF7A00]" />
                          </div>
                          <div className="flex-1 min-w-0 ml-1">
                            <p className="text-sm font-bold text-[#FF7A00] truncate">
                              Создать «{comboInput.trim()}»
                            </p>
                            <p className="text-[10px] font-mono text-vault-pine/30 dark:text-white/20 uppercase tracking-wider mt-1">
                              · {type === 'income' ? 'доход' : 'расход'} · выбери цвет →
                            </p>
                          </div>
                        </button>
                      )}

                      {/* Filtered categories with Custom Color Initials */}
                      {filteredCategories.map((cat) => {
                        const displayName = getRussianCategoryName(cat.name);
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => handleSelectCategory(cat)}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-vault-pine/[0.03] dark:hover:bg-white/[0.04] transition-colors duration-150"
                          >
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white uppercase shadow-sm shrink-0"
                              style={{ backgroundColor: cat.icon || '#1C3F35' }}
                            >
                              {displayName.charAt(0)}
                            </div>
                            <span className="flex-1 ml-1 text-sm font-semibold text-[#1C3F35] dark:text-white/90 truncate">
                              {displayName}
                            </span>
                            {selectedCategoryId === cat.id && (
                              <Check className="w-4 h-4 text-[#FF7A00]" />
                            )}
                          </button>
                        );
                      })}

                      {/* Empty state */}
                      {filteredCategories.length === 0 && (!comboInput.trim() || exactMatch) && (
                        <p className="px-4 py-6 text-center text-sm text-vault-pine/30 dark:text-white/20 italic">
                          Нет категорий
                        </p>
                      )}

                      {/* ── Category Manager Trigger ──────────────── */}
                      <div className="border-t border-vault-pine/[0.06] dark:border-white/[0.05] mt-1 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setCategoryManagerOpen(true);
                            setComboOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-vault-pine/[0.04] dark:hover:bg-white/[0.04] transition-colors duration-150 group"
                        >
                          <Settings className="w-3.5 h-3.5 text-vault-pine/30 dark:text-white/25 group-hover:text-[#FF7A00] transition-colors duration-150" />
                          <span className="text-xs font-semibold text-vault-pine/40 dark:text-white/30 group-hover:text-[#FF7A00] transition-colors duration-150">
                            Управление категориями
                          </span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Category Manager Modal (portal-style mount) ─────────────── */}
        <CategoryManagerModal
          isOpen={categoryManagerOpen}
          onClose={() => setCategoryManagerOpen(false)}
        />

        {/* Row 4: Details */}
        <div>
          <label className="block mb-2 text-sm font-semibold text-[#1C3F35]/70 dark:text-white/60 flex items-center gap-1.5">
            <Tag size={14} />
            Детали
          </label>
          <input
            type="text"
            value={subcategory}
            onChange={(e) => setSubcategory(e.target.value)}
            placeholder={type === 'income' ? 'Напр.: Аванс, Возврат долга, Фриланс' : 'Напр.: Пятёрочка, Яндекс.Такси'}
            className="w-full bg-white/40 dark:bg-black/20 border border-white/40 dark:border-white/10 rounded-2xl px-4 py-4 outline-none text-base font-medium text-[#1C3F35] dark:text-white placeholder:text-vault-pine/20 dark:placeholder:text-white/20 focus-within:ring-2 focus-within:ring-[#1C3F35]/10 dark:focus-within:ring-[#FF7A00]/20 transition-all duration-300"
          />
        </div>

        {/* Submit — Kinetic Abacus */}
        <div className="relative w-full h-[60px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            {!mutation.isPending && !isSuccessAnim ? (
              <motion.button
                key="idle"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                whileHover={{ scale: 1.01, y: -2 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="w-full absolute inset-0 bg-[#FF7A00] hover:bg-[#EA6A00] text-white px-10 py-5 rounded-2xl font-bold transition-all duration-300 shadow-xl shadow-[#FF7A00]/15 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                Сохранить запись
              </motion.button>
            ) : mutation.isPending ? (
              <motion.div
                key="pending"
                initial={{ height: 60, width: '100%', borderRadius: 16 }}
                animate={{ height: 4, width: '80%', borderRadius: 2 }}
                exit={{ opacity: 0 }}
                className="bg-[#FF7A00]/20 absolute flex items-center shadow-inner overflow-hidden"
              >
                <motion.div
                  className="w-4 h-4 bg-[#FF7A00] rounded-full shadow-[0_0_8px_#FF7A00] absolute"
                  animate={{ left: ['0%', 'calc(100% - 16px)', '0%'] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                />
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ height: 4, width: '80%', borderRadius: 2, backgroundColor: 'rgba(255,122,0,0.2)' }}
                animate={{
                  height: 4,
                  width: '100%',
                  backgroundColor: '#10B981',
                  boxShadow: '0 0 20px rgba(16,185,129,0.5)',
                }}
                exit={{ height: 60, width: '100%', opacity: 0 }}
                className="absolute flex items-center overflow-hidden"
              >
                <motion.div
                  className="w-4 h-4 bg-white rounded-full shadow-[0_0_10px_white] absolute"
                  initial={{ left: '0%' }}
                  animate={{ left: 'calc(100% - 16px)' }}
                  transition={{ duration: 0.4, type: 'spring', stiffness: 100, damping: 10 }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </form>
    </div>
  );
}
