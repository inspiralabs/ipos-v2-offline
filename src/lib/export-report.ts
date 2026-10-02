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
function fileDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

const DAY_MS = 86400_000;

interface DayRow {
  start: number;
  count: number;
  sales: number;
  hpp: number;
  expense: number;
  net: number;
}

function soldMenus(orders: Order[]): [string, { qty: number; revenue: number }][] {
  const byProduct = new Map<string, { qty: number; revenue: number }>();
  for (const o of orders) {
    for (const it of o.items) {
      const cur = byProduct.get(it.product_name) ?? { qty: 0, revenue: 0 };
      cur.qty += it.qty;
      cur.revenue += it.price * it.qty - it.discount;
      byProduct.set(it.product_name, cur);
    }
  }
  return [...byProduct.entries()].sort((a, b) => b[1].qty - a[1].qty);
}

function dailyRows(orders: Order[], expenses: Expense[], start: number, end: number): DayRow[] {
  const rows: DayRow[] = [];
  for (let t = start; t < end; t += DAY_MS) {
    const dayOrders = orders.filter((o) => o.created_at >= t && o.created_at < t + DAY_MS);
    const dayExpenses = expenses.filter((e) => e.created_at >= t && e.created_at < t + DAY_MS);
    const sales = dayOrders.reduce((s, o) => s + o.total, 0);
    const hpp = dayOrders.reduce((s, o) => s + o.items.reduce((x, i) => x + i.hpp * i.qty, 0), 0);
    const expense = dayExpenses.reduce((s, e) => s + e.amount, 0);
    rows.push({ start: t, count: dayOrders.length, sales, hpp, expense, net: sales - hpp - expense });
  }
  return rows;
}

const HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF6E150F' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } };
const CURRENCY_FMT = '#,##0';
const PERCENT_FMT = '0.0%';

export async function exportReportExcel(start: number, end: number): Promise<void> {
  const { storeName, orders, expenses, totalSales, totalHpp, totalExpense, byMethod } = await loadRangeData(start, end);
  const days = dailyRows(orders, expenses, start, end);
  const menus = soldMenus(orders);
  const grossProfit = totalSales - totalHpp;
  const netProfit = grossProfit - totalExpense;

  const { Workbook } = await import('exceljs');
  const wb = new Workbook();

  // --- Sheet 1: Ringkasan ---
  const summary = wb.addWorksheet('Ringkasan');
  summary.columns = [{ width: 24 }, { width: 18 }];
  summary.addRow([storeName]).font = { bold: true, size: 14 };
  summary.addRow([`Periode: ${fmtDate(start)} – ${fmtDate(end - 86400_000)}`]);
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

  // --- Sheet 2: Rekap per hari ---
  const daily = wb.addWorksheet('Rekap per Hari');
  daily.columns = [
    { header: 'Tanggal', width: 14 },
    { header: 'Transaksi', width: 12 },
    { header: 'Omzet', width: 16 },
    { header: 'Modal (HPP)', width: 16 },
    { header: 'Pengeluaran', width: 16 },
    { header: 'Laba bersih', width: 16 },
  ];
  const dailyHeader = daily.getRow(1);
  dailyHeader.font = HEADER_FONT;
  dailyHeader.eachCell((c) => { c.fill = HEADER_FILL; });
  daily.views = [{ state: 'frozen', ySplit: 1 }];
  for (const d of days) {
    const r = daily.addRow([fmtDate(d.start), d.count, d.sales, d.hpp, d.expense, d.net]);
    for (const col of [3, 4, 5, 6]) r.getCell(col).numFmt = CURRENCY_FMT;
  }
  const dailyTotal = daily.addRow([
    'TOTAL',
    days.reduce((s, d) => s + d.count, 0),
    days.reduce((s, d) => s + d.sales, 0),
    days.reduce((s, d) => s + d.hpp, 0),
    days.reduce((s, d) => s + d.expense, 0),
    days.reduce((s, d) => s + d.net, 0),
  ]);
  dailyTotal.font = { bold: true };
  for (const col of [3, 4, 5, 6]) dailyTotal.getCell(col).numFmt = CURRENCY_FMT;
  dailyTotal.eachCell((c) => { c.border = { top: { style: 'thin' } }; });

  const menuSheet = wb.addWorksheet('Menu Terjual');
  menuSheet.columns = [
    { header: 'Menu', width: 32 },
    { header: 'Terjual', width: 12 },
    { header: 'Omzet', width: 16 },
  ];
  const menuHeader = menuSheet.getRow(1);
  menuHeader.font = HEADER_FONT;
  menuHeader.eachCell((c) => { c.fill = HEADER_FILL; });
  menuSheet.views = [{ state: 'frozen', ySplit: 1 }];
  for (const [name, m] of menus) {
    const r = menuSheet.addRow([name, m.qty, m.revenue]);
    r.getCell(3).numFmt = CURRENCY_FMT;
  }
  const menuTotal = menuSheet.addRow(['TOTAL', menus.reduce((s, [, m]) => s + m.qty, 0), menus.reduce((s, [, m]) => s + m.revenue, 0)]);
  menuTotal.font = { bold: true };
  menuTotal.getCell(3).numFmt = CURRENCY_FMT;
  menuTotal.eachCell((c) => { c.border = { top: { style: 'thin' } }; });

  // --- Sheet 4: Transaksi & Pengeluaran ---
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
  a.download = `laporan-${fileDate(start)}-${fileDate(end - DAY_MS)}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function exportReportPdf(start: number, end: number): Promise<void> {
  const { storeName, orders, expenses, totalSales, totalHpp, totalExpense } = await loadRangeData(start, end);
  const days = dailyRows(orders, expenses, start, end);
  const menus = soldMenus(orders);
  const grossProfit = totalSales - totalHpp;
  const netProfit = grossProfit - totalExpense;

  const { jsPDF } = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(storeName, 14, 18);
  doc.setFontSize(12);
  doc.text('Laporan Penjualan', 14, 26);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Periode: ${fmtDate(start)} - ${fmtDate(end - 86400_000)}`, 14, 33);
  doc.setTextColor(0);

  let y = 42;
  const plLine = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(label, 14, y);
    doc.text(value, 196, y, { align: 'right' });
    y += 6;
  };
  plLine('Omzet', rp(totalSales));
  plLine('Modal (HPP)', `-${rp(totalHpp)}`);
  plLine('Laba kotor', rp(grossProfit), true);
  plLine('Pengeluaran', `-${rp(totalExpense)}`);
  plLine('Laba bersih', rp(netProfit), true);
  y += 4;

  const headerStyles = { fillColor: [110, 21, 15] as [number, number, number], textColor: 255 };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Rekap per Hari', 14, y);
  autoTable(doc, {
    startY: y + 3,
    head: [['Tanggal', 'Transaksi', 'Omzet', 'Modal', 'Pengeluaran', 'Laba bersih']],
    body: days.map((d) => [fmtDate(d.start), String(d.count), rp(d.sales), rp(d.hpp), rp(d.expense), rp(d.net)]),
    foot: [[
      'Total',
      String(days.reduce((s, d) => s + d.count, 0)),
      rp(days.reduce((s, d) => s + d.sales, 0)),
      rp(days.reduce((s, d) => s + d.hpp, 0)),
      rp(days.reduce((s, d) => s + d.expense, 0)),
      rp(days.reduce((s, d) => s + d.net, 0)),
    ]],
    headStyles: headerStyles,
    footStyles: { fillColor: [247, 242, 234], textColor: 20, fontStyle: 'bold' },
    styles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jspdf-autotable augments doc at runtime
  y = (doc as any).lastAutoTable.finalY + 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Menu yang laku', 14, y);
  autoTable(doc, {
    startY: y + 3,
    head: [['Menu', 'Terjual', 'Omzet']],
    body: menus.length
      ? menus.map(([name, m]) => [name, String(m.qty), rp(m.revenue)])
      : [['Tidak ada menu terjual', '', '']],
    foot: [[
      'Total',
      String(menus.reduce((s, [, m]) => s + m.qty, 0)),
      rp(menus.reduce((s, [, m]) => s + m.revenue, 0)),
    ]],
    headStyles: headerStyles,
    footStyles: { fillColor: [247, 242, 234], textColor: 20, fontStyle: 'bold' },
    styles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Transaksi', 14, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    head: [['Tanggal', 'Jam', 'Kasir', 'Metode', 'Total']],
    body: orders.map((o) => [
      fmtDate(o.created_at),
      fmtTime(o.created_at),
      o.cashier_name,
      METHOD_LABEL[o.payment_method] ?? o.payment_method,
      rp(o.total),
    ]),
    headStyles: headerStyles,
    styles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });

  if (expenses.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jspdf-autotable augments doc at runtime; no public type for lastAutoTable
    const afterOrders = (doc as any).lastAutoTable.finalY + 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Pengeluaran', 14, afterOrders);

    autoTable(doc, {
      startY: afterOrders + 4,
      head: [['Tanggal', 'Kategori', 'Metode', 'Nominal', 'Catatan']],
      body: expenses.map((e) => [
        fmtDate(e.created_at),
        e.category,
        METHOD_LABEL[e.method as PayMethod] ?? e.method,
        rp(e.amount),
        e.notes ?? '',
      ]),
      headStyles: headerStyles,
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });
  }

  doc.save(`laporan-${fileDate(start)}-${fileDate(end - DAY_MS)}.pdf`);
}
