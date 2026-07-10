import { db } from '@/db';
import { setSetting, KEYS } from './store-settings';

// Backup & pulihkan seluruh data ke/dari file JSON — PRD Offline §5.3 (Lite & Pro)
const TABLES = [
  'menus', 'categories', 'orders', 'settings', 'shifts',
  'customers', 'debts', 'debt_payments', 'expenses', 'suppliers', 'users', 'stock_moves',
  'variant_groups',
] as const;

export async function exportBackup(): Promise<void> {
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) data[t] = await db.table(t).toArray();
  const blob = new Blob(
    [JSON.stringify({ app: 'ipos-offline', version: 2, exported_at: Date.now(), data })],
    { type: 'application/json' }
  );
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `inspira-pos-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  await setSetting(KEYS.lastBackupAt, String(Date.now()));
}

/** Ganti seluruh data dengan isi file backup. Return pesan error, atau null jika sukses. */
export async function importBackup(file: File): Promise<string | null> {
  let parsed: any;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return 'File ini bukan file backup Inspira POS.';
  }
  if (parsed?.app !== 'ipos-offline' || !parsed?.data) {
    return 'File ini bukan file backup Inspira POS.';
  }
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear();
      const rows = parsed.data[t];
      if (Array.isArray(rows) && rows.length) await db.table(t).bulkAdd(rows);
    }
  });
  return null;
}
