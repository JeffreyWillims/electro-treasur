/**
 * NotificationBell — колокольчик с лентой уведомлений (обновления проекта,
 * итоги фоновых воркеров). Поллинг раз в минуту через refetchInterval; при открытии
 * панели всё помечается прочитанным. Записи раскрываются аккордеоном —
 * полный текст, дата целиком и цветовой акцент по типу.
 *
 * Панель рендерится ПОРТАЛОМ в document.body: сайдбар — backdrop-blur-контейнер,
 * то есть собственный контекст наложения, и панель внутри него уезжала под
 * карточки главной, какой бы z-index ей ни ставили.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, FileText, Sparkles, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchNotifications, markNotificationsRead } from '@/api/client';
import { cn } from '@/lib/utils';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн назад`;
}

/** Визуальный язык записи: report (итог воркера) — изумруд, update — оранжевый. */
function styleFor(type: string) {
  return type === 'report'
    ? {
        Icon: FileText,
        accent: 'bg-gradient-to-b from-[#10B981] to-[#059669]',
        chip: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        label: 'Отчёт',
      }
    : {
        Icon: Sparkles,
        accent: 'bg-gradient-to-b from-[#FF7A00] to-[#FFA011]',
        chip: 'bg-[#FF7A00]/10 text-[#FF7A00]',
        label: 'Обновление',
      };
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  // Аккордеон: раскрыта максимум одна запись
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const readAll = useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Esc закрывает панель; фон не скроллится под открытым окном (иначе колесо
  // мыши двигает страницу за панелью — читается как рывки интерфейса).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsOpen(false);
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) setExpandedId(null);
    if (next && unread > 0) readAll.mutate();
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggle}
        aria-label="Уведомления"
        className="relative w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-105 bg-black/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.8)] border border-black/5 dark:bg-black/40 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.5),0_1px_0_rgba(255,255,255,0.05)] dark:border-white/5"
      >
        <motion.div
          // Покачивание при непрочитанном — приглашает заглянуть
          animate={unread > 0 ? { rotate: [0, -14, 12, -8, 6, 0] } : { rotate: 0 }}
          transition={unread > 0 ? { duration: 0.9, repeat: Infinity, repeatDelay: 4 } : undefined}
        >
          <Bell size={17} className={unread > 0 ? 'text-[#FF7A00]' : 'text-vault-pine/60 dark:text-white/50'} />
        </motion.div>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-br from-[#FF7A00] to-[#FFA011] text-white text-[10px] font-black flex items-center justify-center shadow-md">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            // Центрирование флексом, а не translate: transform остаётся свободным
            // для анимации — браузер не пересчитывает layout ни на одном кадре.
            <div className="fixed inset-0 z-[900] flex items-center justify-center p-4">
              {/* Затемнение без backdrop-blur: размытие всего экрана — главный
                  источник лагов на слабых машинах, а панель и так читается. */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                onClick={() => setIsOpen(false)}
                className="absolute inset-0 bg-black/45 dark:bg-black/65"
              />

              {/* Панель — строго по центру экрана на всех разрешениях */}
              <motion.div
                role="dialog"
                aria-label="Уведомления"
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 4 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                style={{ willChange: 'transform, opacity' }}
                className={cn(
                  'relative flex flex-col overflow-hidden',
                  'w-[min(34rem,100%)] max-h-[min(34rem,calc(100vh-5rem))]',
                  'bg-white/95 dark:bg-[#12100E]/95 backdrop-blur-xl',
                  'border border-black/10 dark:border-white/10 rounded-[1.75rem]',
                  'shadow-[0_30px_70px_-15px_rgba(0,0,0,0.45)]',
                )}
              >
                {/* Шапка */}
                <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-4 border-b border-black/5 dark:border-white/5">
                  <div>
                    <h2 className="text-lg font-sans font-extrabold tracking-tight text-vault-pine dark:text-white leading-none">
                      Уведомления
                    </h2>
                    <p className="text-[12px] font-sans font-semibold text-vault-pine/50 dark:text-white/45 mt-1.5">
                      Отчёты воркеров и что нового в проекте
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    aria-label="Закрыть уведомления"
                    className="w-9 h-9 shrink-0 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-vault-pine/50 dark:text-white/50 hover:text-vault-pine dark:hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Лента */}
                <div className="flex-1 overflow-y-auto px-3 py-3">
                  {items.length === 0 && (
                    <p className="py-12 text-center text-sm font-semibold text-vault-pine/50 dark:text-white/40">
                      Пока тихо — уведомления появятся здесь.
                    </p>
                  )}

                  {items.map((n) => {
                    const expanded = expandedId === n.id;
                    const { Icon, accent, chip, label } = styleFor(n.type);
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : n.id)}
                        className={cn(
                          'relative w-full text-left pl-5 pr-4 py-4 rounded-2xl mb-1.5 transition-colors',
                          n.is_read
                            ? 'hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                            : 'bg-[#FF7A00]/[0.07] dark:bg-[#FF7A00]/10',
                          expanded && 'bg-black/[0.04] dark:bg-white/[0.06]',
                        )}
                      >
                        {/* Полоса-акцент по типу записи */}
                        <span className={cn('absolute left-1.5 top-4 bottom-4 w-[3px] rounded-full', accent)} />

                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-sans font-black uppercase tracking-wider', chip)}>
                            <Icon className="w-3 h-3" />
                            {label}
                          </span>
                          <span className="text-[11px] font-sans font-semibold text-vault-pine/40 dark:text-white/35">
                            {timeAgo(n.created_at)}
                          </span>
                        </div>

                        <p className="text-[15px] font-sans font-extrabold text-vault-pine dark:text-white leading-snug">
                          {n.title}
                        </p>

                        {!expanded && (
                          <p className="text-[13px] font-sans font-medium text-vault-pine/65 dark:text-white/60 leading-relaxed mt-1 line-clamp-2">
                            {n.body}
                          </p>
                        )}

                        {/* Раскрытие: анимируем только opacity — height:auto заставлял
                            браузер мерить layout каждый кадр и подёргивал ленту. */}
                        {expanded && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                          >
                            <p className="text-[14px] font-sans font-medium text-vault-pine/80 dark:text-white/75 leading-relaxed whitespace-pre-line pt-2">
                              {n.body}
                            </p>
                            <p className="text-[11px] font-sans font-semibold text-vault-pine/40 dark:text-white/35 mt-3">
                              {new Date(n.created_at).toLocaleString('ru-RU')}
                            </p>
                          </motion.div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
