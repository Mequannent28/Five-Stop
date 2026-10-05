import * as XLSX from 'xlsx';

/**
 * Export data array to Excel (.xlsx) file
 */
export function exportToExcel(data, fileName = 'export', sheetName = 'Data') {
  if (!data || data.length === 0) {
    alert('No data to export.');
    return;
  }
  const ws = XLSX.utils.json_to_sheet(data);

  // Auto-fit column widths
  const colWidths = [];
  const keys = Object.keys(data[0] || {});
  keys.forEach((key) => {
    let maxLen = key.length;
    data.forEach((row) => {
      const val = row[key];
      if (val !== undefined && val !== null) {
        const len = String(val).length;
        if (len > maxLen) maxLen = len;
      }
    });
    colWidths.push({ wch: Math.min(Math.max(maxLen + 3, 10), 40) });
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

/**
 * Export data array to CSV (.csv) file
 */
export function exportToCSV(data, fileName = 'export') {
  if (!data || data.length === 0) {
    alert('No data to export.');
    return;
  }
  const ws = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export / Print data as high-res PDF document
 */
export function exportToPDF({
  title = 'Inventory Report',
  columns = [],
  data = [],
  hotelName = 'Nobir Trading Plc Stock / Five Stop',
  summary = null,
}) {
  if (!data || data.length === 0) {
    alert('No data to export.');
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to export / print PDF.');
    return;
  }

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const theadHtml = columns
    .map(
      (c) =>
        `<th style="padding: 9px 12px; background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: ${
          c.align || 'left'
        }; font-size: 11px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">${
          c.header
        }</th>`
    )
    .join('');

  const tbodyHtml = data
    .map((row, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      const cells = columns
        .map((c) => {
          const val =
            typeof c.accessor === 'function'
              ? c.accessor(row)
              : row[c.accessor] ?? '—';
          return `<td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: ${
            c.align || 'left'
          }; font-size: 11px; color: #334155;">${val}</td>`;
        })
        .join('');
      return `<tr style="background-color: ${bg};">${cells}</tr>`;
    })
    .join('');

  const summaryHtml = summary
    ? `<div style="display: flex; gap: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
        ${summary
          .map(
            (s) => `
          <div>
            <div style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600;">${s.label}</div>
            <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 2px;">${s.value}</div>
          </div>
        `
          )
          .join('')}
      </div>`
    : '';

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title} - ${hotelName}</title>
        <style>
          @page { size: landscape; margin: 12mm 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 15px; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
          .hotel-title { font-size: 20px; font-weight: 800; letter-spacing: 0.5px; margin: 0 0 4px 0; color: #0f172a; }
          .doc-title { font-size: 14px; font-weight: 700; color: #2563eb; margin: 0 0 4px 0; text-transform: uppercase; }
          .date { font-size: 11px; color: #64748b; margin: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 6px; }
          .footer { margin-top: 20px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="hotel-title">${hotelName}</h1>
          <div class="doc-title">${title}</div>
          <p class="date">Printed on: ${dateStr} · Total Items: ${data.length}</p>
        </div>
        ${summaryHtml}
        <table>
          <thead><tr>${theadHtml}</tr></thead>
          <tbody>${tbodyHtml}</tbody>
        </table>
        <div class="footer">
          <span>Five Stop Hotel Inventory & Stock Management System</span>
          <span>Confidential Internal Document</span>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 250);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
