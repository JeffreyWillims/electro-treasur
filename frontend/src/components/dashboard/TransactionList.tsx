/**
 * TransactionList — Real-time transaction feed with subcategory display.
 * Connected to TanStack Query for live updates on transaction creation.
 */
import { useQuery } from '@tanstack/react-query';
import { fetchTransactions, fetchCategories } from '@/api/client';
import type { CategoryRead } from '@/types';
import { cn } from '@/lib/utils';
import { ArrowUpRight, ArrowDownLeft, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';

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

export function TransactionList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => fetchTransactions(100),
  });

  const { data: categories = [] } = useQuery<CategoryRead[]>({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  const filteredTransactions = transactions.filter(tx => {
    const rtx = tx as any;
    const matchesSearch = rtx.category_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          rtx.comment?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory ? String(rtx.category_id) === selectedCategory : true;
    return matchesSearch && matchesCategory;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-aura-gold"></div>
      </div>
    );
  }

  return (
    <div className="premium-card p-0 md:p-12 w-full min-h-screen border-0 rounded-none shadow-none bg-transparent">
      <div className="max-w-screen-2xl mx-auto px-4 py-8">
        <div className="flex flex-col gap-8 mb-12">
          {/* Top Header: Title & Legend */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-5xl md:text-6xl font-bold text-premium tracking-tighter leading-none mb-3">История</h1>
              <p className="text-[10px] font-mono text-aura-gold uppercase tracking-[0.4em] font-bold opacity-60">
                Финансовый хронограф Aura Wealth
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
                    {CATEGORY_TRANSLATIONS[c.name] || c.name}
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

              return (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.01, duration: 0.4 }}
                  className="group flex items-center justify-between py-6 border-b border-aura-gold/[0.03] last:border-0 hover:bg-aura-gold/[0.01] px-6 -mx-6 rounded-2xl transition-all duration-300"
                >
                  <div className="flex items-center gap-6">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-serif font-bold transition-all duration-500 group-hover:scale-110 group-hover:shadow-glow",
                      isIncome
                        ? "bg-aura-emerald/5 text-aura-emerald border border-aura-emerald/10"
                        : "bg-expense/5 text-expense border border-expense/10"
                    )}>
                      {CATEGORY_TRANSLATIONS[tx.category_name || '']?.charAt(0) || tx.category_name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="text-lg font-bold text-aura-graphite dark:text-aura-ivory tracking-tight leading-tight mb-1">
                        {CATEGORY_TRANSLATIONS[tx.category_name || ''] || tx.category_name || 'Без категории'}
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

                  <div className="text-right">
                    <p className={cn(
                      "text-2xl font-mono font-black tracking-tighter text-engraved transition-transform duration-300 group-hover:scale-105",
                      isIncome ? "text-aura-emerald" : "text-expense"
                    )}>
                      {isIncome ? '+' : '-'}{absAmount.toLocaleString('ru-RU')}
                      <span className="ml-1 text-sm font-bold opacity-40">{tx.currency}</span>
                    </p>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
