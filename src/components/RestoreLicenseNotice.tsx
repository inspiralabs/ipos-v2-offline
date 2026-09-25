import { useEffect, useState } from 'react';
import { getLicenseState } from '@/lib/license';
import { useLicenseStore } from '@/store/license';
import { CopyDeviceCode } from '@/components/CopyDeviceCode';

const REBIND_KEY = 'ipos_license_rebind';

/** Dipanggil setelah data toko dipulihkan. Lisensi tidak ikut file salinan. */
export function markLicenseRebindIfTrial(): void {
  if (getLicenseState().plan !== 'trial') return;
  sessionStorage.setItem(REBIND_KEY, '1');
  window.dispatchEvent(new Event('ipos-license-rebind'));
}

/** Muncul sekali setelah pulihkan, selama HP ini masih masa coba. */
export function RestoreLicenseNotice() {
  const plan = useLicenseStore((s) => s.state.plan);
  const [open, setOpen] = useState(() => sessionStorage.getItem(REBIND_KEY) === '1');
  useEffect(() => {
    const sync = () => setOpen(sessionStorage.getItem(REBIND_KEY) === '1');
    window.addEventListener('ipos-license-rebind', sync);
    return () => window.removeEventListener('ipos-license-rebind', sync);
  }, []);
  if (!open || plan !== 'trial') return null;

  function dismiss() {
    sessionStorage.removeItem(REBIND_KEY);
    setOpen(false);
  }

  return (
    <div className="bg-accent-soft border-b border-border px-4 py-3 shrink-0">
      <p className="text-sm font-bold mb-1">Data toko sudah kembali</p>
      <p className="text-sm text-muted-foreground mb-2">
        Lisensi belum aktif di HP ini. Salin Kode HP di bawah, lalu kirim ke admin supaya kode aktivasi dibuat untuk HP ini.
      </p>
      <CopyDeviceCode />
      <button type="button" onClick={dismiss} className="mt-2 text-sm font-bold text-primary">
        Mengerti
      </button>
    </div>
  );
}
