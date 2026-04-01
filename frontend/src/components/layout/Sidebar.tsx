/**
 * Sidebar — Swiss Editorial Luxury navigation.
 * Features: Animated active indicator, user profile widget with dropdown,
 * premium dark/light theme toggle with framer-motion sun/moon animation.
 */
import {
  LayoutDashboard,
  Wallet,
  PieChart,
  Settings,
  List,
  Target,
  PiggyBank,
  LogOut,
  User,
  Sliders,
  Sun,
  Moon,
  ChevronUp,
  Menu,
  X,
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const NAV_ITEMS = [
  { name: 'Обзор', path: '/', icon: LayoutDashboard },
  { name: 'Операции', path: '/transactions', icon: List },
  { name: 'Бюджеты', path: '/budgets', icon: Target },
  { name: 'Аналитика', path: '/analytics', icon: PieChart },
  { name: 'Финплан', path: '/savings-navigator', icon: PiggyBank },
  { name: 'Настройки', path: '/settings/profile', icon: Settings },
];

function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') ||
        localStorage.getItem('theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    // Add transitioning class for smooth theme change
    document.documentElement.classList.add('transitioning');

    if (isDark) {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    }

    // Remove transitioning class after animation completes
    const timer = setTimeout(() => {
      document.documentElement.classList.remove('transitioning');
    }, 600);
    return () => clearTimeout(timer);
  }, [isDark]);

  return (
    <div className="flex items-center justify-between px-3">
      <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-aura-gold/40 font-bold">
        Тема
      </span>
      <button
        onClick={() => setIsDark(!isDark)}
        className="w-14 h-7 rounded-full bg-aura-gold/10 dark:bg-white/5 relative p-1 flex items-center border border-aura-gold/10 hover:border-aura-gold/20 transition-colors"
        aria-label="Переключить тему"
      >
        <motion.div
          animate={{ x: isDark ? 26 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="w-5 h-5 rounded-full bg-aura-gold flex items-center justify-center shadow-lg"
        >
          <AnimatePresence mode="wait">
            {isDark ? (
              <motion.div
                key="moon"
                initial={{ scale: 0, rotate: -180, y: 10 }}
                animate={{ scale: 1, rotate: 0, y: 0 }}
                exit={{ scale: 0, rotate: 180, y: -10 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                <Moon size={11} className="text-aura-graphite" />
              </motion.div>
            ) : (
              <motion.div
                key="sun"
                initial={{ scale: 0, rotate: 180, y: -10 }}
                animate={{ scale: 1, rotate: 0, y: 0 }}
                exit={{ scale: 0, rotate: -180, y: 10 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                <Sun size={11} className="text-aura-graphite" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </button>
    </div>
  );
}

function UserProfileWidget() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.charAt(0).toUpperCase() || 'A';

  const displayName = user?.full_name || user?.email?.split('@')[0] || 'Пользователь';

  return (
    <div className="relative" ref={menuRef}>
      {/* Profile Card (trigger) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 text-left group",
          "bg-aura-gold/[0.03] border border-aura-gold/[0.06]",
          "hover:bg-aura-gold/[0.06] hover:border-aura-gold/10",
          isOpen && "bg-aura-gold/[0.08] border-aura-gold/15"
        )}
      >
        <div className="w-10 h-10 rounded-xl bg-aura-emerald/90 flex items-center justify-center text-white font-serif font-bold text-sm shadow-sm">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-aura-graphite dark:text-aura-ivory leading-tight truncate">
            {displayName}
          </p>
          <p className="text-[10px] font-mono text-aura-gold/50 truncate mt-0.5">
            {user?.email}
          </p>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <ChevronUp size={14} className="text-aura-gold/40" />
        </motion.div>
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl overflow-hidden border border-aura-gold/10 bg-white dark:bg-aura-graphite shadow-premium z-50"
          >
            <div className="p-2 space-y-0.5">
              <button
                onClick={() => { navigate('/settings/profile'); setIsOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-aura-graphite dark:text-aura-ivory hover:bg-aura-gold/5 transition-colors"
              >
                <User size={16} className="text-aura-gold/60" />
                <span>Профиль</span>
              </button>
              <button
                onClick={() => { navigate('/settings/profile'); setIsOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-aura-graphite dark:text-aura-ivory hover:bg-aura-gold/5 transition-colors"
              >
                <Sliders size={16} className="text-aura-gold/60" />
                <span>Предпочтения</span>
              </button>

              <div className="h-px bg-aura-gold/10 mx-2 my-1" />

              <button
                onClick={() => { logout(); setIsOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-rose-500 hover:bg-rose-500/5 transition-colors"
              >
                <LogOut size={16} />
                <span>Выйти</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 rounded-xl bg-white dark:bg-aura-graphite border border-aura-gold/10 shadow-card"
        aria-label="Открыть меню"
      >
        <Menu size={20} className="text-aura-graphite dark:text-aura-ivory" />
      </button>

      {/* Mobile Overlay */}
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

      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col w-72 min-h-screen p-7 transition-all duration-500 border-r z-50",
          "bg-aura-ivory dark:bg-aura-graphite border-aura-gold/[0.06]",
          // Mobile
          "fixed lg:relative",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Mobile Close */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden absolute top-4 right-4 p-1.5 rounded-lg hover:bg-aura-gold/5 transition-colors"
        >
          <X size={18} className="text-aura-gold/60" />
        </button>

        {/* Branding */}
        <div className="flex items-center gap-4 mb-14">
          <div className="w-11 h-11 rounded-2xl bg-aura-emerald flex items-center justify-center shadow-glow-emerald">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-serif text-xl font-bold tracking-tight text-aura-graphite dark:text-aura-ivory">
              Aura <span className="text-aura-gold">Wealth</span>
            </h1>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                end={item.path === '/'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'group w-full flex items-center gap-4 px-4 py-3 rounded-xl text-[13px] font-medium transition-all duration-300 relative overflow-hidden',
                    isActive
                      ? 'text-aura-emerald dark:text-aura-gold'
                      : 'text-aura-graphite/40 dark:text-aura-ivory/30 hover:text-aura-graphite/70 dark:hover:text-aura-ivory/60'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute inset-0 bg-aura-emerald/[0.04] dark:bg-aura-gold/[0.04] border border-aura-emerald/[0.08] dark:border-aura-gold/[0.06] rounded-xl -z-10"
                        transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                      />
                    )}
                    <Icon
                      className={cn(
                        "w-[18px] h-[18px] transition-all duration-300",
                        isActive
                          ? "text-aura-emerald dark:text-aura-gold"
                          : "group-hover:scale-105"
                      )}
                    />
                    <span className={cn(isActive ? "font-semibold" : "")}>
                      {item.name}
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="mt-auto space-y-6 pt-6 border-t border-aura-gold/[0.06]">
          <ThemeToggle />
          <UserProfileWidget />
        </div>
      </aside>
    </>
  );
}
