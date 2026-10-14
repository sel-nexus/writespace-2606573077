/** Define WriteSpace's light editorial surfaces and restrained brand accents. */
import colors from 'tailwindcss/colors';
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {
    colors: {
      primary: colors.indigo, secondary: colors.violet, neutral: colors.slate,
      background: '#f8fafc', surface: '#ffffff', 'surface-raised': '#eef2ff',
      foreground: '#1e293b', 'foreground-muted': '#475569', border: '#cbd5e1', ring: '#4f46e5',
      error: { DEFAULT: '#b91c1c', light: '#fef2f2' },
      warning: { DEFAULT: '#92400e', light: '#fffbeb' },
      success: { DEFAULT: '#166534', light: '#f0fdf4' },
      info: { DEFAULT: '#3730a3', light: '#eef2ff' }
    },
    fontFamily: { display: ['Georgia', 'serif'], sans: ['Arial', 'Helvetica', 'sans-serif'] },
    fontSize: { hero: ['clamp(2.5rem, 6vw, 4.5rem)', { lineHeight: '1.05' }] },
    borderRadius: { card: '1rem', control: '0.5rem' },
    boxShadow: { focal: '0 16px 48px -24px rgba(49,46,129,.3)' },
    keyframes: { float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } } },
    animation: { float: 'float 6s ease-in-out infinite' }
  } },
  plugins: []
};
