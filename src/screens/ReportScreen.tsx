import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Printer, Star, Ban, ChevronLeft, ChevronRight } from 'lucide-react';
import { db, type Debt } from '@/db';
import { formatRp } from '@/lib/format';
import { useLicenseStore } from '@/store/license';
import { hasFeature } from '@/lib/plan';
import { askOwnerPin } from '@/lib/store-settings';
import { printReceipt } from '@/lib/receipt';
import { printClosingReport } from '@/lib/closing-report';
import { ProGate } from '@/components/ProGate';
import { Modal } from '@/components/Modal';
import { RupiahInput } from '@/components/RupiahInput';
import { Select } from '@/components/Select';
import { DatePicker } from '@/components/DatePicker';
import { toast } from '@/components/Toast';
import { confirmDialog } from '@/components/dialogs';

const DAY_MS = 86400_000;
const METHOD_LABEL: Record<string, string> = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer', debt: 'Hutang' };
const EXPENSE_CATS = ['Bahan baku', 'Gaji', 'Sewa', 'Listrik & air', 'Transport', 'Lainnya'];

function localDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftDay(d: string, n: number): string {
  const t = new Date(d + 'T00:00:00');
  t.setDate(t.getDate() + n);
  return localDateStr(t);
}

export type ReportTab = 'sales' | 'debt' | 'expense';

export function ReportScreen({ initialTab = 'sales' }: { initialTab?: ReportTab }) {
  const licState = useLicenseStore((s) => s.state);
  const [tab, setTab] = useState<ReportTab>(initialTab);

  const isPro = (f: Parameters<typeof hasFeature>[1]) => hasFeature(licState, f);

  return (
    <div className="flex flex-col h-full">
      <header className="bg-card border-b border-border px-4 py-3 shrink-0 print:hidden">
        <div className="flex gap-1" role="tablist">
          {([
            ['sales', 'Penjualan'],
            ['debt', 'Hutang'],
            ['expense', 'Pengeluaran'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition min-h-[40px] flex items-center gap-1 ${
                tab === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {id !== 'sales' && licState.plan === 'lite' && <Star className="w-3 h-3 text-accent" aria-hidden />}
              {label}
            </button>
          ))}
        </div>
      </header>

      {tab === 'sales' && <SalesTab />}
      {tab === 'debt' && (isPro('customers_debt') ? <DebtTab /> : <div className="overflow-y-auto p-4"><ProGate feature="Catatan hutang pelanggan" /></div>)}
      {tab === 'expense' && (isPro('expenses') ? <ExpenseTab /> : <div className="overflow-y-auto p-4"><ProGate feature="Pencatatan pengeluaran" /></div>)}
    </div>
  );
}

// ===================== TAB PENJUALAN =====================
function SalesTab() {
  const licState = useLicenseStore((s) => s.state);
  const [dateStr, setDateStr] = useState(localDateStr);
  const [range, setRange] = useState<7 | 30>(7);
  const [selBar, setSelBar] = useState<number | null>(null);

  const dayStart = new Date(dateStr + 'T00:00:00').getTime();
  const dayEnd = dayStart + DAY_MS;

  const orders = useLiveQuery(
    () => db.orders.where('created_at').between(dayStart, dayEnd).toArray(),
    [dayStart, dayEnd]
  ) ?? [];
  const rangeOrders = useLiveQuery(
    () => db.orders.where('created_at').between(dayEnd - range * DAY_MS, dayEnd).toArray(),
    [dayEnd, range]
  ) ?? [];
  const dayExpenses = useLiveQuery(
    () => db.expenses.where('created_at').between(dayStart, dayEnd).toArray(),
    [dayStart, dayEnd]
  ) ?? [];
  const rangeExpenses = useLiveQuery(
    () => db.expenses.where('created_at').between(dayEnd - range * DAY_MS, dayEnd).toArray(),
    [dayEnd, range]
  ) ?? [];

  const paid = orders.filter((o) => o.status === 'paid');
  const voided = orders.filter((o) => o.status === 'void');
  const totalSales = paid.reduce((sum, o) => sum + o.total, 0);
  const totalHpp = paid.reduce((s, o) => s + o.items.reduce((x, i) => x + i.hpp * i.qty, 0), 0);
  const totalExpense = dayExpenses.reduce((s, e) => s + e.amount, 0);
  const avg = paid.length ? Math.round(totalSales / paid.length) : 0;

  const byMethod = paid.reduce<Record<string, number>>((acc, o) => {
    acc[o.payment_method] = (acc[o.payment_method] ?? 0) + o.total;
    return acc;
  }, {});

  const byCashier = paid.reduce<Record<string, { n: number; total: number }>>((acc, o) => {
    const c = (acc[o.cashier_name] ??= { n: 0, total: 0 });
    c.n += 1;
    c.total += o.total;
    return acc;
  }, {});

  const byProduct = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const o of paid) {
    for (const it of o.items) {
      const cur = byProduct.get(it.product_name) ?? { name: it.product_name, qty: 0, revenue: 0 };
      cur.qty += it.qty;
      cur.revenue += it.price * it.qty - it.discount;
      byProduct.set(it.product_name, cur);
    }
  }
  const topProducts = [...byProduct.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

  const rangePaid = rangeOrders.filter((o) => o.status === 'paid');
  const days = Array.from({ length: range }, (_, i) => {
    const start = dayEnd - (range - i) * DAY_MS;
    const total = rangePaid
      .filter((o) => o.created_at >= start && o.created_at < start + DAY_MS)
      .reduce((s, o) => s + o.total, 0);
    return { start, total };
  });
  const maxDay = Math.max(...days.map((d) => d.total), 1);

  const fmtTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const fmtDayShort = (ts: number) =>
    new Date(ts).toLocaleDateString('id-ID', { weekday: 'short' });

  async function voidOrder(id: string) {
    if (!hasFeature(licState, 'void')) {
      toast('⭐ Membatalkan transaksi ada di versi Pro. Upgrade lewat menu Pengaturan.');
      return;
    }
    const pin = await askOwnerPin();
    if (pin === 'unset') { toast('Atur dulu PIN owner di Pengaturan → Keamanan.', 'error'); return; }
    if (pin === 'wrong') { toast('PIN salah.', 'error'); return; }
    if (!(await confirmDialog('Batalkan transaksi ini? Stok akan dikembalikan.', { danger: true, okLabel: 'Batalkan' }))) return;
    const order = await db.orders.get(id);
    if (!order) return;
    await db.orders.update(id, { status: 'void' });
    for (const it of order.items) {
      const menu = await db.menus.get(it.product_id);
      if (menu?.stock != null) {
        await db.menus.update(menu.id, { stock: menu.stock + it.qty, updated_at: Date.now() });
      }
    }
  }

  async function exportExcel() {
    // exceljs di-load saat dibutuhkan saja (chunk terpisah) — pola yang sama dengan ipos-v1
    const { Workbook } = await import('exceljs');
    const wb = new Workbook();
    const ws = wb.addWorksheet(`Laporan ${dateStr}`);
    ws.columns = [{ width: 20 }, { width: 14 }, { width: 10 }, { width: 8 }, { width: 12 }, { width: 12 }, { width: 12 }];
    ws.addRow(['Waktu', 'Kasir', 'Metode', 'Status', 'Subtotal', 'Potongan', 'Total']);
    ws.getRow(1).font = { bold: true };
    for (const o of orders) {
      ws.addRow([
        new Date(o.created_at).toLocaleString('id-ID'),
        o.cashier_name,
        METHOD_LABEL[o.payment_method] ?? o.payment_method,
        o.status === 'paid' ? 'Lunas' : o.status === 'void' ? 'Batal' : 'Open',
        o.subtotal, o.discount, o.total,
      ]);
    }
    ws.addRow([]);
    for (const [label, val] of [
      ['Omzet', totalSales],
      ['Modal (HPP)', totalHpp],
      ['Laba kotor', totalSales - totalHpp],
      ['Pengeluaran', totalExpense],
      ['Laba bersih', totalSales - totalHpp - totalExpense],
    ] as const) {
      const r = ws.addRow([label, '', '', '', '', '', val]);
      r.font = { bold: true };
    }
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `laporan-${dateStr}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function printClosing() {
    const expenseTotal = rangeExpenses.reduce((s, e) => s + e.amount, 0);
    void printClosingReport(range, dayEnd, rangePaid, expenseTotal);
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-lg w-full mx-auto">
      <div className="flex items-center gap-2 print:hidden">
        {/* Navigasi hari: kasir hampir selalu geser sehari-sehari; kalender native untuk lompat jauh */}
        <div className="flex items-center bg-card border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setDateStr(shiftDay(dateStr, -1))}
            aria-label="Hari sebelumnya"
            className="w-9 h-10 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden />
          </button>
          <DatePicker value={dateStr} onChange={setDateStr} max={localDateStr()} label="Pilih tanggal laporan" />
          <button
            onClick={() => setDateStr(shiftDay(dateStr, 1))}
            disabled={dateStr >= localDateStr()}
            aria-label="Hari berikutnya"
            className="w-9 h-10 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" aria-hidden />
          </button>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={exportExcel}
            className="flex items-center gap-1.5 border border-border rounded-xl px-3 py-2 text-sm font-semibold hover:bg-muted"
          >
            <Download className="w-4 h-4" aria-hidden /> Excel
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 border border-border rounded-xl px-3 py-2 text-sm font-semibold hover:bg-muted"
          >
            <Printer className="w-4 h-4" aria-hidden /> PDF
          </button>
        </div>
      </div>

      {/* Ringkasan hari */}
      <div className="bg-card rounded-2xl p-5 shadow-sm border border-border">
        <p className="text-sm text-muted-foreground mb-1">Uang masuk hari ini</p>
        <p className="text-3xl font-extrabold text-primary tabular-nums mb-3">{formatRp(totalSales)}</p>
        <div className="flex gap-4 text-sm flex-wrap">
          <span className="text-muted-foreground">{paid.length}x transaksi</span>
          {avg > 0 && <span className="text-muted-foreground">rata-rata {formatRp(avg)}</span>}
          {voided.length > 0 && <span className="text-destructive">{voided.length}x dibatalkan</span>}
        </div>
      </div>

      {/* Laba rugi sederhana */}
      {(totalHpp > 0 || totalExpense > 0) && (
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border space-y-2">
          <h3 className="text-sm font-bold mb-1">Untung-rugi hari ini</h3>
          <Row label="Omzet" value={formatRp(totalSales)} />
          <Row label="Modal terjual (HPP)" value={`−${formatRp(totalHpp)}`} />
          <Row label="Laba kotor" value={formatRp(totalSales - totalHpp)} bold />
          <Row label="Pengeluaran" value={`−${formatRp(totalExpense)}`} />
          <hr className="border-border" />
          <div className="flex justify-between font-extrabold">
            <span>Laba bersih</span>
            <span className={`tabular-nums ${totalSales - totalHpp - totalExpense >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatRp(totalSales - totalHpp - totalExpense)}
            </span>
          </div>
        </div>
      )}

      {/* Grafik omzet */}
      <div className="bg-card rounded-2xl p-5 shadow-sm border border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold">Omzet {range} hari terakhir</h3>
          <div className="flex gap-1 print:hidden">
            {([7, 30] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-0.5 ${range === r ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                {r} hari
              </button>
            ))}
          </div>
        </div>
        {/* Tooltip: nilai hari yang di-tap (mobile tak punya hover) */}
        <div className="h-8 mb-1 flex items-center justify-center">
          {selBar != null && days[selBar] && (
            <div className="bg-foreground text-white text-xs font-semibold px-3 py-1.5 rounded-lg tabular-nums">
              {new Date(days[selBar].start).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
              {' · '}{formatRp(days[selBar].total)}
            </div>
          )}
        </div>
        <div className="flex items-end gap-[3px] h-24" role="img"
          aria-label={`Omzet ${range} hari terakhir, tertinggi ${formatRp(maxDay)}`}>
          {days.map((d, i) => (
            <button
              key={d.start}
              type="button"
              onClick={() => setSelBar(selBar === i ? null : i)}
              aria-label={`${fmtDayShort(d.start)} ${formatRp(d.total)}`}
              className="flex-1 flex flex-col items-center gap-1 h-full justify-end group"
            >
              <div
                className={`w-full rounded-t transition-colors ${
                  selBar === i ? 'bg-primary-light' : d.start === dayStart ? 'bg-primary' : 'bg-accent/50 group-hover:bg-accent/80'
                }`}
                style={{ height: `${Math.max(3, (d.total / maxDay) * 100)}%` }}
              />
              {range === 7 && (
                <span className={`text-[10px] ${d.start === dayStart ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                  {fmtDayShort(d.start)}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={printClosing}
          className="w-full mt-3 flex items-center justify-center gap-1.5 border border-border rounded-xl py-2.5 text-sm font-semibold hover:bg-muted print:hidden"
        >
          <Printer className="w-4 h-4" aria-hidden /> Cetak Laporan Closing {range} Hari
        </button>
      </div>

      {/* Per kasir */}
      {Object.keys(byCashier).length > 1 && (
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border space-y-2">
          <h3 className="text-sm font-bold mb-1">Per kasir</h3>
          {Object.entries(byCashier).map(([name, c]) => (
            <div key={name} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{name} · {c.n}x</span>
              <span className="font-semibold tabular-nums">{formatRp(c.total)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Menu terlaris */}
      {topProducts.length > 0 && (
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border">
          <h3 className="text-sm font-bold mb-3">Paling laku hari ini</h3>
          <div className="space-y-2.5">
            {topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3 text-sm">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? 'bg-accent text-white' : 'bg-muted text-muted-foreground'}`}>
                  {i + 1}
                </span>
                <span className="flex-1 truncate font-medium">{p.name}</span>
                <span className="text-muted-foreground shrink-0">{p.qty}x</span>
                <span className="font-semibold tabular-nums w-20 text-right shrink-0">{formatRp(p.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metode pembayaran */}
      {Object.keys(byMethod).length > 0 && (
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border space-y-2">
          <h3 className="text-sm font-bold mb-1">Uang masuk lewat mana?</h3>
          {(['cash', 'qris', 'transfer', 'debt'] as const).filter((m) => byMethod[m]).map((m) => (
            <div key={m} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{METHOD_LABEL[m]}</span>
              <span className="font-semibold tabular-nums">{formatRp(byMethod[m])}</span>
            </div>
          ))}
        </div>
      )}

      {/* Daftar transaksi */}
      {orders.length === 0 ? (
        <div className="text-center py-10 px-6">
          <span className="text-4xl block mb-3" aria-hidden>🧾</span>
          <p className="text-sm text-muted-foreground">
            Belum ada penjualan di tanggal ini. Begitu ada yang beli, catatannya muncul di sini.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <h3 className="text-sm font-bold">Semua transaksi</h3>
          {[...orders].filter((o) => o.status !== 'open').sort((a, b) => b.created_at - a.created_at).map((o) => (
            <div
              key={o.id}
              className="bg-card rounded-xl px-4 py-3 shadow-sm border border-border flex items-center gap-2"
            >
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold tabular-nums ${o.status === 'void' ? 'line-through text-muted-foreground' : ''}`}>
                  {formatRp(o.total)}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {fmtTime(o.created_at)} · {o.items.reduce((n, i) => n + i.qty, 0)} item · {METHOD_LABEL[o.payment_method] ?? o.payment_method}
                  {o.customer_name ? ` · ${o.customer_name}` : ''} · {o.cashier_name}
                </p>
              </div>
              {o.status === 'paid' ? (
                <>
                  <span className="text-xs bg-success/10 text-success font-semibold px-2.5 py-1 rounded-full shrink-0">Lunas</span>
                  <button onClick={() => printReceipt(o)} aria-label="Cetak ulang struk"
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted shrink-0 print:hidden">
                    <Printer className="w-4 h-4" aria-hidden />
                  </button>
                  <button onClick={() => voidOrder(o.id)} aria-label="Batalkan transaksi"
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-muted shrink-0 print:hidden">
                    <Ban className="w-4 h-4" aria-hidden />
                  </button>
                </>
              ) : (
                <span className="text-xs bg-destructive/10 text-destructive font-semibold px-2.5 py-1 rounded-full shrink-0">Dibatalkan</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? 'font-bold' : ''}`}>
      <span className={bold ? '' : 'text-muted-foreground'}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

// ===================== TAB HUTANG =====================
function DebtTab() {
  const [payDebt, setPayDebt] = useState<Debt | null>(null);
  const debts = useLiveQuery(
    async () => (await db.debts.toArray()).sort((a, b) =>
      a.status === b.status ? b.created_at - a.created_at : a.status === 'open' ? -1 : 1
    ),
    []
  ) ?? [];

  const totalOutstanding = debts.filter((d) => d.status === 'open').reduce((s, d) => s + (d.total - d.paid), 0);
  const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-lg w-full mx-auto">
      <div className="bg-card rounded-2xl p-5 shadow-sm border border-border">
        <p className="text-sm text-muted-foreground mb-1">Total piutang belum dibayar</p>
        <p className="text-3xl font-extrabold text-warning tabular-nums">{formatRp(totalOutstanding)}</p>
      </div>

      {debts.length === 0 ? (
        <div className="text-center py-10 px-6">
          <span className="text-4xl block mb-3" aria-hidden>🤝</span>
          <p className="text-sm text-muted-foreground">
            Belum ada catatan hutang. Kalau ada pembeli yang ngutang, pilih "Hutang" saat pembayaran di kasir.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {debts.map((d) => (
            <div key={d.id} className="bg-card rounded-xl px-4 py-3 shadow-sm border border-border flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{d.customer_name}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(d.created_at)} · total {formatRp(d.total)} · terbayar {formatRp(d.paid)}
                </p>
              </div>
              {d.status === 'open' ? (
                <>
                  <p className="text-sm font-extrabold text-warning tabular-nums shrink-0">{formatRp(d.total - d.paid)}</p>
                  <button
                    onClick={() => setPayDebt(d)}
                    className="shrink-0 bg-primary text-primary-foreground text-sm font-bold px-3 py-2 rounded-xl"
                  >
                    Bayar
                  </button>
                </>
              ) : (
                <span className="text-xs bg-success/10 text-success font-semibold px-2.5 py-1 rounded-full shrink-0">Lunas</span>
              )}
            </div>
          ))}
        </div>
      )}

      {payDebt && <PayDebtModal debt={payDebt} onClose={() => setPayDebt(null)} />}
    </div>
  );
}

function PayDebtModal({ debt, onClose }: { debt: Debt; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const remaining = debt.total - debt.paid;
  const payments = useLiveQuery(
    () => db.debt_payments.where('debt_id').equals(debt.id!).toArray(),
    [debt.id]
  ) ?? [];

  async function save() {
    const n = Math.min(Number(amount), remaining);
    if (!n || n <= 0) return;
    setSaving(true);
    // log cicilan permanen — tidak pernah diubah/dihapus (PRD Pro)
    await db.debt_payments.add({ debt_id: debt.id!, amount: n, created_at: Date.now() });
    const paid = debt.paid + n;
    await db.debts.update(debt.id!, { paid, status: paid >= debt.total ? 'paid' : 'open' });
    setSaving(false);
    onClose();
  }

  return (
    <Modal onClose={onClose}>
      <div className="px-6 pt-5 pb-4 border-b border-border">
        <h2 className="font-bold text-lg">Bayar Hutang — {debt.customer_name}</h2>
        <p className="text-sm text-muted-foreground">Sisa: <b className="text-warning tabular-nums">{formatRp(remaining)}</b></p>
      </div>
      <div className="px-6 py-4 space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="payAmount">Jumlah dibayar</label>
          <RupiahInput
            id="payAmount"
            value={amount} onChange={setAmount}
            placeholder={String(remaining)} autoFocus
            className="w-full border border-border rounded-xl px-3 py-2.5 text-lg font-bold text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button onClick={() => setAmount(String(remaining))} className="text-sm text-primary font-semibold mt-1.5">
            Lunasi semua ({formatRp(remaining)})
          </button>
        </div>
        {payments.length > 0 && (
          <div className="bg-muted rounded-xl px-4 py-3 space-y-1">
            <p className="text-xs font-bold text-muted-foreground mb-1">Riwayat cicilan</p>
            {payments.map((p) => (
              <div key={p.id} className="flex justify-between text-xs text-muted-foreground">
                <span>{new Date(p.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span className="tabular-nums">{formatRp(p.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="px-6 pb-5 flex gap-3">
        <button onClick={onClose} className="flex-1 border border-border rounded-xl py-3 text-sm text-muted-foreground hover:bg-muted">
          Batal
        </button>
        <button
          onClick={save}
          disabled={saving || !amount || Number(amount) <= 0}
          className="flex-1 bg-success text-white font-bold py-3 rounded-xl text-sm disabled:opacity-40"
        >
          {saving ? 'Menyimpan…' : 'Catat Pembayaran'}
        </button>
      </div>
    </Modal>
  );
}

// ===================== TAB PENGELUARAN =====================
function ExpenseTab() {
  const [showAdd, setShowAdd] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATS[0]);
  const [method, setMethod] = useState<'cash' | 'qris' | 'transfer'>('cash');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const expenses = useLiveQuery(
    () => db.expenses.where('created_at').aboveOrEqual(monthStart.getTime()).reverse().toArray(),
    [monthStart.getTime()]
  ) ?? [];
  const totalMonth = expenses.reduce((s, e) => s + e.amount, 0);

  async function save() {
    const n = Number(amount);
    if (!n || n <= 0) return;
    setSaving(true);
    await db.expenses.add({
      amount: n, category, method, notes: note.trim() || null, created_at: Date.now(),
    });
    setSaving(false);
    setShowAdd(false);
    setAmount(''); setNote('');
  }

  const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-lg w-full mx-auto">
      <div className="bg-card rounded-2xl p-5 shadow-sm border border-border flex items-center gap-3">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-1">Pengeluaran bulan ini</p>
          <p className="text-3xl font-extrabold text-destructive tabular-nums">{formatRp(totalMonth)}</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-primary text-primary-foreground text-sm font-bold px-4 py-2.5 rounded-xl shrink-0"
        >
          + Catat
        </button>
      </div>

      {expenses.length === 0 ? (
        <div className="text-center py-10 px-6">
          <span className="text-4xl block mb-3" aria-hidden>💸</span>
          <p className="text-sm text-muted-foreground">
            Catat biaya belanja bahan, gaji, sewa, listrik — biar laba bersih di laporan beneran akurat.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((e) => (
            <div key={e.id} className="bg-card rounded-xl px-4 py-3 shadow-sm border border-border flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{e.category}{e.notes ? ` · ${e.notes}` : ''}</p>
                <p className="text-xs text-muted-foreground">{fmtDate(e.created_at)} · {METHOD_LABEL[e.method]}</p>
              </div>
              <p className="text-sm font-extrabold text-destructive tabular-nums shrink-0">−{formatRp(e.amount)}</p>
              <button
                onClick={async () => { if (await confirmDialog('Hapus catatan pengeluaran ini?', { danger: true, okLabel: 'Hapus' })) await db.expenses.delete(e.id!); }}
                className="text-xs text-muted-foreground hover:text-destructive shrink-0"
              >
                Hapus
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <Modal onClose={() => setShowAdd(false)}>
          <div className="px-6 pt-5 pb-4 border-b border-border">
            <h2 className="font-bold text-lg">Catat Pengeluaran</h2>
          </div>
          <div className="px-6 py-4 space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="expAmount">
                Jumlah <span className="text-destructive">*</span>
              </label>
              <RupiahInput
                id="expAmount"
                value={amount} onChange={setAmount}
                placeholder="50000" autoFocus
                className="w-full border border-border rounded-xl px-3 py-2.5 text-lg font-bold text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="expCat">Untuk apa?</label>
              <Select
                id="expCat" value={category} onChange={setCategory}
                items={EXPENSE_CATS.map((c) => ({ value: c, label: c }))}
              />
            </div>
            <div className="flex gap-2" role="radiogroup" aria-label="Dibayar pakai">
              {(['cash', 'qris', 'transfer'] as const).map((m) => (
                <button
                  key={m} role="radio" aria-checked={method === m}
                  onClick={() => setMethod(m)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border min-h-[40px] ${method === m ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}
                >
                  {METHOD_LABEL[m]}
                </button>
              ))}
            </div>
            <input
              value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Catatan (boleh kosong)"
              aria-label="Catatan pengeluaran"
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="px-6 pb-5 flex gap-3">
            <button onClick={() => setShowAdd(false)} className="flex-1 border border-border rounded-xl py-3 text-sm text-muted-foreground hover:bg-muted">
              Batal
            </button>
            <button
              onClick={save}
              disabled={saving || !amount || Number(amount) <= 0}
              className="flex-1 bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm disabled:opacity-40"
            >
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
