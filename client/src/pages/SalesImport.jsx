import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import api from '../api/axios';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import {
  UploadCloud, CheckCircle, AlertTriangle, ArrowRight, XCircle,
  TrendingUp, Search, Download, FileSpreadsheet, Scale, Filter, X, ChevronDown, ChevronUp
} from 'lucide-react';

export default function SalesImport() {
  const [fileData, setFileData]           = useState(null);
  const [columns, setColumns]             = useState([]);
  const [productCol, setProductCol]       = useState('');
  const [productCodeCol, setProductCodeCol] = useState('');
  const [qtyCol, setQtyCol]               = useState('');
  const [revenueCol, setRevenueCol]       = useState('');
  const [dateCol, setDateCol]             = useState('');
  const [loading, setLoading]             = useState(false);
  const [result, setResult]               = useState(null);

  // Filters for the imported sold products list
  const [soldSearch, setSoldSearch]       = useState('');
  const [statusFilter, setStatusFilter]   = useState('all');
  const [expandedRow, setExpandedRow]     = useState(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb   = XLSX.read(evt.target.result, { type: 'binary' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);
      if (data.length > 0) {
        setFileData(data);
        const cols = Object.keys(data[0]);
        setColumns(cols);

        // Auto-detect columns intelligently
        const pCol = cols.find(c => /^(name|product.*name|item.*name)$/i.test(c.trim())) ||
                     cols.find(c => /product|item|name/i.test(c)) || '';
        const cCol = cols.find(c => /^(code|item.*code|product.*code|sku|barcode)$/i.test(c.trim())) ||
                     cols.find(c => /code|sku/i.test(c)) || '';
        const qCol = cols.find(c => /^(qty|quantity|count|sold)$/i.test(c.trim())) ||
                     cols.find(c => /qty|quantity|sold/i.test(c)) || '';
        const rCol = cols.find(c => /^(default.*value|total|revenue|amount|price|grand|rate|value)$/i.test(c.trim())) ||
                     cols.find(c => /default.*value|total|revenue|price|amount|grand/i.test(c)) || '';
        const dCol = cols.find(c => /date|time|issued/i.test(c)) || '';

        setProductCol(pCol);
        setProductCodeCol(cCol);
        setQtyCol(qCol);
        setRevenueCol(rCol);
        setDateCol(dCol);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSubmit = async () => {
    if (!productCol && !productCodeCol) {
      return alert('Please select at least the Product Name or Product Code column.');
    }

    const salesData = fileData.map(row => ({
      productName: productCol ? String(row[productCol] || '').trim() : '',
      productCode: productCodeCol ? String(row[productCodeCol] || '').trim() : '',
      quantity:    qtyCol ? (Number(row[qtyCol]) || 1) : 1,
      revenue:     revenueCol ? (Number(row[revenueCol]) || 0) : 0,
      unitPrice:   revenueCol ? (Number(row[revenueCol]) || 0) : 0,
      saleDate:    dateCol ? row[dateCol] : null,
    })).filter(s => s.productName || s.productCode);

    setLoading(true);
    setResult(null);
    try {
      const res = await api.post('/transactions/import-sales', {
        sales:     salesData,
        notes:     'Imported via POS/Excel Report',
        reference: `POS Import — ${new Date().toLocaleDateString()}`,
      });
      setResult({ success: true, data: res.data });
      setFileData(null);
    } catch (err) {
      setResult({
        success: false,
        message:   err.response?.data?.message || 'Failed to import sales.',
        unmatched: err.response?.data?.unmatchedProducts || [],
      });
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Filter sold items in the results view
  const displayedSoldProducts = useMemo(() => {
    if (!result?.data?.items) return [];
    return result.data.items.filter(item => {
      const matchesSearch = !soldSearch ||
        item.productName?.toLowerCase().includes(soldSearch.toLowerCase()) ||
        item.productCode?.toLowerCase().includes(soldSearch.toLowerCase()) ||
        item.category?.toLowerCase().includes(soldSearch.toLowerCase());

      const matchesStatus = statusFilter === 'all' || item.matchStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [result, soldSearch, statusFilter]);

  // Export sold POS products to Excel
  const handleExportSoldExcel = () => {
    if (!result?.data?.items) return;
    const exportRows = result.data.items.map((item, idx) => ({
      '#':                  idx + 1,
      'Product Code':       item.productCode || '—',
      'Product Name':       item.productName,
      'Category':           item.category || 'General',
      'Parent Category':    item.parentCategory || 'FOOD',
      'Quantity Sold':      item.quantitySold,
      'Unit Price (ETB)':   item.sellingPrice.toFixed(2),
      'Total Revenue (ETB)': item.revenue.toFixed(2),
      'COGS (ETB)':         item.cogs.toFixed(2),
      'Gross Profit (ETB)': item.grossProfit.toFixed(2),
      'Match Status':       item.matchStatus === 'recipe_deducted' ? 'Recipe Deducted' :
                            item.matchStatus === 'direct_material' ? 'Direct Stock Deducted' :
                            item.matchStatus === 'no_recipe' ? 'Sold (No Recipe)' : 'Unmatched',
      'Ingredients Deducted': item.ingredientsUsed?.length
        ? item.ingredientsUsed.map(i => `${i.materialName} (${i.quantityUsed} ${i.unit})`).join(', ')
        : 'None',
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sold POS Products');
    XLSX.writeFile(wb, `sold_pos_products_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900 flex items-center gap-2.5">
          <UploadCloud className="h-7 w-7 text-blue-600" />
          Import POS Sales Report
        </h1>
        <p className="text-sm text-ink-500 mt-1">
          Upload your POS Excel report. Matched items automatically deduct ingredients/stock and record revenue and Gross Profit.
        </p>
      </div>

      <Card>
        {/* ── 1. Upload Zone ── */}
        {!fileData && !result?.success && (
          <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-ink-200 rounded-2xl bg-ink-50/70">
            <div className="h-16 w-16 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 mb-4 shadow-xs">
              <UploadCloud size={32} />
            </div>
            <p className="text-base font-bold text-ink-900">Upload Sales Report (Excel / CSV)</p>
            <p className="text-xs text-ink-500 mt-1 mb-5 text-center max-w-md">
              Supports <span className="font-semibold text-ink-700">.xlsx, .xls, .csv</span> files exported from your POS. Includes product names, codes, quantities sold, and default prices/revenue.
            </p>
            <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition">
              <UploadCloud size={16} /> Select POS File
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        )}

        {/* ── 2. Column Mapping & Table Preview ── */}
        {fileData && !result?.success && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-ink-100 pb-4">
              <div>
                <h3 className="font-bold text-ink-900 text-base">Map File Columns</h3>
                <p className="text-xs text-ink-500 mt-0.5">
                  <span className="font-bold text-emerald-700">{fileData.length} sold rows</span> detected in the uploaded POS file.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFileData(null)}
                className="text-xs text-red-600 font-semibold hover:underline"
              >
                Cancel / Upload Different File
              </button>
            </div>

            {/* Auto-detected Confirmation Banner */}
            {productCol && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium">
                <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                <span>
                  <strong>Columns auto-selected automatically:</strong> Name: <span className="font-bold text-emerald-950">"{productCol}"</span>
                  {productCodeCol && <>, Code: <span className="font-bold text-emerald-950">"{productCodeCol}"</span></>}
                  {revenueCol && <>, Price / Value: <span className="font-bold text-emerald-950">"{revenueCol}"</span></>}
                  &middot; Ready to import with 1-click!
                </span>
              </div>
            )}

            {/* Dropdowns */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-xs font-bold text-ink-700 mb-1">
                  Product Name Column <span className="text-red-500">*</span>
                </label>
                <select
                  value={productCol}
                  onChange={e => setProductCol(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 py-2 px-3 text-xs outline-none focus:border-blue-500 bg-white"
                >
                  <option value="">-- Select --</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-700 mb-1">
                  Product Code Column (Optional)
                </label>
                <select
                  value={productCodeCol}
                  onChange={e => setProductCodeCol(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 py-2 px-3 text-xs outline-none focus:border-blue-500 bg-white"
                >
                  <option value="">-- Match by Code --</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-700 mb-1">
                  Quantity Sold Column
                </label>
                <select
                  value={qtyCol}
                  onChange={e => setQtyCol(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 py-2 px-3 text-xs outline-none focus:border-blue-500 bg-white"
                >
                  <option value="">-- Defaults to 1 --</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-700 mb-1">
                  Revenue / Default Value / Price Column
                </label>
                <select
                  value={revenueCol}
                  onChange={e => setRevenueCol(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 py-2 px-3 text-xs outline-none focus:border-blue-500 bg-white"
                >
                  <option value="">-- Not available --</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <p className="text-[10px] text-ink-400 mt-0.5">Used to calculate sales revenue &amp; Profit</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-700 mb-1">
                  Sale Date Column
                </label>
                <select
                  value={dateCol}
                  onChange={e => setDateCol(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 py-2 px-3 text-xs outline-none focus:border-blue-500 bg-white"
                >
                  <option value="">-- Use today's date --</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Table Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-ink-700">
                  Preview of Uploaded Data ({fileData.length} total rows)
                </p>
                <span className="text-[11px] text-ink-500">
                  Showing first 8 items
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-ink-200 shadow-xs max-h-64">
                <table className="min-w-full text-xs divide-y divide-ink-100">
                  <thead className="bg-ink-100/80 font-bold text-ink-700 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      {columns.map(c => (
                        <th key={c} className="px-3 py-2 text-left whitespace-nowrap">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-50 text-ink-700">
                    {fileData.slice(0, 8).map((row, i) => (
                      <tr key={i} className="hover:bg-blue-50/20">
                        <td className="px-3 py-1.5 text-ink-400 font-mono text-[11px]">{i + 1}</td>
                        {columns.map(c => (
                          <td key={c} className="px-3 py-1.5 whitespace-nowrap">{String(row[c] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Direct Information Box (No abstract blocks, immediate processing) */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-blue-950">Direct POS Processing</p>
                <p className="text-blue-800 mt-0.5">
                  Items are matched directly against your <span className="font-semibold">Products</span> or <span className="font-semibold">Raw Materials</span> by Code or Name. Matched items with recipes deduct their ingredients from stock immediately. Any unmatched items will be clearly marked without halting the import.
                </p>
              </div>
            </div>

            {/* Confirm button */}
            <div className="flex justify-end pt-3 border-t border-ink-100">
              <Button
                onClick={handleSubmit}
                disabled={loading || (!productCol && !productCodeCol)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 shadow-md flex items-center gap-2"
              >
                {loading ? 'Processing Import...' : 'Confirm & Import POS Sales'} <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* ── 3. SUCCESS: DISPLAY ALL LIST OF SOLD POS PRODUCTS ── */}
        {result?.success && (
          <div className="space-y-6">
            {/* Top Success Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-emerald-50 border border-emerald-200">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shadow-xs">
                  <CheckCircle size={28} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-emerald-950">POS Sales Imported Successfully</h2>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    {result.data?.summary?.totalSoldProducts || result.data?.items?.length || 0} POS items processed &middot; Stock deducted and P&amp;L records updated.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportSoldExcel}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 px-3.5 py-2 text-xs font-bold hover:bg-emerald-100 transition shadow-2xs"
                >
                  <Download size={14} /> Export to Excel
                </button>
                <Button
                  onClick={() => { setResult(null); setFileData(null); }}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2"
                >
                  Import Another
                </Button>
              </div>
            </div>

            {/* KPI Summary Cards */}
            {result.data.summary && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-ink-100 bg-white p-4 shadow-xs">
                  <p className="text-xs font-medium text-ink-500">Total POS Revenue</p>
                  <p className="tabular text-xl font-bold text-blue-700 mt-1">ETB {fmt(result.data.summary.totalRevenue)}</p>
                  <p className="text-[11px] text-ink-400 mt-0.5">{result.data.summary.totalSoldProducts || result.data.items?.length || 0} items sold</p>
                </div>

                <div className="rounded-xl border border-ink-100 bg-white p-4 shadow-xs">
                  <p className="text-xs font-medium text-ink-500">Total COGS (Ingredient Cost)</p>
                  <p className="tabular text-xl font-bold text-orange-700 mt-1">ETB {fmt(result.data.summary.totalCOGS)}</p>
                  <p className="text-[11px] text-ink-400 mt-0.5">Deducted from stock</p>
                </div>

                <div className="rounded-xl border border-ink-100 bg-white p-4 shadow-xs">
                  <p className="text-xs font-medium text-ink-500">Gross Profit</p>
                  <p className={`tabular text-xl font-bold mt-1 ${result.data.summary.grossProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    ETB {fmt(result.data.summary.grossProfit)}
                  </p>
                  <p className="text-[11px] text-ink-400 mt-0.5">Revenue − COGS</p>
                </div>

                <div className="rounded-xl border border-ink-100 bg-white p-4 shadow-xs">
                  <p className="text-xs font-medium text-ink-500">Gross Profit Margin</p>
                  <p className="tabular text-xl font-bold text-violet-700 mt-1">{result.data.summary.profitMargin}</p>
                  <p className="text-[11px] text-ink-400 mt-0.5">Efficiency percentage</p>
                </div>
              </div>
            )}

            {/* List of Sold POS Products */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                <div>
                  <h3 className="text-base font-bold text-ink-900 flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                    All Sold POS Products ({displayedSoldProducts.length} items)
                  </h3>
                  <p className="text-xs text-ink-500 mt-0.5">
                    Full list of items imported from your POS report with deducted ingredients and profit breakdown
                  </p>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink-400" />
                    <input
                      type="text"
                      placeholder="Search sold product..."
                      value={soldSearch}
                      onChange={e => setSoldSearch(e.target.value)}
                      className="rounded-lg border border-ink-200 pl-8 pr-3 py-1.5 text-xs outline-none focus:border-blue-500 w-44 sm:w-56"
                    />
                    {soldSearch && (
                      <button
                        type="button"
                        onClick={() => setSoldSearch('')}
                        className="absolute right-2 top-2 text-ink-400 hover:text-ink-600"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="all">All Statuses</option>
                    <option value="recipe_deducted">Recipe Deducted</option>
                    <option value="direct_material">Direct Material</option>
                    <option value="no_recipe">Sold (No Recipe)</option>
                    <option value="unmatched">Unmatched</option>
                  </select>
                </div>
              </div>

              {/* Master Sold POS Products Table */}
              <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white shadow-soft">
                <table className="min-w-full text-xs divide-y divide-ink-200">
                  <thead className="bg-ink-100/80 font-bold text-ink-700">
                    <tr>
                      <th className="px-3 py-2.5 text-left">#</th>
                      <th className="px-3 py-2.5 text-left">Code</th>
                      <th className="px-3 py-2.5 text-left">Product Name</th>
                      <th className="px-3 py-2.5 text-left">Category</th>
                      <th className="px-3 py-2.5 text-right">Qty Sold</th>
                      <th className="px-3 py-2.5 text-right">Selling Price</th>
                      <th className="px-3 py-2.5 text-right">Total Revenue</th>
                      <th className="px-3 py-2.5 text-center">Status</th>
                      <th className="px-3 py-2.5 text-left">Ingredients Deducted</th>
                      <th className="px-3 py-2.5 text-right">COGS (ETB)</th>
                      <th className="px-3 py-2.5 text-right">Gross Profit (ETB)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {displayedSoldProducts.length === 0 && (
                      <tr>
                        <td colSpan={11} className="px-4 py-8 text-center text-ink-400">
                          No sold products matched the search/filter criteria.
                        </td>
                      </tr>
                    )}
                    {displayedSoldProducts.map((item, idx) => (
                      <React.Fragment key={idx}>
                        <tr className="hover:bg-blue-50/20 transition-colors">
                          <td className="px-3 py-2 text-ink-400 font-mono text-[11px]">{idx + 1}</td>
                          <td className="px-3 py-2 font-mono text-ink-600 font-medium whitespace-nowrap">
                            {item.productCode || '—'}
                          </td>
                          <td className="px-3 py-2 font-semibold text-ink-900 whitespace-nowrap">
                            {item.productName}
                          </td>
                          <td className="px-3 py-2 text-ink-500 whitespace-nowrap">
                            <span className="text-[10px] bg-ink-100 text-ink-600 px-1.5 py-0.5 rounded">
                              {item.category || 'General'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right tabular font-bold text-ink-900 whitespace-nowrap">
                            {item.quantitySold} {item.uom || ''}
                          </td>
                          <td className="px-3 py-2 text-right tabular text-ink-600 whitespace-nowrap">
                            ETB {fmt(item.sellingPrice)}
                          </td>
                          <td className="px-3 py-2 text-right tabular font-bold text-blue-700 whitespace-nowrap">
                            ETB {fmt(item.revenue)}
                          </td>
                          <td className="px-3 py-2 text-center whitespace-nowrap">
                            {item.matchStatus === 'recipe_deducted' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700 border border-emerald-200">
                                <CheckCircle size={11} /> Recipe Deducted
                              </span>
                            )}
                            {item.matchStatus === 'direct_material' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10.5px] font-bold text-indigo-700 border border-indigo-200">
                                <CheckCircle size={11} /> Direct Stock
                              </span>
                            )}
                            {item.matchStatus === 'no_recipe' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium text-slate-700">
                                Sold (No Recipe)
                              </span>
                            )}
                            {item.matchStatus === 'unmatched' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-bold text-amber-700 border border-amber-200">
                                <AlertTriangle size={11} /> Unmatched
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-ink-600 text-[11px] max-w-[220px]">
                            {item.ingredientsUsed?.length > 0 ? (
                              <div className="flex items-center gap-1.5">
                                <span className="truncate">
                                  {item.ingredientsUsed.map(i => `${i.materialName} × ${i.quantityUsed} ${i.unit}`).join(', ')}
                                </span>
                                {item.ingredientsUsed.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}
                                    className="text-blue-600 hover:text-blue-800"
                                    title="Toggle details"
                                  >
                                    {expandedRow === idx ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-ink-400 italic">No recipe ingredients</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular text-orange-700 whitespace-nowrap">
                            ETB {fmt(item.cogs)}
                          </td>
                          <td className="px-3 py-2 text-right tabular font-bold text-emerald-700 whitespace-nowrap">
                            ETB {fmt(item.grossProfit)}
                          </td>
                        </tr>

                        {/* Expanded details row for multi-ingredient deductions */}
                        {expandedRow === idx && item.ingredientsUsed?.length > 0 && (
                          <tr className="bg-emerald-50/40">
                            <td colSpan={11} className="px-6 py-2">
                              <p className="font-bold text-ink-700 mb-1 text-[11px]">Deducted Ingredients Breakdown:</p>
                              <div className="flex flex-wrap gap-2">
                                {item.ingredientsUsed.map((ing, iIdx) => (
                                  <span key={iIdx} className="bg-white border border-emerald-200 rounded-md px-2 py-0.5 text-[10.5px] text-ink-800 shadow-2xs">
                                    <span className="font-semibold text-emerald-800">{ing.materialName}:</span> {ing.quantityUsed} {ing.unit} &middot; Cost: ETB {fmt(ing.totalCost)}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                  <tfoot className="bg-ink-100 font-bold border-t-2 border-ink-300 text-[11.5px]">
                    <tr>
                      <td colSpan={4} className="px-3 py-2.5 text-ink-900 font-extrabold uppercase">
                        Total ({displayedSoldProducts.length} items)
                      </td>
                      <td className="px-3 py-2.5 text-right tabular text-ink-900">
                        {displayedSoldProducts.reduce((s, i) => s + (i.quantitySold || 0), 0)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-ink-400">—</td>
                      <td className="px-3 py-2.5 text-right tabular text-blue-900 font-extrabold">
                        ETB {fmt(displayedSoldProducts.reduce((s, i) => s + (i.revenue || 0), 0))}
                      </td>
                      <td colSpan={2} className="px-3 py-2.5 text-center text-ink-500">
                        Stock Deductions Applied
                      </td>
                      <td className="px-3 py-2.5 text-right tabular text-orange-900 font-extrabold">
                        ETB {fmt(displayedSoldProducts.reduce((s, i) => s + (i.cogs || 0), 0))}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular text-emerald-950 font-black text-xs">
                        ETB {fmt(displayedSoldProducts.reduce((s, i) => s + (i.grossProfit || 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-wrap gap-3 justify-center pt-2">
              <Button
                onClick={() => { setResult(null); setFileData(null); }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                Import Another POS File
              </Button>
              <a
                href="/reports/stock-balance"
                className="inline-flex items-center gap-2 rounded-xl border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50 transition"
              >
                <Scale size={15} /> View Stock Balance Sheet
              </a>
              <a
                href="/analytics"
                className="inline-flex items-center gap-2 rounded-xl border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50 transition"
              >
                <TrendingUp size={15} /> View P&amp;L Analytics
              </a>
            </div>
          </div>
        )}

        {/* ── 4. Error State ── */}
        {result && !result.success && (
          <div className="p-6 bg-red-50 border border-red-200 rounded-2xl mt-2">
            <div className="flex items-center gap-2 text-red-700 font-bold mb-2 text-base">
              <XCircle size={20} /> Import Failed
            </div>
            <p className="text-sm text-red-700 mb-3">{result.message}</p>
            {result.unmatched?.length > 0 && (
              <div className="bg-white/80 p-3 rounded-xl border border-red-200">
                <p className="text-xs font-bold text-red-800 mb-1">Unmatched Product Names:</p>
                <ul className="list-disc pl-5 text-xs text-red-600 max-h-32 overflow-y-auto">
                  {result.unmatched.map((u, i) => <li key={i}>{u}</li>)}
                </ul>
              </div>
            )}
            <button
              onClick={() => setResult(null)}
              className="mt-4 text-xs font-bold text-red-700 hover:underline inline-flex items-center gap-1"
            >
              Try Again
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
