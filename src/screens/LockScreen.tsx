import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Lock, Delete } from 'lucide-react';
import { db } from '@/db';
import { hashPin, hashRecoveryCode } from '@/lib/license';
import { getSetting, setSetting, KEYS } from '@/lib/store-settings';
import { useSessionStore } from '@/store/session';
import { Modal } from '@/components/Modal';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

/** Form pulihkan PIN owner pakai kode pemulihan — dipakai saat owner lupa PIN. */
function RecoverOwnerPinModal({ onClose, onRecovered }: { onClose: () => void; onRecovered: () => void }) {
  const [code, setCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError('');
    if (!code.trim()) { setError('Masukkan kode pemulihan.'); return; }
    if (!/^\d{6}$/.test(newPin)) { setError('PIN baru harus 6 angka.'); return; }
    if (newPin !== confirmPin) { setError('Konfirmasi PIN tidak sama.'); return; }
    setSaving(true);
    try {
      const stored = await getSetting(KEYS.ownerRecoveryCode);
      if (!stored || (await hashRecoveryCode(code)) !== stored) {
        setError('Kode pemulihan salah.');
        return;
      }
      await setSetting(KEYS.ownerPin, await hashPin(newPin));
      onRecovered();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="px-6 pt-5 pb-4 border-b border-border">
        <h2 className="font-bold text-lg">Pulihkan PIN Owner</h2>
        <p className="text-sm text-muted-foreground mt-1">Masukkan kode pemulihan yang dicatat saat PIN pertama dibuat.</p>
      </div>
      <div className="px-6 py-4 space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="recoveryCode">Kode pemulihan</label>
          <input
            id="recoveryCode"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Contoh: A7K9X2M4"
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm tracking-widest text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="newOwnerPin">PIN baru (6 angka)</label>
          <input
            id="newOwnerPin"
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="confirmOwnerPin">Ulangi PIN baru</label>
          <input
            id="confirmOwnerPin"
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <div className="px-6 pb-5 flex gap-3">
        <button onClick={onClose} className="flex-1 border border-border rounded-xl py-3 text-sm text-muted-foreground hover:bg-muted min-h-[48px]">
          Batal
        </button>
        <button
          onClick={submit}
          disabled={saving}
          className="flex-1 bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm disabled:opacity-40 min-h-[48px]"
        >
          {saving ? 'Memeriksa…' : 'Pulihkan PIN'}
        </button>
      </div>
    </Modal>
  );
}

type LockState = { attempts: number; lockedUntil: number | null };
const idOf = (u: 'owner' | number) => (u === 'owner' ? 'owner' : `kasir:${u}`);

/** Layar kunci saat multi-user aktif: pilih siapa yang jaga, masukkan PIN. */
export function LockScreen() {
  const login = useSessionStore((s) => s.login);
  const users = useLiveQuery(() => db.users.toArray(), []) ?? [];
  const [selected, setSelected] = useState<'owner' | number | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  // percobaan gagal & lockout melekat ke identitas yang dicoba, bukan ke sesi UI —
  // pindah-pindah pilih user tidak boleh bisa dipakai buat reset cooldown siapa pun.
  const [locks, setLocks] = useState<Record<string, LockState>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [showRecover, setShowRecover] = useState(false);

  const selectedId = selected == null ? null : idOf(selected);
  const lockedUntil = selectedId ? locks[selectedId]?.lockedUntil ?? null : null;
  const attempts = selectedId ? locks[selectedId]?.attempts ?? 0 : 0;
  const locked = lockedUntil != null && lockedUntil > Date.now();

  // hitung mundur kunci — cek tiap detik, otomatis buka kalau sudah lewat
  useEffect(() => {
    if (!lockedUntil || !selectedId) return;
    const tick = () => {
      const left = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (left <= 0) {
        setLocks((m) => ({ ...m, [selectedId]: { attempts: 0, lockedUntil: null } }));
        setError('');
        return;
      }
      setSecondsLeft(left);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil, selectedId]);

  function selectUser(next: 'owner' | number) {
    if (next === selected) return; // klik ulang user yang sama tidak boleh reset cooldown-nya
    setSelected(next);
    setPin('');
    setError('');
  }

  async function tryLogin(fullPin: string) {
    const hash = await hashPin(fullPin);
    if (selected === 'owner') {
      const stored = await getSetting(KEYS.ownerPin);
      if (stored === hash) { login({ name: 'Owner', role: 'owner' }); return; }
    } else {
      const user = users.find((u) => u.id === selected);
      if (user && user.pin_hash === hash) { login({ name: user.name, role: 'kasir' }); return; }
    }
    if (!selectedId) return;
    const next = attempts + 1;
    setPin('');
    if (next >= MAX_ATTEMPTS) {
      setLocks((m) => ({ ...m, [selectedId]: { attempts: next, lockedUntil: Date.now() + LOCKOUT_SECONDS * 1000 } }));
      setError(`Terlalu banyak PIN salah. Coba lagi dalam ${LOCKOUT_SECONDS} detik.`);
    } else {
      setLocks((m) => ({ ...m, [selectedId]: { attempts: next, lockedUntil: null } }));
      setError('PIN salah. Coba lagi ya.');
    }
  }

  function press(d: string) {
    if (locked) return;
    setError('');
    if (d === 'del') { setPin((p) => p.slice(0, -1)); return; }
    const next = pin + d;
    if (next.length > 6) return;
    setPin(next);
    // PIN selalu 6 digit — coba baru setelah lengkap, biar tidak salah gara-gara belum selesai ngetik
    if (next.length === 6) void tryLogin(next);
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xs text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4">
          <Lock className="w-7 h-7" aria-hidden />
        </div>
        <h1 className="text-xl font-extrabold mb-1">Siapa yang jaga kasir?</h1>
        <p className="text-sm text-muted-foreground mb-5">Pilih nama kamu, lalu masukkan PIN.</p>

        <div className="flex flex-wrap justify-center gap-2 mb-6">
          <button
            onClick={() => selectUser('owner')}
            className={`px-4 py-2 rounded-full text-sm font-bold border min-h-[40px] ${selected === 'owner' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground'}`}
          >
            👑 Owner
          </button>
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => selectUser(u.id!)}
              className={`px-4 py-2 rounded-full text-sm font-bold border min-h-[40px] ${selected === u.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground'}`}
            >
              {u.name}
            </button>
          ))}
        </div>

        {selected != null && (
          <>
            <div className="flex justify-center gap-2 mb-2 h-4" aria-label="PIN">
              {Array.from({ length: 6 }).map((_, i) => (
                <span key={i} className={`w-3 h-3 rounded-full ${i < pin.length ? 'bg-primary' : 'bg-border'}`} />
              ))}
            </div>
            <p className="text-sm text-destructive min-h-[20px] mb-3 px-2 leading-snug">
              {locked ? `Terlalu banyak PIN salah. Coba lagi dalam ${secondsLeft} detik.` : error}
            </p>
            <div className={`grid grid-cols-3 gap-2 ${locked ? 'opacity-40 pointer-events-none' : ''}`}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((d, i) =>
                d === '' ? <span key={i} /> : (
                  <button
                    key={i}
                    onClick={() => press(d)}
                    disabled={locked}
                    aria-label={d === 'del' ? 'Hapus' : d}
                    className="h-14 rounded-xl bg-card border border-border text-xl font-bold hover:bg-muted active:scale-95 transition flex items-center justify-center"
                  >
                    {d === 'del' ? <Delete className="w-5 h-5" aria-hidden /> : d}
                  </button>
                )
              )}
            </div>
            {selected === 'owner' && (
              <button
                onClick={() => setShowRecover(true)}
                className="mt-4 text-sm text-primary font-semibold hover:underline"
              >
                Lupa PIN?
              </button>
            )}
          </>
        )}
      </div>
      {showRecover && (
        <RecoverOwnerPinModal
          onClose={() => setShowRecover(false)}
          onRecovered={() => {
            setShowRecover(false); setPin(''); setError('');
            if (selectedId) setLocks((m) => ({ ...m, [selectedId]: { attempts: 0, lockedUntil: null } }));
          }}
        />
      )}
    </div>
  );
}
