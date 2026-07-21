import { db } from '@/db';
import { hashPin } from './license';
import { promptDialog } from '@/components/dialogs';

// Key-value helper di atas tabel db.settings
export async function getSetting(key: string): Promise<string | null> {
  return (await db.settings.get(key))?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.settings.put({ key, value });
}

export const KEYS = {
  storeName: 'store_name',
  storeAddress: 'store_address',
  storePhone: 'store_phone',
  businessType: 'business_type',
  onboardingDone: 'onboarding_done',
  ownerPin: 'owner_pin',
  ownerRecoveryCode: 'owner_recovery_code',
  receiptFooter: 'receipt_footer',
  storeLogo: 'store_logo',
  qrisImage: 'qris_image',
  themeColor: 'theme_color',
  lastBackupAt: 'last_backup_at',
} as const;

/** Minta & verifikasi PIN owner (untuk void, kelola pengguna). */
export async function askOwnerPin(): Promise<'ok' | 'wrong' | 'unset'> {
  const stored = await getSetting(KEYS.ownerPin);
  if (!stored) return 'unset';
  const pin = await promptDialog('Masukkan PIN owner', {
    password: true, numeric: true, placeholder: 'PIN 6 angka', okLabel: 'Buka',
  });
  if (!pin) return 'wrong';
  return (await hashPin(pin)) === stored ? 'ok' : 'wrong';
}
