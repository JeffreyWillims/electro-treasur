import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ChevronLeft, Users } from 'lucide-react';
import { getClientTransactions, getConsultantClients } from '@/api/client';
import type { ClientInfo, TransactionPaginatedResponse } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;

/**
 * Дашборд консультанта: список клиентов, выдавших read-only доступ,
 * и просмотр их транзакций. Доступен только роли CONSULTANT.
 */
export function MyClients() {
  const { user } = useAuth();

  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<ClientInfo | null>(null);
  const [txPage, setTxPage] = useState<TransactionPaginatedResponse | null>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    getConsultantClients()
      .then(setClients)
      .catch(() => toast.error('Не удалось загрузить список клиентов'))
      .finally(() => setIsLoading(false));
  }, []);

  const loadTransactions = useCallback(async (client: ClientInfo, txOffset: number) => {
    try {
      setTxPage(await getClientTransactions(client.id, PAGE_SIZE, txOffset));
      setOffset(txOffset);
    } catch {
      toast.error('Не удалось загрузить транзакции клиента');
    }
  }, []);

  const openClient = (client: ClientInfo) => {
    setSelected(client);
    setTxPage(null);
    void loadTransactions(client, 0);
  };

  // RBAC-гейт на клиенте (бэкенд всё равно вернёт 403 без роли)
  if (user && user.role !== 'consultant') {
    return <Navigate to="/" />;
  }

  const cardStyles =
    'bg-white/40 dark:bg-[#111111]/40 backdrop-blur-3xl border border-black/5 dark:border-white/10 rounded-[2.5rem] shadow-lg';

  return (
    <div className="max-w-5xl mx-auto pt-12 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="flex flex-col gap-8"
      >
        {/* Header */}
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1C3F35] to-[#0A1A12] dark:from-[#050505] dark:to-[#111111] flex items-center justify-center border border-white/10 shadow-lg">
            <Users className="w-6 h-6 text-[#FF7A00]" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white leading-none">
              Мои клиенты
            </h1>
            <p className="text-[11px] font-mono font-bold uppercase tracking-[0.25em] text-[#FF7A00] mt-2">
              Consultant Workspace · Read-Only
            </p>
          </div>
        </div>

        {selected === null ? (
          /* ── Список клиентов ── */
          <div className={cn(cardStyles, 'overflow-hidden')}>
            {isLoading ? (
              <p className="p-8 font-sans font-bold text-[#1C3F35]/50 dark:text-white/40 animate-pulse">
                Загрузка клиентов…
              </p>
            ) : clients.length === 0 ? (
              <div className="p-10 text-center">
                <p className="font-sans font-extrabold text-xl text-[#1C3F35] dark:text-white mb-2">
                  Пока никто не выдал доступ
                </p>
                <p className="text-sm font-sans text-[#1C3F35]/60 dark:text-white/50">
                  Попроси клиента открыть доступ к своим данным, указав твой email
                  в разделе доступа консультанта.
                </p>
              </div>
            ) : (
              clients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => openClient(client)}
                  className="w-full flex items-center gap-5 p-6 md:p-8 border-b border-black/5 dark:border-white/5 last:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF7A00] to-[#FFA011] flex items-center justify-center text-white font-sans font-black text-lg shrink-0">
                    {(client.full_name || client.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white truncate">
                      {client.full_name || 'Инкогнито'}
                    </p>
                    <p className="text-sm font-mono text-[#1C3F35]/50 dark:text-white/40 truncate">
                      {client.email}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          /* ── Транзакции выбранного клиента ── */
          <div className="flex flex-col gap-5">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="self-start flex items-center gap-2 font-sans font-bold text-sm text-[#1C3F35] dark:text-white/80 hover:text-[#FF7A00] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Все клиенты
            </button>

            <div className={cn(cardStyles, 'p-6 md:p-8')}>
              <p className="font-sans font-extrabold text-xl text-[#1C3F35] dark:text-white mb-1">
                {selected.full_name || selected.email}
              </p>
              <p className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-[#1C3F35]/50 dark:text-white/40 mb-6">
                {txPage ? `Транзакций всего: ${txPage.total}` : 'Загрузка…'}
              </p>

              <div className="flex flex-col divide-y divide-black/5 dark:divide-white/5">
                {txPage?.items.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-4 gap-4">
                    <div className="min-w-0">
                      <p className="font-sans font-bold text-[#1C3F35] dark:text-white truncate">
                        {tx.category_name || `Категория #${tx.category_id}`}
                      </p>
                      <p className="text-[11px] font-mono text-[#1C3F35]/50 dark:text-white/40">
                        {new Date(tx.executed_at).toLocaleDateString('ru-RU')}
                        {tx.comment ? ` · ${tx.comment}` : ''}
                      </p>
                    </div>
                    <p className="font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white shrink-0">
                      {Number(tx.amount).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
                    </p>
                  </div>
                ))}
                {txPage && txPage.items.length === 0 && (
                  <p className="py-6 font-sans font-bold text-[#1C3F35]/50 dark:text-white/40">
                    У клиента пока нет транзакций.
                  </p>
                )}
              </div>

              {/* Пагинация */}
              {txPage && txPage.total > PAGE_SIZE && (
                <div className="flex items-center justify-between mt-6">
                  <button
                    type="button"
                    disabled={offset === 0}
                    onClick={() => void loadTransactions(selected, Math.max(0, offset - PAGE_SIZE))}
                    className="px-5 h-11 rounded-xl font-bold text-sm bg-black/5 dark:bg-white/5 text-[#1C3F35] dark:text-white disabled:opacity-40 transition-all"
                  >
                    ← Новее
                  </button>
                  <p className="text-[11px] font-mono text-[#1C3F35]/50 dark:text-white/40">
                    {offset + 1}–{Math.min(offset + PAGE_SIZE, txPage.total)} из {txPage.total}
                  </p>
                  <button
                    type="button"
                    disabled={offset + PAGE_SIZE >= txPage.total}
                    onClick={() => void loadTransactions(selected, offset + PAGE_SIZE)}
                    className="px-5 h-11 rounded-xl font-bold text-sm bg-black/5 dark:bg-white/5 text-[#1C3F35] dark:text-white disabled:opacity-40 transition-all"
                  >
                    Старее →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
