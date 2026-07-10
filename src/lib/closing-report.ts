import type { Order } from '@/db';
import { db } from '@/db';
import { formatRp } from './format';
import { KEYS } from './store-settings';

const PAY_LABEL: Record<string, string> = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer', debt: 'Hutang' };
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Cetak rekap penutupan (closing) periode 7/30 hari — beda dari struk transaksi harian:
 * ini total gabungan omzet/laba/pengeluaran selama rentang, bukan satu transaksi.
 * ponytail: dokumen A4 biasa (bukan lebar 58mm) — cocok untuk laporan, bukan struk kasir.
 */
export async function printClosingReport(rangeDays: 7 | 30, rangeEnd: number, paidOrders: Order[], expenseTotal: number): Promise<void> {
  const get = async (k: string) => (await db.settings.get(k))?.value ?? '';
  const storeName = (await get(KEYS.storeName)) || 'Inspira POS';

  const rangeStart = rangeEnd - rangeDays * 86400_000;
  const totalSales = paidOrders.reduce((s, o) => s + o.total, 0);
  const totalHpp = paidOrders.reduce((s, o) => s + o.items.reduce((x, i) => x + i.hpp * i.qty, 0), 0);
  const grossProfit = totalSales - totalHpp;
  const netProfit = grossProfit - expenseTotal;
  const avg = paidOrders.length ? Math.round(totalSales / paidOrders.length) : 0;

  const byMethod = new Map<string, number>();
  for (const o of paidOrders) byMethod.set(o.payment_method, (byMethod.get(o.payment_method) ?? 0) + o.total);

  const byProduct = new Map<string, { qty: number; revenue: number }>();
  for (const o of paidOrders) {
    for (const it of o.items) {
      const cur = byProduct.get(it.product_name) ?? { qty: 0, revenue: 0 };
      cur.qty += it.qty;
      cur.revenue += it.price * it.qty - it.discount;
      byProduct.set(it.product_name, cur);
    }
  }
  const topProducts = [...byProduct.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 10);

  const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const printedAt = new Date().toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const row = (label: string, value: string, bold = false) => `
    <tr><td>${esc(label)}</td><td class="r${bold ? ' b' : ''}">${value}</td></tr>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 16mm; }
    body { font: 13px/1.5 -apple-system, 'Segoe UI', sans-serif; color: #1A1A1A; margin: 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 4px 0; }
    .r { text-align: right; white-space: nowrap; }
    .b { font-weight: 800; }
    .header { background: linear-gradient(135deg, #6e150f 0%, #b92a1c 100%); color: #fff; padding: 20px 24px; border-radius: 10px; margin-bottom: 20px; }
    .header h1 { margin: 0 0 4px; font-size: 20px; }
    .header p { margin: 0; opacity: 0.9; font-size: 12px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
    .card { border: 1px solid #eee; border-radius: 10px; padding: 12px 14px; }
    .card .label { font-size: 11px; color: #666; margin: 0 0 2px; }
    .card .value { font-size: 18px; font-weight: 800; margin: 0; }
    section { margin-bottom: 20px; }
    section h2 { font-size: 13px; margin: 0 0 8px; border-bottom: 2px solid #6e150f; padding-bottom: 4px; color: #6e150f; }
    hr { border: 0; border-top: 1px solid #ddd; margin: 6px 0; }
    .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #999; }
    @media print { .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style></head><body>
    <div class="header">
      <h1>${esc(storeName)}</h1>
      <p>Laporan Closing ${rangeDays} Hari · ${fmtDate(rangeStart)} – ${fmtDate(rangeEnd)}</p>
    </div>

    <div class="grid">
      <div class="card"><p class="label">Omzet</p><p class="value">${formatRp(totalSales)}</p></div>
      <div class="card"><p class="label">Transaksi</p><p class="value">${paidOrders.length}x</p></div>
      <div class="card"><p class="label">Laba Bersih</p><p class="value" style="color:${netProfit >= 0 ? '#2a9d5c' : '#c0392b'}">${formatRp(netProfit)}</p></div>
      <div class="card"><p class="label">Rata-rata / Transaksi</p><p class="value">${formatRp(avg)}</p></div>
    </div>

    <section>
      <h2>Rincian Laba Rugi</h2>
      <table>
        ${row('Omzet', formatRp(totalSales))}
        ${row('Modal terjual (HPP)', `−${formatRp(totalHpp)}`)}
        ${row('Laba kotor', formatRp(grossProfit), true)}
        ${row('Pengeluaran', `−${formatRp(expenseTotal)}`)}
        <tr><td colspan="2"><hr></td></tr>
        ${row('Laba bersih', formatRp(netProfit), true)}
      </table>
    </section>

    <section>
      <h2>Uang Masuk per Metode</h2>
      <table>
        ${[...byMethod.entries()].map(([m, v]) => row(PAY_LABEL[m] ?? m, formatRp(v))).join('') || '<tr><td colspan="2">Tidak ada transaksi.</td></tr>'}
      </table>
    </section>

    <section>
      <h2>10 Menu Terlaris</h2>
      <table>
        ${topProducts.map(([name, p]) => row(`${esc(name)} (${p.qty}x)`, formatRp(p.revenue))).join('') || '<tr><td colspan="2">Tidak ada transaksi.</td></tr>'}
      </table>
    </section>

    <div class="footer">Dicetak ${printedAt} · Inspira POS</div>
  </body></html>`;

  const frame = document.createElement('iframe');
  frame.style.display = 'none';
  document.body.appendChild(frame);
  frame.srcdoc = html;
  await new Promise((r) => (frame.onload = r));
  frame.contentWindow?.print();
  setTimeout(() => frame.remove(), 60_000);
}
