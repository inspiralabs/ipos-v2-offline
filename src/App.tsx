import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'motion/react';
import {
  Home, ShoppingCart, UtensilsCrossed, Clock, BarChart3, LayoutGrid, LogOut,
  type LucideIcon,
} from 'lucide-react';
import { db } from '@/db';
import { KEYS } from '@/lib/store-settings';
import { checkLicenseStatus } from '@/lib/sync';
import { applyTheme } from '@/lib/theme';
import { useLicenseStore } from '@/store/license';
import { useSessionStore } from '@/store/session';
import { confirmDialog } from '@/components/dialogs';
import { LicenseGate } from '@/screens/LicenseGate';
import { LockScreen } from '@/screens/LockScreen';
import { Onboarding } from '@/screens/Onboarding';
import { HomeScreen } from '@/screens/HomeScreen';
import { PosScreen } from '@/screens/PosScreen';
import { MenuScreen } from '@/screens/MenuScreen';
import { ShiftScreen } from '@/screens/ShiftScreen';
import { ReportScreen, type ReportTab } from '@/screens/ReportScreen';
import { StockReportScreen } from '@/screens/StockReportScreen';
import { TransactionHistoryScreen } from '@/screens/TransactionHistoryScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { MoreScreen } from '@/screens/MoreScreen';
import { TrialBadge } from '@/components/TrialBadge';
import { UpdatePrompt } from '@/components/UpdatePrompt';

export type Screen =
  | 'home' | 'pos' | 'menu' | 'shift' | 'report' | 'more'
  | 'settings' | 'txhistory' | 'stockreport';
export interface GoOpts { reportTab?: ReportTab; focus?: string }

// Kasir hanya Kasir/Produk/Shift; owner dapat Beranda + hub Lainnya (Shift ada di dalamnya).
// 'pos' selalu di tengah array — dirender sebagai tombol mengambang (FAB), aksi utama kasir.
const OWNER_NAV: { id: Screen; label: string; icon: LucideIcon }[] = [
  { id: 'home', label: 'Beranda', icon: Home },
  { id: 'menu', label: 'Produk', icon: UtensilsCrossed },
  { id: 'pos', label: 'Kasir', icon: ShoppingCart },
  { id: 'report', label: 'Laporan', icon: BarChart3 },
  { id: 'more', label: 'Lainnya', icon: LayoutGrid },
];
const KASIR_NAV: { id: Screen; label: string; icon: LucideIcon }[] = [
  { id: 'menu', label: 'Produk', icon: UtensilsCrossed },
  { id: 'pos', label: 'Kasir', icon: ShoppingCart },
  { id: 'shift', label: 'Shift', icon: Clock },
];

// Sub-halaman yang dibuka dari hub Lainnya → tab Lainnya tetap menyala + tombol kembali.
const SUBPAGES: Screen[] = ['settings', 'shift', 'txhistory', 'stockreport'];

export default function App() {
  const valid = useLicenseStore((s) => s.valid);
  const refresh = useLicenseStore((s) => s.refresh);
  const sessionUser = useSessionStore((s) => s.user);
  const logout = useSessionStore((s) => s.logout);
  const [screen, setScreen] = useState<Screen>('home');
  const [reportTab, setReportTab] = useState<ReportTab>('sales');
  const [settingsFocus, setSettingsFocus] = useState<string | undefined>();
  const [tourReplay, setTourReplay] = useState(false);

  // Navigasi dari hub Lainnya: bisa langsung ke tab laporan / bagian pengaturan tertentu.
  function go(s: Screen, opts?: GoOpts) {
    if (opts?.reportTab) setReportTab(opts.reportTab);
    setSettingsFocus(opts?.focus);
    setScreen(s);
  }

  // Cek status trial ke server saat online (best-effort, PRD §5.3 step 4)
  useEffect(() => {
    checkLicenseStatus().then(refresh);
    db.settings.get(KEYS.themeColor).then((v) => { if (v?.value) applyTheme(v.value); });
  }, [refresh]);

  // undefined = masih loading dari IndexedDB, jangan render apa pun dulu
  const onboardingDone = useLiveQuery(
    async () => (await db.settings.get(KEYS.onboardingDone))?.value ?? '',
    []
  );
  const storeName = useLiveQuery(
    async () => (await db.settings.get(KEYS.storeName))?.value ?? '',
    []
  );
  const userCount = useLiveQuery(() => db.users.count(), []);

  if (onboardingDone === undefined || userCount === undefined) return null;
  if (onboardingDone !== '1') return <Onboarding onDone={() => { /* liveQuery re-render */ }} />;
  if (tourReplay) return <Onboarding tourOnly onDone={() => setTourReplay(false)} />;
  if (!valid) return <LicenseGate />;
  // multi-user aktif → wajib pilih siapa yang jaga (Pro)
  if (userCount > 0 && !sessionUser) return <LockScreen />;

  const isKasir = sessionUser?.role === 'kasir';
  const nav = isKasir ? KASIR_NAV : OWNER_NAV;
  // Kasir tak boleh buka layar owner walau state terlanjur ke sana — 'shift' dikecualikan,
  // itu ada di KASIR_NAV sendiri (kasir boleh buka/tutup shift-nya sendiri).
  const ownerScreens: Screen[] = ['home', 'report', 'more', 'settings', 'txhistory', 'stockreport'];
  const activeScreen = isKasir && ownerScreens.includes(screen) ? 'pos' : screen;
  // Sub-halaman dibuka lewat hub → tab Lainnya tetap menyala
  const activeNav = SUBPAGES.includes(activeScreen) ? 'more' : activeScreen;

  return (
    <div className="flex flex-col h-dvh">
      <header className="bg-card border-b border-border px-4 py-2.5 flex items-center gap-2 shrink-0 print:hidden">
        <h1 className="font-extrabold text-primary truncate flex-1">{storeName || 'Inspira POS'}</h1>
        {sessionUser && (
          <button
            onClick={async () => (await confirmDialog('Ganti pengguna?', { okLabel: 'Ganti' })) && logout()}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            aria-label="Ganti pengguna"
          >
            {sessionUser.name} <LogOut className="w-3.5 h-3.5" aria-hidden />
          </button>
        )}
        <TrialBadge />
      </header>

      <div className="flex-1 min-h-0 overflow-hidden">
        {activeScreen === 'home' && <HomeScreen go={go} storeName={storeName || ''} />}
        {activeScreen === 'pos' && <PosScreen />}
        {activeScreen === 'menu' && <MenuScreen />}
        {activeScreen === 'shift' && <ShiftScreen onBack={!isKasir ? () => setScreen('more') : undefined} />}
        {activeScreen === 'report' && <ReportScreen initialTab={reportTab} />}
        {activeScreen === 'txhistory' && <TransactionHistoryScreen onBack={() => setScreen('more')} />}
        {activeScreen === 'stockreport' && <StockReportScreen onBack={() => setScreen('more')} />}
        {activeScreen === 'more' && <MoreScreen go={go} />}
        {activeScreen === 'settings' && (
          <SettingsScreen
            onReplayTour={() => setTourReplay(true)}
            focus={settingsFocus}
            onBack={() => setScreen('more')}
          />
        )}
      </div>

      <UpdatePrompt />

      <nav className="relative bg-card border-t border-border flex items-end shrink-0 pb-safe print:hidden" aria-label="Menu utama">
        {nav.map((n) => {
          const Icon = n.icon;
          const active = activeNav === n.id;

          // Kasir = aksi utama kasir → tombol bundar mengambang, bukan tab rata seperti yang lain
          if (n.id === 'pos') {
            return (
              <button
                key={n.id}
                onClick={() => go(n.id)}
                aria-current={active ? 'page' : undefined}
                className="relative z-10 flex flex-col items-center gap-1 px-2 -mt-7 motion-reduce:transform-none"
              >
                <motion.span
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: 'spring', duration: 0.25 }}
                  className={`w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg ring-4 ring-card transition-shadow ${
                    active ? 'ring-accent' : ''
                  }`}
                >
                  <Icon className="w-6 h-6" strokeWidth={2.25} aria-hidden />
                </motion.span>
                <span className={`text-[11px] pb-1.5 ${active ? 'text-primary font-bold' : 'text-muted-foreground font-medium'}`}>
                  {n.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 min-h-[56px] text-[11px] font-medium transition active:scale-95 ${
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="relative flex items-center justify-center w-12 h-6">
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-accent-soft"
                    transition={{ type: 'spring', duration: 0.4, bounce: 0.2 }}
                  />
                )}
                <Icon className="w-5 h-5 relative" strokeWidth={active ? 2.25 : 2} aria-hidden />
              </span>
              {n.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
