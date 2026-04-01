/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aura: {
          ivory: '#F9F9F6',
          graphite: '#121212',
          'graphite-light': '#1A1A1A',
          emerald: '#2A6041',
          'emerald-light': '#3A7A57',
          gold: '#C5A059',
          'gold-light': '#D4B46E',
          ash: '#F0F0F0',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#FAFAF7',
          subtle: '#F5F5F0',
          border: '#E8E6E1',
        },
        income: '#2A6041',
        expense: '#C0392B',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Playfair Display"', '"Cormorant Garamond"', 'Georgia', 'serif'],
        mono: ['"Space Mono"', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.03), 0 1px 2px -1px rgb(0 0 0 / 0.03)',
        'elevated': '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.03)',
        'glow': '0 0 30px rgb(197 160 89 / 0.08)',
        'glow-emerald': '0 0 30px rgb(42 96 65 / 0.08)',
        'premium': '0 8px 30px rgb(0 0 0 / 0.06)',
        'editorial': '0 20px 50px rgba(0,0,0,0.05)',
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.4s ease-out',
        'shimmer': 'shimmer 2s infinite linear',
        'scale-in': 'scaleIn 0.3s ease-out',
        'blob': 'blob 10s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        blob: {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(30px, -50px) scale(1.1)" },
          "66%": { transform: "translate(-20px, 20px) scale(0.9)" },
          "100%": { transform: "translate(0px, 0px) scale(1)" }
        },
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
    },
  },
  plugins: [],
}
