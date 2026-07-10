import Dexie, { type Table } from 'dexie';

export interface Menu {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  category_id: number | null;
  stock: number | null;
  min_stock: number | null;
  hpp: number; // harga pokok, weighted average dari stock-in
  description: string | null; // catatan/deskripsi produk, opsional
  variants: string | null; // "Pedas, Extra Ceker=3000" — nama=selisih harga; ad-hoc kalau variant_group_id kosong
  variant_group_id: number | null; // pakai grup variasi tersimpan (dipakai bareng menu lain) — lihat VariantGroup
  variant_group_ids: string | null; // banyak grup variasi tersimpan (CSV id), contoh: "1,3"
  discount_type: 'none' | 'nominal' | 'percent'; // diskon otomatis tiap menu ini dijual
  discount_value: number; // nominal Rp, atau persen 0-100 (tergantung discount_type)
  image_url: string | null;
  emoji: string | null;
  is_active: boolean;
  created_at: number;
  updated_at: number;
}

export interface Category {
  id?: number;
  name: string;
  sort_order: number;
}

// Grup variasi tersimpan (mis. "Level Pedas") — bisa dipakai di banyak menu sekaligus.
// Format `options` sama dengan Menu.variants lama: "Level 1, Level 2, Level 3=0".
export interface VariantGroup {
  id?: number;
  name: string;
  options: string;
  selection: 'single' | 'multi'; // single = pilih satu, multi = bisa pilih banyak
  required: boolean; // wajib pilih minimal satu
}

export interface OrderItem {
  product_id: string;
  product_name: string; // termasuk variasi, mis. "Seblak (Pedas)"
  price: number;
  qty: number;
  discount: number; // potongan nominal per baris (total, bukan per qty)
  hpp: number; // snapshot HPP saat jual — untuk laba rugi
  notes: string | null;
}

export type PayMethod = 'cash' | 'qris' | 'transfer' | 'debt';

export interface Order {
  id: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  payment_method: PayMethod;
  cash_received: number | null;
  change: number | null;
  status: 'open' | 'paid' | 'void';
  cashier_name: string;
  shift_id: number | null;
  customer_id: number | null;
  customer_name: string | null;
  table_number: string | null; // dipakai juga sebagai label open bill
  notes: string | null;
  created_at: number;
  synced: boolean;
}

export interface Shift {
  id?: number;
  status: 'open' | 'closed';
  cashier_name: string;
  opening_cash: number;
  closing_cash: number | null;
  opened_at: number;
  closed_at: number | null;
  notes: string | null;
}

export interface Setting {
  key: string;
  value: string;
}

export interface SyncItem {
  id?: number;
  type: string;
  payload: string;
  created_at: number;
  attempts: number;
}

export interface Customer {
  id?: number;
  name: string;
  phone: string | null;
  address: string | null;
  created_at: number;
}

export interface Debt {
  id?: number;
  customer_id: number;
  customer_name: string;
  order_id: string;
  total: number;
  paid: number;
  status: 'open' | 'paid';
  created_at: number;
}

// Log cicilan — permanen, tidak pernah di-update/hapus (PRD Pro)
export interface DebtPayment {
  id?: number;
  debt_id: number;
  amount: number;
  created_at: number;
}

export interface Expense {
  id?: number;
  amount: number;
  category: string;
  method: 'cash' | 'qris' | 'transfer';
  notes: string | null;
  created_at: number;
}

export interface Supplier {
  id?: number;
  name: string;
  phone: string | null;
  notes: string | null;
}

export interface User {
  id?: number;
  name: string;
  role: 'kasir'; // owner tidak disimpan di sini — owner pakai PIN owner di settings
  pin_hash: string;
  created_at: number;
}

export interface StockMove {
  id?: number;
  menu_id: string;
  menu_name: string;
  type: 'in' | 'out';
  qty: number;
  buy_price: number | null; // hanya type 'in'
  supplier: string | null;
  reason: string | null; // hanya type 'out'
  created_at: number;
}

class IposDB extends Dexie {
  menus!: Table<Menu, string>;
  categories!: Table<Category, number>;
  orders!: Table<Order, string>;
  settings!: Table<Setting, string>;
  shifts!: Table<Shift, number>;
  sync_queue!: Table<SyncItem, number>;
  customers!: Table<Customer, number>;
  debts!: Table<Debt, number>;
  debt_payments!: Table<DebtPayment, number>;
  expenses!: Table<Expense, number>;
  suppliers!: Table<Supplier, number>;
  users!: Table<User, number>;
  stock_moves!: Table<StockMove, number>;
  variant_groups!: Table<VariantGroup, number>;

  constructor() {
    super('ipos-offline');
    this.version(1).stores({
      products: 'id, category, is_active',
      orders: 'id, status, created_at, synced',
      settings: 'key',
    });
    this.version(2).stores({
      products: null,
      menus: 'id, category_id, is_active',
      categories: '++id, name',
      orders: 'id, status, created_at, synced',
      settings: 'key',
      shifts: '++id, status, opened_at',
      sync_queue: '++id, type, created_at',
    }).upgrade(async (tx) => {
      const old = await tx.table('products').toArray();
      if (old.length) {
        await tx.table('menus').bulkAdd(
          old.map((p: any) => ({ ...p, category_id: null, updated_at: p.updated_at ?? p.created_at }))
        );
      }
    });
    this.version(3).stores({
      menus: 'id, category_id, is_active',
      categories: '++id, name',
      orders: 'id, status, created_at, synced, shift_id',
      settings: 'key',
      shifts: '++id, status, opened_at',
      sync_queue: '++id, type, created_at',
      customers: '++id, name, phone',
      debts: '++id, customer_id, status, created_at',
      debt_payments: '++id, debt_id, created_at',
      expenses: '++id, category, created_at',
      suppliers: '++id, name',
      users: '++id, name',
      stock_moves: '++id, menu_id, type, created_at',
    }).upgrade(async (tx) => {
      // isi default field baru untuk data lama
      await tx.table('menus').toCollection().modify((m: any) => {
        m.sku ??= null;
        m.min_stock ??= null;
        m.hpp ??= 0;
        m.variants ??= null;
        m.emoji ??= null;
      });
      await tx.table('orders').toCollection().modify((o: any) => {
        o.customer_id ??= null;
        o.customer_name ??= null;
        for (const it of o.items ?? []) {
          it.discount ??= 0;
          it.hpp ??= 0;
        }
      });
    });
    this.version(4).stores({
      variant_groups: '++id, name',
    }).upgrade(async (tx) => {
      await tx.table('menus').toCollection().modify((m: any) => {
        m.variant_group_id ??= null;
        m.discount_type ??= 'none';
        m.discount_value ??= 0;
      });
    });
    this.version(5).stores({
      variant_groups: '++id, name',
    }).upgrade(async (tx) => {
      await tx.table('menus').toCollection().modify((m: any) => {
        if (m.variant_group_ids == null) {
          m.variant_group_ids = m.variant_group_id != null ? String(m.variant_group_id) : null;
        }
      });
      await tx.table('variant_groups').toCollection().modify((g: any) => {
        g.selection ??= 'single';
        g.required ??= false;
      });
    });
  }
}

export const db = new IposDB();
