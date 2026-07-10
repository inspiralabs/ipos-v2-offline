import { type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, useDragControls } from 'motion/react';

/**
 * Radix Dialog + motion. Sheet dari bawah di HP (tarik gagangnya ke bawah untuk tutup),
 * center di layar lebar. Esc / tap backdrop = tutup. API tidak berubah dari versi lama.
 * ponytail: animasi masuk saja — animasi keluar butuh AnimatePresence di semua pemanggil.
 */
export function Modal({ onClose, children, wide = false }: {
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const drag = useDragControls();
  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay asChild>
          <motion.div
            className="fixed inset-0 bg-black/50 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
          />
        </Dialog.Overlay>
        <Dialog.Content asChild aria-describedby={undefined}>
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 pointer-events-none">
            <motion.div
              initial={{ y: 48, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
              drag="y"
              dragListener={false}
              dragControls={drag}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => { if (info.offset.y > 80 || info.velocity.y > 500) onClose(); }}
              className={`pointer-events-auto bg-card rounded-t-2xl sm:rounded-2xl w-full ${wide ? 'max-w-md' : 'max-w-sm'} shadow-xl max-h-[90dvh] overflow-y-auto pb-safe`}
            >
              <Dialog.Title className="sr-only">Dialog</Dialog.Title>
              {/* Gagang tarik — hanya HP; drag lewat gagang supaya tidak bentrok dengan scroll isi */}
              <div
                className="sm:hidden flex justify-center pt-2 -mb-1 touch-none cursor-grab"
                onPointerDown={(e) => drag.start(e)}
              >
                <div className="w-10 h-1 rounded-full bg-border" aria-hidden />
              </div>
              {children}
            </motion.div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
