import { Download } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { useInstallPromptStore } from '@/lib/install-prompt';
import { InstallMethod } from '@/components/InstallCard';

/** Popup ajakan install — muncul sekali saat user menyelesaikan onboarding, sebelum masuk ke aplikasi. */
export function InstallPopup({ onClose }: { onClose: () => void }) {
  const installed = useInstallPromptStore((s) => s.installed);

  if (installed) return null;

  return (
    <Modal onClose={onClose}>
      <div className="px-6 pt-6 pb-5">
        <div className="w-12 h-12 rounded-2xl bg-accent-soft text-primary flex items-center justify-center mb-4">
          <Download className="w-6 h-6" aria-hidden />
        </div>
        <h2 className="font-bold text-lg mb-1">Install ke HP dulu, yuk</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Biar Inspira POS bisa dibuka langsung dari layar utama, secepat aplikasi biasa — nggak perlu buka browser dulu.
        </p>
        <div className="mb-2">
          <InstallMethod onInstallTapped={onClose} />
        </div>
        <button
          onClick={onClose}
          className="w-full border border-border rounded-xl py-3 text-sm text-muted-foreground hover:bg-muted mt-2"
        >
          Nanti aja
        </button>
      </div>
    </Modal>
  );
}
