/**
 * RecurringReminders — умные напоминания о платежах с действиями Изменить/Удалить/Готово.
 * Действие «Готово» автоматически создаёт расходную транзакцию через POST API.
 * Хранение — в localStorage.
 */
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Clock, Check, Pencil, Trash2, Plus, X, AlertTriangle,
} from 'lucide-react';
import { createTransaction, fetchCategories } from '@/api/client';
import { cn } from '@/lib/utils';

interface Reminder {
  id: string;
  title: string;
  amount: number;
  currency: string;
  categoryId: number;
  categoryName: string;
  dueDay: number;
}

const STORAGE_KEY = 'aura_reminders';

// ── УНИФИЦИРОВАННЫЙ СЛОВАРЬ (Citrine Vault Standard) ───────────────────
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

function loadReminders(): Reminder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : getDefaultReminders();
  } catch {
    return getDefaultReminders();
  }
}

function saveReminders(reminders: Reminder[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
}

function getDefaultReminders(): Reminder[] {
  return [
    { id: '1', title: 'Netflix', amount: 1499, currency: 'RUB', categoryId: 0, categoryName: 'Лайфстайл', dueDay: 5 },
    { id: '2', title: 'Спортзал', amount: 3000, currency: 'RUB', categoryId: 0, categoryName: 'Здоровье', dueDay: 10 },
    { id: '3', title: 'Интернет', amount: 890, currency: 'RUB', categoryId: 0, categoryName: 'ЖКХ и Операции', dueDay: 15 },
  ];
}

function getDueLabel(dueDay: number): string {
  const today = new Date();
  const currentDay = today.getDate();
  const diff = dueDay - currentDay;

  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Завтра';
  if (diff < 0) return 'Просрочено';
  if (diff <= 7) return `Через ${diff} дн.`;
  return `${dueDay}-е число`;
}

function getDueUrgency(dueDay: number): 'overdue' | 'urgent' | 'upcoming' | 'normal' {
  const today = new Date();
  const currentDay = today.getDate();
  const diff = dueDay - currentDay;

  if (diff < 0) return 'overdue';
  if (diff <= 1) return 'urgent';
  if (diff <= 3) return 'upcoming';
  return 'normal';
}

export function RecurringReminders() {
  const queryClient = useQueryClient();
  const [reminders, setReminders] = useState<Reminder[]>(loadReminders);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDueDay, setEditDueDay] = useState('');
  const [editCategoryName, setEditCategoryName] = useState('');

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  useEffect(() => {
    saveReminders(reminders);
  }, [reminders]);

  const doneMutation = useMutation({
    mutationFn: async (reminder: Reminder) => {
      const expenseCat = categories.find(c => c.name.toLowerCase().includes(reminder.categoryName.toLowerCase()))
        || categories.find(c => c.type === 'expense');

      if (!expenseCat) throw new Error('Нет доступных категорий расходов');

      return createTransaction({
        amount: reminder.amount,
        category_id: expenseCat.id,
        executed_at: new Date().toISOString(),
        entry_type: 'recurring',
        comment: reminder.title,
      });
    },
    onSuccess: (_data, reminder) => {
      setReminders(prev => prev.filter(r => r.id !== reminder.id));
      toast.success(`Оплачено: ${reminder.title}`);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: Error) => toast.error(`Ошибка: ${error.message}`),
  });

  const startEdit = (reminder: Reminder) => {
    setEditingId(reminder.id);
    setEditTitle(reminder.title);
    setEditAmount(reminder.amount.toString());
    setEditDueDay(reminder.dueDay.toString());
    setEditCategoryName(reminder.categoryName);
  };

  const saveEdit = () => {
    if (!editingId) return;
    setReminders(prev =>
      prev.map(r =>
        r.id === editingId
          ? { ...r, title: editTitle, amount: parseFloat(editAmount) || 0, dueDay: parseInt(editDueDay) || 1, categoryName: editCategoryName }
          : r
      )
    );
    setEditingId(null);
    toast.success('Напоминание обновлено');
  };

  const deleteReminder = (id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));
    toast.info('Напоминание удалено');
  };

  const addReminder = () => {
    if (!editTitle || !editAmount) return;
    const newReminder: Reminder = {
      id: Date.now().toString(),
      title: editTitle,
      amount: parseFloat(editAmount) || 0,
      currency: 'RUB',
      categoryId: 0,
      categoryName: editCategoryName || 'Прочее',
      dueDay: parseInt(editDueDay) || 1,
    };
    setReminders(prev => [...prev, newReminder]);
    setShowAdd(false);
    setEditTitle(''); setEditAmount(''); setEditDueDay(''); setEditCategoryName('');
    toast.success('Напоминание создано');
  };

  // 💎 Эталонные стили для инпутов
  const inputClasses = cn(
    "w-full rounded-2xl h-12 md:h-14 px-4 transition-all duration-300 outline-none text-sm font-bold text-[#1C3F35] dark:text-white placeholder-[#1C3F35]/30 dark:placeholder-white/30",
    "bg-black/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] border border-transparent",
    "dark:bg-black/40 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]",
    "focus:bg-white focus:shadow-md focus:border-[#FF7A00]/50",
    "dark:focus:bg-[#1A1A1A] dark:focus:shadow-none dark:focus:border-[#FF7A00]/50"
  );

  return (
    <div className="bg-white/40 dark:bg-[#111111]/40 backdrop-blur-3xl border border-black/5 dark:border-white/10 rounded-[2.5rem] p-8 md:p-10 shadow-2xl transition-all duration-700">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-xl md:text-2xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white leading-none">
            Платежи
          </h3>
          <p className="text-[10px] md:text-[11px] font-mono font-bold text-[#FF7A00] uppercase tracking-[0.25em]">
            Регулярные списания
          </p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setEditTitle(''); setEditAmount(''); setEditDueDay('1'); setEditCategoryName(''); }}
          className="w-10 h-10 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors shrink-0"
        >
          <Plus className="w-5 h-5 text-[#1C3F35] dark:text-white" />
        </button>
      </div>

      {/* ── Add Form ── */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="p-5 rounded-[2rem] bg-white/60 dark:bg-[#1A1A1A]/40 backdrop-blur-md border border-black/5 dark:border-white/5 space-y-4 shadow-sm">
              <input type="text" placeholder="Название платежа" value={editTitle} onChange={e => setEditTitle(e.target.value)} className={inputClasses} />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" placeholder="Сумма" value={editAmount} onChange={e => setEditAmount(e.target.value)} className={inputClasses} />
                <input type="number" placeholder="День месяца" min="1" max="31" value={editDueDay} onChange={e => setEditDueDay(e.target.value)} className={inputClasses} />
              </div>
              <input type="text" placeholder="Категория" value={editCategoryName} onChange={e => setEditCategoryName(e.target.value)} className={inputClasses} />
              <div className="flex gap-3 pt-2">
                <button onClick={addReminder} className="flex-1 h-12 md:h-14 bg-gradient-to-r from-[#FF7A00] to-[#FFA011] text-white rounded-2xl text-xs font-bold uppercase tracking-widest shadow-[0_10px_20px_-5px_rgba(255,122,0,0.4)] hover:shadow-[0_10px_20px_-5px_rgba(255,122,0,0.6)] active:scale-[0.98] transition-all flex items-center justify-center">
                  Добавить
                </button>
                <button onClick={() => setShowAdd(false)} className="px-5 md:px-6 h-12 md:h-14 bg-black/5 dark:bg-white/5 text-[#1C3F35]/60 dark:text-white/60 rounded-2xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex items-center justify-center">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Reminders List ── */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {reminders.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 text-center">
              <p className="text-[11px] font-mono font-bold uppercase tracking-[0.25em] text-[#1C3F35]/40 dark:text-white/30">
                Нет активных напоминаний
              </p>
            </motion.div>
          ) : (
            reminders.map((reminder) => {
              const urgency = getDueUrgency(reminder.dueDay);
              const isEditing = editingId === reminder.id;
              const isProcessing = doneMutation.isPending && doneMutation.variables?.id === reminder.id;

              return (
                <motion.div
                  key={reminder.id}
                  layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                  className={cn(
                    "group p-5 rounded-[1.5rem] border transition-all duration-300",
                    urgency === 'overdue' ? "bg-rose-500/5 border-rose-500/20" :
                    urgency === 'urgent' ? "bg-[#FF7A00]/5 border-[#FF7A00]/20" :
                    "bg-white/50 dark:bg-white/5 border-black/5 dark:border-white/5 hover:bg-white/80 dark:hover:bg-white/10 hover:shadow-sm"
                  )}
                >
                  {isEditing ? (
                    <div className="space-y-4">
                      <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className={inputClasses} placeholder="Название платежа" />
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} className={inputClasses} placeholder="Сумма" />
                        <input type="number" min="1" max="31" value={editDueDay} onChange={e => setEditDueDay(e.target.value)} className={inputClasses} placeholder="День" />
                        <input type="text" value={editCategoryName} onChange={e => setEditCategoryName(e.target.value)} className={inputClasses} placeholder="Категория" />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button onClick={saveEdit} className="flex-1 h-12 md:h-14 bg-gradient-to-r from-[#FF7A00] to-[#FFA011] text-white rounded-2xl text-xs font-bold uppercase tracking-widest shadow-[0_10px_20px_-5px_rgba(255,122,0,0.4)] active:scale-[0.98] transition-all flex items-center justify-center">
                          Сохранить
                        </button>
                        <button onClick={() => setEditingId(null)} className="px-5 md:px-6 h-12 md:h-14 bg-black/5 dark:bg-white/5 text-[#1C3F35]/60 dark:text-white/60 rounded-2xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex items-center justify-center">
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm",
                          urgency === 'overdue' ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" :
                          urgency === 'urgent' ? "bg-[#FF7A00]/10 text-[#FF7A00] border border-[#FF7A00]/20" :
                          "bg-black/5 dark:bg-white/5 text-[#1C3F35]/50 dark:text-white/50 border border-transparent"
                        )}>
                          {urgency === 'overdue' ? <AlertTriangle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-base font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white truncate mb-1">
                            {reminder.title}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-[#1C3F35]/50 dark:text-white/40 uppercase tracking-[0.25em] truncate">
                              {getRussianCategoryName(reminder.categoryName)}
                            </span>
                            <span className="text-[10px] text-[#1C3F35]/20 dark:text-white/20">•</span>
                            <span className={cn(
                              "text-[10px] font-mono font-bold uppercase tracking-[0.25em] whitespace-nowrap",
                              urgency === 'overdue' ? "text-rose-500" :
                              urgency === 'urgent' ? "text-[#FF7A00]" : "text-[#1C3F35]/50 dark:text-white/50"
                            )}>
                              {getDueLabel(reminder.dueDay)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                        <div className="text-right flex items-baseline gap-1">
                          <span className="text-xl md:text-2xl font-sans font-black tabular-nums tracking-tighter text-[#1C3F35] dark:text-white leading-none">
                            {reminder.amount.toLocaleString('ru-RU')}
                          </span>
                          <span className="text-sm font-bold opacity-60 tracking-normal text-[#1C3F35] dark:text-white">₽</span>
                        </div>

                        <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEdit(reminder)} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-[#1C3F35]/50 dark:text-white/50 hover:text-[#1C3F35] dark:hover:text-white" title="Редактировать">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteReminder(reminder.id)} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-rose-500/5 hover:bg-rose-500/10 transition-colors text-rose-500/60 hover:text-rose-500" title="Удалить">
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => doneMutation.mutate(reminder)}
                            disabled={doneMutation.isPending}
                            className="w-10 h-10 flex items-center justify-center rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors text-emerald-600 dark:text-emerald-400 font-bold"
                            title="Оплатить"
                          >
                            {isProcessing ? (
                              <motion.div className="w-4 h-4 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}