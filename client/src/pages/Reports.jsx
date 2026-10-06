import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Printer, Scale, Search, History, X, RefreshCw,
} from 'lucide-react';
import api from '../api/axios';
import Card from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import Button from '../components/ui/Button';
import ExportDropdown from '../components/ui/ExportDropdown';

// Route → API endpoint map (used by the load function)
const TABS = [
  { key: 'summary',        label: 'Overview',            endpoint: null },
  { key: 'stock_balance',  label: 'Stock Balance Sheet', endpoint: '/reports/stock-balance' },
  { key: 'daily',          label: 'Daily Report',         endpoint: '/reports/daily' },
  { key: 'cash_grv',       label: 'Cash GRV',             endpoint: '/reports/cash-grv' },
  { key: 'credit_grv',     label: 'Credit GRV',           endpoint: '/reports/credit-grv' },
  { key: 'fresh_bazaar',   label: 'Fresh Bazaar',         endpoint: '/reports/fresh-bazaar' },
  { key: 'pos_adjustment', label: '+ve Adjustment',       endpoint: '/reports/pos-adjustment' },
  { key: 'disposal',       label: 'Goods Disposal',       endpoint: '/reports/disposal' },
  { key: 'neg_adjustment', label: '−ve Adjustment',       endpoint: '/reports/neg-adjustment' },
  { key: 'stock',          label: 'Stock Levels',         endpoint: '/reports/stock-levels' },
  { key: 'purchases',      label: 'Purchases',            endpoint: '/reports/purchases' },
];


const VOUCHER_LABELS = {
  cash_grv:       'Cash GRV',
  credit_grv:     'Credit GRV',
  disposal:       'Goods Disposal',
  neg_adjustment: '−ve Adjustment',
  pos_adjustment: '+ve Adjustment',
  fresh_bazaar:   'Fresh Bazaar',
  sales_import:   'Sales Import',
};

const todayStr = () => new Date().toISOString().slice(0, 10);

const startOfMonthStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const startOfWeekStr = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().slice(0, 10);
};

// ── Reusable stat card ────────────────────────────────────────────────
const Stat = ({ label, value, sub, color = 'text-ink-900', badge = null }) => (
  <Card>
    <div className="flex items-center justify-between">
      <p className="text-xs font-medium text-ink-500">{label}</p>
      {badge && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-ink-100 text-ink-600">{badge}</span>}
    </div>
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
  const [tab, setTab]         = useState(defaultTab || 'stock_balance');
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [hotelName, setHotelName] = useState('Five Stop');

  // Filter & Search states
  const [date, setDate]                     = useState(todayStr());
  const [from, setFrom]                     = useState(startOfMonthStr());
  const [to, setTo]                         = useState(todayStr());
  const [activePreset, setActivePreset]     = useState('month');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [stockSearch, setStockSearch]       = useState('');

  // Item Ledger (Bin Card) modal state
  const [selectedLedgerMaterial, setSelectedLedgerMaterial] = useState(null);
  const [ledgerLoading, setLedgerLoading]                   = useState(false);
  const [ledgerData, setLedgerData]                         = useState(null);

  // Sync tab when navigated via sidebar
  useEffect(() => {
    if (defaultTab) {
      setTab(defaultTab);
      setData(null);
      if (defaultTab === 'stock_balance' && !from) {
        setFrom(startOfMonthStr());
        setTo(todayStr());
      }
    }
  }, [defaultTab]);

  // Load hotel name for print header
  useEffect(() => {
    api.get('/settings').then(res => {
      if (res.data?.hotelName) setHotelName(res.data.hotelName);
    }).catch(() => {});
  }, []);

  const currentTab = TABS.find(t => t.key === tab) || TABS[1];

  const load = useCallback(async () => {
    if (!currentTab?.endpoint) {
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
        // current static stock levels
      } else if (tab === 'stock_balance') {
        if (from) params.from = from;
        if (to)   params.to   = to;
        if (selectedCategory && selectedCategory !== 'all') params.category = selectedCategory;
        if (selectedStatus && selectedStatus !== 'all')     params.status   = selectedStatus;
        if (stockSearch.trim())                             params.search   = stockSearch.trim();
      } else {
        params = { from, to };
      }
      const res = await api.get(currentTab.endpoint, { params });
      setData(res.data);
    } finally { setLoading(false); }
  }, [tab, date, from, to, selectedCategory, selectedStatus, stockSearch, currentTab]);

  useEffect(() => {
    load();
  }, [load]);

  // Handler for quick date presets
  const applyPreset = (preset) => {
    setActivePreset(preset);
    if (preset === 'today') {
      setFrom(todayStr());
      setTo(todayStr());
    } else if (preset === 'week') {
      setFrom(startOfWeekStr());
      setTo(todayStr());
    } else if (preset === 'month') {
      setFrom(startOfMonthStr());
      setTo(todayStr());
    } else if (preset === 'all') {
      setFrom('');
      setTo('');
    }
  };

  // Open Item Ledger Modal
  const openItemLedger = async (material) => {
    setSelectedLedgerMaterial(material);
    setLedgerLoading(true);
    setLedgerData(null);
    try {
      const res = await api.get(`/reports/stock-balance/ledger/${material._id}`, {
        params: {
          from: from || undefined,
          to: to || undefined,
        },
      });
      setLedgerData(res.data);
    } catch (err) {
      console.error('Failed to load item ledger', err);
    } finally {
      setLedgerLoading(false);
    }
  };

  const printDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Build flat export data from whatever is currently loaded
  const exportData = useMemo(() => {
    if (!data) return [];
    if (tab === 'stock_balance' && data.items) {
      return data.items.map(m => ({
        'Item Code':        m.code || '—',
        'Material Name':    m.name,
        'Category':         m.category,
        'Unit':             m.unit,
        'Opening Qty':      m.openingStock,
        'Opening Val (ETB)': m.openingValue.toFixed(2),
        'Cash GRV In':      m.cashGrvQty,
        'Credit GRV In':    m.creditGrvQty,
        'Fresh Bazaar In':  m.freshBazaarQty,
        '+ve Adj In':       m.posAdjQty,
        'Total In Qty':     m.totalInQty,
        'Total In (ETB)':   m.totalInCost.toFixed(2),
        '−ve Adj Out':      m.negAdjQty,
        'Disposal Out':     m.disposalQty,
        'Sales Out':        m.salesImportQty,
        'Total Out Qty':    m.totalOutQty,
        'Total Out (ETB)':  m.totalOutCost.toFixed(2),
        'Closing Balance':  m.closingStock,
        'Unit Cost (ETB)':  m.unitCost.toFixed(2),
        'Closing Val (ETB)': m.closingValue.toFixed(2),
        'Status':           m.status.replace('_', ' ').toUpperCase(),
      }));
    }
    if (tab === 'stock' && data.materials) {
      return data.materials.map(m => ({
        'Material':         m.name,
        'Category':         m.category || '',
        'In Stock':         `${m.currentStock} ${m.unit}`,
        'Reorder At':       `${m.reorderLevel} ${m.unit}`,
        'Unit Cost (ETB)':  Number(m.unitCost || 0).toFixed(2),
        'Value (ETB)':      (m.currentStock * m.unitCost).toFixed(2),
        'Status':           m.status,
      }));
    }
    if (tab === 'purchases' && data.purchases) {
      return data.purchases.map(p => ({
        'Date':             new Date(p.purchaseDate).toLocaleDateString(),
        'Supplier':         p.supplier?.name || '—',
        'Items':            p.items?.length ?? 0,
        'Total (ETB)':      Number(p.totalAmount || 0).toFixed(2),
        'Status':           p.status,
      }));
    }
    const txns = data.transactions || [];
    return txns.map(t => ({
      'Date':               new Date(t.date).toLocaleString(),
      'Voucher':            t.voucherNo || '—',
      'Type':               VOUCHER_LABELS[t.voucherType] || t.voucherType || '—',
      'Material':           t.material?.name || t.items?.[0]?.material?.name || '—',
      'Qty':                t.quantity ?? '',
      'Total (ETB)':        Number(t.totalAmount || 0).toFixed(2),
      'By':                 t.performedBy?.name || '—',
    }));
  }, [data, tab]);

  return (
    <div id="print-area" className="space-y-4">

      {/* ── Print-only header ── */}
      <div id="print-header" style={{ display: 'none' }}>
        <h1>{hotelName}</h1>
        <p>{currentTab?.label ?? 'Report'} &mdash; Printed on {printDate}</p>
        {from && to && <p>Period: {from} to {to}</p>}
      </div>

      {/* ── Page heading (from sidebar nav) ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900 flex items-center gap-2">
            {tab === 'stock_balance' && <Scale className="h-6 w-6 text-emerald-600" />}
            {currentTab?.label ?? 'Reports'}
          </h1>
          <p className="text-xs text-ink-500 mt-0.5">
            {tab === 'stock_balance'
              ? 'Complete Stock Balance & Movement Ledger — Opening + Received (Cash/Credit/Bazaar/PADJ) − Issued (Disposal/NADJ/Sales) = Closing'
              : 'Detailed inventory and transaction reports'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportDropdown
            data={exportData}
            fileName={`report_${tab}`}
            sheetName={currentTab?.label || 'Report'}
            pdfTitle={currentTab?.label || 'Report'}
            pdfColumns={exportData[0]
              ? Object.keys(exportData[0]).map(k => ({ header: k, accessor: k }))
              : []
            }
          />
          <Button variant="ghost" className="border border-ink-200" onClick={() => window.print()}>
            <Printer size={15} /> Print
          </Button>
        </div>
      </div>

      {/* ── Filter bar for Stock Balance ── */}
      {tab === 'stock_balance' && (
        <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Date Preset Buttons */}
            <div className="flex items-center gap-1.5 p-1 bg-ink-50 rounded-xl border border-ink-100 text-xs font-semibold">
              <button
                type="button"
                onClick={() => applyPreset('month')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activePreset === 'month' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => applyPreset('week')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activePreset === 'week' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                This Week
              </button>
              <button
                type="button"
                onClick={() => applyPreset('today')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activePreset === 'today' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => applyPreset('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activePreset === 'all' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                All Time
              </button>
            </div>

            {/* Custom Date Pickers */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="flex items-center gap-1.5 text-ink-600 font-medium">
                <span>From</span>
                <input
                  type="date"
                  value={from}
                  onChange={e => { setFrom(e.target.value); setActivePreset('custom'); }}
                  className="rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500 bg-white"
                />
              </label>
              <label className="flex items-center gap-1.5 text-ink-600 font-medium">
                <span>To</span>
                <input
                  type="date"
                  value={to}
                  onChange={e => { setTo(e.target.value); setActivePreset('custom'); }}
                  className="rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500 bg-white"
                />
              </label>
              <button
                type="button"
                onClick={() => load()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-ink-100 hover:bg-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-800 transition"
                title="Refresh stock balance"
              >
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
          </div>

          {/* Secondary Filters: Search, Category, Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-ink-50">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-400" />
              <input
                type="text"
                placeholder="Search material code or name..."
                value={stockSearch}
                onChange={e => setStockSearch(e.target.value)}
                className="w-full rounded-xl border border-ink-200 pl-9 pr-3 py-2 text-xs outline-none focus:border-emerald-500"
              />
              {stockSearch && (
                <button
                  type="button"
                  onClick={() => setStockSearch('')}
                  className="absolute right-3 top-2.5 text-ink-400 hover:text-ink-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="w-full rounded-xl border border-ink-200 px-3 py-2 text-xs outline-none focus:border-emerald-500 bg-white"
              >
                <option value="all">All Categories</option>
                {data?.categories?.filter(c => c !== 'all').map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="w-full rounded-xl border border-ink-200 px-3 py-2 text-xs outline-none focus:border-emerald-500 bg-white"
              >
                <option value="all">All Stock Statuses</option>
                <option value="in_stock">In Stock (Adequate)</option>
                <option value="low_stock">Low Stock (At/Below Reorder)</option>
                <option value="out_of_stock">Out of Stock (Zero / Negative)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── Standard Date filter bar for other tabs ── */}
      {tab !== 'stock_balance' && (
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
      )}

      {loading && (
        <div className="py-16 text-center text-sm text-ink-400">
          <RefreshCw className="animate-spin h-6 w-6 mx-auto mb-2 text-emerald-600" />
          Loading report data…
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          STOCK BALANCE SHEET (ALL OVER RECONCILIATION)
      ════════════════════════════════════════════════════════════════ */}
      {!loading && tab === 'stock_balance' && data && (
        <div className="space-y-4">
          {/* Top KPI Balance Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-l-4 border-l-slate-400">
              <p className="text-xs font-medium text-ink-500">Opening Stock Value</p>
              <p className="tabular mt-1 text-2xl font-bold text-ink-800">
                ETB {(data.totals?.openingValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-0.5 text-xs text-ink-400">Balance at {from || 'start of records'}</p>
            </Card>

            <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/20">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-emerald-800">Total Goods Received (+)</p>
                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">INWARD</span>
              </div>
              <p className="tabular mt-1 text-2xl font-bold text-emerald-700">
                + ETB {(data.totals?.inwardValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-0.5 text-xs text-emerald-600">Cash GRV + Credit GRV + Bazaar + PADJ</p>
            </Card>

            <Card className="border-l-4 border-l-rose-500 bg-rose-50/20">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-rose-800">Total Stock Issued / Out (−)</p>
                <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold">OUTWARD</span>
              </div>
              <p className="tabular mt-1 text-2xl font-bold text-rose-700">
                − ETB {(data.totals?.outwardValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-0.5 text-xs text-rose-600">Disposal + NADJ + Sales Deductions</p>
            </Card>

            <Card className="border-l-4 border-l-blue-600 bg-blue-50/30">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-blue-900">Closing Stock Balance (=)</p>
                <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">CLOSING ASSET</span>
              </div>
              <p className="tabular mt-1 text-2xl font-black text-blue-900">
                ETB {(data.totals?.closingValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-0.5 text-xs text-blue-700 font-medium">
                {data.count} items tracked &middot; As of {to || 'Today'}
              </p>
            </Card>
          </div>

          {/* Master Stock Balance Table */}
          <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white shadow-soft">
            <table className="min-w-full text-xs divide-y divide-ink-200">
              {/* Grouped Header Tier 1 */}
              <thead className="bg-ink-100/90 text-ink-700 font-bold">
                <tr>
                  <th colSpan={3} className="px-3 py-2 text-left border-r border-ink-200 uppercase tracking-wider text-[11px]">
                    Item Details
                  </th>
                  <th colSpan={2} className="px-3 py-2 text-center border-r border-ink-200 bg-slate-200/60 uppercase tracking-wider text-[11px] text-slate-800">
                    Opening Stock
                  </th>
                  <th colSpan={5} className="px-3 py-2 text-center border-r border-ink-200 bg-emerald-100/80 uppercase tracking-wider text-[11px] text-emerald-900">
                    Receipts / Inwards (+)
                  </th>
                  <th colSpan={4} className="px-3 py-2 text-center border-r border-ink-200 bg-rose-100/80 uppercase tracking-wider text-[11px] text-rose-900">
                    Issues / Outwards (−)
                  </th>
                  <th colSpan={4} className="px-3 py-2 text-center border-r border-ink-200 bg-blue-100/80 uppercase tracking-wider text-[11px] text-blue-900">
                    Closing Balance (=)
                  </th>
                  <th className="px-3 py-2 text-center uppercase tracking-wider text-[11px]">
                    Ledger
                  </th>
                </tr>
                {/* Header Tier 2 (Sub-columns) */}
                <tr className="bg-ink-50/90 text-ink-600 font-semibold border-t border-ink-200 text-[10.5px]">
                  <th className="px-3 py-2 text-left">Code</th>
                  <th className="px-3 py-2 text-left">Material Name</th>
                  <th className="px-3 py-2 text-left border-r border-ink-200">Unit</th>

                  {/* Opening */}
                  <th className="px-3 py-2 text-right bg-slate-50">Opening Qty</th>
                  <th className="px-3 py-2 text-right border-r border-ink-200 bg-slate-50">Opening Val (ETB)</th>

                  {/* Inwards */}
                  <th className="px-2.5 py-2 text-right bg-emerald-50/50">Cash GRV</th>
                  <th className="px-2.5 py-2 text-right bg-emerald-50/50">Credit GRV</th>
                  <th className="px-2.5 py-2 text-right bg-emerald-50/50">Bazaar</th>
                  <th className="px-2.5 py-2 text-right bg-emerald-50/50">+ve Adj</th>
                  <th className="px-3 py-2 text-right border-r border-ink-200 bg-emerald-100/70 font-bold text-emerald-900">Total In</th>

                  {/* Outwards */}
                  <th className="px-2.5 py-2 text-right bg-rose-50/50">−ve Adj</th>
                  <th className="px-2.5 py-2 text-right bg-rose-50/50">Disposal</th>
                  <th className="px-2.5 py-2 text-right bg-rose-50/50">Sales</th>
                  <th className="px-3 py-2 text-right border-r border-ink-200 bg-rose-100/70 font-bold text-rose-900">Total Out</th>

                  {/* Closing */}
                  <th className="px-3 py-2 text-right bg-blue-50/50 font-bold text-blue-900">Closing Qty</th>
                  <th className="px-2.5 py-2 text-right bg-blue-50/50">Unit Cost</th>
                  <th className="px-3 py-2 text-right bg-blue-100/70 font-black text-blue-950">Closing Val (ETB)</th>
                  <th className="px-3 py-2 text-center border-r border-ink-200 bg-blue-50/50">Status</th>

                  {/* Action */}
                  <th className="px-2 py-2 text-center">Bin Card</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-ink-100">
                {(!data.items || data.items.length === 0) && (
                  <tr>
                    <td colSpan={19} className="px-4 py-12 text-center text-ink-400">
                      No stock items matched the selected filters.
                    </td>
                  </tr>
                )}
                {data.items?.map((item) => (
                  <tr key={item._id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-3 py-2 font-mono text-[11px] text-ink-500 whitespace-nowrap">
                      {item.code || '—'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-medium text-ink-900">
                      <div className="flex items-center gap-1.5">
                        <span>{item.name}</span>
                        <span className="text-[10px] text-ink-400 bg-ink-100 px-1.5 py-0.2 rounded font-normal">
                          {item.category}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap border-r border-ink-200 text-ink-500 text-[11px]">
                      {item.unit}
                    </td>

                    {/* Opening */}
                    <td className="px-3 py-2 text-right tabular text-slate-700 bg-slate-50/40">
                      {item.openingStock.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right tabular border-r border-ink-200 text-slate-700 bg-slate-50/40">
                      {item.openingValue.toFixed(2)}
                    </td>

                    {/* Inwards */}
                    <td className="px-2.5 py-2 text-right tabular text-emerald-700 bg-emerald-50/20">
                      {item.cashGrvQty > 0 ? `+${item.cashGrvQty}` : '—'}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular text-indigo-700 bg-emerald-50/20">
                      {item.creditGrvQty > 0 ? `+${item.creditGrvQty}` : '—'}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular text-lime-700 bg-emerald-50/20">
                      {item.freshBazaarQty > 0 ? `+${item.freshBazaarQty}` : '—'}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular text-violet-700 bg-emerald-50/20">
                      {item.posAdjQty > 0 ? `+${item.posAdjQty}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular border-r border-ink-200 font-bold text-emerald-800 bg-emerald-100/50">
                      {item.totalInQty > 0 ? `+${item.totalInQty.toLocaleString()}` : '0'}
                    </td>

                    {/* Outwards */}
                    <td className="px-2.5 py-2 text-right tabular text-red-600 bg-rose-50/20">
                      {item.negAdjQty > 0 ? `−${item.negAdjQty}` : '—'}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular text-orange-600 bg-rose-50/20">
                      {item.disposalQty > 0 ? `−${item.disposalQty}` : '—'}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular text-purple-600 bg-rose-50/20">
                      {item.salesImportQty > 0 ? `−${item.salesImportQty}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular border-r border-ink-200 font-bold text-rose-800 bg-rose-100/50">
                      {item.totalOutQty > 0 ? `−${item.totalOutQty.toLocaleString()}` : '0'}
                    </td>

                    {/* Closing */}
                    <td className="px-3 py-2 text-right tabular font-bold text-blue-900 bg-blue-50/30">
                      {item.closingStock.toLocaleString()}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular text-ink-600 bg-blue-50/30 text-[11px]">
                      {item.unitCost.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right tabular font-black text-blue-950 bg-blue-100/60">
                      {item.closingValue.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-center border-r border-ink-200 bg-blue-50/30">
                      {item.status === 'out_of_stock' ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                          OUT
                        </span>
                      ) : item.status === 'low_stock' ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                          LOW
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                          OK
                        </span>
                      )}
                    </td>

                    {/* Action: Open Bin Card */}
                    <td className="px-2 py-2 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openItemLedger(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-white border border-ink-200 text-ink-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition shadow-2xs"
                        title="View chronological Bin Card / Item Ledger"
                      >
                        <History size={12} /> Ledger
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Table Footer: Total Row */}
              {data.items?.length > 0 && (
                <tfoot className="bg-ink-100/90 font-bold border-t-2 border-ink-300 text-[11.5px]">
                  <tr>
                    <td colSpan={3} className="px-3 py-2.5 text-ink-900 border-r border-ink-200 font-extrabold uppercase">
                      Total ({data.count} items)
                    </td>
                    <td className="px-3 py-2.5 text-right tabular text-slate-800">
                      {data.items.reduce((s, i) => s + i.openingStock, 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular text-slate-900 border-r border-ink-200 font-extrabold">
                      {(data.totals?.openingValue || 0).toFixed(2)}
                    </td>

                    <td colSpan={4} className="px-2 py-2.5 text-center text-emerald-800 text-[10.5px]">
                      Inward Total
                    </td>
                    <td className="px-3 py-2.5 text-right tabular text-emerald-950 font-extrabold border-r border-ink-200 bg-emerald-100">
                      +{(data.totals?.inwardValue || 0).toFixed(2)}
                    </td>

                    <td colSpan={3} className="px-2 py-2.5 text-center text-rose-800 text-[10.5px]">
                      Outward Total
                    </td>
                    <td className="px-3 py-2.5 text-right tabular text-rose-950 font-extrabold border-r border-ink-200 bg-rose-100">
                      −{(data.totals?.outwardValue || 0).toFixed(2)}
                    </td>

                    <td className="px-3 py-2.5 text-right tabular text-blue-900 font-extrabold">
                      {data.items.reduce((s, i) => s + i.closingStock, 0).toLocaleString()}
                    </td>
                    <td className="px-2.5 py-2.5 text-center text-ink-400">—</td>
                    <td className="px-3 py-2.5 text-right tabular text-blue-950 font-black bg-blue-100 border-r border-ink-200 text-sm">
                      {(data.totals?.closingValue || 0).toFixed(2)}
                    </td>
                    <td colSpan={2} className="px-2 py-2.5 text-center text-[10px] text-ink-500">
                      ETB
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          ITEM LEDGER / BIN CARD MODAL
      ════════════════════════════════════════════════════════════════ */}
      {selectedLedgerMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4 bg-ink-50/70">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-ink-900 flex items-center gap-2">
                    <span>{selectedLedgerMaterial.name}</span>
                    <span className="font-mono text-xs font-normal text-ink-500 bg-ink-200/60 px-2 py-0.5 rounded">
                      {selectedLedgerMaterial.code || 'NO-CODE'}
                    </span>
                  </h3>
                  <p className="text-xs text-ink-500 mt-0.5">
                    Category: <span className="font-medium text-ink-700">{selectedLedgerMaterial.category}</span> &middot; Unit: <span className="font-medium text-ink-700">{selectedLedgerMaterial.unit}</span> &middot; Unit Cost: <span className="font-medium text-ink-700">ETB {Number(selectedLedgerMaterial.unitCost || 0).toFixed(2)}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLedgerMaterial(null)}
                className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {ledgerLoading && (
                <div className="py-12 text-center text-sm text-ink-400">
                  <RefreshCw className="animate-spin h-5 w-5 mx-auto mb-2 text-emerald-600" />
                  Loading chronological ledger records…
                </div>
              )}

              {!ledgerLoading && ledgerData && (
                <>
                  <div className="flex items-center justify-between text-xs text-ink-500 bg-ink-50 p-3 rounded-xl border border-ink-100">
                    <div>
                      Period: <span className="font-semibold text-ink-800">{from || 'Beginning'}</span> to <span className="font-semibold text-ink-800">{to || 'Today'}</span>
                    </div>
                    <div>
                      Total Movement Events: <span className="font-bold text-ink-900">{ledgerData.count}</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-ink-100 bg-white">
                    <table className="min-w-full text-xs divide-y divide-ink-100">
                      <thead className="bg-ink-50/70 font-semibold text-ink-600">
                        <tr>
                          <th className="px-3 py-2.5 text-left">Date & Time</th>
                          <th className="px-3 py-2.5 text-left">Voucher #</th>
                          <th className="px-3 py-2.5 text-left">Voucher Type</th>
                          <th className="px-3 py-2.5 text-left">Party / Reason</th>
                          <th className="px-3 py-2.5 text-right text-emerald-700">In (+)</th>
                          <th className="px-3 py-2.5 text-right text-rose-700">Out (−)</th>
                          <th className="px-3 py-2.5 text-right font-bold text-ink-900">Running Bal</th>
                          <th className="px-3 py-2.5 text-left">Handled By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-50">
                        {ledgerData.ledger?.length === 0 && (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-ink-400">
                              No movement history found for this item.
                            </td>
                          </tr>
                        )}
                        {ledgerData.ledger?.map((row, idx) => (
                          <tr key={idx} className="hover:bg-ink-50/50">
                            <td className="px-3 py-2 whitespace-nowrap text-ink-600">
                              {new Date(row.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td className="px-3 py-2 font-mono text-[11px] font-medium text-ink-800 whitespace-nowrap">
                              {row.voucherNo}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                ['cash_grv','credit_grv','fresh_bazaar','pos_adjustment'].includes(row.voucherType)
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}>
                                {VOUCHER_LABELS[row.voucherType] || row.voucherType}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-ink-600 max-w-[180px] truncate" title={row.supplier !== '—' ? row.supplier : row.reason}>
                              {row.supplier !== '—' ? row.supplier : row.reason}
                            </td>
                            <td className="px-3 py-2 text-right tabular font-semibold text-emerald-700 whitespace-nowrap">
                              {row.inQty > 0 ? `+${row.inQty}` : '—'}
                            </td>
                            <td className="px-3 py-2 text-right tabular font-semibold text-rose-700 whitespace-nowrap">
                              {row.outQty > 0 ? `−${row.outQty}` : '—'}
                            </td>
                            <td className="px-3 py-2 text-right tabular font-bold text-ink-900 bg-ink-50/30 whitespace-nowrap">
                              {row.balanceAfter} {selectedLedgerMaterial.unit}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-ink-500">
                              {row.performedBy}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end border-t border-ink-100 px-6 py-3 bg-ink-50">
              <Button variant="secondary" onClick={() => setSelectedLedgerMaterial(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat label="Vouchers"     value={data.count} />
            <Stat label="Total Amount" value={`ETB ${(data.totalAmount || 0).toFixed(2)}`}
              color={['disposal','neg_adjustment'].includes(tab) ? 'text-red-700' : 'text-emerald-700'} />
            <Stat label="Total Qty moved" value={(data.totalQty || 0).toFixed(3)} />
          </div>

          {data.materialBreakdown?.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-ink-600">Material Breakdown</p>
              <MaterialBreakdown data={data.materialBreakdown} />
            </div>
          )}

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
            <Stat label="Total purchases" value={data.count} />
            <Stat label="Total value"     value={`ETB ${(data.totalAmount || 0).toFixed(2)}`} color="text-blue-700" />
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
