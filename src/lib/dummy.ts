import { db } from '@/db';

// Contoh menu per jenis usaha UMKM. Maks ±15 item per jenis supaya masih
// ada sisa kuota 20 menu selama masa coba.
interface DummyItem {
  name: string;
  price: number;
  emoji: string;
}

export interface BusinessType {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  categories: { name: string; items: DummyItem[] }[];
}

export const BUSINESS_TYPES: BusinessType[] = [
  {
    id: 'seblak',
    name: 'Seblak',
    emoji: '🍲',
    desc: 'Seblak kuah pedas, aneka topping',
    categories: [
      {
        name: 'Seblak',
        items: [
          { name: 'Seblak Original', price: 10000, emoji: '🍲' },
          { name: 'Seblak Ceker', price: 13000, emoji: '🍗' },
          { name: 'Seblak Sosis', price: 13000, emoji: '🌭' },
          { name: 'Seblak Bakso', price: 13000, emoji: '🥘' },
          { name: 'Seblak Seafood', price: 17000, emoji: '🦐' },
          { name: 'Seblak Komplit', price: 20000, emoji: '🍜' },
        ],
      },
      {
        name: 'Topping',
        items: [
          { name: 'Extra Ceker', price: 3000, emoji: '🍗' },
          { name: 'Extra Telur', price: 3000, emoji: '🥚' },
          { name: 'Extra Kerupuk', price: 2000, emoji: '🍘' },
        ],
      },
      {
        name: 'Minuman',
        items: [
          { name: 'Es Teh Manis', price: 4000, emoji: '🧋' },
          { name: 'Es Jeruk', price: 6000, emoji: '🍹' },
          { name: 'Air Mineral', price: 4000, emoji: '💧' },
        ],
      },
    ],
  },
  {
    id: 'friedchicken',
    name: 'Fried Chicken',
    emoji: '🍗',
    desc: 'Ayam goreng crispy, geprek, paket nasi',
    categories: [
      {
        name: 'Ayam',
        items: [
          { name: 'Paha Bawah', price: 8000, emoji: '🍗' },
          { name: 'Paha Atas', price: 10000, emoji: '🍗' },
          { name: 'Dada', price: 11000, emoji: '🍗' },
          { name: 'Sayap', price: 8000, emoji: '🍗' },
          { name: 'Ayam Geprek', price: 12000, emoji: '🌶️' },
        ],
      },
      {
        name: 'Paket',
        items: [
          { name: 'Paket Nasi + Ayam', price: 15000, emoji: '🍱' },
          { name: 'Paket Geprek + Es Teh', price: 17000, emoji: '🍱' },
        ],
      },
      {
        name: 'Tambahan',
        items: [
          { name: 'Nasi Putih', price: 4000, emoji: '🍚' },
          { name: 'Sambal Extra', price: 2000, emoji: '🌶️' },
          { name: 'Es Teh Manis', price: 4000, emoji: '🧋' },
          { name: 'Air Mineral', price: 4000, emoji: '💧' },
        ],
      },
    ],
  },
  {
    id: 'bakso',
    name: 'Bakso',
    emoji: '🍜',
    desc: 'Bakso urat, halus, jumbo, komplit',
    categories: [
      {
        name: 'Bakso',
        items: [
          { name: 'Bakso Halus', price: 12000, emoji: '🍜' },
          { name: 'Bakso Urat', price: 15000, emoji: '🍜' },
          { name: 'Bakso Telur', price: 15000, emoji: '🥚' },
          { name: 'Bakso Jumbo', price: 18000, emoji: '🍲' },
          { name: 'Bakso Komplit', price: 20000, emoji: '🥘' },
        ],
      },
      {
        name: 'Tambahan',
        items: [
          { name: 'Mie / Bihun Extra', price: 3000, emoji: '🍝' },
          { name: 'Kerupuk', price: 2000, emoji: '🍘' },
          { name: 'Es Teh Manis', price: 4000, emoji: '🧋' },
          { name: 'Es Jeruk', price: 6000, emoji: '🍹' },
          { name: 'Teh Hangat', price: 3000, emoji: '🍵' },
        ],
      },
    ],
  },
  {
    id: 'mieayam',
    name: 'Mie Ayam',
    emoji: '🍝',
    desc: 'Mie ayam, pangsit, yamin',
    categories: [
      {
        name: 'Mie Ayam',
        items: [
          { name: 'Mie Ayam', price: 12000, emoji: '🍝' },
          { name: 'Mie Ayam Bakso', price: 15000, emoji: '🍜' },
          { name: 'Mie Ayam Ceker', price: 15000, emoji: '🍗' },
          { name: 'Mie Ayam Pangsit', price: 14000, emoji: '🥟' },
          { name: 'Mie Ayam Komplit', price: 18000, emoji: '🥘' },
          { name: 'Yamin Manis', price: 13000, emoji: '🍝' },
        ],
      },
      {
        name: 'Minuman',
        items: [
          { name: 'Es Teh Manis', price: 4000, emoji: '🧋' },
          { name: 'Es Jeruk', price: 6000, emoji: '🍹' },
          { name: 'Teh Hangat', price: 3000, emoji: '🍵' },
          { name: 'Air Mineral', price: 4000, emoji: '💧' },
        ],
      },
    ],
  },
  {
    id: 'soto',
    name: 'Soto',
    emoji: '🥣',
    desc: 'Soto ayam, daging, plus lauk pendamping',
    categories: [
      {
        name: 'Soto',
        items: [
          { name: 'Soto Ayam', price: 12000, emoji: '🥣' },
          { name: 'Soto Daging', price: 18000, emoji: '🥩' },
          { name: 'Soto Babat', price: 17000, emoji: '🥣' },
          { name: 'Soto Campur', price: 20000, emoji: '🍲' },
        ],
      },
      {
        name: 'Lauk & Tambahan',
        items: [
          { name: 'Nasi Putih', price: 5000, emoji: '🍚' },
          { name: 'Sate Usus', price: 3000, emoji: '🍢' },
          { name: 'Sate Telur Puyuh', price: 5000, emoji: '🍢' },
          { name: 'Perkedel', price: 3000, emoji: '🥔' },
          { name: 'Tempe Goreng', price: 2000, emoji: '🟫' },
        ],
      },
      {
        name: 'Minuman',
        items: [
          { name: 'Es Teh Manis', price: 4000, emoji: '🧋' },
          { name: 'Teh Hangat', price: 3000, emoji: '🍵' },
          { name: 'Es Jeruk', price: 6000, emoji: '🍹' },
        ],
      },
    ],
  },
  {
    id: 'warkop',
    name: 'Warkop / Angkringan',
    emoji: '☕',
    desc: 'Kopi, indomie, roti bakar, gorengan',
    categories: [
      {
        name: 'Kopi & Minuman',
        items: [
          { name: 'Kopi Hitam', price: 5000, emoji: '☕' },
          { name: 'Kopi Susu', price: 8000, emoji: '☕' },
          { name: 'Es Kopi Susu Gula Aren', price: 12000, emoji: '🧋' },
          { name: 'Teh Manis Hangat', price: 4000, emoji: '🍵' },
          { name: 'Es Teh Manis', price: 5000, emoji: '🧋' },
          { name: 'Es Jeruk', price: 6000, emoji: '🍹' },
        ],
      },
      {
        name: 'Makanan',
        items: [
          { name: 'Indomie Goreng + Telur', price: 10000, emoji: '🍳' },
          { name: 'Indomie Rebus + Telur', price: 10000, emoji: '🍜' },
          { name: 'Roti Bakar Coklat Keju', price: 12000, emoji: '🍞' },
          { name: 'Pisang Goreng', price: 2000, emoji: '🍌' },
          { name: 'Gorengan', price: 2000, emoji: '🥟' },
        ],
      },
    ],
  },
];

/** Isi database dengan contoh menu sesuai jenis usaha. */
export async function seedBusinessType(typeId: string): Promise<void> {
  const biz = BUSINESS_TYPES.find((b) => b.id === typeId);
  if (!biz) return;
  const now = Date.now();
  for (const [i, cat] of biz.categories.entries()) {
    const catId = await db.categories.add({ name: cat.name, sort_order: i });
    await db.menus.bulkAdd(
      cat.items.map((item) => ({
        id: crypto.randomUUID(),
        name: item.name,
        sku: null,
        price: item.price,
        category_id: catId as number,
        stock: null, // masakan dibuat dadakan — tanpa batas stok
        min_stock: null,
        hpp: 0,
        description: null,
        variants: null,
        variant_group_id: null,
        variant_group_ids: null,
        discount_type: 'none' as const,
        discount_value: 0,
        image_url: null,
        emoji: item.emoji,
        is_active: true,
        created_at: now,
        updated_at: now,
      }))
    );
  }
}
