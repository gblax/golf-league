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
        // Cool-neutral "stone" with only a faint sage undertone — clubhouse
        // without the cream/yellow cast. Mid shades are intentionally darker
        // than a warm parchment ramp to keep secondary text readable.
        slate: {
          50:  '#f4f5f3',
          100: '#e9ebe8',
          200: '#d8dbd6',
          300: '#bfc4bd',
          400: '#868d84',
          500: '#5d645b',
          600: '#454b43',
          700: '#333a33',
          800: '#1d2620',
          900: '#131a16',
          950: '#0b0f0d',
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
        // Antique gold for leaders/winners — deepened slightly so it reads gold,
        // not lemon, against the cooler neutral surface.
        amber: {
          50:  '#f8f3e8',
          100: '#efe6cf',
          200: '#e1cfa0',
          300: '#cfb673',
          400: '#bd9c47',
          500: '#a8863a',
          600: '#886a2c',
          700: '#685022',
          800: '#4f3f20',
          900: '#392f1b',
          950: '#1f1a0d',
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
