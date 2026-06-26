import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { updateMe, generateTelegramOtp } from '@/api/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { PacificRide } from '@/components/ui/PacificRide';
import { Send, Save, Gamepad2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ProfileSettings() {
  const { user, refreshUser } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Состояние для игры
  const [isGameOpen, setIsGameOpen] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await updateMe({
        full_name: fullName || null,
        phone: phone || null,
      });
      await refreshUser();

      setIsSubmitting(false);
      toast.success('Настройки успешно сохранены');
    } catch (err: any) {
      setIsSubmitting(false);
      toast.error(err.message || 'Ошибка сохранения');
    }
  };

  // ─── TELEGRAM DEEP LINK ────────────────────────────────────
  const [isTgLoading, setIsTgLoading] = useState(false);
  const TG_BOT_USERNAME = 'read_workbot';

  const handleTelegramSync = async () => {
    setIsTgLoading(true);
    try {
      const data = await generateTelegramOtp();
      const tgUrl = `https://t.me/${TG_BOT_USERNAME}?start=${data.code}`;
      window.open(tgUrl, '_blank');
    } catch {
      toast.error('Ошибка при генерации ссылки. Попробуйте ещё раз.');
    } finally {
      setIsTgLoading(false);
    }
  };

  // 💎 Стили контейнеров настроек
  const sectionContainerStyles = cn(
    "bg-white/40 dark:bg-[#111111]/40 backdrop-blur-3xl border border-black/5 dark:border-white/10",
    "rounded-[2.5rem] overflow-hidden flex flex-col shadow-lg transition-all"
  );

  const rowStyles = cn(
    "flex justify-between items-center p-6 md:p-8 border-b border-black/5 dark:border-white/5 last:border-0",
    "hover:bg-black/5 dark:hover:bg-white/5 transition-colors focus-within:bg-white dark:focus-within:bg-[#1A1A1A] focus-within:shadow-sm"
  );

  const rowLabelStyles = "text-sm md:text-base font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white shrink-0";
  const rowInputStyles = "text-right bg-transparent outline-none w-full md:w-1/2 text-lg font-sans font-bold tracking-tight text-[#1C3F35]/80 dark:text-white/80 placeholder-[#1C3F35]/30 dark:placeholder-white/30";
  const sectionHeaderStyles = "text-sm md:text-[15px] font-sans font-extrabold uppercase tracking-widest text-[#1C3F35] dark:text-emerald-500 ml-6 mb-3";

  return (
    <div className="w-full pt-4 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="max-w-4xl mx-auto w-full"
      >
        {/* 1. THE AVATAR PLINTH */}
        <div className="flex flex-col items-center justify-center mb-12">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-[#FF7A00] rounded-full blur-3xl opacity-20 dark:opacity-40 animate-pulse" />
            <div className="w-32 h-32 relative z-10 rounded-full bg-gradient-to-br from-[#1C3F35] to-[#0A1A12] dark:from-[#050505] dark:to-[#111111] flex items-center justify-center text-5xl text-white font-sans font-black shadow-[0_20px_40px_rgba(0,0,0,0.2)] border-[6px] border-[#FDFBF7] dark:border-[#050505] transition-transform hover:scale-105 duration-300">
              {user?.full_name?.charAt(0).toUpperCase() || user?.email.charAt(0).toUpperCase() || 'A'}
            </div>
          </div>

          <h1 className="text-3xl md:text-4xl font-sans font-extrabold text-center text-[#1C3F35] dark:text-white tracking-tight leading-none mb-1.5">
            {user?.full_name || 'Инкогнито'}
          </h1>
          <p className="text-[11px] font-mono font-bold uppercase tracking-[0.25em] text-[#FF7A00]">
            Управление профилем
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-10">

          {/* 2. iOS SETTINGS LAYOUT - PERSONAL */}
          <div>
            <h2 className={sectionHeaderStyles}>
              Личные данные
            </h2>
            <div className={sectionContainerStyles}>
              <div className={rowStyles}>
                <label className={rowLabelStyles}>Имя</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={rowInputStyles}
                  placeholder="Иван"
                />
              </div>

              <div className={rowStyles}>
                <label className={rowLabelStyles}>Email-адрес</label>
                <input
                  type="email"
                  readOnly
                  value={user?.email || ''}
                  className={cn(rowInputStyles, "text-[#1C3F35]/40 dark:text-white/30 cursor-not-allowed")}
                />
              </div>

              <div className={rowStyles}>
                <label className={rowLabelStyles}>Телефон</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={rowInputStyles}
                  placeholder="+7 (000) 000-00-00"
                />
              </div>
            </div>
          </div>

          {/* 3. TELEGRAM SYNC BLOCK */}
          <div>
            <h2 className={sectionHeaderStyles}>
              Синхронизация
            </h2>
            <div className="rounded-[2.5rem] p-8 md:p-10 bg-[#2AABEE]/5 border border-[#2AABEE]/20 dark:bg-[#2AABEE]/10 dark:border-[#2AABEE]/30 shadow-lg flex flex-col md:flex-row items-center justify-between gap-6 transition-all">
              <div className="flex items-center gap-5 w-full md:w-auto">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-[#2AABEE]/10 border border-[#2AABEE]/20 shadow-inner">
                  <Send className="w-7 h-7 text-[#2AABEE] ml-1" />
                </div>
                <div>
                  <p className="font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white text-xl md:text-2xl leading-none mb-1.5">
                    Telegram Бот
                  </p>
                  <p className="text-[10px] md:text-[11px] font-mono font-bold uppercase tracking-[0.25em] text-[#1C3F35]/50 dark:text-white/50">
                    Ввод из мессенджера
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleTelegramSync}
                disabled={isTgLoading}
                className="w-full md:w-auto px-8 h-14 md:h-16 bg-[#2AABEE] hover:bg-[#229ED9] text-white rounded-2xl font-bold uppercase tracking-widest text-sm shadow-[0_10px_20px_-5px_rgba(42,171,238,0.4)] transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-70 shrink-0"
              >
                {isTgLoading ? (
                  <motion.div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Привязать
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 4. PACIFIC RIDE GAME CARD */}
          <div>
            <h2 className={sectionHeaderStyles}>
              Citrine Arcade
            </h2>
            <div className="rounded-[2.5rem] p-8 md:p-10 bg-gradient-to-br from-[#1C3F35] to-[#0A1A12] dark:from-[#050505] dark:to-[#111111] border border-black/5 dark:border-white/10 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden transition-all group hover:shadow-[0_20px_50px_rgba(255,122,0,0.15)]">
              {/* Sunset glow inside */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF7A00]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none transition-all group-hover:bg-[#FF7A00]/20" />

              <div className="flex items-center gap-5 w-full md:w-auto relative z-10">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-[#FF7A00]/10 border border-[#FF7A00]/20 shadow-inner group-hover:scale-110 transition-transform duration-300">
                  <Gamepad2 className="w-7 h-7 text-[#FF7A00] ml-0.5" />
                </div>
                <div>
                  <p className="font-sans font-extrabold tracking-tight text-white text-xl md:text-2xl leading-none mb-1.5">
                    Pacific Ride
                  </p>
                  <p className="text-[10px] md:text-[11px] font-mono font-bold uppercase tracking-[0.25em] text-[#FF7A00]">
                    California Sunset Edition
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsGameOpen(true)}
                className="w-full md:w-auto px-8 h-14 md:h-16 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-bold uppercase tracking-widest text-sm shadow-md transition-all flex items-center justify-center gap-3 active:scale-[0.98] shrink-0 border border-white/5 backdrop-blur-md relative z-10"
              >
                Запустить
              </button>
            </div>
          </div>

          {/* 5. THE GOLDEN TRIGGER */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-[64px] bg-gradient-to-r from-[#FF7A00] to-[#FFA011] hover:from-[#EA6A00] hover:to-[#FF7A00] text-white rounded-[2rem] font-bold uppercase tracking-widest text-sm shadow-[0_10px_30px_-5px_rgba(255,122,0,0.4)] transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-70"
            >
              {isSubmitting ? (
                 <motion.div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Сохранить настройки
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>

      {/* ─── PACIFIC RIDE OVERLAY ──────────────────────────────── */}
      {isGameOpen && <PacificRide onClose={() => setIsGameOpen(false)} />}
    </div>
  );
}