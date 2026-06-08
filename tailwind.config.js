/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        // Clubhouse display serif for headings, brand, and leaderboard numerals.
        display: ['Fraunces', 'Georgia', 'ui-serif', 'serif'],
      },
      // "Augusta / clubhouse" theme. We remap the three scales the app leans on
      // so existing utility classes (bg-slate-50, text-emerald-600, amber-*)
      // adopt the new palette everywhere with no component changes:
      //   slate   -> warm parchment (light) deepening to night-fairway charcoal
      //   emerald -> fairway green (primary accent / positive)
      //   green   -> aliased to fairway so stray green-* utilities match
      //   amber   -> antique gold (leaders / winners / highlights)
      colors: {
        slate: {
          50:  '#f7f5ee',
          100: '#efece0',
          200: '#e1dcca',
          300: '#cdc7b0',
          400: '#a8a28c',
          500: '#7e7b68',
          600: '#5b5f4f',
          700: '#3a4438',
          800: '#202d25',
          900: '#16221b',
          950: '#0c1410',
        },
        emerald: {
          50:  '#eef6ef',
          100: '#d5ead8',
          200: '#aed5b3',
          300: '#7fbb86',
          400: '#4e9c5b',
          500: '#2b8049',
          600: '#1f6f43',
          700: '#195a37',
          800: '#164a2f',
          900: '#123c28',
          950: '#082016',
        },
        green: {
          50:  '#eef6ef',
          100: '#d5ead8',
          200: '#aed5b3',
          300: '#7fbb86',
          400: '#4e9c5b',
          500: '#2b8049',
          600: '#1f6f43',
          700: '#195a37',
          800: '#164a2f',
          900: '#123c28',
          950: '#082016',
        },
        amber: {
          50:  '#faf6ea',
          100: '#f2e8c9',
          200: '#e6d49e',
          300: '#d6bd72',
          400: '#c4a44c',
          500: '#b08d3f',
          600: '#8f7430',
          700: '#6e5926',
          800: '#574824',
          900: '#3f351d',
          950: '#221c0e',
        },
      },
      boxShadow: {
        'soft': '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'elevated': '0 4px 12px 0 rgb(0 0 0 / 0.08)',
        'modal': '0 20px 60px -12px rgb(0 0 0 / 0.25)',
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'fade-in-up': 'fade-in-up 0.2s ease-out',
        'modal-fade-in': 'modal-fade-in 0.15s ease-out',
        'scale-in': 'scale-in 0.15s ease-out',
        'slide-down': 'slide-down 0.2s ease-out',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'modal-fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      }
    },
  },
  plugins: [],
}
