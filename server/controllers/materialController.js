const asyncHandler = require('express-async-handler');
const XLSX = require('xlsx');
const RawMaterial = require('../models/RawMaterial');
const { invalidateDashboardCache } = require('./dashboardController');
const tg = require('../utils/telegramNotifier');

const getMaterials = asyncHandler(async (req, res) => {
  const { search, status } = req.query;
  const filter = { isActive: true };
  if (search) filter.name = { $regex: search, $options: 'i' };

  let materials = await RawMaterial.find(filter).sort({ name: 1 }).lean();

  materials = materials.map((m) => ({
    ...m,
    status:
      m.currentStock <= 0
        ? 'out_of_stock'
        : m.currentStock <= m.reorderLevel
        ? 'low_stock'
        : 'in_stock',
  }));

  if (status) {
    materials = materials.filter((m) => m.status === status);
  }

  res.json(materials);
});

const getMaterialById = asyncHandler(async (req, res) => {
  const material = await RawMaterial.findById(req.params.id);
  if (!material) {
    res.status(404);
    throw new Error('Raw material not found');
  }
  res.json(material);
});

const createMaterial = asyncHandler(async (req, res) => {
  const material = await RawMaterial.create(req.body);
  tg.notifyMaterialCreated(material, req.user);
  invalidateDashboardCache();
  res.status(201).json(material);
});

const updateMaterial = asyncHandler(async (req, res) => {
  const material = await RawMaterial.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!material) {
    res.status(404);
    throw new Error('Raw material not found');
  }
  tg.notifyMaterialUpdated(material, req.user);
  invalidateDashboardCache();
  res.json(material);
});

const deleteMaterial = asyncHandler(async (req, res) => {
  const material = await RawMaterial.findById(req.params.id);
  if (!material) { res.status(404); throw new Error('Raw material not found'); }
  material.isActive  = false;
  material.deletedAt = new Date();
  material.deletedBy = req.user?.name || 'System';
  material.deletedFrom = 'materials';
  await material.save();
  tg.notifyMaterialDeleted(material, req.user);
  invalidateDashboardCache();
  res.json({ message: 'Raw material moved to recycle bin.' });
});

const bulkDeleteMaterials = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!ids?.length) { res.status(400); throw new Error('No ids provided'); }
  await RawMaterial.updateMany(
    { _id: { $in: ids } },
    { isActive: false, deletedAt: new Date(), deletedBy: req.user?.name || 'System', deletedFrom: 'materials' }
  );
  invalidateDashboardCache();
  res.json({ message: `${ids.length} material(s) moved to recycle bin.` });
});

const restoreMaterial = asyncHandler(async (req, res) => {
  const material = await RawMaterial.findById(req.params.id);
  if (!material) { res.status(404); throw new Error('Raw material not found'); }
  material.isActive    = true;
  material.deletedAt   = null;
  material.deletedBy   = null;
  material.deletedFrom = null;
  await material.save();
  invalidateDashboardCache();
  res.json({ message: 'Raw material restored.', material });
});

const permanentDeleteMaterial = asyncHandler(async (req, res) => {
  const material = await RawMaterial.findById(req.params.id);
  if (!material) { res.status(404); throw new Error('Raw material not found'); }
  await material.deleteOne();
  invalidateDashboardCache();
  res.json({ message: 'Raw material permanently deleted.' });
});


// GET /api/materials/export/excel
const exportMaterialsExcel = asyncHandler(async (req, res) => {
  const materials = await RawMaterial.find({}).sort({ name: 1 });

  const rows = materials.map((m) => ({
    'Code': m.code || '',
    'Name': m.name,
    'Category': m.category,
    'Unit': m.unit,
    'Current Stock': m.currentStock,
    'Reorder Level': m.reorderLevel,
    'Unit Cost': m.unitCost,
    'Store Location': m.storeLocation,
    'Status': m.status,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  // Set column widths
  ws['!cols'] = [12, 20, 15, 8, 14, 14, 10, 16, 12].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, 'Raw Materials');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', 'attachment; filename="raw_materials.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// POST /api/materials/import/excel
const importMaterialsExcel = asyncHandler(async (req, res) => {
  if (!req.file) { res.status(400); throw new Error('No file uploaded'); }

  const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);

  let created = 0;
  let updated = 0;
  const processedIds = new Set();

  for (const row of rows) {
    const name = String(row['Name'] || '').trim();
    const code = String(row['Code'] || '').trim().replace(/-+$/, '');
    if (!name) continue;

    const data = {
      code,
      name,
      category:      String(row['Category']      || 'General').trim(),
      unit:          String(row['Unit']           || 'pcs').trim(),
      currentStock:  Number(row['Current Stock']) || 0,
      reorderLevel:  Number(row['Reorder Level']) || 10,
      unitCost:      Number(row['Unit Cost'])     || 0,
      storeLocation: String(row['Store Location'] || 'Main Store').trim(),
    };

    let existing = null;

    // 1️⃣ Match by Code first
    if (code) {
      const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      existing = await RawMaterial.findOne({ code: { $regex: `^${escapedCode}-?$`, $options: 'i' } });
      if (existing && processedIds.has(existing._id.toString())) existing = null;
    }
    // 2️⃣ Fall back to name
    if (!existing) {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const byName = await RawMaterial.findOne({ name: { $regex: `^${escapedName}$`, $options: 'i' } });
      if (byName && !processedIds.has(byName._id.toString())) existing = byName;
    }

    if (existing) {
      Object.assign(existing, data);
      await existing.save();
      processedIds.add(existing._id.toString());
      updated++;
    } else {
      const created_ = await RawMaterial.create(data);
      processedIds.add(created_._id.toString());
      created++;
    }
  }

  invalidateDashboardCache();
  res.json({ message: `Imported: ${created} created, ${updated} updated` });
});


module.exports = {
  getMaterials,
  getMaterialById,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  bulkDeleteMaterials,
  restoreMaterial,
  permanentDeleteMaterial,
  exportMaterialsExcel,
  importMaterialsExcel,
};
