import { Download, Share, MoreVertical } from 'lucide-react';
import { useInstallPromptStore, promptInstall, isIOS } from '@/lib/install-prompt';
import { toast } from '@/components/Toast';

/** Tombol install native, atau instruksi manual per platform — dipakai di InstallCard (inline) dan InstallPopup (onboarding). */
export function InstallMethod({ onInstallTapped }: { onInstallTapped?: () => void }) {
  const deferredEvent = useInstallPromptStore((s) => s.deferredEvent);

  async function handleInstall() {
    const accepted = await promptInstall();
    if (!accepted) toast('Instalasi dibatalkan.', 'info');
    onInstallTapped?.();
  }

  if (deferredEvent) {
    return (
      <button
        onClick={handleInstall}
        className="w-full bg-primary text-primary-foreground font-bold py-2.5 rounded-xl text-sm min-h-[44px]"
      >
        Install Sekarang
      </button>
    );
  }
  if (isIOS()) {
    return (
      <p className="text-sm text-muted-foreground leading-relaxed">
        Tap ikon <Share className="w-3.5 h-3.5 inline" aria-hidden /> <b className="text-foreground">Bagikan</b> di Safari,
        lalu pilih <b className="text-foreground">Tambah ke Layar Utama</b>.
      </p>
    );
  }
  return (
    <p className="text-sm text-muted-foreground leading-relaxed">
      Tap ikon <MoreVertical className="w-3.5 h-3.5 inline" aria-hidden /> menu di browser kamu,
      lalu pilih <b className="text-foreground">Tambahkan ke Layar Utama</b> atau <b className="text-foreground">Install aplikasi</b>.
    </p>
  );
}

export function InstallCard() {
  const installed = useInstallPromptStore((s) => s.installed);

  if (installed) return null;

  return (
    <section id="install" className="bg-card rounded-2xl border border-border p-5">
      <h2 className="font-bold text-sm mb-1 flex items-center gap-2">
        <Download className="w-4 h-4 text-primary" aria-hidden /> Install ke HP
      </h2>
      <p className="text-sm text-muted-foreground mb-3">
        Biar Inspira POS bisa dibuka langsung dari layar utama, secepat aplikasi biasa — nggak perlu buka browser dulu.
      </p>
      <InstallMethod />
    </section>
  );
}
