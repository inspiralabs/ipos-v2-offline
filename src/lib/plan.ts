import type { LicenseState } from './license';

// PRD Frontend v4 §5.3 — matriks Offline Lite vs Pro.
// Trial = sandbox: semua fitur terbuka, volume dibatasi (TRIAL_LIMITS).
export const PRO_ONLY = [
  'void',
  'split_bill',
  'shift',
  'multi_user',
  'customers_debt',
  'expenses',
  'supplier',
] as const;

export type ProFeature = (typeof PRO_ONLY)[number];

export function hasFeature(state: LicenseState, _f: ProFeature): boolean {
  return state.plan !== 'lite'; // trial & pro: semua fitur terbuka
}

export const UPGRADE_PRICE = 'Rp 199.000'; // selisih Lite → Pro (harga serba-9)
