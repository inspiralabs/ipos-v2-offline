export const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

// "Ayam Geprek (Pedas Level 3)" → { base: 'Ayam Geprek', variant: 'Pedas Level 3' }
// Variasi disimpan menyatu di product_name (lihat VariantModal di PosScreen) — dipisah lagi
// saat ditampilkan (struk & keranjang) supaya terlihat jelas, bukan tenggelam & terpotong truncate.
export function splitVariant(name: string): { base: string; variant: string | null } {
  const m = name.match(/^(.+?) \((.+)\)$/);
  return m ? { base: m[1], variant: m[2] } : { base: name, variant: null };
}
