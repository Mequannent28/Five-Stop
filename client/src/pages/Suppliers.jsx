import React, { useEffect, useState, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import DataTable from '../components/ui/DataTable';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ExportDropdown from '../components/ui/ExportDropdown';

const emptyForm = { name: '', contactPerson: '', phone: '', email: '', category: '', address: '' };

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const { hasRole } = useAuth();
  const canDelete = hasRole('admin');

  const load = () => api.get('/suppliers', { params: { search } }).then((res) => setSuppliers(res.data));
  useEffect(() => { load(); }, [search]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (s) => { setEditing(s); setForm(s); setModalOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editing) await api.put(`/suppliers/${editing._id}`, form);
    else await api.post('/suppliers', form);
    setModalOpen(false);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this supplier?')) return;
    await api.delete(`/suppliers/${id}`);
    load();
  };

  const exportData = useMemo(() => {
    return suppliers.map(s => ({
      'Supplier Name': s.name,
      'Category': s.category || 'General',
      'Contact Person': s.contactPerson || '—',
      'Phone': s.phone || '—',
      'Email': s.email || '—',
      'Address': s.address || '—',
    }));
  }, [suppliers]);

  const pdfColumns = [
    { header: 'Supplier Name', accessor: 'Supplier Name' },
    { header: 'Category', accessor: 'Category' },
    { header: 'Contact Person', accessor: 'Contact Person' },
    { header: 'Phone', accessor: 'Phone' },
    { header: 'Email', accessor: 'Email' },
    { header: 'Address', accessor: 'Address' },
  ];
  const columns = [
    { key: 'name', header: 'Supplier' },
    { key: 'category', header: 'Category' },
    { key: 'contactPerson', header: 'Contact person' },
    { key: 'phone', header: 'Phone' },
    {
      key: 'actions', header: '', render: (r) => (
        <div className="flex gap-2">
          <button onClick={() => openEdit(r)} className="rounded-md p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-700"><Pencil size={15} /></button>
          {canDelete && <button onClick={() => handleDelete(r._id)} className="rounded-md p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search suppliers…"
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

      <DataTable columns={columns} data={suppliers} emptyMessage="No suppliers yet. Add your first one." />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit supplier' : 'Add supplier'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">Supplier name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Category</label>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Contact person</label>
              <input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Email</label>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">Address</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
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
