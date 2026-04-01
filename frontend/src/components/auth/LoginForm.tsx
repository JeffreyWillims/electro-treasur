import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
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
      toast.success('Добро пожаловать в Aura Wealth');
      navigate('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка входа';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden flex items-center justify-center">
      {/* 50% Mesh Gradient */}
      <div className="absolute top-0 -left-4 w-[400px] h-[400px] bg-emerald-300 rounded-full mix-blend-multiply filter blur-3xl opacity-60 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-[400px] h-[400px] bg-amber-300 rounded-full mix-blend-multiply filter blur-3xl opacity-60 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-[400px] h-[400px] bg-teal-300 rounded-full mix-blend-multiply filter blur-3xl opacity-60 animate-blob animation-delay-4000"></div>

      <motion.div
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: 0.15,
              delayChildren: 0.2,
            },
          },
        }}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md z-10"

      >
        <motion.div 
          variants={{
            hidden: { opacity: 0, y: 40 },
            visible: { opacity: 1, y: 0, transition: { duration: 1, ease: [0.22, 1, 0.36, 1] } }
          }}
          className="w-full flex flex-col items-center justify-center text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-900 rounded-full mb-6">
            <Wallet className="text-white w-6 h-6" />
            <span className="text-white font-bold text-lg tracking-widest">Aura Wealth</span>
          </div>
          <h1 className="text-3xl font-semibold text-emerald-800 tracking-tight">
            Вход в систему
          </h1>
        </motion.div>

        {/* Form Card */}
        <motion.div 
          variants={{
            hidden: { opacity: 0, y: 40 },
            visible: { opacity: 1, y: 0, transition: { duration: 1, ease: [0.22, 1, 0.36, 1] } }
          }}
          className="relative w-full max-w-md bg-white/60 backdrop-blur-2xl border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.05)] rounded-3xl p-10 z-10"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-5">

              <motion.div 
                variants={{
                  hidden: { opacity: 0, x: -20 },
                  visible: { opacity: 1, x: 0, transition: { duration: 0.8 } }
                }}
                className="group relative"
              >
                <label className="block mb-2 text-lg font-medium text-slate-900 dark:text-slate-100 transition-transform duration-500 group-focus-within:-translate-y-1">Email</label>
                <input
                  type="email"
                  required
                  className="input-aura"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </motion.div>
              <motion.div 
                variants={{
                  hidden: { opacity: 0, x: -20 },
                  visible: { opacity: 1, x: 0, transition: { duration: 0.8 } }
                }}
                className="group relative"
              >
                <label className="block mb-2 text-lg font-medium text-slate-900 dark:text-slate-100 transition-transform duration-500 group-focus-within:-translate-y-1">Пароль</label>
                <input
                  type="password"
                  required
                  className="input-aura"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </motion.div>
            </div>

            <motion.div
              variants={{
                hidden: { opacity: 0, scale: 0.95 },
                visible: { opacity: 1, scale: 1, transition: { duration: 0.8 } }
              }}
            >
              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full flex items-center justify-center gap-3"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <LogIn className="w-5 h-5" />
                )}
                <span className="text-base font-bold">{isSubmitting ? 'Аутентификация...' : 'Войти в аккаунт'}</span>

              </motion.button>
            </motion.div>
          </form>
        </motion.div>

        <motion.p 
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { delay: 1, duration: 1 } }
          }}
          className="text-center mt-12 text-sm text-aura-graphite-light/30 dark:text-aura-ivory/20"
        >
          Нет аккаунта?{' '}
          <Link
            to="/register"
            className="font-bold text-aura-graphite-light dark:text-aura-ivory hover:opacity-60 transition-opacity underline underline-offset-8 decoration-aura-graphite-light/10"
          >
            Создать аккаунт
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
