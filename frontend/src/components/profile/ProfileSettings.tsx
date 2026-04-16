import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { updateMe } from '@/api/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export function ProfileSettings() {
  const { user, refreshUser } = useAuth();
  
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      toast.success('Настройки успешно синхронизированы', {
        className: 'font-serif tracking-tight',
        descriptionClassName: 'font-mono text-[10px] uppercase text-[#FF7A00]'
      });
    } catch (err: any) {
      setIsSubmitting(false);
      toast.error(err.message || 'Ошибка синхронизации', {
        className: 'font-serif tracking-tight'
      });
    }
  };

  return (
    <div className="w-full pt-16 pb-24 px-4 sm:px-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.6 }}
        className="max-w-3xl mx-auto w-full p-8 md:p-12 rounded-[2.5rem] bg-white/40 dark:bg-[#121212]/60 backdrop-blur-3xl backdrop-saturate-[180%] border border-white/60 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.05)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] relative"
      >
        
        {/* 2. THE AVATAR PLINTH */}
        <div className="flex justify-center -mt-24 mb-6">
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#1C3F35] to-[#0A1A12] dark:from-[#050505] dark:to-[#111111] flex items-center justify-center text-4xl text-white font-serif font-black shadow-[0_15px_35px_-5px_rgba(28,63,53,0.5)] border-4 border-white/80 dark:border-white/10">
            {user?.full_name?.charAt(0) || user?.email.charAt(0).toUpperCase() || 'A'}
          </div>
        </div>

        <h1 className="text-4xl font-serif font-bold text-center mb-10 text-slate-900 dark:text-white tracking-tight">
          {user?.full_name || 'Инкогнито'}
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col space-y-10">
          
          {/* 3. iOS SETTINGS LAYOUT - PERSONAL */}
          <div className="space-y-3">
            <h2 className="text-[10px] font-bold font-mono uppercase tracking-widest text-slate-400 ml-4">
              Личные данные
            </h2>
            <div className="bg-white/50 dark:bg-white/5 rounded-3xl overflow-hidden flex flex-col border border-white/40 dark:border-white/5 shadow-sm">
              
              <div className="flex justify-between items-center p-6 border-b border-white/40 dark:border-white/5 last:border-0 hover:bg-white/30 dark:hover:bg-white/5 transition-colors">
                <label className="text-base font-medium text-slate-500 dark:text-slate-400">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="text-right bg-transparent outline-none w-1/2 text-xl font-mono font-bold text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-700"
                  placeholder="Иван"
                />
              </div>

              <div className="flex justify-between items-center p-6 border-b border-white/40 dark:border-white/5 last:border-0 hover:bg-white/30 dark:hover:bg-white/5 transition-colors">
                <label className="text-base font-medium text-slate-500 dark:text-slate-400">Email Config</label>
                <input
                  type="email"
                  readOnly
                  value={user?.email || ''}
                  className="text-right bg-transparent outline-none w-1/2 text-xl font-mono font-bold text-slate-900/50 dark:text-white/50 cursor-not-allowed"
                />
              </div>

              <div className="flex justify-between items-center p-6 border-b border-white/40 dark:border-white/5 last:border-0 hover:bg-white/30 dark:hover:bg-white/5 transition-colors">
                <label className="text-base font-medium text-slate-500 dark:text-slate-400">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="text-right bg-transparent outline-none w-1/2 text-xl font-mono font-bold text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-700"
                  placeholder="+7 (000) 000-00-00"
                />
              </div>

            </div>
          </div>

          {/* 3. iOS SETTINGS LAYOUT - INCOME */}
          <div className="space-y-3">
            <h2 className="text-[10px] font-bold font-mono uppercase tracking-widest text-slate-400 ml-4">
              Финансовые данные
            </h2>
            <div className="bg-white/50 dark:bg-white/5 rounded-3xl overflow-hidden flex flex-col border border-white/40 dark:border-white/5 shadow-sm">
              
              <div className="flex justify-between items-center p-6 border-b border-white/40 dark:border-white/5 last:border-0 hover:bg-white/30 dark:hover:bg-white/5 transition-colors">
                <label className="text-base font-medium text-slate-500 dark:text-slate-400">Базовый доход (₽)</label>
                <input
                  type="number"
                  value={monthlyIncome}
                  onChange={(e) => setMonthlyIncome(e.target.value)}
                  className="text-right bg-transparent outline-none w-1/2 text-xl font-mono font-bold text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-700"
                  placeholder="0"
                />
              </div>
              
            </div>
          </div>

          {/* 4. THE GOLDEN TRIGGER */}
          <div className="pt-6">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full h-16 rounded-2xl bg-gradient-to-r from-[#FF7A00] to-[#FFA011] text-white text-lg font-bold tracking-wide shadow-[0_10px_30px_-5px_rgba(255,122,0,0.4)] transition-all ${
                isSubmitting ? 'animate-pulse opacity-90' : 'hover:shadow-[0_15px_40px_-5px_rgba(255,122,0,0.6)] hover:scale-[1.02]'
              }`}
            >
              {isSubmitting ? 'Синхронизация...' : 'Сохранить монолит'}
            </button>
          </div>

        </form>
      </motion.div>
    </div>
  );
}
