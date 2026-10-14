import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Truck, Boxes, ShoppingCart,
  ArrowLeftRight, FileBarChart, Users, UtensilsCrossed,
  ChevronDown, ChevronRight,
  ShoppingBag, CreditCard, Leaf, TrendingUp, Flame, TrendingDown,
  BarChart2, Calendar, PackageOpen, Settings as SettingsIcon, UploadCloud,
  Scale, ClipboardList, Trash2, Coffee, UserCog, Sparkles,
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

/* ── Sub-item link ── */
const SubLink = ({ to, label, icon: Icon, end = false, onClick }) => (
  <NavLink to={to} end={end} onClick={onClick}
    className={({ isActive }) =>
      `group flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
        isActive
          ? 'bg-white/15 text-white font-semibold'
          : 'text-blue-300/80 hover:bg-white/8 hover:text-white'
      }`
    }
  >
    <span className="h-1 w-1 rounded-full bg-current opacity-50 group-hover:opacity-100 transition-opacity" />
    <Icon size={12} className="shrink-0" />
    {label}
  </NavLink>
);

/* ── Section label ── */
const SectionLabel = ({ children, collapsed }) =>
  collapsed ? <div className="my-2 border-t border-white/10" /> : (
    <p className="px-3 pt-3 pb-1 text-[9px] font-bold uppercase tracking-[0.15em] text-blue-400/60 select-none">
      {children}
    </p>
  );

/* ── Collapsible section ── */
const CollapsibleNav = ({ label, icon: Icon, isActive, open, onToggle, children, collapsed }) => (
  <div>
    <button onClick={onToggle} title={collapsed ? label : undefined}
      className={`group w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
        collapsed ? 'justify-center' : ''
      } ${
        isActive
          ? 'bg-white/15 text-white shadow-sm ring-1 ring-white/10'
          : 'text-blue-100/80 hover:bg-white/8 hover:text-white'
      }`}
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all ${
        isActive ? 'bg-white/20' : 'bg-white/5 group-hover:bg-white/10'
      }`}>
        <Icon size={15} strokeWidth={2} />
      </span>
      {!collapsed && (
        <>
          <span className="flex-1 text-left text-[13px]">{label}</span>
          <span className={`transition-transform duration-200 opacity-50 ${open ? 'rotate-180' : ''}`}>
            <ChevronDown size={13} />
          </span>
        </>
      )}
    </button>
    {open && !collapsed && (
      <div className="mt-1 ml-5 border-l border-white/10 pl-2.5 space-y-0.5">
        {children}
      </div>
    )}
  </div>
);

/* ══════════════════════════════════════════
   SIDEBAR
══════════════════════════════════════════ */
const Sidebar = ({ open, onClose, collapsed = false }) => {
  const { user, canSeeNav } = useAuth();
  const location = useLocation();

  const onTransactions = location.pathname.startsWith('/transactions');
  const onReports      = location.pathname.startsWith('/reports');

  const [stockOpen,  setStockOpen]  = useState(onTransactions);
  const [reportOpen, setReportOpen] = useState(onReports);

  const linkCls = (isActive) =>
    `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
      collapsed ? 'justify-center' : ''
    } ${
      isActive
        ? 'bg-white/15 text-white shadow-sm ring-1 ring-white/10'
        : 'text-blue-100/80 hover:bg-white/8 hover:text-white'
    }`;

  const iconSpan = (isActive) =>
    `flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all ${
      isActive ? 'bg-white/20' : 'bg-white/5 group-hover:bg-white/10'
    }`;

  const fullLink = (to, Icon, label, end = false) => (
    <NavLink to={to} end={end} onClick={onClose}
      className={({ isActive }) => linkCls(isActive)}>
      {({ isActive }) => (
        <>
          <span className={iconSpan(isActive)}><Icon size={15} strokeWidth={2} /></span>
          {!collapsed && <span className="text-[13px]">{label}</span>}
          {isActive && !collapsed && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/60" />
          )}
        </>
      )}
    </NavLink>
  );

  const iconLink = (to, Icon, label, end = false) => (
    <NavLink to={to} end={end} onClick={onClose} title={label}
      className={({ isActive }) => linkCls(isActive)}>
      {({ isActive }) => (
        <span className={iconSpan(isActive)}><Icon size={15} strokeWidth={2} /></span>
      )}
    </NavLink>
  );

  const navLink = (to, Icon, label, end = false) =>
    collapsed ? iconLink(to, Icon, label, end) : fullLink(to, Icon, label, end);

  const roleColors = {
    admin:       'from-amber-400 to-orange-500',
    manager:     'from-emerald-400 to-teal-500',
    storekeeper: 'from-blue-400 to-indigo-500',
  };

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden" onClick={onClose} />}

      <aside
        className={`
          fixed z-40 flex h-full flex-col
          transition-all duration-300 ease-in-out
          lg:static lg:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}
          ${collapsed ? 'w-[68px]' : 'w-64'}
        `}
        style={{
          background: 'linear-gradient(160deg, #060d2b 0%, #0a1a52 40%, #0d2680 70%, #1238a8 100%)',
          borderRight: '1px solid rgba(99,130,255,0.15)',
          boxShadow: '4px 0 24px rgba(0,0,50,0.4)',
        }}
      >
        {/* ── Decorative glow orbs ── */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -left-20 h-60 w-60 rounded-full opacity-[0.07]"
            style={{ background: 'radial-gradient(circle, #4f8ef7 0%, transparent 70%)' }} />
          <div className="absolute bottom-20 -right-16 h-48 w-48 rounded-full opacity-[0.05]"
            style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)' }} />
        </div>

        {/* ── Logo ── */}
        <NavLink to="/" onClick={onClose}
          className={`relative flex items-center gap-3 py-5 hover:opacity-90 transition-opacity ${collapsed ? 'justify-center px-2' : 'px-5'}`}>
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl overflow-hidden shadow-lg"
            style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%)' }}>
            <div className="absolute inset-0 opacity-20"
              style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 60%)' }} />
            <svg viewBox="0 0 40 40" width="32" height="32" fill="none">
              <text x="50%" y="56%" dominantBaseline="middle" textAnchor="middle"
                fill="white" fontSize="14" fontWeight="800" letterSpacing="-0.5">5S</text>
            </svg>
            <Sparkles size={8} className="absolute top-1 right-1 text-yellow-300 opacity-80" />
          </div>
          {!collapsed && (
            <div>
              <p className="text-[15px] font-extrabold leading-none text-white tracking-tight">Five Stop</p>
              <p className="text-[10px] text-blue-300/70 mt-0.5 tracking-wide font-medium">Hotel Management</p>
            </div>
          )}
        </NavLink>

        {/* ── Nav ── */}
        <nav className="relative flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden px-2 pb-4
          scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">

          <SectionLabel collapsed={collapsed}>Main</SectionLabel>
          {canSeeNav('dashboard') && navLink('/', LayoutDashboard, 'Dashboard', true)}
          {canSeeNav('rawMaterials') && navLink('/materials', Boxes, 'Raw Materials')}
          {canSeeNav('products') && navLink('/products', UtensilsCrossed, 'Products')}
          {canSeeNav('analytics') && navLink('/analytics', TrendingUp, 'Analytics & P&L')}

          <SectionLabel collapsed={collapsed}>Operations</SectionLabel>

          {/* Stock Movements */}
          {canSeeNav('stockMovements') && (
            collapsed ? (
              <NavLink to="/transactions" onClick={onClose} title="Stock Movements"
                className={({ isActive }) => linkCls(isActive || onTransactions)}>
                {({ isActive }) => (
                  <span className={iconSpan(isActive || onTransactions)}>
                    <ArrowLeftRight size={15} strokeWidth={2} />
                  </span>
                )}
              </NavLink>
            ) : (
              <CollapsibleNav label="Stock Movements" icon={ArrowLeftRight}
                isActive={onTransactions} open={stockOpen}
                onToggle={() => setStockOpen(o => !o)} collapsed={collapsed}>
                {STOCK_ITEMS.map(item => <SubLink key={item.to} {...item} onClick={onClose} />)}
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
                {({ isActive }) => (
                  <span className={iconSpan(isActive || onReports)}>
                    <FileBarChart size={15} strokeWidth={2} />
                  </span>
                )}
              </NavLink>
            ) : (
              <CollapsibleNav label="Reports" icon={FileBarChart}
                isActive={onReports} open={reportOpen}
                onToggle={() => setReportOpen(o => !o)} collapsed={collapsed}>
                {REPORT_ITEMS.map(item => <SubLink key={item.to} {...item} onClick={onClose} />)}
              </CollapsibleNav>
            )
          )}

          <SectionLabel collapsed={collapsed}>Admin</SectionLabel>
          {canSeeNav('staffAccounts') && navLink('/users', Users, 'Staff Accounts')}
          {canSeeNav('staffAccounts') && navLink('/employees', UserCog, 'Employees')}
          {navLink('/settings', SettingsIcon, 'Settings')}

          {/* Recycle Bin */}
          {(canSeeNav('staffAccounts') || user?.role === 'admin' || user?.role === 'manager') && (
            <NavLink to="/recycle-bin" onClick={onClose} title="Recycle Bin"
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  collapsed ? 'justify-center' : ''
                } ${
                  isActive
                    ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/20'
                    : 'text-red-400/60 hover:bg-red-500/10 hover:text-red-300'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all ${
                    isActive ? 'bg-red-500/25' : 'bg-red-500/10 group-hover:bg-red-500/15'
                  }`}>
                    <Trash2 size={14} strokeWidth={2} />
                  </span>
                  {!collapsed && <span className="text-[13px]">Recycle Bin</span>}
                </>
              )}
            </NavLink>
          )}
        </nav>

        {/* ── User card ── */}
        <div className={`relative mx-2 mb-4 overflow-hidden rounded-xl p-3
          flex items-center gap-3 transition-all
          ${collapsed ? 'justify-center' : ''}
          `}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(12px)',
          }}>
          {/* Avatar */}
          <div className="relative shrink-0">
            {user?.avatar ? (
              <img src={user.avatar} alt={user?.name}
                className="h-9 w-9 rounded-xl object-cover ring-2 ring-white/20" />
            ) : (
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl font-bold text-white text-sm
                bg-gradient-to-br ${roleColors[user?.role] || 'from-blue-400 to-indigo-500'}`}
                title={user?.name}>
                {user?.name?.[0]?.toUpperCase()}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-[#0d2680]" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-bold text-white leading-tight">{user?.name}</p>
              <p className="capitalize text-[10px] leading-tight mt-0.5">
                <span className={`inline-block rounded-full px-1.5 py-0.5 font-semibold
                  bg-gradient-to-r ${roleColors[user?.role] || 'from-blue-400 to-indigo-500'}
                  text-white text-[9px]`}>
                  {user?.role}
                </span>
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
