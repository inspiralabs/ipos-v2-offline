import { Star, MessageCircle } from 'lucide-react';
import { ADMIN_WA, waLink } from '@/lib/license';
import { getDeviceId } from '@/lib/device';
import { UPGRADE_PRICE } from '@/lib/plan';

/** Kartu penghalang fitur Pro untuk pengguna Lite (PRD: ProGate overlay + selisih harga + WA). */
export function ProGate({ feature }: { feature: string }) {
  return (
    <div className="bg-card rounded-2xl border border-accent/40 p-6 text-center max-w-sm mx-auto my-8">
      <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent flex items-center justify-center mx-auto mb-3">
        <Star className="w-6 h-6" aria-hidden />
      </div>
      <h3 className="font-bold mb-1">{feature} ada di versi Pro</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Upgrade dari Lite ke Pro cukup bayar selisihnya: <b className="text-foreground">{UPGRADE_PRICE}</b>,
        sekali bayar. Data kamu tidak berubah.
      </p>
      {ADMIN_WA && (
        <a
          href={waLink(`Halo, saya mau upgrade Inspira POS Offline ke Pro. Kode HP saya: ${getDeviceId()}`)}
          target="_blank"
          rel="noreferrer"
          className="w-full flex items-center justify-center gap-2 bg-success text-white font-bold py-3 rounded-xl text-sm"
        >
          <MessageCircle className="w-4 h-4" aria-hidden /> Upgrade via WhatsApp
        </a>
      )}
    </div>
  );
}
