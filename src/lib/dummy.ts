import { db } from '@/db';

// Contoh menu per jenis usaha UMKM. Maks ±15 item per jenis supaya masih
// ada sisa kuota 20 menu selama masa coba.
interface DummyItem {
  name: string;
  price: number;
  emoji: string;
  desc?: string; // deskripsi singkat, opsional
  variants?: string; // "Nama=selisih harga", pisah koma — lihat Menu.variants
  discount_type?: 'none' | 'nominal' | 'percent';
  discount_value?: number;
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
          { name: 'Seblak Original', price: 10000, emoji: '🍲', desc: 'Kerupuk basah, sayur, bumbu pedas khas', variants: 'Level 1,Level 2,Level 3,Level 5=1000,Level 10=2000' },
          { name: 'Seblak Ceker', price: 13000, emoji: '🍗', desc: 'Ceker ayam empuk, kuah medok', variants: 'Level 1,Level 2,Level 3,Level 5=1000,Level 10=2000' },
          { name: 'Seblak Sosis', price: 13000, emoji: '🌭', variants: 'Level 1,Level 2,Level 3,Level 5=1000' },
          { name: 'Seblak Bakso', price: 13000, emoji: '🥘', variants: 'Level 1,Level 2,Level 3,Level 5=1000' },
          { name: 'Seblak Mie', price: 12000, emoji: '🍜', desc: 'Pakai mie kuning atau bihun' },
          { name: 'Seblak Seafood', price: 17000, emoji: '🦐', desc: 'Udang, cumi, bakso ikan', variants: 'Level 1,Level 2,Level 3,Level 5=1000' },
          { name: 'Seblak Komplit', price: 20000, emoji: '🍜', desc: 'Ceker + sosis + bakso + seafood', variants: 'Level 1,Level 2,Level 3,Level 5=1000,Level 10=2000', discount_type: 'nominal', discount_value: 2000 },
        ],
      },
      {
        name: 'Topping',
        items: [
          { name: 'Extra Ceker', price: 3000, emoji: '🍗' },
          { name: 'Extra Telur', price: 3000, emoji: '🥚' },
          { name: 'Extra Kerupuk', price: 2000, emoji: '🍘' },
          { name: 'Extra Sosis', price: 3000, emoji: '🌭' },
        ],
      },
      {
        name: 'Minuman',
        items: [
          { name: 'Es Teh Manis', price: 4000, emoji: '🧋' },
          { name: 'Es Jeruk', price: 6000, emoji: '🍹' },
          { name: 'Air Mineral', price: 4000, emoji: '💧' },
          { name: 'Es Lemon Tea', price: 7000, emoji: '🍋' },
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
          { name: 'Paha Bawah', price: 8000, emoji: '🍗', variants: 'Original,Crispy=1000,Geprek=2000' },
          { name: 'Paha Atas', price: 10000, emoji: '🍗', variants: 'Original,Crispy=1000,Geprek=2000' },
          { name: 'Dada', price: 11000, emoji: '🍗', variants: 'Original,Crispy=1000,Geprek=2000' },
          { name: 'Sayap', price: 8000, emoji: '🍗', variants: 'Original,Crispy=1000' },
          { name: 'Ayam Geprek', price: 12000, emoji: '🌶️', desc: 'Ayam crispy digeprek sambal bawang', variants: 'Level 1,Level 2,Level 3,Level 5=1000' },
          { name: 'Ayam Rica-Rica', price: 13000, emoji: '🌶️', desc: 'Bumbu rica pedas khas Manado' },
        ],
      },
      {
        name: 'Paket',
        items: [
          { name: 'Paket Nasi + Ayam', price: 15000, emoji: '🍱' },
          { name: 'Paket Geprek + Es Teh', price: 17000, emoji: '🍱', discount_type: 'nominal', discount_value: 1000 },
          { name: 'Paket Hemat Pelajar', price: 12000, emoji: '🎒', desc: 'Nasi + ayam sayap + es teh' },
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
          { name: 'Bakso Jumbo', price: 18000, emoji: '🍲', desc: 'Satu bakso raksasa isi telur' },
          { name: 'Bakso Beranak', price: 20000, emoji: '🥘', desc: 'Bakso jumbo isi bakso-bakso kecil' },
          { name: 'Bakso Komplit', price: 20000, emoji: '🥘', desc: 'Halus + urat + telur + tahu', discount_type: 'nominal', discount_value: 2000 },
        ],
      },
      {
        name: 'Tambahan',
        items: [
          { name: 'Mie / Bihun Extra', price: 3000, emoji: '🍝' },
          { name: 'Pangsit Goreng', price: 3000, emoji: '🥟' },
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
          { name: 'Mie Ayam', price: 12000, emoji: '🍝', variants: 'Kuah,Nyemek=0,Kering=0' },
          { name: 'Mie Ayam Bakso', price: 15000, emoji: '🍜' },
          { name: 'Mie Ayam Ceker', price: 15000, emoji: '🍗' },
          { name: 'Mie Ayam Pangsit', price: 14000, emoji: '🥟', desc: 'Pangsit goreng renyah' },
          { name: 'Mie Ayam Komplit', price: 18000, emoji: '🥘', desc: 'Bakso + ceker + pangsit', discount_type: 'nominal', discount_value: 2000 },
          { name: 'Yamin Manis', price: 13000, emoji: '🍝' },
          { name: 'Yamin Pedas', price: 13000, emoji: '🌶️' },
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
          { name: 'Soto Ayam', price: 12000, emoji: '🥣', variants: 'Nasi Pisah,Nasi Campur=0' },
          { name: 'Soto Daging', price: 18000, emoji: '🥩', variants: 'Nasi Pisah,Nasi Campur=0' },
          { name: 'Soto Babat', price: 17000, emoji: '🥣' },
          { name: 'Soto Kikil', price: 17000, emoji: '🥣', desc: 'Kikil sapi empuk, kuah gurih' },
          { name: 'Soto Campur', price: 20000, emoji: '🍲', desc: 'Daging + babat + kikil', discount_type: 'nominal', discount_value: 2000 },
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
          { name: 'Kopi Susu', price: 8000, emoji: '☕', variants: 'Panas,Dingin=1000' },
          { name: 'Es Kopi Susu Gula Aren', price: 12000, emoji: '🧋', desc: 'Espresso, susu, gula aren asli' },
          { name: 'Teh Manis Hangat', price: 4000, emoji: '🍵' },
          { name: 'Es Teh Manis', price: 5000, emoji: '🧋' },
          { name: 'Es Jeruk', price: 6000, emoji: '🍹' },
          { name: 'Wedang Jahe', price: 6000, emoji: '🫚', desc: 'Hangat, cocok buat begadang' },
        ],
      },
      {
        name: 'Makanan',
        items: [
          { name: 'Indomie Goreng + Telur', price: 10000, emoji: '🍳', variants: 'Original,Pakai Sayur=1000' },
          { name: 'Indomie Rebus + Telur', price: 10000, emoji: '🍜', variants: 'Original,Pakai Sayur=1000' },
          { name: 'Roti Bakar Coklat Keju', price: 12000, emoji: '🍞', variants: 'Coklat,Keju,Coklat Keju=2000' },
          { name: 'Nasi Kucing', price: 3000, emoji: '🍙', desc: 'Nasi porsi kecil + sambal teri' },
          { name: 'Pisang Goreng', price: 2000, emoji: '🍌' },
          { name: 'Gorengan', price: 2000, emoji: '🥟' },
        ],
      },
    ],
  },
  {
    id: 'minuman',
    name: 'Minuman / Kedai Kopi',
    emoji: '🧋',
    desc: 'Kopi kekinian, teh, jus, minuman kekinian',
    categories: [
      {
        name: 'Kopi',
        items: [
          { name: 'Americano', price: 12000, emoji: '☕', variants: 'Panas,Dingin=0' },
          { name: 'Kopi Susu Gula Aren', price: 15000, emoji: '🧋', variants: 'Regular,Large=3000' },
          { name: 'Cappuccino', price: 16000, emoji: '☕' },
          { name: 'Caramel Macchiato', price: 18000, emoji: '☕', variants: 'Regular,Large=3000' },
        ],
      },
      {
        name: 'Non-Kopi',
        items: [
          { name: 'Matcha Latte', price: 17000, emoji: '🍵', variants: 'Regular,Large=3000' },
          { name: 'Taro Milk', price: 15000, emoji: '🥤' },
          { name: 'Chocolate Milk', price: 15000, emoji: '🍫' },
          { name: 'Thai Tea', price: 14000, emoji: '🧋' },
          { name: 'Jus Alpukat', price: 15000, emoji: '🥑', desc: 'Alpukat asli, susu coklat' },
          { name: 'Jus Mangga', price: 13000, emoji: '🥭' },
        ],
      },
      {
        name: 'Tambahan',
        items: [
          { name: 'Extra Shot Espresso', price: 5000, emoji: '☕' },
          { name: 'Boba / Pearl', price: 3000, emoji: '🧋' },
          { name: 'Less Ice', price: 0, emoji: '🧊' },
        ],
      },
    ],
  },
  {
    id: 'nasipadang',
    name: 'Nasi Padang',
    emoji: '🍛',
    desc: 'Rumah makan Padang, lauk pilihan',
    categories: [
      {
        name: 'Lauk Utama',
        items: [
          { name: 'Rendang Daging', price: 20000, emoji: '🥩', desc: 'Empuk, bumbu meresap' },
          { name: 'Ayam Pop', price: 15000, emoji: '🍗' },
          { name: 'Ayam Bakar', price: 16000, emoji: '🍗' },
          { name: 'Gulai Ikan', price: 15000, emoji: '🐟' },
          { name: 'Dendeng Balado', price: 18000, emoji: '🌶️' },
          { name: 'Telur Balado', price: 8000, emoji: '🥚' },
          { name: 'Paket Rendang + Nasi', price: 22000, emoji: '🍱', discount_type: 'nominal', discount_value: 2000 },
        ],
      },
      {
        name: 'Sayur & Tambahan',
        items: [
          { name: 'Nasi Putih', price: 5000, emoji: '🍚' },
          { name: 'Sayur Nangka', price: 4000, emoji: '🥬' },
          { name: 'Sambal Ijo Extra', price: 2000, emoji: '🌶️' },
          { name: 'Kerupuk Kulit', price: 3000, emoji: '🍘' },
        ],
      },
      {
        name: 'Minuman',
        items: [
          { name: 'Es Teh Manis', price: 5000, emoji: '🧋' },
          { name: 'Teh Talua', price: 8000, emoji: '🍵', desc: 'Teh telur khas Minang' },
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
        description: item.desc ?? null,
        variants: item.variants ?? null,
        variant_group_id: null,
        variant_group_ids: null,
        discount_type: item.discount_type ?? 'none',
        discount_value: item.discount_value ?? 0,
        image_url: null,
        emoji: item.emoji,
        is_active: true,
        created_at: now,
        updated_at: now,
      }))
    );
  }
}
