/**
 * DataVaultModal — Glassmorphism Import Modal for Citrine Vault.
 *
 * Features:
 *   • Drag & Drop zone with glassmorphic backdrop-blur aesthetic.
 *   • File validation (.csv, .xlsx, .xls — max 10 MB).
 *   • Three visual states: idle → uploading → success/error.
 *   • Auto-closes 1.5s after successful import.
 *   • Invalidates ['transactions'] and ['dashboard'] query caches on success.
 */
import { useState, useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { importTransactions } from '@/api/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ImportResult } from '@/types';

const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

interface DataVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DataVaultModal({ isOpen, onClose }: DataVaultModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const mutation = useMutation({
    mutationFn: (file: File) => importTransactions(file),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });

      if (data.created > 0) {
        toast.success(`Импортировано ${data.created} транзакций`);
      } else {
        toast.info('Все строки уже были импортированы ранее');
      }

      // Auto-close after success
      setTimeout(() => {
        handleClose();
      }, 1500);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Ошибка импорта');
    },
  });

  const handleClose = useCallback(() => {
    if (mutation.isPending) return; // Don't close during upload
    setResult(null);
    setIsDragOver(false);
    mutation.reset();
    onClose();
  }, [onClose, mutation]);

  const validateAndUpload = useCallback(
    (file: File) => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        toast.error(`Неподдерживаемый формат. Допустимые: ${ALLOWED_EXTENSIONS.join(', ')}`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error('Файл слишком большой. Максимум: 10 МБ');
        return;
      }
      mutation.mutate(file);
    },
    [mutation],
  );

  // ── Drag & Drop handlers ───────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      const firstFile = files[0] as File | undefined;
      if (firstFile) {
        validateAndUpload(firstFile);
      }
    },
    [validateAndUpload],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      const firstFile = files?.[0] as File | undefined;
      if (firstFile) {
        validateAndUpload(firstFile);
      }
      // Reset input so the same file can be re-selected
      e.target.value = '';
    },
    [validateAndUpload],
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={handleClose}
            className="fixed inset-0 z-50 bg-black/20 dark:bg-black/50 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="relative w-full max-w-lg bg-white/70 dark:bg-[#0A0A0A]/70 backdrop-blur-3xl border border-white/40 dark:border-white/10 rounded-[2rem] shadow-[0_32px_64px_rgba(0,0,0,0.12)] dark:shadow-[0_32px_64px_rgba(0,0,0,0.6)] overflow-hidden pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-8 pt-8 pb-2">
                <div>
                  <h2 className="text-2xl font-extrabold text-[#1C3F35] dark:text-white tracking-tight">
                    Data Vault
                  </h2>
                  <p className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-[#1C3F35]/40 dark:text-emerald-400/40 mt-1">
                    Импорт транзакций
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  disabled={mutation.isPending}
                  className="w-10 h-10 rounded-xl bg-[#1C3F35]/[0.04] dark:bg-white/5 flex items-center justify-center hover:bg-[#1C3F35]/[0.08] dark:hover:bg-white/10 transition-colors disabled:opacity-30"
                >
                  <X className="w-4 h-4 text-[#1C3F35]/50 dark:text-white/50" />
                </button>
              </div>

              {/* Content */}
              <div className="px-8 pb-8 pt-4">
                <AnimatePresence mode="wait">
                  {/* ── Success State ──────────────────────────────────── */}
                  {result ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="flex flex-col items-center gap-6 py-8"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', damping: 10, stiffness: 200, delay: 0.1 }}
                      >
                        <CheckCircle2 className="w-16 h-16 text-emerald-500" />
                      </motion.div>
                      <div className="text-center space-y-2">
                        <p className="text-xl font-bold text-[#1C3F35] dark:text-white">
                          Импорт завершён
                        </p>
                        <div className="flex items-center justify-center gap-6 text-sm font-mono">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            +{result.created} создано
                          </span>
                          {result.skipped > 0 && (
                            <span className="text-amber-600 dark:text-amber-400 font-bold">
                              {result.skipped} пропущено
                            </span>
                          )}
                        </div>
                        {result.errors.length > 0 && (
                          <div className="mt-4 max-h-32 overflow-y-auto text-left bg-rose-50/50 dark:bg-rose-900/10 rounded-xl p-3 border border-rose-200/50 dark:border-rose-500/20">
                            {result.errors.slice(0, 5).map((err, i) => (
                              <p key={i} className="text-xs text-rose-600 dark:text-rose-400 font-mono">
                                {err}
                              </p>
                            ))}
                            {result.errors.length > 5 && (
                              <p className="text-xs text-rose-400 dark:text-rose-500 font-mono mt-1">
                                ...и ещё {result.errors.length - 5} ошибок
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ) : mutation.isPending ? (
                    /* ── Uploading State ────────────────────────────────── */
                    <motion.div
                      key="uploading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center gap-6 py-12"
                    >
                      <motion.div
                        className="w-14 h-14 border-[3px] border-[#1C3F35]/10 dark:border-white/10 border-t-[#FF7A00] rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      />
                      <div className="text-center">
                        <p className="text-lg font-bold text-[#1C3F35] dark:text-white">
                          Обработка файла...
                        </p>
                        <p className="text-xs font-mono text-[#1C3F35]/40 dark:text-white/30 mt-1 uppercase tracking-widest">
                          Парсинг • Дедупликация • Импорт
                        </p>
                      </div>
                    </motion.div>
                  ) : mutation.isError ? (
                    /* ── Error State ────────────────────────────────────── */
                    <motion.div
                      key="error"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center gap-6 py-8"
                    >
                      <AlertCircle className="w-14 h-14 text-rose-500" />
                      <div className="text-center space-y-2">
                        <p className="text-lg font-bold text-rose-600 dark:text-rose-400">
                          Ошибка импорта
                        </p>
                        <p className="text-sm text-rose-500/80">
                          {mutation.error?.message || 'Неизвестная ошибка'}
                        </p>
                      </div>
                      <button
                        onClick={() => mutation.reset()}
                        className="px-6 py-2.5 rounded-xl bg-[#1C3F35] dark:bg-emerald-600 text-white font-bold text-sm hover:scale-[1.02] active:scale-100 transition-transform"
                      >
                        Попробовать снова
                      </button>
                    </motion.div>
                  ) : (
                    /* ── Idle / Drop Zone ──────────────────────────────── */
                    <motion.div
                      key="idle"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`
                          w-full flex flex-col items-center justify-center p-10
                          border-2 border-dashed rounded-3xl
                          shadow-inner transition-all duration-300 cursor-pointer
                          ${
                            isDragOver
                              ? 'border-[#FF7A00]/50 bg-[#FF7A00]/5 dark:bg-[#FF7A00]/5 scale-[1.02]'
                              : 'border-[#1C3F35]/15 dark:border-white/10 bg-white/20 dark:bg-white/[0.02] hover:bg-white/30 dark:hover:bg-white/[0.04]'
                          }
                          backdrop-blur-md
                        `}
                      >
                        <motion.div
                          animate={isDragOver ? { scale: 1.15, y: -4 } : { scale: 1, y: 0 }}
                          transition={{ type: 'spring', stiffness: 300 }}
                          className="mb-5"
                        >
                          {isDragOver ? (
                            <Upload className="w-12 h-12 text-[#FF7A00]" />
                          ) : (
                            <FileSpreadsheet className="w-12 h-12 text-[#1C3F35]/30 dark:text-white/20" />
                          )}
                        </motion.div>

                        <p className="text-base font-bold text-[#1C3F35] dark:text-white mb-1">
                          {isDragOver ? 'Отпустите файл' : 'Перетащите файл сюда'}
                        </p>
                        <p className="text-xs text-[#1C3F35]/40 dark:text-white/30 mb-5">
                          или нажмите для выбора
                        </p>

                        <div className="flex items-center gap-3 text-[10px] font-mono font-bold uppercase tracking-widest text-[#1C3F35]/25 dark:text-white/15">
                          <span className="px-2 py-1 rounded-lg bg-[#1C3F35]/[0.04] dark:bg-white/[0.04]">.CSV</span>
                          <span className="px-2 py-1 rounded-lg bg-[#1C3F35]/[0.04] dark:bg-white/[0.04]">.XLSX</span>
                          <span className="px-2 py-1 rounded-lg bg-[#1C3F35]/[0.04] dark:bg-white/[0.04]">.XLS</span>
                        </div>
                      </div>

                      {/* Hidden file input */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleFileSelect}
                        className="hidden"
                      />

                      {/* Column hint */}
                      <p className="text-center text-[10px] font-mono text-[#1C3F35]/30 dark:text-white/20 mt-4 leading-relaxed">
                        Ожидаемые колонки: <span className="font-bold">Date</span>, <span className="font-bold">Amount</span>, <span className="font-bold">Category</span>, <span className="font-bold">Comment</span>
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
