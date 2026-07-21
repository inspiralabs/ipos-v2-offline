import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ArrowDownCircle, ArrowUpCircle, Boxes, AlertTriangle } from 'lucide-react';
import { db } from '@/db';
import { formatRp } from '@/lib/format';

const DAY_MS = 86400_000;
const OUT_REASON: Record<string, string> = {
  rusak: 'Rusak / basi', hilang: 'Hilang', 'dipakai sendiri': 'Dipakai sendiri', koreksi: 'Koreksi hitung',
};

// Laporan stok: sisa stok saat ini per produk + riwayat pergerakan (masuk/keluar). (ipos-v1: Laporan Stok)
export function StockReportScreen({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<'current' | 'moves'>('current');

  return (
    <div className="flex flex-col h-full">
      <header className="bg-card border-b border-border px-4 py-3 shrink-0 flex items-center gap-2">
        <button
          onClick={onBack}
          aria-label="Kembali ke Lainnya"
          className="w-9 h-9 -ml-2 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted"
        >
          <ChevronLeft className="w-5 h-5" aria-hidden />
        </button>
        <h1 className="font-bold text-lg">Laporan Stok</h1>
      </header>

      <div className="px-4 pt-3 shrink-0">
        <div className="flex gap-1 bg-muted rounded-xl p-1" role="tablist">
          {([['current', 'Stok Saat Ini'], ['moves', 'Riwayat Pergerakan']] as const).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold transition ${
                tab === id ? 'bg-card shadow-warm text-primary' : 'text-muted-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'current' ? <CurrentStockTab /> : <MovementsTab />}
    </div>
  );
}

// ===================== STOK SAAT INI =====================
function CurrentStockTab() {
  // hanya produk yang stoknya dilacak (stock != null); produk jasa/tanpa batas tak muncul di sini
  const menus = useLiveQuery(
    async () => (await db.menus.filter((m) => m.stock != null).toArray())
      .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0)),
    []
  ) ?? [];

  const outCount = menus.filter((m) => m.stock === 0).length;
  const lowCount = menus.filter((m) => m.stock != null && m.stock > 0 && m.stock <= (m.min_stock ?? 5)).length;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-lg w-full mx-auto">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-2xl border border-border p-4">
          <span className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center mb-2">
            <AlertTriangle className="w-4 h-4" aria-hidden />
          </span>
          <p className="text-xs text-muted-foreground">Stok habis</p>
          <p className="text-lg font-extrabold text-destructive tabular-nums">{outCount}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <span className="w-8 h-8 rounded-lg bg-warning/10 text-warning flex items-center justify-center mb-2">
            <AlertTriangle className="w-4 h-4" aria-hidden />
          </span>
          <p className="text-xs text-muted-foreground">Stok menipis</p>
          <p className="text-lg font-extrabold text-warning tabular-nums">{lowCount}</p>
        </div>
      </div>

      {menus.length === 0 ? (
        <div className="text-center py-16 px-6">
          <Boxes className="w-10 h-10 text-muted-foreground mx-auto mb-3" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Belum ada produk dengan stok dilacak. Isi jumlah stok saat menambah/mengubah menu di tab Menu.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {menus.map((m) => {
            const out = m.stock === 0;
            const low = !out && m.stock != null && m.stock <= (m.min_stock ?? 5);
            return (
              <div key={m.id} className="bg-card rounded-xl px-4 py-3 shadow-warm border border-border flex items-center gap-3">
                {m.image_url
                  ? <img src={m.image_url} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                  : <span className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-lg shrink-0" aria-hidden>{m.emoji ?? '🍽️'}</span>}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{m.name}</p>
                  {m.hpp > 0 && <p className="text-xs text-muted-foreground">modal {formatRp(m.hpp)}/pcs</p>}
                </div>
                <span className={`text-sm font-extrabold px-2.5 py-1 rounded-full shrink-0 tabular-nums ${
                  out ? 'bg-destructive/10 text-destructive' : low ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'
                }`}>
                  {out ? 'Habis' : `Sisa ${m.stock}`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===================== RIWAYAT PERGERAKAN =====================
function MovementsTab() {
  const [range, setRange] = useState<7 | 30 | 0>(7); // 0 = semua
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all');

  const since = range === 0 ? 0 : Date.now() - range * DAY_MS;
  const moves = useLiveQuery(
    () => db.stock_moves.where('created_at').aboveOrEqual(since).reverse().sortBy('created_at'),
    [since]
  ) ?? [];

  const shown = filter === 'all' ? moves : moves.filter((m) => m.type === filter);
  const totalIn = moves.filter((m) => m.type === 'in').reduce((s, m) => s + m.qty, 0);
  const totalOut = moves.filter((m) => m.type === 'out').reduce((s, m) => s + m.qty, 0);

  const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-lg w-full mx-auto">
      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-2xl border border-border p-4">
          <span className="w-8 h-8 rounded-lg bg-success/10 text-success flex items-center justify-center mb-2">
            <ArrowDownCircle className="w-4 h-4" aria-hidden />
          </span>
          <p className="text-xs text-muted-foreground">Barang masuk</p>
          <p className="text-lg font-extrabold text-success tabular-nums">{totalIn}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <span className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center mb-2">
            <ArrowUpCircle className="w-4 h-4" aria-hidden />
          </span>
          <p className="text-xs text-muted-foreground">Barang keluar</p>
          <p className="text-lg font-extrabold text-destructive tabular-nums">{totalOut}</p>
        </div>
      </div>

      {/* Filter periode & jenis */}
      <div className="flex items-center gap-2 flex-wrap">
        {([[7, '7 hari'], [30, '30 hari'], [0, 'Semua']] as const).map(([r, label]) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`text-xs font-bold px-3 py-1.5 rounded-full ${range === r ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
          >
            {label}
          </button>
        ))}
        <div className="ml-auto flex rounded-full border border-border overflow-hidden">
          {([['all', 'Semua'], ['in', 'Masuk'], ['out', 'Keluar']] as const).map(([f, label]) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-bold px-3 py-1.5 ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="text-center py-16 px-6">
          <Boxes className="w-10 h-10 text-muted-foreground mx-auto mb-3" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Belum ada catatan stok di periode ini. Catat barang masuk/keluar lewat tab Menu → ikon kotak di tiap produk.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((m) => (
            <div key={m.id} className="bg-card rounded-xl px-4 py-3 shadow-warm border border-border flex items-center gap-3">
              <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${m.type === 'in' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                {m.type === 'in' ? <ArrowDownCircle className="w-4 h-4" aria-hidden /> : <ArrowUpCircle className="w-4 h-4" aria-hidden />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{m.menu_name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {fmtDate(m.created_at)}
                  {m.type === 'in' && m.buy_price ? ` · @${formatRp(m.buy_price)}` : ''}
                  {m.type === 'in' && m.supplier ? ` · ${m.supplier}` : ''}
                  {m.type === 'out' && m.reason ? ` · ${OUT_REASON[m.reason] ?? m.reason}` : ''}
                </p>
              </div>
              <span className={`text-sm font-extrabold tabular-nums shrink-0 ${m.type === 'in' ? 'text-success' : 'text-destructive'}`}>
                {m.type === 'in' ? '+' : '−'}{m.qty}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
