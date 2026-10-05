import React, { useEffect, useState, useCallback } from 'react';
import {
  Printer, ShoppingBag, CreditCard, Flame, TrendingDown, TrendingUp,
  Leaf, LayoutDashboard, Boxes, ShoppingCart, ArrowDownCircle, ArrowUpCircle,
  ChevronDown,
} from 'lucide-react';
import api from '../api/axios';
import Card from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';

// ── Tab config ────────────────────────────────────────────────────────
const TABS = [
  { key: 'summary',        label: 'Overview',             icon: LayoutDashboard, endpoint: null },
  { key: 'daily',          label: 'Daily Report',         icon: LayoutDashboard, endpoint: '/reports/daily' },
  { key: 'cash_grv',       label: 'Cash GRV',             icon: ShoppingBag,     endpoint: '/reports/cash-grv' },
  { key: 'credit_grv',     label: 'Credit GRV',           icon: CreditCard,      endpoint: '/reports/credit-grv' },
  { key: 'fresh_bazaar',   label: 'Fresh Bazaar',         icon: Leaf,            endpoint: '/reports/fresh-bazaar' },
  { key: 'pos_adjustment', label: '+ve Adjustment',       icon: TrendingUp,      endpoint: '/reports/pos-adjustment' },
  { key: 'disposal',       label: 'Goods Disposal',       icon: Flame,           endpoint: '/reports/disposal' },
  { key: 'neg_adjustment', label: '−ve Adjustment',       icon: TrendingDown,    endpoint: '/reports/neg-adjustment' },
  { key: 'stock',          label: 'Stock Levels',         icon: Boxes,           endpoint: '/reports/stock-levels' },
  { key: 'purchases',      label: 'Purchases',            icon: ShoppingCart,    endpoint: '/reports/purchases' },
];

const TAB_COLORS = {
  cash_grv:       'text-blue-700   bg-blue-50',
  credit_grv:     'text-indigo-700 bg-indigo-50',
  fresh_bazaar:   'text-lime-700   bg-lime-50',
  pos_adjustment: 'text-violet-700 bg-violet-50',
  disposal:       'text-orange-700 bg-orange-50',
  neg_adjustment: 'text-red-700    bg-red-50',
  daily:          'text-ink-700    bg-ink-100',
  stock:          'text-ink-700    bg-ink-100',
  purchases:      'text-ink-700    bg-ink-100',
  summary:        'text-ink-700    bg-ink-100',
};

const VOUCHER_LABELS = {
  cash_grv:       'Cash GRV',
  credit_grv:     'Credit GRV',
  disposal:       'Goods Disposal',
  neg_adjustment: '−ve Adjustment',
  pos_adjustment: '+ve Adjustment',
  fresh_bazaar:   'Fresh Bazaar',
};

const todayStr = () => new Date().toISOString().slice(0, 10);

// ── Reusable stat card ────────────────────────────────────────────────
const Stat = ({ label, value, sub, color = 'text-ink-900' }) => (
  <Card>
    <p className="text-xs text-ink-400">{label}</p>
    <p className={`tabular mt-1 text-2xl font-bold ${color}`}>{value}</p>
    {sub && <p className="mt-0.5 text-xs text-ink-400">{sub}</p>}
  </Card>
);

// ── Voucher transactions table (shared by all voucher tabs) ───────────
const VoucherTable = ({ data, showSupplier = false, showReason = false }) => {
  const cols = [
    { key: 'date',      header: 'Date',       render: r => new Date(r.date).toLocaleString() },
    { key: 'voucherNo', header: 'Voucher No', render: r => <span className="font-mono text-xs">{r.voucherNo || '—'}</span> },
    ...(showSupplier ? [{ key: 'supplier', header: 'Supplier', render: r => r.supplier?.name || '—' }] : []),
    ...(showReason ? [{ key: 'reason', header: 'Reason', render: r => r.reason || '—' }] : []),
    {
      key: 'items', header: 'Items',
      render: r => {
        const lines = r.items?.length
          ? r.items.map(i => `${i.material?.name ?? '—'} ×${i.quantity}`)
          : [`${r.material?.name ?? '—'} ×${r.quantity ?? ''}`];
        return <span className="text-xs text-ink-600">{lines.join(' · ')}</span>;
      },
    },
    { key: 'totalAmount', header: 'Total (ETB)', render: r => <span className="tabular font-medium">ETB {(r.totalAmount || 0).toFixed(2)}</span> },
    { key: 'performedBy', header: 'By', render: r => r.performedBy?.name || '—' },
  ];
  return <DataTable columns={cols} data={data} emptyMessage="No records in this period." />;
};

// ── Material breakdown table ──────────────────────────────────────────
const MaterialBreakdown = ({ data }) => (
  <DataTable
    columns={[
      { key: 'name',      header: 'Material' },
      { key: 'totalQty',  header: 'Total Qty', render: r => <span className="tabular">{r.totalQty?.toFixed(3)}</span> },
      { key: 'totalCost', header: 'Total Cost (ETB)', render: r => <span className="tabular font-medium">ETB {(r.totalCost || 0).toFixed(2)}</span> },
    ]}
    data={data}
    emptyMessage="No breakdown available."
  />
);

// ── Main component ────────────────────────────────────────────────────
export default function Reports({ defaultTab } = {}) {
  const { user } = useAuth();
  const [tab, setTab]         = useState(defaultTab || 'summary');
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [hotelName, setHotelName] = useState('Five Stop');

  // Sync tab when navigated via sidebar
  useEffect(() => {
    if (defaultTab) { setTab(defaultTab); setData(null); }
  }, [defaultTab]);

  // Load hotel name for print header
  useEffect(() => {
    import('../api/axios').then(({ default: api }) => {
      api.get('/settings').then(res => {
        if (res.data?.hotelName) setHotelName(res.data.hotelName);
      }).catch(() => {});
    });
  }, []);

  // Date range / filter state
  const [date, setDate]     = useState(todayStr());
  const [from, setFrom]     = useState(todayStr());
  const [to, setTo]         = useState(todayStr());

  const currentTab = TABS.find(t => t.key === tab);

  const load = useCallback(async () => {
    if (!currentTab?.endpoint) {
      // summary tab — fetch aggregate
      setLoading(true);
      try {
        const params = {};
        if (from) params.from = from;
        if (to)   params.to   = to;
        const res = await api.get('/reports/summary', { params });
        setData(res.data);
      } finally { setLoading(false); }
      return;
    }

    setLoading(true);
    setData(null);
    try {
      let params = {};
      if (tab === 'daily') {
        params = { date };
      } else if (tab === 'stock') {
        // no params
      } else {
        params = { from, to };
      }
      const res = await api.get(currentTab.endpoint, { params });
      setData(res.data);
    } finally { setLoading(false); }
  }, [tab, date, from, to, currentTab]);

  useEffect(() => { load(); }, [load]);

  const colorCls = TAB_COLORS[tab] || 'text-ink-700 bg-ink-100';
  const printDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div id="print-area" className="space-y-4">

      {/* ── Print-only header ── */}
      <div id="print-header" style={{ display: 'none' }}>
        <h1>{hotelName}</h1>
        <p>{currentTab?.label ?? 'Report'} &mdash; Printed on {printDate}</p>
      </div>

      {/* ── Page heading (from sidebar nav) ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-ink-900">
          {currentTab?.label ?? 'Reports'}
        </h1>
        <Button variant="ghost" className="border border-ink-200" onClick={() => window.print()}>
          <Printer size={15} /> Print
        </Button>
      </div>

      {/* ── Date filter bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {tab === 'daily' && (
          <label className="flex items-center gap-2 text-sm text-ink-500">
            Date
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />
          </label>
        )}
        {tab !== 'daily' && tab !== 'stock' && (
          <>
            <label className="flex items-center gap-2 text-sm text-ink-500">
              From
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-500">
              To
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />
            </label>
          </>
        )}
      </div>

      {loading && (
        <div className="py-12 text-center text-sm text-ink-400">Loading…</div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          SUMMARY (Overview)
      ════════════════════════════════════════════════════════════════ */}
      {!loading && tab === 'summary' && data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {data.summary?.map(s => (
              <Stat
                key={s._id}
                label={VOUCHER_LABELS[s._id] ?? s._id}
                value={s.count}
                sub={`ETB ${(s.totalAmount || 0).toFixed(2)}`}
              />
            ))}
            {(!data.summary || data.summary.length === 0) && (
              <p className="col-span-6 text-center text-sm text-ink-400 py-6">No transactions in this period.</p>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          DAILY
      ════════════════════════════════════════════════════════════════ */}
      {!loading && tab === 'daily' && data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat label="Total stock IN"  value={data.stockIn}  color="text-emerald-700" />
            <Stat label="Total stock OUT" value={data.stockOut} color="text-red-700" />
            <Stat label="Purchases value" value={`ETB ${(data.purchaseTotal || 0).toFixed(2)}`} />
          </div>

          {/* Breakdown per voucher type */}
          {data.byVoucher && Object.keys(data.byVoucher).length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Object.entries(data.byVoucher).map(([vt, info]) => (
                <Card key={vt}>
                  <p className="text-xs font-semibold text-ink-500">{VOUCHER_LABELS[vt] ?? vt}</p>
                  <p className="tabular mt-1 text-xl font-bold text-ink-900">{info.count} voucher{info.count !== 1 ? 's' : ''}</p>
                  <p className="text-xs text-ink-400">ETB {(info.totalAmount || 0).toFixed(2)}</p>
                </Card>
              ))}
            </div>
          )}

          <p className="text-sm font-semibold text-ink-600">All movements on {data.date}</p>
          <DataTable
            columns={[
              { key: 'date',       header: 'Time',     render: r => new Date(r.date).toLocaleTimeString() },
              { key: 'voucherType',header: 'Voucher',  render: r => <span className="text-xs font-semibold">{VOUCHER_LABELS[r.voucherType] ?? r.voucherType ?? '—'}</span> },
              { key: 'voucherNo',  header: 'Ref',      render: r => <span className="font-mono text-xs">{r.voucherNo || '—'}</span> },
              { key: 'material',   header: 'Material', render: r => r.material?.name ?? r.items?.[0]?.material?.name ?? '—' },
              { key: 'quantity',   header: 'Qty',      render: r => <span className="tabular">{r.quantity ?? ''} {r.material?.unit ?? ''}</span> },
              { key: 'type',       header: 'Direction',render: r => <span className={r.type === 'in' ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'}>{r.type === 'in' ? '↑ IN' : '↓ OUT'}</span> },
              { key: 'performedBy',header: 'By',       render: r => r.performedBy?.name || '—' },
            ]}
            data={data.transactions}
            emptyMessage="No movements today."
          />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          PER-VOUCHER TABS (cash_grv / credit_grv / fresh_bazaar /
                            pos_adjustment / disposal / neg_adjustment)
      ════════════════════════════════════════════════════════════════ */}
      {!loading && ['cash_grv','credit_grv','fresh_bazaar','pos_adjustment','disposal','neg_adjustment'].includes(tab) && data && (
        <div className="space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat label="Vouchers"     value={data.count} />
            <Stat label="Total Amount" value={`ETB ${(data.totalAmount || 0).toFixed(2)}`}
              color={['disposal','neg_adjustment'].includes(tab) ? 'text-red-700' : 'text-emerald-700'} />
            <Stat label="Total Qty moved" value={(data.totalQty || 0).toFixed(3)} />
          </div>

          {/* Material breakdown */}
          {data.materialBreakdown?.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-ink-600">Material Breakdown</p>
              <MaterialBreakdown data={data.materialBreakdown} />
            </div>
          )}

          {/* Transactions */}
          <p className="text-sm font-semibold text-ink-600">
            {VOUCHER_LABELS[tab]} — {data.count} record{data.count !== 1 ? 's' : ''}
          </p>
          <VoucherTable
            data={data.transactions}
            showSupplier={['cash_grv','credit_grv'].includes(tab)}
            showReason={['disposal','neg_adjustment','pos_adjustment'].includes(tab)}
          />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          STOCK LEVELS
      ════════════════════════════════════════════════════════════════ */}
      {!loading && tab === 'stock' && data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Stat label="Total materials" value={data.count} />
            <Stat label="Total stock value" value={`ETB ${(data.totalValue || 0).toFixed(2)}`} color="text-blue-700" />
          </div>
          <DataTable
            columns={[
              { key: 'name',         header: 'Material' },
              { key: 'category',     header: 'Category' },
              { key: 'currentStock', header: 'In Stock',     render: r => <span className="tabular">{r.currentStock} {r.unit}</span> },
              { key: 'reorderLevel', header: 'Reorder At',   render: r => <span className="tabular">{r.reorderLevel} {r.unit}</span> },
              { key: 'unitCost',     header: 'Unit Cost',    render: r => <span className="tabular">ETB {(r.unitCost || 0).toFixed(2)}</span> },
              { key: 'value',        header: 'Value (ETB)',  render: r => <span className="tabular font-medium">ETB {(r.currentStock * r.unitCost).toFixed(2)}</span> },
              {
                key: 'status', header: 'Status',
                render: r => {
                  if (r.status === 'out_of_stock') return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Out of stock</span>;
                  if (r.status === 'low_stock')    return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Low stock</span>;
                  return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">In stock</span>;
                },
              },
            ]}
            data={data.materials}
          />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          PURCHASES
      ════════════════════════════════════════════════════════════════ */}
      {!loading && tab === 'purchases' && data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Stat label="Total purchases"      value={data.count} />
            <Stat label="Total value" value={`ETB ${(data.totalAmount || 0).toFixed(2)}`} color="text-blue-700" />
          </div>
          <DataTable
            columns={[
              { key: 'purchaseDate', header: 'Date',     render: r => new Date(r.purchaseDate).toLocaleDateString() },
              { key: 'supplier',     header: 'Supplier', render: r => r.supplier?.name },
              { key: 'items',        header: 'Items',    render: r => r.items?.length },
              { key: 'totalAmount',  header: 'Total',    render: r => <span className="tabular">ETB {(r.totalAmount || 0).toFixed(2)}</span> },
              { key: 'status',       header: 'Status',   render: r => <span className="capitalize">{r.status}</span> },
            ]}
            data={data.purchases}
          />
        </div>
      )}
    </div>
  );
}
