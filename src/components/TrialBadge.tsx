import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Clock, ShoppingBag, UtensilsCrossed, Sparkles, MessageCircle } from 'lucide-react';
import { db } from '@/db';
import { useLicenseStore } from '@/store/license';
import { TRIAL_LIMITS, trialDaysLeft, ADMIN_WA, waLink } from '@/lib/license';
import { Modal } from './Modal';

/** Badge masa coba di topbar. Tap = lihat detail batasan. */
export function TrialBadge() {
  const licState = useLicenseStore((s) => s.state);
  const [open, setOpen] = useState(false);
  const menuCount = useLiveQuery(() => db.menus.count(), []) ?? 0;

  if (licState.plan !== 'trial') {
    return (
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-accent-soft text-primary">
        {licState.plan === 'pro' ? '⭐ Pro' : 'Lite'}
      </span>
    );
  }

  const days = trialDaysLeft(licState);
  const urgent = days <= 3 || licState.txCount >= 40;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`text-xs font-bold px-2.5 py-1.5 rounded-full transition min-h-[32px] ${
          urgent ? 'bg-warning text-white' : 'bg-accent-soft text-primary'
        }`}
      >
        Masa coba · {days} hari lagi
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)}>
          <div className="px-6 pt-6 pb-5">
            <h2 className="font-bold text-lg mb-1">Kamu lagi masa coba gratis</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Semua fitur bisa dipakai, tapi ada batasnya. Ini sisa jatah kamu:
            </p>

            <div className="space-y-3 mb-5">
              <LimitRow
                icon={<Clock className="w-5 h-5" aria-hidden />}
                label="Sisa waktu"
                value={`${days} dari ${TRIAL_LIMITS.days} hari`}
                pct={(days / TRIAL_LIMITS.days) * 100}
              />
              <LimitRow
                icon={<ShoppingBag className="w-5 h-5" aria-hidden />}
                label="Transaksi terpakai"
                value={`${licState.txCount} dari ${TRIAL_LIMITS.tx}`}
                pct={((TRIAL_LIMITS.tx - licState.txCount) / TRIAL_LIMITS.tx) * 100}
              />
              <LimitRow
                icon={<UtensilsCrossed className="w-5 h-5" aria-hidden />}
                label="Menu terpakai"
                value={`${menuCount} dari ${TRIAL_LIMITS.menu}`}
                pct={((TRIAL_LIMITS.menu - menuCount) / TRIAL_LIMITS.menu) * 100}
              />
            </div>

            <div className="bg-accent-soft rounded-xl p-4 mb-4">
              <p className="text-sm text-foreground flex gap-2">
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-accent" aria-hidden />
                <span>
                  Kalau cocok, beli sekali bayar — <b>tanpa langganan bulanan</b>. Semua batas
                  hilang, data kamu tetap aman di HP ini.
                </span>
              </p>
            </div>

            {ADMIN_WA && (
              <a
                href={waLink('Halo, saya mau aktivasi Inspira POS Offline.')}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-success text-white font-bold py-3 rounded-xl text-sm mb-2"
              >
                <MessageCircle className="w-4 h-4" aria-hidden /> Chat Admin via WhatsApp
              </a>
            )}
            <button
              onClick={() => setOpen(false)}
              className="w-full border border-border rounded-xl py-3 text-sm text-muted-foreground hover:bg-muted"
            >
              Lanjut jualan dulu
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function LimitRow({ icon, label, value, pct }: {
  icon: React.ReactNode; label: string; value: string; pct: number;
}) {
  const low = pct <= 25;
  return (
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${low ? 'bg-warning/10 text-warning' : 'bg-accent-soft text-primary'}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-semibold tabular-nums">{value}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${low ? 'bg-warning' : 'bg-accent'}`}
            style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
