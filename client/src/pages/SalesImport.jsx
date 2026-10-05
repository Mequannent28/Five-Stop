import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../api/axios';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { UploadCloud, CheckCircle, AlertTriangle, ArrowRight, XCircle } from 'lucide-react';

export default function SalesImport() {
  const [fileData, setFileData] = useState(null); // Array of row objects
  const [columns, setColumns] = useState([]);
  
  // Mapping state
  const [productCol, setProductCol] = useState('');
  const [qtyCol, setQtyCol] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      if (data.length > 0) {
        setFileData(data);
        const cols = Object.keys(data[0]);
        setColumns(cols);
        
        // Auto-guess columns
        const guessProduct = cols.find(c => c.toLowerCase().includes('product') || c.toLowerCase().includes('item'));
        const guessQty = cols.find(c => c.toLowerCase().includes('qty') || c.toLowerCase().includes('quantity'));
        
        if (guessProduct) setProductCol(guessProduct);
        if (guessQty) setQtyCol(guessQty);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSubmit = async () => {
    if (!productCol) return alert('Please select the Product column.');
    
    // Map data
    const salesData = fileData.map((row) => ({
      productName: row[productCol],
      quantity: qtyCol ? row[qtyCol] : 1, // Default to 1 if no qty column
      reference: row['Code'] || row['Reference'] || 'Excel Import',
    })).filter(item => item.productName);

    setLoading(true);
    setResult(null);

    try {
      const res = await api.post('/transactions/import-sales', {
        sales: salesData,
        notes: 'Imported via External Sales Excel Report',
      });
      setResult({ success: true, data: res.data });
      setFileData(null); // Reset on success
    } catch (err) {
      setResult({
        success: false,
        message: err.response?.data?.message || 'Failed to import sales.',
        unmatched: err.response?.data?.unmatchedProducts || [],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">
          Import External Sales
        </h1>
        <p className="text-sm text-ink-400 mt-1">
          Upload your POS or sales report Excel/CSV file to automatically deduct stock
        </p>
      </div>

      <Card>
        {!fileData && (
          <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-ink-200 rounded-xl bg-ink-50 hover:bg-ink-100 transition">
            <UploadCloud size={40} className="text-blue-500 mb-4" />
            <p className="text-sm font-semibold text-ink-800">Upload Sales Report (Excel/CSV)</p>
            <p className="text-xs text-ink-500 mt-1 mb-4 text-center max-w-sm">
              Please ensure your file has a column for the Product Name. A Quantity column is optional (defaults to 1 if missing).
            </p>
            <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-blue-700 transition">
              Browse File
              <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        )}

        {fileData && !result?.success && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-ink-100 pb-4">
              <div>
                <h3 className="font-semibold text-ink-900">Map File Columns</h3>
                <p className="text-xs text-ink-500">Found {fileData.length} rows in the uploaded file.</p>
              </div>
              <button onClick={() => setFileData(null)} className="text-xs text-red-600 font-semibold hover:underline">
                Cancel / Upload Different File
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-ink-700 mb-1">
                  Which column contains the Product Name? <span className="text-red-500">*</span>
                </label>
                <select
                  value={productCol}
                  onChange={e => setProductCol(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 py-2.5 px-3 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">-- Select Column --</option>
                  {columns.map(col => <option key={col} value={col}>{col}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-ink-700 mb-1">
                  Which column contains the Quantity? (Optional)
                </label>
                <select
                  value={qtyCol}
                  onChange={e => setQtyCol(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 py-2.5 px-3 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">-- No Quantity Column (Defaults to 1) --</option>
                  {columns.map(col => <option key={col} value={col}>{col}</option>)}
                </select>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800">
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="flex-shrink-0 mt-0.5 text-blue-600" />
                <div>
                  <p className="font-bold mb-1">How it works:</p>
                  <p className="text-xs">The system will match the products in your file against the database. If a match is found, its ingredients (or the raw material directly) will be deducted from your stock. Items that don't match exactly will be skipped.</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-ink-100">
              <Button onClick={handleSubmit} disabled={loading || !productCol} className="bg-blue-600 hover:bg-blue-700 text-white shadow">
                {loading ? 'Processing Import...' : 'Confirm & Deduct Stock'} <ArrowRight size={15} />
              </Button>
            </div>
          </div>
        )}

        {result && result.success && (
          <div className="text-center p-8 space-y-4">
            <CheckCircle size={50} className="text-emerald-500 mx-auto" />
            <div>
              <h2 className="text-xl font-bold text-ink-900">Import Successful!</h2>
              <p className="text-sm text-ink-500 mt-1">Stock levels have been successfully deducted based on the sales report.</p>
            </div>
            
            {result.data.unmatchedProducts && result.data.unmatchedProducts.length > 0 && (
              <div className="mt-6 bg-amber-50 border border-amber-200 p-4 rounded-xl text-left">
                <p className="text-sm font-bold text-amber-800 flex items-center gap-2">
                  <AlertTriangle size={16} /> Some products were not found:
                </p>
                <ul className="list-disc pl-8 mt-2 text-xs text-amber-700 max-h-32 overflow-y-auto">
                  {result.data.unmatchedProducts.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-4">
              <Button onClick={() => setResult(null)} className="bg-ink-800 hover:bg-ink-900 text-white">
                Import Another File
              </Button>
            </div>
          </div>
        )}

        {result && !result.success && (
           <div className="p-6 bg-red-50 border border-red-200 rounded-xl mt-4">
             <div className="flex items-center gap-2 text-red-700 font-bold mb-2">
               <XCircle size={18} /> Import Failed
             </div>
             <p className="text-sm text-red-600 mb-4">{result.message}</p>
             
             {result.unmatched && result.unmatched.length > 0 && (
               <div className="text-xs text-red-500">
                 <p className="font-semibold mb-1">Unmatched Items:</p>
                 <ul className="list-disc pl-5">
                   {result.unmatched.slice(0, 10).map((u, i) => <li key={i}>{u}</li>)}
                   {result.unmatched.length > 10 && <li>...and {result.unmatched.length - 10} more</li>}
                 </ul>
               </div>
             )}
             
             <button onClick={() => setResult(null)} className="mt-4 text-xs font-bold text-red-700 hover:underline">
               Try Again
             </button>
           </div>
        )}
      </Card>
    </div>
  );
}
