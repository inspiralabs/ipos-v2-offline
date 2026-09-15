# PWA Install CTA — Spec

## Background

Investigation (2026-09-15) found `ipos-v2-offline` has a fully configured PWA
(`vite-plugin-pwa`, manifest, service worker registration in
`UpdatePrompt.tsx`) but is **not installable**: the three icon files declared
in `vite.config.ts` (`/icon-192.png`, `/icon-512.png`) and referenced in
`index.html` (`/icon.svg`) do not exist anywhere in the repo — no `public/`
directory exists at all. Without a valid icon, Chrome/Edge never fire
`beforeinstallprompt`, so the browser never offers "Install app", regardless
of anything built in the UI.

Separately, even once installable, there is currently no UI anywhere in the
app that tells the user they *can* install it, or how — not at the end of
the onboarding tutorial (`src/screens/Onboarding.tsx`), and not in Settings
(`src/screens/SettingsScreen.tsx` / `src/screens/MoreScreen.tsx`).

## Goal

1. Make the app genuinely installable (supply real icon files).
2. Tell the user about installing, in two places:
   - At the end of the onboarding tutorial (the store-setup step).
   - In Settings, as a new "Install ke HP" section, reachable from the
     "Lainnya" hub — mirroring how every other settings section works.

## Requirements

- **Icons**: `public/icon.svg`, `public/icon-192.png`, `public/icon-512.png`,
  `public/apple-touch-icon.png` (180×180), rasterized from the existing
  Inspira POS brand mark at
  `ipos-v2/ipos-v2-landing-page/public/inspirapos-icon.svg` (reuse, not a
  new design). `index.html` gets `apple-touch-icon` +
  `apple-mobile-web-app-capable` meta tags.
- **Install capture**: a small store that listens for the
  `beforeinstallprompt` event globally (must attach before React mounts, so
  the event isn't missed) and exposes whether a native prompt is available,
  and whether the app is already running installed
  (`display-mode: standalone`).
- **Install UI**: one reusable component with three states:
  1. Native prompt available (Chrome/Edge Android/desktop) → a button that
     triggers it.
  2. iOS Safari (no `beforeinstallprompt` support) → manual instructions
     ("Share → Add to Home Screen").
  3. Any other browser without the event yet fired → generic manual
     instructions ("browser menu → Add to Home Screen / Install app").
  4. Already installed → render nothing.
- **Placement**:
  - Onboarding: inside the existing final "setup toko" step
    (`isSetup` block in `Onboarding.tsx`), so wizard step-count/dot logic is
    untouched. Not shown during `tourOnly` replay (existing users replaying
    the tour don't need it re-pitched every time, and the setup step is
    skipped in `tourOnly` mode anyway).
  - Settings: new section gated by `focus === 'install'`, following the
    exact pattern of the existing `guide` section (`SettingsScreen.tsx`),
    plus a new entry in `MoreScreen.tsx`'s `GROUPS` under "Aplikasi &
    Keamanan".

## Non-goals (explicitly out of scope for this plan)

- Fixing the unrelated `Tema Warna` section being gated under
  `show('profile')` in `SettingsScreen.tsx` (a pre-existing scope/naming
  mismatch noted during investigation, not requested for this change).
- `manifest.lang` mismatch (`"en"` vs Indonesian UI) — cosmetic, unrelated.
- A separate shareable onboarding/usage guide document — that's a
  standalone content deliverable (published as an Artifact), not part of
  this code plan.

## Verification

- `pnpm build && pnpm preview`, open in Chrome, confirm DevTools
  Application panel shows a valid manifest with resolvable icons and no
  installability warnings.
- Manually walk through onboarding as a new user (clear IndexedDB / new
  profile) and confirm the install card appears on the setup step.
- Open Settings → Lainnya → "Install ke HP" and confirm the section renders
  the same card.
