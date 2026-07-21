import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Store, KeyRound, DownloadCloud, UploadCloud, PlayCircle, MessageCircle, Check,
  Printer, ShieldCheck, Users, Truck, Star, AlertTriangle, Trash2, Contact, ChevronLeft, Palette,
  QrCode,
} from 'lucide-react';
import { db } from '@/db';
import { useLicenseStore } from '@/store/license';
import {
  activateLicense, trialDaysLeft, TRIAL_LIMITS, ADMIN_WA, waLink, hashPin,
  generateRecoveryCode, hashRecoveryCode,
} from '@/lib/license';
import { hasFeature } from '@/lib/plan';
import { getDeviceId } from '@/lib/device';
import { getSetting, setSetting, askOwnerPin, KEYS } from '@/lib/store-settings';
import { THEMES, applyTheme, type ThemeId } from '@/lib/theme';
import { BUSINESS_TYPES } from '@/lib/dummy';
import { exportBackup, importBackup } from '@/lib/backup';
import { printReceipt } from '@/lib/receipt';
import { Select } from '@/components/Select';
import { toast } from '@/components/Toast';
import { confirmDialog } from '@/components/dialogs';
import { Modal } from '@/components/Modal';

const FOCUS_TITLE: Record<string, string> = {
  profile: 'Profil Usaha', receipt: 'Struk', pin: 'PIN Owner', users: 'Kasir',
  customers: 'Pelanggan', suppliers: 'Supplier', license: 'Versi & Aktivasi',
  backup: 'Amankan Data', guide: 'Panduan',
};

export function SettingsScreen({ onReplayTour, focus, onBack }: {
  onReplayTour: () => void;
  focus?: string; // hanya render satu bagian; kosong = semua
  onBack?: () => void;
}) {
  const licState = useLicenseStore((s) => s.state);
  const refresh = useLicenseStore((s) => s.refresh);

  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [bizType, setBizType] = useState('');
  const [themeId, setThemeId] = useState<ThemeId>('maroon');
  const [savedFlash, setSavedFlash] = useState(false);
  const [licKey, setLicKey] = useState('');
  const [licMsg, setLicMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const lastBackup = useLiveQuery(async () => Number(await getSetting(KEYS.lastBackupAt)) || 0, []);
  const orderCount = useLiveQuery(() => db.orders.count(), []) ?? 0;
  const backupDue = lastBackup !== undefined && orderCount > 0 &&
    (lastBackup === 0 || Date.now() - lastBackup > 7 * 86400_000);

  useEffect(() => {
    getSetting(KEYS.storeName).then((v) => setStoreName(v ?? ''));
    getSetting(KEYS.storeAddress).then((v) => setStoreAddress(v ?? ''));
    getSetting(KEYS.storePhone).then((v) => setStorePhone(v ?? ''));
    getSetting(KEYS.businessType).then((v) => setBizType(v ?? ''));
    getSetting(KEYS.themeColor).then((v) => { if (v) setThemeId(v as ThemeId); });
  }, []);

  async function pickTheme(id: ThemeId) {
    setThemeId(id);
    applyTheme(id);
    await setSetting(KEYS.themeColor, id);
  }

  // Render satu bagian saja saat dibuka dari hub Lainnya (menghindari halaman panjang)
  const show = (k: string) => !focus || focus === k;

  async function saveProfile() {
    await setSetting(KEYS.storeName, storeName.trim());
    await setSetting(KEYS.storeAddress, storeAddress.trim());
    await setSetting(KEYS.storePhone, storePhone.trim());
    await setSetting(KEYS.businessType, bizType);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  }

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLicMsg(null);
    try {
      const plan = await activateLicense(licKey.trim());
      if (!plan) {
        setLicMsg({ ok: false, text: 'Kode ini tidak cocok untuk HP ini. Cek lagi, atau tanyakan ke admin ya.' });
        return;
      }
      setLicMsg({ ok: true, text: `Berhasil! Aplikasi kamu sekarang versi ${plan === 'pro' ? 'Pro' : 'Lite'} — tanpa batas waktu.` });
      setLicKey('');
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(file: File) {
    if (!(await confirmDialog('Data yang ada sekarang akan diganti dengan isi file backup. Lanjutkan?', { danger: true, okLabel: 'Ganti Data' }))) return;
    const err = await importBackup(file);
    setBackupMsg(err ?? 'Data berhasil dipulihkan dari backup!');
  }

  const isTrial = licState.plan === 'trial';

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
        <h1 className="font-bold text-lg">{(focus && FOCUS_TITLE[focus]) || 'Pengaturan'}</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-4 md:items-start max-w-lg md:max-w-3xl w-full mx-auto">

        {!focus && backupDue && (
          <div className="md:col-span-2 bg-warning/10 border border-warning/30 rounded-2xl px-4 py-3 flex items-start gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" aria-hidden />
            <p className="text-foreground">
              {lastBackup === 0
                ? 'Data jualan kamu belum pernah di-backup. Simpan salinannya sekarang, yuk — cuma sekali tap.'
                : 'Backup terakhir sudah lebih dari seminggu. Amankan data terbaru kamu, yuk.'}
            </p>
          </div>
        )}

        {/* Profil usaha */}
        {show('profile') && (
        <section id="profile" className="bg-card rounded-2xl border border-border p-5">
          <h2 className="font-bold text-sm mb-4 flex items-center gap-2">
            <Store className="w-4 h-4 text-primary" aria-hidden /> Usaha Kamu
          </h2>
          <label className="block text-sm font-medium mb-1.5" htmlFor="setStoreName">Nama usaha</label>
          <input
            id="setStoreName"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="Contoh: Bakso Pak Kumis"
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <label className="block text-sm font-medium mb-1.5" htmlFor="setStoreAddress">Alamat toko</label>
          <input
            id="setStoreAddress"
            value={storeAddress}
            onChange={(e) => setStoreAddress(e.target.value)}
            placeholder="Contoh: Jl. Merdeka No. 10, Bandung"
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <label className="block text-sm font-medium mb-1.5" htmlFor="setStorePhone">Nomor HP toko</label>
          <input
            id="setStorePhone"
            value={storePhone}
            onChange={(e) => setStorePhone(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder="Contoh: 0812xxxxxxx"
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <label className="block text-sm font-medium mb-1.5" htmlFor="setBizType">Jenis usaha</label>
          <div className="mb-4">
            <Select
              id="setBizType"
              value={bizType}
              onChange={setBizType}
              items={[
                ...BUSINESS_TYPES.map((b) => ({ value: b.id, label: `${b.emoji} ${b.name}` })),
                { value: 'lainnya', label: 'Lainnya' },
              ]}
            />
          </div>
          <button
            onClick={saveProfile}
            disabled={!storeName.trim()}
            className="w-full bg-primary text-primary-foreground font-bold py-2.5 rounded-xl text-sm disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {savedFlash ? (<><Check className="w-4 h-4" aria-hidden /> Tersimpan</>) : 'Simpan'}
          </button>
        </section>
        )}

        {show('profile') && (
        <section className="bg-card rounded-2xl border border-border p-5">
          <h2 className="font-bold text-sm mb-4 flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" aria-hidden /> Tema Warna
          </h2>
          <div className="grid grid-cols-4 gap-y-3">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => pickTheme(t.id)}
                aria-label={t.label}
                aria-pressed={themeId === t.id}
                className={`flex flex-col items-center gap-1.5 min-w-[44px] py-1 rounded-xl ${
                  themeId === t.id ? 'ring-2 ring-offset-2 ring-primary' : ''
                }`}
              >
                <span
                  className="w-9 h-9 rounded-full border border-border flex items-center justify-center"
                  style={{ backgroundColor: t.primary }}
                >
                  {themeId === t.id && <Check className="w-4 h-4 text-white" aria-hidden />}
                </span>
                <span className="text-[11px] text-muted-foreground">{t.label}</span>
              </button>
            ))}
          </div>
        </section>
        )}

        {show('receipt') && <ReceiptSection />}
        {show('pin') && <PinSection />}
        {show('users') && <UsersSection />}
        {show('customers') && <CustomersSection />}
        {show('suppliers') && <SupplierSection />}

        {/* Lisensi */}
        {show('license') && (
        <section id="license" className="bg-card rounded-2xl border border-border p-5">
          <h2 className="font-bold text-sm mb-4 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" aria-hidden /> Versi Aplikasi
          </h2>

          {isTrial ? (
            <>
              <div className="bg-accent-soft rounded-xl px-4 py-3 mb-4 text-sm">
                <p className="font-bold mb-1">Masa coba gratis</p>
                <p className="text-muted-foreground">
                  Sisa {trialDaysLeft(licState)} hari · {licState.txCount}/{TRIAL_LIMITS.tx} transaksi terpakai ·
                  maksimal {TRIAL_LIMITS.menu} menu.
                </p>
              </div>
              <form onSubmit={handleActivate}>
                <label className="block text-sm font-medium mb-1.5" htmlFor="licKey">
                  Punya kode aktivasi? Masukkan di sini
                </label>
                <input
                  id="licKey"
                  value={licKey}
                  onChange={(e) => setLicKey(e.target.value)}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  autoCapitalize="characters"
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm font-mono uppercase tracking-widest mb-2 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {licMsg && (
                  <p className={`text-sm mb-2 ${licMsg.ok ? 'text-success' : 'text-destructive'}`}>{licMsg.text}</p>
                )}
                <button
                  type="submit"
                  disabled={busy || !licKey.trim()}
                  className="w-full bg-primary text-primary-foreground font-bold py-2.5 rounded-xl text-sm disabled:opacity-40"
                >
                  {busy ? 'Memeriksa…' : 'Aktifkan'}
                </button>
              </form>
              {ADMIN_WA && (
                <a
                  href={waLink(`Halo, saya mau beli Inspira POS Offline. Kode HP saya: ${getDeviceId()}`)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 w-full flex items-center justify-center gap-2 border border-success text-success font-bold py-2.5 rounded-xl text-sm"
                >
                  <MessageCircle className="w-4 h-4" aria-hidden /> Beli lewat WhatsApp
                </a>
              )}
            </>
          ) : (
            <>
              <div className="bg-accent-soft rounded-xl px-4 py-3 text-sm mb-2">
                <p className="font-bold mb-1">
                  {licState.plan === 'pro' ? '⭐ Versi Pro' : 'Versi Lite'} — aktif selamanya di HP ini
                </p>
                <p className="text-muted-foreground">Tanpa langganan, tanpa batas waktu.</p>
              </div>
              {licState.plan === 'lite' && (
                <form onSubmit={handleActivate}>
                  <label className="block text-sm font-medium mb-1.5" htmlFor="licKey">
                    Upgrade ke Pro? Masukkan kode Pro di sini
                  </label>
                  <input
                    id="licKey"
                    value={licKey}
                    onChange={(e) => setLicKey(e.target.value)}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    autoCapitalize="characters"
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm font-mono uppercase tracking-widest mb-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {licMsg && (
                    <p className={`text-sm mb-2 ${licMsg.ok ? 'text-success' : 'text-destructive'}`}>{licMsg.text}</p>
                  )}
                  <button
                    type="submit"
                    disabled={busy || !licKey.trim()}
                    className="w-full bg-primary text-primary-foreground font-bold py-2.5 rounded-xl text-sm disabled:opacity-40"
                  >
                    {busy ? 'Memeriksa…' : 'Aktifkan Pro'}
                  </button>
                </form>
              )}
            </>
          )}

          <p className="text-xs text-muted-foreground mt-4">
            Kode HP ini (dibutuhkan saat beli):
            <span className="font-mono text-foreground block mt-0.5 select-all">{getDeviceId()}</span>
          </p>
        </section>
        )}

        {/* Backup */}
        {show('backup') && (
        <section id="backup" className="bg-card rounded-2xl border border-border p-5">
          <h2 className="font-bold text-sm mb-1 flex items-center gap-2">
            <DownloadCloud className="w-4 h-4 text-primary" aria-hidden /> Amankan Data
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Data cuma ada di HP ini. Simpan salinannya secara rutin, supaya kalau HP hilang atau rusak,
            data jualan kamu nggak ikut hilang.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => exportBackup()}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-2.5 rounded-xl text-sm"
            >
              <DownloadCloud className="w-4 h-4" aria-hidden /> Simpan Salinan
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 border border-border font-bold py-2.5 rounded-xl text-sm hover:bg-muted"
            >
              <UploadCloud className="w-4 h-4" aria-hidden /> Pulihkan
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
                e.target.value = '';
              }}
            />
          </div>
          {backupMsg && <p className="text-sm mt-2 text-muted-foreground">{backupMsg}</p>}
        </section>
        )}

        {/* Panduan */}
        {show('guide') && (
        <section id="guide" className="bg-card rounded-2xl border border-border p-5">
          <h2 className="font-bold text-sm mb-1 flex items-center gap-2">
            <PlayCircle className="w-4 h-4 text-primary" aria-hidden /> Panduan
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Mau lihat lagi perkenalan aplikasi dan info masa coba?
          </p>
          <button
            onClick={onReplayTour}
            className="w-full border border-border font-bold py-2.5 rounded-xl text-sm hover:bg-muted"
          >
            Putar Ulang Perkenalan
          </button>
        </section>
        )}
      </div>
    </div>
  );
}

// ===================== STRUK =====================
function ReceiptSection() {
  const [footer, setFooter] = useState('');
  const [logo, setLogo] = useState('');
  const [qris, setQris] = useState('');
  const [saved, setSaved] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const qrisRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSetting(KEYS.receiptFooter).then((v) => setFooter(v ?? ''));
    getSetting(KEYS.storeLogo).then((v) => setLogo(v ?? ''));
    getSetting(KEYS.qrisImage).then((v) => setQris(v ?? ''));
  }, []);

  async function save() {
    await setSetting(KEYS.receiptFooter, footer.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function pickLogo(file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      const url = String(reader.result);
      setLogo(url);
      await setSetting(KEYS.storeLogo, url);
    };
    reader.readAsDataURL(file);
  }

  function pickQris(file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      const url = String(reader.result);
      setQris(url);
      await setSetting(KEYS.qrisImage, url);
    };
    reader.readAsDataURL(file);
  }

  async function testPrint() {
    await printReceipt({
      id: 'test', items: [
        { product_id: 'x', product_name: 'Contoh Menu', price: 10000, qty: 2, discount: 0, hpp: 0, notes: null },
      ],
      subtotal: 20000, discount: 0, total: 20000,
      payment_method: 'cash', cash_received: 50000, change: 30000,
      status: 'paid', cashier_name: 'Kasir', shift_id: null,
      customer_id: null, customer_name: null, table_number: null, notes: null,
      created_at: Date.now(), synced: false,
    });
  }

  return (
    <section id="receipt" className="bg-card rounded-2xl border border-border p-5">
      <h2 className="font-bold text-sm mb-1 flex items-center gap-2">
        <Printer className="w-4 h-4 text-primary" aria-hidden /> Struk
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Struk dicetak lewat dialog print HP — cocok untuk printer thermal 58mm
        (di Android bisa lewat aplikasi print service seperti RawBT).
      </p>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {logo ? <img src={logo} alt="Logo toko" className="w-full h-full object-contain" /> : <Store className="w-6 h-6 text-muted-foreground" aria-hidden />}
        </div>
        <div className="flex-1">
          <button onClick={() => logoRef.current?.click()} className="text-sm text-primary font-semibold">
            {logo ? 'Ganti logo toko' : 'Pasang logo toko'}
          </button>
          {logo && (
            <button
              onClick={async () => { setLogo(''); await setSetting(KEYS.storeLogo, ''); }}
              className="block text-sm text-muted-foreground"
            >
              Hapus logo
            </button>
          )}
          <input
            ref={logoRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) pickLogo(f); e.target.value = ''; }}
          />
        </div>
      </div>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {qris ? <img src={qris} alt="Kode QRIS" className="w-full h-full object-contain" /> : <QrCode className="w-6 h-6 text-muted-foreground" aria-hidden />}
        </div>
        <div className="flex-1">
          <button onClick={() => qrisRef.current?.click()} className="text-sm text-primary font-semibold">
            {qris ? 'Ganti gambar QRIS' : 'Pasang gambar QRIS'}
          </button>
          {qris && (
            <button
              onClick={async () => { setQris(''); await setSetting(KEYS.qrisImage, ''); }}
              className="block text-sm text-muted-foreground"
            >
              Hapus gambar QRIS
            </button>
          )}
          <input
            ref={qrisRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) pickQris(f); e.target.value = ''; }}
          />
        </div>
      </div>
      <label className="block text-sm font-medium mb-1.5" htmlFor="receiptFooter">Tulisan di bawah struk</label>
      <input
        id="receiptFooter"
        value={footer}
        onChange={(e) => setFooter(e.target.value)}
        placeholder="Contoh: Terima kasih, ditunggu lagi ya!"
        className="w-full border border-border rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <div className="flex gap-2">
        <button onClick={save} className="flex-1 bg-primary text-primary-foreground font-bold py-2.5 rounded-xl text-sm">
          {saved ? '✓ Tersimpan' : 'Simpan'}
        </button>
        <button onClick={testPrint} className="flex-1 border border-border font-bold py-2.5 rounded-xl text-sm hover:bg-muted">
          Coba Cetak
        </button>
      </div>
    </section>
  );
}

// ===================== PIN OWNER =====================
function PinSection() {
  const [hasPin, setHasPin] = useState(false);
  const [hasRecovery, setHasRecovery] = useState(false);
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState('');
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null); // tampil sekali setelah dibuat

  useEffect(() => {
    getSetting(KEYS.ownerPin).then((v) => setHasPin(!!v));
    getSetting(KEYS.ownerRecoveryCode).then((v) => setHasRecovery(!!v));
  }, []);

  async function generateRecovery() {
    setMsg('');
    const ok = await askOwnerPin();
    if (ok !== 'ok') { setMsg('PIN owner salah.'); return; }
    const code = generateRecoveryCode();
    await setSetting(KEYS.ownerRecoveryCode, await hashRecoveryCode(code));
    setHasRecovery(true);
    setRecoveryCode(code);
  }

  async function save() {
    if (!/^\d{6}$/.test(pin)) { setMsg('PIN harus 6 angka.'); return; }
    if (hasPin) {
      const ok = await askOwnerPin();
      if (ok !== 'ok') { setMsg('PIN lama salah.'); return; }
    }
    await setSetting(KEYS.ownerPin, await hashPin(pin));
    // kode pemulihan dibuat sekali seumur hidup PIN — kalau akun lama belum pernah punya
    // (dibuat sebelum fitur ini ada), buatkan sekarang juga supaya tetap ada jalan keluar.
    if (!hasRecovery) {
      const code = generateRecoveryCode();
      await setSetting(KEYS.ownerRecoveryCode, await hashRecoveryCode(code));
      setHasRecovery(true);
      setRecoveryCode(code);
    }
    setHasPin(true);
    setPin('');
    setMsg('PIN tersimpan. Jangan sampai lupa ya!');
  }

  return (
    <section id="pin" className="bg-card rounded-2xl border border-border p-5">
      <h2 className="font-bold text-sm mb-1 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-primary" aria-hidden /> PIN Owner
      </h2>
      <p className="text-sm text-muted-foreground mb-3">
        Dipakai untuk hal-hal penting: membatalkan transaksi dan mengelola kasir. Cukup kamu yang tahu.
      </p>
      <div className="flex gap-2">
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder={hasPin ? 'PIN baru (6 angka)' : 'Buat PIN (6 angka)'}
          aria-label="PIN owner"
          className="flex-1 border border-border rounded-xl px-3 py-2.5 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={save}
          disabled={pin.length < 6}
          className="bg-primary text-primary-foreground font-bold px-4 py-2.5 rounded-xl text-sm disabled:opacity-40"
        >
          {hasPin ? 'Ganti' : 'Simpan'}
        </button>
      </div>
      {msg && <p className="text-sm text-muted-foreground mt-2">{msg}</p>}
      {hasPin && !hasRecovery && (
        <div className="mt-3 bg-warning/10 border border-warning/30 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
          <p className="text-sm text-warning">Belum ada kode pemulihan kalau PIN lupa.</p>
          <button onClick={generateRecovery} className="shrink-0 text-sm font-bold text-primary hover:underline">
            Buat sekarang
          </button>
        </div>
      )}
      {recoveryCode && (
        <RecoveryCodeModal code={recoveryCode} onClose={() => setRecoveryCode(null)} />
      )}
    </section>
  );
}

/** Kode pemulihan tampil sekali — wajib centang konfirmasi "sudah dicatat" sebelum bisa ditutup. */
function RecoveryCodeModal({ code, onClose }: { code: string; onClose: () => void }) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <Modal onClose={() => { /* tidak bisa ditutup lewat backdrop/swipe — harus lewat tombol di bawah */ }}>
      <div className="px-6 pt-5 pb-4 border-b border-border">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" aria-hidden /> Kode Pemulihan PIN
        </h2>
      </div>
      <div className="px-6 py-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          Simpan kode ini di tempat aman. Kalau PIN owner lupa, kode ini satu-satunya cara masuk lagi —
          <b className="text-foreground"> hilang kode = harus hapus semua data aplikasi</b> untuk mulai ulang.
          Kode ini hanya ditampilkan sekali.
        </p>
        <div className="bg-accent-soft rounded-xl py-4 text-center">
          <p className="text-2xl font-extrabold tracking-[0.3em] text-primary">{code}</p>
        </div>
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[var(--color-primary)]"
          />
          Sudah saya catat / screenshot di tempat aman.
        </label>
      </div>
      <div className="px-6 pb-5">
        <button
          onClick={onClose}
          disabled={!confirmed}
          className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm disabled:opacity-40"
        >
          Selesai
        </button>
      </div>
    </Modal>
  );
}

// ===================== PENGGUNA KASIR (PRO) =====================
function UsersSection() {
  const licState = useLicenseStore((s) => s.state);
  const users = useLiveQuery(() => db.users.toArray(), []) ?? [];
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState('');

  const canUse = hasFeature(licState, 'multi_user');

  async function addUser() {
    if (!name.trim() || !/^\d{6}$/.test(pin)) { setMsg('Isi nama dan PIN 6 angka.'); return; }
    const ownerPin = await getSetting(KEYS.ownerPin);
    if (!ownerPin) { setMsg('Atur dulu PIN owner di atas, baru tambah kasir.'); return; }
    const ok = await askOwnerPin();
    if (ok !== 'ok') { setMsg('PIN owner salah.'); return; }
    await db.users.add({
      name: name.trim(), role: 'kasir', pin_hash: await hashPin(pin), created_at: Date.now(),
    });
    setName(''); setPin(''); setMsg('');
  }

  async function removeUser(id: number, uname: string) {
    const ok = await askOwnerPin();
    if (ok !== 'ok') { toast('PIN owner salah.', 'error'); return; }
    if (await confirmDialog(`Hapus kasir "${uname}"?`, { danger: true, okLabel: 'Hapus' })) await db.users.delete(id);
  }

  return (
    <section id="users" className="bg-card rounded-2xl border border-border p-5">
      <h2 className="font-bold text-sm mb-1 flex items-center gap-2">
        <Users className="w-4 h-4 text-primary" aria-hidden /> Kasir
        {!canUse && <Star className="w-3.5 h-3.5 text-accent" aria-hidden />}
      </h2>
      {!canUse ? (
        <p className="text-sm text-muted-foreground">
          ⭐ Di versi <b>Pro</b>, kamu bisa menambah akun kasir dengan PIN sendiri-sendiri —
          tiap transaksi tercatat siapa kasirnya, dan kasir tidak bisa buka laporan atau pengaturan.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-3">
            Tiap kasir punya PIN sendiri. Kasir hanya bisa buka layar Kasir, Menu, dan Shift.
          </p>
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
              <span className="flex-1 text-sm font-semibold">{u.name}</span>
              <span className="text-xs text-muted-foreground">kasir</span>
              <button onClick={() => removeUser(u.id!, u.name)} aria-label={`Hapus ${u.name}`}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive">
                <Trash2 className="w-4 h-4" aria-hidden />
              </button>
            </div>
          ))}
          <div className="flex gap-2 mt-3">
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Nama kasir" aria-label="Nama kasir baru"
              className="flex-1 min-w-0 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <input
              type="password" inputMode="numeric" maxLength={6}
              value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="PIN 6 angka" aria-label="PIN kasir baru"
              className="w-20 border border-border rounded-xl px-3 py-2.5 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button onClick={addUser} className="bg-primary text-primary-foreground font-bold px-3 py-2.5 rounded-xl text-sm">
              Tambah
            </button>
          </div>
          {msg && <p className="text-sm text-warning mt-2">{msg}</p>}
        </>
      )}
    </section>
  );
}

// ===================== PELANGGAN (PRO) =====================
function CustomersSection() {
  const licState = useLicenseStore((s) => s.state);
  const customers = useLiveQuery(() => db.customers.toArray(), []) ?? [];
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const canUse = hasFeature(licState, 'customers_debt');

  async function add() {
    if (!name.trim()) return;
    await db.customers.add({
      name: name.trim(), phone: phone.trim() || null, address: null, created_at: Date.now(),
    });
    setName(''); setPhone('');
  }

  async function remove(id: number, cname: string) {
    const openDebts = await db.debts.where('customer_id').equals(id)
      .and((d) => d.status === 'open').count();
    if (openDebts) { toast(`${cname} masih punya hutang aktif. Lunasi dulu di Laporan → Hutang.`, 'error'); return; }
    if (await confirmDialog(`Hapus pelanggan "${cname}"? Catatan transaksinya tetap ada.`, { danger: true, okLabel: 'Hapus' })) await db.customers.delete(id);
  }

  return (
    <section id="customers" className="bg-card rounded-2xl border border-border p-5">
      <h2 className="font-bold text-sm mb-1 flex items-center gap-2">
        <Contact className="w-4 h-4 text-primary" aria-hidden /> Pelanggan
        {!canUse && <Star className="w-3.5 h-3.5 text-accent" aria-hidden />}
      </h2>
      {!canUse ? (
        <p className="text-sm text-muted-foreground">
          ⭐ Di versi <b>Pro</b>, kamu bisa menyimpan data pelanggan (nama, HP) dan
          mencatat hutang mereka di kasir.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-3">
            Pelanggan juga otomatis tersimpan saat kamu mencatat hutang di kasir.
          </p>
          {customers.map((c) => (
            <div key={c.id} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{c.name}</p>
                {c.phone && (
                  <p className="text-xs text-muted-foreground truncate">{c.phone}</p>
                )}
              </div>
              <button onClick={() => remove(c.id!, c.name)} aria-label={`Hapus ${c.name}`}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive">
                <Trash2 className="w-4 h-4" aria-hidden />
              </button>
            </div>
          ))}
          <div className="flex gap-2 mt-3">
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Nama pelanggan" aria-label="Nama pelanggan baru"
              className="flex-1 min-w-0 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <input
              value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="No. HP" inputMode="numeric" aria-label="Nomor HP pelanggan"
              className="w-28 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button onClick={add} disabled={!name.trim()}
              className="shrink-0 bg-primary text-primary-foreground font-bold px-3 py-2.5 rounded-xl text-sm disabled:opacity-40">
              Tambah
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// ===================== SUPPLIER (PRO) =====================
function SupplierSection() {
  const licState = useLicenseStore((s) => s.state);
  const suppliers = useLiveQuery(() => db.suppliers.toArray(), []) ?? [];
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const canUse = hasFeature(licState, 'supplier');

  async function add() {
    if (!name.trim()) return;
    await db.suppliers.add({ name: name.trim(), phone: phone.trim() || null, notes: null });
    setName(''); setPhone('');
  }

  return (
    <section id="suppliers" className="bg-card rounded-2xl border border-border p-5">
      <h2 className="font-bold text-sm mb-1 flex items-center gap-2">
        <Truck className="w-4 h-4 text-primary" aria-hidden /> Supplier
        {!canUse && <Star className="w-3.5 h-3.5 text-accent" aria-hidden />}
      </h2>
      {!canUse ? (
        <p className="text-sm text-muted-foreground">
          ⭐ Di versi <b>Pro</b>, kamu bisa menyimpan daftar supplier dan mencatat dari siapa barang masuk.
        </p>
      ) : (
        <>
          {suppliers.map((s) => (
            <div key={s.id} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{s.name}</p>
                {s.phone && <p className="text-xs text-muted-foreground">{s.phone}</p>}
              </div>
              <button
                onClick={async () => { if (await confirmDialog(`Hapus supplier "${s.name}"?`, { danger: true, okLabel: 'Hapus' })) await db.suppliers.delete(s.id!); }}
                aria-label={`Hapus ${s.name}`}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" aria-hidden />
              </button>
            </div>
          ))}
          <div className="flex gap-2 mt-3">
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Nama supplier" aria-label="Nama supplier baru"
              className="flex-1 min-w-0 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <input
              value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="No. HP" inputMode="numeric" aria-label="Nomor HP supplier"
              className="w-28 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button onClick={add} disabled={!name.trim()}
              className="bg-primary text-primary-foreground font-bold px-3 py-2.5 rounded-xl text-sm disabled:opacity-40">
              Tambah
            </button>
          </div>
        </>
      )}
    </section>
  );
}
