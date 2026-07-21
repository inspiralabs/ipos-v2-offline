import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Store, HandCoins, Wallet, Contact, Truck, Users, Printer, ShieldCheck,
  DownloadCloud, KeyRound, PlayCircle, Receipt, Boxes, Clock, HardDrive,
  RefreshCw, type LucideIcon,
} from 'lucide-react';
import type { Screen, GoOpts } from '@/App';
import { usePwaUpdateStore, checkForUpdate } from '@/lib/pwa-update';
import { toast } from '@/components/Toast';

interface Item {
  icon: LucideIcon;
  label: string;
  desc: string;
  screen: Screen;
  opts?: GoOpts;
}

// Hub "Lainnya" — semua fitur dalam satu tempat, seperti menu Lainnya di ipos-v1.
const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: 'Keuangan & Transaksi',
    items: [
      { icon: Receipt, label: 'Riwayat Transaksi', desc: 'Semua transaksi & cetak ulang', screen: 'txhistory' },
      { icon: HandCoins, label: 'Hutang Pelanggan', desc: 'Piutang & cicilan', screen: 'report', opts: { reportTab: 'debt' } },
      { icon: Wallet, label: 'Pengeluaran', desc: 'Listrik, gaji, sewa, dll', screen: 'report', opts: { reportTab: 'expense' } },
      { icon: Boxes, label: 'Laporan Stok', desc: 'Barang masuk & keluar', screen: 'stockreport' },
    ],
  },
  {
    title: 'Toko & Karyawan',
    items: [
      { icon: Store, label: 'Profil Usaha', desc: 'Nama & jenis usaha', screen: 'settings', opts: { focus: 'profile' } },
      { icon: Clock, label: 'Shift Kasir', desc: 'Buka & tutup shift', screen: 'shift' },
      { icon: Users, label: 'Kasir', desc: 'Akun & PIN karyawan', screen: 'settings', opts: { focus: 'users' } },
      { icon: Contact, label: 'Pelanggan', desc: 'Nama, HP, alamat', screen: 'settings', opts: { focus: 'customers' } },
      { icon: Truck, label: 'Supplier', desc: 'Asal barang masuk', screen: 'settings', opts: { focus: 'suppliers' } },
      { icon: Printer, label: 'Struk', desc: 'Logo & tulisan bawah', screen: 'settings', opts: { focus: 'receipt' } },
    ],
  },
  {
    title: 'Aplikasi & Keamanan',
    items: [
      { icon: ShieldCheck, label: 'PIN Owner', desc: 'Kunci aksi penting', screen: 'settings', opts: { focus: 'pin' } },
      { icon: DownloadCloud, label: 'Amankan Data', desc: 'Backup & pulihkan', screen: 'settings', opts: { focus: 'backup' } },
      { icon: KeyRound, label: 'Versi & Aktivasi', desc: 'Lite / Pro, kode lisensi', screen: 'settings', opts: { focus: 'license' } },
      { icon: PlayCircle, label: 'Panduan', desc: 'Putar ulang perkenalan', screen: 'settings', opts: { focus: 'guide' } },
    ],
  },
];

function fmtBytes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  return `${(n / 1e3).toFixed(1)} KB`;
}

export function MoreScreen({ go }: { go: (s: Screen, opts?: GoOpts) => void }) {
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [checking, setChecking] = useState(false);
  const needRefresh = usePwaUpdateStore((s) => s.needRefresh);

  useEffect(() => {
    navigator.storage?.estimate?.().then((e) =>
      setStorage({ usage: e.usage ?? 0, quota: e.quota ?? 0 })
    ).catch(() => { /* tak didukung — sembunyikan */ });
  }, []);

  async function handleCheckUpdate() {
    setChecking(true);
    const found = await checkForUpdate();
    setChecking(false);
    toast(
      found ? '⭐ Versi baru tersedia. Tap "Muat Ulang" untuk memperbarui.' : 'Aplikasi kamu sudah versi terbaru.',
      found ? 'info' : 'success'
    );
  }

  function handleReload() {
    const { needRefresh, updateServiceWorker } = usePwaUpdateStore.getState();
    if (needRefresh && updateServiceWorker) updateServiceWorker(true);
    else window.location.reload();
  }

  let i = 0;
  return (
    <div className="flex flex-col h-full">
      <header className="bg-card border-b border-border px-4 py-3 shrink-0">
        <h1 className="font-bold text-lg">Lainnya</h1>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-5 max-w-lg md:max-w-3xl w-full mx-auto">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 px-1">{g.title}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {g.items.map((it) => {
                const Icon = it.icon;
                const delay = i++ * 0.02;
                return (
                  <motion.button
                    key={it.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay, ease: 'easeOut' }}
                    onClick={() => go(it.screen, it.opts)}
                    className="bg-card rounded-2xl border border-border p-4 text-left shadow-warm hover:shadow-md hover:border-primary/30 active:scale-95 transition min-h-[104px]"
                  >
                    <span className="w-10 h-10 rounded-xl bg-accent-soft text-primary flex items-center justify-center mb-2">
                      <Icon className="w-5 h-5" aria-hidden />
                    </span>
                    <span className="block text-sm font-bold leading-tight">{it.label}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5 leading-snug">{it.desc}</span>
                  </motion.button>
                );
              })}
            </div>
          </section>
        ))}

        {/* Info aplikasi + penyimpanan */}
        <section className="bg-card rounded-2xl border border-border p-5 text-center">
          <p className="font-extrabold text-primary">Inspira POS</p>
          <p className="text-xs text-muted-foreground mt-0.5">Smart POS untuk UMKM Indonesia 🇮🇩</p>
          <p className="text-xs text-muted-foreground">Powered by InspiraLabs</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Versi {__APP_VERSION__}</p>

          <div className="flex gap-2 mt-3">
            <button
              onClick={handleCheckUpdate}
              disabled={checking}
              className="flex-1 flex items-center justify-center gap-1.5 border border-border rounded-xl py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50 min-h-[40px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} aria-hidden />
              {checking ? 'Mengecek…' : 'Cek Update'}
            </button>
            <button
              onClick={handleReload}
              className={`flex-1 rounded-xl py-2 text-sm font-bold min-h-[40px] ${
                needRefresh ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-muted'
              }`}
            >
              Muat Ulang
            </button>
          </div>

          {storage && storage.quota > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-2">
                <HardDrive className="w-3.5 h-3.5" aria-hidden /> Penyimpanan terpakai
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${Math.max(1, Math.min(100, (storage.usage / storage.quota) * 100))}%` }}
                />
              </div>
              <p className="text-xs font-semibold tabular-nums">
                {fmtBytes(storage.usage)} / {fmtBytes(storage.quota)}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
