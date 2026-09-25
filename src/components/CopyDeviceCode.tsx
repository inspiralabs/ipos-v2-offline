import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { getDeviceId } from '@/lib/device';

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // WebView/PWA di HP sering menolak clipboard API. Fallback di bawah.
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.top = '0';
    el.style.left = '0';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

/** Kode HP di layar aktivasi: bisa diketuk untuk disalin, bukan hanya dipilih manual. */
export function CopyDeviceCode({ className = '' }: { className?: string }) {
  const code = getDeviceId();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copy() {
    const ok = await copyText(code);
    if (!ok) {
      setFailed(true);
      setCopied(false);
      return;
    }
    setFailed(false);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground mb-1.5">Kode HP ini (dibutuhkan saat beli):</p>
      <button
        type="button"
        onClick={copy}
        className="w-full flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2.5 text-left active:bg-muted/80"
      >
        <span className="flex-1 min-w-0 font-mono text-xs text-foreground break-all select-all">{code}</span>
        <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-bold ${copied ? 'text-success' : 'text-primary'}`}>
          {copied ? <Check className="w-3.5 h-3.5" aria-hidden /> : <Copy className="w-3.5 h-3.5" aria-hidden />}
          {copied ? 'Tersalin' : 'Salin'}
        </span>
      </button>
      {failed && (
        <p className="text-xs text-destructive mt-1.5">Tidak bisa menyalin otomatis. Tahan kode di atas, lalu pilih Salin.</p>
      )}
    </div>
  );
}
