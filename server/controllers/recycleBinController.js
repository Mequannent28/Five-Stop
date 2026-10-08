const asyncHandler      = require('express-async-handler');
const RawMaterial       = require('../models/RawMaterial');
const Supplier          = require('../models/Supplier');
const Product           = require('../models/Product');
const StockTransaction  = require('../models/StockTransaction');
const { invalidateDashboardCache } = require('./dashboardController');
const { VOUCHER_DIRECTION } = require('../models/StockTransaction');
const tg = require('../utils/telegramNotifier');

// GET /api/recycle-bin
// Returns all soft-deleted items across all collections
const getRecycleBin = asyncHandler(async (req, res) => {
  const [materials, suppliers, products, transactions] = await Promise.all([
    RawMaterial.find({ isActive: false, deletedAt: { $ne: null } }).lean(),
    Supplier.find({ isActive: false, deletedAt: { $ne: null } }).lean(),
    Product.find({ isActive: false, deletedAt: { $ne: null } }).populate('ingredients.material','name unit').lean(),
    StockTransaction.find({ deletedAt: { $ne: null } })
      .populate('supplier', 'name')
      .populate('performedBy', 'name')
      .populate('items.material', 'name unit')
      .lean(),
  ]);

  const items = [
    ...materials.map(m => ({ ...m, _type: 'material', _typeLabel: 'Raw Material' })),
    ...suppliers.map(s => ({ ...s, _type: 'supplier', _typeLabel: 'Supplier' })),
    ...products.map(p => ({ ...p, _type: 'product', _typeLabel: 'Product' })),
    ...transactions.map(t => ({ ...t, _type: 'transaction', _typeLabel: 'Transaction' })),
  ].sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));

  res.json(items);
});

// POST /api/recycle-bin/:type/:id/restore
const restoreItem = asyncHandler(async (req, res) => {
  const { type, id } = req.params;

  if (type === 'material') {
    const doc = await RawMaterial.findById(id);
    if (!doc) { res.status(404); throw new Error('Item not found'); }
    doc.isActive = true; doc.deletedAt = null; doc.deletedBy = null; doc.deletedFrom = null;
    await doc.save();
    tg.notifyRestored('Raw Material', doc.name, req.user);
    invalidateDashboardCache();
    return res.json({ message: 'Raw material restored.' });
  }

  if (type === 'supplier') {
    const doc = await Supplier.findById(id);
    if (!doc) { res.status(404); throw new Error('Item not found'); }
    doc.isActive = true; doc.deletedAt = null; doc.deletedBy = null; doc.deletedFrom = null;
    await doc.save();
    tg.notifyRestored('Supplier', doc.name, req.user);
    return res.json({ message: 'Supplier restored.' });
  }

  if (type === 'product') {
    const doc = await Product.findById(id);
    if (!doc) { res.status(404); throw new Error('Item not found'); }
    doc.isActive = true; doc.deletedAt = null; doc.deletedBy = null; doc.deletedFrom = null;
    await doc.save();
    tg.notifyRestored('Product', doc.name, req.user);
    invalidateDashboardCache();
    return res.json({ message: 'Product restored.' });
  }

  if (type === 'transaction') {
    const doc = await StockTransaction.findById(id);
    if (!doc) { res.status(404); throw new Error('Item not found'); }
    // Re-apply stock
    const direction = doc.type || VOUCHER_DIRECTION[doc.voucherType];
    const items = doc.items?.length ? doc.items : [{ material: doc.material, quantity: doc.quantity }];
    for (const item of items) {
      const mat = await RawMaterial.findById(item.material);
      if (mat) {
        mat.currentStock += direction === 'in' ? item.quantity : -item.quantity;
        await mat.save();
      }
    }
    doc.deletedAt = null; doc.deletedBy = null; doc.deletedFrom = null;
    await doc.save();
    tg.notifyRestored('Transaction', doc.voucherNo || doc._id.toString().slice(-6), req.user);
    invalidateDashboardCache();
    return res.json({ message: 'Transaction restored and stock re-applied.' });
  }

  res.status(400); throw new Error(`Unknown type: ${type}`);
});

// DELETE /api/recycle-bin/:type/:id  (permanent delete)
const permanentDelete = asyncHandler(async (req, res) => {
  const { type, id } = req.params;

  const modelMap = {
    material:    RawMaterial,
    supplier:    Supplier,
    product:     Product,
    transaction: StockTransaction,
  };
  const Model = modelMap[type];
  if (!Model) { res.status(400); throw new Error(`Unknown type: ${type}`); }

  const doc = await Model.findById(id);
  if (!doc) { res.status(404); throw new Error('Item not found'); }
  await doc.deleteOne();
  if (type === 'material' || type === 'product' || type === 'transaction') invalidateDashboardCache();
  res.json({ message: 'Permanently deleted.' });
});

// DELETE /api/recycle-bin/empty  (empty the entire bin — admin only)
const emptyRecycleBin = asyncHandler(async (req, res) => {
  await Promise.all([
    RawMaterial.deleteMany({ isActive: false, deletedAt: { $ne: null } }),
    Supplier.deleteMany({ isActive: false, deletedAt: { $ne: null } }),
    Product.deleteMany({ isActive: false, deletedAt: { $ne: null } }),
    StockTransaction.deleteMany({ deletedAt: { $ne: null } }),
  ]);
  invalidateDashboardCache();
  tg.notifyBinEmptied(req.user);
  res.json({ message: 'Recycle bin emptied.' });
});

module.exports = { getRecycleBin, restoreItem, permanentDelete, emptyRecycleBin };
