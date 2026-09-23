import { forwardRef, useEffect, useRef, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, useDragControls } from 'motion/react';


export const Modal = forwardRef<HTMLDivElement, {
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}>(function Modal({ onClose, children, wide = false }, ref) {
  const drag = useDragControls();
  const closedByPopRef = useRef(false);
  const modalIdRef = useRef<string>();
  const cleanupTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const modalId = modalIdRef.current ?? (modalIdRef.current = crypto.randomUUID());
    if (cleanupTimerRef.current !== null) {
      window.clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }

    // React StrictMode runs setup → cleanup → setup once in development.
    // Reuse the first entry during that probe instead of stacking a second one.
    if (history.state?.iposModalId !== modalId) {
      history.pushState({ ...history.state, iposModal: true, iposModalId: modalId }, '');
    }

    const onPopState = (event: PopStateEvent) => {
      // A nested modal was popped: only the nested modal closes. The parent
      // remains mounted on the history entry now at the top.
      if (event.state?.iposModalId === modalId) return;
      closedByPopRef.current = true;
      onClose();
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      if (!closedByPopRef.current) {
        // Defer so StrictMode's immediate second setup can cancel this.
        cleanupTimerRef.current = window.setTimeout(() => {
          cleanupTimerRef.current = null;
          if (history.state?.iposModalId === modalId) history.back();
        }, 0);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              ref={ref}
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
});
