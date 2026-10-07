import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, ChefHat, X, Upload, Download, Zap } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ExportDropdown from '../components/ui/ExportDropdown';

const emptyForm = {
  code: '',
  name: '',
  category: '',
  parentCategory: 'FOOD',
  uom: 'Pcs',
  description: '',
  sellingPrice: 0,
  ingredients: [],
};

const Products = () => {
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [importResult, setImportResult] = useState(null);
  const [importProgress, setImportProgress] = useState(null); // { percent, current, total, created, updated, skipped }
  const [recipeImportResult, setRecipeImportResult] = useState(null);
  const [recipeImportProgress, setRecipeImportProgress] = useState(null);
  const importRef = useRef();
  const recipeImportRef = useRef();
  const { hasRole, can } = useAuth();
  const canEdit = hasRole('admin', 'manager') || can('recordGoods');

  const load = () =>
    api.get('/products', { params: { search } }).then((r) => {
      setProducts(r.data);
      setSelected(new Set()); // clear selection on reload
    });

  useEffect(() => { load(); }, [search]);
  useEffect(() => { api.get('/materials').then((r) => setMaterials(r.data)); }, []);

  // ── Selection helpers ──
  const allIds = products.map((p) => p._id);
  const allChecked = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someChecked = allIds.some((id) => selected.has(id));

  const toggleAll = () => {
    if (allChecked) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  };

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── CRUD ──
  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };

  // Auto-generate next sequential P-XXXX code
  const generateCode = () => {
    const nums = products
      .map(p => {
        const match = String(p.code || '').match(/^P-?(\d+)$/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0);
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    setForm(f => ({ ...f, code: `P-${String(next).padStart(4, '0')}` }));
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      code: p.code || '',
      name: p.name,
      category: p.category,
      parentCategory: p.parentCategory || 'FOOD',
      uom: p.uom || 'Pcs',
      description: p.description,
      sellingPrice: p.sellingPrice,
      ingredients: p.ingredients.map((ing) => ({
        material: ing.material?._id ?? ing.material,
        materialName: ing.material?.name ?? '',
        unit: ing.material?.unit ?? '',
        quantity: ing.quantity,
      })),
    });
    setModalOpen(true);
  };

  const openDetail = (p) => { setSelectedProduct(p); setDetailOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      code: form.code,
      name: form.name,
      category: form.category,
      parentCategory: form.parentCategory,
      uom: form.uom,
      description: form.description,
      sellingPrice: form.sellingPrice,
      ingredients: form.ingredients.map(({ material, quantity }) => ({ material, quantity })),
    };
    if (editing) {
      await api.put(`/products/${editing._id}`, payload);
    } else {
      await api.post('/products', payload);
    }
    setModalOpen(false);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this product?')) return;
    await api.delete(`/products/${id}`);
    load();
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} selected product(s)? This cannot be undone.`)) return;
    await api.delete('/products/bulk', { data: { ids: [...selected] } });
    load();
  };

  // ── Ingredient builder ──
  const addIngredient = () =>
    setForm((f) => ({ ...f, ingredients: [...f.ingredients, { material: '', materialName: '', unit: '', quantity: 1 }] }));

  const removeIngredient = (idx) =>
    setForm((f) => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== idx) }));

  const updateIngredient = (idx, field, value) =>
    setForm((f) => {
      const ings = [...f.ingredients];
      ings[idx] = { ...ings[idx], [field]: value };
      if (field === 'material') {
        const mat = materials.find((m) => m._id === value);
        ings[idx].materialName = mat?.name ?? '';
        ings[idx].unit = mat?.unit ?? '';
      }
      return { ...f, ingredients: ings };
    });

  // ── Excel ──
  const handleExport = async () => {
    const res = await api.get('/products/export/excel', { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a'); a.href = url; a.download = 'products.xlsx'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    setImportResult(null);
    setImportProgress({ percent: 0, current: 0, total: 0, created: 0, updated: 0, skipped: 0, running: true });

    const fd = new FormData();
    fd.append('file', file);

    // Get the auth token from localStorage
    const stored = localStorage.getItem('hotelStockAuth');
    const token = stored ? JSON.parse(stored).token : '';
    const baseURL = import.meta.env.VITE_API_URL || '/api';

    try {
      const response = await fetch(`${baseURL}/products/import/excel`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const msg = JSON.parse(line.slice(6));
            if (msg.type === 'start') {
              setImportProgress(p => ({ ...p, total: msg.total }));
            } else if (msg.type === 'progress') {
              setImportProgress({
                running: true,
                percent:  msg.percent,
                current:  msg.current,
                total:    msg.total,
                created:  msg.created,
                updated:  msg.updated,
                skipped:  msg.skipped,
              });
            } else if (msg.type === 'done') {
              setImportProgress(null);
              setImportResult({
                message: `Import complete — ${msg.created} created, ${msg.updated} updated, ${msg.skipped} skipped out of ${msg.total} rows`,
                errors: msg.errors || [],
              });
              load();
            }
          } catch { /* skip malformed line */ }
        }
      }
    } catch (err) {
      setImportProgress(null);
      setImportResult({ message: 'Import failed: ' + err.message, errors: [] });
    }
  };

  // ── Download recipe template ──
  const handleDownloadRecipeTemplate = async () => {
    try {
      const stored = localStorage.getItem('hotelStockAuth');
      const token = stored ? JSON.parse(stored).token : '';
      const baseURL = import.meta.env.VITE_API_URL || '/api';
      const res = await fetch(`${baseURL}/products/export/recipe-template`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to download template');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'recipe_template.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Could not download template: ' + err.message);
    }
  };

  // ── Import recipes from Excel ──
  const handleRecipeImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    setRecipeImportResult(null);
    setRecipeImportProgress({ percent: 0, current: 0, total: 0, updated: 0, skipped: 0, running: true });

    const fd = new FormData();
    fd.append('file', file);

    const stored = localStorage.getItem('hotelStockAuth');
    const token = stored ? JSON.parse(stored).token : '';
    const baseURL = import.meta.env.VITE_API_URL || '/api';

    try {
      const response = await fetch(`${baseURL}/products/import/recipes`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const msg = JSON.parse(line.slice(6));
            if (msg.type === 'start') {
              setRecipeImportProgress(p => ({ ...p, total: msg.total }));
            } else if (msg.type === 'progress') {
              setRecipeImportProgress({
                running: true,
                percent: msg.percent,
                current: msg.current,
                total:   msg.total,
                updated: msg.updated,
                skipped: msg.skipped,
              });
            } else if (msg.type === 'done') {
              setRecipeImportProgress(null);
              setRecipeImportResult({
                message: `Recipe import complete — ${msg.updated} product(s) updated, ${msg.skipped} skipped out of ${msg.total} products`,
                errors: msg.errors || [],
              });
              load();
            }
          } catch { /* skip malformed SSE line */ }
        }
      }
    } catch (err) {
      setRecipeImportProgress(null);
      setRecipeImportResult({ message: 'Import failed: ' + err.message, errors: [] });
    }
  };

  const recipeCost = (p) =>
    p.ingredients?.reduce((sum, ing) => sum + (ing.material?.unitCost ?? 0) * ing.quantity, 0) ?? 0;

  const exportData = useMemo(() => {
    return products.map(p => ({
      'Code': p.code || '—',
      'Product Name': p.name,
      'Department': p.parentCategory || 'FOOD',
      'Category': p.category || 'General',
      'Unit (UOM)': p.uom || 'Pcs',
      'Selling Price (ETB)': Number(p.sellingPrice || 0).toFixed(2),
      'Ingredients Count': p.ingredients?.length || 0,
      'Active': p.isActive !== false ? 'Yes' : 'No',
    }));
  }, [products]);

  const pdfColumns = [
    { header: 'Code', accessor: 'Code' },
    { header: 'Product Name', accessor: 'Product Name' },
    { header: 'Department', accessor: 'Department' },
    { header: 'Category', accessor: 'Category' },
    { header: 'Unit', accessor: 'Unit (UOM)', align: 'center' },
    { header: 'Selling Price (ETB)', accessor: 'Selling Price (ETB)', align: 'right' },
    { header: 'Ingredients', accessor: 'Ingredients Count', align: 'center' },
  ];

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="w-full rounded-lg border border-ink-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Bulk delete — shown when items selected */}
          {canEdit && selected.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
            >
              <Trash2 size={15} /> Delete {selected.size} selected
            </button>
          )}

          {/* Export & Import (Excel, PDF, CSV, Print) */}
          <ExportDropdown
            data={exportData}
            fileName="products_catalog"
            pdfTitle="Products & Recipes Catalog"
            pdfColumns={pdfColumns}
            showImport={canEdit}
            onImport={() => importRef.current?.click()}
            importLabel="Import Excel"
          />
          <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />

          {/* Import Recipes button */}
          {canEdit && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleDownloadRecipeTemplate}
                title="Download recipe template (pre-filled with all products)"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
              >
                <Download size={14} /> Recipe Template
              </button>
              <button
                onClick={() => recipeImportRef.current?.click()}
                title="Import ingredient recipes from Excel"
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition"
              >
                <Upload size={14} /> Import Recipes
              </button>
              <input ref={recipeImportRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleRecipeImport} />
            </div>
          )}

          {canEdit && (
            <Button style={{ background: 'linear-gradient(135deg,#1a56db,#0d2d80)', color: 'white' }} onClick={openCreate}>
              <Plus size={16} /> Add product
            </Button>
          )}
        </div>
      </div>

      {/* Import progress bar */}
      {importProgress && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-blue-800">Importing products…</span>
            <span className="tabular text-blue-700 font-bold">{importProgress.percent}%</span>
          </div>
          {/* Progress bar */}
          <div className="h-3 w-full overflow-hidden rounded-full bg-blue-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-150"
              style={{ width: `${importProgress.percent}%` }}
            />
          </div>
          <div className="flex gap-4 text-xs text-blue-700">
            <span>{importProgress.current} / {importProgress.total} rows</span>
            <span className="text-emerald-700">✓ {importProgress.created} created</span>
            <span className="text-violet-700">↻ {importProgress.updated} updated</span>
            {importProgress.skipped > 0 && <span className="text-amber-700">⚠ {importProgress.skipped} skipped</span>}
          </div>
        </div>
      )}

      {/* Import result */}
      {importResult && (
        <div className="flex items-start justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <div>
            <p className="font-semibold">{importResult.message}</p>
            {importResult.errors?.length > 0 && (
              <ul className="mt-1 list-disc pl-4 text-xs text-red-600 max-h-24 overflow-y-auto">
                {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
          <button onClick={() => setImportResult(null)} className="ml-4 text-blue-400 hover:text-blue-700"><X size={16} /></button>
        </div>
      )}

      {/* Recipe import progress bar */}
      {recipeImportProgress && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-violet-800">Importing recipes…</span>
            <span className="tabular text-violet-700 font-bold">{recipeImportProgress.percent}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-violet-200">
            <div
              className="h-full rounded-full bg-violet-600 transition-all duration-150"
              style={{ width: `${recipeImportProgress.percent}%` }}
            />
          </div>
          <div className="flex gap-4 text-xs text-violet-700">
            <span>{recipeImportProgress.current} / {recipeImportProgress.total} rows processed</span>
            <span className="text-emerald-700">✓ {recipeImportProgress.updated} products updated</span>
            {recipeImportProgress.skipped > 0 && <span className="text-amber-700">⚠ {recipeImportProgress.skipped} skipped</span>}
          </div>
        </div>
      )}

      {/* Recipe import result */}
      {recipeImportResult && (
        <div className="flex items-start justify-between rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
          <div>
            <p className="font-semibold">{recipeImportResult.message}</p>
            {recipeImportResult.errors?.length > 0 && (
              <ul className="mt-1 list-disc pl-4 text-xs text-red-600 max-h-24 overflow-y-auto">
                {recipeImportResult.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
          <button onClick={() => setRecipeImportResult(null)} className="ml-4 text-violet-400 hover:text-violet-700"><X size={16} /></button>
        </div>
      )}

      {/* ── Table with inline checkboxes ── */}
      <div className="overflow-x-auto rounded-xl border border-blue-200/70 bg-white shadow-soft">
        <table className="min-w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead style={{ background: 'linear-gradient(90deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%)' }}>
            <tr>
              {canEdit && (
                <th className="w-10 px-4 py-2.5" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-white/40 accent-white cursor-pointer"
                  />
                </th>
              )}
              <th className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>Code</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>Product</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>Category</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>UOM</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>Ingredients</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>Selling Price</th>
              {canEdit && <th className="px-4 py-2.5" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }} />}
            </tr>
          </thead>
          <tbody style={{ borderTop: 'none' }}>
            {products.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 8 : 6} className="px-4 py-10 text-center text-ink-400">
                  No products yet. Add your first product or import from Excel.
                </td>
              </tr>
            )}
            {products.map((p) => (
              <tr
                key={p._id}
                className={`hover:bg-ink-50/50 ${selected.has(p._id) ? 'bg-blue-50/60' : ''}`}
              >
                {canEdit && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(p._id)}
                      onChange={() => toggleOne(p._id)}
                      className="h-4 w-4 rounded border-ink-300 accent-blue-600 cursor-pointer"
                    />
                  </td>
                )}
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-ink-400">{p.code || '—'}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <button onClick={() => openDetail(p)} className="font-medium text-blue-700 hover:underline text-left">
                    {p.name}
                  </button>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-ink-700">
                  {p.category}
                  {p.parentCategory && <span className="ml-1 text-xs text-ink-400">/ {p.parentCategory}</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-ink-500">{p.uom || 'Pcs'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-ink-500">
                  {p.ingredients?.length ?? 0} item{p.ingredients?.length !== 1 ? 's' : ''}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-medium tabular">
                  ETB {p.sellingPrice?.toFixed(2) ?? '0.00'}
                </td>
                {canEdit && (
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(p)} className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => handleDelete(p._id)} className="rounded-md p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Selection status bar */}
        {canEdit && products.length > 0 && (
          <div className="border-t border-ink-100 px-4 py-2 text-xs text-ink-400">
            {selected.size > 0
              ? <span className="text-blue-600 font-medium">{selected.size} of {products.length} selected</span>
              : `${products.length} product${products.length !== 1 ? 's' : ''}`}
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit product' : 'Add product'} width="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Code</label>
              <div className="flex items-center gap-1.5">
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="e.g. P-0013"
                  className="flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={generateCode}
                  title="Auto-generate next code"
                  className="flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition whitespace-nowrap"
                >
                  <Zap size={13} className="text-amber-500" />
                  Auto
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">UOM</label>
              <input value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value })}
                placeholder="Pcs"
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium text-ink-600">Product name *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Five Stop Burger"
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Child Category</label>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Lunch & Dinner"
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Parent Category</label>
              <input value={form.parentCategory} onChange={(e) => setForm({ ...form, parentCategory: e.target.value })}
                placeholder="e.g. FOOD"
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Selling price (ETB)</label>
              <input type="number" step="0.01" min="0" value={form.sellingPrice}
                onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Description</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
          </div>

          {/* Recipe */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-sm font-semibold text-ink-700">
                <ChefHat size={16} className="text-blue-600" /> Recipe Ingredients
              </label>
              <button type="button" onClick={addIngredient}
                className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">
                <Plus size={13} /> Add ingredient
              </button>
            </div>
            {form.ingredients.length === 0 && (
              <p className="rounded-lg border border-dashed border-ink-200 py-4 text-center text-xs text-ink-400">
                No ingredients yet — click "Add ingredient" to build the recipe.
              </p>
            )}
            <div className="space-y-2">
              {form.ingredients.map((ing, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                  <select required value={ing.material} onChange={(e) => updateIngredient(idx, 'material', e.target.value)}
                    className="rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500">
                    <option value="">Select raw material…</option>
                    {materials.map((m) => (
                      <option key={m._id} value={m._id}>{m.name} ({m.unit})</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1">
                    <input type="number" step="0.001" min="0" required value={ing.quantity}
                      onChange={(e) => updateIngredient(idx, 'quantity', Number(e.target.value))}
                      className="w-24 rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                      placeholder="Qty" />
                    <span className="w-8 text-xs text-ink-400">{ing.unit}</span>
                  </div>
                  <button type="button" onClick={() => removeIngredient(idx)}
                    className="rounded-md p-1.5 text-ink-300 hover:bg-red-50 hover:text-red-500">
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
            {form.ingredients.length > 0 && (
              <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm">
                <span className="text-ink-500">Estimated recipe cost: </span>
                <span className="font-semibold text-blue-700">
                  ETB {form.ingredients.reduce((sum, ing) => {
                    const mat = materials.find((m) => m._id === ing.material);
                    return sum + (mat?.unitCost ?? 0) * ing.quantity;
                  }, 0).toFixed(2)}
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" style={{ background: 'linear-gradient(135deg,#1a56db,#0d2d80)', color: 'white' }}>
              {editing ? 'Save changes' : 'Add product'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Detail Modal ── */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={selectedProduct?.name ?? ''} width="max-w-lg">
        {selectedProduct && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-ink-400">Code</p><p className="font-mono font-medium">{selectedProduct.code || '—'}</p></div>
              <div><p className="text-xs text-ink-400">UOM</p><p className="font-medium">{selectedProduct.uom || 'Pcs'}</p></div>
              <div><p className="text-xs text-ink-400">Child Category</p><p className="font-medium">{selectedProduct.category || '—'}</p></div>
              <div><p className="text-xs text-ink-400">Parent Category</p><p className="font-medium">{selectedProduct.parentCategory || '—'}</p></div>
              <div><p className="text-xs text-ink-400">Selling Price</p><p className="font-medium">ETB {selectedProduct.sellingPrice?.toFixed(2)}</p></div>
              <div><p className="text-xs text-ink-400">Description</p><p className="font-medium">{selectedProduct.description || '—'}</p></div>
            </div>
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-700">
                <ChefHat size={15} className="text-blue-600" /> Recipe
              </p>
              {selectedProduct.ingredients?.length === 0 ? (
                <p className="text-sm text-ink-400">No ingredients defined.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 text-left text-xs text-ink-400">
                      <th className="pb-1 font-medium">Ingredient</th>
                      <th className="pb-1 font-medium text-right">Qty</th>
                      <th className="pb-1 font-medium text-right">Unit Cost</th>
                      <th className="pb-1 font-medium text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProduct.ingredients.map((ing, i) => {
                      const cost = (ing.material?.unitCost ?? 0) * ing.quantity;
                      return (
                        <tr key={i} className="border-b border-ink-50">
                          <td className="py-1.5">{ing.material?.name ?? '—'}</td>
                          <td className="py-1.5 text-right tabular">{ing.quantity} {ing.material?.unit}</td>
                          <td className="py-1.5 text-right tabular text-ink-400">ETB {ing.material?.unitCost?.toFixed(2) ?? '0.00'}</td>
                          <td className="py-1.5 text-right tabular font-medium">ETB {cost.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="pt-2 text-right text-xs font-semibold text-ink-500">Total recipe cost</td>
                      <td className="pt-2 text-right font-bold text-blue-700">ETB {recipeCost(selectedProduct).toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
            {canEdit && (
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" onClick={() => setDetailOpen(false)}>Close</Button>
                <Button style={{ background: 'linear-gradient(135deg,#1a56db,#0d2d80)', color: 'white' }}
                  onClick={() => { setDetailOpen(false); openEdit(selectedProduct); }}>
                  <Pencil size={14} /> Edit
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Products;
