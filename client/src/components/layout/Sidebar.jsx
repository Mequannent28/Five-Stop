import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Truck, Boxes, ShoppingCart,
  ArrowLeftRight, FileBarChart, Users, UtensilsCrossed,
  ChevronDown, ChevronRight,
  ShoppingBag, CreditCard, Leaf, TrendingUp, Flame, TrendingDown,
  BarChart2, Calendar, PackageOpen, Settings as SettingsIcon, UploadCloud,
  Scale, ClipboardList, Trash2, Coffee, UserCog,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

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

/* ── Sub-item link (only shown when expanded) ── */
const SubLink = ({ to, label, icon: Icon, end = false, onClick }) => (
  <NavLink
    to={to} end={end} onClick={onClick}
    className={({ isActive }) =>
      `flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-all ${
        isActive ? 'bg-white/25 text-white font-semibold' : 'text-blue-200 hover:bg-white/10 hover:text-white'
      }`
    }
  >
    <Icon size={13} />
    {label}
  </NavLink>
);

/* ── Collapsible section ── */
const CollapsibleNav = ({ label, icon: Icon, isActive, open, onToggle, children, collapsed }) => (
  <div>
    <button
      onClick={onToggle}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all
        ${isActive ? 'bg-white/20 text-white shadow-sm backdrop-blur-sm' : 'text-blue-100 hover:bg-white/10 hover:text-white'}
        ${collapsed ? 'justify-center' : ''}`}
    >
      <Icon size={18} strokeWidth={2} className="shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1 text-left">{label}</span>
          {open ? <ChevronDown size={14} className="opacity-60" /> : <ChevronRight size={14} className="opacity-60" />}
        </>
      )}
    </button>
    {open && !collapsed && (
      <div className="mt-0.5 ml-4 border-l border-white/20 pl-3 space-y-0.5">
        {children}
      </div>
    )}
  </div>
);

/* ══ Sidebar ══ */
const Sidebar = ({ open, onClose, collapsed = false }) => {
  const { user, canSeeNav } = useAuth();
  const location = useLocation();

  const onTransactions = location.pathname.startsWith('/transactions');
  const onReports      = location.pathname.startsWith('/reports');

  const [stockOpen,  setStockOpen]  = useState(onTransactions);
  const [reportOpen, setReportOpen] = useState(onReports);

  /* Active link classes */
  const linkCls = (isActive) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
      collapsed ? 'justify-center' : ''
    } ${
      isActive
        ? 'bg-white/20 text-white shadow-sm backdrop-blur-sm'
        : 'text-blue-100 hover:bg-white/10 hover:text-white'
    }`;

  /* Collapsed icon-only link */
  const iconLink = (to, Icon, label, end = false) => (
    <NavLink to={to} end={end} onClick={onClose} title={label}
      className={({ isActive }) => linkCls(isActive)}>
      <Icon size={18} strokeWidth={2} />
    </NavLink>
  );

  /* Full label link */
  const fullLink = (to, Icon, label, end = false) => (
    <NavLink to={to} end={end} onClick={onClose}
      className={({ isActive }) => linkCls(isActive)}>
      <Icon size={18} strokeWidth={2} />
      <span>{label}</span>
    </NavLink>
  );

  const navLink = (to, Icon, label, end = false) =>
    collapsed ? iconLink(to, Icon, label, end) : fullLink(to, Icon, label, end);

  return (
    <>
      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} />}

      <aside
        className={`
          fixed z-40 flex h-full flex-col transition-all duration-300 ease-in-out
          lg:static lg:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}
          ${collapsed ? 'w-16' : 'w-64'}
        `}
        style={{ background: 'linear-gradient(180deg, #0d2d80 0%, #1a56db 100%)' }}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 px-3 py-5 ${collapsed ? 'justify-center px-0' : 'px-6'}`}>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-md overflow-hidden">
            <svg viewBox="0 0 40 40" width="36" height="36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="40" height="40" rx="8" fill="#1a56db"/>
              <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle"
                fill="white" fontSize="13" fontWeight="bold">5S</text>
            </svg>
          </div>
          {!collapsed && (
            <div>
              <p className="text-lg font-bold leading-none text-white tracking-wide">Five Stop</p>
              <p className="text-xs text-blue-200 mt-0.5">Inventory</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="mt-1 flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden px-2 pb-4">

          {canSeeNav('dashboard') && navLink('/', LayoutDashboard, 'Dashboard', true)}

          {canSeeNav('rawMaterials') && navLink('/materials', Boxes, 'Raw Materials')}

          {canSeeNav('products') && navLink('/products', UtensilsCrossed, 'Products')}

          {canSeeNav('analytics') && navLink('/analytics', TrendingUp, 'Analytics & P&L')}

          {/* Stock Movements */}
          {canSeeNav('stockMovements') && (
            collapsed ? (
              <NavLink to="/transactions" onClick={onClose} title="Stock Movements"
                className={({ isActive }) => linkCls(isActive || onTransactions)}>
                <ArrowLeftRight size={18} strokeWidth={2} />
              </NavLink>
            ) : (
              <CollapsibleNav
                label="Stock Movements" icon={ArrowLeftRight}
                isActive={onTransactions} open={stockOpen}
                onToggle={() => setStockOpen(o => !o)}
                collapsed={collapsed}
              >
                {STOCK_ITEMS.map(item => (
                  <SubLink key={item.to} {...item} onClick={onClose} />
                ))}
              </CollapsibleNav>
            )
          )}

          {canSeeNav('suppliers') && navLink('/suppliers', Truck, 'Suppliers')}

          {canSeeNav('consumption') && navLink('/consumption', Coffee, 'Consumption')}

          {/* Reports */}
          {canSeeNav('reports') && (
            collapsed ? (
              <NavLink to="/reports" onClick={onClose} title="Reports"
                className={({ isActive }) => linkCls(isActive || onReports)}>
                <FileBarChart size={18} strokeWidth={2} />
              </NavLink>
            ) : (
              <CollapsibleNav
                label="Reports" icon={FileBarChart}
                isActive={onReports} open={reportOpen}
                onToggle={() => setReportOpen(o => !o)}
                collapsed={collapsed}
              >
                {REPORT_ITEMS.map(item => (
                  <SubLink key={item.to} {...item} onClick={onClose} />
                ))}
              </CollapsibleNav>
            )
          )}

          {canSeeNav('staffAccounts') && navLink('/users', Users, 'Staff Accounts')}

          {canSeeNav('staffAccounts') && navLink('/employees', UserCog, 'Employees')}

          {navLink('/settings', SettingsIcon, 'Settings')}

          {/* Recycle Bin */}
          {(canSeeNav('staffAccounts') || user?.role === 'admin' || user?.role === 'manager') && (
            <NavLink to="/recycle-bin" onClick={onClose} title="Recycle Bin"
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  collapsed ? 'justify-center' : ''
                } ${
                  isActive
                    ? 'bg-red-500/30 text-white shadow-sm'
                    : 'text-red-300 hover:bg-red-500/20 hover:text-white'
                }`
              }
            >
              <Trash2 size={18} strokeWidth={2} />
              {!collapsed && <span>Recycle Bin</span>}
            </NavLink>
          )}
        </nav>

        {/* User info — hide detail when collapsed */}
        <div className={`mx-2 mb-5 rounded-xl bg-white/10 backdrop-blur-sm p-3 text-xs text-blue-200 flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          {user?.avatar ? (
            <img src={user.avatar} alt={user?.name}
              className="h-9 w-9 rounded-xl object-cover ring-1 ring-white/30 flex-shrink-0" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 font-bold text-white text-sm"
              title={user?.name}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-blue-200/80 leading-none">Signed in as</span>
              <p className="mt-0.5 truncate text-sm font-semibold text-white leading-tight">{user?.name}</p>
              <p className="capitalize text-blue-300 text-[11px] leading-tight">{user?.role}</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
