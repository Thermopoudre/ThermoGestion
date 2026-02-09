import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './site-vitrine/**/*.html',
  ],
  theme: {
    extend: {
      colors: {
        // Palette thermolaquage - Orange/Rouge chaleur four
        primary: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316', // Orange principal
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        // Accent rouge cuisson
        accent: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444', // Rouge
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        // Jaune pour contraste (finitions, succès)
        heat: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
        },
      },
      backgroundImage: {
        'gradient-heat': 'linear-gradient(135deg, #f97316 0%, #dc2626 100%)',
        'gradient-warm': 'linear-gradient(135deg, #fdba74 0%, #f97316 50%, #dc2626 100%)',
      },
      animation: {
        'pulse-warm': 'pulse-warm 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-warm': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
export default config
