import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { updateMe } from '@/api/client';
import { toast } from 'sonner';
import { User, Phone, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function ProfileSettings() {
  const { user, refreshUser } = useAuth();
  
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccessAnim, setIsSuccessAnim] = useState(false);

  // Sync state when user loads
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
      setMonthlyIncome(user.monthly_income?.toString() || '');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await updateMe({
        full_name: fullName || null,
        phone: phone || null,
        monthly_income: monthlyIncome ? parseFloat(monthlyIncome) : null,
      });
      await refreshUser();
      
      setIsSubmitting(false);
      setIsSuccessAnim(true);
      setTimeout(() => {
        setIsSuccessAnim(false);
        toast.success('Профиль успешно обновлен', {
          className: 'font-serif tracking-tight',
          descriptionClassName: 'font-mono text-[10px] uppercase text-[#FF7A00]'
        });
      }, 2000);
    } catch (err: any) {
      setIsSubmitting(false);
      toast.error(err.message || 'Ошибка обновления', {
        className: 'font-serif tracking-tight'
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-16 pb-20">
      <div className="border-b border-slate-100/50 dark:border-white/5 pb-12">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-3xl bg-[#1C3F35] dark:bg-emerald-500 flex items-center justify-center text-[#FDFBF7] font-serif font-bold text-4xl shadow-[0_0_30px_rgba(28,63,53,0.3)]">
            {user?.full_name?.charAt(0) || user?.email.charAt(0).toUpperCase() || 'A'}
          </div>
          <div>
            <h1 className="text-4xl font-serif text-[#1C3F35] dark:text-[#FDFBF7] font-bold tracking-tight">
              {user?.full_name || 'Инкогнито'}
            </h1>
            <p className="text-sm font-mono text-[#FF7A00]/70 mt-2 uppercase tracking-widest font-bold">V.I.A. Идентификатор</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col space-y-16">
        
        {/* SECTION: Личные данные */}
        <section className="space-y-10">
          <h2 className="font-serif text-4xl text-[#1C3F35] dark:text-[#FDFBF7] mb-12">Личные данные</h2>
          
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-widest text-[#1C3F35]/40 dark:text-[#FDFBF7]/40 mb-1">
              <User size={14} /> Полное Имя
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full text-2xl font-mono font-bold py-3 bg-transparent border-0 border-b border-slate-200 dark:border-white/10 outline-none transition-all focus:border-emerald-900 dark:focus:border-emerald-400 focus:ring-0 text-[#1C3F35] dark:text-white"
              placeholder="Иван Иванов"
            />
          </div>

          <div className="space-y-2">
             <label className="flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-widest text-[#1C3F35]/40 dark:text-[#FDFBF7]/40 mb-1">
              <Mail size={14} /> Email (Только чтение)
            </label>
            <input
              type="email"
              readOnly
              value={user?.email || ''}
              className="w-full text-2xl font-mono font-bold py-3 bg-transparent border-0 border-b border-slate-200/50 dark:border-white/5 outline-none text-[#1C3F35]/50 dark:text-white/50 cursor-not-allowed"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-widest text-[#1C3F35]/40 dark:text-[#FDFBF7]/40 mb-1">
              <Phone size={14} /> Телефон
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full text-2xl font-mono font-bold py-3 bg-transparent border-0 border-b border-slate-200 dark:border-white/10 outline-none transition-all focus:border-emerald-900 dark:focus:border-emerald-400 focus:ring-0 text-[#1C3F35] dark:text-white"
              placeholder="+7 (999) 000-00-00"
            />
          </div>
        </section>

        <div className="w-full h-px bg-slate-100/50 dark:bg-white/5" />

        {/* SECTION: Настройки дохода */}
        <section className="space-y-10">
          <h2 className="font-serif text-4xl text-[#1C3F35] dark:text-[#FDFBF7] mb-12">Настройки дохода</h2>
          
          <div className="space-y-2">
            <label className="text-xs font-bold font-mono uppercase tracking-widest text-[#1C3F35]/40 dark:text-[#FDFBF7]/40 mb-1 block">
              Базовый ежемесячный доход (₽)
            </label>
            <div className="relative flex items-center">
              <span className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-500 mr-3">₽</span>
              <input
                type="number"
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(e.target.value)}
                className="w-full text-2xl font-mono font-bold py-3 bg-transparent border-0 border-b border-slate-200 dark:border-white/10 outline-none transition-all focus:border-emerald-900 dark:focus:border-emerald-400 focus:ring-0 text-[#1C3F35] dark:text-white"
                placeholder="250000"
              />
            </div>
            <p className="text-xs text-[#1C3F35]/50 dark:text-white/40 mt-4 leading-relaxed font-medium">
              Используется алгоритмом <span className="text-[#FF7A00] font-bold">Safe-to-Spend</span> для расчета ежедневной ликвидности.
            </p>
          </div>
        </section>

        <div className="pt-10 flex justify-end relative h-[60px]">
          <AnimatePresence mode="wait">
            {!isSubmitting && !isSuccessAnim ? (
              <motion.button
                key="idle"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="w-full sm:w-auto absolute right-0 inset-y-0 bg-[#1C3F35] hover:bg-[#153028] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white px-12 rounded-2xl font-bold transition-all duration-300 shadow-xl shadow-[#1C3F35]/20 flex items-center justify-center gap-2 tracking-wide uppercase text-xs"
              >
                Сохранить профиль
              </motion.button>
            ) : isSubmitting ? (
              <motion.div
                key="pending"
                initial={{ height: 60, width: "100%", borderRadius: 16 }}
                animate={{ height: 4, width: "80%", borderRadius: 2 }}
                exit={{ opacity: 0 }}
                className="bg-[#1C3F35]/20 dark:bg-emerald-500/20 absolute right-0 top-1/2 -translate-y-1/2 flex items-center shadow-inner overflow-hidden"
              >
                <motion.div
                  className="w-4 h-4 bg-[#1C3F35] dark:bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(28,63,53,0.8)] absolute"
                  animate={{ left: ["0%", "calc(100% - 16px)", "0%"] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                />
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ height: 4, width: "80%", borderRadius: 2, backgroundColor: "rgba(28,63,53,0.2)" }}
                animate={{ 
                  height: 4, 
                  width: "100%", 
                  backgroundColor: "#FF7A00", 
                  boxShadow: "0 0 20px rgba(255,122,0,0.5)" 
                }}
                exit={{ height: 60, width: "100%", opacity: 0 }}
                className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center overflow-hidden"
              >
                <motion.div
                  className="w-4 h-4 bg-white rounded-full shadow-[0_0_10px_white] absolute"
                  initial={{ left: "0%" }}
                  animate={{ left: "calc(100% - 16px)" }}
                  transition={{ duration: 0.4, type: "spring", stiffness: 100, damping: 10 }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </form>
    </div>
  );
}
