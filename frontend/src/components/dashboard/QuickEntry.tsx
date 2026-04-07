 
/**
 * QuickEntry — Premium transaction entry form with subcategory/details support.
 * Citrine Vault California Organic Luxury aesthetic.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { PlusCircle, Calendar as CalendarIcon, ChevronDown, Tag } from 'lucide-react';
import { createTransaction, fetchCategories } from '@/api/client';

const CURRENCIES = ['RUB', 'USD', 'EUR'];


export function QuickEntry() {
  const queryClient = useQueryClient();
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('RUB');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isSuccessAnim, setIsSuccessAnim] = useState(false);

  // ── Queries ─────────────────────────────────────────────────────────
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  const mutation = useMutation({
    mutationFn: (payload: Parameters<typeof createTransaction>[0]) => createTransaction(payload),
    onSuccess: () => {
      setIsSuccessAnim(true);
      setTimeout(() => {
        setIsSuccessAnim(false);
        setAmount('');
        setSubcategory('');
        setType('expense');
        setCategory('');
      }, 1500);

      toast.success('Транзакция сохранена', {
        description: `${type === 'income' ? '+' : '-'}${amount} ${currency}`,
      });
      // CRITICAL: Instant reactivity — invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d.,]/g, "").replace(',', '.');
    const parts = raw.split('.');
    
    let integerPart = parts[0] || '';
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    
    let formatted = integerPart;
    if (parts.length > 1 && parts[1] !== undefined) {
      formatted += '.' + parts[1].slice(0, 2);
    }
    setAmount(formatted);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !category) {
      toast.error('Заполните сумму и категорию');
      return;
    }

    mutation.mutate({
      amount: parseFloat(amount.replace(/\s/g, '')),
      currency,
      category_id: parseInt(category),
      executed_at: new Date(date || new Date().toISOString()).toISOString(),
      entry_type: 'manual',
      comment: subcategory || undefined,
    });
  };

  const filteredCategories = categories.filter(c => c.type === type);

  const getRussianCategoryName = (rawName: string) => {
    const name = rawName.toLowerCase();
    if (name.includes('leisure')) return 'Отдых и развлечения';
    if (name.includes('housing')) return 'Жилье';
    if (name.includes('transport')) return 'Транспорт';
    if (name.includes('food')) return 'Еда и продукты';
    if (name.includes('health')) return 'Здоровье';
    if (name.includes('income')) return 'Доход';
    if (name.includes('shopping')) return 'Покупки';
    if (name.includes('growth') || name.includes('invest')) return 'Инвестиции и Рост';
    if (name.includes('utilit') || name.includes('operation')) return 'ЖКХ и Операции';
    return rawName;
  };

  return (
    <div className="w-full bg-white/70 dark:bg-[#111111]/80 backdrop-blur-3xl border border-vault-pine/[0.04] dark:border-white/5 shadow-[0_8px_30px_rgba(28,63,53,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.8)] rounded-3xl p-8 transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.005] hover:shadow-[0_20px_40px_rgba(28,63,53,0.08)] dark:hover:shadow-[0_10px_30px_rgba(255,122,0,0.15)]">
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
          {/* Sliding indicator */}
          <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white dark:bg-[#FF7A00] border border-vault-pine/10 dark:border-[#FF7A00]/50 rounded-lg transition-transform duration-300 ease-out shadow-sm ${type === 'income' ? 'translate-x-full left-0' : 'translate-x-0 left-1'}`} />
          
          {/* Buttons */}
          <button type="button" onClick={() => { setType('expense'); setCategory(''); }} className={`relative z-10 flex-1 py-3 text-lg font-bold transition-colors duration-300 ${type === 'expense' ? 'text-[#1C3F35] dark:text-[#050505]' : 'text-vault-pine/30 hover:text-vault-pine/50 dark:text-white/30 dark:hover:text-white/50'}`}>Расход</button>
          
          <button type="button" onClick={() => { setType('income'); setCategory(''); }} className={`relative z-10 flex-1 py-3 text-lg font-bold transition-colors duration-300 ${type === 'income' ? 'text-[#1C3F35] dark:text-[#050505]' : 'text-vault-pine/30 hover:text-vault-pine/50 dark:text-white/30 dark:hover:text-white/50'}`}>Доход</button>
        </div>

        {/* Amount + Currency */}
        <div>
          <label className="block mb-2 text-lg font-semibold text-[#1C3F35] dark:text-white/90">Сумма</label>
          <div className="flex rounded-2xl overflow-hidden border border-vault-pine/[0.06] dark:border-white/5 focus-within:border-[#1C3F35] focus-within:ring-2 focus-within:ring-[#1C3F35]/10 dark:focus-within:border-[#FF7A00] dark:focus-within:ring-[#FF7A00]/10 transition-all duration-300">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={handleAmountChange}
              placeholder="0.00"
              className="flex-1 px-5 py-3 outline-none font-mono text-base font-medium tabular-nums bg-transparent text-[#1C3F35] dark:text-white placeholder:text-vault-pine/15 dark:placeholder:text-white/10"
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="bg-[#FF7A00]/[0.06] border-l border-vault-pine/5 dark:border-white/5 px-3 py-3 text-[10px] font-mono font-bold text-[#FF7A00] outline-none cursor-pointer"
            >
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Category + Subcategory side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-2 text-lg font-semibold text-[#1C3F35] dark:text-white/90">Категория</label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-aura appearance-none pr-10 text-base font-semibold text-[#1C3F35] dark:text-white cursor-pointer bg-white/50 dark:bg-white/3 border-vault-pine/10 dark:border-white/5 transition-all outline-none"
              >
                <option value="" disabled>Выберите</option>
                {filteredCategories.map(cat => (
                  <option key={cat.id} value={cat.id.toString()} className="bg-white dark:bg-[#111111]">
                    {getRussianCategoryName(cat.name)}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FF7A00]/40 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block mb-2 text-lg font-semibold text-[#1C3F35] dark:text-white/90 flex items-center gap-1.5">
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
          <label className="block mb-2 text-lg font-semibold text-[#1C3F35] dark:text-white/90">Дата</label>
          <div className="relative">
            <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FF7A00]/40 pointer-events-none" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input-aura pl-11 text-base font-medium"
            />
          </div>
        </div>

        {/* Submit — Citrine Orange / Kinetic Abacus */}
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
                initial={{ height: 60, width: "100%", borderRadius: 16 }}
                animate={{ height: 4, width: "80%", borderRadius: 2 }}
                exit={{ opacity: 0 }}
                className="bg-[#FF7A00]/20 absolute flex items-center shadow-inner overflow-hidden"
              >
                <motion.div
                  className="w-4 h-4 bg-[#FF7A00] rounded-full shadow-[0_0_8px_#FF7A00] absolute"
                  animate={{ left: ["0%", "calc(100% - 16px)", "0%"] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                />
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ height: 4, width: "80%", borderRadius: 2, backgroundColor: "rgba(255,122,0,0.2)" }}
                animate={{ 
                  height: 4, 
                  width: "100%", 
                  backgroundColor: "#10B981", 
                  boxShadow: "0 0 20px rgba(16,185,129,0.5)" 
                }}
                exit={{ height: 60, width: "100%", opacity: 0 }}
                className="absolute flex items-center overflow-hidden"
              >
                <motion.div
                  className="w-4 h-4 bg-white rounded-full shadow-[0_0_10px_white] absolute"
                  initial={{ left: "0%" }}
                  animate={{ left: "calc(100% - 16px)" }}
                  transition={{ duration: 0.4, type: "spring", stiffness: 100, damping: 10 }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </form>
    </div>
  );
}
