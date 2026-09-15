import {
  ChevronLeft, ChevronDown, ShoppingCart, UtensilsCrossed, BarChart3, Clock,
  Contact, DownloadCloud, type LucideIcon,
} from 'lucide-react';
import { InstallCard } from '@/components/InstallCard';

interface Feature {
  icon: LucideIcon;
  title: string;
  desc: string;
}

// Ikon sama persis dengan yang dipakai di nav bawah & hub Lainnya — biar konsisten.
const FEATURES: Feature[] = [
  { icon: ShoppingCart, title: 'Kasir', desc: 'Tap menu yang dibeli, kembalian dihitung otomatis.' },
  { icon: UtensilsCrossed, title: 'Produk', desc: 'Tambah, ubah, atau sembunyikan menu kapan saja.' },
  { icon: BarChart3, title: 'Laporan', desc: 'Omzet hari ini, menu paling laku, uang di laci.' },
  { icon: Clock, title: 'Shift Kasir', desc: 'Buka & tutup shift, tahu persis uang masuk selama jaga.' },
  { icon: Contact, title: 'Pelanggan & Hutang', desc: 'Catat nama, HP, dan cicilan yang belum lunas.' },
  { icon: DownloadCloud, title: 'Amankan Data', desc: 'Backup ke file kapan saja — kalau ganti HP, tinggal pulihkan.' },
];

const STEPS = [
  { title: 'Isi nama & jenis usaha', desc: 'Struk dan laporan langsung pakai nama toko kamu.' },
  { title: 'Cek atau tambah menu', desc: 'Kalau jenis usaha cocok, contoh menu sudah tersedia — tinggal ubah harga & namanya.' },
  { title: 'Coba jualan satu transaksi', desc: 'Buka tab Kasir, tap menu, bayar — rasakan langsung secepat apa prosesnya.' },
  { title: 'Backup data rutin', desc: 'Buka Lainnya → Amankan Data. Biasakan, terutama sebelum ganti HP.' },
];

const FAQ = [
  {
    q: 'Beneran bisa dipakai tanpa internet?',
    a: 'Bisa. Semua data tersimpan langsung di HP kamu, bukan di internet. Mati lampu, kuota habis, atau sinyal hilang — kasir tetap jalan seperti biasa.',
  },
  {
    q: 'Kalau HP hilang atau ganti HP, data ikut hilang?',
    a: 'Kalau rutin backup (Lainnya → Amankan Data), data bisa dipulihkan di HP baru dari file backup itu. Tanpa backup, data hanya ada di HP yang lama.',
  },
  {
    q: 'Ada batasan pemakaian di awal?',
    a: 'Ada masa coba dengan batas hari, jumlah transaksi, dan jumlah menu — cukup buat merasakan jualan beneran. Setelah itu, cukup bayar sekali (bukan langganan) dan semua batas hilang.',
  },
];

export function GuideScreen({ onBack }: { onBack?: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <header className="bg-card border-b border-border px-4 py-3 shrink-0 flex items-center gap-2">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Kembali ke Lainnya"
            className="w-9 h-9 -ml-2 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted"
          >
            <ChevronLeft className="w-5 h-5" aria-hidden />
          </button>
        )}
        <h1 className="font-bold text-lg">Panduan</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 max-w-lg md:max-w-3xl w-full mx-auto">
        <InstallCard />

        <section>
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 px-1">Fitur Utama</h2>
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="bg-card rounded-2xl border border-border p-4">
                  <span className="w-10 h-10 rounded-xl bg-accent-soft text-primary flex items-center justify-center mb-2">
                    <Icon className="w-5 h-5" aria-hidden />
                  </span>
                  <span className="block text-sm font-bold leading-tight">{f.title}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5 leading-snug">{f.desc}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 px-1">Transaksi Pertama Kamu</h2>
          <div className="space-y-2">
            {STEPS.map((s, i) => (
              <div key={s.title} className="bg-card rounded-2xl border border-border p-4 flex gap-3">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-bold">{s.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 px-1">Sering Ditanya</h2>
          <div className="space-y-2">
            {FAQ.map((item) => (
              <details key={item.q} className="group bg-card rounded-2xl border border-border overflow-hidden">
                <summary className="px-4 py-3 text-sm font-bold flex items-center justify-between gap-2 cursor-pointer list-none">
                  {item.q}
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <p className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
