import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import api from '../api/axios';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import {
  UploadCloud, CheckCircle, AlertTriangle, ArrowRight, XCircle,
  TrendingUp, Search, Download, FileSpreadsheet, Scale, X,
  ChevronDown, ChevronUp, Zap,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────
   CNET / NOBIR POS Excel format detector + parser
   Columns: Article Code | Article Name | Quantity | Avg Amount | Total Amount
   The sheet has category & sub-category header rows mixed in — we skip those.
───────────────────────────────────────────────────────────────────────── */
function parseCnetPosSheet(rawRows) {
  // Find the header row: must contain both "Article Code" and "Article Name"
  let headerIdx = -1;
  let colMap    = {};

  for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
    const row  = rawRows[i];
    const keys = Object.keys(row).map(k => String(k).trim());
    const vals = Object.values(row).map(v => String(v || '').trim().toLowerCase());

    // Look for the header in values (sheet_to_json with header:1 style) or keys
    const allText = [...keys, ...vals];
    if (
      allText.some(t => /article.?code/i.test(t)) &&
      allText.some(t => /article.?name/i.test(t))
    ) {
      headerIdx = i;
      // Map column keys → our field names
      for (const k of Object.keys(row)) {
        const v = String(row[k] || '').trim().toLowerCase();
        if (/article.?code/i.test(v) || /article.?code/i.test(k))  colMap.code     = k;
        if (/article.?name/i.test(v) || /article.?name/i.test(k))  colMap.name     = k;
        if (/^quantity$/i.test(v)    || /^quantity$/i.test(k))      colMap.qty      = k;
        if (/avg.?amount/i.test(v)   || /avg.?amount/i.test(k))    colMap.avgAmt   = k;
        if (/total.?amount/i.test(v) || /total.?amount/i.test(k))  colMap.totalAmt = k;
      }
      break;
    }
  }

  // If we didn't find the header row inside the data rows, it might BE the column keys
  // (sheet_to_json uses first row as keys by default)
  if (headerIdx === -1 && rawRows.length > 0) {
    const keys = Object.keys(rawRows[0]);
    if (
      keys.some(k => /article.?code/i.test(k)) &&
      keys.some(k => /article.?name/i.test(k))
    ) {
      headerIdx = -1; // data starts from row 0, colMap built from keys
      for (const k of keys) {
        if (/article.?code/i.test(k))  colMap.code     = k;
        if (/article.?name/i.test(k))  colMap.name     = k;
        if (/quantity/i.test(k))        colMap.qty      = k;
        if (/avg.?amount/i.test(k))    colMap.avgAmt   = k;
        if (/total.?amount/i.test(k))  colMap.totalAmt = k;
      }
    }
  }

  if (!colMap.name && !colMap.code) return null; // Not CNET format

  // Parse data rows — skip header row itself and any category/summary rows
  const dataRows = headerIdx >= 0 ? rawRows.slice(headerIdx + 1) : rawRows;

  const parsed = [];
  for (const row of dataRows) {
    const code     = String(row[colMap.code]     || '').trim().replace(/-+$/, ''); // strip trailing dashes
    const name     = String(row[colMap.name]     || '').trim();
    const qty      = parseFloat(row[colMap.qty]  || 0) || 0;
    const avgAmt   = parseFloat(row[colMap.avgAmt]   || 0) || 0;
    const totalAmt = parseFloat(row[colMap.totalAmt] || 0) || 0;

    // Skip rows without a product code AND without a meaningful name
    if (!code && !name) continue;
    // Skip category / sub-category header rows: no code, name looks like a label
    if (!code && (!qty || qty === 0)) continue;
    // Skip summary / total rows (name contains "total", "sub total", "grand total", etc.)
    if (/^(sub[\s-]?total|grand[\s-]?total|total[\s-]?tax|add[\s-]?charge|discount|erp\s|page\s|count:)/i.test(name)) continue;
    // Skip rows where name is a category header (all caps, no code, no qty)
    if (!code && /^[A-Z\s&\/]+$/.test(name) && !qty) continue;

    if (qty <= 0 && !code && !name) continue;

    parsed.push({ code, name, qty, avgAmt, totalAmt });
  }

  return { rows: parsed, colMap };
}

export default function SalesImport() {
  const [fileData,   setFileData]   = useState(null); // raw XLSX rows
  const [parsed,     setParsed]     = useState(null); // { rows, colMap } for CNET format
  const [isCnetFmt,  setIsCnetFmt]  = useState(false);

  // Manual mapping (fallback for non-CNET files)
  const [columns,        setColumns]        = useState([]);
  const [productCol,     setProductCol]     = useState('');
  const [productCodeCol, setProductCodeCol] = useState('');
  const [qtyCol,         setQtyCol]         = useState('');
  const [revenueCol,     setRevenueCol]     = useState('');
  const [dateCol,        setDateCol]        = useState('');

  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);

  // Result filters
  const [soldSearch,    setSoldSearch]    = useState('');
  const [statusFilter,  setStatusFilter]  = useState('all');
  const [expandedRow,   setExpandedRow]   = useState(null);

  const fmt = (n) =>
    Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* ── File upload handler ── */
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb      = XLSX.read(evt.target.result, { type: 'binary' });
      const ws      = wb.Sheets[wb.SheetNames[0]];
      // Read with defval '' so empty cells don't disappear
      const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      // Try CNET POS format first
      const cnetResult = parseCnetPosSheet(rawRows);
      if (cnetResult && cnetResult.rows.length > 0) {
        setIsCnetFmt(true);
        setParsed(cnetResult);
        setFileData(rawRows);
        return;
      }

      // Fallback: generic column mapping
      setIsCnetFmt(false);
      setParsed(null);
      setFileData(rawRows);
      if (rawRows.length > 0) {
        const cols = Object.keys(rawRows[0]);
        setColumns(cols);
        const pCol = cols.find(c => /^(name|product.*name|item.*name)$/i.test(c.trim())) ||
                     cols.find(c => /product|item|name/i.test(c)) || '';
        const cCol = cols.find(c => /^(code|item.*code|product.*code|sku)$/i.test(c.trim())) ||
                     cols.find(c => /code|sku/i.test(c)) || '';
        const qCol = cols.find(c => /^(qty|quantity|count|sold)$/i.test(c.trim())) ||
                     cols.find(c => /qty|quantity|sold/i.test(c)) || '';
        const rCol = cols.find(c => /^(total.*amount|total|revenue|amount)$/i.test(c.trim())) ||
                     cols.find(c => /total|revenue|amount/i.test(c)) || '';
        const dCol = cols.find(c => /date|time/i.test(c)) || '';
        setProductCol(pCol); setProductCodeCol(cCol);
        setQtyCol(qCol); setRevenueCol(rCol); setDateCol(dCol);
      }
    };
    reader.readAsBinaryString(file);
  };

  /* ── Submit CNET format ── */
  const handleCnetSubmit = async () => {
    if (!parsed?.rows?.length) return;

    const salesData = parsed.rows.map(r => ({
      productCode: r.code,
      productName: r.name,
      quantity:    r.qty,
      revenue:     r.totalAmt,   // Total Amount = total revenue for this line
      unitPrice:   r.avgAmt,     // Avg Amount   = avg selling price per unit (incl. tax)
    })).filter(s => s.productCode || s.productName);

    setLoading(true); setResult(null);
    try {
      const res = await api.post('/transactions/import-sales', {
        sales:     salesData,
        notes:     'Imported via POS Sales Report (CNET format)',
        reference: `POS Import — ${new Date().toLocaleDateString()}`,
      });
      setResult({ success: true, data: res.data });
      setFileData(null); setParsed(null);
    } catch (err) {
      setResult({
        success:   false,
        message:   err.response?.data?.message || 'Failed to import sales.',
        unmatched: err.response?.data?.unmatchedProducts || [],
      });
    } finally { setLoading(false); }
  };

  /* ── Submit manual (generic) format ── */
  const handleManualSubmit = async () => {
    if (!productCol && !productCodeCol) {
      return alert('Please select at least the Product Name or Product Code column.');
    }
    const salesData = fileData.map(row => ({
      productName: productCol     ? String(row[productCol]     || '').trim() : '',
      productCode: productCodeCol ? String(row[productCodeCol] || '').trim() : '',
      quantity:    qtyCol     ? (Number(row[qtyCol])     || 1) : 1,
      revenue:     revenueCol ? (Number(row[revenueCol]) || 0) : 0,
      unitPrice:   revenueCol ? (Number(row[revenueCol]) || 0) : 0,
      saleDate:    dateCol ? row[dateCol] : null,
    })).filter(s => s.productName || s.productCode);

    setLoading(true); setResult(null);
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
        success:   false,
        message:   err.response?.data?.message || 'Failed to import sales.',
        unmatched: err.response?.data?.unmatchedProducts || [],
      });
    } finally { setLoading(false); }
  };

  /* ── Export result to Excel ── */
  const handleExportSoldExcel = () => {
    if (!result?.data?.items) return;
    const exportRows = result.data.items.map((item, idx) => ({
      '#':                   idx + 1,
      'Product Code':        item.productCode || '—',
      'Product Name':        item.productName,
      'Category':            item.category || 'General',
      'Quantity Sold':       item.quantitySold,
      'Unit Price (ETB)':    item.sellingPrice.toFixed(2),
      'Total Revenue (ETB)': item.revenue.toFixed(2),
      'COGS (ETB)':          item.cogs.toFixed(2),
      'Gross Profit (ETB)':  item.grossProfit.toFixed(2),
      'Match Status':        item.matchStatus === 'recipe_deducted' ? 'Recipe Deducted' :
                             item.matchStatus === 'direct_material' ? 'Direct Stock Deducted' :
                             item.matchStatus === 'no_recipe'       ? 'Sold (No Recipe)' : 'Unmatched',
      'Ingredients Deducted': item.ingredientsUsed?.length
        ? item.ingredientsUsed.map(i => `${i.materialName} (${i.quantityUsed} ${i.unit})`).join(', ')
        : 'None',
    }));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sold POS Products');
    XLSX.writeFile(wb, `sold_pos_products_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  /* ── Filtered result rows ── */
  const displayedSoldProducts = useMemo(() => {
    if (!result?.data?.items) return [];
    return result.data.items.filter(item => {
      const matchesSearch = !soldSearch ||
        item.productName?.toLowerCase().includes(soldSearch.toLowerCase()) ||
        item.productCode?.toLowerCase().includes(soldSearch.toLowerCase());
      const matchesStatus = statusFilter === 'all' || item.matchStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [result, soldSearch, statusFilter]);

  const resetAll = () => {
    setFileData(null); setParsed(null); setResult(null);
    setIsCnetFmt(false); setColumns([]);
  };

  /* ════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════ */
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

        {/* ── 1. Upload Zone (no file yet) ── */}
        {!fileData && !result?.success && (
          <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-ink-200 rounded-2xl bg-ink-50/70">
            <div className="h-16 w-16 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 mb-4 shadow-xs">
              <UploadCloud size={32} />
            </div>
            <p className="text-base font-bold text-ink-900">Upload Sales Report (Excel / CSV)</p>
            <p className="text-xs text-ink-500 mt-1 mb-2 text-center max-w-md">
              Supports <span className="font-semibold text-ink-700">.xlsx, .xls, .csv</span> files exported from your POS.
              Includes product names, codes, quantities sold, and default prices/revenue.
            </p>
            <p className="text-[11px] text-blue-700 font-semibold mb-5 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
              ✦ NOBIR / CNET POS format auto-detected — no column mapping needed
            </p>
            <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition">
              <UploadCloud size={16} /> Select POS File
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        )}

        {/* ── 2a. CNET Auto-detected Preview ── */}
        {fileData && parsed && isCnetFmt && !result?.success && (
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-ink-100 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-300">
                  <Zap size={12} /> CNET POS Format Auto-Detected
                </span>
                <span className="text-sm font-semibold text-ink-700">
                  {parsed.rows.length} product lines ready to import
                </span>
              </div>
              <button onClick={resetAll} className="text-xs text-red-600 font-semibold hover:underline">
                Cancel / Upload Different File
              </button>
            </div>

            {/* Parsed preview table */}
            <div className="overflow-x-auto rounded-xl border border-ink-200 shadow-xs max-h-72">
              <table className="min-w-full text-xs divide-y divide-ink-100">
                <thead className="bg-ink-100/80 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold text-ink-700">#</th>
                    <th className="px-3 py-2 text-left font-bold text-ink-700">Article Code</th>
                    <th className="px-3 py-2 text-left font-bold text-ink-700">Article Name</th>
                    <th className="px-3 py-2 text-right font-bold text-ink-700">Qty</th>
                    <th className="px-3 py-2 text-right font-bold text-ink-700">Avg Amount (ETB)</th>
                    <th className="px-3 py-2 text-right font-bold text-ink-700">Total Amount (ETB)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50 text-ink-700">
                  {parsed.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-blue-50/20">
                      <td className="px-3 py-1.5 text-ink-400 font-mono text-[11px]">{i + 1}</td>
                      <td className="px-3 py-1.5 font-mono text-blue-700 font-semibold">{row.code || '—'}</td>
                      <td className="px-3 py-1.5 font-semibold text-ink-900">{row.name}</td>
                      <td className="px-3 py-1.5 text-right tabular">{row.qty}</td>
                      <td className="px-3 py-1.5 text-right tabular text-ink-600">{row.avgAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-1.5 text-right tabular font-semibold text-blue-700">{row.totalAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-ink-50 font-bold text-xs border-t border-ink-200">
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-ink-700 font-bold">Total ({parsed.rows.length} items)</td>
                    <td className="px-3 py-2 text-right tabular text-ink-900">
                      {parsed.rows.reduce((s, r) => s + r.qty, 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-ink-400">—</td>
                    <td className="px-3 py-2 text-right tabular text-blue-900">
                      ETB {parsed.rows.reduce((s, r) => s + r.totalAmt, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Info box */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-blue-950">How this import works</p>
                <ul className="mt-1 space-y-0.5 text-blue-800 list-disc pl-4">
                  <li><strong>Article Code</strong> is matched against your Product codes first, then by name.</li>
                  <li>Matched products with recipes → ingredients deducted from stock automatically.</li>
                  <li><strong>Total Amount</strong> is used as the line revenue; <strong>Avg Amount</strong> as the unit selling price.</li>
                  <li>Unmatched items are recorded but don't affect stock.</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-ink-100">
              <Button
                onClick={handleCnetSubmit}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 shadow-md flex items-center gap-2"
              >
                {loading ? 'Processing…' : `Confirm & Import ${parsed.rows.length} Items`}
                <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* ── 2b. Generic Manual Column Mapping (fallback) ── */}
        {fileData && !isCnetFmt && !result?.success && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-ink-100 pb-4">
              <div>
                <h3 className="font-bold text-ink-900 text-base">Map File Columns</h3>
                <p className="text-xs text-ink-500 mt-0.5">
                  <span className="font-bold text-emerald-700">{fileData.length} rows</span> detected. Select which columns to use.
                </p>
              </div>
              <button onClick={resetAll} className="text-xs text-red-600 font-semibold hover:underline">
                Cancel / Upload Different File
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: 'Product Name Column', required: true,  val: productCol,     set: setProductCol },
                { label: 'Product Code Column', required: false, val: productCodeCol, set: setProductCodeCol },
                { label: 'Quantity Sold',        required: false, val: qtyCol,         set: setQtyCol },
                { label: 'Revenue / Amount',     required: false, val: revenueCol,     set: setRevenueCol },
                { label: 'Sale Date',            required: false, val: dateCol,        set: setDateCol },
              ].map(({ label, required, val, set }) => (
                <div key={label}>
                  <label className="block text-xs font-bold text-ink-700 mb-1">
                    {label} {required && <span className="text-red-500">*</span>}
                  </label>
                  <select value={val} onChange={e => set(e.target.value)}
                    className="w-full rounded-xl border border-ink-200 py-2 px-3 text-xs outline-none focus:border-blue-500 bg-white">
                    <option value="">-- Select --</option>
                    {columns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {/* Preview */}
            <div className="overflow-x-auto rounded-xl border border-ink-200 max-h-52">
              <table className="min-w-full text-xs divide-y divide-ink-100">
                <thead className="bg-ink-100/80 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-ink-700">#</th>
                    {columns.map(c => <th key={c} className="px-3 py-2 text-left text-ink-700 whitespace-nowrap">{c}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50">
                  {fileData.slice(0, 6).map((row, i) => (
                    <tr key={i} className="hover:bg-blue-50/20">
                      <td className="px-3 py-1.5 text-ink-400 font-mono">{i + 1}</td>
                      {columns.map(c => <td key={c} className="px-3 py-1.5 whitespace-nowrap">{String(row[c] ?? '')}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2 border-t border-ink-100">
              <Button
                onClick={handleManualSubmit}
                disabled={loading || (!productCol && !productCodeCol)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 shadow-md flex items-center gap-2"
              >
                {loading ? 'Processing…' : 'Confirm & Import POS Sales'} <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* ── 3. Success Results ── */}
        {result?.success && (
          <div className="space-y-6">
            {/* Success banner */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-emerald-50 border border-emerald-200">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                  <CheckCircle size={28} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-emerald-950">POS Sales Imported Successfully</h2>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    {result.data?.summary?.totalSoldProducts || result.data?.items?.length || 0} items processed · Stock deducted and P&amp;L updated.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleExportSoldExcel}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 px-3.5 py-2 text-xs font-bold hover:bg-emerald-100 transition shadow-xs">
                  <Download size={14} /> Export to Excel
                </button>
                <Button onClick={resetAll}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2">
                  Import Another
                </Button>
              </div>
            </div>

            {/* KPI cards */}
            {result.data.summary && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Total POS Revenue',      val: `ETB ${fmt(result.data.summary.totalRevenue)}`,  sub: `${result.data.summary.totalSoldProducts || result.data.items?.length || 0} items sold`, cls: 'text-blue-700' },
                  { label: 'Total COGS',              val: `ETB ${fmt(result.data.summary.totalCOGS)}`,    sub: 'Deducted from stock',       cls: 'text-orange-700' },
                  { label: 'Gross Profit',            val: `ETB ${fmt(result.data.summary.grossProfit)}`,  sub: 'Revenue − COGS',            cls: result.data.summary.grossProfit >= 0 ? 'text-emerald-700' : 'text-red-700' },
                  { label: 'Gross Profit Margin',     val: result.data.summary.profitMargin,               sub: 'Efficiency percentage',     cls: 'text-violet-700' },
                ].map(({ label, val, sub, cls }) => (
                  <div key={label} className="rounded-xl border border-ink-100 bg-white p-4 shadow-xs">
                    <p className="text-xs font-medium text-ink-500">{label}</p>
                    <p className={`tabular text-xl font-bold mt-1 ${cls}`}>{val}</p>
                    <p className="text-[11px] text-ink-400 mt-0.5">{sub}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Sold products table */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-ink-900 flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                    All Sold POS Products ({displayedSoldProducts.length} items)
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink-400" />
                    <input type="text" placeholder="Search product…"
                      value={soldSearch} onChange={e => setSoldSearch(e.target.value)}
                      className="rounded-lg border border-ink-200 pl-8 pr-3 py-1.5 text-xs outline-none focus:border-blue-500 w-44 sm:w-56" />
                    {soldSearch && (
                      <button onClick={() => setSoldSearch('')} className="absolute right-2 top-2 text-ink-400 hover:text-ink-600">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    className="rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 bg-white">
                    <option value="all">All Statuses</option>
                    <option value="recipe_deducted">Recipe Deducted</option>
                    <option value="direct_material">Direct Material</option>
                    <option value="no_recipe">No Recipe</option>
                    <option value="unmatched">Unmatched</option>
                  </select>
                </div>
              </div>

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
                      <tr><td colSpan={11} className="px-4 py-8 text-center text-ink-400">No items match the filter.</td></tr>
                    )}
                    {displayedSoldProducts.map((item, idx) => (
                      <React.Fragment key={idx}>
                        <tr className="hover:bg-blue-50/20 transition-colors">
                          <td className="px-3 py-2 text-ink-400 font-mono text-[11px]">{idx + 1}</td>
                          <td className="px-3 py-2 font-mono text-ink-600 whitespace-nowrap">{item.productCode || '—'}</td>
                          <td className="px-3 py-2 font-semibold text-ink-900 whitespace-nowrap">{item.productName}</td>
                          <td className="px-3 py-2 text-ink-500 whitespace-nowrap">
                            <span className="text-[10px] bg-ink-100 text-ink-600 px-1.5 py-0.5 rounded">{item.category || 'General'}</span>
                          </td>
                          <td className="px-3 py-2 text-right tabular font-bold text-ink-900">{item.quantitySold} {item.uom || ''}</td>
                          <td className="px-3 py-2 text-right tabular text-ink-600">ETB {fmt(item.sellingPrice)}</td>
                          <td className="px-3 py-2 text-right tabular font-bold text-blue-700">ETB {fmt(item.revenue)}</td>
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
                                  <button type="button"
                                    onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}
                                    className="text-blue-600 hover:text-blue-800">
                                    {expandedRow === idx ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-ink-400 italic">No ingredients</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular text-orange-700">ETB {fmt(item.cogs)}</td>
                          <td className="px-3 py-2 text-right tabular font-bold text-emerald-700">ETB {fmt(item.grossProfit)}</td>
                        </tr>
                        {expandedRow === idx && item.ingredientsUsed?.length > 0 && (
                          <tr className="bg-emerald-50/40">
                            <td colSpan={11} className="px-6 py-2">
                              <p className="font-bold text-ink-700 mb-1 text-[11px]">Deducted Ingredients:</p>
                              <div className="flex flex-wrap gap-2">
                                {item.ingredientsUsed.map((ing, iIdx) => (
                                  <span key={iIdx} className="bg-white border border-emerald-200 rounded-md px-2 py-0.5 text-[10.5px] text-ink-800 shadow-xs">
                                    <span className="font-semibold text-emerald-800">{ing.materialName}:</span> {ing.quantityUsed} {ing.unit} · ETB {fmt(ing.totalCost)}
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
                      <td colSpan={2} className="px-3 py-2.5 text-center text-ink-500">Stock Deductions Applied</td>
                      <td className="px-3 py-2.5 text-right tabular text-orange-900 font-extrabold">
                        ETB {fmt(displayedSoldProducts.reduce((s, i) => s + (i.cogs || 0), 0))}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular text-emerald-950 font-black">
                        ETB {fmt(displayedSoldProducts.reduce((s, i) => s + (i.grossProfit || 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Bottom actions */}
            <div className="flex flex-wrap gap-3 justify-center pt-2">
              <Button onClick={resetAll} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                Import Another POS File
              </Button>
              <a href="/reports/stock-balance"
                className="inline-flex items-center gap-2 rounded-xl border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50 transition">
                <Scale size={15} /> View Stock Balance Sheet
              </a>
              <a href="/analytics"
                className="inline-flex items-center gap-2 rounded-xl border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50 transition">
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
                <p className="text-xs font-bold text-red-800 mb-1">Unmatched Products:</p>
                <ul className="list-disc pl-5 text-xs text-red-600 max-h-32 overflow-y-auto">
                  {result.unmatched.map((u, i) => <li key={i}>{u}</li>)}
                </ul>
              </div>
            )}
            <button onClick={() => setResult(null)}
              className="mt-4 text-xs font-bold text-red-700 hover:underline inline-flex items-center gap-1">
              Try Again
            </button>
          </div>
        )}

      </Card>
    </div>
  );
}
