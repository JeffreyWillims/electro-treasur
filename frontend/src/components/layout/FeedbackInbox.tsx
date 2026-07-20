/**
 * FeedbackInbox — окно «Обратная связь» для владельца: все обращения
 * пользователей карточками, счётчик непрочитанных, отметка «прочитано».
 *
 * Раньше обращения уходили письмом и нигде не были видны; теперь они читаются
 * прямо в приложении. Доступ закрывает бэкенд (403 всем, кроме
 * ET_FEEDBACK_ADMIN_EMAILS) — фронт просто не показывает вход, если 403.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Inbox, CheckCheck, Mail, MailOpen } from 'lucide-react';
import { toast } from 'sonner';
import { fetchFeedback, markAllFeedbackRead, markFeedbackRead } from '@/api/client';

const RELATIVE = new Intl.RelativeTimeFormat('ru-RU', { numeric: 'auto' });

/** «сегодня, 21:04» / «вчера» / «3 дня назад» — без сторонних библиотек. */
function humanDate(iso: string): string {
  const d = new Date(iso);
  const days = Math.round((d.getTime() - Date.now()) / 86_400_000);
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (days === 0) return `сегодня, ${time}`;
  if (days > -7) return `${RELATIVE.format(days, 'day')}, ${time}`;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
}

const initialOf = (email: string) => (email.trim()[0] ?? '?').toUpperCase();

export function FeedbackInbox({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['feedback'],
    queryFn: () => fetchFeedback(),
    enabled: isOpen,
    retry: false,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['feedback'] });

  const readOne = useMutation({
    mutationFn: markFeedbackRead,
    onSuccess: invalidate,
    onError: () => toast.error('Не удалось отметить прочитанным'),
  });

  const readAll = useMutation({
    mutationFn: markAllFeedbackRead,
    onSuccess: () => {
      invalidate();
      toast.success('Все обращения прочитаны');
    },
    onError: () => toast.error('Не удалось отметить прочитанными'),
  });

  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[900] bg-black/40 dark:bg-black/60 backdrop-blur-md"
          />
          <div className="fixed inset-0 z-[901] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              className="pointer-events-auto w-[min(38rem,100%)] max-h-[min(38rem,calc(100vh-4rem))] flex flex-col overflow-hidden rounded-[2rem] bg-white/95 dark:bg-[#111111]/95 backdrop-blur-3xl border border-black/5 dark:border-white/10 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.45)]"
            >
              {/* Шапка */}
              <div className="flex items-center justify-between gap-4 p-6 border-b border-black/5 dark:border-white/5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-[#FF7A00]/10 flex items-center justify-center shrink-0">
                    <Inbox className="w-5 h-5 text-[#FF7A00]" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white leading-none">
                      Обратная связь
                    </h2>
                    <p className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-[#FF7A00] mt-1.5">
                      {unread > 0 ? `${unread} новых` : 'всё прочитано'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {unread > 0 && (
                    <button
                      type="button"
                      onClick={() => readAll.mutate()}
                      disabled={readAll.isPending}
                      className="hidden sm:inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-black/5 dark:bg-white/5 text-xs font-bold text-[#1C3F35] dark:text-white hover:bg-[#FF7A00]/15 hover:text-[#FF7A00] transition-colors disabled:opacity-50"
                    >
                      <CheckCheck className="w-4 h-4" /> Прочитать все
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Закрыть"
                    className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center text-[#1C3F35]/50 dark:text-white/50 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Список */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {isLoading && (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div
                        key={i}
                        className="h-24 rounded-2xl bg-black/5 dark:bg-white/5 animate-pulse"
                      />
                    ))}
                  </div>
                )}

                {!isLoading && items.length === 0 && (
                  <div className="py-20 text-center">
                    <p className="text-4xl mb-3">📭</p>
                    <p className="text-[#1C3F35]/50 dark:text-white/40 font-sans font-bold">
                      Пока обращений нет
                    </p>
                  </div>
                )}

                {items.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`relative flex gap-4 p-4 rounded-2xl border transition-colors ${
                      item.is_read
                        ? 'bg-black/[0.02] dark:bg-white/[0.02] border-black/5 dark:border-white/5'
                        : 'bg-[#FF7A00]/[0.06] dark:bg-[#FF7A00]/10 border-[#FF7A00]/20'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-[#1C3F35] dark:bg-emerald-700 text-white flex items-center justify-center text-sm font-bold shrink-0">
                      {initialOf(item.author_email)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-sans font-extrabold text-[#1C3F35] dark:text-white truncate">
                          {item.author_email}
                        </p>
                        {!item.is_read && (
                          <span className="w-2 h-2 rounded-full bg-[#FF7A00] shrink-0" />
                        )}
                      </div>
                      <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#1C3F35]/40 dark:text-white/35 mt-0.5">
                        {humanDate(item.created_at)}
                      </p>
                      <p className="mt-2 text-sm font-medium text-[#1C3F35]/85 dark:text-white/80 leading-relaxed whitespace-pre-wrap break-words">
                        {item.message}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => !item.is_read && readOne.mutate(item.id)}
                      disabled={item.is_read || readOne.isPending}
                      title={item.is_read ? 'Прочитано' : 'Отметить прочитанным'}
                      className="w-9 h-9 shrink-0 self-start rounded-xl flex items-center justify-center transition-colors disabled:opacity-40 text-[#1C3F35]/40 dark:text-white/35 hover:bg-[#FF7A00]/15 hover:text-[#FF7A00]"
                    >
                      {item.is_read ? (
                        <MailOpen className="w-4 h-4" />
                      ) : (
                        <Mail className="w-4 h-4" />
                      )}
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
