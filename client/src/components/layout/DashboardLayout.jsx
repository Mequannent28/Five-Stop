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
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
