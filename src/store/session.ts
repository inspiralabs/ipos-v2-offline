import { create } from 'zustand';

// Sesi login lokal (hanya di memori — tutup app = kunci lagi).
// Kalau belum ada kasir terdaftar, app terbuka sebagai owner tanpa kunci.
export interface SessionUser {
  name: string;
  role: 'owner' | 'kasir';
}

interface SessionStore {
  user: SessionUser | null;
  login: (u: SessionUser) => void;
  logout: () => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  user: null,
  login: (user) => set({ user }),
  logout: () => set({ user: null }),
}));
