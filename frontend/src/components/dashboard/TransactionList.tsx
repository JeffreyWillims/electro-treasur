/**
 * TransactionList — бесконечная лента транзакций с двумя режимами редактирования.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTransactions, fetchCategories, updateTransaction, deleteTransaction } from '@/api/client';
import type { CategoryRead, TransactionResponse, TransactionUpdate } from '@/types';
import { cn } from '@/lib/utils';
import { getLocalDateString } from '@/lib/dateUtils';
import { Search, X, SlidersHorizontal, ScanLine } from 'lucide-react';
import { GlassDateRangePicker } from '@/components/ui/GlassDateRangePicker';
import { StatementImportModal } from './StatementImportModal';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

// Хук для закрытия фильтров при клике снаружи
function useOnClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return;
      handler();
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

const PAGE_SIZE = 10;

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

const filterInputStyle = cn(
  "w-full h-12 px-4 rounded-xl transition-all duration-300 outline-none text-sm font-bold text-[#1C3F35] dark:text-white placeholder-[#1C3F35]/30 dark:placeholder-white/30",
  "bg-black/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] border border-transparent",
  "dark:bg-black/40 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]",
  "focus:bg-white focus:shadow-md focus:border-[#1C3F35]/20",
  "dark:focus:bg-[#1A1A1A] dark:focus:shadow-none dark:focus:border-white/20"
);

export function TransactionList() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [editingTxId, setEditingTxId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [drawerTx, setDrawerTx] = useState<TransactionResponse | null>(null);
  const [page, setPage] = useState(1);
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(filterRef, () => setIsFiltersOpen(false));

  const [isScanOpen, setIsScanOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['transactions', page, selectedCategory, typeFilter, minAmount, maxAmount, startDate, endDate, debouncedSearch],
    queryFn: () => fetchTransactions(PAGE_SIZE, (page - 1) * PAGE_SIZE, selectedCategory, typeFilter, minAmount, maxAmount, startDate, endDate, debouncedSearch),
  });

  const { data: categories = [] } = useQuery<CategoryRead[]>({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  const transactions = data?.items ?? [];

  const patchMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TransactionUpdate }) => updateTransaction(id, payload),
    onMutate: async ({ id, payload }) => {
      await queryClient.cancelQueries({ queryKey: ['transactions'] });
      queryClient.setQueriesData({ queryKey: ['transactions'] }, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((tx: TransactionResponse) => tx.id === id ? { ...tx, ...payload } : tx),
        };
      });
    },
    onError: () => toast.error('Не удалось обновить транзакцию'),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onSuccess: () => toast.success('Сумма обновлена'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTransaction(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['transactions'] });
      queryClient.setQueriesData({ queryKey: ['transactions'] }, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.filter((tx: TransactionResponse) => tx.id !== id),
          total: Math.max(0, old.total - 1),
        };
      });
      setDrawerTx(null);
    },
    onError: () => toast.error('Не удалось удалить транзакцию'),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onSuccess: () => toast.success('Транзакция удалена'),
  });

  const startEdit = useCallback((tx: TransactionResponse, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTxId(tx.id);
    setEditValue(Math.abs(parseFloat(tx.amount.toString())).toString());
  }, []);

  const commitEdit = useCallback((txId: number) => {
    setEditingTxId(null);
    const numVal = parseFloat(editValue);
    if (isNaN(numVal) || numVal <= 0) return;
    patchMutation.mutate({ id: txId, payload: { amount: numVal } });
  }, [editValue, patchMutation]);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent, txId: number) => {
    if (e.key === 'Enter') commitEdit(txId);
    else if (e.key === 'Escape') setEditingTxId(null);
  }, [commitEdit]);

  const openDrawer = useCallback((tx: TransactionResponse) => {
    if (editingTxId) return;
    setDrawerTx(tx);
  }, [editingTxId]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="flex flex-col gap-8 w-full mt-4 pb-24"
      >
          <div className="flex flex-col gap-6 mb-4">
            {/* Верхний заголовок */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-2">
              <div>
                <h1 className="text-3xl md:text-4xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white leading-none">
                  История
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <div className="flex gap-6 text-[10px] font-mono font-bold uppercase tracking-widest text-[#1C3F35]/40 dark:text-white/40">
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                    Расход
                  </span>
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    Доход
                  </span>
                </div>

                <div className="flex gap-2.5">
                  <button onClick={() => setIsScanOpen(true)} className="group flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors font-bold text-sm text-[#1C3F35] dark:text-white">
                    <ScanLine className="w-4 h-4 text-[#1C3F35]/50 dark:text-white/50 group-hover:text-[#FF7A00] transition-colors" />
                    Сканировать
                  </button>
                </div>
              </div>
            </div>

            {/* Панель фильтров */}
            <div className="flex flex-col md:flex-row items-center gap-4 w-full p-2 bg-white/40 dark:bg-[#111111]/40 backdrop-blur-3xl border border-black/5 dark:border-white/10 rounded-[2rem] shadow-sm z-20 relative">
              <div className={cn(
                "relative flex-1 w-full rounded-2xl h-14 md:h-16 px-4 md:px-5 transition-all duration-300 flex items-center",
                "bg-black/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] border border-transparent",
                "dark:bg-black/40 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]",
                "focus-within:bg-white focus-within:shadow-md focus-within:border-[#1C3F35]/20",
                "dark:focus-within:bg-[#1A1A1A] dark:focus-within:shadow-none dark:focus-within:border-white/20"
              )}>
                <Search className="w-5 h-5 text-[#1C3F35]/40 dark:text-white/30 shrink-0" />
                <input
                  type="text" placeholder="Поиск по транзакциям..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 w-full h-full bg-transparent border-none px-4 text-lg font-bold text-[#1C3F35] dark:text-white placeholder-[#1C3F35]/30 dark:placeholder-white/30 outline-none transition-all"
                />
                {searchQuery.length > 0 && (
                  <button onClick={() => setSearchQuery('')} className="p-1 text-[#1C3F35]/40 dark:text-white/30 hover:text-[#FF7A00] transition-colors shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="relative h-14 md:h-16 w-full md:w-auto" ref={filterRef}>
                <button onClick={() => setIsFiltersOpen(prev => !prev)} className="w-full md:w-auto px-6 h-full rounded-2xl bg-black/5 dark:bg-white/5 font-bold text-[#1C3F35] dark:text-white hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex items-center justify-center gap-2 whitespace-nowrap shadow-sm border border-transparent dark:border-white/5">
                  <SlidersHorizontal className="w-4 h-4 text-[#1C3F35]/50 dark:text-white/50" />
                  Фильтры
                </button>

                <AnimatePresence>
                  {isFiltersOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsFiltersOpen(false)} />
                      <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="absolute right-0 top-[110%] w-[calc(100vw-32px)] md:w-80 p-6 bg-white/95 dark:bg-[#121212]/95 backdrop-blur-3xl border border-black/10 dark:border-white/10 rounded-[2rem] shadow-2xl z-50">
                        <div className="flex flex-col gap-6">
                          <p className="text-lg font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-emerald-400">
                            Параметры фильтрации
                          </p>

                          <div>
                            <label className="text-sm font-bold tracking-wide text-slate-800 dark:text-white mb-2 block">Категория</label>
                            <select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }} className={cn(filterInputStyle, "cursor-pointer appearance-none")}>
                              <option value="" className="bg-white dark:bg-[#1A1A1A]">Все категории</option>
                              {categories.map(c => <option key={c.id} value={c.id} className="bg-white dark:bg-[#1A1A1A]">{getRussianCategoryName(c.name)}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-sm font-bold tracking-wide text-slate-800 dark:text-white mb-2 block">Сумма</label>
                            <div className="grid grid-cols-2 gap-2">
                              <input type="number" placeholder="От ₽" value={minAmount} onChange={(e) => { setMinAmount(e.target.value); setPage(1); }} className={filterInputStyle} />
                              <input type="number" placeholder="До ₽" value={maxAmount} onChange={(e) => { setMaxAmount(e.target.value); setPage(1); }} className={filterInputStyle} />
                            </div>
                          </div>
                          <div>
                            <label className="text-sm font-bold tracking-wide text-slate-800 dark:text-white mb-2 block">Период</label>
                            <GlassDateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); setPage(1); }} align="right" />
                          </div>
                          <div>
                            <label className="text-sm font-bold tracking-wide text-slate-800 dark:text-white mb-2 block">Тип операции</label>
                            <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className={cn(filterInputStyle, "cursor-pointer appearance-none")}>
                              <option value="" className="bg-white dark:bg-[#1A1A1A]">Все типы</option>
                              <option value="income" className="bg-white dark:bg-[#1A1A1A]">Доходы</option>
                              <option value="expense" className="bg-white dark:bg-[#1A1A1A]">Расходы</option>
                            </select>
                          </div>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="border-t border-black/5 dark:border-white/5 pt-8">
            <div className="min-h-[500px] w-full">
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
                    {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-black/5 dark:bg-white/5 rounded-2xl animate-pulse" />)}
                  </motion.div>
                ) : transactions.length === 0 ? (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-32 text-center">
                    <p className="text-[#1C3F35]/40 dark:text-white/30 font-sans font-extrabold text-xl">Хроника пуста</p>
                  </motion.div>
                ) : (
                  <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                    {transactions.map((tx) => {
                      const catDef = categories.find(c => c.id === tx.category_id);
                      const isIncome = catDef ? catDef.type === 'income' : parseFloat(tx.amount.toString()) > 0;
                      const absAmount = Math.abs(parseFloat(tx.amount.toString()));
                      const catName = tx.category_name || 'Без категории';

                      return (
                        <motion.div
                          key={tx.id}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
                          onClick={() => openDrawer(tx)}
                          className="group flex flex-col md:flex-row md:items-center justify-between py-5 bg-white/40 dark:bg-[#111111]/40 backdrop-blur-md border border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 px-6 rounded-2xl transition-colors duration-300 cursor-pointer"
                        >
                          <div className="flex items-center gap-5">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm shrink-0" style={{ backgroundColor: catDef?.icon || '#1C3F35' }}>
                              <span className="text-sm font-bold text-white uppercase">{getRussianCategoryName(catName).charAt(0)}</span>
                            </div>
                            <div>
                              <p className="text-base font-sans font-extrabold text-[#1C3F35] dark:text-white tracking-tight leading-tight mb-1">
                                {getRussianCategoryName(catName)}
                              </p>
                              <div className="flex items-center gap-3">
                                <p className="text-[10px] font-mono font-bold text-[#1C3F35]/50 dark:text-white/40 uppercase tracking-widest">
                                  {new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(tx.executed_at))}
                                </p>
                                {tx.comment && (
                                  <>
                                    <div className="w-1 h-1 rounded-full bg-[#1C3F35]/20 dark:bg-white/20" />
                                    <p className="text-[11px] font-bold text-[#1C3F35]/60 dark:text-white/50">{tx.comment}</p>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right mt-4 md:mt-0" onClick={(e) => e.stopPropagation()}>
                            {editingTxId === tx.id ? (
                              <input
                                type="number" autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={() => commitEdit(tx.id)} onKeyDown={(e) => handleEditKeyDown(e, tx.id)}
                                className={cn(
                                  "bg-white dark:bg-[#1A1A1A] rounded-xl px-3 py-1 text-right w-36 text-xl md:text-2xl font-sans font-black tabular-nums tracking-tighter outline-none text-[#1C3F35] dark:text-white",
                                  "shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] border border-[#1C3F35]/20 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]"
                                )}
                              />
                            ) : (
                              <p
                                onClick={(e) => startEdit(tx, e)}
                                className={cn(
                                  "text-xl md:text-2xl font-sans font-black tabular-nums tracking-tighter transition-colors duration-300 cursor-text rounded-xl px-3 py-1 -mr-3 inline-block",
                                  isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-500"
                                )}
                                title="Нажмите для редактирования"
                              >
                                {isIncome ? '+' : '-'}{absAmount.toLocaleString('ru-RU')}
                                <span className="ml-1 text-sm font-bold opacity-40">{tx.currency === 'RUB' ? '₽' : tx.currency}</span>
                              </p>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {isFetching && (
              <div className="py-8 flex items-center justify-center gap-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div key={i} className="w-2 h-2 rounded-full bg-[#FF7A00]" animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
                  ))}
                </div>
              </div>
            )}

            {!isFetching && (
              <div className="flex items-center justify-between mt-6 p-4 bg-white/40 dark:bg-white/5 backdrop-blur-md rounded-2xl border border-black/5 dark:border-white/5 shadow-sm">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-5 py-2 font-bold text-sm text-[#1C3F35] dark:text-white disabled:opacity-30 transition-all hover:bg-black/5 dark:hover:bg-white/10 rounded-xl">← Назад</button>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#1C3F35]/50 dark:text-white/50">Страница {page}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={!data?.items || data.items.length < PAGE_SIZE} className="px-5 py-2 font-bold text-sm text-[#1C3F35] dark:text-white disabled:opacity-30 transition-all hover:bg-black/5 dark:hover:bg-white/10 rounded-xl">Вперед →</button>
              </div>
            )}
          </div>
      </motion.div>

      {/* ── Glass Drawer ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {drawerTx && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
              onClick={() => setDrawerTx(null)}
              className="fixed inset-0 z-40 bg-black/20 dark:bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 h-full w-full max-w-md z-50 bg-white/90 dark:bg-[#0A0A0A]/95 backdrop-blur-3xl border-l border-black/5 dark:border-white/10 shadow-[-20px_0_60px_rgba(0,0,0,0.1)] dark:shadow-[-20px_0_60px_rgba(0,0,0,0.6)] overflow-y-auto"
            >
              <DrawerContent
                tx={drawerTx} categories={categories} onClose={() => setDrawerTx(null)} onDelete={(id) => deleteMutation.mutate(id)} isDeleting={deleteMutation.isPending}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <StatementImportModal isOpen={isScanOpen} onClose={() => setIsScanOpen(false)} />
    </>
  );
}

// ── Компонент содержимого шторки ──────────────────────────────────────────
function DrawerContent({
  tx,
  categories,
  onClose,
  onDelete,
  isDeleting,
}: {
  tx: TransactionResponse;
  categories: CategoryRead[];
  onClose: () => void;
  onDelete: (id: number) => void;
  isDeleting: boolean;
}) {
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ИСПРАВЛЕНИЕ: Безопасный доступ к массиву после split() с помощью ??
  const [amount, setAmount] = useState(() => {
    const num = Math.abs(parseFloat(tx.amount.toString()));
    const parts = num.toString().split('.');
    const firstPart = parts[0] ?? '0';
    let intPart = firstPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const secondPart = parts[1];
    return secondPart !== undefined ? `${intPart}.${secondPart}` : intPart;
  });

  const [categoryId, setCategoryId] = useState(tx.category_id);
  const [date, setDate] = useState(
    tx.executed_at ? getLocalDateString(new Date(tx.executed_at)) : ''
  );
  const [comment, setComment] = useState(tx.comment || '');

  const catDef = categories.find(c => c.id === categoryId);
  const isIncome = catDef ? catDef.type === 'income' : parseFloat(tx.amount.toString()) > 0;

  // ИСПРАВЛЕНИЕ: Безопасный доступ
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d.,]/g, '').replace(',', '.');
    const parts = raw.split('.');
    const firstPart = parts[0] ?? '';
    let integerPart = firstPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const secondPart = parts[1];
    setAmount(secondPart !== undefined ? `${integerPart}.${secondPart.slice(0, 2)}` : integerPart);
  };

  const updateMutation = useMutation({
    mutationFn: (payload: TransactionUpdate) => updateTransaction(tx.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
      toast.success('Транзакция обновлена');
    },
    onError: () => {
      toast.error('Не удалось обновить транзакцию');
    }
  });

  const handleSave = () => {
    const parsedAmount = parseFloat(amount.replace(/\s/g, ''));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Некорректная сумма');
      return;
    }

    const executedAt = date ? `${date}T12:00:00Z` : tx.executed_at;

    updateMutation.mutate({
      amount: parsedAmount,
      category_id: categoryId,
      executed_at: executedAt,
      comment: comment || undefined
    });
  };

  const inputWrapperStyle = cn(
    "flex items-center w-full rounded-2xl h-14 md:h-16 px-4 md:px-5 transition-all duration-300",
    "bg-black/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] border border-transparent",
    "dark:bg-black/40 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]",
    "focus-within:bg-white focus-within:shadow-md focus-within:border-[#1C3F35]/20",
    "dark:focus-within:bg-[#1A1A1A] dark:focus-within:shadow-none dark:focus-within:border-[#1C3F35]/20"
  );

  const labelStyle = "block mb-2 text-[14px] md:text-[15px] font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-emerald-400 dark:drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]";

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-black/5 dark:border-white/5">
        <h2 className="text-xl md:text-2xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white">Редактирование</h2>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5 text-[#1C3F35]/50 dark:text-white/50" />
        </button>
      </div>

      {/* Content - Full CRUD Form */}
      <div className="flex-1 p-6 md:p-8 space-y-6">

        {/* Сумма */}
        <div>
          <label className={labelStyle}>Сумма</label>
          <div className={inputWrapperStyle}>
             <div className="font-bold text-[#1C3F35]/40 dark:text-white/40 mr-2 text-xl">
               {isIncome ? '+' : '-'}
             </div>
             <input
               type="text"
               inputMode="decimal"
               value={amount}
               onChange={handleAmountChange}
               className="flex-1 w-full outline-none bg-transparent text-left text-xl md:text-2xl font-sans font-black tabular-nums tracking-tighter text-[#1C3F35] dark:text-white placeholder-[#1C3F35]/40 dark:placeholder-white/40 px-2"
             />
          </div>
        </div>

        {/* Категория */}
        <div>
          <label className={labelStyle}>Категория</label>
          <div className="relative">
            <div className={inputWrapperStyle}>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(Number(e.target.value))}
                className="w-full bg-transparent outline-none cursor-pointer appearance-none pr-10 text-lg font-bold text-[#1C3F35] dark:text-white"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id} className="bg-white dark:bg-[#1A1A1A] text-[#1C3F35] dark:text-white">
                    {getRussianCategoryName(c.name)}
                  </option>
                ))}
              </select>
            </div>
            <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
              <div className="w-2 h-2 border-r-2 border-b-2 border-[#1C3F35]/40 dark:border-white/40 rotate-45 -translate-y-0.5" />
            </div>
          </div>
        </div>

        {/* Дата */}
        <div>
          <label className={labelStyle}>Дата</label>
          <div className={inputWrapperStyle}>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 w-full outline-none bg-transparent text-left text-lg font-bold text-[#1C3F35] dark:text-white cursor-pointer"
              style={{ colorScheme: 'light dark' }}
            />
          </div>
        </div>

        {/* Детали */}
        <div>
          <label className={labelStyle}>Детали</label>
          <div className={inputWrapperStyle}>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="flex-1 w-full outline-none bg-transparent text-left text-lg font-bold text-[#1C3F35] dark:text-white placeholder-[#1C3F35]/40 dark:placeholder-white/40"
              placeholder="Без комментария"
            />
          </div>
        </div>
      </div>

      {/* Подвал с действиями */}
      <div className="mt-auto p-6 md:p-8 border-t border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="w-full bg-gradient-to-r from-[#FF7A00] to-[#FFA011] hover:from-[#EA6A00] hover:to-[#FF7A00] text-white rounded-2xl font-bold uppercase tracking-widest text-sm shadow-[0_10px_30px_-5px_rgba(255,122,0,0.4)] transition-all h-[64px] flex items-center justify-center active:scale-[0.98] disabled:opacity-70"
        >
          {updateMutation.isPending ? (
             <motion.div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
          ) : (
            "Сохранить изменения"
          )}
        </button>

        <AnimatePresence mode="wait">
          {!confirmDelete ? (
            <motion.button
              key="delete-trigger"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDelete(true)}
              className="w-full mt-6 text-rose-500 font-bold text-[11px] uppercase tracking-widest font-mono hover:underline block text-center"
            >
              Удалить транзакцию
            </motion.button>
          ) : (
            <motion.div
              key="delete-confirm"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mt-6 p-4 rounded-2xl border border-rose-500/20 bg-rose-500/5"
            >
              <p className="text-center text-[10px] font-mono font-bold uppercase tracking-widest text-rose-500 mb-4">Вы уверены?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 py-3 rounded-xl border border-black/10 dark:border-white/10 font-bold text-[#1C3F35]/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-sm"
                >
                  Отмена
                </button>
                <button
                  onClick={() => onDelete(tx.id)}
                  disabled={isDeleting}
                  className="flex-1 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold transition-colors disabled:opacity-50 flex items-center justify-center shadow-md text-sm"
                >
                  {isDeleting ? "..." : "Удалить"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}