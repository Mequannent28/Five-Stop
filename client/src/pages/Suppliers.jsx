import React, { useEffect, useState, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, Truck, X } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import DataTable from '../components/ui/DataTable';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ExportDropdown from '../components/ui/ExportDropdown';

const emptyForm = { name: '', contactPerson: '', phone: '', email: '', category: '', address: '' };

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [search,    setSearch]    = useState('');
  const [selected,  setSelected]  = useState(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [form,      setForm]      = useState(emptyForm);
  const { hasRole, can } = useAuth();
  const canDelete = hasRole('admin') || can('manageAccounts');

  const load = () => api.get('/suppliers', { params: { search } }).then(res => {
    setSuppliers(res.data);
    setSelected(new Set());
  });
  useEffect(() => { load(); }, [search]);

  /* ── selection ── */
  const allIds      = suppliers.map(s => s._id);
  const allChecked  = allIds.length > 0 && allIds.every(id => selected.has(id));
  const someChecked = allIds.some(id => selected.has(id));
  const toggleAll   = () => allChecked ? setSelected(new Set()) : setSelected(new Set(allIds));
  const toggleOne   = id => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit   = (s) => { setEditing(s); setForm(s); setModalOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editing) await api.put(`/suppliers/${editing._id}`, form);
    else await api.post('/suppliers', form);
    setModalOpen(false);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Move this supplier to recycle bin?')) return;
    await api.delete(`/suppliers/${id}`);
    load();
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Move ${selected.size} supplier(s) to recycle bin?`)) return;
    await api.delete('/suppliers/bulk', { data: { ids: [...selected] } });
    load();
  };

  const exportData = useMemo(() => suppliers.map(s => ({
    'Supplier Name':  s.name,
    'Category':       s.category || 'General',
    'Contact Person': s.contactPerson || '—',
    'Phone':          s.phone || '—',
    'Email':          s.email || '—',
    'Address':        s.address || '—',
  })), [suppliers]);

  const pdfColumns = [
    { header: 'Supplier Name',  accessor: 'Supplier Name' },
    { header: 'Category',       accessor: 'Category' },
    { header: 'Contact Person', accessor: 'Contact Person' },
    { header: 'Phone',          accessor: 'Phone' },
    { header: 'Email',          accessor: 'Email' },
    { header: 'Address',        accessor: 'Address' },
  ];

  const columns = [
    ...(canDelete ? [{
      key: '__check',
      header: (
        <input type="checkbox" checked={allChecked}
          ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
          onChange={toggleAll}
          className="h-4 w-4 rounded accent-blue-600 cursor-pointer" />
      ),
      render: (r) => (
        <input type="checkbox" checked={selected.has(r._id)}
          onChange={() => toggleOne(r._id)}
          className="h-4 w-4 rounded accent-blue-600 cursor-pointer" />
      ),
    }] : []),
    { key: 'name',          header: 'Supplier' },
    { key: 'category',      header: 'Category' },
    { key: 'contactPerson', header: 'Contact person' },
    { key: 'phone',         header: 'Phone' },
    {
      key: 'actions', header: '',
      render: (r) => (
        <div className="flex gap-2">
          <button onClick={() => openEdit(r)} className="rounded-md p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-700"><Pencil size={15} /></button>
          {canDelete && (
            <button onClick={() => handleDelete(r._id)} className="rounded-md p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers…"
            className="w-full rounded-lg border border-ink-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-brass-400" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportDropdown
            data={exportData}
            fileName="suppliers_directory"
            pdfTitle="Hotel Suppliers Directory"
            pdfColumns={pdfColumns}
          />
          <Button variant="brass" onClick={openCreate}><Plus size={16} /> Add supplier</Button>
        </div>
      </div>

      {/* Bulk action bar */}
      {someChecked && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
          <span className="text-xs font-semibold text-red-800">{selected.size} selected</span>
          <button
            onClick={handleBulkDelete}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 px-3 py-1.5 text-xs font-semibold text-white transition"
          >
            <Trash2 size={13} /> Move to Recycle Bin
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-red-400 hover:text-red-700">
            <X size={14} />
          </button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={suppliers}
        emptyMessage="No suppliers yet. Add your first one."
        title="Supplier Directory"
        icon={<Truck size={15} />}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit supplier' : 'Add supplier'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">Supplier name</label>
            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Category</label>
              <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Contact person</label>
              <input value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Phone</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Email</label>
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">Address</label>
            <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="brass">{editing ? 'Save changes' : 'Add supplier'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Suppliers;
