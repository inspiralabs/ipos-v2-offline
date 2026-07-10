import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { motion } from 'motion/react';
import { DayPicker } from 'react-day-picker';
import { id as idLocale } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import { CalendarDays } from 'lucide-react';

// YYYY-MM-DD ↔ Date lokal (hindari pergeseran zona waktu dari new Date('YYYY-MM-DD'))
const toStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromStr = (s: string) => new Date(s + 'T00:00:00');

/**
 * Date picker bergaya shadcn (react-day-picker di dalam Radix Popover, animasi motion).
 * Nilai in/out tetap string YYYY-MM-DD — pemanggil lama tak berubah.
 */
export function DatePicker({ value, onChange, max, label }: {
  value: string;
  onChange: (s: string) => void;
  max?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = fromStr(value);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={label ?? 'Pilih tanggal'}
          className="flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-card hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary min-h-[40px]"
        >
          <CalendarDays className="w-4 h-4 text-muted-foreground" aria-hidden />
          {selected.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content asChild sideOffset={6} align="start">
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="z-[60] bg-card border border-border rounded-2xl shadow-xl p-2 rdp-maroon"
          >
            <DayPicker
              mode="single"
              locale={idLocale}
              selected={selected}
              defaultMonth={selected}
              disabled={max ? { after: fromStr(max) } : undefined}
              onSelect={(d) => {
                if (d) { onChange(toStr(d)); setOpen(false); }
              }}
            />
          </motion.div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
