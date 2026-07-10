# ipos-offline

PWA kasir offline-first (React + Vite + Dexie/IndexedDB) — beli putus per perangkat, Lite/Pro,
tanpa butuh internet untuk operasi harian.

## Jalankan

```powershell
npm install
npm run dev
```

Buka http://localhost:5173. Setup env (`VITE_SECURE_SALT_LITE`/`_PRO`) ada di
[../MENJALANKAN.md](../MENJALANKAN.md) bagian A5.

## Navigasi aplikasi

Kasir · Menu · Shift · Laporan — lihat [../MENJALANKAN.md](../MENJALANKAN.md) bagian B untuk detail
dan troubleshooting (mis. clear IndexedDB setelah upgrade schema Dexie).
