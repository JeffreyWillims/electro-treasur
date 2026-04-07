import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Loader2, Wallet } from 'lucide-react';

export function RegisterForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await register({ email, password, full_name: fullName, phone: phone || '' });
      toast.success('Аккаунт Citrine Vault создан');
      navigate('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка регистрации';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'w-full h-13 px-5 py-3.5 text-base rounded-2xl outline-none transition-all duration-400 shadow-inner bg-white/40 dark:bg-white/5 border border-white/50 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white/70 dark:focus:bg-white/10 focus:border-white/80 focus:shadow-[0_0_20px_rgba(255,255,255,0.25)]';

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7] dark:bg-[#050505] relative overflow-hidden px-4 py-8">
      {/* Background atmosphere */}
      <div className="absolute left-0 -top-[10%] h-[120%] w-48 bg-[#3A8248]/50 filter blur-[80px] animate-liquid-pillar pointer-events-none z-0" />
      <div className="absolute -top-10 -right-20 w-[420px] h-[420px] bg-[#FF7A00]/40 rounded-full mix-blend-multiply filter blur-[100px] animate-blob z-0 pointer-events-none" />

      {/* THE GLASS MONOLITH */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[440px] z-10 rounded-[2.8rem] transition-all duration-700 group
          bg-gradient-to-br from-white/30 via-white/10 to-[#FF7A00]/5
          backdrop-blur-3xl backdrop-saturate-[180%] border border-white/40
          shadow-[inset_0_-20px_40px_-20px_rgba(255,122,0,0.15),inset_0_20px_40px_-20px_rgba(15,23,42,0.08),0_20px_60px_-12px_rgba(0,0,0,0.12)]
          hover:shadow-[inset_0_-30px_60px_-15px_rgba(255,180,100,0.22),inset_0_20px_40px_-20px_rgba(15,23,42,0.08),0_30px_70px_-10px_rgba(0,0,0,0.16)]
          dark:bg-gradient-to-br dark:from-[#1a1a1a]/60 dark:via-[#111]/30 dark:to-[#FF7A00]/5
          dark:border-white/10 dark:shadow-[inset_0_-20px_40px_-20px_rgba(255,122,0,0.12),inset_0_20px_40px_-20px_rgba(15,23,42,0.2),0_20px_60px_-12px_rgba(0,0,0,0.5)]"
      >
        {/* ── Brand Badge ── */}
        <div className="flex justify-center pt-10 pb-0">
          <div className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-[#FF7A00] to-[#FFA011] rounded-full shadow-lg shadow-[#FF7A00]/25">
            <Wallet className="text-white w-4 h-4" />
            <span className="text-white font-extrabold text-base tracking-widest">CITRINE VAULT</span>
          </div>
        </div>

        {/* ── Shared Tab Navigation ── */}
        <div className="px-8 pt-6 pb-0">
          <div className="relative flex items-center bg-black/5 dark:bg-white/5 rounded-2xl p-1">
            {/* Login tab */}
            <Link
              to="/login"
              className="relative flex-1 py-2.5 text-center text-sm font-semibold tracking-wide text-slate-500 dark:text-white/40 z-10 hover:text-slate-700 dark:hover:text-white/70 transition-colors"
            >
              Вход
            </Link>
            {/* Active tab indicator */}
            <motion.div
              layoutId="auth-tab-indicator"
              className="absolute inset-y-1 right-1 w-[calc(50%-4px)] rounded-xl bg-white dark:bg-white/10 shadow-sm"
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            />
            {/* Register tab — active */}
            <span className="relative flex-1 py-2.5 text-center text-sm font-bold tracking-wide text-slate-900 dark:text-white z-10 cursor-default select-none">
              Регистрация
            </span>
          </div>
        </div>

        {/* ── Form Fields ── */}
        <div className="px-8 pt-6 pb-10">
          <form onSubmit={handleSubmit} className="space-y-3">
            <AnimatePresence mode="wait">
              <motion.div
                key="register-fields"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}
                className="space-y-3"
              >
                <input
                  type="text"
                  required
                  className={inputClass}
                  placeholder="Полное имя"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  className={inputClass}
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <div className="relative flex items-center w-full px-5 py-3.5 rounded-2xl transition-all duration-400 shadow-inner bg-white/40 dark:bg-white/5 border border-white/50 dark:border-white/10 focus-within:bg-white/70 dark:focus-within:bg-white/10 focus-within:border-white/80 focus-within:shadow-[0_0_20px_rgba(255,255,255,0.25)] overflow-hidden">
                  <span className="text-slate-400 dark:text-slate-500 font-medium text-base pointer-events-none mr-2 shrink-0">+</span>
                  <input
                    type="tel"
                    placeholder="Телефон"
                    className="w-full h-full bg-transparent outline-none text-slate-900 dark:text-white text-base placeholder-slate-400 dark:placeholder-slate-500"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className={inputClass}
                  placeholder="Пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </motion.div>
            </AnimatePresence>

            {/* ── CTA Button ── */}
            <div className="pt-2">
              <motion.button
                whileHover={{ scale: 1.015, y: -1 }}
                whileTap={{ scale: 0.985 }}
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full flex items-center justify-center gap-2.5 h-13 py-3.5 mt-2"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                <span className="text-sm font-bold tracking-wide">
                  {isSubmitting ? 'Создание...' : 'Зарегистрироваться'}
                </span>
              </motion.button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
