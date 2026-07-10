import { useState } from 'react';
import { create } from 'zustand';
import { Modal } from './Modal';

// Pengganti confirm() / prompt() native — dialog Radix bergaya app.
// Satu antrian global; dialog bertumpuk tidak didukung (tidak ada kasusnya di app ini).

interface Req {
  msg: string;
  danger?: boolean;
  okLabel?: string;
  input?: { initial: string; password?: boolean; numeric?: boolean; placeholder?: string };
  resolve: (v: string | boolean | null) => void;
}

const useDialogStore = create<{ req: Req | null }>(() => ({ req: null }));

export function confirmDialog(msg: string, opts: { danger?: boolean; okLabel?: string } = {}): Promise<boolean> {
  return new Promise((resolve) =>
    useDialogStore.setState({ req: { msg, ...opts, resolve: (v) => resolve(v === true) } })
  );
}

export function promptDialog(
  msg: string,
  opts: { initial?: string; password?: boolean; numeric?: boolean; placeholder?: string; okLabel?: string } = {}
): Promise<string | null> {
  return new Promise((resolve) =>
    useDialogStore.setState({
      req: {
        msg,
        okLabel: opts.okLabel,
        input: { initial: opts.initial ?? '', password: opts.password, numeric: opts.numeric, placeholder: opts.placeholder },
        resolve: (v) => resolve(typeof v === 'string' ? v : null),
      },
    })
  );
}

/** Dipasang sekali di main.tsx. */
export function DialogHost() {
  const req = useDialogStore((s) => s.req);
  if (!req) return null;
  return <DialogBody req={req} />;
}

function DialogBody({ req }: { req: Req }) {
  const [text, setText] = useState(req.input?.initial ?? '');

  function finish(v: string | boolean | null) {
    useDialogStore.setState({ req: null });
    req.resolve(v);
  }

  return (
    <Modal onClose={() => finish(req.input ? null : false)}>
      <form
        onSubmit={(e) => { e.preventDefault(); finish(req.input ? text : true); }}
        className="px-6 pt-5 pb-5"
      >
        <p className="font-semibold mb-4">{req.msg}</p>
        {req.input && (
          <input
            type={req.input.password ? 'password' : 'text'}
            inputMode={req.input.numeric ? 'numeric' : undefined}
            value={text}
            onChange={(e) => setText(req.input!.numeric ? e.target.value.replace(/\D/g, '') : e.target.value)}
            placeholder={req.input.placeholder}
            maxLength={req.input.numeric ? 6 : undefined}
            autoFocus
            aria-label={req.msg}
            className={`w-full border border-border rounded-xl px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary ${req.input.password ? 'tracking-widest' : ''}`}
          />
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => finish(req.input ? null : false)}
            className="flex-1 border border-border rounded-xl py-3 text-sm text-muted-foreground hover:bg-muted min-h-[48px]"
          >
            Batal
          </button>
          <button
            type="submit"
            className={`flex-1 font-bold py-3 rounded-xl text-sm min-h-[48px] text-white ${req.danger ? 'bg-destructive' : 'bg-primary text-primary-foreground'}`}
          >
            {req.okLabel ?? 'OK'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
