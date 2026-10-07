import React from 'react';

/**
 * DataTable
 *
 * Props:
 *  columns      – array of { key, header, render? }
 *  data         – array of row objects
 *  emptyMessage – string shown when data is empty
 *  title        – string  — shown in the blue banner header
 *  icon         – ReactNode (e.g. a lucide icon element) — shown left of title
 *  subtitle     – string — small text shown beneath the title (e.g. current month)
 *  countLabel   – string — right-side count label, defaults to "{n} record(s)"
 */
const DataTable = ({
  columns,
  data,
  emptyMessage = 'No records found.',
  title,
  icon,
  subtitle,
  countLabel,
}) => {
  const count = data.length;
  const defaultCountLabel = `${count} ${count === 1 ? 'record' : 'records'}`;
  const displayedCount = countLabel ?? defaultCountLabel;

  /* current month label  e.g. "October 2026" */
  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="overflow-hidden rounded-xl border border-blue-200/70 bg-white shadow-soft">

      {/* ── Blue banner header (only when title is provided) ── */}
      {title && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-2.5"
          style={{
            background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 60%, #3b82f6 100%)',
          }}
        >
          {/* Left: icon + title + subtitle */}
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <span className="flex-shrink-0 text-blue-200">
                {icon}
              </span>
            )}
            <span className="font-bold text-sm text-white truncate">
              {title}
            </span>
            {(subtitle || monthLabel) && (
              <span className="hidden sm:inline text-xs font-medium text-blue-200 truncate">
                {subtitle ?? monthLabel}
              </span>
            )}
          </div>

          {/* Right: count badge */}
          <span className="flex-shrink-0 flex items-center gap-1.5 rounded-full bg-white/15 border border-white/25 px-3 py-0.5 text-xs font-bold text-white whitespace-nowrap">
            {displayedCount}
            {/* chevron decoration */}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M3 8L6 5L9 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </div>
      )}

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

      {/* ── Footer count (only when no banner) ── */}
      {!title && (
        <div className="border-t border-ink-100 px-4 py-2 text-xs text-ink-400">
          {displayedCount}
        </div>
      )}
    </div>
  );
};

export default DataTable;
