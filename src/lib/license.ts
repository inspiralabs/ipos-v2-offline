import { getDeviceId } from './device';

export type LicensePlan = 'trial' | 'lite' | 'pro';

export interface LicenseState {
  plan: LicensePlan;
  expiresAt: number | null;
  txCount: number;
  menuCount: number;
}

// Batasan masa coba — sesuai PRD Frontend v4 §3.1 (sandbox trial)
export const TRIAL_LIMITS = {
  days: 14,
  tx: 50,
  menu: 20,
} as const;

async function sha256hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Algoritma HARUS identik dengan ipos-v1-backend/src/lib/license.ts:
// sha256(`${deviceId.toLowerCase()}_${salt}`) → 16 hex pertama uppercase → format 4x4
async function deriveKey(deviceId: string, plan: 'lite' | 'pro'): Promise<string> {
  const salt = plan === 'lite'
    ? import.meta.env.VITE_SECURE_SALT_LITE
    : import.meta.env.VITE_SECURE_SALT_PRO;
  const hex = await sha256hex(`${deviceId.trim().toLowerCase()}_${salt}`);
  const raw = hex.slice(0, 16).toUpperCase();
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}

export async function validateLicense(key: string): Promise<LicensePlan | null> {
  const deviceId = getDeviceId();
  for (const plan of ['lite', 'pro'] as const) {
    if ((await deriveKey(deviceId, plan)) === key.trim().toUpperCase()) return plan;
  }
  return null;
}

export function getLicenseState(): LicenseState {
  const raw = localStorage.getItem('ipos_license');
  if (!raw) {
    // first-run: mulai masa coba
    const state: LicenseState = {
      plan: 'trial',
      expiresAt: Date.now() + TRIAL_LIMITS.days * 86400_000,
      txCount: 0,
      menuCount: 0,
    };
    localStorage.setItem('ipos_license', JSON.stringify(state));
    return state;
  }
  return JSON.parse(raw) as LicenseState;
}

export function saveLicenseState(state: LicenseState) {
  localStorage.setItem('ipos_license', JSON.stringify(state));
}

export function isLicenseValid(state: LicenseState): boolean {
  if (state.plan === 'trial') {
    return !!state.expiresAt && Date.now() < state.expiresAt && state.txCount < TRIAL_LIMITS.tx;
  }
  return true;
}

export function trialDaysLeft(state: LicenseState): number {
  if (state.plan !== 'trial' || !state.expiresAt) return 0;
  return Math.max(0, Math.ceil((state.expiresAt - Date.now()) / 86400_000));
}

export function canAddMenu(state: LicenseState, currentCount: number): boolean {
  if (state.plan === 'trial') return currentCount < TRIAL_LIMITS.menu;
  return true;
}

export async function activateLicense(key: string): Promise<LicensePlan | null> {
  const plan = await validateLicense(key);
  if (!plan) return null;
  const state = getLicenseState();
  const updated: LicenseState = { ...state, plan, expiresAt: null };
  saveLicenseState(updated);
  localStorage.setItem('ipos_license_key', key.toUpperCase());
  return plan;
}

// ===== PIN owner (untuk void, kelola pengguna) =====
export async function hashPin(pin: string): Promise<string> {
  return sha256hex(`ipos-pin:${pin}`);
}

// ===== Kode pemulihan PIN owner — ditampilkan sekali saat PIN pertama dibuat =====
// Tanpa ambigu O/0, I/1 supaya gampang dibaca & diketik ulang dari catatan tulisan tangan.
const RECOVERY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => RECOVERY_CHARS[b % RECOVERY_CHARS.length]).join('');
}

export async function hashRecoveryCode(code: string): Promise<string> {
  return sha256hex(`ipos-recovery:${code.toUpperCase().trim()}`);
}

// Nomor WA admin untuk aktivasi — dari .env, fallback kosong (tombol WA disembunyikan)
export const ADMIN_WA = (import.meta.env.VITE_ADMIN_WA as string | undefined) ?? '';

export function waLink(message: string): string {
  return `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(message)}`;
}
