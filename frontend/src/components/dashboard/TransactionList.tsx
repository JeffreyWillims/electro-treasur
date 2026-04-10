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

const PAGE_SIZE = 30;

const CATEGORY_TRANSLATIONS: Record<string, string> = {
  'Housing': 'Жилье',
  'Food': 'Еда',
  'Transport': 'Транспорт',
  'Utilities': 'Коммунальные',
  'Leisure': 'Отдых',
  'Salary': 'Зарплата',
  'Investment': 'Инвестиции',
  'Healthcare': 'Здоровье',
  'Health': 'Здоровье',
  'Education': 'Образование',
  'Shopping': 'Покупки',
  'Personal Care': 'Уход',
  'Other': 'Другое'
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

function translateCategory(name: string): string {
  return CATEGORY_TRANSLATIONS[name] || name;
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

  // ── Intersection Observer Ref ──────────────────────────────────────
  const sentinelRef = useRef<HTMLDivElement>(null);

  // ── Infinite Query ─────────────────────────────────────────────────
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['transactions'],
    queryFn: ({ pageParam = 0 }) => fetchTransactions(PAGE_SIZE, pageParam),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length * PAGE_SIZE;
    },
    initialPageParam: 0,
  });

  const { data: categories = [] } = useQuery<CategoryRead[]>({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  // ── Intersection Observer — Sentinel ───────────────────────────────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ── Flatten pages ──────────────────────────────────────────────────
  const transactions = data?.pages.flat() ?? [];

  const filteredTransactions = transactions.filter((tx: TransactionResponse) => {
    const matchesSearch = tx.category_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          tx.comment?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory ? String(tx.category_id) === selectedCategory : true;
    return matchesSearch && matchesCategory;
  });

  // ── PATCH Mutation (Inline Edit) with Optimistic Update ────────────
  const patchMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TransactionUpdate }) =>
      updateTransaction(id, payload),
    onMutate: async ({ id, payload }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['transactions'] });

      // Snapshot previous cache
      const previousData = queryClient.getQueryData(['transactions']);

      // Optimistically update the cache
      queryClient.setQueryData(['transactions'], (old: typeof data) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: TransactionResponse[]) =>
            page.map((tx: TransactionResponse) =>
              tx.id === id ? { ...tx, ...payload } : tx,
            ),
          ),
        };
      });

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['transactions'], context.previousData);
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
      await queryClient.cancelQueries({ queryKey: ['transactions'] });
      const previousData = queryClient.getQueryData(['transactions']);

      // Optimistically remove from cache
      queryClient.setQueryData(['transactions'], (old: typeof data) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: TransactionResponse[]) =>
            page.filter((tx: TransactionResponse) => tx.id !== id),
          ),
        };
      });

      setDrawerTx(null);
      return { previousData };
    },
    onError: (_err, _id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['transactions'], context.previousData);
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
                <h1 className="text-5xl md:text-6xl font-bold text-premium tracking-tighter leading-none mb-3">История</h1>
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
            <div className="flex flex-col sm:flex-row gap-4 w-full">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-aura-gold/30" />
                <input 
                  type="text" 
                  placeholder="Поиск по транзакциям..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-aura pl-11 text-base"
                />
              </div>
              <div className="relative">
                <select 
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="input-aura pr-10 text-base font-medium appearance-none cursor-pointer w-full sm:w-64"
                >
                  <option value="">Все категории</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {translateCategory(c.name)}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <div className="w-2 h-2 border-r-2 border-b-2 border-aura-gold/40 rotate-45 -translate-y-0.5" />
                </div>
              </div>
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
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.01, 0.3), duration: 0.4 }}
                    onClick={() => openDrawer(tx)}
                    className="group flex items-center justify-between py-6 border-b border-aura-gold/[0.03] last:border-0 hover:bg-aura-gold/[0.02] px-6 -mx-6 rounded-2xl transition-all duration-300 cursor-pointer"
                  >
                    <div className="flex items-center gap-6">
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center text-xl transition-all duration-500 group-hover:scale-110 group-hover:shadow-glow",
                        isIncome
                          ? "bg-aura-emerald/5 text-aura-emerald border border-aura-emerald/10"
                          : "bg-expense/5 text-expense border border-expense/10"
                      )}>
                        {getCategoryIcon(catName)}
                      </div>
                      <div>
                        <p className="text-lg font-bold text-aura-graphite dark:text-aura-ivory tracking-tight leading-tight mb-1">
                          {translateCategory(catName)}
                        </p>
                        <div className="flex items-center gap-3">
                          <p className="text-[10px] font-mono font-bold text-aura-gold/40 uppercase tracking-widest">
                            {new Intl.DateTimeFormat('ru-RU', {
                              day: '2-digit',
                              month: 'long',
                              hour: '2-digit',
                              minute: '2-digit'
                            }).format(new Date(tx.executed_at))}
                          </p>
                          {tx.comment && (
                            <>
                              <div className="w-1 h-1 rounded-full bg-aura-gold/20" />
                              <p className="text-xs font-medium text-aura-gold/60">{tx.comment}</p>
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
                          className="w-32 text-right text-2xl font-mono font-black tracking-tighter bg-[#FF7A00]/5 dark:bg-[#FF7A00]/10 border border-[#FF7A00]/30 rounded-xl px-3 py-1 outline-none focus:ring-2 focus:ring-[#FF7A00]/30 text-[#1C3F35] dark:text-white"
                        />
                      ) : (
                        <p
                          onClick={(e) => startEdit(tx, e)}
                          className={cn(
                            "text-2xl font-mono font-black tracking-tighter text-engraved transition-all duration-300 group-hover:scale-105 cursor-text hover:bg-vault-pine/[0.03] dark:hover:bg-white/[0.04] rounded-xl px-2 py-1 -mr-2",
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

            {/* ── Intersection Observer Sentinel ─────────────────────── */}
            <div ref={sentinelRef} className="h-px" />

            {/* Loading indicator for next page */}
            {isFetchingNextPage && (
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

            {/* End of list indicator */}
            {!hasNextPage && transactions.length > 0 && (
              <div className="py-8 text-center">
                <p className="text-[10px] font-mono text-vault-pine/15 dark:text-white/10 uppercase tracking-[0.3em]">
                  • Конец хроники •
                </p>
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
              className="fixed top-0 right-0 h-full w-full max-w-md z-50 bg-white/80 dark:bg-[#121212]/80 backdrop-blur-3xl border-l border-vault-pine/[0.06] dark:border-white/10 shadow-[-20px_0_60px_rgba(0,0,0,0.1)] dark:shadow-[-20px_0_60px_rgba(0,0,0,0.5)] overflow-y-auto"
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const catDef = categories.find(c => c.id === tx.category_id);
  const isIncome = catDef ? catDef.type === 'income' : parseFloat(tx.amount.toString()) > 0;
  const absAmount = Math.abs(parseFloat(tx.amount.toString()));
  const catName = tx.category_name || 'Без категории';

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-vault-pine/[0.06] dark:border-white/5">
        <h2 className="text-lg font-bold text-[#1C3F35] dark:text-white">Детали транзакции</h2>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-xl bg-vault-pine/[0.04] dark:bg-white/5 flex items-center justify-center hover:bg-vault-pine/[0.08] dark:hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4 text-vault-pine/50 dark:text-white/50" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-8">
        {/* Amount Hero */}
        <div className="text-center py-6">
          <div className={cn(
            "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4",
            isIncome 
              ? "bg-aura-emerald/10 text-aura-emerald"
              : "bg-expense/10 text-expense"
          )}>
            {isIncome ? <ArrowDownRight className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
            {isIncome ? 'Доход' : 'Расход'}
          </div>
          <p className={cn(
            "text-5xl font-mono font-black tracking-tighter",
            isIncome ? "text-aura-emerald" : "text-expense"
          )}>
            {isIncome ? '+' : '-'}{absAmount.toLocaleString('ru-RU')}
          </p>
          <p className="text-sm font-mono text-vault-pine/30 dark:text-white/20 mt-2">{tx.currency}</p>
        </div>

        {/* Details Grid */}
        <div className="space-y-4">
          <DetailRow icon={<Tag className="w-4 h-4" />} label="Категория" value={`${getCategoryIcon(catName)} ${translateCategory(catName)}`} />
          <DetailRow 
            icon={<Calendar className="w-4 h-4" />} 
            label="Дата" 
            value={new Intl.DateTimeFormat('ru-RU', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date(tx.executed_at))}
          />
          <DetailRow icon={<CreditCard className="w-4 h-4" />} label="Тип записи" value={tx.entry_type === 'manual' ? 'Ручной ввод' : tx.entry_type} />
          {tx.comment && (
            <DetailRow icon={<Tag className="w-4 h-4" />} label="Комментарий" value={tx.comment} />
          )}
          {tx.is_recurring && (
            <div className="flex items-center gap-2 text-[#FF7A00] text-sm font-semibold">
              <div className="w-2 h-2 rounded-full bg-[#FF7A00] animate-pulse" />
              Повторяющийся платёж
            </div>
          )}
        </div>
      </div>

      {/* Delete Section */}
      <div className="p-6 border-t border-vault-pine/[0.06] dark:border-white/5">
        <AnimatePresence mode="wait">
          {!confirmDelete ? (
            <motion.button
              key="delete-trigger"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDelete(true)}
              className="w-full py-4 rounded-2xl text-rose-500 hover:bg-rose-500/[0.06] dark:hover:bg-rose-500/10 font-bold transition-all duration-300 flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Удалить транзакцию
            </motion.button>
          ) : (
            <motion.div
              key="delete-confirm"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-3"
            >
              <p className="text-center text-sm font-semibold text-rose-500">Точно удалить?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 py-3 rounded-xl border border-vault-pine/10 dark:border-white/10 font-semibold text-vault-pine/60 dark:text-white/50 hover:bg-vault-pine/[0.03] dark:hover:bg-white/5 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={() => onDelete(tx.id)}
                  disabled={isDeleting}
                  className="flex-1 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <motion.div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Удалить
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Detail Row Sub-component ────────────────────────────────────────────
function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-vault-pine/[0.03] dark:border-white/[0.03] last:border-0">
      <div className="flex items-center gap-3 text-vault-pine/40 dark:text-white/30">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="text-sm font-semibold text-[#1C3F35] dark:text-white/90 text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}
