export function getDeviceId(): string {
  const cached = localStorage.getItem('ipos_device_id');
  if (cached) return cached;

  // UUID acak (PRD §5.3) — fingerprint lama bisa tabrakan antar HP bermodel sama,
  // dua HP kembar akan berbagi kode lisensi. Instalasi lama tetap pakai ID cache-nya.
  const id = crypto.randomUUID().toUpperCase();
  localStorage.setItem('ipos_device_id', id);
  return id;
}
