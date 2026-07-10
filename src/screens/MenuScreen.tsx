import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Pencil, Trash2, Lock, PackagePlus, AlertTriangle, Layers } from 'lucide-react';
import { db, type Menu, type VariantGroup } from '@/db';
import { formatRp } from '@/lib/format';
import { Modal } from '@/components/Modal';
import { RupiahInput } from '@/components/RupiahInput';
import { Select } from '@/components/Select';
import { toast } from '@/components/Toast';
import { confirmDialog } from '@/components/dialogs';
import { useLicenseStore } from '@/store/license';
import { canAddMenu, TRIAL_LIMITS } from '@/lib/license';
import { hasFeature } from '@/lib/plan';

type DiscountType = 'none' | 'nominal' | 'percent';
type MenuForm = {
  name: string; sku: string; price: string; category_id: string;
  stock: string; min_stock: string; description: string;
  variantGroupIds: number[];
  variants: string; // fallback ad-hoc untuk data lama
  discountType: DiscountType; discountValue: string;
  emoji: string; image_url: string; is_active: boolean;
};
const EMPTY: MenuForm = {
  name: '', sku: '', price: '', category_id: '',
  stock: '', min_stock: '', description: '', variantGroupIds: [], variants: '',
  discountType: 'none', discountValue: '',
  emoji: '', image_url: '', is_active: true,
};

/** Kecilkan foto ke ≤512px JPEG — dataURL kecil supaya IndexedDB & file backup tetap ramping. */
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 512 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error('bukan gambar')); };
    img.src = URL.createObjectURL(file);
  });
}

export function MenuScreen() {
  const licState = useLicenseStore((s) => s.state);
  const [tab, setTab] = useState<'menu' | 'kategori' | 'variasi'>('menu');
  const [catFilter, setCatFilter] = useState<number | null>(null);
  const [modal, setModal] = useState<{ open: boolean; editing: Menu | null }>({ open: false, editing: null });
  const [form, setForm] = useState<MenuForm>(EMPTY);
  const [newCatName, setNewCatName] = useState('');
  const [saving, setSaving] = useState(false);
  const [stockMenu, setStockMenu] = useState<Menu | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const categories = useLiveQuery(
    async () => (await db.categories.toArray()).sort((a, b) => a.sort_order - b.sort_order),
    []
  ) ?? [];
  const variantGroups = useLiveQuery(() => db.variant_groups.toArray(), []) ?? [];
  const menus = useLiveQuery(
    () => catFilter != null
      ? db.menus.where('category_id').equals(catFilter).toArray()
      : db.menus.toArray(),
    [catFilter]
  ) ?? [];
  const totalMenus = useLiveQuery(() => db.menus.count(), []) ?? 0;

  const menuFull = !canAddMenu(licState, totalMenus);

  function openAdd() {
    setForm(EMPTY);
    setModal({ open: true, editing: null });
  }

  function openEdit(m: Menu) {
    setForm({
      name: m.name,
      sku: m.sku ?? '',
      price: String(m.price),
      category_id: m.category_id != null ? String(m.category_id) : '',
      stock: m.stock != null ? String(m.stock) : '',
      min_stock: m.min_stock != null ? String(m.min_stock) : '',
      description: m.description ?? '',
      variantGroupIds: (m.variant_group_ids?.split(',').map((x) => Number(x.trim())).filter((n) => Number.isFinite(n))
        ?? (m.variant_group_id != null ? [m.variant_group_id] : [])),
      variants: m.variants ?? '',
      discountType: m.discount_type ?? 'none',
      discountValue: m.discount_value ? String(m.discount_value) : '',
      emoji: m.emoji ?? '',
      image_url: m.image_url ?? '',
      is_active: m.is_active,
    });
    setModal({ open: true, editing: m });
  }

  async function saveMenu() {
    if (!form.name.trim() || !form.price) return;
    setSaving(true);
    const now = Date.now();
    const groupIds = form.variantGroupIds.filter((id) => Number.isFinite(id));
    const data = {
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      price: Number(form.price),
      category_id: form.category_id ? Number(form.category_id) : null,
      stock: form.stock !== '' ? Number(form.stock) : null,
      min_stock: form.min_stock !== '' ? Number(form.min_stock) : null,
      description: form.description.trim() || null,
      variant_group_id: groupIds[0] ?? null, // kompatibilitas data lama
      variant_group_ids: groupIds.length ? groupIds.join(',') : null,
      variants: groupIds.length ? null : (form.variants.trim() || null),
      discount_type: form.discountType,
      discount_value: form.discountType === 'none' ? 0 : Number(form.discountValue) || 0,
      image_url: form.image_url || null,
      emoji: form.emoji.trim() || null,
      hpp: modal.editing?.hpp ?? 0,
      is_active: form.is_active,
      created_at: modal.editing?.created_at ?? now,
      updated_at: now,
    };
    if (modal.editing) {
      await db.menus.update(modal.editing.id, data);
    } else {
      await db.menus.add({ ...data, id: crypto.randomUUID() });
    }
    setSaving(false);
    setModal({ open: false, editing: null });
  }

  async function deleteMenu(m: Menu) {
    if (!(await confirmDialog(`Hapus "${m.name}" dari daftar menu?`, { danger: true, okLabel: 'Hapus' }))) return;
    await db.menus.delete(m.id);
  }

  async function toggleActive(m: Menu) {
    await db.menus.update(m.id, { is_active: !m.is_active, updated_at: Date.now() });
  }

  async function addCategory() {
    const name = newCatName.trim();
    if (!name) return;
    await db.categories.add({ name, sort_order: categories.length });
    setNewCatName('');
  }

  async function deleteCategory(id: number) {
    if (!(await confirmDialog('Hapus kategori ini? Menunya tetap ada, cuma jadi tanpa kategori.', { danger: true, okLabel: 'Hapus' }))) return;
    await db.categories.delete(id);
  }

  const catName = (id: number | null) => categories.find((c) => c.id === id)?.name ?? 'Tanpa kategori';

  const [groupModal, setGroupModal] = useState<{ open: boolean; editing: VariantGroup | null }>({ open: false, editing: null });

  async function deleteVariantGroup(g: VariantGroup) {
    const id = g.id!;
    const allMenus = await db.menus.toArray();
    const usedBy = allMenus.filter((m) => {
      if (m.variant_group_id === id) return true;
      const ids = m.variant_group_ids?.split(',').map((x) => Number(x.trim())).filter((n) => Number.isFinite(n)) ?? [];
      return ids.includes(id);
    }).length;
    const msg = usedBy > 0
      ? `Grup "${g.name}" dipakai ${usedBy} menu. Menu itu akan jadi tanpa variasi. Lanjutkan hapus?`
      : `Hapus grup variasi "${g.name}"?`;
    if (!(await confirmDialog(msg, { danger: true, okLabel: 'Hapus' }))) return;
    await db.transaction('rw', db.variant_groups, db.menus, async () => {
      await db.variant_groups.delete(id);
      await db.menus.toCollection().modify((m) => {
        if (m.variant_group_id === id) m.variant_group_id = null;
        const ids = m.variant_group_ids?.split(',').map((x) => Number(x.trim())).filter((n) => Number.isFinite(n)) ?? [];
        const next = ids.filter((x) => x !== id);
        m.variant_group_ids = next.length ? next.join(',') : null;
      });
    });
  }

  const TAB_LABEL = { menu: 'Menu', kategori: 'Kategori', variasi: 'Variasi' } as const;

  return (
    <div className="flex flex-col h-full">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex gap-1 overflow-x-auto" role="tablist">
          {(['menu', 'kategori', 'variasi'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition min-h-[40px] ${
                tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
        {tab === 'menu' && !menuFull && (
          <button
            onClick={openAdd}
            className="shrink-0 bg-primary text-primary-foreground text-sm font-bold px-4 py-2 rounded-xl flex items-center gap-1 min-h-[40px]"
          >
            <Plus className="w-4 h-4" aria-hidden /> Tambah
          </button>
        )}
        {tab === 'variasi' && (
          <button
            onClick={() => setGroupModal({ open: true, editing: null })}
            className="shrink-0 bg-primary text-primary-foreground text-sm font-bold px-4 py-2 rounded-xl flex items-center gap-1 min-h-[40px]"
          >
            <Plus className="w-4 h-4" aria-hidden /> Tambah
          </button>
        )}
      </header>

      {tab === 'menu' && (
        <>
          {licState.plan === 'trial' && (
            <div className={`px-4 py-2 text-sm shrink-0 flex items-center gap-2 ${menuFull ? 'bg-warning/10 text-warning' : 'bg-accent-soft text-muted-foreground'}`}>
              {menuFull && <Lock className="w-4 h-4 shrink-0" aria-hidden />}
              {menuFull
                ? `Jatah ${TRIAL_LIMITS.menu} menu masa coba sudah terpakai. Aktifkan aplikasi untuk menu tanpa batas.`
                : `Masa coba: ${totalMenus} dari ${TRIAL_LIMITS.menu} menu terpakai.`}
            </div>
          )}

          {categories.length > 0 && (
            <div className="flex gap-2 px-4 py-2 overflow-x-auto bg-card border-b border-border shrink-0">
              <button
                onClick={() => setCatFilter(null)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold min-h-[32px] ${catFilter === null ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                Semua
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCatFilter(c.id === catFilter ? null : c.id!)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold min-h-[32px] ${catFilter === c.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {menus.length === 0 && (
              <div className="text-center py-16 px-6">
                <span className="text-4xl block mb-3" aria-hidden>📝</span>
                <p className="text-sm text-muted-foreground mb-4">
                  Menu kamu masih kosong. Tambahkan menu pertamamu, yuk!
                </p>
                {!menuFull && (
                  <button
                    onClick={openAdd}
                    className="bg-primary text-primary-foreground text-sm font-bold px-5 py-2.5 rounded-xl"
                  >
                    Tambah Menu
                  </button>
                )}
              </div>
            )}
            {menus.map((m) => {
              const lowStock = m.stock != null && m.stock <= (m.min_stock ?? 5);
              return (
                <div key={m.id} className="bg-card rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm border border-border">
                  {m.image_url
                    ? <img src={m.image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    : <span className="text-2xl w-10 text-center shrink-0" aria-hidden>{m.emoji ?? '🍽️'}</span>}
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm truncate ${!m.is_active ? 'text-muted-foreground line-through' : ''}`}>
                      {m.name}{m.sku ? <span className="text-muted-foreground font-normal"> · {m.sku}</span> : ''}
                    </p>
                    <p className="text-sm text-primary font-bold tabular-nums">
                      {formatRp(m.price)}
                      {m.hpp > 0 && <span className="text-muted-foreground font-normal text-xs"> · modal {formatRp(m.hpp)}</span>}
                      {m.discount_type && m.discount_type !== 'none' && m.discount_value > 0 && (
                        <span className="text-success font-normal text-xs">
                          {' '}· diskon {m.discount_type === 'percent' ? `${m.discount_value}%` : formatRp(m.discount_value)}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      {catName(m.category_id)}
                      {m.stock != null && (
                        <span className={lowStock ? 'text-warning font-bold flex items-center gap-0.5' : ''}>
                          {lowStock && <AlertTriangle className="w-3 h-3" aria-hidden />} · Stok: {m.stock}
                        </span>
                      )}
                    </p>
                  </div>
                  {m.stock != null && (
                    <button onClick={() => setStockMenu(m)} aria-label={`Atur stok ${m.name}`}
                      className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted">
                      <PackagePlus className="w-4 h-4" aria-hidden />
                    </button>
                  )}
                  <button
                    onClick={() => toggleActive(m)}
                    className={`shrink-0 text-xs px-2.5 py-1.5 rounded-full font-semibold min-h-[32px] ${
                      m.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {m.is_active ? 'Dijual' : 'Disembunyikan'}
                  </button>
                  <button onClick={() => openEdit(m)} aria-label={`Ubah ${m.name}`}
                    className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted">
                    <Pencil className="w-4 h-4" aria-hidden />
                  </button>
                  <button onClick={() => deleteMenu(m)} aria-label={`Hapus ${m.name}`}
                    className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-muted">
                    <Trash2 className="w-4 h-4" aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === 'kategori' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex gap-2">
            <input
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Contoh: Minuman"
              aria-label="Nama kategori baru"
              onKeyDown={(e) => e.key === 'Enter' && addCategory()}
              className="flex-1 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={addCategory}
              className="bg-primary text-primary-foreground text-sm font-bold px-4 py-2.5 rounded-xl"
            >
              Tambah
            </button>
          </div>
          {categories.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              Kategori bikin menu gampang dicari — misalnya "Makanan" dan "Minuman".
            </p>
          )}
          {categories.map((c) => (
            <div key={c.id} className="bg-card rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm border border-border">
              <span className="flex-1 text-sm font-semibold">{c.name}</span>
              <button onClick={() => deleteCategory(c.id!)} aria-label={`Hapus kategori ${c.name}`}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-muted">
                <Trash2 className="w-4 h-4" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'variasi' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {variantGroups.length === 0 && (
            <div className="text-center py-16 px-6">
              <Layers className="w-10 h-10 text-muted-foreground mx-auto mb-3" aria-hidden />
              <p className="text-sm text-muted-foreground">
                Grup variasi bisa dipakai di banyak menu sekaligus — misalnya "Level Pedas" untuk semua menu pedas.
                Ubah sekali, semua menu yang pakai ikut berubah.
              </p>
            </div>
          )}
          {variantGroups.map((g) => (
            <div key={g.id} className="bg-card rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm border border-border">
              <span className="w-9 h-9 rounded-lg bg-accent-soft text-primary flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4" aria-hidden />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{g.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {g.selection === 'multi' ? 'Bisa pilih banyak' : 'Pilih satu'}{g.required ? ' · wajib' : ''} · {g.options || 'Belum ada pilihan'}
                </p>
              </div>
              <button onClick={() => setGroupModal({ open: true, editing: g })} aria-label={`Ubah ${g.name}`}
                className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted">
                <Pencil className="w-4 h-4" aria-hidden />
              </button>
              <button onClick={() => deleteVariantGroup(g)} aria-label={`Hapus ${g.name}`}
                className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-muted">
                <Trash2 className="w-4 h-4" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}

      {groupModal.open && (
        <VariantGroupModal editing={groupModal.editing} onClose={() => setGroupModal({ open: false, editing: null })} />
      )}

      {modal.open && (
        <Modal onClose={() => setModal({ open: false, editing: null })}>
          <div className="px-6 pt-5 pb-4 border-b border-border">
            <h2 className="font-bold text-lg">{modal.editing ? 'Ubah Menu' : 'Menu Baru'}</h2>
          </div>
          <div className="px-6 py-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0">
                {form.image_url
                  ? <img src={form.image_url} alt="Foto menu" className="w-full h-full object-cover" />
                  : <span className="text-2xl" aria-hidden>{form.emoji || '🍽️'}</span>}
              </div>
              <div className="flex-1">
                <button type="button" onClick={() => photoRef.current?.click()} className="text-sm text-primary font-semibold">
                  {form.image_url ? 'Ganti foto menu' : 'Pasang foto menu'}
                </button>
                {form.image_url && (
                  <button
                    type="button"
                    onClick={() => setForm((s) => ({ ...s, image_url: '' }))}
                    className="block text-sm text-muted-foreground"
                  >
                    Hapus foto
                  </button>
                )}
                <input
                  ref={photoRef} type="file" accept="image/*" className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      try {
                        const url = await resizeImage(f);
                        setForm((s) => ({ ...s, image_url: url }));
                      } catch { toast('File ini bukan gambar. Pilih foto ya.', 'error'); }
                    }
                    e.target.value = '';
                  }}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="menuName">
                Nama menu <span className="text-destructive">*</span>
              </label>
              <input
                id="menuName"
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                placeholder="Contoh: Seblak Komplit"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1.5" htmlFor="menuPrice">
                  Harga <span className="text-destructive">*</span>
                </label>
                <RupiahInput
                  id="menuPrice"
                  value={form.price}
                  onChange={(price) => setForm((s) => ({ ...s, price }))}
                  placeholder="15000"
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="w-24">
                <label className="block text-sm font-medium mb-1.5" htmlFor="menuEmoji">Ikon</label>
                <input
                  id="menuEmoji"
                  value={form.emoji}
                  onChange={(e) => setForm((s) => ({ ...s, emoji: e.target.value }))}
                  placeholder="🍜"
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1.5" htmlFor="menuSku">SKU / kode (opsional)</label>
                <input
                  id="menuSku"
                  value={form.sku}
                  onChange={(e) => setForm((s) => ({ ...s, sku: e.target.value }))}
                  placeholder="SBL-01"
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1.5" htmlFor="menuCat">Kategori</label>
                <Select
                  id="menuCat"
                  value={form.category_id || '0'}
                  onChange={(v) => setForm((s) => ({ ...s, category_id: v === '0' ? '' : v }))}
                  items={[
                    { value: '0', label: 'Tanpa kategori' },
                    ...categories.map((c) => ({ value: String(c.id), label: c.name })),
                  ]}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="menuDesc">Deskripsi (opsional)</label>
              <textarea
                id="menuDesc"
                value={form.description}
                onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                placeholder="Catatan tentang menu ini, misalnya bahan atau ciri khasnya"
                rows={2}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Variasi (opsional){form.variantGroupIds.length > 0 && (
                  <span className="text-primary font-normal"> — {form.variantGroupIds.length} dipilih</span>
                )}
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Pilih grup variasi yang mau dipakai di menu ini — nanti muncul per grup saat kasir jualan.
              </p>
              {variantGroups.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Belum ada grup variasi. Bikin dulu di tab Variasi (misalnya Level Pedas, Topping, atau Ukuran).
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1 -mr-1">
                  {variantGroups.map((g) => {
                    const checked = form.variantGroupIds.includes(g.id!);
                    return (
                      <label key={g.id} className="flex items-start gap-2 border border-border rounded-xl px-3 py-2.5 cursor-pointer min-h-[44px]">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => setForm((s) => ({
                            ...s,
                            variantGroupIds: e.target.checked
                              ? [...s.variantGroupIds, g.id!]
                              : s.variantGroupIds.filter((id) => id !== g.id),
                          }))}
                          className="mt-1 w-4 h-4 accent-[var(--color-primary)]"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{g.name}</span>
                          <span className="block text-xs text-muted-foreground truncate">
                            {g.selection === 'multi' ? 'Bisa pilih banyak' : 'Pilih satu'}{g.required ? ' · wajib pilih' : ' · boleh kosong'} · {g.options || 'Belum ada pilihan'}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              {form.variantGroupIds.length === 0 && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-2">
                    Atau pakai variasi cepat khusus menu ini.
                  </p>
                  <VariantEditor value={form.variants} onChange={(variants) => setForm((s) => ({ ...s, variants }))} />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="menuDiscType">Diskon otomatis (opsional)</label>
              <p className="text-xs text-muted-foreground mb-2">
                Diskon ini otomatis kepakai tiap kasir menjual menu ini — tanpa perlu diisi manual di keranjang.
              </p>
              <div className="flex gap-2 mb-2" role="radiogroup" aria-label="Jenis diskon otomatis">
                {([['none', 'Tanpa'], ['nominal', 'Rp'], ['percent', '%']] as const).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={form.discountType === v}
                    onClick={() => setForm((s) => ({ ...s, discountType: v, discountValue: v === 'none' ? '' : s.discountValue }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border min-h-[40px] ${
                      form.discountType === v ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {form.discountType === 'nominal' && (
                <RupiahInput
                  id="menuDiscValue"
                  value={form.discountValue}
                  onChange={(v) => setForm((s) => ({ ...s, discountValue: v }))}
                  placeholder="2000"
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
                />
              )}
              {form.discountType === 'percent' && (
                <input
                  id="menuDiscValue"
                  type="number" inputMode="numeric" min={0} max={100}
                  value={form.discountValue}
                  onChange={(e) => setForm((s) => ({ ...s, discountValue: e.target.value }))}
                  placeholder="10"
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
                />
              )}
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1.5" htmlFor="menuStock">Stok</label>
                <input
                  id="menuStock"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={form.stock}
                  onChange={(e) => setForm((s) => ({ ...s, stock: e.target.value }))}
                  placeholder="Kosongkan jika dadakan"
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1.5" htmlFor="menuMinStock">Ingatkan kalau sisa</label>
                <input
                  id="menuMinStock"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={form.min_stock}
                  onChange={(e) => setForm((s) => ({ ...s, min_stock: e.target.value }))}
                  placeholder="5"
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Stok kosong = masakan dibuat terus, nggak perlu dihitung. Stok berkurang otomatis tiap penjualan.
            </p>
            <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((s) => ({ ...s, is_active: e.target.checked }))}
                className="w-4 h-4 accent-[var(--color-primary)]"
              />
              <span className="text-sm">Tampilkan di kasir</span>
            </label>
          </div>
          <div className="px-6 pb-5 flex gap-3">
            <button
              onClick={() => setModal({ open: false, editing: null })}
              className="flex-1 border border-border rounded-xl py-3 text-sm text-muted-foreground hover:bg-muted"
            >
              Batal
            </button>
            <button
              onClick={saveMenu}
              disabled={saving || !form.name.trim() || !form.price}
              className="flex-1 bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm disabled:opacity-40"
            >
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </Modal>
      )}

      {stockMenu && <StockModal menu={stockMenu} onClose={() => setStockMenu(null)} />}
    </div>
  );
}

/**
 * Editor pilihan/variasi menu — baris nama + tambahan harga.
 * Tetap tersimpan sebagai string "Nama=3000, Nama2" di kolom variants (skema tidak berubah).
 */
function VariantEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [rows, setRows] = useState<{ name: string; delta: string }[]>(() =>
    value
      ? value.split(',').map((p) => {
          const [n, d] = p.split('=');
          return { name: n.trim(), delta: d?.trim() ?? '' };
        }).filter((r) => r.name)
      : []
  );

  function commit(next: { name: string; delta: string }[]) {
    setRows(next);
    onChange(
      next
        .filter((r) => r.name.trim())
        .map((r) => (Number(r.delta) ? `${r.name.trim()}=${Number(r.delta)}` : r.name.trim()))
        .join(', ')
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            value={r.name}
            onChange={(e) => commit(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
            placeholder={`Contoh: Level ${i + 1}`}
            aria-label={`Nama pilihan ${i + 1}`}
            className="flex-1 min-w-0 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <RupiahInput
            value={r.delta}
            onChange={(delta) => commit(rows.map((x, j) => (j === i ? { ...x, delta } : x)))}
            placeholder="+harga"
            aria-label={`Tambahan harga pilihan ${i + 1}`}
            className="w-24 border border-border rounded-xl px-3 py-2.5 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="button"
            onClick={() => commit(rows.filter((_, j) => j !== i))}
            aria-label={`Hapus pilihan ${r.name || i + 1}`}
            className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-muted"
          >
            <Trash2 className="w-4 h-4" aria-hidden />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => commit([...rows, { name: '', delta: '' }])}
        className="text-sm text-primary font-semibold flex items-center gap-1 min-h-[36px]"
      >
        <Plus className="w-4 h-4" aria-hidden /> Tambah pilihan
      </button>
    </div>
  );
}

/** Tambah/ubah grup variasi tersimpan — bisa dipakai bareng banyak menu (tab Variasi). */
function VariantGroupModal({ editing, onClose }: { editing: VariantGroup | null; onClose: () => void }) {
  const [name, setName] = useState(editing?.name ?? '');
  const [options, setOptions] = useState(editing?.options ?? '');
  const [selection, setSelection] = useState<'single' | 'multi'>(editing?.selection ?? 'single');
  const [required, setRequired] = useState(editing?.required ?? false);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    if (editing?.id != null) {
      await db.variant_groups.update(editing.id, { name: name.trim(), options, selection, required });
    } else {
      await db.variant_groups.add({ name: name.trim(), options, selection, required });
    }
    setSaving(false);
    onClose();
  }

  return (
    <Modal onClose={onClose}>
      <div className="px-6 pt-5 pb-4 border-b border-border">
        <h2 className="font-bold text-lg">{editing ? 'Ubah Grup Variasi' : 'Grup Variasi Baru'}</h2>
      </div>
      <div className="px-6 py-4 space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="groupName">
            Nama grup <span className="text-destructive">*</span>
          </label>
          <input
            id="groupName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Level Pedas, Ukuran, Topping"
            autoFocus
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <p className="text-sm font-medium mb-1.5">Aturan pilih</p>
          <div className="flex gap-2 mb-2" role="radiogroup" aria-label="Aturan pilih variasi">
            <button
              type="button"
              role="radio"
              aria-checked={selection === 'single'}
              onClick={() => setSelection('single')}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold border min-h-[40px] ${
                selection === 'single' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'
              }`}
            >
              Pilih satu
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={selection === 'multi'}
              onClick={() => setSelection('multi')}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold border min-h-[40px] ${
                selection === 'multi' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'
              }`}
            >
              Bisa banyak
            </button>
          </div>
          <label className="flex items-center gap-2 cursor-pointer min-h-[40px]">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="w-4 h-4 accent-[var(--color-primary)]"
            />
            <span className="text-sm">Wajib dipilih saat kasir</span>
          </label>
        </div>
        <div>
          <p className="text-sm font-medium mb-1.5">Pilihan</p>
          <VariantEditor value={options} onChange={setOptions} />
        </div>
      </div>
      <div className="px-6 pb-5 flex gap-3">
        <button onClick={onClose} className="flex-1 border border-border rounded-xl py-3 text-sm text-muted-foreground hover:bg-muted">
          Batal
        </button>
        <button
          onClick={save}
          disabled={saving || !name.trim()}
          className="flex-1 bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm disabled:opacity-40"
        >
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </Modal>
  );
}

/** Stok masuk (dengan HPP rata-rata tertimbang) & stok keluar (dengan alasan). */
function StockModal({ menu, onClose }: { menu: Menu; onClose: () => void }) {
  const licState = useLicenseStore((s) => s.state);
  const [type, setType] = useState<'in' | 'out'>('in');
  const [qty, setQty] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [supplier, setSupplier] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const suppliers = useLiveQuery(() => db.suppliers.toArray(), []) ?? [];
  const canSupplier = hasFeature(licState, 'supplier');

  async function save() {
    const n = Number(qty);
    if (!n || n <= 0) return;
    setSaving(true);
    const current = (await db.menus.get(menu.id))!;
    const curStock = current.stock ?? 0;

    if (type === 'in') {
      const price = Number(buyPrice) || 0;
      // HPP rata-rata tertimbang (PRD Lite)
      const newHpp = price > 0
        ? Math.round((current.hpp * curStock + price * n) / (curStock + n))
        : current.hpp;
      await db.menus.update(menu.id, { stock: curStock + n, hpp: newHpp, updated_at: Date.now() });
    } else {
      await db.menus.update(menu.id, { stock: Math.max(0, curStock - n), updated_at: Date.now() });
    }

    await db.stock_moves.add({
      menu_id: menu.id,
      menu_name: menu.name,
      type,
      qty: n,
      buy_price: type === 'in' ? Number(buyPrice) || null : null,
      supplier: type === 'in' ? supplier.trim() || null : null,
      reason: type === 'out' ? reason.trim() || null : null,
      created_at: Date.now(),
    });
    setSaving(false);
    onClose();
  }

  return (
    <Modal onClose={onClose}>
      <div className="px-6 pt-5 pb-4 border-b border-border">
        <h2 className="font-bold text-lg">Stok: {menu.name}</h2>
        <p className="text-sm text-muted-foreground">
          Sekarang: {menu.stock ?? 0}{menu.hpp > 0 ? ` · modal rata-rata ${formatRp(menu.hpp)}` : ''}
        </p>
      </div>
      <div className="px-6 py-4 space-y-3">
        <div className="flex gap-2" role="radiogroup" aria-label="Jenis pergerakan stok">
          <button
            role="radio" aria-checked={type === 'in'}
            onClick={() => setType('in')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border min-h-[44px] ${type === 'in' ? 'bg-success text-white border-success' : 'border-border text-muted-foreground'}`}
          >
            Barang Masuk
          </button>
          <button
            role="radio" aria-checked={type === 'out'}
            onClick={() => setType('out')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border min-h-[44px] ${type === 'out' ? 'bg-destructive text-white border-destructive' : 'border-border text-muted-foreground'}`}
          >
            Barang Keluar
          </button>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="stockQty">
            Jumlah <span className="text-destructive">*</span>
          </label>
          <input
            id="stockQty" type="number" inputMode="numeric" min={1}
            value={qty} onChange={(e) => setQty(e.target.value)} placeholder="10" autoFocus
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        {type === 'in' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="buyPrice">Harga beli per pcs</label>
              <RupiahInput
                id="buyPrice"
                value={buyPrice} onChange={setBuyPrice} placeholder="8000"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">Dipakai menghitung modal rata-rata & laba rugi.</p>
            </div>
            {canSupplier && (
              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="supplierIn">Supplier (opsional)</label>
                <input
                  id="supplierIn" value={supplier} onChange={(e) => setSupplier(e.target.value)}
                  placeholder="Nama supplier" list="supplierList"
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <datalist id="supplierList">
                  {suppliers.map((s) => <option key={s.id} value={s.name} />)}
                </datalist>
              </div>
            )}
          </>
        )}
        {type === 'out' && (
          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="outReason">Alasan</label>
            <Select
              id="outReason" value={reason} onChange={setReason}
              items={[
                { value: 'rusak', label: 'Rusak / basi' },
                { value: 'hilang', label: 'Hilang' },
                { value: 'dipakai sendiri', label: 'Dipakai sendiri' },
                { value: 'koreksi', label: 'Koreksi hitung' },
              ]}
            />
          </div>
        )}
      </div>
      <div className="px-6 pb-5 flex gap-3">
        <button onClick={onClose} className="flex-1 border border-border rounded-xl py-3 text-sm text-muted-foreground hover:bg-muted">
          Batal
        </button>
        <button
          onClick={save}
          disabled={saving || !qty || Number(qty) <= 0}
          className="flex-1 bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm disabled:opacity-40"
        >
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </Modal>
  );
}
