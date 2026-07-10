/**
 * Input uang: tampil dengan pemisah ribuan (mis. 15.000), nilai keluar-masuk
 * tetap string berisi angka saja — pemakai lama yang menyimpan state string tak perlu berubah.
 * ponytail: kursor selalu lompat ke akhir saat mengetik di tengah; kasir mengetik uang dari
 * belakang, kasus nyata. Pakai lib input-mask kalau nanti perlu edit di tengah.
 */
export function RupiahInput({ value, onChange, className = '', placeholder, ...rest }: {
  value: string;
  onChange: (digits: string) => void;
  className?: string;
  placeholder?: string;
  id?: string;
  autoFocus?: boolean;
  'aria-label'?: string;
}) {
  const fmt = (digits: string) => (digits ? Number(digits).toLocaleString('id-ID') : '');
  return (
    <input
      type="text"
      inputMode="numeric"
      value={fmt(value)}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 12))}
      placeholder={placeholder && /^\d+$/.test(placeholder) ? fmt(placeholder) : (placeholder ?? '0')}
      className={className}
      {...rest}
    />
  );
}
