/**
 * TransactionList — Infinite Ledger with Dual-Mode Editing.
 *
 * Architecture:
 *   • useInfiniteQuery — cursor-based pagination via offset.
 *   • Intersection Observer sentinel for auto-fetch.
 *   • Inline Edit — click amount → input → Enter/Blur → PATCH with Optimistic Update.
 *   • Glass Drawer — click row → slide-in panel → full info + DELETE.
 *   • All mutations use Optimistic Updates (onMutate cache manipulation).
 */
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTransactions, fetchCategories, updateTransaction, deleteTransaction } from '@/api/client';
import type { CategoryRead, TransactionResponse, TransactionUpdate } from '@/types';
import { cn } from '@/lib/utils';
import { Search, X, Trash2, Calendar, CreditCard, Tag, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

const PAGE_SIZE = 10;

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

function getCategoryIcon(name: string): string {
  const n = name.toLowerCase();
  if (/корм|животн/.test(n)) return '🐾';
  if (/кофе|кафе/.test(n)) return '☕';
  if (/продукт|еда|grocery|food/.test(n)) return '🛒';
  if (/такси|бензин|транспорт|transport|logistics/.test(n)) return '🚗';
  if (/подписк|интернет|связь/.test(n)) return '🌐';
  if (/сигарет|вейп/.test(n)) return '💨';
  if (/зарплат|доход|income|propulsion/.test(n)) return '💰';
  if (/аренд|жильё|жилье|housing|rent|operation/.test(n)) return '🏠';
  if (/здоров|врач|аптек|health|wellness/.test(n)) return '💊';
  if (/отдых|развлеч|leisure/.test(n)) return '🎭';
  if (/инвест|рост|growth/.test(n)) return '📈';
  if (/покупк|shopping/.test(n)) return '🛍️';
  if (/образован|учёб|education/.test(n)) return '📚';
  return '✨';
}


export function TransactionList() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // ── Inline Edit State ──────────────────────────────────────────────
  const [editingTxId, setEditingTxId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  // ── Glass Drawer State ─────────────────────────────────────────────
  const [drawerTx, setDrawerTx] = useState<TransactionResponse | null>(null);

  // ── Pagination and Filters ──────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // ── Pagination Query ─────────────────────────────────────────────────
  const {
    data,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['transactions', page, selectedCategory, typeFilter, minAmount, maxAmount, startDate, endDate],
    queryFn: () => fetchTransactions(
      PAGE_SIZE,
      (page - 1) * PAGE_SIZE,
      selectedCategory,
      typeFilter,
      minAmount,
      maxAmount,
      startDate,
      endDate
    ),
  });

  const { data: categories = [] } = useQuery<CategoryRead[]>({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  // ── Extract items ──────────────────────────────────────────────────
  const transactions = data?.items ?? [];

  const filteredTransactions = transactions.filter((tx: TransactionResponse) => {
    const matchesSearch = tx.category_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          tx.comment?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // ── PATCH Mutation (Inline Edit) with Optimistic Update ────────────
  const patchMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TransactionUpdate }) =>
      updateTransaction(id, payload),
    onMutate: async ({ id, payload }) => {
      const queryKey = ['transactions', page, selectedCategory, typeFilter, minAmount, maxAmount, startDate, endDate];
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous cache
      const previousData = queryClient.getQueryData(queryKey);

      // Optimistically update the cache
      queryClient.setQueryData(queryKey, (old: typeof data) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((tx: TransactionResponse) =>
            tx.id === id ? { ...tx, ...payload } : tx,
          ),
        };
      });

      return { previousData, queryKey };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
      toast.error('Не удалось обновить транзакцию');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onSuccess: () => {
      toast.success('Сумма обновлена');
    },
  });

  // ── DELETE Mutation with Optimistic Update ─────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTransaction(id),
    onMutate: async (id) => {
      const queryKey = ['transactions', page, selectedCategory, typeFilter, minAmount, maxAmount, startDate, endDate];
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData(queryKey);

      // Optimistically remove from cache
      queryClient.setQueryData(queryKey, (old: typeof data) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.filter((tx: TransactionResponse) => tx.id !== id),
          total: Math.max(0, old.total - 1),
        };
      });

      setDrawerTx(null);
      return { previousData, queryKey };
    },
    onError: (_err, _id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
      toast.error('Не удалось удалить транзакцию');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onSuccess: () => {
      toast.success('Транзакция удалена');
    },
  });

  // ── Inline Edit Handlers ───────────────────────────────────────────
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
    if (e.key === 'Enter') {
      commitEdit(txId);
    } else if (e.key === 'Escape') {
      setEditingTxId(null);
    }
  }, [commitEdit]);

  // ── Drawer open ────────────────────────────────────────────────────
  const openDrawer = useCallback((tx: TransactionResponse) => {
    if (editingTxId) return; // don't open drawer while editing
    setDrawerTx(tx);
  }, [editingTxId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FF7A00]/10 flex items-center justify-center animate-pulse">
            <div className="w-4 h-4 rounded-full bg-[#FF7A00] animate-ping" />
          </div>
          <p className="text-sm font-mono text-vault-pine/30 dark:text-white/20 uppercase tracking-widest">Загрузка хронографа...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="premium-card p-0 md:p-12 w-full min-h-screen border-0 rounded-none shadow-none bg-transparent">
        <div className="max-w-screen-2xl mx-auto px-4 py-8">
          <div className="flex flex-col gap-8 mb-12">
            {/* Top Header: Title & Legend */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <h1 className="text-4xl md:text-5xl font-extrabold text-[#1C3F35] dark:text-emerald-50 tracking-tight mb-8" style={{ textShadow: "1px 1px 0px rgba(255,255,255,0.8), -1px -1px 0px rgba(0,0,0,0.05)" }}>История</h1>
                <p className="text-[10px] font-mono text-aura-gold uppercase tracking-[0.4em] font-bold opacity-60">
                  Финансовый хронограф Citrine Vault
                </p>
              </div>
              <div className="flex gap-6 text-[10px] font-mono font-bold uppercase tracking-widest text-aura-gold/40">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-expense" />
                  Расход
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-aura-emerald" />
                  Доход
                </span>
              </div>
            </div>
            
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 w-full p-2 bg-white/40 dark:bg-black/20 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-2xl shadow-sm mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Поиск по транзакциям..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full flex-1 h-12 bg-white/50 dark:bg-white/5 border border-white/50 dark:border-white/10 rounded-xl px-12 text-slate-900 dark:text-white placeholder-slate-500 focus:ring-2 focus:ring-[#1C3F35]/20 outline-none transition-all"
                />
              </div>
              <div className="relative">
                <select 
                  value={selectedCategory}
                  onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
                  className="h-12 min-w-[200px] w-full bg-white/50 dark:bg-white/5 border border-white/50 dark:border-white/10 rounded-xl px-4 pr-10 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#1C3F35]/20 outline-none cursor-pointer appearance-none"
                >
                  <option value="">Все категории</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {getRussianCategoryName(c.name)}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <div className="w-2 h-2 border-r-2 border-b-2 border-slate-400 rotate-45 -translate-y-0.5" />
                </div>
              </div>
            </div>

            {/* Advanced Filters */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-white/40 dark:bg-black/20 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-white/10 mb-6">
              <input
                type="number"
                placeholder="От ₽"
                value={minAmount}
                onChange={(e) => { setMinAmount(e.target.value); setPage(1); }}
                className="w-24 h-10 bg-white/50 dark:bg-white/5 border border-white/50 dark:border-white/10 rounded-xl px-3 text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:ring-2 focus:ring-[#1C3F35]/20 outline-none transition-all"
              />
              <input
                type="number"
                placeholder="До ₽"
                value={maxAmount}
                onChange={(e) => { setMaxAmount(e.target.value); setPage(1); }}
                className="w-24 h-10 bg-white/50 dark:bg-white/5 border border-white/50 dark:border-white/10 rounded-xl px-3 text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:ring-2 focus:ring-[#1C3F35]/20 outline-none transition-all"
              />
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="h-10 bg-white/50 dark:bg-white/5 border border-white/50 dark:border-white/10 rounded-xl px-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-[#1C3F35]/20 outline-none transition-all"
                style={{ colorScheme: 'light dark' }}
              />
              <span className="text-slate-400 font-bold">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="h-10 bg-white/50 dark:bg-white/5 border border-white/50 dark:border-white/10 rounded-xl px-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-[#1C3F35]/20 outline-none transition-all"
                style={{ colorScheme: 'light dark' }}
              />
              <select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                className="h-10 bg-white/50 dark:bg-white/5 border border-white/50 dark:border-white/10 rounded-xl px-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-[#1C3F35]/20 outline-none transition-all cursor-pointer"
              >
                <option value="">Все типы</option>
                <option value="income">Доходы</option>
                <option value="expense">Расходы</option>
              </select>
            </div>
          </div>

          <div className="space-y-1 border-t border-aura-gold/5 pt-8">
            {filteredTransactions.length === 0 ? (
              <div className="py-32 text-center">
                <p className="text-aura-graphite/10 dark:text-aura-ivory/10 font-serif italic text-3xl">
                  Хроника пуста
                </p>
              </div>
            ) : (
              filteredTransactions.map((tx, index) => {
                const catDef = categories.find(c => c.id === tx.category_id);
                const isIncome = catDef ? catDef.type === 'income' : parseFloat(tx.amount.toString()) > 0;
                const absAmount = Math.abs(parseFloat(tx.amount.toString()));
                const catName = tx.category_name || 'Без категории';

                return (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => openDrawer(tx)}
                    className="group flex items-center justify-between py-6 border-b border-aura-gold/[0.03] last:border-0 hover:bg-aura-gold/[0.02] px-6 -mx-6 rounded-2xl transition-all duration-300 cursor-pointer"
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 rounded-2xl bg-[#F4F5F6] dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center shadow-inner shrink-0">
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase">
                          {getRussianCategoryName(catName).charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-tight mb-1">
                          {getRussianCategoryName(catName)}
                        </p>
                        <div className="flex items-center gap-3">
                          <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                            {new Intl.DateTimeFormat('ru-RU', {
                              day: '2-digit',
                              month: 'long',
                              hour: '2-digit',
                              minute: '2-digit'
                            }).format(new Date(tx.executed_at))}
                          </p>
                          {tx.comment && (
                            <>
                              <div className="w-1 h-1 rounded-full bg-slate-300" />
                              <p className="text-xs font-medium text-slate-500 italic">{tx.comment}</p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Amount — Inline Edit on click */}
                    <div className="text-right" onClick={(e) => e.stopPropagation()}>
                      {editingTxId === tx.id ? (
                        <input
                          type="number"
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => commitEdit(tx.id)}
                          onKeyDown={(e) => handleEditKeyDown(e, tx.id)}
                          className="bg-white/50 dark:bg-black/50 border border-slate-300 dark:border-white/20 rounded-lg px-2 py-1 text-right w-32 text-2xl font-mono font-black tabular-nums tracking-tighter outline-none focus:ring-2 focus:ring-slate-400 text-[#1C3F35] dark:text-white"
                        />
                      ) : (
                        <p
                          onClick={(e) => startEdit(tx, e)}
                          className={cn(
                            "text-2xl font-mono font-black tabular-nums tracking-tighter text-engraved transition-all duration-300 group-hover:scale-105 cursor-text hover:bg-vault-pine/[0.03] dark:hover:bg-white/[0.04] rounded-xl px-2 py-1 -mr-2",
                            isIncome ? "text-aura-emerald" : "text-expense"
                          )}
                          title="Нажмите для редактирования"
                        >
                          {isIncome ? '+' : '-'}{absAmount.toLocaleString('ru-RU')}
                          <span className="ml-1 text-sm font-bold opacity-40">{tx.currency}</span>
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}

            {isFetching && (
              <div className="py-8 flex items-center justify-center gap-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full bg-[#FF7A00]"
                      animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
                <p className="text-[10px] font-mono text-vault-pine/30 dark:text-white/20 uppercase tracking-widest font-bold">
                  Загрузка истории...
                </p>
              </div>
            )}

            {/* Pagination Controls */}
            {!isFetching && (
              <div className="flex items-center justify-between mt-6 p-4 bg-white/30 dark:bg-white/5 rounded-2xl">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))} 
                  disabled={page === 1} 
                  className="px-4 py-2 font-bold text-[#1C3F35] dark:text-emerald-400 disabled:opacity-30 transition-all hover:bg-black/5 dark:hover:bg-white/5 rounded-lg"
                >
                  ← Назад
                </button>
                <span className="text-sm font-mono font-bold text-slate-500">Страница {page}</span>
                <button 
                  onClick={() => setPage(p => p + 1)} 
                  disabled={!data?.items || data.items.length < PAGE_SIZE} 
                  className="px-4 py-2 font-bold text-[#1C3F35] dark:text-emerald-400 disabled:opacity-30 transition-all hover:bg-black/5 dark:hover:bg-white/5 rounded-lg"
                >
                  Вперед →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Glass Drawer ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {drawerTx && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setDrawerTx(null)}
              className="fixed inset-0 z-40 bg-black/20 dark:bg-black/50 backdrop-blur-sm"
            />

            {/* Drawer Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 h-full w-full max-w-md z-50 bg-white/80 dark:bg-[#050505]/80 backdrop-blur-3xl border-l border-white/20 shadow-[-20px_0_60px_rgba(0,0,0,0.1)] dark:shadow-[-20px_0_60px_rgba(0,0,0,0.5)] overflow-y-auto"
            >
              <DrawerContent
                tx={drawerTx}
                categories={categories}
                onClose={() => setDrawerTx(null)}
                onDelete={(id) => deleteMutation.mutate(id)}
                isDeleting={deleteMutation.isPending}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Drawer Content Component ──────────────────────────────────────────
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
  
  // Local state for Full-CRUD
  const [amount, setAmount] = useState(Math.abs(parseFloat(tx.amount.toString())).toString());
  const [categoryId, setCategoryId] = useState(tx.category_id);
  const [date, setDate] = useState(
    tx.executed_at ? new Date(tx.executed_at).toISOString().split('T')[0] : ''
  );
  const [comment, setComment] = useState(tx.comment || '');

  const catDef = categories.find(c => c.id === tx.category_id);
  const isIncome = catDef ? catDef.type === 'income' : parseFloat(tx.amount.toString()) > 0;
  
  const updateMutation = useMutation({
    mutationFn: (payload: any) => updateTransaction(tx.id, payload),
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
    
    // Convert date back to ISO string for backend
    const executedAt = date ? `${date}T12:00:00Z` : tx.executed_at;

    updateMutation.mutate({
      amount: parsedAmount,
      category_id: categoryId,
      executed_at: executedAt,
      comment: comment
    });
  };

  const inputClasses = "w-full h-12 px-4 rounded-xl outline-none transition-all duration-300 shadow-inner bg-slate-900/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:bg-white/50 dark:focus:bg-white/10 focus:border-emerald-500";
  const labelClasses = "text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block";

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-vault-pine/[0.06] dark:border-white/5">
        <h2 className="text-lg font-bold text-[#1C3F35] dark:text-white">Редактирование</h2>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-xl bg-vault-pine/[0.04] dark:bg-white/5 flex items-center justify-center hover:bg-vault-pine/[0.08] dark:hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4 text-vault-pine/50 dark:text-white/50" />
        </button>
      </div>

      {/* Content - Full CRUD Form */}
      <div className="flex-1 p-6 space-y-6">
        <div>
          <label className={labelClasses}>Сумма</label>
          <div className="relative">
             <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
               {isIncome ? '+' : '-'}
             </div>
             <input
               type="number"
               step="0.01"
               value={amount}
               onChange={(e) => setAmount(e.target.value)}
               className={cn(inputClasses, "pl-8 font-mono font-black tabular-nums text-lg")}
             />
          </div>
        </div>

        <div>
          <label className={labelClasses}>Категория</label>
          <div className="relative">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              className={inputClasses + " cursor-pointer appearance-none pr-10"}
            >
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {getRussianCategoryName(c.name)}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <div className="w-2 h-2 border-r-2 border-b-2 border-slate-400 rotate-45 -translate-y-0.5" />
            </div>
          </div>
        </div>

        <div>
          <label className={labelClasses}>Дата</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClasses}
            style={{ colorScheme: 'light dark' }}
          />
        </div>

        <div>
          <label className={labelClasses}>Комментарий</label>
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className={inputClasses}
            placeholder="Без комментария"
          />
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-auto p-6 border-t border-slate-100 dark:border-white/5">
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="w-full bg-[#1C3F35] dark:bg-emerald-600 text-white font-bold rounded-xl h-12 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
        >
          {updateMutation.isPending ? (
             <motion.div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
          ) : (
            "Сохранить"
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
              className="w-full mt-3 text-rose-500 font-semibold text-sm hover:underline block text-center"
            >
              Удалить транзакцию
            </motion.button>
          ) : (
            <motion.div
              key="delete-confirm"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mt-3 space-y-3"
            >
              <p className="text-center text-sm font-semibold text-rose-500">Точно удалить?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 py-2 rounded-xl border border-vault-pine/10 dark:border-white/10 font-semibold text-vault-pine/60 dark:text-white/50 hover:bg-vault-pine/[0.03] dark:hover:bg-white/5 transition-colors text-sm"
                >
                  Отмена
                </button>
                <button
                  onClick={() => onDelete(tx.id)}
                  disabled={isDeleting}
                  className="flex-1 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
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
