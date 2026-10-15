import { db, type Order } from '@/db';

/** Tandai transaksi batal dan kembalikan stok menu yang memakai stok. */
export async function voidOrder(order: Order): Promise<void> {
  await db.orders.update(order.id, { status: 'void' });
  for (const it of order.items) {
    const menu = await db.menus.get(it.product_id);
    if (menu?.stock != null) {
      await db.menus.update(menu.id, { stock: menu.stock + it.qty, updated_at: Date.now() });
    }
  }
}
