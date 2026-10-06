import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const titles = {
  '/': 'Dashboard',
  '/materials': 'Raw Materials',
  '/products': 'Sales Products & Recipes',
  '/analytics': 'Analytics & Performance',
  '/transactions': 'Stock Movements',
  '/transactions/cash-grv': 'Cash GRV Entries',
  '/transactions/credit-grv': 'Credit GRV Entries',
  '/transactions/fresh-bazaar': 'Fresh Bazaar Entries',
  '/transactions/pos-adjustment': '+ve Adjustment Entries',
  '/transactions/disposal': 'Goods Disposal Entries',
  '/transactions/neg-adjustment': '−ve Adjustment Entries',
  '/sales-import': 'Sales & POS Import',
  '/purchases': 'Purchases',
  '/suppliers': 'Suppliers Directory',
  '/reports': 'Reports & Analytics',
  '/reports/summary': 'Overview Summary Report',
  '/reports/stock-balance': 'Stock Balance Sheet',
  '/reports/inventory-count': 'Inventory Count',
  '/reports/daily': 'Daily Movement Report',
  '/reports/cash-grv': 'Cash GRV Report',
  '/reports/credit-grv': 'Credit GRV Report',
  '/reports/fresh-bazaar': 'Fresh Bazaar Report',
  '/reports/pos-adjustment': '+ve Adjustment Report',
  '/reports/disposal': 'Goods Disposal Report',
  '/reports/neg-adjustment': '−ve Adjustment Report',
  '/reports/stock-levels': 'Stock Levels Report',
  '/reports/purchases': 'Purchases Report',
  '/users': 'Staff Accounts',
  '/settings': 'System Settings',
  '/profile': 'User Profile',
};

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const title = titles[location.pathname] || 'Nobir Trading Plc Stock';

  return (
    <div className="flex h-screen overflow-hidden bg-ink-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onMenuClick={() => setSidebarOpen(true)} title={title} />
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 flex flex-col justify-between">
          <div>
            <Outlet />
          </div>
          <footer className="mt-12 pt-6 border-t border-ink-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-400 pb-2">
            <p>© 2026 Five Stop Hotel Management System · All rights reserved.</p>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span>Developed &amp; Powered by <strong className="text-ink-700 font-semibold">Mequannent Gashaw</strong></span>
              <div className="flex items-center gap-1.5">
                <a
                  href="https://t.me/+251918592028"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-700 px-2 py-0.5 text-[11px] font-semibold border border-sky-200 transition"
                >
                  <svg className="w-3 h-3 fill-current text-sky-600" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.05-.2-.06-.05-.16-.03-.23-.02-.1.02-1.68 1.07-4.75 3.14-.45.31-.86.46-1.22.45-.4-.01-1.17-.23-1.74-.41-.7-.23-1.26-.35-1.21-.74.03-.2.3-.41.83-.62 3.25-1.42 5.42-2.35 6.52-2.8 3.11-1.29 3.75-1.51 4.18-1.52.09 0 .31.02.45.14.12.1.15.24.17.34-.01.07.01.21 0 .28z"/>
                  </svg>
                  Telegram
                </a>
                <a
                  href="https://wa.me/251918592028"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[11px] font-semibold border border-emerald-200 transition"
                >
                  <svg className="w-3 h-3 fill-current text-emerald-600" viewBox="0 0 24 24">
                    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.13 7.42C8.94 7.42 8.64 7.49 8.38 7.78C8.12 8.06 7.39 8.75 7.39 10.15C7.39 11.55 8.41 12.9 8.55 13.09C8.69 13.28 10.55 16.14 13.4 17.37C14.08 17.66 14.61 17.84 15.02 17.97C15.7 18.19 16.32 18.16 16.81 18.08C17.36 18 18.5 17.39 18.74 16.72C18.98 16.05 18.98 15.48 18.91 15.36C18.84 15.24 18.65 15.17 18.36 15.03C18.08 14.89 16.7 14.21 16.44 14.12C16.19 14.02 16 13.98 15.82 14.26C15.63 14.54 15.11 15.17 14.95 15.36C14.79 15.54 14.63 15.57 14.35 15.42C14.06 15.28 13.15 14.98 12.07 14.02C11.23 13.27 10.66 12.35 10.5 12.07C10.34 11.78 10.48 11.63 10.63 11.49C10.76 11.36 10.92 11.15 11.06 10.98C11.21 10.82 11.25 10.7 11.35 10.51C11.44 10.32 11.39 10.16 11.32 10.02C11.25 9.88 10.7 8.53 10.47 7.98C10.25 7.44 10.02 7.52 9.85 7.51C9.69 7.51 9.5 7.42 9.13 7.42Z"/>
                  </svg>
                  WhatsApp
                </a>
                <a href="tel:0918592028" className="font-mono text-ink-600 font-semibold hover:text-blue-600 pl-0.5">
                  0918592028
                </a>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
