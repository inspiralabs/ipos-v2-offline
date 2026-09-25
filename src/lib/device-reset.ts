import { db } from '@/db';

const DEVICE_KEYS = ['ipos_device_id', 'ipos_license', 'ipos_license_key', 'ipos_theme'] as const;

/**
 * Hapus seluruh toko di HP ini. Kode HP dan lisensi tidak ikut file salinan,
 * jadi setelah muat ulang HP ini mulai dari awal dengan Kode HP baru.
 */
export async function resetDevice(): Promise<void> {
  await db.delete();
  for (const key of DEVICE_KEYS) localStorage.removeItem(key);
  location.reload();
}
