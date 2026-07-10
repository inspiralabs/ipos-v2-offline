import { useRef, useState } from 'react';
import {
  Store, Zap, UtensilsCrossed, BarChart3, WifiOff, Hourglass,
  ChevronLeft, ChevronRight, Check, UploadCloud, type LucideIcon,
} from 'lucide-react';
import { db } from '@/db';
import { BUSINESS_TYPES, seedBusinessType } from '@/lib/dummy';
import { TRIAL_LIMITS } from '@/lib/license';
import { setSetting, KEYS } from '@/lib/store-settings';
import { registerClient } from '@/lib/sync';
import { importBackup } from '@/lib/backup';
import { confirmDialog } from '@/components/dialogs';
import { toast } from '@/components/Toast';

interface Slide {
  icon: LucideIcon;
  title: string;
  desc: string;
}

const SLIDES: Slide[] = [
  {
    icon: Store,
    title: 'Selamat datang di Inspira POS',
    desc: 'Aplikasi kasir untuk warung dan usaha kamu. Catat jualan, atur menu, lihat untung — semua dari HP, tanpa ribet.',
  },
  {
    icon: Zap,
    title: 'Jualan secepat kilat',
    desc: 'Tinggal tap menu yang dibeli, langsung masuk keranjang. Kembalian dihitung otomatis — nggak perlu kalkulator lagi.',
  },
  {
    icon: UtensilsCrossed,
    title: 'Menu gampang diatur',
    desc: 'Tambah, ubah, atau sembunyikan menu kapan saja. Lagi kehabisan bahan? Satu tapan, menu langsung nggak tampil di kasir.',
  },
  {
    icon: BarChart3,
    title: 'Untung hari ini? Tinggal lihat',
    desc: 'Setiap penjualan tercatat rapi. Buka Laporan, langsung kelihatan omzet hari ini, menu paling laku, dan uang di laci.',
  },
  {
    icon: WifiOff,
    title: 'Nggak ada sinyal? Tetap jalan',
    desc: 'Semua data tersimpan di HP kamu, bukan di internet. Mati lampu, kuota habis, sinyal hilang — kasir tetap bisa dipakai.',
  },
];

// Slide batasan masa coba — dipisah karena bentuknya beda (checklist, bukan hero icon)
const LIMIT_ITEMS = [
  { label: `${TRIAL_LIMITS.days} hari pemakaian`, sub: 'Dihitung sejak pertama kali buka aplikasi' },
  { label: `${TRIAL_LIMITS.tx} transaksi`, sub: 'Cukup buat merasakan jualan beneran' },
  { label: `${TRIAL_LIMITS.menu} menu`, sub: 'Bisa pakai contoh menu biar cepat mulai' },
];

export function Onboarding({ onDone, tourOnly = false }: { onDone: () => void; tourOnly?: boolean }) {
  // step: 0..4 slide fitur, 5 slide batasan, 6 setup toko
  const [step, setStep] = useState(0);
  // Prefill dari link landing page (?store=...&phone=...) — hasil form /demo,
  // supaya tidak ketik ulang. Tetap bisa diedit, cuma titik awal.
  const params = new URLSearchParams(window.location.search);
  const [storeName, setStoreName] = useState(params.get('store') ?? '');
  const [phone, setPhone] = useState(params.get('phone') ?? '');
  const [bizType, setBizType] = useState<string | null>(null);
  const [customBiz, setCustomBiz] = useState('');
  const [withSample, setWithSample] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const restoreRef = useRef<HTMLInputElement>(null);

  const limitStep = SLIDES.length; // 5
  const setupStep = SLIDES.length + 1; // 6
  const lastStep = tourOnly ? limitStep : setupStep;
  const totalDots = lastStep + 1;

  // Pindah HP / install ulang → langsung pulihkan dari file backup, skip form pendaftaran
  // sama sekali (nama toko dkk ikut kepulihkan lewat tabel 'settings' di file backup).
  async function handleRestore(file: File) {
    if (!(await confirmDialog('Ini akan mengganti data yang ada sekarang dengan isi file backup. Lanjutkan?', { danger: true, okLabel: 'Pulihkan' }))) return;
    setRestoring(true);
    try {
      const err = await importBackup(file);
      if (err) { toast(err, 'error'); return; }
      onDone();
    } finally {
      setRestoring(false);
    }
  }

  async function finish() {
    if (tourOnly) { onDone(); return; }
    setSaving(true);
    try {
      await setSetting(KEYS.storeName, storeName.trim());
      if (phone.trim()) await setSetting(KEYS.storePhone, phone.trim());
      // 'lainnya' = simpan teks yang diketik user (atau 'lainnya'); jenis dikenal = seed contoh menu
      const savedBiz = bizType === 'lainnya' ? (customBiz.trim() || 'lainnya') : bizType;
      if (savedBiz) await setSetting(KEYS.businessType, savedBiz);
      if (bizType && bizType !== 'lainnya' && withSample && (await db.menus.count()) === 0) {
        await seedBusinessType(bizType);
      }
      await setSetting(KEYS.onboardingDone, '1');
      void registerClient(storeName.trim(), phone.trim() || undefined); // best-effort, tanpa nunggu
      onDone();
    } finally {
      setSaving(false);
    }
  }

  const isSlide = step < limitStep;
  const isLimit = step === limitStep;
  const isSetup = step === setupStep && !tourOnly;
  const canNext = !isSetup || storeName.trim().length > 0;

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 overflow-y-auto">
        <div className="w-full max-w-sm">

          {isSlide && (() => {
            const s = SLIDES[step];
            const Icon = s.icon;
            return (
              <div className="text-center">
                <div className="w-24 h-24 rounded-3xl bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-8">
                  <Icon className="w-12 h-12" strokeWidth={1.75} aria-hidden />
                </div>
                <h1 className="text-2xl font-extrabold mb-3 text-balance">{s.title}</h1>
                <p className="text-base text-muted-foreground leading-relaxed">{s.desc}</p>
                {step === 0 && !tourOnly && (
                  <button
                    onClick={() => restoreRef.current?.click()}
                    disabled={restoring}
                    className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary disabled:opacity-50"
                  >
                    <UploadCloud className="w-4 h-4" aria-hidden />
                    {restoring ? 'Memulihkan…' : 'Pindah HP? Pulihkan dari backup'}
                  </button>
                )}
              </div>
            );
          })()}

          {isLimit && (
            <div>
              <div className="w-24 h-24 rounded-3xl bg-accent-soft text-accent flex items-center justify-center mx-auto mb-8">
                <Hourglass className="w-12 h-12" strokeWidth={1.75} aria-hidden />
              </div>
              <h1 className="text-2xl font-extrabold mb-3 text-center text-balance">
                Gratis dicoba dulu, biar yakin
              </h1>
              <p className="text-base text-muted-foreground leading-relaxed text-center mb-6">
                Selama masa coba, jatah kamu:
              </p>
              <div className="space-y-3 mb-6">
                {LIMIT_ITEMS.map((item) => (
                  <div key={item.label} className="bg-card rounded-xl border border-border px-4 py-3 flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-accent-soft text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-4 h-4" aria-hidden />
                    </div>
                    <div>
                      <p className="font-bold text-sm">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground text-center leading-relaxed">
                Kalau cocok, cukup <b className="text-foreground">bayar sekali</b> — bukan langganan.
                Semua batas hilang dan data jualan kamu tetap tersimpan.
              </p>
            </div>
          )}

          {isSetup && (
            <div>
              <h1 className="text-2xl font-extrabold mb-1 text-balance">Kenalan dulu, yuk</h1>
              <p className="text-base text-muted-foreground mb-4">
                Biar struk dan laporan pakai nama usaha kamu.
              </p>

              <button
                onClick={() => restoreRef.current?.click()}
                disabled={restoring}
                className="w-full flex items-center justify-center gap-2 border border-primary/30 bg-accent-soft text-primary rounded-xl py-3 text-sm font-semibold mb-6 min-h-[44px] disabled:opacity-50"
              >
                <UploadCloud className="w-4 h-4" aria-hidden />
                {restoring ? 'Memulihkan…' : 'Pindah HP? Pulihkan dari backup'}
              </button>

              <label className="block text-sm font-semibold mb-1.5" htmlFor="storeName">
                Nama usaha <span className="text-destructive">*</span>
              </label>
              <input
                id="storeName"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Contoh: Seblak Teh Euis"
                className="w-full border border-border bg-card rounded-xl px-4 py-3 text-base mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
              />

              <label className="block text-sm font-semibold mb-1.5" htmlFor="storePhone">
                No. HP / WhatsApp (boleh kosong)
              </label>
              <input
                id="storePhone"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                placeholder="08xxxxxxxxxx"
                className="w-full border border-border bg-card rounded-xl px-4 py-3 text-base mb-5 focus:outline-none focus:ring-2 focus:ring-primary"
              />

              <p className="text-sm font-semibold mb-1.5">Jualan kamu apa?</p>
              <p className="text-sm text-muted-foreground mb-3">
                Pilih yang paling mirip — nanti kami siapkan contoh menu yang bisa kamu ubah-ubah.
                Nggak ada yang cocok? Pilih <b>Lainnya</b>, atau lewati saja.
              </p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {BUSINESS_TYPES.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBizType(bizType === b.id ? null : b.id)}
                    className={`text-left rounded-xl border px-3 py-3 transition min-h-[64px] ${
                      bizType === b.id
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card hover:border-primary/40'
                    }`}
                  >
                    <span className="text-xl block mb-0.5" aria-hidden>{b.emoji}</span>
                    <span className="text-sm font-bold block">{b.name}</span>
                  </button>
                ))}
                {/* Opsi Lainnya — jenis usaha yang tidak ada di daftar */}
                <button
                  onClick={() => setBizType(bizType === 'lainnya' ? null : 'lainnya')}
                  className={`text-left rounded-xl border px-3 py-3 transition min-h-[64px] ${
                    bizType === 'lainnya'
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-dashed border-border bg-card hover:border-primary/40'
                  }`}
                >
                  <span className="text-xl block mb-0.5" aria-hidden>✏️</span>
                  <span className="text-sm font-bold block">Lainnya</span>
                </button>
              </div>

              {bizType === 'lainnya' && (
                <div className="mb-2">
                  <label className="block text-sm font-semibold mb-1.5" htmlFor="customBiz">
                    Jualan kamu apa? (boleh kosong)
                  </label>
                  <input
                    id="customBiz"
                    value={customBiz}
                    onChange={(e) => setCustomBiz(e.target.value)}
                    placeholder="Contoh: Laundry, Toko Kelontong, Barbershop"
                    className="w-full border border-border bg-card rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Menu mulai dari kosong — kamu isi sendiri nanti di tab Menu. Gampang kok, tinggal tap "Tambah".
                  </p>
                </div>
              )}

              {bizType && bizType !== 'lainnya' && (
                <label className="flex items-start gap-3 bg-card border border-border rounded-xl px-4 py-3 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={withSample}
                    onChange={(e) => setWithSample(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-[var(--color-primary)]"
                  />
                  <span className="text-sm">
                    <b>Isi dengan contoh menu {BUSINESS_TYPES.find((b) => b.id === bizType)?.name}</b>
                    <br />
                    <span className="text-muted-foreground">
                      {BUSINESS_TYPES.find((b) => b.id === bizType)?.desc}. Harga dan nama bisa diubah kapan saja.
                    </span>
                  </span>
                </label>
              )}
              {!bizType && (
                <p className="text-sm text-muted-foreground">
                  Belum yakin? Lewati saja — menu bisa diisi sendiri kapan pun di tab Menu.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigasi bawah — border + background eksplisit biar jadi bar yang jelas terpisah dari konten,
          bukan cuma padding kosong yang gampang terlihat mepet saat konten di atasnya panjang/discroll. */}
      <div className="shrink-0 border-t border-border bg-background px-6 pt-4" style={{ paddingBottom: 'max(1.5rem, calc(1rem + env(safe-area-inset-bottom)))' }}>
        <div className="max-w-sm w-full mx-auto">
          <div className="flex items-center justify-center gap-1.5 mb-4" aria-hidden>
            {Array.from({ length: totalDots }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-primary' : 'w-1.5 bg-border'}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                aria-label="Kembali"
                className="w-12 h-12 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:bg-muted shrink-0"
              >
                <ChevronLeft className="w-5 h-5" aria-hidden />
              </button>
            )}
            {step < lastStep ? (
              <button
                onClick={() => setStep(step + 1)}
                className="flex-1 h-12 bg-primary text-primary-foreground font-bold rounded-xl text-sm flex items-center justify-center gap-1"
              >
                Lanjut <ChevronRight className="w-4 h-4" aria-hidden />
              </button>
            ) : (
              <button
                onClick={finish}
                disabled={!canNext || saving}
                className="flex-1 h-12 bg-primary text-primary-foreground font-bold rounded-xl text-sm disabled:opacity-40"
              >
                {saving ? 'Menyiapkan…' : tourOnly ? 'Selesai' : 'Mulai Jualan 🚀'}
              </button>
            )}
          </div>
          {isSlide && (
            <button
              onClick={() => setStep(lastStep)}
              className="w-full text-center text-sm text-muted-foreground mt-3 py-2"
            >
              Lewati perkenalan
            </button>
          )}
        </div>
      </div>
      <input
        ref={restoreRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleRestore(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
