// Tema warna aplikasi — primary color saja yang berubah (accent emas tetap, biar tetap serasi).
export type ThemeId = 'maroon' | 'merah' | 'oranye' | 'hijau' | 'toska' | 'biru' | 'ungu' | 'pink';

export const THEMES: { id: ThemeId; label: string; primary: string; primaryLight: string }[] = [
  { id: 'maroon', label: 'Maroon & Emas', primary: '#6e150f', primaryLight: '#b92a1c' },
  { id: 'merah', label: 'Merah', primary: '#b91c1c', primaryLight: '#ef4444' },
  { id: 'oranye', label: 'Oranye', primary: '#c2410c', primaryLight: '#f97316' },
  { id: 'hijau', label: 'Hijau', primary: '#15803d', primaryLight: '#22c55e' },
  { id: 'toska', label: 'Toska', primary: '#0f766e', primaryLight: '#2dd4bf' },
  { id: 'biru', label: 'Biru', primary: '#1e40af', primaryLight: '#3b82f6' },
  { id: 'ungu', label: 'Ungu', primary: '#6d28d9', primaryLight: '#a78bfa' },
  { id: 'pink', label: 'Pink', primary: '#be185d', primaryLight: '#f472b6' },
];
const DEFAULT_THEME: ThemeId = 'maroon';
const CACHE_KEY = 'ipos_theme'; // localStorage — dibaca sinkron saat boot, sebelum settings Dexie sempat kebaca

export function applyTheme(id: string): void {
  const theme = THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME)!;
  document.documentElement.style.setProperty('--color-primary', theme.primary);
  document.documentElement.style.setProperty('--color-primary-light', theme.primaryLight);
  localStorage.setItem(CACHE_KEY, theme.id);
}

/** Terapkan tema tersimpan secepat mungkin saat app boot (sinkron, sebelum render pertama). */
export function applyCachedTheme(): void {
  applyTheme(localStorage.getItem(CACHE_KEY) ?? DEFAULT_THEME);
}
