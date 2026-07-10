#!/usr/bin/env node
'use strict';

/**
 * =====================================================================
 * MIGRASI DATA: ipos-v1 (Dexie lama) -> ipos-offline (Dexie baru, v2)
 * =====================================================================
 *
 * KENAPA SCRIPT INI ADA (bukan tombol "Import" langsung antar-app):
 *   IndexedDB di-scope per origin/domain browser. ipos-offline (domain
 *   baru) tidak bisa membaca IndexedDB ipos-v1 (domain lama) secara
 *   langsung, walau dibuka di device & browser yang sama. Satu-satunya
 *   jembatan adalah file JSON export yang sudah dimiliki kedua app.
 *
 * ALUR KERJA (jalankan berurutan):
 *   1. Di HP/laptop klien, buka app ipos-v1 lama -> Pengaturan -> Backup
 *      & Restore -> Export -> dapat file "inspirapos-backup-YYYY-MM-DD.json".
 *   2. Kirim file itu ke Anda (developer). Jalankan di komputer Anda:
 *        node scripts/migrate-v1-to-v2.cjs <input-v1.json> <output-v2.json>
 *      Script ini MURNI transformasi JSON -> JSON, tidak menyentuh
 *      IndexedDB/Dexie sama sekali (Node tidak punya IndexedDB), jadi
 *      aman dijalankan di luar browser.
 *   3. Baca ringkasan yang dicetak script ini (jumlah baris per tabel,
 *      total omzet sebelum/sesudah, daftar peringatan) — ini pengecekan
 *      wajib, JANGAN lewati sebelum kirim file ke klien.
 *   4. PENTING — URUTAN DI HP KLIEN WAJIB BEGINI:
 *        a. Klien buka ipos-offline baru, JALANI dulu alur registrasi/
 *           demo sampai selesai (apa pun yang diisi di form onboarding
 *           tidak masalah, sebentar lagi ditimpa oleh restore).
 *        b. BARU SETELAH ITU buka Pengaturan -> Amankan Data -> Pulihkan
 *           dari File -> pilih file <output-v2.json>.
 *      Kenapa urutannya wajib begini: importBackup() ipos-offline
 *      MENGOSONGKAN lalu MENGISI ULANG tabel `settings` dari nol sesuai
 *      isi file restore (lihat src/lib/backup.ts) — bukan menggabung.
 *      File hasil migrasi ini SUDAH menyertakan onboarding_done=1 +
 *      profil toko (lihat bagian 0 di bawah), supaya restore tidak
 *      melempar app balik ke layar registrasi. Kalau restore dilakukan
 *      SEBELUM registrasi selesai, layar Pengaturan belum bisa diakses
 *      sama sekali (app masih mengunci di Onboarding).
 *   5. LANGKAH MANUAL YANG MASIH TERSISA:
 *        a. Reset PIN semua akun kasir yang dipindah (nama-namanya ada
 *           di ringkasan) — PIN lama TIDAK ikut pindah demi keamanan.
 *        b. Cek beberapa transaksi lama yang metode bayarnya bukan
 *           tunai/QRIS/transfer polos (mis. GoPay/OVO) — script ini
 *           menebak dengan aturan sederhana, lihat mapPaymentMethod().
 *        c. Tema warna toko TIDAK ikut dipindah (format v1 beda, bebas
 *           hue) — default maroon, tinggal dipilih ulang di Pengaturan
 *           kalau mau (Pengaturan > Tema Warna, tidak perlu build ulang).
 *
 * BELUM DIUJI dengan backup nyata klien (D Kriuk / Mie Jebew) — baru
 * diuji data sintetis. Sebelum dipakai serius: minta 1 file export asli,
 * jalankan, cocokkan manual beberapa transaksi terakhir & struk fisik/
 * hafalan owner sebelum dipercaya untuk klien lain.
 *
 * APA YANG SENGAJA TIDAK DIPINDAH (tidak ada tempatnya di skema v2):
 *   - unit/satuan produk, barcode (keputusan 2026-07-06: ipos-offline tidak
 *     punya konsep satuan custom). Deskripsi produk IKUT dipindah (field
 *     description sudah ditambahkan ke skema v2).
 *   - hppHistory (audit trail perubahan HPP) — hanya nilai HPP terakhir
 *     yang kebawa; v2 menghitung HPP weighted-average dari stock_moves
 *   - Tema warna & pengaturan cloud backup v1 — tidak ada padanan/format
 *     beda; profil toko dasar (nama/alamat/HP/footer struk/logo) IKUT
 *     dipindah otomatis (lihat bagian 0), tema tinggal dipilih ulang manual.
 *   - akun owner v1 (role 'owner') — di v2 owner pakai PIN terpisah di
 *     Pengaturan, bukan tabel `users` (itu khusus kasir)
 *   - status transaksi 'void' terperinci — skema v1 yang dibaca script
 *     ini hanya funya status open/completed; bila void di v1 berarti
 *     row dihapus (bukan diberi status), tidak ada yang bisa dipulihkan
 *
 * PENGGUNAAN:
 *   node scripts/migrate-v1-to-v2.js <input-v1-backup.json> <output-v2-backup.json>
 */

const fs = require('fs');
const path = require('path');

function fail(msg) {
  console.error(`\n[GAGAL] ${msg}\n`);
  process.exit(1);
}

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  fail('Pemakaian: node scripts/migrate-v1-to-v2.js <input-v1.json> <output-v2.json>');
}
if (!fs.existsSync(inputPath)) fail(`File tidak ditemukan: ${inputPath}`);

let v1;
try {
  v1 = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
} catch (e) {
  fail(`File input bukan JSON valid: ${e.message}`);
}
if (!v1.version || !Array.isArray(v1.categories) === false) {
  // pengecekan longgar — cukup pastikan ini memang backup v1
}
if (!v1.version) fail('File input bukan backup ipos-v1 (field "version" tidak ada).');

// ---- helpers ---------------------------------------------------------

/** JSON.parse mengubah Date -> string ISO. Ubah balik jadi epoch ms. */
function toEpoch(dateLike) {
  if (!dateLike) return Date.now();
  const t = new Date(dateLike).getTime();
  return Number.isFinite(t) ? t : Date.now();
}

const arr = (x) => (Array.isArray(x) ? x : []);

// v1.paymentMethods.category (teks bebas) -> enum tetap v2.
// ponytail: pemetaan heuristik nama/kategori umum Indonesia; kasus di
// luar daftar ini jatuh ke 'cash' (paling aman/dominan di warung).
function mapPaymentMethod(categoryText) {
  const c = String(categoryText || '').toLowerCase();
  if (c.includes('qris')) return 'qris';
  if (c.includes('transfer') || c.includes('bank')) return 'transfer';
  if (c.includes('tunai') || c.includes('cash')) return 'cash';
  // e-wallet (gopay/ovo/dana/shopeepay) tidak punya slot sendiri di v2 —
  // didekati sebagai 'qris' karena sama-sama pembayaran non-tunai scan/app.
  return 'qris';
}

const warnings = [];
function warn(msg) {
  warnings.push(msg);
}

// ---- 0. profil toko -> tabel settings (key-value) -----------------------
//
// PENTING: importBackup() ipos-offline MENGOSONGKAN lalu MENGISI ULANG
// tabel `settings` dari nol berdasarkan isi file ini — bukan menggabung.
// Kalau baris 'onboarding_done' tidak disertakan di sini, app akan
// mengira toko belum pernah onboarding dan melempar user balik ke layar
// registrasi setelah restore selesai. Karena itu baris ini WAJIB ada.
// (Device ID & status lisensi aman — keduanya disimpan di localStorage,
// bukan di tabel `settings` ini, jadi tidak ikut kehapus oleh restore.)
const v1Store = arr(v1.storeSettings)[0] || {};
const settings = [
  { key: 'onboarding_done', value: '1' },
  ...(v1Store.storeName ? [{ key: 'store_name', value: v1Store.storeName }] : []),
  ...(v1Store.address ? [{ key: 'store_address', value: v1Store.address }] : []),
  ...(v1Store.phone ? [{ key: 'store_phone', value: v1Store.phone }] : []),
  ...(v1Store.receiptFooter ? [{ key: 'receipt_footer', value: v1Store.receiptFooter }] : []),
  ...(v1Store.logo ? [{ key: 'store_logo', value: v1Store.logo }] : []),
];

// ---- 1. categories -----------------------------------------------------

const categories = arr(v1.categories)
  .filter((c) => c.isDeleted !== 1)
  .map((c, i) => ({ id: c.id, name: c.name, sort_order: i }));

// ---- 2. suppliers (+ map id -> nama, dipakai stock_moves) -------------

const supplierNameById = new Map();
const suppliers = arr(v1.suppliers)
  .filter((s) => s.isDeleted !== 1)
  .map((s) => {
    supplierNameById.set(s.id, s.name);
    const notes = [s.notes, s.address ? `Alamat: ${s.address}` : null].filter(Boolean).join(' | ') || null;
    return { id: s.id, name: s.name, phone: s.phone || null, notes };
  });

// ---- 3. customers -------------------------------------------------------

const customers = arr(v1.customers)
  .filter((c) => c.isDeleted !== 1)
  .map((c) => {
    if (c.email || c.notes) warn(`Customer "${c.name}": email/catatan tidak punya field di v2, hilang.`);
    return {
      id: c.id,
      name: c.name,
      phone: c.phone || null,
      address: c.address || null,
      created_at: toEpoch(c.createdAt),
    };
  });

// ---- 4. varian/topping: productOptionGroups+Options -> variant_groups --

const optionsByGroupId = new Map();
for (const o of arr(v1.productOptions)) {
  if (o.isDeleted === 1) continue;
  if (!optionsByGroupId.has(o.groupId)) optionsByGroupId.set(o.groupId, []);
  optionsByGroupId.get(o.groupId).push(o);
}

const variantGroups = arr(v1.productOptionGroups)
  .filter((g) => g.isDeleted !== 1)
  .map((g) => {
    const opts = (optionsByGroupId.get(g.id) || []).sort((a, b) => a.sortOrder - b.sortOrder);
    const options = opts.map((o) => `${o.name}=${o.additionalPrice || 0}`).join(', ');
    return {
      id: g.id,
      name: g.name,
      options,
      selection: g.isMultiSelect === 1 ? 'multi' : 'single',
      required: g.isRequired === 1,
    };
  });

// productId -> [groupId] lewat productOptionLinks (fallback: group.productId langsung)
const groupIdsByProductId = new Map();
for (const link of arr(v1.productOptionLinks)) {
  if (link.isDeleted === 1) continue;
  if (!groupIdsByProductId.has(link.productId)) groupIdsByProductId.set(link.productId, []);
  groupIdsByProductId.get(link.productId).push(link.groupId);
}
for (const g of arr(v1.productOptionGroups)) {
  if (g.isDeleted === 1 || !g.productId) continue;
  if (!groupIdsByProductId.has(g.productId)) groupIdsByProductId.set(g.productId, []);
  const list = groupIdsByProductId.get(g.productId);
  if (!list.includes(g.id)) list.push(g.id);
}

// ---- 5. products -> menus -------------------------------------------------

const menuNameById = new Map();
const menus = arr(v1.products)
  .filter((p) => p.isDeleted !== 1)
  .map((p) => {
    menuNameById.set(p.id, p.name);
    if (p.barcode || (p.unit && p.unit !== 'pcs')) {
      warn(`Produk "${p.name}": barcode/satuan khusus tidak punya field di v2, hilang.`);
    }
    const groupIds = groupIdsByProductId.get(p.id) || [];
    const discountType =
      p.defaultDiscountType === 'percentage' ? 'percent' : p.defaultDiscountType === 'nominal' ? 'nominal' : 'none';

    return {
      id: String(p.id),
      name: p.name,
      sku: p.sku || null,
      price: p.price,
      category_id: p.categoryId ?? null,
      stock: p.stock ?? null,
      min_stock: null,
      hpp: p.hpp || 0,
      description: p.description || null,
      variants: null,
      variant_group_id: groupIds[0] ?? null,
      variant_group_ids: groupIds.length ? groupIds.join(',') : null,
      discount_type: discountType,
      discount_value: p.defaultDiscountValue || 0,
      image_url: p.photo || null,
      emoji: null,
      is_active: p.isDeleted !== 1,
      created_at: toEpoch(p.createdAt),
      updated_at: toEpoch(p.updatedAt),
    };
  });

// ---- 6. stockIns + stockOuts -> stock_moves (hppHistory dibuang) ------

const stockMoves = [
  ...arr(v1.stockIns).map((s) => ({
    menu_id: String(s.productId),
    menu_name: menuNameById.get(s.productId) || '(produk terhapus)',
    type: 'in',
    qty: s.quantity,
    buy_price: s.buyPrice ?? null,
    supplier: supplierNameById.get(s.supplierId) || null,
    reason: null,
    created_at: toEpoch(s.date),
  })),
  ...arr(v1.stockOuts).map((s) => ({
    menu_id: String(s.productId),
    menu_name: menuNameById.get(s.productId) || '(produk terhapus)',
    type: 'out',
    qty: s.quantity,
    buy_price: null,
    supplier: null,
    reason: s.reason || null,
    created_at: toEpoch(s.date),
  })),
].sort((a, b) => a.created_at - b.created_at);

if (arr(v1.hppHistory).length > 0) {
  warn(`${v1.hppHistory.length} baris riwayat perubahan HPP (hppHistory) dibuang — tidak ada tabel setara di v2.`);
}

// ---- 7. users (staff aktif saja; PIN TIDAK dipindah demi keamanan) ---

const staffNameById = new Map();
const staffToReset = [];
const users = arr(v1.users)
  .filter((u) => u.role === 'staff' && u.isActive === 1)
  .map((u) => {
    staffNameById.set(u.id, u.name);
    staffToReset.push(u.name);
    return {
      id: u.id,
      name: u.name,
      role: 'kasir',
      pin_hash: '', // sengaja kosong — lihat catatan "LANGKAH MANUAL 5b" di header
      created_at: toEpoch(u.createdAt),
    };
  });
for (const u of arr(v1.users)) {
  if (u.role === 'owner') staffNameById.set(u.id, u.name);
}

// ---- 8. expenseCategories + paymentMethods lookup, lalu expenses -----

const expenseCategoryNameById = new Map(arr(v1.expenseCategories).map((c) => [c.id, c.name]));
const paymentMethodById = new Map(arr(v1.paymentMethods).map((pm) => [pm.id, pm]));

const expenses = arr(v1.expenses)
  .filter((e) => e.isDeleted !== 1)
  .map((e) => {
    const pm = paymentMethodById.get(e.paymentMethodId);
    return {
      id: e.id,
      amount: e.amount,
      category: expenseCategoryNameById.get(e.categoryId) || 'Lainnya',
      method: mapPaymentMethod(pm && pm.category) === 'transfer' ? 'transfer' : mapPaymentMethod(pm && pm.category) === 'qris' ? 'qris' : 'cash',
      notes: [e.title, e.notes].filter(Boolean).join(' — ') || null,
      created_at: toEpoch(e.date),
    };
  });

// ---- 9. debts + debtPayments ------------------------------------------

const debts = arr(v1.debts).map((d) => ({
  id: d.id,
  customer_id: d.customerId,
  customer_name: d.customerName,
  order_id: String(d.transactionId),
  total: d.originalAmount,
  paid: d.originalAmount - d.remainingAmount,
  status: d.status === 'paid' ? 'paid' : 'open',
  created_at: toEpoch(d.createdAt),
}));

const debtPayments = arr(v1.debtPayments).map((p) => ({
  id: p.id,
  debt_id: p.debtId,
  amount: p.amount,
  created_at: toEpoch(p.date),
}));

// ---- 10. transactions (+items+options) -> orders -----------------------

const itemsByTxId = new Map();
for (const it of arr(v1.transactionItems)) {
  if (!itemsByTxId.has(it.transactionId)) itemsByTxId.set(it.transactionId, []);
  itemsByTxId.get(it.transactionId).push(it);
}
const optionsByItemId = new Map();
for (const o of arr(v1.transactionItemOptions)) {
  if (!optionsByItemId.has(o.transactionItemId)) optionsByItemId.set(o.transactionItemId, []);
  optionsByItemId.get(o.transactionItemId).push(o);
}

let voidCountAssumed = 0;
const orders = arr(v1.transactions).map((t) => {
  const items = (itemsByTxId.get(t.id) || []).map((it) => {
    const opts = optionsByItemId.get(it.id) || [];
    const variantSuffix = opts.length ? ` (${opts.map((o) => o.optionName).join(', ')})` : '';
    return {
      product_id: String(it.productId),
      product_name: `${it.productName}${variantSuffix}`,
      price: it.price,
      qty: it.quantity,
      discount: it.discountAmount || 0,
      hpp: it.hpp || 0,
      notes: it.notes || null,
    };
  });

  const pm = paymentMethodById.get(t.paymentMethodId);
  const payment_method = t.debtAmount ? 'debt' : mapPaymentMethod(pm && pm.category);

  return {
    id: String(t.id),
    items,
    subtotal: t.subtotal,
    discount: t.discountAmount || 0,
    total: t.total,
    payment_method,
    cash_received: t.paymentAmount ?? null,
    change: t.change ?? null,
    status: t.status === 'completed' ? 'paid' : 'open',
    cashier_name: (t.createdBy && staffNameById.get(t.createdBy)) || 'Tidak diketahui',
    shift_id: null,
    customer_id: t.customerId ?? null,
    customer_name: t.customerName ?? null,
    table_number: t.tableNumber ?? null,
    notes: t.remarks || null,
    created_at: toEpoch(t.date),
    synced: false,
  };
});

// v1 tidak punya status 'void' eksplisit di tabel transactions — kalau
// dulu ada transaksi yang di-void, kemungkinan barisnya sudah dihapus,
// bukan diberi status. Tidak ada yang bisa dipulihkan dari sini.
if (voidCountAssumed === 0) {
  warn('Transaksi berstatus "void" (jika ada) tidak dapat dipulihkan — v1 tampaknya menghapus baris saat void, bukan menandainya.');
}

// ---- rakit output v2 --------------------------------------------------

const output = {
  app: 'ipos-offline',
  version: 2,
  exported_at: Date.now(),
  data: {
    menus,
    categories,
    orders,
    settings, // profil toko + onboarding_done=1 (WAJIB, lihat bagian 0 di atas)
    shifts: [],
    customers,
    debts,
    debt_payments: debtPayments,
    expenses,
    suppliers,
    users,
    stock_moves: stockMoves,
    variant_groups: variantGroups, // lihat header 5d — perlu fix backup.ts dulu
  },
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');

// ---- ringkasan & pengecekan wajib --------------------------------------

const sumTotal = (rows) => rows.reduce((s, r) => s + (r.total || 0), 0);
const v1Omzet = sumTotal(arr(v1.transactions).filter((t) => t.status === 'completed'));
const v2Omzet = sumTotal(orders.filter((o) => o.status === 'paid'));

console.log('\n=== Ringkasan migrasi ===');
console.log(`Kategori     : ${categories.length}`);
console.log(`Produk/menu  : ${menus.length}`);
console.log(`Grup varian  : ${variantGroups.length}`);
console.log(`Pelanggan    : ${customers.length}`);
console.log(`Supplier     : ${suppliers.length}`);
console.log(`Kasir (staff): ${users.length}`);
console.log(`Pergerakan stok: ${stockMoves.length}`);
console.log(`Pengeluaran  : ${expenses.length}`);
console.log(`Hutang       : ${debts.length} (cicilan: ${debtPayments.length})`);
console.log(`Transaksi    : ${orders.length}`);
console.log(`Omzet completed v1: Rp ${v1Omzet.toLocaleString('id-ID')}`);
console.log(`Omzet paid     v2: Rp ${v2Omzet.toLocaleString('id-ID')}`);
if (v1Omzet !== v2Omzet) {
  console.log('  >> BEDA! Cek manual sebelum kirim ke klien — jangan lanjut kalau selisihnya tidak bisa dijelaskan.');
} else {
  console.log('  >> Cocok.');
}

if (staffToReset.length) {
  console.log(`\nPIN kasir berikut HARUS di-reset manual setelah import: ${staffToReset.join(', ')}`);
}
if (warnings.length) {
  console.log('\n=== Peringatan (' + warnings.length + ') ===');
  for (const w of warnings.slice(0, 20)) console.log(`- ${w}`);
  if (warnings.length > 20) console.log(`... dan ${warnings.length - 20} peringatan lain (kategori sama).`);
}

console.log(`\nFile hasil migrasi: ${path.resolve(outputPath)}`);
console.log('Langkah selanjutnya: lihat "ALUR KERJA" (poin 4, urutan wajib) & "LANGKAH MANUAL YANG MASIH TERSISA" di kepala file script ini.\n');
