import { getDeviceId } from './device';
import { getLicenseState, saveLicenseState } from './license';

const API = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '');

/** Daftarkan perangkat ke server lisensi (muncul di admin dashboard). Gagal = diam, offline-first. */
export async function registerClient(storeName: string, phone?: string): Promise<void> {
  if (!API || !navigator.onLine) return;
  try {
    await fetch(`${API}/api/clients/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeName, phone, deviceId: getDeviceId().toLowerCase() }),
    });
  } catch {
    // offline / server mati — coba lagi lain waktu lewat checkLicenseStatus
  }
}

/**
 * Cek status lisensi ke server saat online (PRD §5.3 step 4).
 * Server bilang EXPIRED sementara lokal masih trial → paksa trial lokal berakhir.
 */
export async function checkLicenseStatus(): Promise<void> {
  if (!API || !navigator.onLine) return;
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
