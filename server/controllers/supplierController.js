const asyncHandler = require('express-async-handler');
const Supplier = require('../models/Supplier');
const tg = require('../utils/telegramNotifier');

const getSuppliers = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const filter = search
    ? { name: { $regex: search, $options: 'i' } }
    : {};
  const suppliers = await Supplier.find(filter).sort({ createdAt: -1 }).lean();
  res.json(suppliers);
});


const getSupplierById = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) {
    res.status(404);
    throw new Error('Supplier not found');
  }
  res.json(supplier);
});

const createSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.create(req.body);
  tg.notifySupplierCreated(supplier, req.user);
  res.status(201).json(supplier);
});

const updateSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!supplier) {
    res.status(404);
    throw new Error('Supplier not found');
  }
  res.json(supplier);
});

const deleteSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) { res.status(404); throw new Error('Supplier not found'); }
  supplier.isActive    = false;
  supplier.deletedAt   = new Date();
  supplier.deletedBy   = req.user?.name || 'System';
  supplier.deletedFrom = 'suppliers';
  await supplier.save();
  tg.notifySupplierDeleted(supplier, req.user);
  res.json({ message: 'Supplier moved to recycle bin.' });
});

const bulkDeleteSuppliers = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!ids?.length) { res.status(400); throw new Error('No ids provided'); }
  await Supplier.updateMany(
    { _id: { $in: ids } },
    { isActive: false, deletedAt: new Date(), deletedBy: req.user?.name || 'System', deletedFrom: 'suppliers' }
  );
  res.json({ message: `${ids.length} supplier(s) moved to recycle bin.` });
});

const restoreSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) { res.status(404); throw new Error('Supplier not found'); }
  supplier.isActive    = true;
  supplier.deletedAt   = null;
  supplier.deletedBy   = null;
  supplier.deletedFrom = null;
  await supplier.save();
  res.json({ message: 'Supplier restored.', supplier });
});

const permanentDeleteSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) { res.status(404); throw new Error('Supplier not found'); }
  await supplier.deleteOne();
  res.json({ message: 'Supplier permanently deleted.' });
});

module.exports = {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  bulkDeleteSuppliers,
  restoreSupplier,
  permanentDeleteSupplier,
};
