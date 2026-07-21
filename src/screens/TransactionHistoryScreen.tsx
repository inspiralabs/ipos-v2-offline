import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, Image, Printer, Share2, Search, Receipt } from 'lucide-react';
import { db } from '@/db';
import { formatRp } from '@/lib/format';
import { printReceipt, shareReceipt, shareReceiptImage } from '@/lib/receipt';

const METHOD_LABEL: Record<string, string> = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer', debt: 'Hutang' };

// Riwayat semua transaksi (semua tanggal) — lihat, cetak ulang, bagikan. (ipos-v1: Riwayat Transaksi)
export function TransactionHistoryScreen({ onBack }: { onBack: () => void }) {
  const [q, setQ] = useState('');

  // 300 transaksi terbaru — cukup untuk warung; tambah paging kalau ada yang mengeluh
  const orders = useLiveQuery(
    () => db.orders.where('status').anyOf('paid', 'void').reverse().sortBy('created_at'),
    []
  ) ?? [];

  const term = q.trim().toLowerCase();
  const filtered = (term
    ? orders.filter((o) =>
        formatRp(o.total).toLowerCase().includes(term) ||
        o.cashier_name.toLowerCase().includes(term) ||
        (o.customer_name ?? '').toLowerCase().includes(term) ||
        o.items.some((it) => it.product_name.toLowerCase().includes(term)))
    : orders
  ).slice(0, 300);

  const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  // kelompokkan per tanggal
  const groups: { date: string; items: typeof filtered }[] = [];
  for (const o of filtered) {
    const d = fmtDate(o.created_at);
    const g = groups[groups.length - 1];
    if (g && g.date === d) g.items.push(o);
    else groups.push({ date: d, items: [o] });
  }

  return (
    <div className="flex flex-col h-full">
      <header className="bg-card border-b border-border px-4 py-3 shrink-0 flex items-center gap-2">
        <button
          onClick={onBack}
          aria-label="Kembali ke Lainnya"
          className="w-9 h-9 -ml-2 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted"
        >
          <ChevronLeft className="w-5 h-5" aria-hidden />
        </button>
        <h1 className="font-bold text-lg">Riwayat Transaksi</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-lg w-full mx-auto">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama menu, kasir, pelanggan…"
            aria-label="Cari transaksi"
            className="w-full border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 px-6">
            <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-3" aria-hidden />
            <p className="text-sm text-muted-foreground">
              {term ? 'Tidak ada transaksi yang cocok.' : 'Belum ada transaksi. Mulai jualan di tab Kasir, yuk!'}
            </p>
          </div>
        ) : (
          groups.map((grp) => (
            <div key={grp.date}>
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 px-1">{grp.date}</h2>
              <div className="space-y-2">
                {grp.items.map((o) => (
                  <div key={o.id} className="bg-card rounded-xl px-4 py-3 shadow-warm border border-border flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold tabular-nums ${o.status === 'void' ? 'line-through text-muted-foreground' : ''}`}>
                        {formatRp(o.total)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {fmtTime(o.created_at)} · {o.items.reduce((n, i) => n + i.qty, 0)} item · {METHOD_LABEL[o.payment_method] ?? o.payment_method}
                        {o.customer_name ? ` · ${o.customer_name}` : ''} · {o.cashier_name}
                      </p>
                    </div>
                    {o.status === 'void' ? (
                      <span className="text-xs bg-destructive/10 text-destructive font-semibold px-2.5 py-1 rounded-full shrink-0">Batal</span>
                    ) : (
                      <>
                        <button onClick={() => printReceipt(o)} aria-label="Cetak ulang struk"
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted shrink-0">
                          <Printer className="w-4 h-4" aria-hidden />
                        </button>
                        <button onClick={() => shareReceipt(o)} aria-label="Bagikan struk"
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted shrink-0">
                          <Share2 className="w-4 h-4" aria-hidden />
                        </button>
                        <button onClick={() => shareReceiptImage(o)} aria-label="Bagikan struk sebagai gambar"
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted shrink-0">
                          <Image className="w-4 h-4" aria-hidden />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
