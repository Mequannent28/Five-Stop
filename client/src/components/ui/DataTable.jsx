import React from 'react';

const DataTable = ({
  columns,
  data,
  emptyMessage = 'No records found.',
}) => {
  const count = data.length;

  return (
    <div className="overflow-hidden rounded-xl border border-blue-200/70 bg-white shadow-soft">

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead style={{ background: 'linear-gradient(90deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%)' }}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100"
                  style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-ink-400">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {data.map((row, i) => (
              <tr
                key={row._id || i}
                className="hover:bg-blue-50/30 transition-colors"
                style={{ borderBottom: '1px solid #f1f5f9' }}
              >
                {columns.map((col) => (
                  <td key={col.key} className="whitespace-nowrap px-4 py-3 text-ink-700">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Footer count ── */}
      <div className="border-t border-ink-100 px-4 py-2 text-xs text-ink-400">
        {count} {count === 1 ? 'record' : 'records'}
      </div>
    </div>
  );
};

export default DataTable;
