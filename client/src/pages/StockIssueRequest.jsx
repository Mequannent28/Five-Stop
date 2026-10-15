import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Plus, X, CheckCircle2, XCircle, Send, PackageCheck,
  Clock, AlertTriangle, ChevronDown, RefreshCw, Search,
  Layers, ArrowRight, Eye, Trash2, Filter, Building2,
  ClipboardList, PackageOpen, TrendingDown, Zap,
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';

// ── Constants ────────────────────────────────────────────────────
const DEPARTMENTS = [
  'Kitchen', 'Bar', 'Housekeeping', 'Restaurant',
  'Laundry', 'Management', 'Maintenance', 'Other',
];

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: 'bg-amber-50 text-amber-700 border-amber-200',   icon: Clock,         dot: 'bg-amber-500'  },
  approved:  { label: 'Approved',  color: 'bg-blue-50 text-blue-700 border-blue-200',      icon: CheckCircle2,  dot: 'bg-blue-500'   },
  issued:    { label: 'Issued',    color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: PackageCheck, dot: 'bg-emerald-500' },
  rejected:  { label: 'Rejected',  color: 'bg-rose-50 text-rose-700 border-rose-200',      icon: XCircle,       dot: 'bg-rose-500'   },
  cancelled: { label: 'Cancelled', color: 'bg-ink-100 text-ink-500 border-ink-200',        icon: X,             dot: 'bg-ink-400'    },
};

const PRIORITY_CONFIG = {
  normal: { label: 'Normal', color: 'bg-ink-50 text-ink-600 border-ink-200' },
  urgent: { label: 'Urgent', color: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const EMPTY_ITEM = { material: '', requestedQty: 1, note: '' };

const formatETB = (n) =>
  `ETB ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Status Badge ─────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${cfg.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

// ── Trail Timeline ────────────────────────────────────────────────
const TrailTimeline = ({ trail = [] }) => (
  <div className="space-y-2 mt-3">
    {trail.map((t, i) => (
      <div key={i} className="flex items-start gap-2.5 text-xs">
        <div className={`mt-0.5 h-2 w-2 rounded-full flex-shrink-0 ${STATUS_CONFIG[t.action]?.dot || 'bg-ink-300'}`} />
        <div>
          <span className="font-bold text-ink-900 capitalize">{t.action}</span>
          <span className="text-ink-400 mx-1">by</span>
          <span className="font-semibold text-ink-700">{t.byName}</span>
          <span className="text-ink-400 ml-1">({t.byRole})</span>
          {t.note && <p className="text-ink-500 mt-0.5 italic">"{t.note}"</p>}
          <p className="text-ink-400 text-[10px]">
            {new Date(t.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    ))}
  </div>
);

// ════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════
export default function StockIssueRequest() {
  const { user, can } = useAuth();

  // ── Data state ───────────────────────────────────────────────
  const [requests,  setRequests]  = useState([]);
  const [materials, setMaterials] = useState([]);
  const [summary,   setSummary]   = useState({});
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Filters ──────────────────────────────────────────────────
  const [filterStatus, setFilterStatus]  = useState('');
  const [filterDept,   setFilterDept]    = useState('');
  const [search,       setSearch]        = useState('');

  // ── Create/Edit modal ────────────────────────────────────────
  const [createOpen,  setCreateOpen]  = useState(false);
  const [editTarget,  setEditTarget]  = useState(null);
  const [formDept,    setFormDept]    = useState('Kitchen');
  const [formType,    setFormType]    = useState('request');       // 'request' | 'direct_issue'
  const [formPriority,setFormPriority]= useState('normal');
  const [formNotes,   setFormNotes]   = useState('');
  const [formItems,   setFormItems]   = useState([{ ...EMPTY_ITEM }]);
  const [formLoading, setFormLoading] = useState(false);
  const [formError,   setFormError]   = useState('');

  // ── Detail drawer ────────────────────────────────────────────
  const [detailOpen,    setDetailOpen]    = useState(false);
  const [detailRequest, setDetailRequest] = useState(null);

  // ── Action modal (approve/issue/reject) ──────────────────────
  const [actionOpen,    setActionOpen]    = useState(false);
  const [actionType,    setActionType]    = useState('');   // 'approve'|'issue'|'reject'|'cancel'
  const [actionTarget,  setActionTarget]  = useState(null);
  const [actionNote,    setActionNote]    = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError,   setActionError]   = useState('');

  // ── Issue qty overrides ──────────────────────────────────────
  const [issueQtys, setIssueQtys] = useState({});

  // ── Load data — split into fast (page load) + lazy (modal only) ────
  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      // Only load requests + summary on page load — fast
      const [reqRes, sumRes] = await Promise.all([
        api.get('/stock-requests'),
        api.get('/stock-requests/summary'),
      ]);
      setRequests(Array.isArray(reqRes.data) ? reqRes.data : []);
      setSummary(sumRes.data || {});
    } catch (err) {
      console.error('Failed to load stock requests', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Lazy-load materials only when create modal is opened
  const loadMaterials = useCallback(async () => {
    if (materials.length > 0) return; // already loaded
    try {
      const matRes = await api.get('/materials?isActive=true&limit=500');
      setMaterials(
        Array.isArray(matRes.data?.materials)
          ? matRes.data.materials
          : Array.isArray(matRes.data) ? matRes.data : []
      );
    } catch (err) {
      console.error('Failed to load materials', err);
    }
  }, [materials.length]);

  useEffect(() => { load(); }, [load]);

  // ── Filtered list ────────────────────────────────────────────
  const filtered = useMemo(() => {
    return requests.filter(r => {
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterDept   && r.department !== filterDept) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchVoucher = r.voucherNo?.toLowerCase().includes(q);
        const matchDept    = r.department?.toLowerCase().includes(q);
        const matchReqBy   = r.requestedBy?.name?.toLowerCase().includes(q);
        const matchItem    = r.items?.some(i => i.material?.name?.toLowerCase().includes(q));
        if (!matchVoucher && !matchDept && !matchReqBy && !matchItem) return false;
      }
      return true;
    });
  }, [requests, filterStatus, filterDept, search]);

  // ── Form helpers ─────────────────────────────────────────────
  const openCreate = () => {
    setEditTarget(null);
    setFormDept('Kitchen');
    setFormType('request');
    setFormPriority('normal');
    setFormNotes('');
    setFormItems([{ ...EMPTY_ITEM }]);
    setFormError('');
    setCreateOpen(true);
    loadMaterials(); // lazy load
  };

  const openEdit = (req) => {
    setEditTarget(req);
    setFormDept(req.department);
    setFormType(req.requestType || 'request');
    setFormPriority(req.priority || 'normal');
    setFormNotes(req.notes || '');
    setFormItems(req.items.map(i => ({
      material: i.material?._id || i.material,
      requestedQty: i.requestedQty,
      note: i.note || '',
    })));
    setFormError('');
    setCreateOpen(true);
    loadMaterials(); // lazy load
  };

  const addItem    = () => setFormItems(prev => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (idx) => setFormItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx, field, value) => {
    setFormItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, [field]: value } : item
    ));
  };

  // ── Submit create/edit ────────────────────────────────────────
  const handleSubmit = async () => {
    setFormError('');
    const validItems = formItems.filter(i => i.material && Number(i.requestedQty) > 0);
    if (!validItems.length) { setFormError('Add at least one item with a material and quantity.'); return; }

    setFormLoading(true);
    try {
      const payload = {
        department:  formDept,
        requestType: formType,
        priority:    formPriority,
        notes:       formNotes,
        items:       validItems.map(i => ({
          material:     i.material,
          requestedQty: Number(i.requestedQty),
          note:         i.note,
        })),
      };
      if (editTarget) {
        await api.put(`/stock-requests/${editTarget._id}`, payload);
      } else {
        await api.post('/stock-requests', payload);
      }
      setCreateOpen(false);
      await load(true);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save request');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Workflow action ───────────────────────────────────────────
  const openAction = (type, req) => {
    setActionType(type);
    setActionTarget(req);
    setActionNote('');
    setActionError('');
    if (type === 'issue') {
      const qtys = {};
      req.items.forEach(i => {
        qtys[i.material?._id || i.material] = i.requestedQty;
      });
      setIssueQtys(qtys);
    }
    setActionOpen(true);
  };

  const handleAction = async () => {
    setActionError('');
    setActionLoading(true);
    try {
      const url = `/stock-requests/${actionTarget._id}/${actionType}`;
      let body = { note: actionNote };

      if (actionType === 'reject')  body = { reason: actionNote };
      if (actionType === 'cancel')  body = { reason: actionNote };
      if (actionType === 'issue') {
        body = {
          note: actionNote,
          items: actionTarget.items.map(i => ({
            material:  i.material?._id || i.material,
            issuedQty: Number(issueQtys[i.material?._id || i.material] || i.requestedQty),
          })),
        };
      }

      await api.post(url, body);
      setActionOpen(false);
      setDetailOpen(false);
      await load(true);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Open detail ───────────────────────────────────────────────
  const openDetail = async (req) => {
    try {
      const res = await api.get(`/stock-requests/${req._id}`);
      setDetailRequest(res.data);
      setDetailOpen(true);
    } catch {
      setDetailRequest(req);
      setDetailOpen(true);
    }
  };

  // ── Delete ────────────────────────────────────────────────────
  const handleDelete = async (req) => {
    if (!window.confirm(`Delete request ${req.voucherNo}? This moves it to the recycle bin.`)) return;
    try {
      await api.delete(`/stock-requests/${req._id}`);
      await load(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    }
  };

  // ── Helpers ───────────────────────────────────────────────────
  const canApprove = user?.role === 'admin' || user?.role === 'manager';
  const canIssue   = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'storekeeper';

  const getMaterialStock = (matId) => {
    const mat = materials.find(m => (m._id || m) === matId);
    return mat?.currentStock ?? '—';
  };

  const getMaterialUnit = (matId) => {
    const mat = materials.find(m => (m._id || m) === matId);
    return mat?.unit ?? '';
  };

  // ── Action config ─────────────────────────────────────────────
  const ACTION_CONFIG = {
    approve: { title: 'Approve Request',     btn: 'Approve',      btnClass: 'bg-blue-600 hover:bg-blue-700',    label: 'Approval note (optional)' },
    issue:   { title: 'Issue Stock',         btn: 'Issue Stock',  btnClass: 'bg-emerald-600 hover:bg-emerald-700', label: 'Issue note (optional)' },
    reject:  { title: 'Reject Request',      btn: 'Reject',       btnClass: 'bg-rose-600 hover:bg-rose-700',    label: 'Reason for rejection *' },
    cancel:  { title: 'Cancel Request',      btn: 'Cancel Request', btnClass: 'bg-ink-600 hover:bg-ink-700',   label: 'Reason for cancellation (optional)' },
  };

  // ── Loading skeleton ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 pb-8 animate-pulse">
        <div className="h-8 w-64 rounded-xl bg-ink-200/60" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-2xl bg-white border border-ink-100" />)}
        </div>
        <div className="h-96 rounded-2xl bg-white border border-ink-100" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-ink-900">Stock Issue & Request</h1>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
              Live
            </span>
          </div>
          <p className="text-sm text-ink-400 mt-0.5">
            Manage inter-department stock requests and direct issues
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1 rounded-xl border border-ink-200 bg-white p-2 text-xs text-ink-600 hover:bg-ink-50 transition"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-sm"
          >
            <Plus size={14} /> New Request
          </button>
          {canIssue && (
            <button
              onClick={() => { openCreate(); setTimeout(() => setFormType('direct_issue'), 50); }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition shadow-sm"
            >
              <PackageCheck size={14} /> Direct Issue
            </button>
          )}
        </div>
      </div>

      {/* ── Summary KPI Cards ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Pending',  value: summary.pending  || 0, icon: Clock,        color: 'from-amber-500 to-orange-500',   bg: 'bg-amber-50',   text: 'text-amber-700' },
          { label: 'Approved', value: summary.approved || 0, icon: CheckCircle2, color: 'from-blue-500 to-indigo-600',    bg: 'bg-blue-50',    text: 'text-blue-700' },
          { label: 'Issued',   value: summary.issued   || 0, icon: PackageCheck, color: 'from-emerald-500 to-teal-600',   bg: 'bg-emerald-50', text: 'text-emerald-700' },
          { label: 'Rejected', value: summary.rejected || 0, icon: XCircle,      color: 'from-rose-500 to-red-600',       bg: 'bg-rose-50',    text: 'text-rose-700' },
        ].map(({ label, value, icon: Icon, color, bg, text }) => (
          <div key={label} className={`rounded-2xl border border-ink-100 bg-white p-4 shadow-soft cursor-pointer hover:shadow-md transition`}
            onClick={() => setFilterStatus(filterStatus === label.toLowerCase() ? '' : label.toLowerCase())}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider">{label}</p>
              <span className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${color} shadow-sm`}>
                <Icon size={14} className="text-white" />
              </span>
            </div>
            <p className="text-3xl font-black text-ink-900">{value}</p>
            {filterStatus === label.toLowerCase() && (
              <span className="text-[10px] font-bold text-blue-600">● Filtered</span>
            )}
          </div>
        ))}
      </div>

      {/* ── This month cost ── */}
      {summary.monthCost > 0 && (
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-blue-50 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700">
            <TrendingDown size={16} />
            Total stock issued this month
          </div>
          <span className="text-base font-black text-indigo-900">{formatETB(summary.monthCost)}</span>
        </div>
      )}

      {/* ── Filters ── */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-ink-50/40 px-3 py-2 flex-1 min-w-[200px]">
            <Search size={14} className="text-ink-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search by voucher, department, item, or requester..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-xs outline-none text-ink-800 placeholder-ink-400"
            />
            {search && <button onClick={() => setSearch('')}><X size={13} className="text-ink-400" /></button>}
          </div>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 outline-none"
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          <select
            value={filterDept}
            onChange={e => setFilterDept(e.target.value)}
            className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 outline-none"
          >
            <option value="">All Departments</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          {(filterStatus || filterDept || search) && (
            <button
              onClick={() => { setFilterStatus(''); setFilterDept(''); setSearch(''); }}
              className="text-xs font-semibold text-rose-600 hover:text-rose-800"
            >
              Clear filters
            </button>
          )}
          <span className="text-xs text-ink-400 ml-auto">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </Card>

      {/* ── Table ── */}
      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <ClipboardList size={36} className="mx-auto mb-3 text-ink-200" />
            <p className="text-sm font-semibold text-ink-600">No requests found</p>
            <p className="text-xs text-ink-400 mt-1">Create a new request or adjust your filters</p>
            <button
              onClick={openCreate}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
            >
              <Plus size={13} /> New Request
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/50">
                  {['Voucher', 'Department', 'Type', 'Priority', 'Items', 'Total Cost', 'Requested By', 'Date', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-ink-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {filtered.map(req => (
                  <tr key={req._id} className="hover:bg-ink-50/50 transition group">
                    <td className="px-4 py-3 font-bold text-blue-700">{req.voucherNo}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Building2 size={12} className="text-ink-400" />
                        <span className="font-semibold text-ink-800">{req.department}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold border ${
                        req.requestType === 'direct_issue'
                          ? 'bg-violet-50 text-violet-700 border-violet-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {req.requestType === 'direct_issue' ? 'Direct Issue' : 'Request'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold border ${PRIORITY_CONFIG[req.priority]?.color}`}>
                        {req.priority === 'urgent' ? '🚨 ' : ''}{PRIORITY_CONFIG[req.priority]?.label || 'Normal'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-600">
                      {req.items?.length} item{req.items?.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-3 font-semibold text-ink-900 tabular-nums">
                      {formatETB(req.totalCost)}
                    </td>
                    <td className="px-4 py-3 text-ink-600">{req.requestedBy?.name || '—'}</td>
                    <td className="px-4 py-3 text-ink-400">
                      {new Date(req.date || req.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={req.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition">
                        {/* View */}
                        <button
                          onClick={() => openDetail(req)}
                          className="rounded-lg p-1.5 text-ink-400 hover:bg-blue-50 hover:text-blue-600 transition"
                          title="View detail"
                        >
                          <Eye size={13} />
                        </button>

                        {/* Edit — pending only */}
                        {req.status === 'pending' && (
                          <button
                            onClick={() => openEdit(req)}
                            className="rounded-lg p-1.5 text-ink-400 hover:bg-amber-50 hover:text-amber-600 transition"
                            title="Edit"
                          >
                            <ClipboardList size={13} />
                          </button>
                        )}

                        {/* Approve */}
                        {req.status === 'pending' && canApprove && (
                          <button
                            onClick={() => openAction('approve', req)}
                            className="rounded-lg p-1.5 text-ink-400 hover:bg-blue-50 hover:text-blue-600 transition"
                            title="Approve"
                          >
                            <CheckCircle2 size={13} />
                          </button>
                        )}

                        {/* Issue */}
                        {req.status === 'approved' && canIssue && (
                          <button
                            onClick={() => openAction('issue', req)}
                            className="rounded-lg p-1.5 text-ink-400 hover:bg-emerald-50 hover:text-emerald-600 transition"
                            title="Issue stock"
                          >
                            <PackageCheck size={13} />
                          </button>
                        )}

                        {/* Reject */}
                        {['pending', 'approved'].includes(req.status) && canApprove && (
                          <button
                            onClick={() => openAction('reject', req)}
                            className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600 transition"
                            title="Reject"
                          >
                            <XCircle size={13} />
                          </button>
                        )}

                        {/* Cancel (own pending request) */}
                        {req.status === 'pending' && req.requestedBy?._id === user?._id && (
                          <button
                            onClick={() => openAction('cancel', req)}
                            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition"
                            title="Cancel"
                          >
                            <X size={13} />
                          </button>
                        )}

                        {/* Delete */}
                        {['rejected', 'cancelled'].includes(req.status) && canApprove && (
                          <button
                            onClick={() => handleDelete(req)}
                            className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600 transition"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ══════════════════════════════════════════
          CREATE / EDIT MODAL
      ══════════════════════════════════════════ */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={() => setCreateOpen(false)}
        >
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-ink-100"
              style={{ background: 'linear-gradient(135deg, #1a3cdb 0%, #4f46e5 100%)' }}>
              <div>
                <h2 className="text-base font-black text-white">
                  {editTarget ? 'Edit Request' : formType === 'direct_issue' ? 'Direct Stock Issue' : 'New Stock Request'}
                </h2>
                <p className="text-xs text-blue-200 mt-0.5">
                  {formType === 'direct_issue'
                    ? 'Immediately deducts stock without approval workflow'
                    : 'Submit a request for admin/manager approval'}
                </p>
              </div>
              <button onClick={() => setCreateOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition">
                <X size={15} />
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-5">
              {/* Type selector */}
              {!editTarget && (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'request',      label: 'Stock Request',   desc: 'Requires approval',    icon: ClipboardList, color: 'border-blue-400 bg-blue-50' },
                    { value: 'direct_issue', label: 'Direct Issue',    desc: 'Instant stock deduction', icon: Zap,          color: 'border-violet-400 bg-violet-50' },
                  ].map(t => (
                    <button key={t.value}
                      onClick={() => setFormType(t.value)}
                      className={`flex items-start gap-3 rounded-2xl border-2 p-3.5 text-left transition ${
                        formType === t.value ? t.color : 'border-ink-200 bg-white hover:bg-ink-50'
                      }`}
                    >
                      <t.icon size={18} className={formType === t.value ? 'text-blue-600' : 'text-ink-400'} />
                      <div>
                        <p className="text-xs font-bold text-ink-900">{t.label}</p>
                        <p className="text-[10px] text-ink-500">{t.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Department + Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-ink-700 mb-1.5">Department *</label>
                  <select
                    value={formDept}
                    onChange={e => setFormDept(e.target.value)}
                    className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-ink-700 mb-1.5">Priority</label>
                  <select
                    value={formPriority}
                    onChange={e => setFormPriority(e.target.value)}
                    className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="normal">Normal</option>
                    <option value="urgent">🚨 Urgent</option>
                  </select>
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-ink-700">Items *</label>
                  <button onClick={addItem}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition">
                    <Plus size={11} /> Add Item
                  </button>
                </div>

                <div className="space-y-2">
                  {formItems.map((item, idx) => {
                    const mat = materials.find(m => m._id === item.material);
                    return (
                      <div key={idx} className="flex items-start gap-2 rounded-xl border border-ink-100 bg-ink-50/40 p-3">
                        <div className="flex-1 grid grid-cols-3 gap-2">
                          <div className="col-span-2">
                            <select
                              value={item.material}
                              onChange={e => updateItem(idx, 'material', e.target.value)}
                              className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-blue-500"
                            >
                              <option value="">{materials.length === 0 ? 'Loading materials...' : 'Select material...'}</option>
                              {materials.map(m => (
                                <option key={m._id} value={m._id}>
                                  {m.name} ({m.currentStock} {m.unit} available)
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <input
                              type="number"
                              min="0.001"
                              step="any"
                              value={item.requestedQty}
                              onChange={e => updateItem(idx, 'requestedQty', e.target.value)}
                              placeholder="Qty"
                              className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-blue-500"
                            />
                          </div>
                          {mat && (
                            <div className="col-span-3 flex items-center gap-3 text-[10px] text-ink-500 -mt-1 px-1">
                              <span>Unit: <strong>{mat.unit}</strong></span>
                              <span>In stock: <strong className={mat.currentStock < item.requestedQty ? 'text-rose-600' : 'text-emerald-700'}>{mat.currentStock}</strong></span>
                              <span>Unit cost: <strong>{formatETB(mat.unitCost)}</strong></span>
                            </div>
                          )}
                        </div>
                        {formItems.length > 1 && (
                          <button onClick={() => removeItem(idx)}
                            className="mt-1 rounded-lg p-1.5 text-rose-400 hover:bg-rose-50 transition flex-shrink-0">
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-ink-700 mb-1.5">Notes (optional)</label>
                <textarea
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  rows={2}
                  placeholder="Add any notes or context for this request..."
                  className="w-full rounded-xl border border-ink-200 px-3 py-2.5 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>

              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700">
                  {formError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-ink-100 px-6 py-4 bg-ink-50/40">
              <button onClick={() => setCreateOpen(false)}
                className="rounded-xl border border-ink-200 bg-white px-4 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50 transition">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={formLoading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition disabled:opacity-50"
              >
                {formLoading ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                {editTarget ? 'Save Changes' : formType === 'direct_issue' ? 'Issue Now' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          ACTION MODAL (approve / issue / reject / cancel)
      ══════════════════════════════════════════ */}
      {actionOpen && actionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={() => setActionOpen(false)}
        >
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`px-6 py-5 border-b border-ink-100 ${
              actionType === 'approve' ? 'bg-blue-600'
              : actionType === 'issue'  ? 'bg-emerald-600'
              : actionType === 'reject' ? 'bg-rose-600'
              : 'bg-ink-800'
            }`}>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-black text-white">{ACTION_CONFIG[actionType]?.title}</h2>
                <button onClick={() => setActionOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition">
                  <X size={15} />
                </button>
              </div>
              <p className="text-xs text-white/70 mt-1">
                {actionTarget.voucherNo} · {actionTarget.department}
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Items summary */}
              <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-3 space-y-1.5">
                {actionTarget.items?.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-ink-800">{item.material?.name || '—'}</span>
                    <div className="flex items-center gap-3">
                      {actionType === 'issue' ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-ink-400">Issue qty:</span>
                          <input
                            type="number"
                            min="0"
                            max={item.requestedQty}
                            value={issueQtys[item.material?._id || item.material] ?? item.requestedQty}
                            onChange={e => setIssueQtys(prev => ({
                              ...prev,
                              [item.material?._id || item.material]: e.target.value,
                            }))}
                            className="w-20 rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs text-center outline-none focus:border-blue-500"
                          />
                          <span className="text-ink-400">/ {item.requestedQty} {item.material?.unit}</span>
                        </div>
                      ) : (
                        <span className="text-ink-600">{item.requestedQty} {item.material?.unit}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Note/Reason input */}
              <div>
                <label className="block text-xs font-bold text-ink-700 mb-1.5">
                  {ACTION_CONFIG[actionType]?.label}
                </label>
                <textarea
                  value={actionNote}
                  onChange={e => setActionNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-ink-200 px-3 py-2.5 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                  placeholder={
                    actionType === 'reject'  ? 'Provide a clear reason for rejection...'
                    : actionType === 'cancel' ? 'Reason for cancellation...'
                    : 'Optional note...'
                  }
                />
              </div>

              {actionError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700">
                  {actionError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-ink-100 px-6 py-4 bg-ink-50/40">
              <button onClick={() => setActionOpen(false)}
                className="rounded-xl border border-ink-200 bg-white px-4 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50 transition">
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={actionLoading || (actionType === 'reject' && !actionNote.trim())}
                className={`inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-bold text-white transition disabled:opacity-50 ${ACTION_CONFIG[actionType]?.btnClass}`}
              >
                {actionLoading
                  ? <RefreshCw size={13} className="animate-spin" />
                  : actionType === 'approve' ? <CheckCircle2 size={13} />
                  : actionType === 'issue'   ? <PackageCheck size={13} />
                  : actionType === 'reject'  ? <XCircle size={13} />
                  : <X size={13} />
                }
                {ACTION_CONFIG[actionType]?.btn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          DETAIL DRAWER
      ══════════════════════════════════════════ */}
      {detailOpen && detailRequest && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={() => setDetailOpen(false)}
        >
          <div
            className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-ink-100 bg-ink-50/60">
              <div>
                <h2 className="text-base font-black text-ink-900">{detailRequest.voucherNo}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={detailRequest.status} />
                  <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold border ${PRIORITY_CONFIG[detailRequest.priority]?.color}`}>
                    {detailRequest.priority}
                  </span>
                </div>
              </div>
              <button onClick={() => setDetailOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-ink-100 text-ink-600 hover:bg-ink-200 transition">
                <X size={15} />
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-5">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  { label: 'Department',    value: detailRequest.department },
                  { label: 'Type',          value: detailRequest.requestType === 'direct_issue' ? 'Direct Issue' : 'Request' },
                  { label: 'Requested By',  value: detailRequest.requestedBy?.name },
                  { label: 'Date',          value: new Date(detailRequest.date || detailRequest.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' }) },
                  detailRequest.approvedBy  && { label: 'Approved By',  value: detailRequest.approvedBy?.name },
                  detailRequest.issuedBy    && { label: 'Issued By',    value: detailRequest.issuedBy?.name },
                  detailRequest.rejectedBy  && { label: 'Rejected By',  value: detailRequest.rejectedBy?.name },
                  detailRequest.rejectReason && { label: 'Reject Reason', value: detailRequest.rejectReason },
                ].filter(Boolean).map(({ label, value }) => (
                  <div key={label} className="rounded-xl border border-ink-100 bg-ink-50/40 p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{label}</p>
                    <p className="font-semibold text-ink-900 mt-0.5">{value || '—'}</p>
                  </div>
                ))}
              </div>

              {/* Items table */}
              <div>
                <p className="text-xs font-bold text-ink-700 mb-2">Items</p>
                <div className="rounded-xl border border-ink-100 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-ink-50">
                      <tr>
                        {['Material', 'Req. Qty', 'Issued Qty', 'Unit Cost', 'Total'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-ink-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-50">
                      {detailRequest.items?.map((item, i) => (
                        <tr key={i} className="hover:bg-ink-50/40">
                          <td className="px-3 py-2 font-semibold text-ink-900">{item.material?.name || '—'}</td>
                          <td className="px-3 py-2 text-ink-600">{item.requestedQty} {item.material?.unit}</td>
                          <td className="px-3 py-2">
                            {item.issuedQty > 0
                              ? <span className="font-bold text-emerald-700">{item.issuedQty} {item.material?.unit}</span>
                              : <span className="text-ink-400">—</span>
                            }
                          </td>
                          <td className="px-3 py-2 text-ink-600">{formatETB(item.unitCost)}</td>
                          <td className="px-3 py-2 font-semibold text-ink-900">{formatETB(item.totalCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-ink-50">
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-right font-bold text-xs text-ink-700">Total Cost</td>
                        <td className="px-3 py-2 font-black text-ink-900">{formatETB(detailRequest.totalCost)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Notes */}
              {detailRequest.notes && (
                <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1">Notes</p>
                  <p className="text-xs text-ink-700">{detailRequest.notes}</p>
                </div>
              )}

              {/* Trail */}
              <div>
                <p className="text-xs font-bold text-ink-700 mb-1">Audit Trail</p>
                <TrailTimeline trail={detailRequest.trail || []} />
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center gap-2 border-t border-ink-100 px-6 py-4 bg-ink-50/40 flex-wrap">
              {detailRequest.status === 'pending' && canApprove && (
                <button
                  onClick={() => { setDetailOpen(false); openAction('approve', detailRequest); }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
                >
                  <CheckCircle2 size={13} /> Approve
                </button>
              )}
              {detailRequest.status === 'approved' && canIssue && (
                <button
                  onClick={() => { setDetailOpen(false); openAction('issue', detailRequest); }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
                >
                  <PackageCheck size={13} /> Issue Stock
                </button>
              )}
              {['pending', 'approved'].includes(detailRequest.status) && canApprove && (
                <button
                  onClick={() => { setDetailOpen(false); openAction('reject', detailRequest); }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 transition"
                >
                  <XCircle size={13} /> Reject
                </button>
              )}
              <button onClick={() => setDetailOpen(false)}
                className="ml-auto rounded-xl border border-ink-200 bg-white px-4 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50 transition">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
