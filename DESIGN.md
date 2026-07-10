# Design

Sistem visual Inspira POS Offline — mewarisi identitas ipos-v1 (identitas brand sudah committed; bukan palet baru).

## Theme

Light. Dipakai di warung / gerobak siang hari, layar HP murah — light theme dengan kontras tinggi adalah keputusan fungsional.

## Color Palette

| Token | Value | Pemakaian |
|---|---|---|
| `--background` | hsl(36 53% 96%) `#F7F2EA` krem | Latar halaman |
| `--card` | hsl(0 0% 100%) putih | Kartu, panel, modal |
| `--foreground` | hsl(10 25% 10%) `#211511` | Teks utama |
| `--muted-foreground` | hsl(10 15% 40%) | Teks sekunder (≥4.5:1 di atas krem) |
| `--primary` | hsl(4 72% 25%) `#6E150F` maroon tua | Tombol utama, nav aktif, total harga |
| `--primary-light` | hsl(5 73% 41%) `#B92A1C` maroon terang | Hover/pressed, aksen grafik |
| `--accent` | hsl(40 64% 52%) `#D0A139` emas antik | Badge trial, highlight, bintang Pro |
| `--success` | hsl(142 71% 35%) | Lunas, kembalian, konfirmasi bayar |
| `--warning` | hsl(38 92% 42%) | Trial hampir habis, stok menipis |
| `--destructive` | hsl(0 74% 46%) | Hapus, tutup shift, void |
| `--border` | hsl(36 20% 86%) | Garis kartu & input |

Strategi warna: **Restrained** — krem + putih dominan, maroon hanya untuk aksi utama & seleksi, emas hanya untuk status trial/premium. Satu pengecualian Committed: layar onboarding welcome boleh maroon penuh.

## Typography

- Family: **Plus Jakarta Sans** (Google Fonts, di-cache service worker untuk offline), fallback `system-ui, sans-serif`. Satu family untuk semua.
- Scale (rem, fixed): 12 caption · 14 body · 16 label penting · 20 judul kartu · 24 judul layar · 32–40 angka total transaksi (bold 700–800).
- Angka uang selalu bold, `tabular-nums`.

## Shape & Space

- Radius: 12px kartu/input (`rounded-xl`), 16px modal (`rounded-2xl`), full untuk chip kategori.
- Spacing dasar 4px; padding kartu 16px; gap grid produk 12px.
- Shadow: `shadow-sm` kartu, `shadow-xl` modal. Tidak ada glassmorphism.

## Components

- **Tombol utama**: maroon solid, teks putih bold, tinggi ≥ 48px, radius 12px.
- **Chip kategori**: pill, maroon solid saat aktif, putih ber-border saat tidak.
- **Kartu produk**: putih, foto/emoji persegi, nama 14px medium, harga maroon semibold.
- **Bottom nav**: owner = Beranda · Produk · **Kasir** · Laporan · Lainnya; kasir = Produk · **Kasir** · Shift. Kasir selalu di tengah, dirender sebagai FAB bundar 56px maroon mengambang (ring putih 4px, shadow-lg, -mt-7) — aksi utama kasir, bukan tab rata. Tab lain: ikon + label 11px, maroon + pill emas lembut saat aktif. Tinggi bar ≥60px + safe-area.
- **Badge trial**: pill emas muda, teks maroon gelap, selalu di topbar; jadi warning oranye saat ≤ 3 hari / ≥ 40 transaksi.
- **Modal**: slide dari bawah di HP (items-end), center di tablet; backdrop hitam 50%.
- **Empty state**: emoji besar + kalimat ajakan bahasa warung + tombol aksi.

## Motion

150–250ms, ease-out. Modal: slide-up + fade. Item masuk keranjang: scale tap feedback (`active:scale-95`). Tidak ada animasi dekoratif; `prefers-reduced-motion` → transisi instan.

## Voice (UX copy)

- Sapaan "kamu". Kalimat pendek. Contoh nyata warung.
- ✅ "Menu kamu masih kosong. Yuk isi dulu!" ❌ "Data produk tidak ditemukan."
- ✅ "Masa coba selesai. Lanjutkan dengan kode aktivasi." ❌ "Lisensi tidak valid / expired."
- Batasan trial ditulis apa adanya: "Selama masa coba: 14 hari, 50 transaksi, 20 menu."
