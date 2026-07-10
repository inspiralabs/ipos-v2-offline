import { create } from 'zustand';
import type { OrderItem } from '@/db';

interface CartStore {
  items: OrderItem[];
  discount: number;
  tableNumber: string;
  customerName: string;
  customerPhone: string;
  notes: string;
  resumedOrderId: string | null; // open bill yang sedang dilanjutkan
  addItem: (item: Omit<OrderItem, 'qty' | 'notes' | 'discount'>) => void;
  removeItem: (key: string) => void;
  updateQty: (key: string, qty: number) => void;
  updateItem: (key: string, patch: Partial<Pick<OrderItem, 'notes' | 'discount'>>) => void;
  setDiscount: (d: number) => void;
  setTable: (t: string) => void;
  setCustomerName: (n: string) => void;
  setCustomerPhone: (p: string) => void;
  setNotes: (n: string) => void;
  load: (items: OrderItem[], discount: number, tableNumber: string, orderId: string, customerName?: string) => void;
  clear: () => void;
}

// baris cart dibedakan per product_name (produk sama beda variasi = baris beda)
const keyOf = (i: Pick<OrderItem, 'product_id' | 'product_name'>) => `${i.product_id}|${i.product_name}`;
export { keyOf };

export const useCartStore = create<CartStore>((set) => ({
  items: [],
  discount: 0,
  tableNumber: '',
  customerName: '',
  customerPhone: '',
  notes: '',
  resumedOrderId: null,
  addItem: (item) =>
    set((s) => {
      const existing = s.items.find((i) => keyOf(i) === keyOf(item));
      if (existing) {
        return { items: s.items.map((i) => (keyOf(i) === keyOf(item) ? { ...i, qty: i.qty + 1 } : i)) };
      }
      return { items: [...s.items, { ...item, qty: 1, discount: 0, notes: null }] };
    }),
  removeItem: (key) => set((s) => ({ items: s.items.filter((i) => keyOf(i) !== key) })),
  updateQty: (key, qty) =>
    set((s) => ({
      items: qty <= 0
        ? s.items.filter((i) => keyOf(i) !== key)
        : s.items.map((i) => (keyOf(i) === key ? { ...i, qty } : i)),
    })),
  updateItem: (key, patch) =>
    set((s) => ({ items: s.items.map((i) => (keyOf(i) === key ? { ...i, ...patch } : i)) })),
  setDiscount: (discount) => set({ discount }),
  setTable: (tableNumber) => set({ tableNumber }),
  setCustomerName: (customerName) => set({ customerName }),
  setCustomerPhone: (customerPhone) => set({ customerPhone }),
  setNotes: (notes) => set({ notes }),
  load: (items, discount, tableNumber, orderId, customerName) =>
    set({ items, discount, tableNumber, resumedOrderId: orderId, customerName: customerName ?? '' }),
  clear: () => set({ items: [], discount: 0, tableNumber: '', customerName: '', customerPhone: '', notes: '', resumedOrderId: null }),
}));

export function getCartTotals(items: OrderItem[], discount: number) {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty - i.discount, 0);
  const total = Math.max(0, subtotal - discount);
  return { subtotal, total };
}
