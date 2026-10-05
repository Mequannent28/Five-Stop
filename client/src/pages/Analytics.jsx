import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import ExportDropdown from '../components/ui/ExportDropdown';
import {
  TrendingUp, TrendingDown, DollarSign, PieChart as PieChartIcon,
  BarChart3, Calendar, Layers, AlertTriangle, CheckCircle2,
  Package, Search, RefreshCw, Eye, Trash2, ArrowUpRight,
  Flame, Sparkles, Filter, ChevronRight, ChevronDown, Download
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, BarChart, Bar, Legend
} from 'recharts';

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('pl'); // 'pl' | 'consumption' | 'prediction' | 'records'
  const [dateRange, setDateRange] = useState('30d'); // 'today' | '7d' | '30d' | 'all' | 'custom'
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loading, setLoading] = useState(false);

  // Data states
  const [plData, setPlData] = useState(null);
  const [consumptionData, setConsumptionData] = useState(null);
  const [predictionData, setPredictionData] = useState(null);
  const [recordsData, setRecordsData] = useState([]);

  // Selected item / modal
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [expandedProduct, setExpandedProduct] = useState(null);
  const [productFilter, setProductFilter] = useState('');
  const [matrixFilter, setMatrixFilter] = useState('ALL'); // 'ALL' | 'Star' | 'Workhorse' | 'Puzzle' | 'Dog'
  const [ingredientFilter, setIngredientFilter] = useState('');

  // Calculate actual from/to dates based on dateRange preset
  const dateParams = useMemo(() => {
    const now = new Date();
    let from = null;
    let to = null;

    if (dateRange === 'today') {
      from = now.toISOString().slice(0, 10);
      to = from;
    } else if (dateRange === '7d') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      from = d.toISOString().slice(0, 10);
      to = now.toISOString().slice(0, 10);
    } else if (dateRange === '30d') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      from = d.toISOString().slice(0, 10);
      to = now.toISOString().slice(0, 10);
    } else if (dateRange === 'custom') {
      from = customFrom || null;
      to = customTo || null;
    }
    return { from, to };
  }, [dateRange, customFrom, customTo]);

  const fetchData = async () => {
    setLoading(true);
    const { from, to } = dateParams;
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;

    try {
      if (activeTab === 'pl') {
        const res = await api.get('/analytics/pl', { params });
        setPlData(res.data);
      } else if (activeTab === 'consumption') {
        const res = await api.get('/analytics/consumption', { params });
        setConsumptionData(res.data);
      } else if (activeTab === 'prediction') {
        const res = await api.get('/analytics/prediction');
        setPredictionData(res.data);
      } else if (activeTab === 'records') {
        const res = await api.get('/analytics/records', { params });
        setRecordsData(res.data);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, dateParams]);

  const handleDeleteRecord = async (id) => {
    if (!window.confirm('Are you sure you want to delete this sales import batch?')) return;
    try {
      await api.delete(`/analytics/records/${id}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete record');
    }
  };

  const fmt = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (n) => `${(Number(n) || 0).toFixed(1)}%`;

  // ── Export data by active tab ──
  const exportData = useMemo(() => {
    if (activeTab === 'pl' && plData) {
      return (plData.products || []).map(p => ({
        'Product':      p.name,
        'Units Sold':   p.unitsSold ?? 0,
        'Revenue (ETB)': Number(p.revenue || 0).toFixed(2),
        'COGS (ETB)':   Number(p.cogs || 0).toFixed(2),
        'Gross Profit (ETB)': Number((p.revenue || 0) - (p.cogs || 0)).toFixed(2),
        'Food Cost %':  Number(p.foodCostPct || 0).toFixed(1) + '%',
        'Margin %':     Number(p.marginPct || 0).toFixed(1) + '%',
      }));
    }
    if (activeTab === 'consumption' && consumptionData) {
      return (consumptionData.materials || []).map(m => ({
        'Material':       m.name,
        'Unit':           m.unit || '',
        'Total Consumed': Number(m.totalConsumed || 0).toFixed(3),
        'Total Cost (ETB)': Number(m.totalCost || 0).toFixed(2),
        'Avg per Day':    Number(m.avgPerDay || 0).toFixed(3),
      }));
    }
    if (activeTab === 'prediction' && predictionData) {
      return (predictionData.predictions || []).map(p => ({
        'Material':         p.name,
        'Unit':             p.unit || '',
        'Current Stock':    Number(p.currentStock || 0).toFixed(2),
        'Avg Daily Use':    Number(p.avgDailyUse || 0).toFixed(3),
        'Days Remaining':   Number(p.daysRemaining || 0).toFixed(1),
        'Reorder Qty':      Number(p.reorderQty || 0).toFixed(2),
        'Status':           p.status || '',
      }));
    }
    if (activeTab === 'records') {
      return recordsData.map(r => ({
        'Date':           new Date(r.importedAt || r.createdAt).toLocaleDateString(),
        'Product':        r.productName || '—',
        'Units Sold':     r.unitsSold ?? 0,
        'Revenue (ETB)':  Number(r.revenue || 0).toFixed(2),
        'Imported By':    r.importedBy?.name || '—',
      }));
    }
    return [];
  }, [activeTab, plData, consumptionData, predictionData, recordsData]);

  return (
    <div className="space-y-6 pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md">
              <TrendingUp size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-ink-900">
                P&amp;L &amp; Stock Analytics
              </h1>
              <p className="text-xs text-ink-500 font-medium">
                International Hotel &amp; Restaurant Standard · POS Sales, Recipe COGS, Food Cost % &amp; Par Predictions
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Preset range filters */}
          {activeTab !== 'prediction' && (
            <div className="inline-flex rounded-xl bg-ink-100/70 p-1 text-xs font-semibold text-ink-600">
              {[
                { id: 'today', label: 'Today' },
                { id: '7d', label: '7 Days' },
                { id: '30d', label: '30 Days' },
                { id: 'all', label: 'All Time' },
                { id: 'custom', label: 'Custom' },
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setDateRange(btn.id)}
                  className={`rounded-lg px-3 py-1.5 transition ${
                    dateRange === btn.id
                      ? 'bg-white text-ink-900 shadow-sm font-bold'
                      : 'hover:text-ink-900'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          )}

          <Button
            variant="outline"
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs py-2"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          <ExportDropdown
            data={exportData}
            fileName={`analytics_${activeTab}`}
            sheetName={activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            pdfTitle={`Analytics — ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
            pdfColumns={exportData[0]
              ? Object.keys(exportData[0]).map(k => ({ header: k, accessor: k }))
              : []
            }
          />
        </div>
      </div>

      {/* Custom Date Range Picker */}
      {dateRange === 'custom' && activeTab !== 'prediction' && (
        <Card className="p-3">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="font-bold text-ink-700">Custom Date Range:</span>
            <div className="flex items-center gap-2">
              <label className="text-ink-500">From:</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-ink-200 px-2 py-1 text-xs outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-ink-500">To:</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-ink-200 px-2 py-1 text-xs outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </Card>
      )}

      {/* ── Navigation Tabs ── */}
      <div className="border-b border-ink-200 flex gap-2 overflow-x-auto text-sm">
        {[
          { id: 'pl', label: 'Profit & Loss (P&L)', icon: DollarSign },
          { id: 'consumption', label: 'Ingredient Consumption', icon: Layers },
          { id: 'prediction', label: 'AI & Par-Level Prediction', icon: Sparkles },
          { id: 'records', label: 'Imported POS Batches', icon: Calendar },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 font-semibold transition whitespace-nowrap ${
                isActive
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent text-ink-500 hover:text-ink-800'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 1: PROFIT & LOSS (P&L) STATEMENT
         ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'pl' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            <div className="rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50/60 to-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Total Revenue</p>
              <p className="mt-1 text-xl font-extrabold text-ink-900">
                ETB {fmt(plData?.summary?.totalRevenue)}
              </p>
              <p className="mt-1 text-[11px] text-ink-400">Gross POS Sales</p>
            </div>

            <div className="rounded-2xl border border-orange-100 bg-gradient-to-b from-orange-50/60 to-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-orange-600">Total COGS</p>
              <p className="mt-1 text-xl font-extrabold text-orange-700">
                ETB {fmt(plData?.summary?.totalCOGS)}
              </p>
              <p className="mt-1 text-[11px] text-ink-400">Raw Ingredients Cost</p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50/60 to-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Gross Profit</p>
              <p className={`mt-1 text-xl font-extrabold ${(plData?.summary?.grossProfit || 0) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                ETB {fmt(plData?.summary?.grossProfit)}
              </p>
              <p className="mt-1 text-[11px] text-ink-400">Revenue minus COGS</p>
            </div>

            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-b from-indigo-50/60 to-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Gross Margin</p>
              <p className="mt-1 text-xl font-extrabold text-indigo-700">
                {pct(plData?.summary?.profitMargin)}
              </p>
              <p className="mt-1 text-[11px] text-ink-400">Profitability ratio</p>
            </div>

            <div className="rounded-2xl border border-violet-100 bg-gradient-to-b from-violet-50/60 to-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-violet-600">Food Cost %</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  (plData?.summary?.foodCostPct || 0) <= 35 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                }`}>
                  {(plData?.summary?.foodCostPct || 0) <= 35 ? 'Optimal' : 'High'}
                </span>
              </div>
              <p className="mt-1 text-xl font-extrabold text-violet-800">
                {pct(plData?.summary?.foodCostPct)}
              </p>
              <p className="mt-1 text-[11px] text-ink-400">Target: 28% – 35%</p>
            </div>

            <div className="rounded-2xl border border-ink-100 bg-gradient-to-b from-ink-50/60 to-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">Items Sold</p>
              <p className="mt-1 text-xl font-extrabold text-ink-800">
                {plData?.summary?.totalItemsSold || 0}
              </p>
              <p className="mt-1 text-[11px] text-ink-400">{plData?.summary?.recordCount || 0} POS Batches</p>
            </div>
          </div>

          {/* Daily Trend Chart */}
          <Card>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div>
                <h3 className="font-bold text-ink-900 text-base">Revenue vs. Ingredient Cost Trend</h3>
                <p className="text-xs text-ink-400">Daily performance breakdown from imported POS transactions</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-blue-500 inline-block" /> Revenue</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-orange-400 inline-block" /> COGS (Cost)</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-emerald-500 inline-block" /> Gross Profit</span>
              </div>
            </div>

            {plData?.dailyTrend && plData.dailyTrend.length > 0 ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={plData.dailyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorCogs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(val) => `ETB ${fmt(val)}`}
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" name="Revenue" />
                    <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" name="Gross Profit" />
                    <Area type="monotone" dataKey="cogs" stroke="#f97316" strokeWidth={1.5} fillOpacity={1} fill="url(#colorCogs)" name="COGS" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center rounded-xl bg-ink-50 text-xs text-ink-400">
                No sales records found for this period. Import a POS Excel file to view the trend.
              </div>
            )}
          </Card>

          {/* Menu Engineering & Product P&L Matrix */}
          <Card>
            <div className="flex flex-col gap-3 border-b border-ink-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-ink-900 text-base">Menu Engineering &amp; Profit Matrix</h3>
                  <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                    Kasavana &amp; Smith Standard
                  </span>
                </div>
                <p className="text-xs text-ink-400">
                  Itemized profitability, recipe food cost percentage, and popularity analysis
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-2.5 text-ink-400" />
                  <input
                    type="text"
                    placeholder="Search product..."
                    value={productFilter}
                    onChange={(e) => setProductFilter(e.target.value)}
                    className="rounded-xl border border-ink-200 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-blue-500 w-40 sm:w-48"
                  />
                </div>

                <select
                  value={matrixFilter}
                  onChange={(e) => setMatrixFilter(e.target.value)}
                  className="rounded-xl border border-ink-200 py-1.5 px-3 text-xs outline-none focus:border-blue-500 bg-white"
                >
                  <option value="ALL">All Categories</option>
                  <option value="Star">⭐ Stars (High Volume, High Profit)</option>
                  <option value="Workhorse">🐎 Workhorses (High Volume, Low Profit)</option>
                  <option value="Puzzle">🧩 Puzzles (Low Volume, High Profit)</option>
                  <option value="Dog">🐕 Dogs (Low Volume, Low Profit)</option>
                </select>
              </div>
            </div>

            {/* Matrix Legend Badges */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 py-3 border-b border-ink-50 text-[11px]">
              <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50/70 p-2 rounded-lg">
                <span className="text-base">⭐</span>
                <div>
                  <p className="font-bold">Stars</p>
                  <p className="text-[10px] text-emerald-600">High Profit &amp; High Popularity</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-blue-800 bg-blue-50/70 p-2 rounded-lg">
                <span className="text-base">🐎</span>
                <div>
                  <p className="font-bold">Workhorses</p>
                  <p className="text-[10px] text-blue-600">High Volume, Lower Margin</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-amber-800 bg-amber-50/70 p-2 rounded-lg">
                <span className="text-base">🧩</span>
                <div>
                  <p className="font-bold">Puzzles</p>
                  <p className="text-[10px] text-amber-600">High Margin, Needs Promotion</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-red-800 bg-red-50/70 p-2 rounded-lg">
                <span className="text-base">🐕</span>
                <div>
                  <p className="font-bold">Dogs</p>
                  <p className="text-[10px] text-red-600">Low Margin &amp; Low Volume</p>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto mt-2">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-ink-100 bg-ink-50/60 text-left font-bold text-ink-600">
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">Qty Sold</th>
                    <th className="py-2.5 px-3 text-right">Avg Selling Price</th>
                    <th className="py-2.5 px-3 text-right">Recipe COGS</th>
                    <th className="py-2.5 px-3 text-right">Total Revenue</th>
                    <th className="py-2.5 px-3 text-right">Gross Profit</th>
                    <th className="py-2.5 px-3 text-right">Food Cost %</th>
                    <th className="py-2.5 px-3 text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50 text-ink-700">
                  {plData?.productBreakdown
                    ?.filter((p) => {
                      if (productFilter && !p.productName.toLowerCase().includes(productFilter.toLowerCase())) return false;
                      if (matrixFilter !== 'ALL' && p.matrixClass !== matrixFilter) return false;
                      return true;
                    })
                    .map((item, idx) => {
                      const badgeMap = {
                        Star: { bg: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: '⭐', label: 'Star' },
                        Workhorse: { bg: 'bg-blue-100 text-blue-800 border-blue-200', icon: '🐎', label: 'Workhorse' },
                        Puzzle: { bg: 'bg-amber-100 text-amber-800 border-amber-200', icon: '🧩', label: 'Puzzle' },
                        Dog: { bg: 'bg-rose-100 text-rose-800 border-rose-200', icon: '🐕', label: 'Dog' },
                      };
                      const b = badgeMap[item.matrixClass] || badgeMap.Dog;
                      return (
                        <tr key={idx} className="hover:bg-ink-50/40 transition">
                          <td className="py-3 px-3 font-bold text-ink-900">{item.productName}</td>
                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${b.bg}`}>
                              <span>{b.icon}</span> {b.label}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-medium">{item.qty}</td>
                          <td className="py-3 px-3 text-right font-mono">ETB {fmt(item.avgPrice)}</td>
                          <td className="py-3 px-3 text-right font-mono text-orange-600">ETB {fmt(item.unitCogs)}</td>
                          <td className="py-3 px-3 text-right font-mono font-semibold">ETB {fmt(item.revenue)}</td>
                          <td className={`py-3 px-3 text-right font-mono font-bold ${item.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            ETB {fmt(item.profit)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono">
                            <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                              item.costRatio <= 35 ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'
                            }`}>
                              {pct(item.costRatio)}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-indigo-700">
                            {pct(item.margin)}
                          </td>
                        </tr>
                      );
                    })}
                  {(!plData?.productBreakdown || plData.productBreakdown.length === 0) && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-xs text-ink-400">
                        No product breakdown data available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 2: INGREDIENT CONSUMPTION ("ONE PRODUCT HOW MUCH CONSUMED")
         ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'consumption' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
            <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
              <Layers size={18} /> Recipe Ingredient Consumption Breakdown
            </h3>
            <p className="text-xs text-blue-700 mt-1">
              Analyze how each POS product consumed raw materials from inventory based on recipe yields. Click on any product below to expand its precise recipe and ingredient deduction details.
            </p>
          </div>

          {/* Product-by-Product Recipe Consumption Drilldown */}
          <Card>
            <div className="flex flex-col gap-3 border-b border-ink-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold text-ink-900 text-base">One Product → Ingredients Consumed</h3>
                <p className="text-xs text-ink-400">
                  Exact recipe deduction per unit and aggregate consumption for each sold item
                </p>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-ink-400" />
                <input
                  type="text"
                  placeholder="Filter product..."
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                  className="rounded-xl border border-ink-200 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-blue-500 w-52"
                />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {consumptionData?.productConsumption
                ?.filter((p) => !productFilter || p.productName.toLowerCase().includes(productFilter.toLowerCase()))
                .map((prod, idx) => {
                  const isExpanded = expandedProduct === prod.productName;
                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-ink-100 transition overflow-hidden"
                    >
                      <button
                        onClick={() => setExpandedProduct(isExpanded ? null : prod.productName)}
                        className={`w-full flex items-center justify-between p-3.5 text-left transition ${
                          isExpanded ? 'bg-ink-50/80 font-bold' : 'hover:bg-ink-50/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700 text-xs font-bold">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="text-sm font-bold text-ink-900">{prod.productName}</p>
                            <p className="text-[11px] text-ink-400">
                              {prod.qtySold} units sold · Revenue: ETB {fmt(prod.revenue)} · Margin: {pct(prod.margin)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs">
                          <div className="text-right hidden sm:block">
                            <p className="text-[11px] text-ink-400">Total Ingredient Cost</p>
                            <p className="font-mono font-bold text-orange-600">ETB {fmt(prod.totalIngredientCost)}</p>
                          </div>
                          {isExpanded ? <ChevronDown size={18} className="text-ink-400" /> : <ChevronRight size={18} className="text-ink-400" />}
                        </div>
                      </button>

                      {/* Expanded Recipe Breakdown */}
                      {isExpanded && (
                        <div className="border-t border-ink-100 bg-white p-4">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-xs font-bold text-ink-700">
                              Recipe Consumption for "{prod.productName}" ({prod.ingredients.length} ingredients)
                            </p>
                            <span className="text-[11px] text-ink-400">
                              Formula: 1 unit uses × units sold = Total stock deducted
                            </span>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="min-w-full text-xs">
                              <thead>
                                <tr className="border-b border-ink-100 bg-ink-50/50 text-left font-semibold text-ink-600">
                                  <th className="py-2 px-3">Ingredient (Raw Material)</th>
                                  <th className="py-2 px-3 text-right">Per 1 Unit Uses</th>
                                  <th className="py-2 px-3 text-right">Total Deducted (All Sales)</th>
                                  <th className="py-2 px-3 text-right">Raw Material Unit Cost</th>
                                  <th className="py-2 px-3 text-right">Total Ingredient Cost</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-ink-50 text-ink-700">
                                {prod.ingredients.map((ing, iIdx) => (
                                  <tr key={iIdx} className="hover:bg-blue-50/20">
                                    <td className="py-2 px-3 font-semibold text-ink-900">{ing.materialName}</td>
                                    <td className="py-2 px-3 text-right font-mono text-ink-600">
                                      {ing.perUnitQuantity.toFixed(3)} {ing.unit}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono font-bold text-blue-700">
                                      {ing.totalUsed.toFixed(2)} {ing.unit}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono">
                                      ETB {fmt(ing.unitCost)} / {ing.unit}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono font-bold text-orange-600">
                                      ETB {fmt(ing.totalCost)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              {(!consumptionData?.productConsumption || consumptionData.productConsumption.length === 0) && (
                <div className="py-8 text-center text-xs text-ink-400">
                  No recipe consumption records available.
                </div>
              )}
            </div>
          </Card>

          {/* Aggregate Raw Materials Depletion Leaderboard */}
          <Card>
            <div className="flex flex-col gap-3 border-b border-ink-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold text-ink-900 text-base">Total Stock Depletion Leaderboard</h3>
                <p className="text-xs text-ink-400">
                  Highest consumed raw materials across all recipes during this period
                </p>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-ink-400" />
                <input
                  type="text"
                  placeholder="Search ingredient..."
                  value={ingredientFilter}
                  onChange={(e) => setIngredientFilter(e.target.value)}
                  className="rounded-xl border border-ink-200 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-blue-500 w-48"
                />
              </div>
            </div>

            <div className="overflow-x-auto mt-2">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-ink-100 bg-ink-50/60 text-left font-bold text-ink-600">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Raw Material</th>
                    <th className="py-2.5 px-3 text-right">Total Quantity Consumed</th>
                    <th className="py-2.5 px-3 text-right">Unit Cost</th>
                    <th className="py-2.5 px-3 text-right">Total Cost of Consumption</th>
                    <th className="py-2.5 px-3 text-right">Current Stock Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50 text-ink-700">
                  {consumptionData?.ingredients
                    ?.filter((ing) => !ingredientFilter || ing.materialName.toLowerCase().includes(ingredientFilter.toLowerCase()))
                    .map((ing, idx) => (
                      <tr key={idx} className="hover:bg-ink-50/40">
                        <td className="py-2.5 px-3 text-ink-400 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-ink-900">{ing.materialName}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-blue-700">
                          {Number(ing.totalQty).toFixed(2)} {ing.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-ink-600">
                          ETB {fmt(ing.unitCost)} / {ing.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-orange-600">
                          ETB {fmt(ing.totalCost)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium">
                          {ing.currentStock !== null ? `${ing.currentStock} ${ing.unit}` : '—'}
                        </td>
                      </tr>
                    ))}
                  {(!consumptionData?.ingredients || consumptionData.ingredients.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-ink-400">
                        No raw material depletion data available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 3: AI & PAR-LEVEL DEMAND PREDICTION
         ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'prediction' && (
        <div className="space-y-6">
          {/* Prediction Highlights */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-b from-indigo-50/60 to-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-indigo-700">
                <Sparkles size={18} />
                <p className="text-xs font-bold uppercase tracking-wider">Projected Daily Sales</p>
              </div>
              <p className="mt-2 text-2xl font-black text-ink-900">
                ETB {fmt(predictionData?.summary?.predictedDailyRevenue)}
              </p>
              <p className="mt-1 text-xs text-ink-400">
                Expected daily gross revenue based on 30-day velocity
              </p>
            </div>

            <div className="rounded-2xl border border-red-100 bg-gradient-to-b from-red-50/60 to-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle size={18} />
                <p className="text-xs font-bold uppercase tracking-wider">Critical Stockout Risk</p>
              </div>
              <p className="mt-2 text-2xl font-black text-red-700">
                {predictionData?.summary?.criticalItemsCount || 0} Materials
              </p>
              <p className="mt-1 text-xs text-ink-400">
                Will run out in less than 3 days at current sales pace!
              </p>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-gradient-to-b from-amber-50/60 to-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-amber-600">
                <Package size={18} />
                <p className="text-xs font-bold uppercase tracking-wider">Reorder Needed Soon</p>
              </div>
              <p className="mt-2 text-2xl font-black text-amber-700">
                {predictionData?.summary?.warningItemsCount || 0} Materials
              </p>
              <p className="mt-1 text-xs text-ink-400">
                Stock run-out projected within 3 to 7 days
              </p>
            </div>
          </div>

          {/* 7-Day Future Projections */}
          <Card>
            <h3 className="font-bold text-ink-900 text-base mb-1">7-Day Sales &amp; Profit Forecast</h3>
            <p className="text-xs text-ink-400 mb-4">
              Projected daily revenue, COGS, and gross profit using weighted 7-day moving averages
            </p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-7">
              {predictionData?.predictions?.map((day, idx) => (
                <div key={idx} className="rounded-xl border border-ink-100 bg-ink-50/50 p-3 text-center">
                  <p className="text-[11px] font-bold text-blue-600">{day.dayName}</p>
                  <p className="text-[10px] text-ink-400">{day.date.slice(5)}</p>
                  <div className="mt-2 border-t border-ink-100 pt-2">
                    <p className="text-[11px] font-mono font-bold text-ink-900">
                      ETB {fmt(day.predictedRevenue)}
                    </p>
                    <p className="text-[10px] font-mono text-emerald-600 font-semibold mt-0.5">
                      +ETB {fmt(day.predictedProfit)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Stock Coverage & Automated Reorder Suggestions */}
          <Card>
            <div className="border-b border-ink-100 pb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-ink-900 text-base">
                  Inventory Run-Out Forecast &amp; Suggested Par Reorders
                </h3>
                <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  Par Level: 14 Days
                </span>
              </div>
              <p className="text-xs text-ink-400 mt-1">
                Calculates days of stock remaining for each ingredient based on actual sales burn rate and recommends exact reorder quantities
              </p>
            </div>

            <div className="overflow-x-auto mt-2">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-ink-100 bg-ink-50/60 text-left font-bold text-ink-600">
                    <th className="py-2.5 px-3">Ingredient</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">Current Stock</th>
                    <th className="py-2.5 px-3 text-right">Daily Burn Rate</th>
                    <th className="py-2.5 px-3 text-center">Days Remaining</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Recommended Reorder (14d)</th>
                    <th className="py-2.5 px-3 text-right">Est. Reorder Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50 text-ink-700">
                  {predictionData?.stockCoverage?.map((item, idx) => {
                    const statusBadge = {
                      critical: { bg: 'bg-red-100 text-red-800 border-red-200', label: 'CRITICAL (<3d)' },
                      warning:  { bg: 'bg-amber-100 text-amber-800 border-amber-200', label: 'REORDER (3-7d)' },
                      ok:       { bg: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'HEALTHY (>7d)' },
                    }[item.status];

                    return (
                      <tr key={idx} className="hover:bg-ink-50/40">
                        <td className="py-3 px-3 font-bold text-ink-900">{item.materialName}</td>
                        <td className="py-3 px-3 text-ink-500">{item.category}</td>
                        <td className="py-3 px-3 text-right font-mono font-semibold">
                          {item.currentStock} {item.unit}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-ink-600">
                          {item.avgDailyUsage} {item.unit} / day
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold">
                          <span className={item.daysNum < 3 ? 'text-red-600' : item.daysNum < 7 ? 'text-amber-600' : 'text-emerald-600'}>
                            {item.daysRemaining} days
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusBadge.bg}`}>
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-blue-700">
                          {item.reorderSuggested > 0 ? `${item.reorderSuggested} ${item.unit}` : 'None needed'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-ink-900">
                          {item.estimatedCost > 0 ? `ETB ${fmt(item.estimatedCost)}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                  {(!predictionData?.stockCoverage || predictionData.stockCoverage.length === 0) && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-xs text-ink-400">
                        No active stock coverage predictions available yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 4: IMPORTED POS BATCHES (AUDIT TRAIL)
         ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'records' && (
        <Card>
          <div className="flex flex-col gap-3 border-b border-ink-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold text-ink-900 text-base">Imported POS Batches History</h3>
              <p className="text-xs text-ink-400">
                Log of all uploaded sales files, total revenues, ingredient deductions, and P&amp;L records
              </p>
            </div>
            <a
              href="/sales-import"
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow hover:bg-blue-700 transition"
            >
              + Import New POS Batch
            </a>
          </div>

          <div className="overflow-x-auto mt-2">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60 text-left font-bold text-ink-600">
                  <th className="py-2.5 px-3">Sale Date</th>
                  <th className="py-2.5 px-3">Reference / File</th>
                  <th className="py-2.5 px-3 text-right">Items Sold</th>
                  <th className="py-2.5 px-3 text-right">Total Revenue</th>
                  <th className="py-2.5 px-3 text-right">Total COGS</th>
                  <th className="py-2.5 px-3 text-right">Gross Profit</th>
                  <th className="py-2.5 px-3 text-right">Margin %</th>
                  <th className="py-2.5 px-3">Imported By</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50 text-ink-700">
                {recordsData.map((rec) => (
                  <tr key={rec._id} className="hover:bg-ink-50/40">
                    <td className="py-3 px-3 font-semibold text-ink-900">
                      {new Date(rec.saleDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-semibold text-ink-800">{rec.reference || 'POS Batch'}</p>
                      <p className="text-[10px] text-ink-400">{rec.notes}</p>
                    </td>
                    <td className="py-3 px-3 text-right font-medium">{rec.lines?.length || 0} lines</td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-blue-700">
                      ETB {fmt(rec.totalRevenue)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-orange-600">
                      ETB {fmt(rec.totalCOGS)}
                    </td>
                    <td className={`py-3 px-3 text-right font-mono font-bold ${rec.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      ETB {fmt(rec.grossProfit)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-indigo-700">
                      {pct(rec.profitMargin)}
                    </td>
                    <td className="py-3 px-3 text-ink-500">
                      {rec.importedBy?.name || 'System'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedRecord(rec)}
                          className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 transition"
                          title="View Batch Details"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteRecord(rec._id)}
                          className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 transition"
                          title="Delete Batch"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {recordsData.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-xs text-ink-400">
                      No POS sales batches have been imported yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Batch Details Modal ── */}
      {selectedRecord && (
        <Modal
          title={`Batch Details: ${selectedRecord.reference || 'POS Import'}`}
          onClose={() => setSelectedRecord(null)}
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4 bg-ink-50 p-3 rounded-xl">
              <div>
                <p className="text-ink-400">Sale Date:</p>
                <p className="font-bold text-ink-900">{new Date(selectedRecord.saleDate).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-ink-400">Total Revenue:</p>
                <p className="font-bold text-blue-700">ETB {fmt(selectedRecord.totalRevenue)}</p>
              </div>
              <div>
                <p className="text-ink-400">Total COGS:</p>
                <p className="font-bold text-orange-600">ETB {fmt(selectedRecord.totalCOGS)}</p>
              </div>
              <div>
                <p className="text-ink-400">Gross Profit:</p>
                <p className="font-bold text-emerald-600">ETB {fmt(selectedRecord.grossProfit)} ({pct(selectedRecord.profitMargin)})</p>
              </div>
            </div>

            <h4 className="text-xs font-bold text-ink-800">Sold Items &amp; Deducted Ingredients:</h4>
            <div className="divide-y divide-ink-100 rounded-xl border border-ink-100">
              {selectedRecord.lines?.map((line, lIdx) => (
                <div key={lIdx} className="p-3 text-xs">
                  <div className="flex items-center justify-between font-bold text-ink-900">
                    <span>{line.productName} (×{line.quantitySold})</span>
                    <span className="font-mono text-blue-700">ETB {fmt(line.revenue)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-ink-500">
                    <span>COGS: ETB {fmt(line.cogs)}</span>
                    <span className="text-emerald-600 font-semibold">Profit: ETB {fmt(line.grossProfit)}</span>
                  </div>

                  {line.ingredientsUsed?.length > 0 && (
                    <div className="mt-2 rounded-lg bg-ink-50/70 p-2 text-[10px] space-y-1">
                      <p className="font-bold text-ink-600">Ingredients Deducted:</p>
                      {line.ingredientsUsed.map((ing, iIdx) => (
                        <div key={iIdx} className="flex justify-between text-ink-700">
                          <span>• {ing.materialName}: {ing.quantityUsed} {ing.unit}</span>
                          <span className="font-mono">ETB {fmt(ing.totalCost)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
