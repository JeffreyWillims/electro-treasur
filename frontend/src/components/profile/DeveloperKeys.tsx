import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Code2, Copy, KeyRound, Plus, Trash2 } from 'lucide-react';
import { createApiKey, listApiKeys, revokeApiKey } from '@/api/client';
import type { ApiKeyInfo } from '@/types';
import { cn } from '@/lib/utils';

/**
 * Секция «Для разработчиков»: выпуск API-ключей для /api/v2/public.
 * Полный ключ показывается ровно один раз — сразу после генерации.
 */
export function DeveloperKeys() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [keyName, setKeyName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  // Свежесозданный ключ — единственный момент, когда секрет виден
  const [freshKey, setFreshKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setKeys(await listApiKeys());
    } catch {
      // Секция не критична для профиля — не роняем страницу тостами при первом рендере
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = async () => {
    if (!keyName.trim()) {
      toast.error('Укажи название ключа, например «Мой сервис»');
      return;
    }
    setIsCreating(true);
    try {
      const created = await createApiKey(keyName.trim());
      setFreshKey(created.api_key);
      setKeyName('');
      await refresh();
      toast.success('Ключ создан. Скопируй его — он показывается только один раз!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка создания ключа');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!freshKey) return;
    await navigator.clipboard.writeText(freshKey);
    toast.success('Ключ скопирован в буфер обмена');
  };

  const handleRevoke = async (key: ApiKeyInfo) => {
    try {
      await revokeApiKey(key.id);
      toast.success(`Ключ «${key.name}» отозван`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка отзыва ключа');
    }
  };

  return (
    <div>
      <h2 className="text-sm md:text-[15px] font-sans font-extrabold uppercase tracking-widest text-[#1C3F35] dark:text-emerald-500 ml-6 mb-3">
        Для разработчиков
      </h2>
      <div className="bg-white/40 dark:bg-[#111111]/40 backdrop-blur-3xl border border-black/5 dark:border-white/10 rounded-[2.5rem] overflow-hidden shadow-lg p-8 md:p-10 flex flex-col gap-6">
        {/* Заголовок секции */}
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-[#1C3F35]/5 dark:bg-white/5 border border-black/5 dark:border-white/10 shadow-inner">
            <Code2 className="w-7 h-7 text-[#1C3F35] dark:text-emerald-400" />
          </div>
          <div>
            <p className="font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white text-xl md:text-2xl leading-none mb-1.5">
              API-ключи
            </p>
            <p className="text-[10px] md:text-[11px] font-mono font-bold uppercase tracking-[0.25em] text-[#1C3F35]/50 dark:text-white/50">
              Public API v2 · X-API-Key
            </p>
          </div>
        </div>

        {/* Генерация */}
        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="Название ключа (например, «Мой сервис»)"
            maxLength={64}
            className="flex-1 h-14 px-5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 outline-none font-sans font-bold text-[#1C3F35] dark:text-white placeholder-[#1C3F35]/30 dark:placeholder-white/30"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={isCreating}
            className="h-14 px-8 bg-[#1C3F35] dark:bg-[#FF7A00] hover:opacity-90 text-white rounded-2xl font-bold uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Создать
          </button>
        </div>

        {/* Свежий ключ — показывается один раз */}
        {freshKey && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-5 bg-[#FF7A00]/10 border border-[#FF7A00]/30"
          >
            <p className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-[#FF7A00] mb-3">
              ⚠️ Скопируй ключ сейчас — он показывается только один раз
            </p>
            <div className="flex items-center gap-3">
              <code className="flex-1 text-sm font-mono font-bold text-[#1C3F35] dark:text-white break-all select-all">
                {freshKey}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                aria-label="Скопировать ключ"
                className="w-11 h-11 rounded-xl bg-[#FF7A00] text-white flex items-center justify-center shrink-0 hover:opacity-90 active:scale-[0.95] transition-all"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Список ключей */}
        {keys.length > 0 && (
          <div className="flex flex-col divide-y divide-black/5 dark:divide-white/5">
            {keys.map((key) => (
              <div key={key.id} className="flex items-center justify-between py-4 gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <KeyRound
                    className={cn(
                      'w-5 h-5 shrink-0',
                      key.is_active ? 'text-emerald-500' : 'text-black/20 dark:text-white/20',
                    )}
                  />
                  <div className="min-w-0">
                    <p
                      className={cn(
                        'font-sans font-extrabold tracking-tight truncate',
                        key.is_active
                          ? 'text-[#1C3F35] dark:text-white'
                          : 'text-[#1C3F35]/40 dark:text-white/30 line-through',
                      )}
                    >
                      {key.name}
                    </p>
                    <p className="text-[11px] font-mono text-[#1C3F35]/50 dark:text-white/40">
                      cv_{key.prefix}… · {new Date(key.created_at).toLocaleDateString('ru-RU')}
                      {!key.is_active && ' · отозван'}
                    </p>
                  </div>
                </div>
                {key.is_active && (
                  <button
                    type="button"
                    onClick={() => handleRevoke(key)}
                    aria-label={`Отозвать ключ ${key.name}`}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
