import type { Menu, VariantGroup } from '@/db';

export interface VariantOption { name: string; delta: number }

// "Pedas, Extra Ceker=3000" → [{name:'Pedas',delta:0},{name:'Extra Ceker',delta:3000}]
export function parseVariants(v: string | null): VariantOption[] {
  if (!v?.trim()) return [];
  return v.split(',').map((part) => {
    const [name, delta] = part.split('=');
    return { name: name.trim(), delta: Number(delta) || 0 };
  }).filter((x) => x.name);
}

/** Variasi menu: dari grup tersimpan (dipakai bareng menu lain) kalau terhubung, atau teks ad-hoc milik menu itu sendiri. */
export function resolveVariantString(menu: Menu, groups: VariantGroup[]): string | null {
  if (menu.variant_group_id != null) {
    return groups.find((g) => g.id === menu.variant_group_id)?.options ?? null;
  }
  return menu.variants;
}

export function resolveVariantGroups(menu: Menu, groups: VariantGroup[]): VariantGroup[] {
  const csv = menu.variant_group_ids?.trim();
  if (csv) {
    const ids = csv.split(',').map((x) => Number(x.trim())).filter((n) => Number.isFinite(n));
    return ids.map((id) => groups.find((g) => g.id === id)).filter((g): g is VariantGroup => !!g);
  }
  if (menu.variant_group_id != null) {
    const g = groups.find((x) => x.id === menu.variant_group_id);
    return g ? [g] : [];
  }
  return [];
}
