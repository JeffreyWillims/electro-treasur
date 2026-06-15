import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { updateMe, generateTelegramOtp } from '@/api/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { PacificRide } from '@/components/ui/PacificRide';
import { Send, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

// Форматирование суммы с пробелами
const formatSum = (val: string | number): string => {
  if (!val) return '';
  const str = val.toString().replace(/\D/g, '');
  return str.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

const parseSum = (formatted: string): number => parseFloat(formatted.replace(/[^\d]/g, '')) || 0;

export function ProfileSettings() {
  const { user, refreshUser } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── PACIFIC RIDE EASTER EGG ──────────────────────────────
  const [clickCount, setClickCount] = useState(0);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
      setMonthlyIncome(user.monthly_income ? formatSum(user.monthly_income) : '');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await updateMe({
        full_name: fullName || null,
        phone: phone || null,
        monthly_income: monthlyIncome ? parseSum(monthlyIncome) : null,
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

  // 💎 Общие стили для блоков "настроек" (Glassmorphic iOS Style)
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
  const sectionHeaderStyles = "text-[11px] font-mono font-bold uppercase tracking-[0.25em] text-[#1C3F35]/50 dark:text-white/40 ml-6 mb-3";

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

          {/* 3. iOS SETTINGS LAYOUT - INCOME */}
          <div>
            <h2 className={sectionHeaderStyles}>
              Финансовые данные
            </h2>
            <div className={sectionContainerStyles}>
              <div className={rowStyles}>
                <label className={rowLabelStyles}>Базовый доход</label>
                <div className="flex items-baseline gap-2 justify-end w-full md:w-1/2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(formatSum(e.target.value))}
                    className="text-right bg-transparent outline-none w-full text-2xl md:text-3xl font-sans font-black tabular-nums tracking-tighter text-[#1C3F35] dark:text-white placeholder-[#1C3F35]/30 dark:placeholder-white/30"
                    placeholder="0"
                  />
                  <span className="text-sm md:text-base font-bold text-[#1C3F35] dark:text-white opacity-40 tracking-normal shrink-0">₽</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. TELEGRAM SYNC BLOCK */}
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

      {/* ─── CITRINE SIGIL (Easter Egg Trigger) ──────────────── */}
      <div className="flex justify-center mt-16 mb-4 relative z-10">
        <button
          type="button"
          onClick={() => setClickCount((c) => c + 1)}
          className="group flex flex-col items-center gap-1 cursor-default select-none focus:outline-none"
          aria-hidden="true"
          tabIndex={-1}
        >
          <svg
            viewBox="0 0 100 100"
            className="w-10 h-10 opacity-25 dark:opacity-30 group-hover:opacity-60 transition-all duration-500 drop-shadow-[0_0_6px_rgba(255,122,0,0)] group-hover:drop-shadow-[0_0_8px_rgba(255,122,0,0.5)]"
            fill="none"
            strokeWidth="3"
          >
            <circle cx="50" cy="50" r="30" stroke="#FF7A00" strokeOpacity="0.8" />
            <path d="M 50 10 L 50 90 M 10 50 L 90 50" stroke="#FF7A00" strokeOpacity="0.6" />
            <path d="M 28 28 L 72 72 M 28 72 L 72 28" stroke="#FF7A00" strokeOpacity="0.3" />
          </svg>
        </button>
      </div>

      {/* ─── PACIFIC RIDE OVERLAY ──────────────────────────────── */}
      {clickCount >= 3 && <PacificRide onClose={() => setClickCount(0)} />}
    </div>
  );
}