/**
 * CategoryManagerModal — Full CRUD panel for user categories.
 *
 * Layout (Hybrid responsive):
 *   • Mobile  → slides up from the bottom (bottom-sheet pattern)
 *   • Desktop → centered modal with backdrop blur
 *
 * Features:
 *   • Categories grouped by type: Расходы / Доходы
 *   • Colored initials avatar per category
 *   • Inline Edit: click ✏️ → input + color palette → Enter to save
 *   • Delete: 🗑️ → ConfirmDeleteDialog (CASCADE-safe)
 *   • All mutations invalidate ['categories', 'transactions', 'dashboard']
 */
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Pencil, Trash2, Check, Loader2, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { fetchCategories, updateCategory } from '@/api/client';
import type { CategoryRead } from '@/types';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

// ── Same palette as QuickEntry (design consistency) ─────────────────────
const INITIALS_PALETTE = [
  '#1C3F35',
  '#FF7A00',
  '#C5A059',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
];

const getRussianCategoryName = (rawName: string) => {
  const name = rawName.toLowerCase();
  if (name.includes('leisure') || name.includes('lifestyle')) return 'Отдых и развлечения';
  if (name.includes('housing')) return 'Жилье';
  if (name.includes('transport') || name.includes('logistics')) return 'Транспорт';
  if (name.includes('food')) return 'Еда и продукты';
  if (name.includes('health') || name.includes('wellness')) return 'Здоровье';
  if (name.includes('income') || name.includes('propulsion')) return 'Доход';
  if (name.includes('shopping')) return 'Покупки';
  if (name.includes('utilit') || name.includes('operation')) return 'ЖКХ и Операции';
  if (name.includes('growth') || name.includes('invest')) return 'Инвестиции';
  return rawName;
};

// ── Inline Edit State per category row ──────────────────────────────────
interface EditState {
  categoryId: number;
  name: string;
  icon: string;
}

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ── Single Category Row ──────────────────────────────────────────────────
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

function CategoryRow({
  cat,
  editState,
  onEditStart,
  onEditNameChange,
  onEditIconChange,
  onEditSave,
  onEditCancel,
  onDeleteClick,
  isSaving,
}: CategoryRowProps) {
  const isEditing = editState?.categoryId === cat.id;
  const displayName = getRussianCategoryName(cat.name);
  const currentIcon = isEditing ? editState!.icon : (cat.icon || '#1C3F35');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.2 }}
      className={`group flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors duration-150
        ${isEditing
          ? 'bg-vault-pine/[0.04] dark:bg-white/[0.05] ring-1 ring-[#1C3F35]/10 dark:ring-white/10'
          : 'hover:bg-vault-pine/[0.03] dark:hover:bg-white/[0.03]'
        }`}
    >
      {/* ── Color Avatar ──────────────────────────────────────────────── */}
      <div
        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white uppercase shadow-sm transition-colors duration-200"
        style={{ backgroundColor: currentIcon }}
      >
        {(isEditing ? editState!.name : displayName).charAt(0)}
      </div>

      {/* ── Name / Input ──────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="space-y-2">
            <input
              type="text"
              value={editState!.name}
              autoFocus
              onChange={(e) => onEditNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onEditSave();
                if (e.key === 'Escape') onEditCancel();
              }}
              className="w-full bg-white dark:bg-black/30 border border-[#1C3F35]/20 dark:border-white/15 rounded-xl px-3 py-1.5 text-sm font-semibold text-[#1C3F35] dark:text-white outline-none focus:border-[#FF7A00]/50 focus:ring-2 focus:ring-[#FF7A00]/15 transition-all"
              disabled={isSaving}
            />
            {/* Inline Color Palette */}
            <div className="flex gap-2 flex-wrap">
              {INITIALS_PALETTE.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => onEditIconChange(hex)}
                  disabled={isSaving}
                  title={hex}
                  className={`w-6 h-6 rounded-full transition-all duration-150 border-2 ${
                    editState!.icon === hex
                      ? 'border-white dark:border-white scale-125 shadow-md'
                      : 'border-transparent hover:scale-110'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>
        ) : (
          <span className="text-sm font-semibold text-[#1C3F35] dark:text-white/90 truncate block">
            {displayName}
          </span>
        )}
      </div>

      {/* ── Action Buttons ────────────────────────────────────────────── */}
      <div className={`flex items-center gap-1 shrink-0 ${isEditing ? 'visible' : 'opacity-0 group-hover:opacity-100 transition-opacity duration-150'}`}>
        {isEditing ? (
          <>
            {/* Save */}
            <button
              type="button"
              onClick={onEditSave}
              disabled={isSaving || !editState!.name.trim()}
              className="p-1.5 rounded-lg bg-[#1C3F35]/10 dark:bg-white/10 hover:bg-[#1C3F35]/20 dark:hover:bg-white/20 text-[#1C3F35] dark:text-white disabled:opacity-40 transition-colors"
              title="Сохранить (Enter)"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
            </button>
            {/* Cancel */}
            <button
              type="button"
              onClick={onEditCancel}
              disabled={isSaving}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 dark:text-white/40 disabled:opacity-40 transition-colors"
              title="Отмена (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <>
            {/* Edit */}
            <button
              type="button"
              onClick={() => onEditStart(cat)}
              className="p-1.5 rounded-lg hover:bg-[#FF7A00]/10 text-slate-400 hover:text-[#FF7A00] dark:text-white/30 dark:hover:text-[#FF7A00] transition-colors"
              title="Редактировать"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {/* Delete */}
            <button
              type="button"
              onClick={() => onDeleteClick(cat)}
              className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-500/15 text-slate-400 hover:text-rose-600 dark:text-white/30 dark:hover:text-rose-400 transition-colors"
              title="Удалить"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ── Main Modal ───────────────────────────────────────────────────────────
export function CategoryManagerModal({ isOpen, onClose }: CategoryManagerModalProps) {
  const queryClient = useQueryClient();

  // ── Data ─────────────────────────────────────────────────────────────
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    enabled: isOpen,
  });

  const expenses = categories.filter((c) => c.type === 'expense');
  const incomes = categories.filter((c) => c.type === 'income');

  // ── Edit state ───────────────────────────────────────────────────────
  const [editState, setEditState] = useState<EditState | null>(null);

  const handleEditStart = useCallback((cat: CategoryRead) => {
    setEditState({
      categoryId: cat.id,
      name: getRussianCategoryName(cat.name),
      icon: cat.icon || '#1C3F35',
    });
  }, []);

  const handleEditCancel = useCallback(() => {
    setEditState(null);
  }, []);

  // ── Update mutation ──────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { name: string; icon: string } }) =>
      updateCategory(id, payload),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setEditState(null);
      toast.success(`Категория обновлена`, {
        description: `«${updated.name}»`,
      });
    },
    onError: (err: Error) => {
      toast.error(`Ошибка: ${err.message}`);
    },
  });

  const handleEditSave = useCallback(() => {
    if (!editState || !editState.name.trim()) return;
    updateMutation.mutate({
      id: editState.categoryId,
      payload: { name: editState.name.trim(), icon: editState.icon },
    });
  }, [editState, updateMutation]);

  // ── Delete state ─────────────────────────────────────────────────────
  const [categoryPendingDelete, setCategoryPendingDelete] = useState<CategoryRead | null>(null);

  const handleDeleteClick = useCallback((cat: CategoryRead) => {
    setEditState(null); // Close any open edit
    setCategoryPendingDelete(cat);
  }, []);

  const handleDeleteDialogClose = useCallback(() => {
    setCategoryPendingDelete(null);
  }, []);

  const handleDeleted = useCallback(() => {
    setCategoryPendingDelete(null);
  }, []);

  // ── Keyboard escape ──────────────────────────────────────────────────
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !editState && !categoryPendingDelete) {
        onClose();
      }
    },
    [editState, categoryPendingDelete, onClose],
  );

  const isSaving = updateMutation.isPending;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* ── Backdrop ───────────────────────────────────────────── */}
            <motion.div
              key="manager-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
              onClick={handleBackdropClick}
            />

            {/* ── Modal Card (hybrid: bottom-sheet on mobile, centered on md+) ── */}
            <motion.div
              key="manager-card"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="fixed z-[110] bottom-0 left-0 right-0 md:inset-0 md:flex md:items-center md:justify-center md:pointer-events-none"
            >
              <div
                className="w-full md:max-w-lg md:pointer-events-auto bg-white/95 dark:bg-[#121212]/95 backdrop-blur-3xl rounded-t-3xl md:rounded-[2rem] shadow-2xl border border-white/30 dark:border-white/[0.07] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* ── Header ───────────────────────────────────────── */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 dark:border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#1C3F35]/[0.08] dark:bg-white/[0.06] rounded-xl">
                      <Settings className="w-4 h-4 text-[#1C3F35] dark:text-white/70" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-[#1C3F35] dark:text-white">
                        Управление категориями
                      </h2>
                      <p className="text-xs text-slate-400 dark:text-white/30 mt-0.5">
                        {categories.length} категорий
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* ── Scrollable content ───────────────────────────── */}
                <div className="max-h-[65vh] overflow-y-auto px-4 py-4 space-y-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10">
                  {isLoading ? (
                    // Skeleton loader
                    <div className="space-y-2 py-2">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className="h-14 rounded-2xl bg-slate-100 dark:bg-white/[0.04] animate-pulse"
                        />
                      ))}
                    </div>
                  ) : categories.length === 0 ? (
                    <p className="py-12 text-center text-sm text-slate-400 dark:text-white/30 italic">
                      Категорий нет. Создайте первую через быстрый ввод!
                    </p>
                  ) : (
                    <>
                      {/* ── Expenses Section ───────────────────────── */}
                      {expenses.length > 0 && (
                        <div>
                          <p className="px-4 py-2 text-[10px] font-bold text-slate-400 dark:text-white/30 uppercase tracking-widest">
                            Расходы · {expenses.length}
                          </p>
                          <AnimatePresence mode="popLayout">
                            {expenses.map((cat) => (
                              <CategoryRow
                                key={cat.id}
                                cat={cat}
                                editState={editState}
                                onEditStart={handleEditStart}
                                onEditNameChange={(name) =>
                                  setEditState((s) => s && { ...s, name })
                                }
                                onEditIconChange={(icon) =>
                                  setEditState((s) => s && { ...s, icon })
                                }
                                onEditSave={handleEditSave}
                                onEditCancel={handleEditCancel}
                                onDeleteClick={handleDeleteClick}
                                isSaving={
                                  isSaving && editState?.categoryId === cat.id
                                }
                              />
                            ))}
                          </AnimatePresence>
                        </div>
                      )}

                      {/* ── Divider ────────────────────────────────── */}
                      {expenses.length > 0 && incomes.length > 0 && (
                        <div className="h-px bg-slate-100 dark:bg-white/[0.06] my-2 mx-4" />
                      )}

                      {/* ── Income Section ─────────────────────────── */}
                      {incomes.length > 0 && (
                        <div>
                          <p className="px-4 py-2 text-[10px] font-bold text-slate-400 dark:text-white/30 uppercase tracking-widest">
                            Доходы · {incomes.length}
                          </p>
                          <AnimatePresence mode="popLayout">
                            {incomes.map((cat) => (
                              <CategoryRow
                                key={cat.id}
                                cat={cat}
                                editState={editState}
                                onEditStart={handleEditStart}
                                onEditNameChange={(name) =>
                                  setEditState((s) => s && { ...s, name })
                                }
                                onEditIconChange={(icon) =>
                                  setEditState((s) => s && { ...s, icon })
                                }
                                onEditSave={handleEditSave}
                                onEditCancel={handleEditCancel}
                                onDeleteClick={handleDeleteClick}
                                isSaving={
                                  isSaving && editState?.categoryId === cat.id
                                }
                              />
                            ))}
                          </AnimatePresence>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* ── Footer ───────────────────────────────────────── */}
                <div className="px-6 py-4 border-t border-slate-100 dark:border-white/[0.06]">
                  <p className="text-[11px] text-center text-slate-400 dark:text-white/25">
                    Нажмите ✏️ для редактирования · 🗑️ для удаления · Enter для сохранения
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Confirm Delete Dialog (rendered outside card for z-index isolation) ── */}
      <ConfirmDeleteDialog
        category={categoryPendingDelete}
        onClose={handleDeleteDialogClose}
        onDeleted={handleDeleted}
      />
    </>
  );
}
