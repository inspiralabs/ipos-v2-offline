import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Search, Minus, Plus, ShoppingCart, ReceiptText, Star, StickyNote, Tag, Trash2, ChevronDown, User } from 'lucide-react';
import { db, type Menu, type OrderItem, type VariantGroup } from '@/db';
import { useCartStore, getCartTotals, keyOf } from '@/store/pos';
import { useLicenseStore } from '@/store/license';
import { hasFeature } from '@/lib/plan';
import { CheckoutModal } from './CheckoutModal';
import { Modal } from '@/components/Modal';
import { RupiahInput } from '@/components/RupiahInput';
import { toast } from '@/components/Toast';
import { confirmDialog, promptDialog } from '@/components/dialogs';
import { formatRp, splitVariant } from '@/lib/format';
import { parseVariants, resolveVariantGroups, resolveVariantString } from '@/lib/variants';

const LOW_STOCK_DEFAULT = 5;

/** Diskon otomatis produk (dari form Menu) → nominal Rp untuk 1 pcs pada harga tertentu. */
function autoDiscount(p: Menu, priceEach: number): number {
  if (p.discount_type === 'percent') return Math.min(priceEach, Math.round(priceEach * p.discount_value / 100));
  if (p.discount_type === 'nominal') return Math.min(priceEach, p.discount_value);
  return 0;
}

export function PosScreen() {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<number | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showCartSheet, setShowCartSheet] = useState(false);
  const [variantMenu, setVariantMenu] = useState<Menu | null>(null);
  const [showBills, setShowBills] = useState(false);
  const { items, addItem, updateItem, discount, clear, load, resumedOrderId, tableNumber, setTable, customerName } = useCartStore();
  const { total } = getCartTotals(items, discount);
  const itemCount = items.reduce((n, i) => n + i.qty, 0);

  const categories = useLiveQuery(
    async () => (await db.categories.toArray()).sort((a, b) => a.sort_order - b.sort_order),
    []
  ) ?? [];
  // is_active boolean tidak bisa di-index IndexedDB — filter di JS
  const products = useLiveQuery(() => db.menus.filter((m) => !!m.is_active).toArray(), []);
  const openBills = useLiveQuery(() => db.orders.where('status').equals('open').toArray(), []) ?? [];
  const variantGroups = useLiveQuery(() => db.variant_groups.toArray(), []) ?? [];

  const filtered = (products ?? []).filter((p) =>
    (p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku ?? '').toLowerCase() === search.toLowerCase()) &&
    (catFilter === null || p.category_id === catFilter)
  );

  function tapProduct(p: Menu) {
    if (p.stock === 0) return;
    const groups = resolveVariantGroups(p, variantGroups);
    const variants = parseVariants(resolveVariantString(p, variantGroups));
    if (groups.length || variants.length) { setVariantMenu(p); return; }
    addItem({ product_id: p.id, product_name: p.name, price: p.price, hpp: p.hpp ?? 0 });
    const disc = autoDiscount(p, p.price);
    if (disc > 0) updateItem(keyOf({ product_id: p.id, product_name: p.name }), { discount: disc });
  }

  function openPay() {
    setShowCartSheet(false);
    setShowCheckout(true);
  }

  async function saveBill() {
    // sudah diisi lewat panel pelanggan & meja di keranjang → langsung simpan tanpa tanya ulang
    let label = tableNumber;
    if (!label.trim()) {
      const typed = await promptDialog('Nama bill / nomor meja', {
        initial: '', placeholder: 'Contoh: Meja 1', okLabel: 'Simpan',
      });
      if (typed === null) return; // batal
      label = typed;
    }
    if (!label.trim() && items.length === 0) return;
    const { subtotal, total } = getCartTotals(items, discount);
    await db.orders.put({
      id: resumedOrderId ?? crypto.randomUUID(),
      items, subtotal, discount, total,
      payment_method: 'cash', cash_received: null, change: null,
      status: 'open', cashier_name: 'Kasir', shift_id: null,
      customer_id: null, customer_name: customerName.trim() || null,
      table_number: label.trim() || 'Bill', notes: null,
      created_at: Date.now(), synced: false,
    });
    clear();
    setShowCartSheet(false);
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Panel produk */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-card border-b border-border px-4 pt-3 pb-2 shrink-0 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari menu atau SKU…"
                aria-label="Cari menu"
                className="w-full border border-border rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            {openBills.length > 0 && (
              <button
                onClick={() => setShowBills(true)}
                className="shrink-0 flex items-center gap-1.5 border border-accent bg-accent-soft text-primary rounded-xl px-3 text-sm font-bold"
              >
                <ReceiptText className="w-4 h-4" aria-hidden /> Bill ({openBills.length})
              </button>
            )}
          </div>
          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
              <CatChip label="Semua" active={catFilter === null} onClick={() => setCatFilter(null)} />
              {categories.map((c) => (
                <CatChip
                  key={c.id}
                  label={c.name}
                  active={catFilter === c.id}
                  onClick={() => setCatFilter(catFilter === c.id ? null : c.id!)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4">
          {filtered.length === 0 ? (
            <div className="text-center py-16 px-6">
              <span className="text-4xl block mb-3" aria-hidden>🍽️</span>
              <p className="text-sm text-muted-foreground">
                {products?.length === 0
                  ? 'Menu kamu masih kosong. Buka tab Menu untuk mengisinya, yuk!'
                  : 'Nggak ketemu. Coba kata lain atau pilih kategori berbeda.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
              {filtered.map((p) => {
                const soldOut = p.stock === 0;
                const lowStock = p.stock != null && p.stock > 0 && p.stock <= (p.min_stock ?? LOW_STOCK_DEFAULT);
                return (
                  <button
                    key={p.id}
                    onClick={() => tapProduct(p)}
                    disabled={soldOut}
                    className={`bg-card rounded-xl p-3 text-left shadow-sm border border-border transition ${
                      soldOut ? 'opacity-50' : 'hover:shadow-md active:scale-95'
                    }`}
                  >
                    <div className="relative aspect-square bg-muted rounded-lg mb-2 flex items-center justify-center text-3xl">
                      {p.image_url
                        ? <img src={p.image_url} className="w-full h-full object-cover rounded-lg" alt="" />
                        : <span aria-hidden>{p.emoji ?? '🍽️'}</span>}
                      {soldOut && (
                        <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/45 text-white text-xs font-extrabold tracking-wide">
                          HABIS
                        </span>
                      )}
                      {lowStock && (
                        <span className="absolute top-1 right-1 bg-warning text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          Sisa {p.stock}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold truncate">{p.name}</p>
                    {p.description && (
                      <p className="text-xs text-muted-foreground truncate">{p.description}</p>
                    )}
                    <p className="text-sm text-primary font-bold tabular-nums">{formatRp(p.price)}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Panel keranjang — tablet/desktop */}
      <div className="hidden md:flex w-72 xl:w-80 bg-card border-l border-border flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-bold">Keranjang</h2>
          {resumedOrderId && <span className="text-xs bg-accent-soft text-primary font-bold px-2 py-1 rounded-full">{tableNumber}</span>}
        </div>
        <CartBody onPay={openPay} onSaveBill={saveBill} />
      </div>

      {/* Bar keranjang mengambang — HP */}
      {itemCount > 0 && !showCartSheet && (
        <button
          onClick={() => setShowCartSheet(true)}
          className="md:hidden fixed bottom-20 left-4 right-4 bg-primary text-primary-foreground rounded-xl px-4 py-3 flex items-center justify-between shadow-xl z-40"
        >
          <span className="flex items-center gap-2 text-sm font-bold">
            <ShoppingCart className="w-4 h-4" aria-hidden /> {itemCount} item
          </span>
          <span className="text-sm font-extrabold tabular-nums">{formatRp(total)}</span>
        </button>
      )}

      {/* Sheet keranjang — HP */}
      {showCartSheet && (
        <Modal onClose={() => setShowCartSheet(false)}>
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-bold">Keranjang</h2>
            {resumedOrderId && <span className="text-xs bg-accent-soft text-primary font-bold px-2 py-1 rounded-full">{tableNumber}</span>}
          </div>
          <CartBody onPay={openPay} onSaveBill={saveBill} />
        </Modal>
      )}

      {/* Pilih variasi + catatan */}
      {variantMenu && (
        <VariantModal menu={variantMenu} groups={variantGroups} onClose={() => setVariantMenu(null)} />
      )}

      {/* Bill tersimpan */}
      {showBills && (
        <Modal onClose={() => setShowBills(false)}>
          <div className="px-6 pt-5 pb-4 border-b border-border">
            <h2 className="font-bold text-lg">Bill Tersimpan</h2>
            <p className="text-sm text-muted-foreground">Pesanan yang belum dibayar.</p>
          </div>
          <div className="px-6 py-4 space-y-2">
            {openBills.map((b) => (
              <div key={b.id} className="border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">
                    {[b.table_number ?? 'Bill', b.customer_name].filter(Boolean).join(' · ')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {b.items.reduce((n, i) => n + i.qty, 0)} item · <span className="tabular-nums">{formatRp(b.total)}</span>
                  </p>
                </div>
                <button
                  onClick={() => {
                    load(b.items, b.discount, b.table_number ?? '', b.id, b.customer_name ?? '');
                    setShowBills(false);
                  }}
                  className="shrink-0 bg-primary text-primary-foreground text-sm font-bold px-3 py-2 rounded-xl"
                >
                  Lanjutkan
                </button>
                <button
                  onClick={async () => {
                    if (await confirmDialog(`Hapus bill "${b.table_number}"?`, { danger: true, okLabel: 'Hapus' })) await db.orders.delete(b.id);
                  }}
                  className="shrink-0 text-sm text-muted-foreground hover:text-destructive px-1 py-2"
                >
                  Hapus
                </button>
              </div>
            ))}
            {openBills.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Tidak ada bill tersimpan.</p>
            )}
          </div>
        </Modal>
      )}

      {showCheckout && <CheckoutModal onClose={() => setShowCheckout(false)} />}
    </div>
  );
}

/**
 * Input potongan dengan pilihan Rp / %. Nilai tersimpan selalu nominal (skema tidak berubah).
 * ponytail: % dikonversi ke nominal saat diketik — kalau isi keranjang berubah setelahnya,
 * potongan tidak ikut naik. Ketik ulang %-nya kalau perlu.
 */
function DiscountInput({ id, base, value, onChange }: {
  id: string; base: number; value: number; onChange: (v: number) => void;
}) {
  const [pct, setPct] = useState(false);
  const [pctStr, setPctStr] = useState('');
  const clamp = (v: number) => Math.min(base, Math.max(0, v)); // potongan tidak boleh melebihi harga

  return (
    <div className="flex gap-1.5 flex-1 min-w-0">
      {pct ? (
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          value={pctStr}
          placeholder="0"
          onChange={(e) => {
            setPctStr(e.target.value);
            onChange(clamp(Math.round(base * (Number(e.target.value) || 0) / 100)));
          }}
          className="flex-1 min-w-0 border border-border rounded-lg px-2 py-1.5 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
        />
      ) : (
        <RupiahInput
          id={id}
          value={value ? String(value) : ''}
          onChange={(d) => onChange(clamp(Number(d) || 0))}
          className="flex-1 min-w-0 border border-border rounded-lg px-2 py-1.5 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
        />
      )}
      <div className="flex rounded-lg border border-border overflow-hidden shrink-0" role="radiogroup" aria-label="Jenis potongan">
        {(['Rp', '%'] as const).map((u) => {
          const active = pct === (u === '%');
          return (
            <button
              key={u}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setPct(u === '%');
                // pindah ke % → tampilkan persen setara dari nominal yang sudah ada
                setPctStr(u === '%' && base > 0 && value > 0 ? String(Math.round((value / base) * 100)) : '');
              }}
              className={`px-2.5 text-xs font-bold min-h-[32px] ${active ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}
            >
              {u}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CatChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold transition min-h-[32px] ${
        active ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:border-primary/40'
      }`}
    >
      {label}
    </button>
  );
}

/** Isi keranjang + total + tombol bayar. Dipakai panel samping & sheet HP. */
function CartBody({ onPay, onSaveBill }: { onPay: () => void; onSaveBill: () => void }) {
  const {
    items, updateQty, updateItem, removeItem, discount, setDiscount, clear,
    tableNumber, setTable, customerName, setCustomerName, customerPhone, setCustomerPhone,
  } = useCartStore();
  const licState = useLicenseStore((s) => s.state);
  const { subtotal, total } = getCartTotals(items, discount);
  const [openKey, setOpenKey] = useState<string | null>(null); // baris keranjang yang panel diskon/catatannya terbuka
  const [noteDraft, setNoteDraft] = useState(''); // draft catatan baris yang sedang terbuka — perlu tombol Simpan
  const [splitMode, setSplitMode] = useState(false);
  const [splitSel, setSplitSel] = useState<Set<string>>(new Set());
  // panel meja/pelanggan: terbuka otomatis kalau sudah pernah diisi (mis. lanjut dari bill tersimpan)
  const [orderInfoOpen, setOrderInfoOpen] = useState(false);

  const canSplit = hasFeature(licState, 'split_bill');

  // buka/tutup panel diskon+catatan; saat buka, salin catatan saat ini ke draft
  function togglePanel(k: string, currentNotes: string | null) {
    if (openKey === k) { setOpenKey(null); return; }
    setOpenKey(k);
    setNoteDraft(currentNotes ?? '');
  }

  async function doSplit() {
    const moved = items.filter((i) => splitSel.has(keyOf(i)));
    if (!moved.length) { setSplitMode(false); return; }
    const label = await promptDialog('Nama bill baru untuk item yang dipisah', {
      initial: 'Bill 2', okLabel: 'Pisahkan',
    });
    if (label === null) return; // batal
    const sub = moved.reduce((s, i) => s + i.price * i.qty - i.discount, 0);
    await db.orders.add({
      id: crypto.randomUUID(),
      items: moved, subtotal: sub, discount: 0, total: sub,
      payment_method: 'cash', cash_received: null, change: null,
      status: 'open', cashier_name: 'Kasir', shift_id: null,
      customer_id: null, customer_name: customerName.trim() || null,
      table_number: label.trim() || 'Bill 2', notes: null,
      created_at: Date.now(), synced: false,
    });
    for (const k of splitSel) removeItem(k);
    setSplitSel(new Set());
    setSplitMode(false);
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 min-h-[120px] max-h-[45dvh] md:max-h-none">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">tap menu untuk mulai jualan</p>
        )}
        {items.map((item) => {
          const k = keyOf(item);
          const open = openKey === k;
          const { base, variant } = splitVariant(item.product_name);
          return (
            <div key={k} className="border-b border-border/60 last:border-0 pb-3 last:pb-0">
              <div className="flex items-center gap-2">
                {splitMode && (
                  <input
                    type="checkbox"
                    checked={splitSel.has(k)}
                    onChange={(e) => {
                      const next = new Set(splitSel);
                      e.target.checked ? next.add(k) : next.delete(k);
                      setSplitSel(next);
                    }}
                    aria-label={`Pisahkan ${item.product_name}`}
                    className="w-4 h-4 accent-[var(--color-primary)] shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{base}</p>
                  {variant && <p className="text-xs font-bold text-primary truncate">▸ {variant}</p>}
                  <p className="text-xs text-muted-foreground tabular-nums">{formatRp(item.price)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateQty(k, item.qty - 1)}
                    aria-label={`Kurangi ${item.product_name}`}
                    className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center hover:bg-border"
                  >
                    <Minus className="w-3.5 h-3.5" aria-hidden />
                  </button>
                  <span className="w-7 text-center text-sm font-bold tabular-nums">{item.qty}</span>
                  <button
                    onClick={() => updateQty(k, item.qty + 1)}
                    aria-label={`Tambah ${item.product_name}`}
                    className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary-light"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden />
                  </button>
                </div>
                <p className="text-sm font-bold w-16 text-right tabular-nums">{formatRp(item.price * item.qty - item.discount)}</p>
              </div>

              {/* Aksi cepat per item: diskon & catatan langsung di keranjang (tanpa buka halaman detail) */}
              <div className="flex items-center gap-3 mt-1.5 pl-0.5">
                <button
                  onClick={() => togglePanel(k, item.notes)}
                  className={`flex items-center gap-1 text-xs font-semibold ${item.discount > 0 ? 'text-success' : 'text-muted-foreground hover:text-primary'}`}
                >
                  <Tag className="w-3.5 h-3.5" aria-hidden />
                  {item.discount > 0 ? `Diskon ${formatRp(item.discount)}` : 'Diskon'}
                </button>
                <button
                  onClick={() => togglePanel(k, item.notes)}
                  className={`flex items-center gap-1 text-xs font-semibold min-w-0 ${item.notes ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                >
                  <StickyNote className="w-3.5 h-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{item.notes || 'Catatan'}</span>
                </button>
                <button
                  onClick={() => removeItem(k)}
                  aria-label={`Hapus ${item.product_name}`}
                  className="ml-auto text-muted-foreground hover:text-destructive shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden />
                </button>
                <button
                  onClick={() => togglePanel(k, item.notes)}
                  aria-label={open ? 'Tutup' : 'Ubah diskon & catatan'}
                  className="text-muted-foreground shrink-0"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
                </button>
              </div>

              {open && (
                <div className="mt-2 bg-muted/50 rounded-xl p-3 space-y-2.5">
                  <div>
                    <label className="block text-xs font-medium mb-1" htmlFor={`note-${k}`}>Catatan</label>
                    <div className="flex gap-2">
                      <input
                        id={`note-${k}`}
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { updateItem(k, { notes: noteDraft.trim() || null }); setOpenKey(null); }
                        }}
                        placeholder="Contoh: tanpa bawang, extra sambal"
                        autoFocus
                        className="flex-1 min-w-0 border border-border rounded-lg px-2.5 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <button
                        onClick={() => { updateItem(k, { notes: noteDraft.trim() || null }); setOpenKey(null); }}
                        className="shrink-0 bg-primary text-primary-foreground font-bold px-4 rounded-lg text-sm"
                      >
                        Simpan
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" htmlFor={`disc-${k}`}>Potongan untuk item ini</label>
                    <DiscountInput
                      id={`disc-${k}`}
                      base={item.price * item.qty}
                      value={item.discount}
                      onChange={(v) => updateItem(k, { discount: v })}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="px-4 py-3 border-t border-border space-y-2">
        {items.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setOrderInfoOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 text-sm py-1.5"
            >
              <span className="flex items-center gap-1.5 text-muted-foreground font-medium min-w-0">
                <User className="w-3.5 h-3.5 shrink-0" aria-hidden />
                <span className="truncate">
                  {tableNumber || customerName
                    ? [tableNumber, customerName].filter(Boolean).join(' · ')
                    : 'Pelanggan & meja (opsional)'}
                </span>
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform ${orderInfoOpen ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {orderInfoOpen && (
              <div className="grid grid-cols-2 gap-2 pb-2">
                <div>
                  <label className="sr-only" htmlFor="cartTable">Nomor meja</label>
                  <input
                    id="cartTable"
                    value={tableNumber}
                    onChange={(e) => setTable(e.target.value)}
                    placeholder="No. meja"
                    className="w-full border border-border rounded-lg px-2.5 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="sr-only" htmlFor="cartCustomerName">Nama pelanggan</label>
                  <input
                    id="cartCustomerName"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nama pelanggan"
                    className="w-full border border-border rounded-lg px-2.5 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="col-span-2">
                  <label className="sr-only" htmlFor="cartCustomerPhone">No. HP pelanggan</label>
                  <input
                    id="cartCustomerPhone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="No. HP pelanggan (boleh kosong)"
                    inputMode="numeric"
                    className="w-full border border-border rounded-lg px-2.5 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            )}
          </div>
        )}
        {items.length > 0 && (
          <div className="flex gap-3 text-sm">
            <button onClick={onSaveBill} className="text-primary font-semibold">Simpan Bill</button>
            {splitMode ? (
              <>
                <button onClick={doSplit} className="text-primary font-semibold">Pisahkan ({splitSel.size})</button>
                <button onClick={() => { setSplitMode(false); setSplitSel(new Set()); }} className="text-muted-foreground">Batal</button>
              </>
            ) : (
              <button
                onClick={() => canSplit ? setSplitMode(true) : toast('⭐ Pisah bill ada di versi Pro. Upgrade lewat menu Pengaturan.')}
                className="text-primary font-semibold flex items-center gap-1"
              >
                {!canSplit && <Star className="w-3 h-3 text-accent" aria-hidden />} Pisah Bill
              </button>
            )}
            <button
              onClick={async () => (await confirmDialog('Kosongkan keranjang?', { danger: true, okLabel: 'Kosongkan' })) && clear()}
              className="text-muted-foreground ml-auto"
            >
              Kosongkan
            </button>
          </div>
        )}
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Subtotal</span><span className="tabular-nums">{formatRp(subtotal)}</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground shrink-0" htmlFor="cartDiscount">Potongan</label>
          <DiscountInput id="cartDiscount" base={subtotal} value={discount} onChange={setDiscount} />
        </div>
        <div className="flex justify-between font-extrabold text-base">
          <span>Total</span><span className="text-primary tabular-nums">{formatRp(total)}</span>
        </div>
        <button
          onClick={onPay}
          disabled={items.length === 0}
          className="w-full bg-success text-white font-extrabold py-3.5 rounded-xl text-base mt-1 disabled:opacity-40 active:scale-[0.99] transition"
        >
          Bayar {formatRp(total)}
        </button>
      </div>
    </>
  );
}

/**
 * Modal pilih variasi + catatan khusus. Harga variasi ditandai jelas:
 * "+Rp X" hanya untuk yang menambah harga; yang tidak menambah = "Harga sama".
 * Total di tombol menunjukkan harga akhir item yang akan masuk keranjang.
 */
function VariantModal({ menu, groups, onClose }: { menu: Menu; groups: VariantGroup[]; onClose: () => void }) {
  const { addItem, updateItem } = useCartStore();
  const menuGroups = resolveVariantGroups(menu, groups);
  const fallback = parseVariants(resolveVariantString(menu, groups));
  const [singleSel, setSingleSel] = useState<Record<number, number>>({});
  const [multiSel, setMultiSel] = useState<Record<number, Set<number>>>({});
  const [fallbackSel, setFallbackSel] = useState<number | 'plain'>(0); // legacy fallback
  const [note, setNote] = useState('');

  const selectionRows = menuGroups.map((g) => {
    const opts = parseVariants(g.options);
    if (g.selection === 'multi') {
      const picks = Array.from(multiSel[g.id!] ?? []).map((i) => opts[i]).filter(Boolean);
      return { label: `${g.name}: ${picks.map((x) => x.name).join(', ')}`, delta: picks.reduce((s, x) => s + x.delta, 0), count: picks.length, required: g.required };
    }
    const idx = singleSel[g.id!];
    const picked = idx == null ? null : opts[idx];
    return { label: picked ? `${g.name}: ${picked.name}` : '', delta: picked?.delta ?? 0, count: picked ? 1 : 0, required: g.required };
  });
  const missingRequired = menuGroups.some((g, i) => selectionRows[i].required && selectionRows[i].count === 0);
  const pickedLabels = selectionRows.map((x) => x.label).filter(Boolean);
  const pickedDelta = selectionRows.reduce((s, x) => s + x.delta, 0);
  const fallbackDelta = menuGroups.length ? 0 : (fallbackSel === 'plain' ? 0 : fallback[fallbackSel]?.delta ?? 0);
  const fallbackLabel = menuGroups.length
    ? null
    : (fallbackSel === 'plain' ? null : fallback[fallbackSel]?.name ?? null);
  const finalPrice = menu.price + pickedDelta + fallbackDelta;
  const variantLabel = [...pickedLabels, ...(fallbackLabel ? [fallbackLabel] : [])].join(' · ');
  const finalName = variantLabel ? `${menu.name} (${variantLabel})` : menu.name;

  function add() {
    if (missingRequired) {
      toast('Masih ada variasi wajib yang belum dipilih.', 'error');
      return;
    }
    addItem({ product_id: menu.id, product_name: finalName, price: finalPrice, hpp: menu.hpp ?? 0 });
    const disc = autoDiscount(menu, finalPrice);
    const patch = { ...(note.trim() ? { notes: note.trim() } : {}), ...(disc > 0 ? { discount: disc } : {}) };
    if (Object.keys(patch).length) updateItem(`${menu.id}|${finalName}`, patch);
    onClose();
  }

  return (
    <Modal onClose={onClose}>
      <div className="px-6 pt-5 pb-4 border-b border-border">
        <h2 className="font-bold text-lg">{menu.name}</h2>
        <p className="text-sm text-muted-foreground">
          Harga dasar <span className="tabular-nums font-semibold">{formatRp(menu.price)}</span> · pilih variasi & tambah catatan
        </p>
        {menu.description && (
          <details className="mt-1.5 group">
            <summary className="list-none cursor-pointer inline-flex items-center gap-1 py-1 text-sm text-primary font-medium select-none">
              Lihat deskripsi
              <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <p className="text-sm text-muted-foreground mt-1">{menu.description}</p>
          </details>
        )}
      </div>
      <div className="px-6 py-4 space-y-3">
        {menuGroups.map((g) => {
          const opts = parseVariants(g.options);
          return (
            <details key={g.id} className="border border-border rounded-xl" open>
              <summary className="list-none cursor-pointer px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-semibold">{g.name}</span>
                <span className="text-xs text-muted-foreground">
                  {g.selection === 'multi' ? 'Bisa pilih banyak' : 'Pilih satu'}{g.required ? ' · wajib' : ''}
                </span>
              </summary>
              <div className="px-3 pb-3 space-y-2">
                {opts.map((v, i) => {
                  const checked = g.selection === 'multi'
                    ? (multiSel[g.id!]?.has(i) ?? false)
                    : singleSel[g.id!] === i;
                  return (
                    <button
                      key={`${g.id}-${v.name}-${i}`}
                      onClick={() => {
                        if (g.selection === 'multi') {
                          setMultiSel((s) => {
                            const cur = new Set(s[g.id!] ?? []);
                            if (cur.has(i)) cur.delete(i); else cur.add(i);
                            return { ...s, [g.id!]: cur };
                          });
                          return;
                        }
                        setSingleSel((s) => {
                          if (checked) {
                            const { [g.id!]: _removed, ...rest } = s;
                            return rest;
                          }
                          return { ...s, [g.id!]: i };
                        });
                      }}
                      className={`w-full flex justify-between items-center border rounded-lg px-3 py-2.5 text-sm transition ${
                        checked ? 'border-primary bg-accent-soft' : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <span>{v.name}</span>
                      {v.delta > 0 ? <span className="font-bold tabular-nums text-accent">+{formatRp(v.delta)}</span> : <span className="text-xs text-muted-foreground">Harga sama</span>}
                    </button>
                  );
                })}
              </div>
            </details>
          );
        })}
        {!menuGroups.length && (
          <div role="radiogroup" aria-label="Pilih variasi" className="space-y-2">
            {fallback.map((v, i) => (
              <button
                key={v.name}
                role="radio"
                aria-checked={fallbackSel === i}
                onClick={() => setFallbackSel(i)}
                className={`w-full flex justify-between items-center border rounded-xl px-4 py-3 text-sm min-h-[48px] transition ${
                  fallbackSel === i ? 'border-primary bg-accent-soft' : 'border-border hover:border-primary/40'
                }`}
              >
                <span className="font-semibold">{v.name}</span>
                {v.delta > 0
                  ? <span className="text-accent font-bold tabular-nums">+{formatRp(v.delta)}</span>
                  : <span className="text-xs text-muted-foreground">Harga sama</span>}
              </button>
            ))}
            <button
              role="radio"
              aria-checked={fallbackSel === 'plain'}
              onClick={() => setFallbackSel('plain')}
              className={`w-full flex justify-between items-center border rounded-xl px-4 py-3 text-sm min-h-[48px] transition ${
                fallbackSel === 'plain' ? 'border-primary bg-accent-soft' : 'border-border hover:border-primary/40'
              }`}
            >
              <span className="font-semibold text-muted-foreground">Tanpa variasi (polos)</span>
              <span className="text-xs text-muted-foreground">Harga dasar</span>
            </button>
          </div>
        )}

        <div className="pt-1">
          <label className="block text-sm font-medium mb-1.5" htmlFor="variantNote">Catatan khusus (opsional)</label>
          <input
            id="variantNote"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Contoh: tanpa bawang, extra sambal"
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
      <div className="px-6 pb-5">
        <button
          onClick={add}
          className="w-full bg-primary text-primary-foreground font-extrabold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" aria-hidden /> Tambah · {formatRp(finalPrice)}
        </button>
      </div>
    </Modal>
  );
}
