/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark felt table
        felt: {
          DEFAULT: '#1a4731',
          dark: '#0f2d1e',
          light: '#235c3f',
        },
        gold: {
          DEFAULT: '#f5c518',
          dark: '#b8860b',
          light: '#fde68a',
        },
        card: {
          bg: '#fafaf8',
          border: '#d1d5db',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 4px 12px rgba(0,0,0,0.4)',
        'card-hover': '0 8px 24px rgba(0,0,0,0.6)',
        glow: '0 0 16px rgba(245,197,24,0.4)',
      },
      screens: {
        // Mobile-first breakpoints
        xs: '375px',
      },
    },
  },
  plugins: [],
}
