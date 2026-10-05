import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../api/axios';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { UploadCloud, CheckCircle, AlertTriangle, ArrowRight, XCircle, TrendingUp } from 'lucide-react';

export default function SalesImport() {
  const [fileData, setFileData]   = useState(null);
  const [columns, setColumns]     = useState([]);
  const [productCol, setProductCol] = useState('');
  const [qtyCol, setQtyCol]       = useState('');
  const [revenueCol, setRevenueCol] = useState('');
  const [dateCol, setDateCol]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);

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
        // Auto-guess columns
        setProductCol(cols.find(c => /product|item|name/i.test(c)) || '');
        setQtyCol(cols.find(c => /qty|quantity|count|sold/i.test(c)) || '');
        setRevenueCol(cols.find(c => /total|revenue|amount|price|grand/i.test(c)) || '');
        setDateCol(cols.find(c => /date|time|issued/i.test(c)) || '');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSubmit = async () => {
    if (!productCol) return alert('Please select the Product Name column.');

    const salesData = fileData.map(row => ({
      productName: String(row[productCol] || '').trim(),
      quantity:    qtyCol ? Number(row[qtyCol]) || 1 : 1,
      revenue:     revenueCol ? Number(row[revenueCol]) || 0 : 0,
      saleDate:    dateCol ? row[dateCol] : null,
    })).filter(s => s.productName);

    setLoading(true);
    setResult(null);
    try {
      const res = await api.post('/transactions/import-sales', {
        sales:     salesData,
        notes:     'Imported via POS/Excel Report',
        reference: `Excel Import — ${new Date().toLocaleDateString()}`,
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

  const fmt  = (n) => (Number(n) || 0).toFixed(2);
  const pct  = (n) => (Number(n) || 0).toFixed(1) + '%';

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">Import POS Sales Report</h1>
        <p className="text-sm text-ink-400 mt-1">
          Upload your POS or external sales Excel/CSV file — stock will be deducted and full P&amp;L will be recorded automatically
        </p>
      </div>

      <Card>
        {/* ── Upload Zone ── */}
        {!fileData && !result?.success && (
          <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-ink-200 rounded-xl bg-ink-50">
            <UploadCloud size={42} className="text-blue-500 mb-4" />
            <p className="text-sm font-bold text-ink-800">Upload Sales Report (Excel / CSV)</p>
            <p className="text-xs text-ink-400 mt-1 mb-5 text-center max-w-sm">
              Supports .xlsx, .xls, .csv files. Include columns for Product Name, Quantity Sold, and Revenue (Grand Total).
            </p>
            <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-blue-700 transition">
              Browse File
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        )}

        {/* ── Column Mapping ── */}
        {fileData && !result?.success && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-ink-100 pb-4">
              <div>
                <h3 className="font-bold text-ink-900">Map File Columns</h3>
                <p className="text-xs text-ink-500">{fileData.length} rows detected in the uploaded file.</p>
              </div>
              <button onClick={() => setFileData(null)} className="text-xs text-red-600 font-semibold hover:underline">
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-ink-700 mb-1">Product Name Column <span className="text-red-500">*</span></label>
                <select value={productCol} onChange={e => setProductCol(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 py-2.5 px-3 text-sm outline-none focus:border-blue-500">
                  <option value="">-- Select --</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-ink-700 mb-1">Quantity Sold Column</label>
                <select value={qtyCol} onChange={e => setQtyCol(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 py-2.5 px-3 text-sm outline-none focus:border-blue-500">
                  <option value="">-- Defaults to 1 --</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-ink-700 mb-1">Revenue / Grand Total Column</label>
                <select value={revenueCol} onChange={e => setRevenueCol(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 py-2.5 px-3 text-sm outline-none focus:border-blue-500">
                  <option value="">-- Not available --</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <p className="text-[11px] text-ink-400 mt-0.5">Used to calculate Profit &amp; Loss</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-ink-700 mb-1">Sale Date Column</label>
                <select value={dateCol} onChange={e => setDateCol(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 py-2.5 px-3 text-sm outline-none focus:border-blue-500">
                  <option value="">-- Use today's date --</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Preview */}
            <div className="overflow-x-auto rounded-xl border border-ink-100">
              <table className="min-w-full text-xs">
                <thead className="bg-ink-50 text-ink-600 font-semibold">
                  <tr>
                    {columns.slice(0, 6).map(c => <th key={c} className="px-3 py-2 text-left">{c}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50 text-ink-700">
                  {fileData.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      {columns.slice(0, 6).map(c => <td key={c} className="px-3 py-2">{String(row[c] ?? '')}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-800">
              <p className="font-bold mb-1">How it works:</p>
              <ul className="space-y-1 list-disc pl-5">
                <li>Products are matched against your <strong>Products</strong> and <strong>Raw Materials</strong> database by name</li>
                <li>If a Product has a recipe, the system deducts its <strong>ingredients</strong> from stock proportionally</li>
                <li>Revenue vs. Ingredient Cost = <strong>Gross Profit</strong> — stored in Analytics</li>
                <li>Sales Prediction and stock coverage forecasts are updated automatically</li>
              </ul>
            </div>

            <div className="flex justify-end pt-2 border-t border-ink-100">
              <Button onClick={handleSubmit} disabled={loading || !productCol} className="bg-blue-600 hover:bg-blue-700 text-white">
                {loading ? 'Processing...' : 'Confirm & Import'} <ArrowRight size={15} />
              </Button>
            </div>
          </div>
        )}

        {/* ── Success Result ── */}
        {result?.success && (
          <div className="space-y-6">
            <div className="text-center pt-4">
              <CheckCircle size={48} className="text-emerald-500 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-ink-900">Import Successful</h2>
              <p className="text-sm text-ink-400">Stock deducted and P&amp;L recorded.</p>
            </div>

            {/* P&L Summary Cards */}
            {result.data.summary && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: 'Total Revenue', value: `ETB ${fmt(result.data.summary.totalRevenue)}`, color: 'text-blue-700' },
                  { label: 'Total COGS',    value: `ETB ${fmt(result.data.summary.totalCOGS)}`,    color: 'text-orange-700' },
                  { label: 'Gross Profit',  value: `ETB ${fmt(result.data.summary.grossProfit)}`,  color: result.data.summary.grossProfit >= 0 ? 'text-emerald-700' : 'text-red-700' },
                  { label: 'Profit Margin', value: result.data.summary.profitMargin,                color: 'text-violet-700' },
                ].map(c => (
                  <div key={c.label} className="rounded-xl border border-ink-100 p-4 text-center">
                    <p className="text-xs text-ink-400">{c.label}</p>
                    <p className={`text-lg font-bold mt-1 ${c.color}`}>{c.value}</p>
                  </div>
                ))}
              </div>
            )}

            {result.data.unmatchedProducts?.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm font-bold text-amber-800 flex items-center gap-2">
                  <AlertTriangle size={16} /> Unmatched Products (not deducted from stock)
                </p>
                <ul className="mt-2 list-disc pl-6 text-xs text-amber-700 max-h-28 overflow-y-auto">
                  {result.data.unmatchedProducts.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
                <p className="text-xs text-amber-600 mt-2">
                  Add these products to your Products or Raw Materials list with the exact name, then re-import.
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-center pt-2">
              <Button onClick={() => setResult(null)} className="bg-blue-600 hover:bg-blue-700 text-white">
                Import Another File
              </Button>
              <a href="/analytics" className="inline-flex items-center gap-2 rounded-xl border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50 transition">
                <TrendingUp size={15} /> View P&amp;L Analytics
              </a>
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {result && !result.success && (
          <div className="p-6 bg-red-50 border border-red-200 rounded-xl mt-2">
            <div className="flex items-center gap-2 text-red-700 font-bold mb-2"><XCircle size={18} /> Import Failed</div>
            <p className="text-sm text-red-600 mb-3">{result.message}</p>
            {result.unmatched?.length > 0 && (
              <ul className="list-disc pl-5 text-xs text-red-500">
                {result.unmatched.slice(0, 10).map((u, i) => <li key={i}>{u}</li>)}
              </ul>
            )}
            <button onClick={() => setResult(null)} className="mt-4 text-xs font-bold text-red-700 hover:underline">Try Again</button>
          </div>
        )}
      </Card>
    </div>
  );
}
