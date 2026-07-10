import { create } from 'zustand';

// Jembatan antara hook useRegisterSW (dipanggil sekali di UpdatePrompt, dipasang di root App)
// dan tombol "Cek Update"/"Muat Ulang" di halaman Lainnya — hook React tidak bisa dipanggil dua
// tempat sekaligus tanpa risiko registrasi SW ganda, jadi state-nya dibagi lewat store ini.
interface PwaUpdateState {
  needRefresh: boolean;
  registration: ServiceWorkerRegistration | null;
  updateServiceWorker: ((reload?: boolean) => Promise<void>) | null;
}

export const usePwaUpdateStore = create<PwaUpdateState>(() => ({
  needRefresh: false,
  registration: null,
  updateServiceWorker: null,
}));

/** Cek pembaruan sekarang. Return true kalau versi baru ketemu (needRefresh jadi aktif). */
export async function checkForUpdate(): Promise<boolean> {
  const { registration } = usePwaUpdateStore.getState();
  if (!registration) return false;
  await registration.update();
  // ponytail: tidak ada event sinkron "SW baru ketemu" — beri jeda supaya updatefound/statechange
  // sempat diproses lib sebelum kita baca needRefresh. Naikkan durasi kalau koneksi lambat.
  await new Promise((r) => setTimeout(r, 1500));
  return usePwaUpdateStore.getState().needRefresh;
}
