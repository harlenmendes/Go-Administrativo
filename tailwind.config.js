/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1B3A4B',
          50:  '#EDF3F5',
          100: '#D4E2E8',
          200: '#ACC6D1',
          300: '#7EA5B6',
          400: '#4F7E93',
          500: '#2D5A6E',
          600: '#1B3A4B',
          700: '#16303E',
          800: '#132832',
          900: '#0D1F27',
        },
        secondary: {
          DEFAULT: '#7BA393',
          50:  '#F2F7F5',
          100: '#E2EDE8',
          200: '#C4DBD1',
          300: '#A8C5B8',
          400: '#9DBFB1',
          500: '#7BA393',
          600: '#5D8A78',
          700: '#4A7061',
          800: '#3B594D',
          900: '#2D453C',
        },
        brand: {
          cream: '#F5F7F6',
          offwhite: '#FAFBFA',
          dark: '#0D1F27',
          border: '#E8EDEB',
          muted: '#6B7D75',
          body: '#4A5C54',
        },
        danger: '#EF4444',
        warning: '#F59E0B',
        surface: '#FFFFFF',
        background: '#F5F7F6',
      },
      fontFamily: {
        sans: ['Outfit', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
      },
      borderRadius: {
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(27, 58, 75, 0.06), 0 1px 2px -1px rgba(27, 58, 75, 0.04)',
        'card-hover': '0 10px 25px -5px rgba(27, 58, 75, 0.10), 0 4px 10px -2px rgba(27, 58, 75, 0.05)',
        'bottom-nav': '0 -2px 16px 0 rgba(27, 58, 75, 0.06)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

