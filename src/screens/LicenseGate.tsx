import { useState } from 'react';
import { Hourglass, MessageCircle, ShieldCheck } from 'lucide-react';
import { activateLicense, TRIAL_LIMITS, ADMIN_WA, waLink } from '@/lib/license';
import { useLicenseStore } from '@/store/license';
import { getDeviceId } from '@/lib/device';

/**
 * Layar penuh saat masa coba selesai (waktu habis / kuota transaksi terpakai).
 * Data user TIDAK hilang — hanya menunggu kode aktivasi.
 */
export function LicenseGate() {
  const refresh = useLicenseStore((s) => s.refresh);
  const licState = useLicenseStore((s) => s.state);
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const txFull = licState.txCount >= TRIAL_LIMITS.tx;

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const plan = await activateLicense(key.trim());
      if (!plan) {
        setError('Kode ini tidak cocok untuk HP ini. Cek lagi hurufnya, atau tanyakan ke admin ya.');
        return;
      }
      refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm bg-card rounded-2xl shadow-warm border border-border p-6">
        <div className="w-14 h-14 rounded-2xl bg-accent-soft text-accent flex items-center justify-center mb-4">
          <Hourglass className="w-7 h-7" aria-hidden />
        </div>
        <h1 className="text-xl font-extrabold mb-2">Masa coba kamu sudah selesai</h1>
        <p className="text-sm text-muted-foreground mb-1">
          {txFull
            ? `Jatah ${TRIAL_LIMITS.tx} transaksi masa coba sudah terpakai semua. Terima kasih sudah mencoba!`
            : `Masa coba ${TRIAL_LIMITS.days} hari sudah berakhir. Terima kasih sudah mencoba!`}
        </p>
        <p className="text-sm text-muted-foreground mb-5 flex items-start gap-1.5">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-success" aria-hidden />
          Tenang — semua data jualan kamu masih tersimpan aman di HP ini.
        </p>

        <form onSubmit={handleActivate} className="space-y-3">
          <div>
            <label className="block text-sm font-semibold mb-1.5" htmlFor="gateKey">
              Masukkan kode aktivasi
            </label>
            <input
              id="gateKey"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              autoCapitalize="characters"
              className="w-full border border-border rounded-xl px-3 py-3 text-sm font-mono uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={loading || !key.trim()}
            className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm disabled:opacity-40"
          >
            {loading ? 'Memeriksa…' : 'Aktifkan Sekarang'}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground mb-3">
            Belum punya kode? Beli sekali bayar — bukan langganan. Kirim kode HP di bawah ini ke admin:
          </p>
          <p className="text-sm font-mono bg-muted rounded-xl px-3 py-2.5 mb-3 select-all text-center">
            {getDeviceId()}
          </p>
          {ADMIN_WA && (
            <a
              href={waLink(`Halo, masa coba Inspira POS saya sudah selesai dan saya mau lanjut. Kode HP saya: ${getDeviceId()}`)}
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-success text-white font-bold py-3 rounded-xl text-sm"
            >
              <MessageCircle className="w-4 h-4" aria-hidden /> Chat Admin via WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
