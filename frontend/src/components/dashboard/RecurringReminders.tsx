/**
 * RecurringReminders — Smart payment reminders with Edit/Delete/Done actions.
 * "Done" action auto-creates an expense transaction via POST API.
 * Uses localStorage for persistence (no backend endpoint for reminders yet).
 */
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Bell,
  Clock,
  Check,
  Pencil,
  Trash2,
  Plus,
  X,
  AlertTriangle,
} from 'lucide-react';
import { createTransaction, fetchCategories } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface Reminder {
  id: string;
  title: string;
  amount: number;
  currency: string;
  categoryId: number;
  categoryName: string;
  dueDay: number; // day of month
}

const STORAGE_KEY = 'aura_reminders';

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
    { id: '1', title: 'Netflix', amount: 1499, currency: 'RUB', categoryId: 0, categoryName: 'Подписки', dueDay: 5 },
    { id: '2', title: 'Спортзал', amount: 3000, currency: 'RUB', categoryId: 0, categoryName: 'Здоровье', dueDay: 10 },
    { id: '3', title: 'Интернет', amount: 890, currency: 'RUB', categoryId: 0, categoryName: 'Коммуникации', dueDay: 15 },
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

  // Edit form state
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

  // "Done" mutation — creates an expense transaction
  const doneMutation = useMutation({
    mutationFn: async (reminder: Reminder) => {
      // Find expense category by name, or use first expense category
      const expenseCat = categories.find(c => c.name === reminder.categoryName && c.type === 'expense')
        || categories.find(c => c.type === 'expense');

      if (!expenseCat) {
        throw new Error('Нет доступных категорий расходов');
      }

      return createTransaction({
        amount: reminder.amount,
        category_id: expenseCat.id,
        executed_at: new Date().toISOString(),
        entry_type: 'recurring',
        comment: reminder.title,
      });
    },
    onSuccess: (_data, reminder) => {
      // Remove from active reminders
      setReminders(prev => prev.filter(r => r.id !== reminder.id));
      toast.success(`✓ ${reminder.title} — оплачено`, {
        description: `${reminder.amount.toLocaleString('ru-RU')} ${reminder.currency}`,
      });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
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
    toast('Напоминание удалено', { icon: '🗑️' });
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
    setEditTitle('');
    setEditAmount('');
    setEditDueDay('');
    setEditCategoryName('');
    toast.success('Напоминание создано');
  };

  return (
    <div className="premium-card p-7">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-aura-gold/[0.06] rounded-xl">
            <Bell className="w-[18px] h-[18px] text-aura-gold" />
          </div>
          <div>
            <h3 className="text-premium text-lg leading-tight">Платежи</h3>
            <p className="text-[9px] font-mono text-aura-gold/40 uppercase tracking-[0.15em] mt-0.5">
              Регулярные списания
            </p>
          </div>
        </div>
        <button
          onClick={() => { setShowAdd(true); setEditTitle(''); setEditAmount(''); setEditDueDay('1'); setEditCategoryName(''); }}
          className="p-2 rounded-xl hover:bg-aura-gold/5 transition-colors group"
        >
          <Plus size={16} className="text-aura-gold/40 group-hover:text-aura-gold transition-colors" />
        </button>
      </div>

      {/* Add Form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="p-4 rounded-2xl bg-aura-gold/[0.03] border border-aura-gold/[0.06] space-y-3">
              <input
                type="text"
                placeholder="Название платежа"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="input-aura text-xs py-2.5"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Сумма"
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  className="input-aura text-xs py-2.5 font-mono"
                />
                <input
                  type="number"
                  placeholder="День месяца"
                  min="1"
                  max="31"
                  value={editDueDay}
                  onChange={e => setEditDueDay(e.target.value)}
                  className="input-aura text-xs py-2.5 font-mono"
                />
              </div>
              <input
                type="text"
                placeholder="Категория"
                value={editCategoryName}
                onChange={e => setEditCategoryName(e.target.value)}
                className="input-aura text-xs py-2.5"
              />
              <div className="flex gap-2">
                <button onClick={addReminder} className="btn-primary text-xs py-2 flex-1">
                  Добавить
                </button>
                <button onClick={() => setShowAdd(false)} className="btn-ghost text-xs py-2">
                  <X size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reminders List */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {reminders.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-10 text-center"
            >
              <p className="text-aura-gold/30 font-serif italic text-sm">
                Нет активных напоминаний
              </p>
            </motion.div>
          ) : (
            reminders.map((reminder) => {
              const urgency = getDueUrgency(reminder.dueDay);
              const isEditing = editingId === reminder.id;

              return (
                <motion.div
                  key={reminder.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className={cn(
                    "group p-4 rounded-2xl border transition-all duration-300",
                    urgency === 'overdue'
                      ? "bg-rose-500/[0.03] border-rose-500/10"
                      : urgency === 'urgent'
                      ? "bg-amber-500/[0.03] border-amber-500/10"
                      : "bg-aura-gold/[0.02] border-aura-gold/[0.04] hover:border-aura-gold/10"
                  )}
                >
                  {isEditing ? (
                    /* Edit Mode */
                    <div className="space-y-2.5">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        className="input-aura text-xs py-2"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="number"
                          value={editAmount}
                          onChange={e => setEditAmount(e.target.value)}
                          className="input-aura text-xs py-2 font-mono"
                          placeholder="Сумма"
                        />
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={editDueDay}
                          onChange={e => setEditDueDay(e.target.value)}
                          className="input-aura text-xs py-2 font-mono"
                          placeholder="День"
                        />
                        <input
                          type="text"
                          value={editCategoryName}
                          onChange={e => setEditCategoryName(e.target.value)}
                          className="input-aura text-xs py-2"
                          placeholder="Категория"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={saveEdit} className="btn-primary text-xs py-1.5 flex-1">
                          Сохранить
                        </button>
                        <button onClick={() => setEditingId(null)} className="btn-ghost text-xs py-1.5">
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Display Mode */
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                          urgency === 'overdue'
                            ? "bg-rose-500/10"
                            : urgency === 'urgent'
                            ? "bg-amber-500/10"
                            : "bg-aura-gold/[0.06]"
                        )}>
                          {urgency === 'overdue' ? (
                            <AlertTriangle size={15} className="text-rose-500" />
                          ) : (
                            <Clock size={15} className={cn(
                              urgency === 'urgent' ? "text-amber-500" : "text-aura-gold/60"
                            )} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-aura-graphite dark:text-aura-ivory truncate">
                            {reminder.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-mono text-aura-gold/40 uppercase">
                              {reminder.categoryName}
                            </span>
                            <span className="text-[8px] text-aura-gold/20">•</span>
                            <span className={cn(
                              "text-[10px] font-mono font-bold uppercase",
                              urgency === 'overdue' ? "text-rose-500" :
                              urgency === 'urgent' ? "text-amber-500" : "text-aura-gold/50"
                            )}>
                              {getDueLabel(reminder.dueDay)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-bold text-aura-graphite dark:text-aura-ivory whitespace-nowrap">
                          {reminder.amount.toLocaleString('ru-RU')} ₽
                        </span>

                        {/* Action Buttons (visible on hover) */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEdit(reminder)}
                            className="p-1.5 rounded-lg hover:bg-aura-gold/10 transition-colors"
                            title="Редактировать"
                          >
                            <Pencil size={12} className="text-aura-gold/50" />
                          </button>
                          <button
                            onClick={() => deleteReminder(reminder.id)}
                            className="p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
                            title="Удалить"
                          >
                            <Trash2 size={12} className="text-rose-400/60" />
                          </button>
                          <button
                            onClick={() => doneMutation.mutate(reminder)}
                            disabled={doneMutation.isPending}
                            className="p-1.5 rounded-lg hover:bg-aura-emerald/10 transition-colors"
                            title="Оплачено"
                          >
                            <Check size={12} className="text-aura-emerald" />
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
