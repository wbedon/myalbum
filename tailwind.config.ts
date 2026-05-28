import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Paleta Mundial 2026 + colores de las 3 sedes anfitrionas
        mundial: {
          green: '#0F8F4F',
          'green-dark': '#0A6B3B',
          turquoise: '#3FBDB5',
          red: '#C8302A',
          'red-dark': '#9F231E',
          yellow: '#F5C42E',
          'yellow-dark': '#D4A516',
          purple: '#3D2761',
          'purple-dark': '#2A1A45',
          cream: '#FAF4E0',
          // Tonos oscuros para hero cinematic
          navy: '#0A2540',
          'navy-deep': '#061629',
        },
        // Colores oficiales de las banderas anfitrionas
        host: {
          'usa-red': '#B22234',
          'usa-blue': '#3C3B6E',
          'mex-green': '#006847',
          'mex-red': '#CE1126',
          'can-red': '#FF0000',
        },
      },
      fontFamily: {
        display: ['var(--font-anton)', 'Impact', 'Arial Black', 'sans-serif'],
        condensed: ['var(--font-saira)', 'Impact', 'sans-serif'],
      },
      keyframes: {
        'float-up': {
          '0%': { transform: 'translateY(0) translateX(0)', opacity: '0' },
          '20%': { opacity: '0.8' },
          '100%': { transform: 'translateY(-100vh) translateX(20px)', opacity: '0' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slow-zoom': {
          '0%, 100%': { transform: 'scale(1.05)' },
          '50%': { transform: 'scale(1.12)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'scale(0.97) translateY(6px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
      },
      animation: {
        'float-up': 'float-up 12s linear infinite',
        'pulse-glow': 'pulse-glow 4s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'fade-up': 'fade-up 700ms ease-out both',
        'scale-in': 'scale-in 800ms ease-out both',
        'slow-zoom': 'slow-zoom 20s ease-in-out infinite',
        'fade-in': 'fade-in 200ms ease-out both',
      },
    },
  },
  plugins: [],
}

export default config
