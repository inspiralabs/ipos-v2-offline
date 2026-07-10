/** @type {import('tailwindcss').Config} */

// Palet base Inspira POS — sumber kebenaran warna brand.
const palette = {
  maroon: {
    deep: '#6e150f',
    vibrant: '#b92a1c',
  },
  gold: {
    antique: '#d0a139',
    bright: '#fad64a',
  },
  cream: '#F5EFE6',
  surface: '#FFFFFF',
  charcoal: '#1A1A1A',
};

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        ...palette,
        // alias semantik — dipakai di seluruh layar
        background: palette.cream,
        foreground: palette.charcoal,
        card: palette.surface,
        muted: '#ECE3D3',
        'muted-foreground': '#6D5F55',
        primary: {
          // var(...) dengan fallback ke maroon default — pilihan tema disetel runtime, lihat lib/theme.ts
          DEFAULT: 'var(--color-primary, #6e150f)',
          light: 'var(--color-primary-light, #b92a1c)',
          foreground: palette.cream,
        },
        accent: {
          DEFAULT: palette.gold.antique,
          soft: '#F9EFD3',
          bright: palette.gold.bright,
        },
        success: '#15803D',
        warning: '#B45309',
        destructive: '#BB1C1C',
        border: '#E3D9C6',
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
};
