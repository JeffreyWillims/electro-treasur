/**
 * Sidebar — Citrine Vault floating glass navigation.
 * Apple Liquid Glass aesthetic with floating island layout.
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
import { useTheme } from '@/context/ThemeContext';

const NAV_ITEMS = [
  { name: 'Обзор', path: '/', icon: LayoutDashboard },
  { name: 'Операции', path: '/transactions', icon: List },
  { name: 'Бюджеты', path: '/budgets', icon: Target },
  { name: 'Аналитика', path: '/analytics', icon: PieChart },
  { name: 'Финплан', path: '/savings-navigator', icon: PiggyBank },
  { name: 'Настройки', path: '/settings/profile', icon: Settings },
];

function ThemeToggle() {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <div className="flex items-center justify-between px-3">
      <span className="text-[10.5px] font-mono uppercase tracking-[0.2em] text-[#1C3F35] dark:text-white/50 font-bold">
        Тема
      </span>
      <div 
        className={`flex w-14 h-8 bg-slate-200 dark:bg-slate-800 rounded-full p-1 cursor-pointer transition-colors duration-500 ${isDarkMode ? 'justify-end' : 'justify-start'}`} 
        onClick={toggleTheme}
      >
        <motion.div layout className="w-6 h-6 bg-white dark:bg-slate-950 rounded-full shadow-md flex items-center justify-center">
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
    </div>
  );
}

function UserProfileWidget() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    : user?.email?.charAt(0).toUpperCase() || 'C';

  const displayName = user?.full_name || user?.email?.split('@')[0] || 'Пользователь';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 text-left group",
          "bg-[#FF7A00]/[0.03] border border-[#FF7A00]/[0.06]",
          "hover:bg-[#FF7A00]/[0.06] hover:border-[#FF7A00]/10",
          isOpen && "bg-[#FF7A00]/[0.08] border-[#FF7A00]/15"
        )}
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF7A00] to-[#FFA011] flex items-center justify-center text-white font-bold text-sm shadow-sm">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-vault-pine dark:text-white leading-tight truncate">
            {displayName}
          </p>
          <p className="text-[10px] font-mono text-[#FF7A00]/50 truncate mt-0.5">
            {user?.email}
          </p>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <ChevronUp size={14} className="text-[#FF7A00]/40" />
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
            className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl overflow-hidden border border-[#FF7A00]/10 bg-white/90 dark:bg-vault-black/90 backdrop-blur-xl shadow-premium z-50"
          >
            <div className="p-2 space-y-0.5">
              <button
                onClick={() => { navigate('/settings/profile'); setIsOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-vault-pine dark:text-white hover:bg-[#FF7A00]/5 transition-colors"
              >
                <User size={16} className="text-[#FF7A00]/60" />
                <span>Профиль</span>
              </button>
              <button
                onClick={() => { navigate('/settings/profile'); setIsOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-vault-pine dark:text-white hover:bg-[#FF7A00]/5 transition-colors"
              >
                <Sliders size={16} className="text-[#FF7A00]/60" />
                <span>Предпочтения</span>
              </button>

              <div className="h-px bg-[#FF7A00]/10 mx-2 my-1" />

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
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 rounded-xl bg-white/80 dark:bg-vault-black/80 backdrop-blur-xl border border-vault-pine/10 dark:border-white/10 shadow-card"
        aria-label="Открыть меню"
      >
        <Menu size={20} className="text-vault-pine dark:text-white" />
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

      {/* Floating Island Sidebar */}
      <aside
        className={cn(
          "flex flex-col w-72 h-[calc(100vh-32px)] m-4 p-7 rounded-3xl z-10",
          "bg-white/40 dark:bg-[#111111]/40",
          "backdrop-blur-3xl backdrop-saturate-150",
          "border border-white/40 dark:border-white/10",
          "shadow-2xl",
          "transition-all duration-500",
          // Mobile
          "fixed lg:relative",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Mobile Close */}
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
                      ? 'text-[#1C3F35] dark:text-white'
                      : 'text-[#1C3F35]/70 dark:text-white/30 hover:text-[#1C3F35] dark:hover:text-white/60'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute inset-0 bg-[#FDFBF7] dark:bg-[#1A1A1A] border border-orange-200 dark:border-[#FF7A00]/20 rounded-xl -z-10 shadow-sm"
                        transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                      />
                    )}
                    <Icon
                      className={cn(
                        "w-[18.5px] h-[18.5px] transition-all duration-300",
                        isActive
                          ? "text-[#1C3F35] dark:text-white"
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
        <div className="mt-auto space-y-6 pt-6 border-t border-[#FF7A00]/[0.06]">
          <ThemeToggle />
          <UserProfileWidget />
        </div>
      </aside>
    </>
  );
}
