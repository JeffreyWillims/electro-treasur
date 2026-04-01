/**
 * QuickEntry — Premium transaction entry form with subcategory/details support.
 * Instantly invalidates transactions and dashboard queries on success.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { PlusCircle, Calendar as CalendarIcon, ChevronDown, Tag } from 'lucide-react';
import { createTransaction, fetchCategories } from '@/api/client';
import { cn } from '@/lib/utils';

const CURRENCIES = ['RUB', 'USD', 'EUR'];


export function QuickEntry() {
  const queryClient = useQueryClient();
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('RUB');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);

  // ── Queries ─────────────────────────────────────────────────────────
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  const mutation = useMutation({
    mutationFn: (payload: Parameters<typeof createTransaction>[0]) => createTransaction(payload),
    onSuccess: () => {
      toast.success('Транзакция сохранена', {
        description: `${type === 'income' ? '+' : '-'}${parseFloat(amount).toLocaleString('ru-RU')} ${currency}`,
      });
      setAmount('');
      setSubcategory('');
      // CRITICAL: Instant reactivity — invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !category) {
      toast.error('Заполните сумму и категорию');
      return;
    }

    mutation.mutate({
      amount: parseFloat(amount),
      currency,
      category_id: parseInt(category),
      executed_at: new Date(date || new Date().toISOString()).toISOString(),
      entry_type: 'manual',
      comment: subcategory || undefined,
    });
  };

  const filteredCategories = categories.filter(c => c.type === type);

  const catTranslate: Record<string, string> = { "leisure (lifestyle)": "Отдых и развлечения", "housing": "Жилье", "transport": "Транспорт", "food": "Еда и продукты", "health": "Здоровье", "income": "Доход", "shopping": "Покупки", "utilities": "ЖКХ" };


  return (
    <div className="premium-card p-7">
      <div className="flex items-center gap-3 mb-7">
        <div className="p-2.5 bg-aura-gold/[0.06] rounded-xl">
          <PlusCircle className="w-[18px] h-[18px] text-aura-gold" />
        </div>
        <div>
          <h2 className="text-xl font-bold leading-tight text-slate-900 dark:text-white">Новая операция</h2>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Быстрое добавление
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Type Toggle */}
        <div className="flex bg-aura-graphite/[0.03] dark:bg-white/[0.03] p-1 rounded-2xl border border-aura-gold/[0.04]">
          <button
            type="button"
            onClick={() => { setType('expense'); setCategory(''); }}
            className={cn(
              "flex-1 py-3 text-lg font-bold transition-all duration-300 rounded-xl",
              type === 'expense'
                ? "bg-white dark:bg-aura-graphite text-expense shadow-sm"
                : "text-aura-graphite/30 dark:text-aura-ivory/30"
            )}
          >
            Расход
          </button>
          <button
            type="button"
            onClick={() => { setType('income'); setCategory(''); }}
            className={cn(
              "flex-1 py-3 text-lg font-bold transition-all duration-300 rounded-xl",
              type === 'income'
                ? "bg-white dark:bg-aura-graphite text-aura-emerald shadow-sm"
                : "text-aura-graphite/30 dark:text-aura-ivory/30"
            )}
          >
            Доход
          </button>
        </div>

        {/* Amount + Currency */}
        <div>
          <label className="block mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">Сумма</label>
          <div className="flex rounded-2xl overflow-hidden border border-aura-gold/[0.1] focus-within:border-aura-gold/30 transition-all">
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 px-5 py-3 outline-none font-mono text-base font-medium bg-transparent text-aura-graphite dark:text-aura-ivory placeholder:text-aura-gold/20"
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="bg-aura-gold/[0.06] border-l border-aura-gold/10 px-3 py-3 text-[10px] font-mono font-bold text-aura-gold outline-none cursor-pointer"
            >
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Category + Subcategory side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">Категория</label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-aura appearance-none pr-10 text-base font-semibold text-slate-900 cursor-pointer"
              >
                <option value="" disabled>Выберите</option>
                {filteredCategories.map(cat => (
                  <option key={cat.id} value={cat.id.toString()}>
                    {catTranslate[cat.name.toLowerCase()] || cat.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-aura-gold/40 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Tag size={16} />
              Детали
            </label>
            <input
              type="text"
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              placeholder="Напр.: Netflix, Пятёрочка"
              className="input-aura text-base font-medium"
            />
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="block mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">Дата</label>
          <div className="relative">
            <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-aura-gold/40 pointer-events-none" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input-aura pl-11 text-base font-medium"
            />
          </div>
        </div>

        {/* Submit */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          disabled={mutation.isPending}
          type="submit"
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {mutation.isPending ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Сохранение...
            </span>
          ) : (
            <span>Сохранить запись</span>
          )}
        </motion.button>
      </form>
    </div>
  );
}
