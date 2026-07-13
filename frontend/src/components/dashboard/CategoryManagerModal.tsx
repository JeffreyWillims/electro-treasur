/**
 * CategoryManagerModal — Премиальная панель полного CRUD для категорий пользователя.
 */
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Pencil, Trash2, Check, Loader2, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { fetchCategories, updateCategory } from '@/api/client';
import type { CategoryRead } from '@/types';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { cn } from '@/lib/utils';

const INITIALS_PALETTE = ['#1C3F35', '#FF7A00', '#C5A059', '#3B82F6', '#8B5CF6', '#EC4899'];

// 💎 Приведено к единому словарю из QuickEntry и TransactionList
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

interface EditState {
  categoryId: number;
  name: string;
  icon: string;
}

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ── Строка одной категории ──────────────────────────────────────────────────
interface CategoryRowProps {
  cat: CategoryRead;
  editState: EditState | null;
  onEditStart: (cat: CategoryRead) => void;
  onEditNameChange: (name: string) => void;
  onEditIconChange: (icon: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onDeleteClick: (cat: CategoryRead) => void;
  isSaving: boolean;
}

function CategoryRow({ cat, editState, onEditStart, onEditNameChange, onEditIconChange, onEditSave, onEditCancel, onDeleteClick, isSaving }: CategoryRowProps) {
  const isEditing = editState?.categoryId === cat.id;
  const displayName = getRussianCategoryName(cat.name);
  const currentIcon = isEditing ? editState!.icon : (cat.icon || '#1C3F35');

  // Берем первую букву без эмодзи (оставлено для совместимости, если пользователь введет их руками)
  const letter = (isEditing ? editState!.name : displayName.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*/gu, '')).charAt(0);

  return (
    <motion.div
      layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}
      className={cn(
        "group flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 border",
        isEditing
          ? "bg-white/40 dark:bg-[#1A1A1A]/40 backdrop-blur-md shadow-sm border-[#FF7A00]/30"
          : "border-transparent hover:bg-black/5 dark:hover:bg-white/5"
      )}
    >
      <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white uppercase shadow-sm transition-colors duration-300" style={{ backgroundColor: currentIcon }}>
        {letter}
      </div>

      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="space-y-4 py-1">
            <input
              type="text" value={editState!.name} autoFocus
              onChange={(e) => onEditNameChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onEditSave(); if (e.key === 'Escape') onEditCancel(); }}
              className={cn(
                "w-full h-12 px-4 rounded-xl transition-all duration-300 outline-none text-sm font-bold text-[#1C3F35] dark:text-white placeholder-[#1C3F35]/30 dark:placeholder-white/30",
                "bg-black/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] border border-transparent",
                "dark:bg-black/40 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]",
                "focus:bg-white focus:shadow-md focus:border-[#FF7A00]/50",
                "dark:focus:bg-[#1A1A1A] dark:focus:shadow-none dark:focus:border-[#FF7A00]/50"
              )}
              disabled={isSaving}
            />
            <div className="flex gap-3 flex-wrap">
              {INITIALS_PALETTE.map((hex) => (
                <button
                  key={hex} type="button" onClick={() => onEditIconChange(hex)} disabled={isSaving} title={hex}
                  className={cn(
                    "w-8 h-8 rounded-full transition-all duration-300 border-2",
                    editState!.icon === hex
                      ? "border-transparent scale-110 shadow-[0_0_10px_rgba(255,122,0,0.4)] ring-2 ring-[#FF7A00]/50"
                      : "border-transparent hover:scale-110 opacity-50 hover:opacity-100"
                  )}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>
        ) : (
          <span className="text-base font-sans font-bold tracking-tight text-[#1C3F35] dark:text-white truncate block">
            {displayName}
          </span>
        )}
      </div>

      <div className={`flex items-center gap-2 shrink-0 ${isEditing ? 'visible' : 'opacity-0 md:opacity-0 group-hover:opacity-100 transition-opacity duration-200'}`}>
        {isEditing ? (
          <>
            <button onClick={onEditSave} disabled={isSaving || !editState!.name.trim()} className="p-2.5 rounded-xl bg-[#FF7A00]/10 hover:bg-[#FF7A00]/20 text-[#FF7A00] disabled:opacity-40 transition-colors shadow-sm" title="Сохранить (Enter)">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </button>
            <button onClick={onEditCancel} disabled={isSaving} className="p-2.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-[#1C3F35]/50 dark:text-white/50 disabled:opacity-40 transition-colors" title="Отмена (Esc)">
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <button onClick={() => onEditStart(cat)} className="p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-[#1C3F35]/50 dark:text-white/50 hover:text-[#FF7A00] transition-colors" title="Редактировать">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={() => onDeleteClick(cat)} className="p-2 rounded-xl bg-rose-500/5 hover:bg-rose-500/10 text-rose-500/60 hover:text-rose-500 transition-colors" title="Удалить">
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ── Основное модальное окно ───────────────────────────────────────────────────────────
export function CategoryManagerModal({ isOpen, onClose }: CategoryManagerModalProps) {
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    enabled: isOpen,
  });

  const expenses = categories.filter((c) => c.type === 'expense');
  const incomes = categories.filter((c) => c.type === 'income');

  const [editState, setEditState] = useState<EditState | null>(null);

  const handleEditStart = useCallback((cat: CategoryRead) => {
    setEditState({ categoryId: cat.id, name: getRussianCategoryName(cat.name).replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*/gu, ''), icon: cat.icon || '#1C3F35' });
  }, []);

  const handleEditCancel = useCallback(() => setEditState(null), []);

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { name: string; icon: string } }) => updateCategory(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setEditState(null);
      toast.success(`Категория обновлена`);
    },
    onError: (err: Error) => toast.error(`Ошибка: ${err.message}`),
  });

  const handleEditSave = useCallback(() => {
    if (!editState || !editState.name.trim()) return;
    updateMutation.mutate({ id: editState.categoryId, payload: { name: editState.name.trim(), icon: editState.icon } });
  }, [editState, updateMutation]);

  const [categoryPendingDelete, setCategoryPendingDelete] = useState<CategoryRead | null>(null);

  const handleDeleteClick = useCallback((cat: CategoryRead) => {
    setEditState(null);
    setCategoryPendingDelete(cat);
  }, []);

  const handleDeleteDialogClose = useCallback(() => setCategoryPendingDelete(null), []);
  const handleDeleted = useCallback(() => setCategoryPendingDelete(null), []);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !editState && !categoryPendingDelete) onClose();
    },
    [editState, categoryPendingDelete, onClose],
  );

  const isSaving = updateMutation.isPending;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div key="manager-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="fixed inset-0 z-[100] bg-black/40 dark:bg-black/60 backdrop-blur-md" onClick={handleBackdropClick} />

            <motion.div key="manager-card" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }} className="fixed z-[110] bottom-0 left-0 right-0 md:inset-0 md:flex md:items-center md:justify-center md:pointer-events-none">
              <div className="w-full md:max-w-lg md:pointer-events-auto bg-white/90 dark:bg-[#111111]/95 backdrop-blur-3xl rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-[0_32px_80px_rgba(0,0,0,0.15)] dark:shadow-[0_32px_80px_rgba(0,0,0,0.6)] border border-black/5 dark:border-white/10 overflow-hidden" onClick={(e) => e.stopPropagation()}>

                <div className="flex items-center justify-between px-8 pt-8 pb-5 border-b border-black/5 dark:border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-[#FF7A00]/10 rounded-2xl">
                      <Settings className="w-6 h-6 text-[#FF7A00]" />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-2xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white">Управление категориями</h2>
                      <p className="text-[11px] font-mono font-bold uppercase tracking-[0.25em] text-[#FF7A00] mt-1.5">{categories.length} категорий</p>
                    </div>
                  </div>
                  <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/5 text-[#1C3F35]/50 dark:text-white/50 hover:bg-black/10 dark:hover:bg-white/10 hover:text-[#1C3F35] dark:hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto px-6 py-6 space-y-2 scrollbar-thin scrollbar-thumb-[#1C3F35]/10 dark:scrollbar-thumb-white/10">
                  {isLoading ? (
                    <div className="space-y-3 py-2">
                      {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-2xl bg-black/5 dark:bg-white/5 animate-pulse" />)}
                    </div>
                  ) : categories.length === 0 ? (
                    <p className="py-12 text-center text-[12px] font-mono font-bold uppercase tracking-widest text-[#1C3F35]/40 dark:text-white/30">Категорий нет</p>
                  ) : (
                    <>
                      {expenses.length > 0 && (
                        <div className="mb-8">
                          <p className="px-4 py-2 text-[10px] font-mono font-bold text-[#1C3F35]/40 dark:text-white/40 uppercase tracking-widest mb-2">Расходы · {expenses.length}</p>
                          <AnimatePresence mode="popLayout">
                            {expenses.map((cat) => (
                              <CategoryRow key={cat.id} cat={cat} editState={editState} onEditStart={handleEditStart} onEditNameChange={(name) => setEditState((s) => s && { ...s, name })} onEditIconChange={(icon) => setEditState((s) => s && { ...s, icon })} onEditSave={handleEditSave} onEditCancel={handleEditCancel} onDeleteClick={handleDeleteClick} isSaving={isSaving && editState?.categoryId === cat.id} />
                            ))}
                          </AnimatePresence>
                        </div>
                      )}

                      {expenses.length > 0 && incomes.length > 0 && <div className="h-px bg-black/5 dark:bg-white/5 my-4 mx-4" />}

                      {incomes.length > 0 && (
                        <div>
                          <p className="px-4 py-2 text-[10px] font-mono font-bold text-[#1C3F35]/40 dark:text-white/40 uppercase tracking-widest mb-2">Доходы · {incomes.length}</p>
                          <AnimatePresence mode="popLayout">
                            {incomes.map((cat) => (
                              <CategoryRow key={cat.id} cat={cat} editState={editState} onEditStart={handleEditStart} onEditNameChange={(name) => setEditState((s) => s && { ...s, name })} onEditIconChange={(icon) => setEditState((s) => s && { ...s, icon })} onEditSave={handleEditSave} onEditCancel={handleEditCancel} onDeleteClick={handleDeleteClick} isSaving={isSaving && editState?.categoryId === cat.id} />
                            ))}
                          </AnimatePresence>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmDeleteDialog category={categoryPendingDelete} onClose={handleDeleteDialogClose} onDeleted={handleDeleted} />
    </>
  );
}