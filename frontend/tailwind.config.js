/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          dark: 'var(--brand-dark, #0f172a)',
          primary: 'var(--brand-primary, #1e293b)',
          accent: 'var(--brand-accent, #10b981)',
          muted: 'var(--brand-muted, #64748b)',
          surface: 'var(--brand-surface, #f8fafc)',
        },
        glass: {
          white: 'rgba(255, 255, 255, 0.7)',
          dark: 'rgba(15, 23, 42, 0.7)',
        }
      },
      fontFamily: {
        sans: ['var(--font-family, "Inter")', 'system-ui', 'sans-serif'],
        display: ['var(--font-family, "Sora")', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glass-light': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
        'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      }
    },
  },
  plugins: [],
}
