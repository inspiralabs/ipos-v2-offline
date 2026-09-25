import { getDeviceId } from './device';
import { getLicenseState, saveLicenseState } from './license';
import { getSetting, KEYS } from './store-settings';

// Dev lokal: URL relatif lewat proxy Vite ke tenant-service (localhost:3002),
// API yang sama dengan admin di localhost:3010. VITE_API_URL produksi tidak
// mengizinkan origin localhost, jadi fetch dari browser dibatalkan diam-diam
// dan tokonya tidak pernah muncul di dashboard.
const API = import.meta.env.DEV
  ? ''
  : ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '');

function canReachApi(): boolean {
  if (!navigator.onLine) return false;
  return import.meta.env.DEV || API.length > 0;
}

/** Daftarkan perangkat ke server lisensi (muncul di admin dashboard). Gagal = diam, offline-first. */
export async function registerClient(storeName: string, phone?: string): Promise<void> {
  if (!canReachApi()) return;
  try {
    await fetch(`${API}/api/clients/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeName, phone, deviceId: getDeviceId().toLowerCase() }),
    });
  } catch {
    // offline / server mati — dicoba lagi saat app dibuka online
  }
}

/**
 * Daftarkan ulang perangkat yang sedang terpasang. Registrasi awal hanya
 * sekali saat onboarding, jadi HP yang dipulihkan dari backup, data situsnya
 * terhapus, atau daftarnya gagal diam-diam tidak punya baris di admin.
 * Idempotent: kode HP yang sama tidak membuat klien baru.
 */
export async function ensureDeviceRegistered(): Promise<void> {
  if (!canReachApi()) return;
  const storeName = (await getSetting(KEYS.storeName))?.trim();
  if (!storeName) return;
  const phone = (await getSetting(KEYS.storePhone)) ?? '';
  await registerClient(storeName, phone || undefined);
}

/**
 * Cek status lisensi ke server saat online (PRD §5.3 step 4).
 * Server bilang EXPIRED sementara lokal masih trial → paksa trial lokal berakhir.
 */
export async function checkLicenseStatus(): Promise<void> {
  if (!canReachApi()) return;
  try {
    const res = await fetch(`${API}/api/clients/license-status?deviceId=${getDeviceId().toLowerCase()}`);
    if (!res.ok) return;
    const data = (await res.json()) as { licenseStatus?: string };
    const local = getLicenseState();
    if (data.licenseStatus === 'EXPIRED' && local.plan === 'trial') {
      saveLicenseState({ ...local, expiresAt: Date.now() });
    }
    // ponytail: REVOKED tidak menonaktifkan lisensi offline yang sudah aktif —
    // lisensi beli putus per PRD "aktif offline selamanya"
  } catch {
    // offline — abaikan
  }
}
