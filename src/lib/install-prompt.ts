import { create } from 'zustand';

// Tipe resmi belum ada di lib.dom.d.ts — deklarasikan minimal sesuai spec.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallPromptState {
  deferredEvent: BeforeInstallPromptEvent | null;
  installed: boolean;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export const useInstallPromptStore = create<InstallPromptState>(() => ({
  deferredEvent: null,
  installed: isStandalone(),
}));

// Modul ini harus diimpor sekali sedini mungkin (lihat main.tsx) — event
// beforeinstallprompt bisa muncul sebelum komponen React mana pun mount,
// dan kalau tidak ditangkap saat itu juga, browser tidak mengulanginya.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  useInstallPromptStore.setState({ deferredEvent: e as BeforeInstallPromptEvent });
});
window.addEventListener('appinstalled', () => {
  useInstallPromptStore.setState({ deferredEvent: null, installed: true });
});

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Tampilkan native install prompt. Return true kalau user menerima. */
export async function promptInstall(): Promise<boolean> {
  const { deferredEvent } = useInstallPromptStore.getState();
  if (!deferredEvent) return false;
  try {
    await deferredEvent.prompt();
    const { outcome } = await deferredEvent.userChoice;
    return outcome === 'accepted';
  } finally {
    useInstallPromptStore.setState({ deferredEvent: null });
  }
}
