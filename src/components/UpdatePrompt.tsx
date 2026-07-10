import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, X } from 'lucide-react';
import { usePwaUpdateStore } from '@/lib/pwa-update';

const isDemo = () => new URLSearchParams(location.search).get('demoUpdate') === '1';

/**
 * Notifikasi in-app "versi baru tersedia" — mode prompt (bukan silent auto-reload), supaya
 * kasir tidak tiba-tiba ke-reload di tengah transaksi. Muncul di atas nav bawah, kasir yang putuskan kapan.
 * Preview tanpa deploy: buka dengan ?demoUpdate=1 di URL.
 */
export function UpdatePrompt() {
  const [dismissed, setDismissed] = useState(false);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, r) {
      if (!r) return;
      usePwaUpdateStore.setState({ registration: r });
      // App biasanya dibuka terus sepanjang buka warung tanpa pernah ditutup — setInterval saja
      // di-throttle browser saat di-background, jadi cek juga tepat saat kasir buka lagi HP-nya.
      const recheck = () => { if (document.visibilityState === 'visible') r.update(); };
      document.addEventListener('visibilitychange', recheck);
      window.addEventListener('focus', recheck);
      setInterval(() => r.update(), 60 * 60 * 1000);
    },
  });

  useEffect(() => {
    usePwaUpdateStore.setState({ updateServiceWorker });
  }, [updateServiceWorker]);
  useEffect(() => {
    usePwaUpdateStore.setState({ needRefresh });
  }, [needRefresh]);

  const show = (needRefresh || isDemo()) && !dismissed;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="overflow-hidden shrink-0 print:hidden motion-reduce:transition-none"
        >
          <div className="bg-primary text-primary-foreground px-4 py-2.5 flex items-center gap-3">
            <RefreshCw className="w-4 h-4 shrink-0" aria-hidden />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-tight">Versi baru tersedia</p>
              <p className="text-xs opacity-90 leading-tight">Muat ulang untuk mendapatkan fitur dan perbaikan terbaru</p>
            </div>
            <button
              onClick={() => updateServiceWorker(true)}
              className="shrink-0 bg-card text-primary font-bold text-sm px-3 py-1.5 rounded-lg min-h-[36px]"
            >
              Muat ulang
            </button>
            <button
              onClick={() => setDismissed(true)}
              aria-label="Tutup notifikasi"
              className="shrink-0 opacity-80 hover:opacity-100 w-8 h-8 flex items-center justify-center"
            >
              <X className="w-4 h-4" aria-hidden />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
