import React, { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, Printer, ChevronDown, Upload } from 'lucide-react';
import { exportToExcel, exportToCSV, exportToPDF } from '../../utils/exportUtils';

export default function ExportDropdown({
  data = [],
  fileName = 'report',
  sheetName = 'Data',
  pdfTitle = 'Inventory Report',
  pdfColumns = [],
  pdfSummary = null,
  showImport = false,
  onImport = null,
  importLabel = 'Import',
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleExcel = () => {
    setOpen(false);
    exportToExcel(data, fileName, sheetName);
  };

  const handleCSV = () => {
    setOpen(false);
    exportToCSV(data, fileName);
  };

  const handlePDF = () => {
    setOpen(false);
    exportToPDF({
      title: pdfTitle,
      columns: pdfColumns,
      data,
      summary: pdfSummary,
    });
  };

  return (
    <div className="flex items-center gap-2">
      {/* Optional Direct Import Button */}
      {showImport && onImport && (
        <button
          onClick={onImport}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-700 shadow-xs hover:border-ink-300 hover:bg-ink-50 transition"
          title="Import from Excel or CSV"
        >
          <Upload size={14} className="text-blue-600" />
          <span>{importLabel}</span>
        </button>
      )}

      {/* Export Dropdown */}
      <div className="relative inline-block text-left" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-700 shadow-xs hover:border-ink-300 hover:bg-ink-50 transition"
          title="Export Data as Excel, PDF, or CSV"
        >
          <Download size={14} className="text-blue-600" />
          <span>Export</span>
          <ChevronDown size={12} className={`text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute right-0 z-30 mt-1.5 w-52 origin-top-right rounded-xl border border-ink-100 bg-white p-1.5 shadow-lg ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100">
            <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400 border-b border-ink-50">
              Export Formats
            </div>

            <button
              onClick={handleExcel}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-ink-700 hover:bg-emerald-50 hover:text-emerald-800 transition"
            >
              <FileSpreadsheet size={15} className="text-emerald-600" />
              <div className="text-left">
                <p className="font-semibold leading-tight">Excel Spreadsheet</p>
                <p className="text-[10px] text-ink-400">Microsoft Excel (.xlsx)</p>
              </div>
            </button>

            <button
              onClick={handlePDF}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-ink-700 hover:bg-red-50 hover:text-red-800 transition"
            >
              <FileText size={15} className="text-red-600" />
              <div className="text-left">
                <p className="font-semibold leading-tight">PDF Document</p>
                <p className="text-[10px] text-ink-400">Print / Save as PDF (.pdf)</p>
              </div>
            </button>

            <button
              onClick={handleCSV}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-ink-700 hover:bg-blue-50 hover:text-blue-800 transition"
            >
              <FileSpreadsheet size={15} className="text-blue-600" />
              <div className="text-left">
                <p className="font-semibold leading-tight">CSV Spreadsheet</p>
                <p className="text-[10px] text-ink-400">Comma-separated (.csv)</p>
              </div>
            </button>

            <button
              onClick={handlePDF}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50 transition border-t border-ink-50 mt-1"
            >
              <Printer size={15} className="text-ink-500" />
              <div className="text-left">
                <p className="font-semibold leading-tight">Print Report</p>
                <p className="text-[10px] text-ink-400">Clean formatted view</p>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
