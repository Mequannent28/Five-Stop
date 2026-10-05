const asyncHandler = require('express-async-handler');
const Supplier = require('../models/Supplier');

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
  if (!supplier) {
    res.status(404);
    throw new Error('Supplier not found');
  }
  await supplier.deleteOne();
  res.json({ message: 'Supplier removed' });
});

module.exports = {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
};
