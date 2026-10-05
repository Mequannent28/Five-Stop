import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, Upload, Download, X } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ExportDropdown from '../components/ui/ExportDropdown';

const emptyForm = { code: '', name: '', category: '', unit: '', currentStock: 0, reorderLevel: 10, unitCost: 0, storeLocation: 'Main Store' };

const statusBadge = (status) => {
  if (status === 'out_of_stock') return <Badge color="red">Out of stock</Badge>;
  if (status === 'low_stock') return <Badge color="amber">Low stock</Badge>;
  return <Badge color="green">In stock</Badge>;
};

const RawMaterials = () => {
  const [materials, setMaterials] = useState([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [importResult, setImportResult] = useState(null);
  const importRef = useRef();
  const { hasRole } = useAuth();
  const canEdit = hasRole('admin', 'manager');

  const load = () => {
    api.get('/materials', { params: { search } }).then((res) => setMaterials(res.data));
  };

  useEffect(() => { load(); }, [search]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (m) => { setEditing(m); setForm(m); setModalOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editing) {
      await api.put(`/materials/${editing._id}`, form);
    } else {
      await api.post('/materials', form);
    }
    setModalOpen(false);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this raw material? This cannot be undone.')) return;
    await api.delete(`/materials/${id}`);
    load();
  };

  const handleExport = async () => {
    const res = await api.get('/materials/export/excel', { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'raw_materials.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/materials/import/excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(res.data);
      load();
    } catch (err) {
      setImportResult({ message: err.response?.data?.message ?? 'Import failed' });
    }
    e.target.value = '';
  };

  const columns = [
    { key: 'code', header: 'Code', render: (r) => <span className="font-mono text-xs text-ink-400">{r.code || '—'}</span> },
    { key: 'name', header: 'Material' },
    { key: 'category', header: 'Category' },
    { key: 'currentStock', header: 'In stock', render: (r) => <span className="tabular">{r.currentStock} {r.unit}</span> },
    { key: 'reorderLevel', header: 'Reorder at', render: (r) => <span className="tabular">{r.reorderLevel} {r.unit}</span> },
    { key: 'unitCost', header: 'Unit cost', render: (r) => <span className="tabular">ETB {r.unitCost}</span> },
    { key: 'status', header: 'Status', render: (r) => statusBadge(r.status) },
    ...(canEdit
      ? [{
          key: 'actions',
          header: '',
          render: (r) => (
            <div className="flex gap-2">
              <button onClick={() => openEdit(r)} className="rounded-md p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-700">
                <Pencil size={15} />
              </button>
              <button onClick={() => handleDelete(r._id)} className="rounded-md p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600">
                <Trash2 size={15} />
              </button>
            </div>
          ),
        }]
      : []),
  ];

  const exportData = useMemo(() => {
    return materials.map(m => ({
      'Code': m.code || '—',
      'Material Name': m.name,
      'Category': m.category || 'General',
      'In Stock': `${m.currentStock} ${m.unit || ''}`.trim(),
      'Reorder Level': `${m.reorderLevel} ${m.unit || ''}`.trim(),
      'Unit Cost (ETB)': Number(m.unitCost || 0).toFixed(2),
      'Status': m.status || (m.currentStock <= m.reorderLevel ? 'Low Stock' : 'Optimal'),
    }));
  }, [materials]);

  const pdfColumns = [
    { header: 'Code', accessor: 'Code' },
    { header: 'Material Name', accessor: 'Material Name' },
    { header: 'Category', accessor: 'Category' },
    { header: 'In Stock', accessor: 'In Stock', align: 'right' },
    { header: 'Reorder Level', accessor: 'Reorder Level', align: 'right' },
    { header: 'Unit Cost (ETB)', accessor: 'Unit Cost (ETB)', align: 'right' },
    { header: 'Status', accessor: 'Status', align: 'center' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search materials…"
            className="w-full rounded-lg border border-ink-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-brass-400"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Export & Import (Excel, PDF, CSV, Print) */}
          <ExportDropdown
            data={exportData}
            fileName="raw_materials"
            pdfTitle="Raw Materials Inventory List"
            pdfColumns={pdfColumns}
            showImport={canEdit}
            onImport={() => importRef.current?.click()}
            importLabel="Import Excel"
          />
          <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />

          {canEdit && (
            <Button variant="brass" onClick={openCreate}>
              <Plus size={16} /> Add material
            </Button>
          )}
        </div>
      </div>

      {importResult && (
        <div className="flex items-start justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <p className="font-medium">{importResult.message}</p>
          <button onClick={() => setImportResult(null)} className="ml-4 text-blue-500 hover:text-blue-700">
            <X size={16} />
          </button>
        </div>
      )}

      <DataTable columns={columns} data={materials} emptyMessage="No raw materials yet. Add your first item." />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit material' : 'Add raw material'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Code</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="e.g. RM-0001"
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Category</label>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Unit (kg, ltr, pcs…)</label>
              <input required value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Current stock</label>
              <input type="number" step="0.01" required value={form.currentStock}
                onChange={(e) => setForm({ ...form, currentStock: Number(e.target.value) })}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Reorder level</label>
              <input type="number" step="0.01" required value={form.reorderLevel}
                onChange={(e) => setForm({ ...form, reorderLevel: Number(e.target.value) })}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Unit cost</label>
              <input type="number" step="0.01" value={form.unitCost}
                onChange={(e) => setForm({ ...form, unitCost: Number(e.target.value) })}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">Store location</label>
            <input value={form.storeLocation} onChange={(e) => setForm({ ...form, storeLocation: e.target.value })}
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="brass">{editing ? 'Save changes' : 'Add material'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default RawMaterials;
