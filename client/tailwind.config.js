/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'wf-red': '#EF4444',
        'wf-red-dark': '#DC2626',
        'wf-blue': '#3B82F6',
        'wf-green': '#22C55E',
        'wf-purple': '#A855F7',
        'wf-orange': '#F97316',
        'wf-yellow': '#EAB308',
        'wf-pink': '#EC4899',
        'wf-cyan': '#06B6D4',
        'wf-gray': {
          900: '#111111',
          800: '#1A1A1A',
          700: '#222222',
          600: '#333333',
          500: '#555555',
          400: '#888888',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
