import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, Loader2, Wallet } from 'lucide-react';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await login(email, password);
      toast.success('Добро пожаловать в Citrine Vault');
      navigate('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка входа';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FDFBF7] dark:bg-[#050505] relative overflow-hidden px-4">
      {/* Background atmosphere */}
      <div className="absolute -top-10 -right-20 w-[420px] h-[420px] bg-[#FF7A00]/40 rounded-full mix-blend-multiply filter blur-[100px] animate-blob z-0 pointer-events-none" />

      {/* THE GLASS MONOLITH */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[440px] z-10 rounded-[2.8rem] transition-all duration-700 group
          bg-gradient-to-br from-white/30 via-white/10 to-[#FF7A00]/5
          backdrop-blur-3xl backdrop-saturate-[180%]
          shadow-[inset_0_-20px_40px_-20px_rgba(255,122,0,0.15),inset_0_20px_40px_-20px_rgba(15,23,42,0.08),0_20px_60px_-12px_rgba(0,0,0,0.12)]
          hover:shadow-[inset_0_-30px_60px_-15px_rgba(255,180,100,0.22),inset_0_20px_40px_-20px_rgba(15,23,42,0.08),0_30px_70px_-10px_rgba(0,0,0,0.16)]
          dark:bg-gradient-to-br dark:from-[#1a1a1a]/60 dark:via-[#111]/30 dark:to-[#FF7A00]/5
          dark:shadow-[inset_0_-20px_40px_-20px_rgba(255,122,0,0.12),inset_0_20px_40px_-20px_rgba(15,23,42,0.2),0_20px_60px_-12px_rgba(0,0,0,0.5)]"
      >
        {/* ── Glowing Edges (Vision OS Style) ── */}
        <div className="absolute inset-0 rounded-[2.8rem] pointer-events-none p-[2px] z-50"
             style={{
               background: "linear-gradient(135deg, rgba(28,63,53,0.8) 0%, rgba(255,255,255,0.1) 50%, rgba(255,122,0,0.8) 100%)",
               WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
               WebkitMaskComposite: "xor",
               maskComposite: "exclude",
             }}>
        </div>
        {/* ── Brand Badge (3D Candy Gem) ── */}
        <div className="flex justify-center pt-8 pb-6 z-20 relative">
          <div className="inline-flex items-center justify-center gap-3 px-8 py-3 rounded-full transition-all duration-500
            bg-gradient-to-b from-[#FFA011]/95 to-[#FF7A00]/95
            backdrop-blur-xl backdrop-saturate-[150%]
            border border-white/40
            shadow-[inset_0_2px_4px_rgba(255,255,255,0.6),inset_0_-4px_10px_rgba(204,60,0,0.5),0_10px_30px_-5px_rgba(255,122,0,0.6)]"
          >
            <Wallet className="text-white w-6 h-6 drop-shadow-sm" strokeWidth={2.5} />
            <span className="text-white font-black text-xl tracking-tight drop-shadow-md">Citrine Vault</span>
          </div>
        </div>

        {/* ── Shared Tab Navigation (Quantum Toggle) ── */}
        <div className="px-8 pb-0 z-20 relative">
          <div className="relative flex items-center bg-slate-900/10 dark:bg-black/20 shadow-inner rounded-2xl p-1 mb-8">
              {/* Active tab indicator */}
              <motion.div
                layoutId="auth-tab-indicator"
                className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-xl bg-white/80 dark:bg-white/10 backdrop-blur-md shadow-sm"
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              />
              {/* Login tab — active */}
              <AnimatePresence mode="wait">
                <motion.span
                  key="login-active"
                  initial={{ opacity: 0.8 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0.8 }}
                  className="relative flex-1 py-2.5 text-center text-sm font-bold tracking-wide text-slate-900 dark:text-white z-10 cursor-default select-none"
                >
                  Вход
                </motion.span>
              </AnimatePresence>
              {/* Register tab */}
              <Link
                to="/register"
                className="relative flex-1 py-2.5 text-center text-sm font-semibold tracking-wide text-slate-500 dark:text-white/40 z-10 hover:text-slate-700 dark:hover:text-white/70 transition-colors"
              >
                Регистрация
              </Link>
            </div>
          </div>

          {/* ── Form Fields ── */}
          <div className="px-8 pb-10">
          <form onSubmit={handleSubmit} className="space-y-3">
            <AnimatePresence mode="wait">
              <motion.div
                key="login-fields"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}
                className="space-y-3"
              >
                <input
                  type="email"
                  required
                  autoComplete="email"
                  className="w-full h-13 px-5 py-3.5 text-base rounded-2xl outline-none transition-all duration-400
                    shadow-inner bg-white/40 dark:bg-white/5
                    border border-white/50 dark:border-white/10
                    text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500
                    focus:bg-white/70 dark:focus:bg-white/10 focus:border-white/80 focus:shadow-[0_0_20px_rgba(255,255,255,0.25)]"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  className="w-full h-13 px-5 py-3.5 text-base rounded-2xl outline-none transition-all duration-400
                    shadow-inner bg-white/40 dark:bg-white/5
                    border border-white/50 dark:border-white/10
                    text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500
                    focus:bg-white/70 dark:focus:bg-white/10 focus:border-white/80 focus:shadow-[0_0_20px_rgba(255,255,255,0.25)]"
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
                className="btn-primary w-full flex items-center justify-center gap-2.5 h-13 py-3.5"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                <span className="text-sm font-bold tracking-wide">
                  {isSubmitting ? 'Аутентификация...' : 'Войти в аккаунт'}
                </span>
              </motion.button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
