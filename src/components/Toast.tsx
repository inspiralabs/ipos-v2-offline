import { create } from 'zustand';
import { AnimatePresence, motion } from 'motion/react';

type ToastKind = 'info' | 'success' | 'error';
interface ToastItem { id: number; msg: string; kind: ToastKind }

const useToastStore = create<{ toasts: ToastItem[] }>(() => ({ toasts: [] }));
let seq = 0;

/** Tampilkan notifikasi mengambang. Pengganti alert(). */
export function toast(msg: string, kind: ToastKind = 'info') {
  const id = ++seq;
  // maksimal 3 tumpukan — yang paling lama tergeser keluar
  useToastStore.setState((s) => ({ toasts: [...s.toasts.slice(-2), { id, msg, kind }] }));
  setTimeout(() => useToastStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500);
}

const KIND_BG: Record<ToastKind, string> = {
  info: 'bg-foreground',
  success: 'bg-success',
  error: 'bg-destructive',
};

/** Tumpukan notifikasi (motion stacked toasts). Dipasang sekali di main.tsx. */
export function Toasts() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="fixed top-3 inset-x-0 z-[70] flex flex-col items-center gap-2 px-4 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={() => useToastStore.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) }))}
            role="status"
            className={`pointer-events-auto max-w-sm px-4 py-2.5 rounded-xl shadow-xl text-sm font-semibold text-white text-left ${KIND_BG[t.kind]}`}
          >
            {t.msg}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
