import * as S from '@radix-ui/react-select';
import { motion } from 'motion/react';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectItem {
  value: string; // Radix melarang value string kosong — pakai sentinel (mis. '0') untuk "tanpa"
  label: string;
}

/** Select bergaya app (Radix + animasi motion). Pengganti <select> native. */
export function Select({ id, value, onChange, items, placeholder = '— Pilih —', ariaLabel }: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  items: SelectItem[];
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <S.Root value={value || undefined} onValueChange={onChange}>
      <S.Trigger
        id={id}
        aria-label={ariaLabel}
        className="w-full flex items-center justify-between gap-2 border border-border bg-card rounded-xl px-3 py-2.5 text-sm min-h-[44px] text-left focus:outline-none focus:ring-2 focus:ring-primary data-[placeholder]:text-muted-foreground"
      >
        <S.Value placeholder={placeholder} />
        <S.Icon>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content asChild position="popper" sideOffset={4}>
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="z-[60] w-[var(--radix-select-trigger-width)] max-h-[min(320px,var(--radix-select-content-available-height))] overflow-hidden bg-card border border-border rounded-xl shadow-xl"
          >
            <S.Viewport className="p-1 max-h-[inherit] overflow-y-auto">
              {items.map((it) => (
                <S.Item
                  key={it.value}
                  value={it.value}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm rounded-lg cursor-pointer outline-none min-h-[40px] data-[highlighted]:bg-muted data-[state=checked]:font-bold data-[state=checked]:text-primary"
                >
                  <S.ItemText>{it.label}</S.ItemText>
                  <S.ItemIndicator>
                    <Check className="w-4 h-4 shrink-0" aria-hidden />
                  </S.ItemIndicator>
                </S.Item>
              ))}
            </S.Viewport>
          </motion.div>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}
