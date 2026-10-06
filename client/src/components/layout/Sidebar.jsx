import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Truck, Boxes, ShoppingCart,
  ArrowLeftRight, FileBarChart, Users, UtensilsCrossed,
  ChevronDown, ChevronRight,
  ShoppingBag, CreditCard, Leaf, TrendingUp, Flame, TrendingDown,
  BarChart2, Calendar, PackageOpen, Settings as SettingsIcon, UploadCloud,
  Scale, ClipboardList
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// ── Stock Movements sub-items ─────────────────────────────────────────
const STOCK_ITEMS = [
  { to: '/transactions',                label: 'All Movements',           icon: ArrowLeftRight, end: true },
  { to: '/transactions/cash-grv',       label: 'Cash Goods Receiving',    icon: ShoppingBag  },
  { to: '/transactions/credit-grv',     label: 'Credit Goods Receiving',  icon: CreditCard   },
  { to: '/transactions/fresh-bazaar',   label: 'Fresh Bazaar Receiving',  icon: Leaf         },
  { to: '/transactions/pos-adjustment', label: 'Positive Adjustment',     icon: TrendingUp   },
  { to: '/transactions/disposal',       label: 'Goods Disposal',          icon: Flame        },
  { to: '/transactions/neg-adjustment', label: 'Negative Adjustment',     icon: TrendingDown },
  { to: '/sales-import',                label: 'Import Sales Report',     icon: UploadCloud  },
];

// ── Reports sub-items ─────────────────────────────────────────────────
const REPORT_ITEMS = [
  { to: '/reports/summary',          label: 'Overview',              icon: BarChart2      },
  { to: '/reports/stock-balance',    label: 'Stock Balance Sheet',   icon: Scale          },
  { to: '/reports/inventory-count',  label: 'Inventory Count',       icon: ClipboardList  },
  { to: '/reports/daily',            label: 'Daily Report',          icon: Calendar       },
  { to: '/reports/cash-grv',         label: 'Cash GRV Report',       icon: ShoppingBag    },
  { to: '/reports/credit-grv',       label: 'Credit GRV Report',     icon: CreditCard     },
  { to: '/reports/fresh-bazaar',     label: 'Fresh Bazaar Report',   icon: Leaf           },
  { to: '/reports/pos-adjustment',   label: '+ve Adjustment Report', icon: TrendingUp     },
  { to: '/reports/disposal',         label: 'Disposal Report',       icon: Flame          },
  { to: '/reports/neg-adjustment',   label: '−ve Adjustment Report', icon: TrendingDown   },
  { to: '/reports/stock-levels',     label: 'Stock Levels',          icon: PackageOpen    },
  { to: '/reports/purchases',        label: 'Purchase History',      icon: ShoppingCart   },
];

// ── Top-level items (excluding stock movements & reports handled below) ─
const NAV_BEFORE = [
  { to: '/',          label: 'Dashboard',       icon: LayoutDashboard, roles: ['admin','manager','storekeeper'] },
  { to: '/materials', label: 'Raw Materials',   icon: Boxes,           roles: ['admin','manager','storekeeper'] },
  { to: '/products',  label: 'Products',        icon: UtensilsCrossed, roles: ['admin','manager','storekeeper'] },
  { to: '/analytics', label: 'Analytics & P&L', icon: TrendingUp,      capability: 'viewReports', roles: ['admin','manager'] },
];
const NAV_AFTER = [
  { to: '/purchases', label: 'Purchases',     icon: ShoppingCart, capability: 'recordGoods', roles: ['admin','manager'] },
  { to: '/suppliers', label: 'Suppliers',     icon: Truck,        roles: ['admin','manager'] },
];

// ── Reusable sub-item link ────────────────────────────────────────────
const SubLink = ({ to, label, icon: Icon, end = false, onClick }) => (
  <NavLink
    to={to} end={end}
    onClick={onClick}
    className={({ isActive }) =>
      `flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-all ${
        isActive ? 'bg-white/25 text-white font-semibold' : 'text-blue-200 hover:bg-white/10 hover:text-white'
      }`}
  >
    <Icon size={13} />
    {label}
  </NavLink>
);

// ── Collapsible section ───────────────────────────────────────────────
const CollapsibleNav = ({ label, icon: Icon, isActive, open, onToggle, children }) => (
  <div>
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all
        ${isActive ? 'bg-white/20 text-white shadow-sm backdrop-blur-sm' : 'text-blue-100 hover:bg-white/10 hover:text-white'}`}
    >
      <Icon size={18} strokeWidth={2} />
      <span className="flex-1 text-left">{label}</span>
      {open ? <ChevronDown size={14} className="opacity-60" /> : <ChevronRight size={14} className="opacity-60" />}
    </button>
    {open && (
      <div className="mt-0.5 ml-4 border-l border-white/20 pl-3 space-y-0.5">
        {children}
      </div>
    )}
  </div>
);

// ── Sidebar ───────────────────────────────────────────────────────────
const Sidebar = ({ open, onClose }) => {
  const { user, can } = useAuth();
  const location = useLocation();

  const onTransactions = location.pathname.startsWith('/transactions');
  const onReports      = location.pathname.startsWith('/reports');

  const [stockOpen,  setStockOpen]  = useState(onTransactions);
  const [reportOpen, setReportOpen] = useState(onReports);

  const canSeeStock   = can('recordGoods') || ['admin','manager','storekeeper'].includes(user?.role);
  const canSeeReports = can('viewReports');

  const linkCls = (isActive) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
      isActive ? 'bg-white/20 text-white shadow-sm backdrop-blur-sm' : 'text-blue-100 hover:bg-white/10 hover:text-white'
    }`;

  const isItemVisible = (item) => {
    if (item.capability) return can(item.capability);
    return item.roles ? item.roles.includes(user?.role) : true;
  };

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed z-40 flex h-full w-64 flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: 'linear-gradient(180deg, #0d2d80 0%, #1a56db 100%)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-md overflow-hidden">
            <svg viewBox="0 0 40 40" width="36" height="36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="40" height="40" rx="8" fill="#1a56db"/>
              <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle"
                fill="white" fontSize="13" fontWeight="bold">
                5S
              </text>
            </svg>
          </div>
          <div>
            <p className="text-lg font-bold leading-none text-white tracking-wide">Five Stop</p>
            <p className="text-xs text-blue-200 mt-0.5">Inventory</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="mt-1 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">

          {/* Before-group items */}
          {NAV_BEFORE.filter(isItemVisible).map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={onClose}
              className={({ isActive }) => linkCls(isActive)}>
              <Icon size={18} strokeWidth={2} />{label}
            </NavLink>
          ))}

          {/* ── Stock Movements ── */}
          {canSeeStock && (
            <CollapsibleNav
              label="Stock Movements"
              icon={ArrowLeftRight}
              isActive={onTransactions}
              open={stockOpen}
              onToggle={() => setStockOpen(o => !o)}
            >
              {STOCK_ITEMS.map(item => (
                <SubLink key={item.to} {...item} onClick={onClose} />
              ))}
            </CollapsibleNav>
          )}

          {/* After-group items (Purchases, Suppliers) */}
          {NAV_AFTER.filter(isItemVisible)
            .filter(i => i.to !== '/reports')
            .map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} onClick={onClose}
                className={({ isActive }) => linkCls(isActive)}>
                <Icon size={18} strokeWidth={2} />{label}
              </NavLink>
          ))}

          {/* ── Reports ── */}
          {canSeeReports && (
            <CollapsibleNav
              label="Reports"
              icon={FileBarChart}
              isActive={onReports}
              open={reportOpen}
              onToggle={() => setReportOpen(o => !o)}
            >
              {REPORT_ITEMS.map(item => (
                <SubLink key={item.to} {...item} onClick={onClose} />
              ))}
            </CollapsibleNav>
          )}

          {/* Staff Accounts */}
          {(can('manageAccounts') || user?.role === 'admin') && (
            <NavLink to="/users" onClick={onClose}
              className={({ isActive }) => linkCls(isActive)}>
              <Users size={18} strokeWidth={2} /> Staff Accounts
            </NavLink>
          )}

          {/* Settings */}
          <NavLink to="/settings" onClick={onClose}
            className={({ isActive }) => linkCls(isActive)}>
            <SettingsIcon size={18} strokeWidth={2} /> Settings
          </NavLink>
        </nav>

        {/* User info */}
        <div className="mx-3 mb-5 rounded-xl bg-white/10 backdrop-blur-sm p-3 text-xs text-blue-200 flex items-center gap-3">
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user?.name}
              className="h-9 w-9 rounded-xl object-cover ring-1 ring-white/30 flex-shrink-0"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 font-bold text-white text-sm flex-shrink-0">
              {user?.name?.[0]?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <span className="text-[10px] text-blue-200/80 leading-none">Signed in as</span>
            <p className="mt-0.5 truncate text-sm font-semibold text-white leading-tight">{user?.name}</p>
            <p className="capitalize text-blue-300 text-[11px] leading-tight">{user?.role}</p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
