# PWA Install CTA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users discover and trigger PWA installation from the end of the onboarding tutorial and from a new Settings section, on top of a now-installable app (icons fixed separately, see Task 0 note below).

**Architecture:** A tiny zustand store (`useInstallPromptStore`, mirroring the existing `usePwaUpdateStore` pattern) captures the browser's `beforeinstallprompt` event globally at module-import time. A single reusable `InstallCard` component reads that store and renders one of: a native-install button, iOS manual instructions, generic manual instructions, or nothing (already installed). It's mounted in two places: the final step of `Onboarding.tsx`, and a new Settings section following the exact pattern of the existing `guide` section.

**Tech Stack:** React 18 + Vite 6 + zustand 5 + lucide-react, no test runner configured in this repo (verification is `tsc -b`, `vite build`, and manual browser checks — do not introduce a test framework for this).

**Spec:** `docs/superpowers/specs/2026-09-15-pwa-install-cta-spec.md`

## Global Constraints

- No new runtime dependencies — everything is buildable with what's already installed (zustand, lucide-react).
- No test framework exists in this repo (confirmed: `package.json` has no vitest/jest). Do not add one. Verification per task is `tsc -b` (type check) + `vite build` + a manual check described in the step.
- Match `DESIGN.md`: cards are `bg-card rounded-2xl border border-border p-5`, primary buttons `bg-primary text-primary-foreground font-bold rounded-xl`, min-height ≥44px on tappable buttons, voice uses "kamu".
- Out of scope: the `Tema Warna`/`profile` focus scope bug, `manifest.lang`, and the standalone shareable guide document (handled separately). Do not touch those files.
- Icon files (`public/icon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`) and the `index.html` apple meta tags are handled outside this plan (asset generation, not logic) — confirm they exist before starting Task 1; if missing, generate them from `ipos-v2/ipos-v2-landing-page/public/inspirapos-icon.svg` first.

---

### Task 1: `useInstallPromptStore` — capture `beforeinstallprompt` globally

**Files:**
- Create: `src/lib/install-prompt.ts`
- Modify: `src/main.tsx` (import for the side-effect, so the listener attaches before first paint)

**Interfaces:**
- Produces: `useInstallPromptStore` (zustand store) with state `{ deferredEvent: BeforeInstallPromptEvent | null; installed: boolean }`; `promptInstall(): Promise<boolean>`; `isIOS(): boolean`. Later tasks (`InstallCard`) consume all three.

- [ ] **Step 1: Write `src/lib/install-prompt.ts`**

```ts
import { create } from 'zustand';

// Tipe resmi belum ada di lib.dom.d.ts — deklarasikan minimal sesuai spec.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallPromptState {
  deferredEvent: BeforeInstallPromptEvent | null;
  installed: boolean;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export const useInstallPromptStore = create<InstallPromptState>(() => ({
  deferredEvent: null,
  installed: isStandalone(),
}));

// Modul ini harus diimpor sekali sedini mungkin (lihat main.tsx) — event
// beforeinstallprompt bisa muncul sebelum komponen React mana pun mount,
// dan kalau tidak ditangkap saat itu juga, browser tidak mengulanginya.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  useInstallPromptStore.setState({ deferredEvent: e as BeforeInstallPromptEvent });
});
window.addEventListener('appinstalled', () => {
  useInstallPromptStore.setState({ deferredEvent: null, installed: true });
});

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Tampilkan native install prompt. Return true kalau user menerima. */
export async function promptInstall(): Promise<boolean> {
  const { deferredEvent } = useInstallPromptStore.getState();
  if (!deferredEvent) return false;
  await deferredEvent.prompt();
  const { outcome } = await deferredEvent.userChoice;
  useInstallPromptStore.setState({ deferredEvent: null });
  return outcome === 'accepted';
}
```

- [ ] **Step 2: Import it for its side effect in `main.tsx`**

In `src/main.tsx`, add near the top (alongside the existing `applyCachedTheme()` call at line 9):

```ts
import './lib/install-prompt';
```

Full relevant section becomes:

```ts
import { applyCachedTheme } from './lib/theme';
import './lib/install-prompt';
import './index.css';

applyCachedTheme();
```

- [ ] **Step 3: Type-check**

Run: `pnpm exec tsc -b`
Expected: no errors.

- [ ] **Step 4: Manual smoke check**

Run: `pnpm dev`, open the app in Chrome, open DevTools console, and run:
```js
window.dispatchEvent(new Event('beforeinstallprompt'))
```
This won't have `.prompt()`/`.userChoice` (it's a plain Event), so just confirm no console error is thrown by the listener itself (the real browser-fired event always has those methods; this only checks the listener doesn't crash on attach). A full end-to-end check happens in Task 3.

- [ ] **Step 5: Commit**

```bash
git add src/lib/install-prompt.ts src/main.tsx
git commit -m "feat: capture beforeinstallprompt event globally"
```

---

### Task 2: `InstallCard` component

**Files:**
- Create: `src/components/InstallCard.tsx`

**Interfaces:**
- Consumes: `useInstallPromptStore`, `promptInstall`, `isIOS` from `@/lib/install-prompt` (Task 1).
- Produces: `InstallCard` — a zero-prop component, `<section id="install">`, renders nothing when already installed. Consumed by Task 3 (Onboarding) and Task 4 (Settings).

- [ ] **Step 1: Write `src/components/InstallCard.tsx`**

```tsx
import { Download, Share, MoreVertical } from 'lucide-react';
import { useInstallPromptStore, promptInstall, isIOS } from '@/lib/install-prompt';
import { toast } from '@/components/Toast';

export function InstallCard() {
  const deferredEvent = useInstallPromptStore((s) => s.deferredEvent);
  const installed = useInstallPromptStore((s) => s.installed);

  if (installed) return null;

  async function handleInstall() {
    const accepted = await promptInstall();
    if (!accepted) toast('Instalasi dibatalkan.', 'info');
  }

  return (
    <section id="install" className="bg-card rounded-2xl border border-border p-5">
      <h2 className="font-bold text-sm mb-1 flex items-center gap-2">
        <Download className="w-4 h-4 text-primary" aria-hidden /> Install ke HP
      </h2>
      <p className="text-sm text-muted-foreground mb-3">
        Biar Inspira POS bisa dibuka langsung dari layar utama, secepat aplikasi biasa — nggak perlu buka browser dulu.
      </p>
      {deferredEvent ? (
        <button
          onClick={handleInstall}
          className="w-full bg-primary text-primary-foreground font-bold py-2.5 rounded-xl text-sm min-h-[44px]"
        >
          Install Sekarang
        </button>
      ) : isIOS() ? (
        <p className="text-sm text-muted-foreground leading-relaxed">
          Tap ikon <Share className="w-3.5 h-3.5 inline" aria-hidden /> <b className="text-foreground">Bagikan</b> di Safari,
          lalu pilih <b className="text-foreground">Tambah ke Layar Utama</b>.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground leading-relaxed">
          Tap ikon <MoreVertical className="w-3.5 h-3.5 inline" aria-hidden /> menu di browser kamu,
          lalu pilih <b className="text-foreground">Tambahkan ke Layar Utama</b> atau <b className="text-foreground">Install aplikasi</b>.
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc -b`
Expected: no errors (confirms `toast` signature from `@/components/Toast` matches `toast(message, 'info')` usage — check that file if this fails).

- [ ] **Step 3: Commit**

```bash
git add src/components/InstallCard.tsx
git commit -m "feat: add InstallCard component for PWA install CTA"
```

---

### Task 3: Wire `InstallCard` into the end of onboarding

**Files:**
- Modify: `src/screens/Onboarding.tsx:1-13` (imports), `:283-289` (end of the `isSetup` block)

**Interfaces:**
- Consumes: `InstallCard` from `@/components/InstallCard` (Task 2).

- [ ] **Step 1: Import `InstallCard`**

In `src/screens/Onboarding.tsx`, add to the import block (after the `toast` import at line 13):

```ts
import { InstallCard } from '@/components/InstallCard';
```

- [ ] **Step 2: Render it at the end of the setup step**

The `isSetup` block currently ends like this (lines 283-289):

```tsx
              {!bizType && (
                <p className="text-sm text-muted-foreground">
                  Belum yakin? Lewati saja — menu bisa diisi sendiri kapan pun di tab Menu.
                </p>
              )}
            </div>
          )}
```

Change it to add the card right after that closing `{!bizType && (...)}` block, still inside the `isSetup` wrapper `<div>`:

```tsx
              {!bizType && (
                <p className="text-sm text-muted-foreground">
                  Belum yakin? Lewati saja — menu bisa diisi sendiri kapan pun di tab Menu.
                </p>
              )}

              <div className="mt-5">
                <InstallCard />
              </div>
            </div>
          )}
```

This only renders for real onboarding (`isSetup` is `step === setupStep && !tourOnly` per line 112) — tour replay from Settings does not show it again, which is correct: an existing user replaying the tour has already seen (or dismissed) the install pitch once.

- [ ] **Step 3: Type-check**

Run: `pnpm exec tsc -b`
Expected: no errors.

- [ ] **Step 4: Manual check**

Run: `pnpm dev`, clear the site's IndexedDB (DevTools → Application → Storage → Clear site data) to simulate a new user, reload, click through the onboarding slides to the "Kenalan dulu, yuk" (setup) step, and confirm the "Install ke HP" card renders below the business-type picker, above the bottom nav bar with the "Mulai Jualan 🚀" button.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Onboarding.tsx
git commit -m "feat: show install CTA at the end of onboarding"
```

---

### Task 4: Add "Install ke HP" section to Settings

**Files:**
- Modify: `src/screens/SettingsScreen.tsx:26-30` (`FOCUS_TITLE`), `:1-24` (imports), `:357-373` (add section after `guide`)
- Modify: `src/screens/MoreScreen.tsx:1-18` (imports), `:42-50` ("Aplikasi & Keamanan" group)

**Interfaces:**
- Consumes: `InstallCard` from `@/components/InstallCard` (Task 2).

- [ ] **Step 1: Add the Settings entry point in `MoreScreen.tsx`**

Add `Smartphone` to the lucide-react import (line 3-7 currently ends `RefreshCw, type LucideIcon,`):

```ts
import {
  Store, HandCoins, Wallet, Contact, Truck, Users, Printer, ShieldCheck,
  DownloadCloud, KeyRound, PlayCircle, Receipt, Boxes, Clock, HardDrive,
  RefreshCw, Smartphone, type LucideIcon,
} from 'lucide-react';
```

Add a new item to the "Aplikasi & Keamanan" group (currently lines 43-49), right after "Panduan":

```ts
  {
    title: 'Aplikasi & Keamanan',
    items: [
      { icon: ShieldCheck, label: 'PIN Owner', desc: 'Kunci aksi penting', screen: 'settings', opts: { focus: 'pin' } },
      { icon: DownloadCloud, label: 'Amankan Data', desc: 'Backup & pulihkan', screen: 'settings', opts: { focus: 'backup' } },
      { icon: KeyRound, label: 'Versi & Aktivasi', desc: 'Lite / Pro, kode lisensi', screen: 'settings', opts: { focus: 'license' } },
      { icon: PlayCircle, label: 'Panduan', desc: 'Putar ulang perkenalan', screen: 'settings', opts: { focus: 'guide' } },
      { icon: Smartphone, label: 'Install ke HP', desc: 'Pasang di layar utama', screen: 'settings', opts: { focus: 'install' } },
    ],
  },
```

- [ ] **Step 2: Add the section in `SettingsScreen.tsx`**

Add `install` to `FOCUS_TITLE` (line 26-30):

```ts
const FOCUS_TITLE: Record<string, string> = {
  profile: 'Profil Usaha', receipt: 'Struk', pin: 'PIN Owner', users: 'Kasir',
  customers: 'Pelanggan', suppliers: 'Supplier', license: 'Versi & Aktivasi',
  backup: 'Amankan Data', guide: 'Panduan', install: 'Install ke HP',
};
```

Add the import (after the `Modal` import, line 24):

```ts
import { InstallCard } from '@/components/InstallCard';
```

Render it after the `guide` section (currently lines 357-373 end with the section's closing `)}`  before the wrapping `</div></div>` at 374-376):

```tsx
        {/* Panduan */}
        {show('guide') && (
        <section id="guide" className="bg-card rounded-2xl border border-border p-5">
          <h2 className="font-bold text-sm mb-1 flex items-center gap-2">
            <PlayCircle className="w-4 h-4 text-primary" aria-hidden /> Panduan
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Mau lihat lagi perkenalan aplikasi dan info masa coba?
          </p>
          <button
            onClick={onReplayTour}
            className="w-full border border-border font-bold py-2.5 rounded-xl text-sm hover:bg-muted"
          >
            Putar Ulang Perkenalan
          </button>
        </section>
        )}

        {show('install') && <InstallCard />}
      </div>
    </div>
  );
}
```

(`InstallCard` already renders its own `bg-card rounded-2xl border border-border p-5` section, matching every other block here — no extra wrapper needed.)

- [ ] **Step 3: Type-check**

Run: `pnpm exec tsc -b`
Expected: no errors.

- [ ] **Step 4: Manual check**

Run: `pnpm dev`, log in as owner, go to **Lainnya**, confirm "Install ke HP" appears under "Aplikasi & Keamanan" with the phone icon, tap it, confirm it opens Settings scoped to just that section with header "Install ke HP", and the card renders (native button in Chrome desktop/Android, or manual instructions otherwise). Also open **Lainnya → Pengaturan** (unscoped, if such an entry point exists) or navigate with no `focus` and confirm the install section appears in the full list too, in the right place (after Panduan).

- [ ] **Step 5: Commit**

```bash
git add src/screens/SettingsScreen.tsx src/screens/MoreScreen.tsx
git commit -m "feat: add Install ke HP section to Settings"
```

---

## Self-Review Notes

- Spec coverage: icons/meta-tags (handled outside this plan per Global
  Constraints), install-event capture (Task 1), reusable UI (Task 2),
  onboarding placement (Task 3), settings placement (Task 4) — all covered.
- No placeholders: every step has literal, pasteable code.
- Type consistency: `InstallCard` (Task 2) has no props, matching how
  Tasks 3 and 4 both use it as `<InstallCard />`. `useInstallPromptStore`,
  `promptInstall`, `isIOS` names are identical everywhere they're
  referenced across tasks.
