import { useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { Modal } from './Modal';
import { DatePicker } from './DatePicker';
import { exportReportExcel, exportReportPdf } from '@/lib/export-report';

function toRangeMs(startStr: string, endStr: string): [number, number] {
  const start = new Date(startStr + 'T00:00:00').getTime();
  const end = new Date(endStr + 'T00:00:00').getTime() + 86400_000; // end exclusive, covers the whole end day
  return [start, end];
}

export function ExportReportDialog({ defaultStart, defaultEnd, onClose }: {
  defaultStart: string;
  defaultEnd: string;
  onClose: () => void;
}) {
  const [startStr, setStartStr] = useState(defaultStart);
  const [endStr, setEndStr] = useState(defaultEnd);
  const [loading, setLoading] = useState<'excel' | 'pdf' | null>(null);

  const invalid = !startStr || !endStr || startStr > endStr;

  async function run(kind: 'excel' | 'pdf') {
    if (invalid) return;
    setLoading(kind);
    try {
      const [start, end] = toRangeMs(startStr, endStr);
      if (kind === 'excel') await exportReportExcel(start, end);
      else await exportReportPdf(start, end);
      onClose();
    } finally {
      setLoading(null);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="px-6 pt-5 pb-4 border-b border-border">
        <h2 className="font-bold text-lg">Export Laporan</h2>
      </div>
      <div className="px-6 py-4 space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1.5">Dari tanggal</label>
          <DatePicker value={startStr} onChange={setStartStr} max={endStr} label="Dari tanggal" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Sampai tanggal</label>
          <DatePicker value={endStr} onChange={setEndStr} label="Sampai tanggal" />
        </div>
        {invalid && (
          <p className="text-sm text-destructive">Rentang tanggal tidak valid — tanggal awal harus sebelum atau sama dengan tanggal akhir.</p>
        )}
      </div>
      <div className="px-6 pb-5 flex gap-3">
        <button
          onClick={() => run('excel')}
          disabled={invalid || loading !== null}
          className="flex-1 flex items-center justify-center gap-2 border border-border rounded-xl py-3 text-sm font-semibold hover:bg-muted disabled:opacity-40 min-h-[48px]"
        >
          <FileSpreadsheet className="w-4 h-4" aria-hidden />
          {loading === 'excel' ? 'Membuat…' : 'Excel (.xlsx)'}
        </button>
        <button
          onClick={() => run('pdf')}
          disabled={invalid || loading !== null}
          className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold rounded-xl py-3 text-sm disabled:opacity-40 min-h-[48px]"
        >
          <FileText className="w-4 h-4" aria-hidden />
          {loading === 'pdf' ? 'Membuat…' : 'PDF (.pdf)'}
        </button>
      </div>
    </Modal>
  );
}
