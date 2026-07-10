import { db } from '@/db';

// ponytail: dev-only mock data for homepage screenshots. Run in browser console: seedDemo()
// Delete this file when no longer needed — not imported anywhere by default.
export async function seedDemo(): Promise<void> {
  const now = Date.now();
  const dayStart = new Date().setHours(0, 0, 0, 0);

  const menus = [
    { name: 'Nasi Goreng', price: 15000, stock: 42, min_stock: 5, emoji: '🍛' },
    { name: 'Es Teh Manis', price: 5000, stock: 9, min_stock: 10, emoji: '🧋' },
    { name: 'Kerupuk', price: 3000, stock: 4, min_stock: 5, emoji: '🍘' },
    { name: 'Ayam Geprek', price: 13000, stock: 6, min_stock: 8, emoji: '🌶️' },
  ].map((m) => ({
    id: crypto.randomUUID(),
    name: m.name,
    sku: null,
    price: m.price,
    category_id: null,
    stock: m.stock,
    min_stock: m.min_stock,
    hpp: Math.round(m.price * 0.6),
    description: null,
    variants: null,
    variant_group_id: null,
    variant_group_ids: null,
    discount_type: 'none' as const,
    discount_value: 0,
    image_url: null,
    emoji: m.emoji,
    is_active: true,
    created_at: now,
    updated_at: now,
  }));
  await db.menus.bulkAdd(menus);

  // sebaran 7 hari terakhir — supaya grafik omzet mingguan terisi penuh
  const txPerDay = [4, 5, 3, 6, 4, 7, 9]; // hari ke-6 (lalu) .. hari ke-0 (ini)
  const orders: any[] = [];
  for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
    const base = dayStart - daysAgo * 86_400_000;
    const count = txPerDay[6 - daysAgo];
    for (let i = 0; i < count; i++) {
      const item = menus[i % menus.length];
      const qty = 1 + (i % 3);
      orders.push({
        id: crypto.randomUUID(),
        items: [{
          product_id: item.id,
          product_name: item.name,
          price: item.price,
          qty,
          discount: 0,
          hpp: item.hpp,
          notes: null,
        }],
        subtotal: item.price * qty,
        discount: 0,
        total: item.price * qty,
        payment_method: 'cash' as const,
        cash_received: item.price * qty,
        change: 0,
        status: 'paid' as const,
        cashier_name: 'Demo',
        shift_id: null,
        customer_id: null,
        customer_name: null,
        table_number: null,
        notes: null,
        created_at: base + i * 3_600_000,
        synced: false,
      });
    }
  }
  await db.orders.bulkAdd(orders);

  await db.expenses.add({
    amount: 20000,
    category: 'Bahan baku',
    method: 'cash',
    notes: 'Demo',
    created_at: dayStart,
  });
}
