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
        citrine: {
          50: '#FFF8F0',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#FF7A00',
          600: '#EA6A00',
          700: '#C2570A',
          800: '#9A3C12',
          900: '#7C2D12',
        },
        vault: {
          cream: '#FDFBF7',
          pine: '#1C3F35',
          'pine-light': '#2A5A47',
          graphite: '#1A1A1A',
          black: '#050505',
          'card-dark': '#111111',
        },
        // Legacy aliases for gradual migration
        aura: {
          ivory: '#FDFBF7',
          graphite: '#121212',
          'graphite-light': '#1A1A1A',
          emerald: '#1C3F35',
          'emerald-light': '#2A5A47',
          gold: '#FF7A00',
          'gold-light': '#FFA011',
          ash: '#F0F0F0',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#FDFBF7',
          subtle: '#FAF8F3',
          border: '#E8E3D9',
        },
        income: '#1C3F35',
        expense: '#C0392B',
        brand: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#FF7A00',
          600: '#EA6A00',
          700: '#C2570A',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Inter"', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', '"Cormorant Garamond"', 'Georgia', 'serif'],
        mono: ['"SF Mono"', '"Space Mono"', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.03), 0 1px 2px -1px rgb(0 0 0 / 0.03)',
        'elevated': '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.03)',
        'glow': '0 0 30px rgba(255, 122, 0, 0.08)',
        'glow-citrine': '0 0 30px rgba(255, 122, 0, 0.12)',
        'glow-emerald': '0 0 30px rgb(28 63 53 / 0.08)',
        'premium': '0 8px 30px rgb(0 0 0 / 0.06)',
        'editorial': '0 20px 50px rgba(0,0,0,0.05)',
        'soft-lift': '0 20px 40px rgba(28,63,53,0.08)',
        'dark-glow': '0 10px 30px rgba(255,122,0,0.15)',
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
