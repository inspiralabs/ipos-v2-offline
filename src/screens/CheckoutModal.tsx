import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, Printer, Share2, Star } from 'lucide-react';
import { db, type Order, type PayMethod } from '@/db';
import { useCartStore, getCartTotals } from '@/store/pos';
import { useLicenseStore } from '@/store/license';
import { useSessionStore } from '@/store/session';
import { getLicenseState, saveLicenseState } from '@/lib/license';
import { hasFeature } from '@/lib/plan';
import { formatRp } from '@/lib/format';
import { printReceipt, shareReceipt } from '@/lib/receipt';
import { Modal } from '@/components/Modal';
import { RupiahInput } from '@/components/RupiahInput';

const METHOD_LABEL: Record<PayMethod, string> = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer', debt: 'Hutang' };

/** Saran uang pasaran: uang pas + pecahan umum di atas total. */
function cashSuggestions(total: number): number[] {
  const notes = [5000, 10000, 20000, 50000, 100000];
  const ups = notes.map((n) => Math.ceil(total / n) * n).filter((v) => v > total);
  return [total, ...Array.from(new Set(ups))].slice(0, 4);
}

export function CheckoutModal({ onClose }: { onClose: () => void }) {
  const { items, discount, tableNumber, customerName: cartCustomerName, customerPhone: cartCustomerPhone, notes, resumedOrderId, clear } = useCartStore();
  const licState = useLicenseStore((s) => s.state);
  const refresh = useLicenseStore((s) => s.refresh);
  const { subtotal, total } = getCartTotals(items, discount);
  const [method, setMethod] = useState<PayMethod>('cash');
  const [cashInput, setCashInput] = useState('');
  // prefill dari panel pelanggan & meja di keranjang — kasir tidak perlu ketik ulang di sini
  const [custName, setCustName] = useState(cartCustomerName);
  const [custPhone, setCustPhone] = useState(cartCustomerPhone);
  const [custId, setCustId] = useState<number | null>(null);
  const [dpInput, setDpInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<Order | null>(null);

  const canDebt = hasFeature(licState, 'customers_debt');
  const customers = useLiveQuery(() => db.customers.toArray(), []) ?? [];

  const cashReceived = method === 'cash' ? Number(cashInput) : method === 'debt' ? Number(dpInput) || 0 : total;
  const change = method === 'cash' ? Math.max(0, cashReceived - total) : 0;
  const canPay =
    method === 'cash' ? cashReceived >= total :
    method === 'debt' ? custName.trim().length > 0 && cashReceived < total :
    true;

  async function handlePay() {
    setLoading(true);
    try {
      const openShift = await db.shifts.where('status').equals('open').first();

      // pelanggan hutang: pakai yang dipilih atau buat baru
      let customerId = custId;
      const customerName = custName.trim();
      if (method === 'debt' && customerId == null) {
        customerId = (await db.customers.add({
          name: customerName, phone: custPhone.trim() || null, address: null, created_at: Date.now(),
        })) as number;
      }

      const order: Order = {
        id: resumedOrderId ?? crypto.randomUUID(),
        items,
        subtotal,
        discount,
        total,
        payment_method: method,
        cash_received: method === 'cash' ? cashReceived : method === 'debt' ? cashReceived : null,
        change: method === 'cash' ? change : null,
        status: 'paid',
        cashier_name: useSessionStore.getState().user?.name ?? openShift?.cashier_name ?? 'Kasir',
        shift_id: openShift?.id ?? null,
        customer_id: method === 'debt' ? customerId : null,
        customer_name: customerName || null,
        table_number: tableNumber || null,
        notes: notes || null,
        created_at: Date.now(),
        synced: false,
      };
      await db.orders.put(order); // put: bill tersimpan (open) berubah jadi paid

      // catat hutang sisa tagihan
      if (method === 'debt' && customerId != null) {
        await db.debts.add({
          customer_id: customerId,
          customer_name: customerName,
          order_id: order.id,
          total,
          paid: cashReceived,
          status: 'open',
          created_at: Date.now(),
        });
      }

      // potong stok untuk menu yang pakai stok
      for (const it of items) {
        const menu = await db.menus.get(it.product_id);
        if (menu?.stock != null) {
          await db.menus.update(menu.id, { stock: Math.max(0, menu.stock - it.qty), updated_at: Date.now() });
        }
      }

      const ls = getLicenseState();
      if (ls.plan === 'trial') saveLicenseState({ ...ls, txCount: ls.txCount + 1 });

      setDone(order);
    } finally {
      setLoading(false);
    }
  }

  function closeDone() {
    clear();
    refresh(); // cek ulang kuota trial setelah struk ditutup
    onClose();
  }

  if (done) {
    return (
      <Modal onClose={closeDone}>
        <div className="px-6 py-10 text-center">
          <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" strokeWidth={1.5} aria-hidden />
          <p className="text-sm text-muted-foreground mb-1">
            {done.payment_method === 'debt' ? 'Dicatat sebagai hutang' : 'Pembayaran diterima'}
          </p>
          <p className="text-3xl font-extrabold tabular-nums mb-4">{formatRp(done.total)}</p>
          {done.payment_method === 'cash' && (done.change ?? 0) > 0 && (
            <div className="bg-accent-soft rounded-xl py-3 px-4 mb-4 inline-block">
              <p className="text-sm text-muted-foreground">Kembalian</p>
              <p className="text-2xl font-extrabold text-primary tabular-nums">{formatRp(done.change!)}</p>
            </div>
          )}
          {done.payment_method === 'debt' && (
            <p className="text-sm text-muted-foreground mb-4">
              {done.customer_name} berhutang <b className="text-foreground">{formatRp(done.total - (done.cash_received ?? 0))}</b>.
              Cicilannya bisa dicatat di Laporan → Hutang.
            </p>
          )}
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => printReceipt(done)}
              className="flex-1 flex items-center justify-center gap-2 border border-border font-bold py-3 rounded-xl text-sm hover:bg-muted"
            >
              <Printer className="w-4 h-4" aria-hidden /> Cetak
            </button>
            <button
              onClick={() => shareReceipt(done)}
              className="flex-1 flex items-center justify-center gap-2 border border-border font-bold py-3 rounded-xl text-sm hover:bg-muted"
            >
              <Share2 className="w-4 h-4" aria-hidden /> Bagikan
            </button>
          </div>
          <button
            onClick={closeDone}
            className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl text-sm"
          >
            Transaksi Berikutnya
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose}>
      <div className="px-6 pt-5 pb-4 border-b border-border">
        <h2 className="font-bold text-lg">Pembayaran</h2>
        {(tableNumber || cartCustomerName) && (
          <p className="text-sm text-muted-foreground mt-0.5">
            {[tableNumber, cartCustomerName].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
      <div className="px-6 py-4 space-y-4">
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-muted-foreground">Total belanja</span>
          <span className="text-2xl font-extrabold text-primary tabular-nums">{formatRp(total)}</span>
        </div>

        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Cara bayar">
          {(Object.keys(METHOD_LABEL) as PayMethod[]).map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={method === m}
              onClick={() => setMethod(m)}
              className={`py-2.5 rounded-xl text-sm font-semibold border transition min-h-[44px] flex items-center justify-center gap-1 ${
                method === m
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40'
              }`}
            >
              {m === 'debt' && !canDebt && <Star className="w-3 h-3 text-accent" aria-hidden />}
              {METHOD_LABEL[m]}
            </button>
          ))}
        </div>

        {method === 'cash' && (
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5" htmlFor="cashInput">
              Uang dari pembeli
            </label>
            <RupiahInput
              id="cashInput"
              value={cashInput}
              onChange={setCashInput}
              placeholder={String(total)}
              autoFocus
              className="w-full border border-border rounded-xl px-3 py-2.5 text-xl font-bold text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex gap-2 mt-2 flex-wrap">
              {cashSuggestions(total).map((v, i) => (
                <button
                  key={v}
                  onClick={() => setCashInput(String(v))}
                  className="px-3 py-1.5 rounded-full bg-muted text-sm font-semibold tabular-nums hover:bg-border min-h-[36px]"
                >
                  {i === 0 ? 'Uang pas' : formatRp(v)}
                </button>
              ))}
            </div>
            {cashInput !== '' && cashReceived < total && (
              <p className="text-sm text-destructive mt-2">Masih kurang {formatRp(total - cashReceived)}.</p>
            )}
            {cashReceived >= total && (
              <p className="text-base text-success font-bold mt-2 text-right tabular-nums">
                Kembalian: {formatRp(change)}
              </p>
            )}
          </div>
        )}

        {method === 'debt' && (
          !canDebt ? (
            <p className="text-sm text-muted-foreground bg-accent-soft rounded-xl px-4 py-3">
              ⭐ Catat hutang pelanggan ada di versi <b>Pro</b>. Upgrade lewat menu Pengaturan.
            </p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5" htmlFor="custName">
                  Siapa yang berhutang? <span className="text-destructive">*</span>
                </label>
                <input
                  id="custName"
                  value={custName}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCustName(v);
                    // pelanggan lama dengan nama sama dipakai ulang
                    const match = customers.find((c) => c.name.toLowerCase() === v.trim().toLowerCase());
                    setCustId(match?.id ?? null);
                  }}
                  placeholder="Nama pelanggan"
                  list="custList"
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <datalist id="custList">
                  {customers.map((c) => <option key={c.id} value={c.name} />)}
                </datalist>
              </div>
              {custId == null && custName.trim() && (
                <input
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="No. HP (boleh kosong)"
                  inputMode="numeric"
                  aria-label="Nomor HP pelanggan"
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              )}
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5" htmlFor="dpInput">
                  Bayar sebagian sekarang (boleh kosong)
                </label>
                <RupiahInput
                  id="dpInput"
                  value={dpInput}
                  onChange={setDpInput}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {cashReceived >= total && (
                  <p className="text-sm text-destructive mt-1">Kalau dibayar penuh, pilih Tunai saja.</p>
                )}
                {cashReceived < total && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Sisa hutang: <b className="text-foreground tabular-nums">{formatRp(total - cashReceived)}</b>
                  </p>
                )}
              </div>
            </div>
          )
        )}
      </div>
      <div className="px-6 pb-5 flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 border border-border rounded-xl py-3 text-sm text-muted-foreground hover:bg-muted min-h-[48px]"
        >
          Batal
        </button>
        <button
          onClick={handlePay}
          disabled={!canPay || loading || (method === 'debt' && !canDebt)}
          className="flex-1 bg-success text-white font-extrabold py-3 rounded-xl text-sm disabled:opacity-40 min-h-[48px]"
        >
          {loading ? 'Menyimpan…' : method === 'debt' ? 'Catat Hutang' : 'Terima Pembayaran'}
        </button>
      </div>
    </Modal>
  );
}
