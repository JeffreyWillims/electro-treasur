/**
 * Sidebar — плавающая стеклянная навигация Citrine Vault.
 * Эстетика Apple Liquid Glass с раскладкой «плавающего острова».
 */
import {
  Wallet,
  Sun,
  Moon,
  Menu,
  X,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { NotificationBell } from '@/components/layout/NotificationBell';

// icon: 'avatar' — вместо эмодзи рендерится кружок с первой буквой имени
// пользователя (см. ветку в NavLink ниже); данные берутся из useAuth.
type NavItem = { name: string; path: string; emoji?: string; icon?: 'avatar' };

const NAV_ITEMS: NavItem[] = [
  { name: 'Обзор', path: '/', emoji: '🧭' },
  { name: 'Операции', path: '/transactions', emoji: '💳' },
  { name: 'Бюджеты', path: '/budgets', emoji: '📝' },
  { name: 'Аналитика', path: '/analytics', emoji: '📊' },
  { name: 'Финплан', path: '/savings-navigator', emoji: '🎯' },
  { name: 'Игры', path: '/games', emoji: '🎮' },
  { name: 'Профиль', path: '/settings/profile', icon: 'avatar' },
];

// Пункт виден только роли CONSULTANT — вставляется перед «Профилем».
const CONSULTANT_NAV_ITEM: NavItem = { name: 'Мои клиенты', path: '/consultant', emoji: '🤝' };

function ThemeToggle() {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <div
      className={cn("w-14 h-8 rounded-full flex items-center p-1 cursor-pointer transition-all duration-500 bg-black/10 dark:bg-black/40 shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)] border border-black/5 dark:border-white/5", isDarkMode ? 'justify-end' : 'justify-start')}
      onClick={toggleTheme}
    >
      <motion.div layout transition={{ type: "spring", stiffness: 700, damping: 30 }} className="w-6 h-6 bg-white dark:bg-[#121212] rounded-full shadow-md flex items-center justify-center">
        <AnimatePresence mode="wait">
          {isDarkMode ? (
            <motion.div
              key="moon"
              initial={{ rotate: -180, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 180, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Moon size={12} className="text-[#FF7A00]" />
            </motion.div>
          ) : (
            <motion.div
              key="sun"
              initial={{ rotate: 180, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -180, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Sun size={12} className="text-[#FF7A00]" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  // Единственный аватар приложения — пункт меню «Профиль» (кружок с буквой).
  const avatarInitial = user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'Q';
  const navItems =
    user?.role === 'consultant'
      ? NAV_ITEMS.flatMap((item) =>
          item.path === '/settings/profile' ? [CONSULTANT_NAV_ITEM, item] : [item]
        )
      : NAV_ITEMS;

  return (
    <>
      {/* Кнопка переключения на мобильном */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-[max(1rem,env(safe-area-inset-top))] left-[max(1rem,env(safe-area-inset-left))] z-50 p-2.5 rounded-xl bg-white/80 dark:bg-vault-black/80 backdrop-blur-xl border border-vault-pine/10 dark:border-white/10 shadow-card"
        aria-label="Открыть меню"
      >
        <Menu size={20} className="text-vault-pine dark:text-white" />
      </button>

      {/* Затемнение на мобильном */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Плавающий остров-сайдбар */}
      <aside
        className={cn(
          // z-50 на мобильном: меню должно быть выше оверлея (z-40), иначе оно
          // затемнено и не кликабельно; на десктопе достаточно z-10.
          "flex flex-col w-72 h-[calc(100vh-32px)] m-4 p-7 rounded-3xl z-50 lg:z-10",
          "bg-white/40 dark:bg-[#111111]/40",
          "backdrop-blur-3xl backdrop-saturate-150",
          "shadow-2xl",
          "transition-all duration-500",
          // Мобильная версия
          "fixed lg:relative",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* ── Glowing Edges (Vision OS Style) ── */}
        <div className="absolute inset-0 rounded-3xl pointer-events-none p-[2px] z-50"
          style={{
            background: "linear-gradient(160deg, rgba(28,63,53,0.8) 0%, rgba(255,255,255,0.05) 50%, rgba(255,122,0,0.8) 100%)",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}>
        </div>

        {/* Закрытие на мобильном */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden absolute top-4 right-4 p-1.5 rounded-lg hover:bg-[#FF7A00]/5 transition-colors"
        >
          <X size={18} className="text-[#FF7A00]/60" />
        </button>

        {/* Branding — Citrine Vault */}
        <div className="flex items-center gap-4 mb-14">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FF7A00] to-[#FFA011] flex items-center justify-center shadow-lg shadow-[#FF7A00]/20">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-sans text-xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-[#FF7A00] to-[#FFA011] bg-clip-text text-transparent">Citrine</span>
              {' '}
              <span className="text-vault-pine dark:text-white">Vault</span>
            </h1>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2 mt-4">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.path === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  'group w-full flex items-center gap-4 p-2 rounded-2xl relative transition-all duration-300',
                  isActive
                    ? 'bg-white/40 dark:bg-white/10 backdrop-blur-md shadow-sm'
                    : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative w-10 h-10 rounded-xl shrink-0">
                    {/* Вогнутая база (вдавленная лунка) */}
                    <div className={cn(
                      "absolute inset-0 rounded-xl transition-all duration-300",
                      "bg-black/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.8)] border border-black/5",
                      "dark:bg-black/40 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.5),0_1px_0_rgba(255,255,255,0.05)] dark:border-white/5"
                    )} />

                    {/* Эмодзи / аватар */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      {item.icon === 'avatar' ? (
                        <span className={cn(
                          "w-6 h-6 rounded-full bg-gradient-to-br from-[#FF7A00] to-[#FFA011] flex items-center justify-center text-white text-[11px] font-bold shadow-sm transition-all duration-300",
                          isActive ? "opacity-100 scale-110" : "opacity-50 grayscale-[50%] group-hover:grayscale-0 group-hover:opacity-100"
                        )}>
                          {avatarInitial}
                        </span>
                      ) : (
                        <span className={cn(
                          "text-xl transition-all duration-300 drop-shadow-sm",
                          isActive ? "opacity-100 scale-110" : "opacity-50 grayscale-[50%] hover:grayscale-0 hover:opacity-100"
                        )}>
                          {item.emoji}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="font-semibold text-[#1C3F35] dark:text-white tracking-tight text-base">
                    {item.name}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Компактный док внизу */}
        <div className="flex justify-between items-center w-full px-2 mt-auto pt-6 border-t border-[#FF7A00]/[0.06]">
          <ThemeToggle />
          <NotificationBell />
        </div>
      </aside>
    </>
  );
}
