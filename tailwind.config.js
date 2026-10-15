/** @type {import('tailwindcss').Config} */

// Palet base Inspira POS — sumber kebenaran warna brand.
// Token warna & radius mengikuti docs/design handoff ipos offline (maroon/gold, DM Sans).
const palette = {
  maroon: {
    deep: '#6e150f',
    pressed: '#4a0e0a',
    vibrant: '#b92a1c',
  },
  gold: {
    antique: '#d0a139',
    bright: '#fad64a',
  },
  cream: '#FFF9F2',
  surface: '#FFFFFF',
  charcoal: '#2B211B',
};

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        ...palette,
        // alias semantik — dipakai di seluruh layar
        background: palette.cream,
        foreground: palette.charcoal,
        card: palette.surface,
        muted: '#F0E4D6',
        'muted-foreground': '#6B5A4E', // 6.3:1 di krem — mata 40+ di siang hari; jangan dipudarkan lagi
        primary: {
          // var(...) dengan fallback ke maroon default — pilihan tema disetel runtime, lihat lib/theme.ts
          DEFAULT: 'var(--color-primary, #6e150f)',
          light: 'var(--color-primary-light, #b92a1c)',
          pressed: palette.maroon.pressed,
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
        border: '#D8C6B2', // #F0E4D6 lama (1.2:1) nyaris hilang di bawah matahari
        disabled: {
          DEFAULT: '#E5D8C8',
          foreground: '#a89a8a',
        },
      },
      fontSize: {
        // 13px, bukan 12px default: teks terkecil di app tetap terbaca tanpa kacamata baca.
        xs: ['0.8125rem', { lineHeight: '1.125rem' }],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1rem',
      },
      boxShadow: {
        warm: '0 2px 8px rgba(43,33,27,.06)',
      },
    },
  },
  plugins: [],
};
