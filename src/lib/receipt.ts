import type { Order } from '@/db';
import { db } from '@/db';
import { getLicenseState } from './license';
import { formatRp, splitVariant } from './format';
import { KEYS } from './store-settings';

const PAY_LABEL: Record<string, string> = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer', debt: 'Hutang' };

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const receiptNo = (o: Order) => `#${o.id.slice(0, 8).toUpperCase()}`;

const fmtTime = (ts: number) =>
  new Date(ts).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

async function loadStore() {
  const get = async (k: string) => (await db.settings.get(k))?.value ?? '';
  return {
    storeName: (await get(KEYS.storeName)) || 'Inspira POS',
    address: await get(KEYS.storeAddress),
    phone: await get(KEYS.storePhone),
    footer: await get(KEYS.receiptFooter),
    logo: await get(KEYS.storeLogo),
  };
}

const RECEIPT_STYLE = `
    * { box-sizing: border-box; }
    body { width: 58mm; margin: 0; font: 10px/1.5 -apple-system, 'Segoe UI', sans-serif; color: #1A1A1A; position: relative; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .row { display: flex; justify-content: space-between; gap: 6px; }
    .header { background: linear-gradient(135deg, #6e150f 0%, #b92a1c 100%); padding: 12px 10px; text-align: center; color: #fff; }
    .trial-badge { background: #FFDD00; color: #1A1A1A; font-size: 8px; font-weight: bold; padding: 3px 6px; border-radius: 6px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    .logo { width: 44px; height: 44px; object-fit: contain; border-radius: 8px; margin: 0 auto 6px; background: #fff; padding: 3px; display: block; }
    .initial { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.15); margin: 0 auto 6px; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: bold; }
    .sname { font-weight: 800; font-size: 14px; letter-spacing: 0.3px; margin: 0; }
    .saddr { font-size: 8px; color: rgba(255,255,255,0.85); margin-top: 3px; line-height: 1.4; }
    .infoblock { padding: 8px 10px 5px; background: #FFF8F7; border-bottom: 1px dashed #d0a139; }
    .info { font-size: 9px; color: #555; margin-top: 2px; }
    .info b { color: #6e150f; }
    .items { padding: 8px 10px; }
    .item { margin-bottom: 7px; }
    .iname { font-size: 11px; flex: 1; }
    .isub { font-size: 11px; color: #6e150f; white-space: nowrap; }
    .qty { font-size: 9px; color: #666; }
    .variant { font-size: 10px; font-weight: 700; color: #6e150f; margin: 1px 0; }
    .note { font-size: 8px; color: #b92a1c; font-style: italic; }
    .disc { font-size: 9px; color: #d0a139; }
    .totals { border-top: 1px dashed #d0a139; margin: 0 10px; padding: 7px 0; font-size: 10px; color: #555; }
    .totals .row { margin-bottom: 2px; }
    .grand { font-size: 13px; font-weight: 800; color: #6e150f; border-top: 2px solid #6e150f; padding-top: 5px; margin-top: 3px; }
    .change { color: #2a9d5c; font-weight: 700; }
    .debt { color: #b92a1c; font-weight: 700; font-size: 11px; }
    .footer { background: #FFF8F7; border-top: 1px dashed #d0a139; padding: 8px 10px; text-align: center; }
    .footer .msg { font-size: 10px; color: #555; }
    .powered { margin-top: 6px; padding-top: 5px; border-top: 1px solid #eee; }
    .powered b { font-size: 8px; color: #b92a1c; letter-spacing: 0.5px; }
    .powered span { display: block; font-size: 7px; color: #999; }
    .wm { position: absolute; top: 42%; left: 0; right: 0; text-align: center; font-size: 28px; font-weight: bold; opacity: 0.12; transform: rotate(-20deg); }`;

/** ponytail: printer thermal kasir umumnya monokrom — override warna jadi hitam/putih/abu saat cetak fisik. */
const PRINT_MONO_OVERRIDE = `
    .header { background: #000 !important; color: #fff !important; }
    .trial-badge { background: #ddd !important; color: #000 !important; }
    .saddr { color: #ddd !important; }
    .infoblock, .footer { background: #fff !important; border-color: #000 !important; }
    .info b, .isub, .variant, .grand, .powered b { color: #000 !important; }
    .note, .debt { color: #000 !important; font-weight: bold !important; }
    .disc { color: #444 !important; }
    .totals { border-color: #000 !important; }
    .grand { border-color: #000 !important; }
    .change { color: #000 !important; }
    .wm { opacity: 0.2 !important; }`;

async function receiptBodyHtml(order: Order): Promise<string> {
  const { storeName, address, phone, footer, logo } = await loadStore();
  const isTrial = getLicenseState().plan === 'trial';
  const debtLeft = order.payment_method === 'debt' ? order.total - (order.cash_received ?? 0) : 0;

  const info = (label: string, value: string) =>
    `<div class="row info"><span>${label}</span><span>${value}</span></div>`;

  const items = order.items.map((it) => {
    const { base, variant } = splitVariant(it.product_name);
    return `
    <div class="item">
      <div class="row"><b class="iname">${esc(base)}</b><b class="isub">${formatRp(it.price * it.qty - it.discount)}</b></div>
      ${variant ? `<div class="variant">▸ ${esc(variant)}</div>` : ''}
      <div class="row qty"><span>${it.qty} × ${formatRp(it.price)}</span></div>
      ${it.notes ? `<div class="note">↳ ${esc(it.notes)}</div>` : ''}
      ${it.discount ? `<div class="row disc"><span>&nbsp;&nbsp;Diskon</span><span>−${formatRp(it.discount)}</span></div>` : ''}
    </div>`;
  }).join('');

  return `
    ${isTrial ? '<div class="wm">DEMO</div>' : ''}
    <div class="header">
      ${isTrial ? '<div class="trial-badge">[ TRIAL MODE - INSPIRA POS ]</div>' : ''}
      ${logo
        ? `<img class="logo" src="${logo}" alt="">`
        : `<div class="initial">${esc(storeName.charAt(0).toUpperCase())}</div>`}
      <p class="sname">${esc(storeName)}</p>
      ${(address || phone) ? `<p class="saddr">${[address, phone].filter(Boolean).map(esc).join('<br>')}</p>` : ''}
    </div>
    <div class="infoblock">
      ${info('No.', `<b>${receiptNo(order)}</b>`)}
      ${info('Tanggal', fmtTime(order.created_at))}
      ${info('Pembayaran', PAY_LABEL[order.payment_method] ?? order.payment_method)}
      ${info('Kasir', esc(order.cashier_name))}
      ${order.customer_name ? info('Pelanggan', esc(order.customer_name)) : ''}
      ${order.table_number ? info('Meja / Bill', esc(order.table_number)) : ''}
      ${order.notes ? `<div class="info">Catatan: ${esc(order.notes)}</div>` : ''}
    </div>
    <div class="items">${items}</div>
    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${formatRp(order.subtotal)}</span></div>
      ${order.discount ? `<div class="row disc"><span>Diskon</span><span>−${formatRp(order.discount)}</span></div>` : ''}
      <div class="row grand"><span>TOTAL</span><span>${formatRp(order.total)}</span></div>
      <div class="row" style="margin-top:4px"><span>Bayar</span><span>${formatRp(order.cash_received ?? order.total)}</span></div>
      ${debtLeft > 0
        ? `<div class="row debt"><span>Sisa Hutang</span><span>${formatRp(debtLeft)}</span></div>`
        : `<div class="row"><span>Kembalian</span><span class="change">${formatRp(order.change ?? 0)}</span></div>`}
    </div>
    <div class="footer">
      <div class="msg">${footer ? esc(footer) : 'Terima kasih!'}</div>
      ${isTrial ? '<div class="msg" style="font-weight:bold">-- STRUK DEMO / MASA COBA --</div>' : ''}
      <div class="powered"><b>✦ Powered by Inspira POS ✦</b><span>inspiralabs.id</span></div>
    </div>`;
}

/**
 * Cetak struk lewat dialog print (kertas thermal 58mm; di Android bisa via RawBT).
 * Dicetak hitam-putih karena printer thermal kasir umumnya monokrom; versi warna ada di shareReceiptImage.
 */
export async function printReceipt(order: Order): Promise<void> {
  const body = await receiptBodyHtml(order);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: 58mm auto; margin: 0; }
    ${RECEIPT_STYLE}
    ${PRINT_MONO_OVERRIDE}
  </style></head><body>${body}</body></html>`;

  const frame = document.createElement('iframe');
  frame.style.display = 'none';
  document.body.appendChild(frame);
  frame.srcdoc = html;
  await new Promise((r) => (frame.onload = r));
  frame.contentWindow?.print();
  setTimeout(() => frame.remove(), 60_000); // beri waktu dialog print
}

/**
 * Render struk jadi gambar PNG (html2canvas) lalu bagikan lewat menu share HP, atau unduh di desktop.
 */
export async function shareReceiptImage(order: Order): Promise<void> {
  const body = await receiptBodyHtml(order);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-9999px;top:0;';
  host.innerHTML = `<style>${RECEIPT_STYLE}</style><div id="receipt-capture" style="width:58mm;font:10px/1.5 -apple-system,'Segoe UI',sans-serif;color:#1A1A1A">${body}</div>`;
  document.body.appendChild(host);

  try {
    const { default: html2canvas } = await import('html2canvas');
    const target = host.querySelector<HTMLElement>('#receipt-capture')!;
    const canvas = await html2canvas(target, { scale: 3, backgroundColor: '#ffffff' });
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return;

    const file = new File([blob], `struk-${receiptNo(order).slice(1)}.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] }).catch(() => { /* dibatalkan pengguna */ });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  } finally {
    host.remove();
  }
}

/**
 * Bagikan struk sebagai teks lewat menu share HP (WA, dll) — tanpa langganan API apa pun.
 * Untuk versi gambar (PNG), lihat shareReceiptImage.
 */
export async function shareReceipt(order: Order): Promise<void> {
  const { storeName, address, phone, footer } = await loadStore();
  const debtLeft = order.payment_method === 'debt' ? order.total - (order.cash_received ?? 0) : 0;
  const lines = [
    `*${storeName}*`,
    ...[address, phone].filter(Boolean),
    `Struk ${receiptNo(order)} · ${fmtTime(order.created_at)}`,
    '--------------------------',
    ...order.items.map((it) =>
      `${it.qty}x ${it.product_name} — ${formatRp(it.price * it.qty - it.discount)}${it.notes ? ` (${it.notes})` : ''}`),
    '--------------------------',
    order.discount ? `Diskon: −${formatRp(order.discount)}` : '',
    `*TOTAL: ${formatRp(order.total)}*`,
    `${PAY_LABEL[order.payment_method] ?? order.payment_method}: ${formatRp(order.cash_received ?? order.total)}`,
    debtLeft > 0 ? `Sisa hutang: ${formatRp(debtLeft)}` : (order.change ? `Kembalian: ${formatRp(order.change)}` : ''),
    '',
    footer || 'Terima kasih!',
  ].filter(Boolean);
  const text = lines.join('\n');
  if (navigator.share) {
    await navigator.share({ text }).catch(() => { /* dibatalkan pengguna */ });
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }
}
