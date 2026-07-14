/**
 * NotificationBell — колокольчик с лентой уведомлений (обновления проекта,
 * итоги фоновых воркеров). Поллинг раз в минуту через refetchInterval; при открытии
 * панели всё помечается прочитанным. Записи раскрываются аккордеоном —
 * полный текст, дата целиком и цветовой акцент по типу.
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell } from 'lucide-react';
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

// Цветная полоса-акцент слева: report (итог воркера) → изумруд,
// update (и прочее) → оранжевый.
function accentClass(type: string): string {
  return type === 'report'
    ? 'bg-gradient-to-b from-[#10B981] to-[#059669]'
    : 'bg-gradient-to-b from-[#FF7A00] to-[#FFA011]';
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  // Аккордеон: раскрыта максимум одна запись
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unread = data?.unread ?? 0;

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) setExpandedId(null);
    if (next && unread > 0) readAll.mutate();
  };

  return (
    // Панель открывается СПРАВА от сайдбара (fixed, вертикально по центру
    // экрана) и не перекрывает его; на мобиле, где сайдбар скрыт, — по центру.
    // Позиционирует внешний div (Tailwind), анимирует внутренний motion.div —
    // framer перезаписывает transform, поэтому translate им отдавать нельзя.
    <div ref={panelRef}>
      <button
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

      <AnimatePresence>
        {isOpen && (
          <div className="fixed z-50 top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 lg:left-[20rem] lg:translate-x-0">
          <motion.div
            initial={{ opacity: 0, x: -12, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -12, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="w-80 bg-white/90 dark:bg-[#121212]/90 backdrop-blur-3xl border border-white/40 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden origin-left"
          >
            <div className="px-4 pt-4 pb-2 flex items-start justify-between">
              <div>
                <p className="text-sm font-extrabold text-vault-pine dark:text-white">Уведомления</p>
                <p className="text-[10px] font-medium text-vault-pine/45 dark:text-white/35 mt-0.5">
                  Новости · выписки · документы
                </p>
              </div>
              <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-[#FF7A00] mt-0.5">
                Citrine Vault
              </span>
            </div>

            <div className="max-h-96 overflow-y-auto px-2 pb-2">
              {(data?.items ?? []).length === 0 && (
                <p className="py-8 text-center text-xs text-vault-pine/50 dark:text-white/40">
                  Пока тихо — уведомления появятся здесь.
                </p>
              )}
              {(data?.items ?? []).map((n) => {
                const expanded = expandedId === n.id;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : n.id)}
                    className={cn(
                      'relative w-full text-left pl-4 pr-3 py-2.5 rounded-xl mb-1 transition-colors',
                      n.is_read
                        ? 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
                        : 'bg-[#FF7A00]/[0.06] dark:bg-[#FF7A00]/10',
                      expanded && 'bg-black/[0.03] dark:bg-white/[0.05]',
                    )}
                  >
                    {/* Полоса-акцент по типу записи */}
                    <span
                      className={cn(
                        'absolute left-1.5 top-3 bottom-3 w-[3px] rounded-full',
                        accentClass(n.type),
                      )}
                    />
                    <p className="text-[13px] font-bold text-vault-pine dark:text-white leading-snug">
                      {n.title}
                    </p>

                    {!expanded && (
                      <>
                        <p className="text-[11px] text-vault-pine/60 dark:text-white/50 leading-snug mt-1 line-clamp-2">
                          {n.body}
                        </p>
                        <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-vault-pine/35 dark:text-white/30 mt-1.5">
                          {timeAgo(n.created_at)}
                        </p>
                      </>
                    )}

                    {/* Плавное раскрытие: полный текст просторнее + дата целиком */}
                    <AnimatePresence initial={false}>
                      {expanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <p className="text-[13px] text-vault-pine/75 dark:text-white/70 leading-relaxed whitespace-pre-line pt-2">
                            {n.body}
                          </p>
                          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-vault-pine/40 dark:text-white/35 mt-2.5">
                            {new Date(n.created_at).toLocaleString('ru-RU')}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                );
              })}
            </div>
          </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
