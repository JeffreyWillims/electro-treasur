import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Loader2, Wallet, Github, Eye, EyeOff } from 'lucide-react';

export function RegisterForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (password !== confirmPassword) {
      setPasswordError('⚠️ Пароли не совпадают');
      return;
    }
    if (password.length < 8) {
      setPasswordError('⚠️ Пароль слишком короткий — нужно не меньше 8 символов');
      return;
    }

    setIsSubmitting(true);
    try {
      await register({ email, password, full_name: fullName, phone: phone || '' });
      toast.success('Аккаунт Citrine Vault создан');
      navigate('/');
    } catch (err: unknown) {
      // TypeError от fetch = сеть/сервер недоступны; ApiError уже человекочитаем.
      const message =
        err instanceof TypeError
          ? 'Сервер недоступен. Проверьте соединение и попробуйте ещё раз.'
          : err instanceof Error
            ? err.message
            : 'Ошибка регистрации';
      setPasswordError(`⚠️ ${message}`);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'w-full h-13 px-5 py-3.5 text-base rounded-2xl outline-none transition-all duration-400 shadow-inner bg-white/40 dark:bg-white/5 border border-white/50 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white/70 dark:focus:bg-white/10 focus:border-white/80 focus:shadow-[0_0_20px_rgba(255,255,255,0.25)]';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FDFBF7] dark:bg-[#050505] relative overflow-hidden px-4 py-8">
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
                className="absolute inset-y-1 right-1 w-[calc(50%-4px)] rounded-xl bg-white/80 dark:bg-white/10 backdrop-blur-md shadow-sm"
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              />
              {/* Register tab — active */}
              <AnimatePresence mode="wait">
                <motion.span
                  key="register-active"
                  initial={{ opacity: 0.8 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0.8 }}
                  className="relative flex-1 py-2.5 text-center text-sm font-bold tracking-wide text-slate-900 dark:text-white z-10 cursor-default select-none"
                >
                  Регистрация
                </motion.span>
              </AnimatePresence>
            </div>
          </div>

          {/* ── Form Fields ── */}
          <div className="px-8 pb-10">
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
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className={inputClass + ' pr-12'}
                    placeholder="Пароль"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                    aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className={inputClass + ' pr-12' + (passwordError ? ' border-red-400/60 dark:border-red-500/40' : '')}
                    placeholder="Подтвердите пароль"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(''); }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                    aria-label={showConfirmPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-sm text-red-500 dark:text-orange-400 font-medium px-2 pt-1">
                    {passwordError}
                  </p>
                )}
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
          {/* ── SSO Divider ── */}
          <div className="relative flex items-center py-6 w-full">
            <div className="flex-grow border-t border-slate-200 dark:border-white/10"></div>
            <span className="flex-shrink-0 mx-4 text-xs font-medium text-slate-400 uppercase tracking-widest">Или продолжите через</span>
            <div className="flex-grow border-t border-slate-200 dark:border-white/10"></div>
          </div>

          {/* ── SSO Buttons ── */}
          <div className="flex justify-center gap-4 w-full mb-4">
            {/* Google */}
            <button
              type="button"
              onClick={() => toast.info('Social Sign-On', { description: 'Авторизация через сторонние сервисы будет активирована после релиза на основном домене.' })}
              className="w-14 h-14 rounded-2xl bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/10 flex items-center justify-center shadow-sm hover:shadow-md hover:-translate-y-1 hover:bg-white/80 dark:hover:bg-white/10 transition-all duration-300 cursor-pointer group"
              aria-label="Зарегистрироваться через Google"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </button>

            {/* GitHub */}
            <button
              type="button"
              onClick={() => toast.info('Social Sign-On', { description: 'Авторизация через сторонние сервисы будет активирована после релиза на основном домене.' })}
              className="w-14 h-14 rounded-2xl bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/10 flex items-center justify-center shadow-sm hover:shadow-md hover:-translate-y-1 hover:bg-white/80 dark:hover:bg-white/10 transition-all duration-300 cursor-pointer group"
              aria-label="Зарегистрироваться через GitHub"
            >
              <Github className="w-6 h-6 text-slate-800 dark:text-slate-200 group-hover:text-black dark:group-hover:text-white transition-colors" />
            </button>

            {/* Яндекс */}
            <button
              type="button"
              onClick={() => toast.info('Social Sign-On', { description: 'Авторизация через сторонние сервисы будет активирована после релиза на основном домене.' })}
              className="w-14 h-14 rounded-2xl bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/10 flex items-center justify-center shadow-sm hover:shadow-md hover:-translate-y-1 hover:bg-white/80 dark:hover:bg-white/10 transition-all duration-300 cursor-pointer group"
              aria-label="Зарегистрироваться через Яндекс"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M13.32 2H10.5C7.08 2 5 4.08 5 7.5c0 2.7 1.26 4.44 3.54 5.46L4.8 22h3.12l3.54-8.7H13v8.7h2.88V2h-2.56zm-.32 9.06h-1.44c-1.8 0-2.88-1.08-2.88-3.06 0-2.16 1.08-3.06 2.88-3.06H13v6.12z" fill="#FF0000"/>
              </svg>
            </button>
          </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
