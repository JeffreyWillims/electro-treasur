/**
 * StatementImportModal — сканирование выписки/чека (PDF · фото · Excel).
 *
 * Поток: загрузка → фоновый разбор (arq) → живой прогресс через SSE
 * (/v1/jobs/{id}/stream, с фолбэком на polling) → редактируемое превью →
 * подтверждение импорта. Без LLM — эвристический парсер на сервере.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanLine, FileText, Loader2, Trash2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  uploadStatement,
  pollStatement,
  confirmStatementImport,
  type StatementCandidate,
} from '@/api/client';

const ALLOWED = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.xlsx', '.xls'];
const MAX_SIZE = 10 * 1024 * 1024;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Phase = 'idle' | 'parsing' | 'preview' | 'empty' | 'error';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function StatementImportModal({ isOpen, onClose }: Props) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const rampRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rows, setRows] = useState<StatementCandidate[]>([]);
  const [importing, setImporting] = useState(false);

  const cleanup = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    if (rampRef.current) {
      clearInterval(rampRef.current);
      rampRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]); // закрыть поток при размонтировании

  const reset = useCallback(() => {
    cleanup();
    setPhase('idle');
    setProgress(0);
    setRows([]);
    setImporting(false);
  }, [cleanup]);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const applyResult = useCallback((candidates: StatementCandidate[]) => {
    cleanup();
    setProgress(100);
    if (candidates.length === 0) setPhase('empty');
    else {
      setRows(candidates);
      setPhase('preview');
    }
  }, [cleanup]);

  const pollFallback = useCallback(
    async (taskId: string) => {
      for (let i = 0; i < 40; i++) {
        try {
          const task = await pollStatement(taskId);
          if (task.status === 'complete') {
            applyResult(task.result?.candidates ?? []);
            return;
          }
        } catch {
          /* продолжаем опрос */
        }
        await sleep(1500);
      }
      setPhase('error');
    },
    [applyResult],
  );

  const handleFile = useCallback(
    async (file: File) => {
      const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
      if (!ALLOWED.includes(ext)) {
        toast.error(`Формат ${ext} не поддерживается`);
        return;
      }
      if (file.size > MAX_SIZE) {
        toast.error('Файл больше 10 МБ');
        return;
      }
      setProgress(0);
      setPhase('parsing');
      rampRef.current = window.setInterval(
        () => setProgress((p) => Math.min(p + 7, 90)),
        250,
      );
      try {
        const { task_id } = await uploadStatement(file);
        let settled = false;
        const es = new EventSource(`/api/v1/jobs/${task_id}/stream`, { withCredentials: true });
        esRef.current = es;
        es.onmessage = (ev) => {
          // Кадр SSE может быть неполным или служебным (keepalive) — тогда
          // JSON.parse бросает прямо в обработчике, и импорт навсегда виснет
          // на ~90%. Битый кадр пропускаем и ждём следующий.
          let d: { status?: string; result?: { candidates?: StatementCandidate[] } };
          try {
            d = JSON.parse(ev.data);
          } catch {
            return;
          }
          if (d.status === 'complete') {
            settled = true;
            applyResult(d.result?.candidates ?? []);
          } else if (d.status === 'error' || d.status === 'timeout') {
            settled = true;
            cleanup();
            setPhase('error');
          }
        };
        es.onerror = () => {
          if (settled) return;
          es.close();
          esRef.current = null;
          pollFallback(task_id); // SSE недоступен → фолбэк на polling
        };
      } catch (e) {
        cleanup();
        toast.error(e instanceof Error ? e.message : 'Ошибка разбора');
        setPhase('error');
      }
    },
    [applyResult, cleanup, pollFallback],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const patchRow = (idx: number, patch: Partial<StatementCandidate>) =>
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const removeRow = (idx: number) => setRows((rs) => rs.filter((_, i) => i !== idx));

  const doImport = useCallback(async () => {
    if (rows.length === 0) return;
    setImporting(true);
    try {
      const res = await confirmStatementImport(rows);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(
        `Импортировано ${res.created}${res.skipped ? ` · пропущено ${res.skipped}` : ''}`,
      );
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка импорта');
      setImporting(false);
    }
  }, [rows, queryClient, close]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={close}
      >
        <motion.div
          className="w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col rounded-[2rem] bg-[#FDFBF7] dark:bg-[#0B0B0B] border border-black/10 dark:border-white/10 shadow-2xl"
          initial={{ scale: 0.94, y: 16 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.94, y: 16 }}
          transition={{ type: 'spring', damping: 24, stiffness: 260 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-black/5 dark:border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FF7A00]/10 flex items-center justify-center">
                <ScanLine className="w-5 h-5 text-[#FF7A00]" />
              </div>
              <div>
                <h2 className="text-lg font-sans font-extrabold text-[#1C3F35] dark:text-white leading-tight">
                  Сканировать выписку
                </h2>
                <p className="text-[11px] font-sans text-[#1C3F35]/50 dark:text-white/40">
                  PDF · фото чека · Excel — распознаём суммы автоматически
                </p>
              </div>
            </div>
            <button onClick={close} className="text-[#1C3F35]/40 hover:text-rose-500 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-7">
            {/* idle: dropzone */}
            {phase === 'idle' && (
              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`cursor-pointer rounded-3xl border-2 border-dashed p-12 text-center transition-colors ${
                  dragOver
                    ? 'border-[#FF7A00] bg-[#FF7A00]/5'
                    : 'border-black/15 dark:border-white/15 hover:border-[#FF7A00]/60'
                }`}
              >
                <FileText className="w-10 h-10 mx-auto mb-4 text-[#FF7A00]/70" />
                <p className="font-sans font-bold text-[#1C3F35] dark:text-white">
                  Перетащите файл или нажмите
                </p>
                <p className="text-xs text-[#1C3F35]/50 dark:text-white/40 mt-1">
                  {ALLOWED.join(' · ')} · до 10 МБ
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept={ALLOWED.join(',')}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                    e.target.value = '';
                  }}
                />
              </div>
            )}

            {/* parsing: live progress */}
            {phase === 'parsing' && (
              <div className="py-16 flex flex-col items-center gap-5">
                <Loader2 className="w-9 h-9 text-[#FF7A00] animate-spin" />
                <p className="font-sans font-bold text-[#1C3F35] dark:text-white">
                  Разбираем документ…
                </p>
                <div className="w-64 h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-[#FF7A00]"
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: 'easeOut', duration: 0.3 }}
                  />
                </div>
                <p className="text-xs text-[#1C3F35]/50 dark:text-white/40">
                  Извлекаем суммы и категории
                </p>
              </div>
            )}

            {/* empty / error */}
            {(phase === 'empty' || phase === 'error') && (
              <div className="py-14 flex flex-col items-center gap-4 text-center">
                <AlertCircle className="w-10 h-10 text-rose-500" />
                <p className="font-sans font-bold text-[#1C3F35] dark:text-white">
                  {phase === 'empty' ? 'Не нашли транзакций' : 'Не удалось разобрать файл'}
                </p>
                <button
                  onClick={reset}
                  className="px-6 py-2.5 rounded-full bg-black/5 dark:bg-white/10 font-bold text-sm text-[#1C3F35] dark:text-white hover:bg-black/10"
                >
                  Попробовать другой файл
                </button>
              </div>
            )}

            {/* preview: editable rows */}
            {phase === 'preview' && (
              <div className="space-y-3">
                {rows.map((row, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl bg-white/70 dark:bg-white/5 border border-black/5 dark:border-white/10 p-3 flex flex-wrap items-center gap-2"
                  >
                    <div className="flex rounded-full bg-black/5 dark:bg-white/10 p-0.5">
                      {(['expense', 'income'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => patchRow(idx, { type: t })}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                            row.type === t
                              ? t === 'income'
                                ? 'bg-emerald-500 text-white'
                                : 'bg-rose-500 text-white'
                              : 'text-[#1C3F35]/50 dark:text-white/40'
                          }`}
                        >
                          {t === 'income' ? 'Доход' : 'Расход'}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      value={row.amount}
                      onChange={(e) => patchRow(idx, { amount: Number(e.target.value) })}
                      className="w-28 rounded-xl bg-black/5 dark:bg-white/10 px-3 py-2 text-sm font-bold tabular-nums outline-none focus:ring-2 ring-[#FF7A00]/40 text-[#1C3F35] dark:text-white"
                    />
                    <input
                      value={row.description}
                      onChange={(e) => patchRow(idx, { description: e.target.value })}
                      placeholder="Описание"
                      className="flex-1 min-w-[120px] rounded-xl bg-black/5 dark:bg-white/10 px-3 py-2 text-sm outline-none focus:ring-2 ring-[#FF7A00]/40 text-[#1C3F35] dark:text-white"
                    />
                    <button
                      onClick={() => removeRow(idx)}
                      className="text-[#1C3F35]/30 hover:text-rose-500 transition-colors p-1"
                      aria-label="Убрать строку"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer (preview only) */}
          {phase === 'preview' && (
            <div className="px-7 py-5 border-t border-black/5 dark:border-white/5 flex items-center justify-between gap-3">
              <button
                onClick={reset}
                className="px-5 py-2.5 rounded-full font-bold text-sm text-[#1C3F35]/60 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/5"
              >
                Другой файл
              </button>
              <button
                onClick={doImport}
                disabled={importing || rows.length === 0}
                className="flex items-center gap-2 px-7 py-2.5 rounded-full bg-[#1C3F35] dark:bg-[#FF7A00] text-white font-bold text-sm shadow-lg active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                {importing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Импортировать {rows.length}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
