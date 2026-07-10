import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Clock, ChevronLeft } from 'lucide-react';
import { db, type Order, type Shift } from '@/db';
import { formatRp } from '@/lib/format';
import { useSessionStore } from '@/store/session';
import { RupiahInput } from '@/components/RupiahInput';
import { useLicenseStore } from '@/store/license';
import { hasFeature } from '@/lib/plan';
import { ProGate } from '@/components/ProGate';

function BackBtn({ onBack }: { onBack?: () => void }) {
  if (!onBack) return null;
  return (
    <button
      onClick={onBack}
      aria-label="Kembali ke Lainnya"
      className="w-9 h-9 -ml-2 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted"
    >
      <ChevronLeft className="w-5 h-5" aria-hidden />
    </button>
  );
}

export function ShiftScreen({ onBack }: { onBack?: () => void }) {
  const licState = useLicenseStore((s) => s.state);
  const [cashierName, setCashierName] = useState(() => useSessionStore.getState().user?.name ?? '');
  const [openingCash, setOpeningCash] = useState('');
  const [closing, setClosing] = useState(false);
  const [closingCash, setClosingCash] = useState('');
  const [saving, setSaving] = useState(false);

  const openShift = useLiveQuery<Shift | undefined>(
    () => db.shifts.where('status').equals('open').first(),
    []
  );

  const shiftOrders = useLiveQuery(
    () => openShift
      ? db.orders.where('created_at').aboveOrEqual(openShift.opened_at).toArray()
      : ([] as Order[]),
    [openShift?.id]
  ) ?? [];

  const paidOrders = shiftOrders.filter((o) => o.status === 'paid');
  const totalSales = paidOrders.reduce((sum, o) => sum + o.total, 0);
  const cashSales = paidOrders.filter((o) => o.payment_method === 'cash').reduce((s, o) => s + o.total, 0);

  async function handleOpen() {
    if (!cashierName.trim()) return;
    setSaving(true);
    await db.shifts.add({
      status: 'open',
      cashier_name: cashierName.trim(),
      opening_cash: Number(openingCash) || 0,
      closing_cash: null,
      opened_at: Date.now(),
      closed_at: null,
      notes: null,
    });
    setSaving(false);
    setCashierName('');
    setOpeningCash('');
  }

  async function handleClose() {
    if (!openShift?.id) return;
    setSaving(true);
    await db.shifts.update(openShift.id, {
      status: 'closed',
      closing_cash: Number(closingCash) || 0,
      closed_at: Date.now(),
    });
    setSaving(false);
    setClosing(false);
    setClosingCash('');
  }

  const fmt = (ts: number) =>
    new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  // Perkiraan uang di laci = uang awal + penjualan tunai
  const expectedCash = (openShift?.opening_cash ?? 0) + cashSales;

  // Manajemen shift = fitur Pro (PRD §5.3)
  if (!hasFeature(licState, 'shift')) {
    return (
      <div className="flex flex-col h-full">
        <header className="bg-card border-b border-border px-4 py-3 shrink-0 flex items-center gap-2">
          <BackBtn onBack={onBack} />
          <h1 className="font-bold text-lg">Shift</h1>
        </header>
        <div className="flex-1 overflow-y-auto p-4">
          <ProGate feature="Manajemen shift kasir" />
        </div>
      </div>
    );
  }

  if (openShift) {
    return (
      <div className="flex flex-col h-full">
        <header className="bg-card border-b border-border px-4 py-3 shrink-0 flex items-center gap-2">
          <BackBtn onBack={onBack} />
          <h1 className="font-bold text-lg">Shift</h1>
          <span className="text-xs font-bold bg-success/10 text-success px-2.5 py-1 rounded-full">
            Sedang buka
          </span>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-lg w-full mx-auto">
          <div className="bg-card rounded-2xl p-5 shadow-sm border border-border space-y-3">
            <Row label="Kasir" value={openShift.cashier_name} />
            <Row label="Mulai jam" value={fmt(openShift.opened_at)} />
            <Row label="Uang awal di laci" value={formatRp(openShift.opening_cash)} />
            <hr className="border-border" />
            <Row label="Transaksi" value={`${paidOrders.length}x`} />
            <Row label="Penjualan tunai" value={formatRp(cashSales)} />
            <div className="flex justify-between font-extrabold text-base">
              <span>Total penjualan</span>
              <span className="text-primary tabular-nums">{formatRp(totalSales)}</span>
            </div>
          </div>

          <div className="bg-accent-soft rounded-2xl p-4 text-sm">
            <p className="text-muted-foreground">Perkiraan uang tunai di laci sekarang</p>
            <p className="font-extrabold text-lg text-primary tabular-nums">{formatRp(expectedCash)}</p>
          </div>

          {closing ? (
            <div className="bg-card rounded-2xl p-5 shadow-sm border border-border space-y-3">
              <h3 className="font-bold">Tutup Shift</h3>
              <div>
                <label className="block text-sm mb-1.5" htmlFor="closingCash">
                  Hitung uang di laci, lalu isi jumlahnya
                </label>
                <RupiahInput
                  id="closingCash"
                  value={closingCash}
                  onChange={setClosingCash}
                  placeholder={String(expectedCash)}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {closingCash !== '' && Number(closingCash) !== expectedCash && (
                  <p className={`text-sm mt-1.5 ${Number(closingCash) < expectedCash ? 'text-destructive' : 'text-success'}`}>
                    {Number(closingCash) < expectedCash
                      ? `Kurang ${formatRp(expectedCash - Number(closingCash))} dari perkiraan.`
                      : `Lebih ${formatRp(Number(closingCash) - expectedCash)} dari perkiraan.`}
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setClosing(false)}
                  className="flex-1 border border-border rounded-xl py-3 text-sm hover:bg-muted"
                >
                  Batal
                </button>
                <button
                  onClick={handleClose}
                  disabled={saving}
                  className="flex-1 bg-destructive text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50"
                >
                  {saving ? 'Menyimpan…' : 'Tutup Shift'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setClosing(true)}
              className="w-full border-2 border-destructive text-destructive font-bold py-3.5 rounded-xl text-sm hover:bg-destructive/5"
            >
              Tutup Shift
            </button>
          )}

          <ShiftHistory />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="bg-card border-b border-border px-4 py-3 shrink-0 flex items-center gap-2">
        <BackBtn onBack={onBack} />
        <h1 className="font-bold text-lg">Shift</h1>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-lg w-full mx-auto">
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border w-full max-w-sm mx-auto space-y-4">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-accent-soft text-primary flex items-center justify-center mx-auto mb-3">
              <Clock className="w-7 h-7" aria-hidden />
            </div>
            <h2 className="font-bold text-lg">Buka Shift Dulu, Yuk</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Catat siapa yang jaga kasir dan uang awal di laci, biar pas tutup nanti hitungannya jelas.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="cashierName">
              Yang jaga kasir <span className="text-destructive">*</span>
            </label>
            <input
              id="cashierName"
              value={cashierName}
              onChange={(e) => setCashierName(e.target.value)}
              placeholder="Contoh: Ibu Sari"
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="openingCash">Uang awal di laci</label>
            <RupiahInput
              id="openingCash"
              value={openingCash}
              onChange={setOpeningCash}
              placeholder="100000"
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={handleOpen}
            disabled={!cashierName.trim() || saving}
            className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl text-sm disabled:opacity-40"
          >
            {saving ? 'Menyimpan…' : 'Mulai Shift'}
          </button>
        </div>

        <ShiftHistory />
      </div>
    </div>
  );
}

/** Riwayat 10 shift terakhir + penjualan per shift (laporan per-shift, PRD Pro). */
function ShiftHistory() {
  const rows = useLiveQuery(async () => {
    const shifts = (await db.shifts.where('status').equals('closed').toArray())
      .sort((a, b) => b.opened_at - a.opened_at)
      .slice(0, 10);
    return Promise.all(shifts.map(async (s) => {
      const paid = (await db.orders.where('shift_id').equals(s.id!).toArray())
        .filter((o) => o.status === 'paid');
      const cash = paid.filter((o) => o.payment_method === 'cash').reduce((x, o) => x + o.total, 0);
      return { s, n: paid.length, total: paid.reduce((x, o) => x + o.total, 0), cash };
    }));
  }, []) ?? [];

  if (rows.length === 0) return null;

  const fmtDay = (ts: number) =>
    new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  const fmtTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold">Shift sebelumnya</h3>
      {rows.map(({ s, n, total, cash }) => {
        // selisih uang laci: yang dihitung saat tutup vs perkiraan (awal + tunai)
        const diff = (s.closing_cash ?? 0) - (s.opening_cash + cash);
        return (
          <div key={s.id} className="bg-card rounded-xl px-4 py-3 shadow-sm border border-border">
            <div className="flex justify-between text-sm">
              <span className="font-bold">{s.cashier_name}</span>
              <span className="font-extrabold text-primary tabular-nums">{formatRp(total)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {fmtDay(s.opened_at)} · {fmtTime(s.opened_at)}–{s.closed_at ? fmtTime(s.closed_at) : '?'} · {n}x transaksi
              {diff !== 0 && (
                <span className={diff < 0 ? 'text-destructive font-semibold' : 'text-success font-semibold'}>
                  {' '}· laci {diff < 0 ? 'kurang' : 'lebih'} {formatRp(Math.abs(diff))}
                </span>
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
