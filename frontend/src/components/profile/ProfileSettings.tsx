import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { updateMe } from '@/api/client';
import { toast } from 'sonner';
import { Loader2, Save, User, Users, Phone, Mail, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

export function ProfileSettings() {
  const { user, refreshUser } = useAuth();
  
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      toast.success('Профиль успешно обновлен', {
        className: 'font-serif tracking-tight',
        descriptionClassName: 'font-mono text-[10px] uppercase text-aura-gold'
      });
    } catch (err: any) {
      toast.error(err.message || 'Ошибка обновления', {
        className: 'font-serif tracking-tight'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-premium text-4xl mb-2 tracking-tighter">Предпочтения</h1>
          <p className="text-[10px] font-mono text-aura-gold uppercase tracking-[0.3em] font-bold">
            Безопасность и настройки
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sidebar Navigation (In-section) */}
        <div className="lg:col-span-1 space-y-2">
          <button className="w-full text-left px-5 py-4 rounded-2xl bg-aura-gold/[0.04] border border-aura-gold/10 text-aura-graphite dark:text-aura-ivory flex items-center gap-3">
            <User className="w-4 h-4 text-aura-gold" />
            <span className="text-sm font-semibold">Профиль</span>
          </button>
          <button className="w-full text-left px-5 py-4 rounded-xl text-aura-graphite/40 dark:text-aura-ivory/40 hover:bg-aura-gold/[0.02] flex items-center gap-3 transition-colors">
            <Users className="w-4 h-4" />
            <span className="text-sm font-semibold">Внешний вид</span>
          </button>
          <button className="w-full text-left px-5 py-4 rounded-xl text-aura-graphite/40 dark:text-aura-ivory/40 hover:bg-aura-gold/[0.02] flex items-center gap-3 transition-colors">
            <ShieldAlert className="w-4 h-4" />
            <span className="text-sm font-semibold">Безопасность</span>
          </button>
        </div>

        {/* Content Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="premium-card p-8 lg:p-10 space-y-10">
            {/* Header / Avatar info */}
            <div className="flex items-center gap-6 pb-8 border-b border-aura-gold/10">
              <div className="w-20 h-20 rounded-3xl bg-aura-emerald flex items-center justify-center text-white font-serif font-bold text-3xl shadow-glow-emerald">
                {user?.full_name?.charAt(0) || user?.email.charAt(0).toUpperCase() || 'A'}
              </div>
              <div>
                <h3 className="text-xl font-serif font-semibold text-aura-graphite dark:text-aura-ivory">
                  {user?.full_name || 'Инкогнито'}
                </h3>
                <p className="text-xs font-mono text-aura-gold/60 mt-1 uppercase tracking-widest">{user?.email}</p>
                <button type="button" className="text-[10px] font-mono uppercase tracking-[0.1em] text-aura-gold hover:text-aura-emerald mt-3 font-bold transition-colors">
                  Изменить фотографию
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-[10px] font-mono text-aura-gold/50 uppercase tracking-[0.2em] font-bold">Личные данные</h4>
              
              <div>
                <label className="label-aura flex items-center gap-2">
                  <User size={12} className="opacity-50" />
                  Полное Имя
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input-aura text-base py-3"
                  placeholder="Иван Иванов"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="label-aura flex items-center gap-2">
                    <Mail size={12} className="opacity-50" />
                    Email (Только чтение)
                  </label>
                  <input
                    type="email"
                    readOnly
                    value={user?.email || ''}
                    className="input-aura text-base py-3 opacity-60 cursor-not-allowed border-dashed bg-aura-graphite/[0.02] dark:bg-white/[0.02]"
                  />
                </div>
                <div>
                  <label className="label-aura flex items-center gap-2">
                    <Phone size={12} className="opacity-50" />
                    Телефон
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input-aura text-base py-3 font-mono"
                    placeholder="+7 (999) 000-00-00"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-[10px] font-mono text-aura-gold/50 uppercase tracking-[0.2em] font-bold">Финансы</h4>
              
              <div>
                <label className="label-aura">Базовый ежемесячный доход (₽)</label>
                <div className="relative group/input">
                  <input
                    type="number"
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(e.target.value)}
                    className="input-aura text-xl py-4 font-mono font-bold tracking-tight text-aura-emerald pl-12"
                    placeholder="250000"
                  />
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-aura-emerald/50 font-mono text-xl">₽</span>
                </div>
                <p className="text-[11px] text-aura-graphite/40 dark:text-aura-ivory/40 mt-3 leading-relaxed">
                  Используется алгоритмом <span className="font-semibold">Safe-to-Spend</span> для расчета ежедневной ликвидности.
                </p>
              </div>
            </div>

            <div className="pt-6 border-t border-aura-gold/10 flex items-center justify-end gap-4">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setFullName(user?.full_name || '');
                  setPhone(user?.phone || '');
                  setMonthlyIncome(user?.monthly_income?.toString() || '');
                }}
              >
                Отменить
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isSubmitting}
                className="btn-primary flex items-center gap-2 px-8 py-3.5 shadow-glow-emerald"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Сохранить изменения
                  </>
                )}
              </motion.button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
