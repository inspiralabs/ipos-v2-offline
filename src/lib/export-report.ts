import { db, type Order, type Expense, type PayMethod } from '@/db';
import { getSetting, KEYS } from './store-settings';

const METHOD_LABEL: Record<PayMethod, string> = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer', debt: 'Hutang' };

interface RangeData {
  storeName: string;
  orders: Order[];
  expenses: Expense[];
  totalSales: number;
  totalHpp: number;
  totalExpense: number;
  byMethod: Record<string, number>;
}

async function loadRangeData(start: number, end: number): Promise<RangeData> {
  const storeName = (await getSetting(KEYS.storeName)) || 'Inspira POS';
  const orders = (await db.orders.where('created_at').between(start, end).toArray())
    .filter((o) => o.status === 'paid')
    .sort((a, b) => a.created_at - b.created_at);
  const expenses = (await db.expenses.where('created_at').between(start, end).toArray())
    .sort((a, b) => a.created_at - b.created_at);

  const totalSales = orders.reduce((s, o) => s + o.total, 0);
  const totalHpp = orders.reduce((s, o) => s + o.items.reduce((x, i) => x + i.hpp * i.qty, 0), 0);
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);

  const byMethod: Record<string, number> = {};
  for (const o of orders) byMethod[o.payment_method] = (byMethod[o.payment_method] ?? 0) + o.total;

  return { storeName, orders, expenses, totalSales, totalHpp, totalExpense, byMethod };
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

const HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF6E150F' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } };
const CURRENCY_FMT = '#,##0';
const PERCENT_FMT = '0.0%';

export async function exportReportExcel(start: number, end: number): Promise<void> {
  const { storeName, orders, expenses, totalSales, totalHpp, totalExpense, byMethod } = await loadRangeData(start, end);
  const grossProfit = totalSales - totalHpp;
  const netProfit = grossProfit - totalExpense;

  const { Workbook } = await import('exceljs');
  const wb = new Workbook();

  // --- Sheet 1: Ringkasan ---
  const summary = wb.addWorksheet('Ringkasan');
  summary.columns = [{ width: 24 }, { width: 18 }];
  summary.addRow([storeName]).font = { bold: true, size: 14 };
  summary.addRow([`Periode: ${fmtDate(start)} – ${fmtDate(end)}`]);
  summary.addRow([`Dibuat: ${new Date().toLocaleString('id-ID')}`]);
  summary.addRow([]);

  const plRows: [string, number][] = [
    ['Omzet', totalSales],
    ['Modal (HPP)', totalHpp],
    ['Laba kotor', grossProfit],
    ['Pengeluaran', totalExpense],
    ['Laba bersih', netProfit],
  ];
  const plHeaderRow = summary.addRow(['Ringkasan Laba Rugi', '']);
  plHeaderRow.font = HEADER_FONT;
  plHeaderRow.eachCell((c) => { c.fill = HEADER_FILL; });
  for (const [label, val] of plRows) {
    const r = summary.addRow([label, val]);
    r.getCell(2).numFmt = CURRENCY_FMT;
    if (label === 'Laba kotor' || label === 'Laba bersih') r.font = { bold: true };
  }
  if (totalSales > 0) {
    const marginRow = summary.addRow(['Margin kotor', grossProfit / totalSales]);
    marginRow.getCell(2).numFmt = PERCENT_FMT;
  }
  summary.addRow([]);

  const methodHeaderRow = summary.addRow(['Metode Bayar', 'Total']);
  methodHeaderRow.font = HEADER_FONT;
  methodHeaderRow.eachCell((c) => { c.fill = HEADER_FILL; });
  for (const [method, total] of Object.entries(byMethod)) {
    const r = summary.addRow([METHOD_LABEL[method as PayMethod] ?? method, total]);
    r.getCell(2).numFmt = CURRENCY_FMT;
  }

  // --- Sheet 2: Transaksi & Pengeluaran ---
  const detail = wb.addWorksheet('Transaksi & Pengeluaran');
  detail.columns = [
    { header: 'Tanggal', key: 'date', width: 12 },
    { header: 'Jam', key: 'time', width: 8 },
    { header: 'Jenis', key: 'type', width: 14 },
    { header: 'Deskripsi', key: 'desc', width: 32 },
    { header: 'Kasir/Kategori', key: 'who', width: 18 },
    { header: 'Nominal', key: 'amount', width: 14 },
  ];
  const headerRow = detail.getRow(1);
  headerRow.font = HEADER_FONT;
  headerRow.eachCell((c) => { c.fill = HEADER_FILL; });
  detail.views = [{ state: 'frozen', ySplit: 1 }];

  type Row = { date: string; time: string; type: string; desc: string; who: string; amount: number; ts: number };
  const rows: Row[] = [
    ...orders.map((o): Row => ({
      date: fmtDate(o.created_at),
      time: fmtTime(o.created_at),
      type: 'Transaksi',
      desc: `${o.items.reduce((n, i) => n + i.qty, 0)} item · ${METHOD_LABEL[o.payment_method] ?? o.payment_method}`,
      who: o.cashier_name,
      amount: o.total,
      ts: o.created_at,
    })),
    ...expenses.map((e): Row => ({
      date: fmtDate(e.created_at),
      time: fmtTime(e.created_at),
      type: 'Pengeluaran',
      desc: e.notes ?? '',
      who: e.category,
      amount: -e.amount,
      ts: e.created_at,
    })),
  ].sort((a, b) => a.ts - b.ts);

  for (const r of rows) {
    const row = detail.addRow({ date: r.date, time: r.time, type: r.type, desc: r.desc, who: r.who, amount: r.amount });
    row.getCell('amount').numFmt = CURRENCY_FMT;
  }
  const totalRow = detail.addRow({ date: '', time: '', type: '', desc: '', who: 'TOTAL', amount: rows.reduce((s, r) => s + r.amount, 0) });
  totalRow.font = { bold: true };
  totalRow.getCell('amount').numFmt = CURRENCY_FMT;
  totalRow.eachCell((c) => { c.border = { top: { style: 'thin' } }; });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `laporan-${start}-${end}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}
