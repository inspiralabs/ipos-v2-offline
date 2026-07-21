import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'motion/react';
import {
  ShoppingCart, UtensilsCrossed, BarChart3, TrendingUp, Wallet, Receipt,
  AlertTriangle, ChevronRight, type LucideIcon,
} from 'lucide-react';
import { db } from '@/db';
import { formatRp } from '@/lib/format';
import { useLicenseStore } from '@/store/license';
import { hasFeature } from '@/lib/plan';
import type { Screen, GoOpts } from '@/App';

const DAY_MS = 86400_000;
const METHOD_LABEL: Record<string, string> = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer', debt: 'Hutang' };

export function HomeScreen({ go, storeName }: { go: (s: Screen, o?: GoOpts) => void; storeName: string }) {
  const licState = useLicenseStore((s) => s.state);
  const canExpense = hasFeature(licState, 'expenses');

  const dayStart = new Date().setHours(0, 0, 0, 0);
  const dayEnd = dayStart + DAY_MS;

  const orders = useLiveQuery(
    () => db.orders.where('created_at').between(dayStart, dayEnd).toArray(),
    [dayStart]
  ) ?? [];
  const expenses = useLiveQuery(
    () => db.expenses.where('created_at').between(dayStart, dayEnd).toArray(),
    [dayStart]
  ) ?? [];
  // stok menipis: stok terisi & ≤ ambang (min_stock atau 5)
  const lowStock = useLiveQuery(
    async () => (await db.menus.filter((m) =>
      m.stock != null && m.stock <= (m.min_stock ?? 5)
    ).toArray()).sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0)).slice(0, 5),
    []
  ) ?? [];

  const paid = orders.filter((o) => o.status === 'paid');
  const totalSales = paid.reduce((s, o) => s + o.total, 0);
  const totalHpp = paid.reduce((s, o) => s + o.items.reduce((x, i) => x + i.hpp * i.qty, 0), 0);
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = totalSales - totalHpp - totalExpense;

  const recent = [...orders]
    .filter((o) => o.status !== 'open')
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, 5);

  const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const greeting = new Date().getHours() < 11 ? 'Selamat pagi' : new Date().getHours() < 15 ? 'Selamat siang' : new Date().getHours() < 18 ? 'Selamat sore' : 'Selamat malam';

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-5 max-w-lg w-full mx-auto">
        <div>
          <p className="text-sm text-muted-foreground">{greeting},</p>
          <h1 className="text-xl font-extrabold">{storeName || 'Inspira POS'}</h1>
        </div>

        {/* Penjualan hari ini — kartu utama */}
        <motion.button
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
          onClick={() => go('report', { reportTab: 'sales' })}
          className="w-full text-left bg-primary text-primary-foreground rounded-2xl p-5 shadow-warm active:scale-[0.99] transition"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm opacity-90">Penjualan hari ini</span>
            <ChevronRight className="w-4 h-4 opacity-70" aria-hidden />
          </div>
          <p className="text-3xl font-extrabold tabular-nums">{formatRp(totalSales)}</p>
          <p className="text-sm opacity-90 mt-1">{paid.length}x transaksi</p>
        </motion.button>

        {/* Profit + pengeluaran (pengeluaran Pro) */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={TrendingUp}
            label="Laba hari ini"
            value={formatRp(netProfit)}
            tone={netProfit >= 0 ? 'success' : 'danger'}
            onClick={() => go('report', { reportTab: 'sales' })}
          />
          {canExpense && (
            <StatCard
              icon={Wallet}
              label="Pengeluaran hari ini"
              value={formatRp(totalExpense)}
              tone="danger"
              onClick={() => go('report', { reportTab: 'expense' })}
            />
          )}
        </div>

        {/* Akses cepat */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 px-1">Akses cepat</h2>
          <div className="grid grid-cols-3 gap-3">
            <QuickAction icon={ShoppingCart} label="Kasir" onClick={() => go('pos')} />
            <QuickAction icon={UtensilsCrossed} label="Produk" onClick={() => go('menu')} />
            <QuickAction icon={BarChart3} label="Laporan" onClick={() => go('report', { reportTab: 'sales' })} />
          </div>
        </div>

        {/* Transaksi terakhir */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Transaksi terakhir</h2>
            <button onClick={() => go('txhistory')} className="text-xs font-semibold text-primary flex items-center gap-0.5">
              Semua <ChevronRight className="w-3 h-3" aria-hidden />
            </button>
          </div>
          {recent.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border p-5 text-center">
              <Receipt className="w-8 h-8 text-muted-foreground mx-auto mb-2" aria-hidden />
              <p className="text-sm text-muted-foreground">Belum ada transaksi hari ini. Yuk mulai jualan!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map((o) => (
                <div key={o.id} className="bg-card rounded-xl px-4 py-3 shadow-warm border border-border flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold tabular-nums ${o.status === 'void' ? 'line-through text-muted-foreground' : ''}`}>
                      {formatRp(o.total)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {fmtTime(o.created_at)} · {o.items.reduce((n, i) => n + i.qty, 0)} item · {METHOD_LABEL[o.payment_method] ?? o.payment_method}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                    o.status === 'void' ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                  }`}>
                    {o.status === 'void' ? 'Batal' : 'Lunas'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stok menipis */}
        {lowStock.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Stok menipis</h2>
              <button onClick={() => go('menu')} className="text-xs font-semibold text-primary flex items-center gap-0.5">
                Kelola <ChevronRight className="w-3 h-3" aria-hidden />
              </button>
            </div>
            <div className="space-y-2">
              {lowStock.map((m) => (
                <button
                  key={m.id}
                  onClick={() => go('menu')}
                  className="w-full text-left bg-card rounded-xl px-4 py-3 shadow-warm border border-border flex items-center gap-3 active:scale-[0.99] transition"
                >
                  {m.image_url
                    ? <img src={m.image_url} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                    : <span className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-lg shrink-0" aria-hidden>{m.emoji ?? '🍽️'}</span>}
                  <span className="flex-1 text-sm font-semibold truncate">{m.name}</span>
                  <span className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${
                    m.stock === 0 ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'
                  }`}>
                    <AlertTriangle className="w-3 h-3" aria-hidden />
                    {m.stock === 0 ? 'Habis' : `Sisa ${m.stock}`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone, onClick }: {
  icon: LucideIcon; label: string; value: string; tone: 'success' | 'danger'; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-card rounded-2xl border border-border p-4 text-left shadow-warm active:scale-[0.98] transition"
    >
      <span className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${tone === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
        <Icon className="w-4 h-4" aria-hidden />
      </span>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-extrabold tabular-nums ${tone === 'success' ? 'text-success' : 'text-destructive'}`}>{value}</p>
    </button>
  );
}

function QuickAction({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-card rounded-2xl border border-border p-4 flex flex-col items-center gap-2 shadow-warm hover:border-primary/30 active:scale-95 transition min-h-[88px] justify-center"
    >
      <span className="w-10 h-10 rounded-xl bg-accent-soft text-primary flex items-center justify-center">
        <Icon className="w-5 h-5" aria-hidden />
      </span>
      <span className="text-xs font-bold">{label}</span>
    </button>
  );
}
