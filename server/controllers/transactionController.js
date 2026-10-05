const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const StockTransaction = require('../models/StockTransaction');
const { VOUCHER_DIRECTION } = require('../models/StockTransaction');
const RawMaterial = require('../models/RawMaterial');
const User = require('../models/User');

// ── helpers ───────────────────────────────────────────────────────────
const verifyUserPassword = async (userId, password) => {
  const user = await User.findById(userId).select('+password');
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password);
  return ok ? user : null;
};

// ── Auto voucher number ───────────────────────────────────────────────
const generateVoucherNo = async (voucherType) => {
  const prefixes = {
    cash_grv:       'CGRV',
    credit_grv:     'CRGRV',
    disposal:       'DISP',
    neg_adjustment: 'NADJ',
    pos_adjustment: 'PADJ',
    fresh_bazaar:   'FBR',
    sales_import:   'SALE',
  };
  const prefix = prefixes[voucherType] ?? 'TXN';
  const count = await StockTransaction.countDocuments({ voucherType });
  return `${prefix}-${String(count + 1).padStart(5, '0')}`;
};

// ── GET /api/transactions ─────────────────────────────────────────────
const getTransactions = asyncHandler(async (req, res) => {
  const { voucherType, material, from, to } = req.query;
  const filter = {};
  if (voucherType) filter.voucherType = voucherType;
  if (material)    filter.$or = [{ material }, { 'items.material': material }];
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to)   filter.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }

  const transactions = await StockTransaction.find(filter)
    .populate('material', 'name unit')
    .populate('items.material', 'name unit unitCost')
    .populate('supplier', 'name')
    .populate('performedBy', 'name')
    .sort({ date: -1 })
    .limit(500);

  res.json(transactions);
});

// ── POST /api/transactions ────────────────────────────────────────────
/*
  Body shape:
  {
    voucherType: 'cash_grv' | 'credit_grv' | 'disposal' | 'neg_adjustment' | 'pos_adjustment' | 'fresh_bazaar',
    voucherNo:  string (optional, auto-generated if empty),
    supplier:   ObjectId  (required for cash_grv / credit_grv),
    items: [{ material: ObjectId, quantity: number, unitCost: number }],
    reason:    string  (for disposal / adjustments),
    reference: string  (optional),
    notes:     string  (optional),
    date:      ISO string (optional, defaults to now),
  }
*/
const createTransaction = asyncHandler(async (req, res) => {
  const {
    voucherType, voucherNo, supplier,
    items = [],
    reason, reference, notes, date,
  } = req.body;

  // Validate voucher type
  if (!VOUCHER_DIRECTION[voucherType]) {
    res.status(400);
    throw new Error(`Unknown voucher type: ${voucherType}`);
  }

  const direction = VOUCHER_DIRECTION[voucherType]; // 'in' | 'out'

  // Validate items
  if (!items.length) {
    res.status(400);
    throw new Error('At least one item is required.');
  }

  // Supplier required for GRVs
  if ((voucherType === 'cash_grv' || voucherType === 'credit_grv') && !supplier) {
    res.status(400);
    throw new Error('Supplier is required for Goods Receiving Vouchers.');
  }

  // Resolve materials and check stock for OUT vouchers
  const resolvedItems = [];
  for (const item of items) {
    const mat = await RawMaterial.findById(item.material);
    if (!mat) {
      res.status(404);
      throw new Error(`Material not found: ${item.material}`);
    }
    if (direction === 'out' && mat.currentStock < item.quantity) {
      res.status(400);
      throw new Error(
        `Insufficient stock for "${mat.name}". Available: ${mat.currentStock} ${mat.unit}, requested: ${item.quantity}.`
      );
    }
    const unitCost  = Number(item.unitCost) || mat.unitCost || 0;
    const totalCost = unitCost * Number(item.quantity);
    resolvedItems.push({ material: mat._id, quantity: Number(item.quantity), unitCost, totalCost, _doc: mat });
  }

  // Compute totals
  const totalAmount = resolvedItems.reduce((s, i) => s + i.totalCost, 0);

  // Build transaction doc
  // For single-item legacy compat, also set top-level material/type/quantity
  const firstItem = resolvedItems[0];
  const txnData = {
    voucherType,
    voucherNo: voucherNo || (await generateVoucherNo(voucherType)),
    supplier:  supplier || undefined,
    type:      direction,
    material:  firstItem.material,
    quantity:  firstItem.quantity,
    unitCost:  firstItem.unitCost,
    items:     resolvedItems.map(({ material, quantity, unitCost, totalCost }) => ({ material, quantity, unitCost, totalCost })),
    reason:    reason || '',
    reference: reference || '',
    notes:     notes || '',
    date:      date ? new Date(date) : new Date(),
    performedBy: req.user._id,
    totalAmount,
    status: 'pending',
    trail: [{ action: 'pending', by: req.user._id, byName: req.user.name, byRole: req.user.role }],
  };

  const transaction = await StockTransaction.create(txnData);

  // Apply stock changes
  for (const item of resolvedItems) {
    item._doc.currentStock += direction === 'in' ? item.quantity : -item.quantity;
    await item._doc.save();
  }

  const populated = await StockTransaction.findById(transaction._id)
    .populate('material', 'name unit')
    .populate('items.material', 'name unit unitCost')
    .populate('supplier', 'name')
    .populate('performedBy', 'name');

  res.status(201).json(populated);
});

// ── DELETE /api/transactions/:id ──────────────────────────────────────
const deleteTransaction = asyncHandler(async (req, res) => {
  const transaction = await StockTransaction.findById(req.params.id);
  if (!transaction) { res.status(404); throw new Error('Transaction not found'); }

  const direction = transaction.type || VOUCHER_DIRECTION[transaction.voucherType];

  // Reverse all line items
  const itemsToReverse = transaction.items?.length
    ? transaction.items
    : [{ material: transaction.material, quantity: transaction.quantity }];

  for (const item of itemsToReverse) {
    const mat = await RawMaterial.findById(item.material);
    if (mat) {
      mat.currentStock += direction === 'in' ? -item.quantity : item.quantity;
      await mat.save();
    }
  }

  await transaction.deleteOne();
  res.json({ message: 'Transaction deleted and stock reversed.' });
});

// ── GET /api/transactions/summary ────────────────────────────────────
// Returns totals per voucher type for a date range (used by reports)
const getVoucherSummary = asyncHandler(async (req, res) => {
  const { from, to, voucherType } = req.query;
  const match = {};
  if (voucherType) match.voucherType = voucherType;
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to)   match.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }

  const summary = await StockTransaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$voucherType',
        count:       { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' },
        totalQty:    { $sum: '$quantity' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.json(summary);
});

// ── POST /api/transactions/:id/advance ───────────────────────────────
/*
  Body: { action: 'check'|'approve'|'post'|'void', password: '...', note: '' }

  check   : pending  → checked   (manager / admin)
  approve : checked  → approved  (admin)
  post    : approved → posted    (admin / manager) — locks document
  void    : any      → voided    (admin) — reverses stock
*/
const advanceTransaction = asyncHandler(async (req, res) => {
  const { action, password, note = '' } = req.body;
  if (!password) { res.status(400); throw new Error('Password is required'); }

  const actor = await verifyUserPassword(req.user._id, password);
  if (!actor) { res.status(401); throw new Error('Incorrect password — action not authorised'); }

  const txn = await StockTransaction.findById(req.params.id);
  if (!txn) { res.status(404); throw new Error('Transaction not found'); }

  const transitions = {
    check:   { from: ['pending'],            to: 'checked',  roles: ['admin','manager'] },
    approve: { from: ['checked'],            to: 'approved', roles: ['admin'] },
    post:    { from: ['approved'],           to: 'posted',   roles: ['admin','manager'] },
    void:    { from: ['pending','checked','approved','posted'], to: 'voided', roles: ['admin'] },
  };

  const rule = transitions[action];
  if (!rule) { res.status(400); throw new Error(`Unknown action: ${action}`); }
  if (!rule.from.includes(txn.status)) {
    res.status(400);
    throw new Error(`Cannot ${action} a voucher that is currently "${txn.status}"`);
  }
  if (!rule.roles.includes(actor.role)) {
    res.status(403);
    throw new Error(`Your role (${actor.role}) cannot perform "${action}"`);
  }

  const prev = txn.status;
  txn.status = rule.to;
  txn.trail = txn.trail || [];
  txn.trail.push({ action: rule.to, by: actor._id, byName: actor.name, byRole: actor.role, note });

  if (action === 'check')   { txn.checkedBy  = actor._id; txn.checkedAt  = new Date(); }
  if (action === 'approve') { txn.approvedBy = actor._id; txn.approvedAt = new Date(); }
  if (action === 'post')    { txn.postedBy   = actor._id; txn.postedAt   = new Date(); }

  // Voiding reverses stock
  if (action === 'void') {
    const direction = txn.type || VOUCHER_DIRECTION[txn.voucherType];
    const itemsToReverse = txn.items?.length
      ? txn.items
      : [{ material: txn.material, quantity: txn.quantity }];
    for (const item of itemsToReverse) {
      const mat = await RawMaterial.findById(item.material);
      if (mat) {
        mat.currentStock += direction === 'in' ? -item.quantity : item.quantity;
        await mat.save();
      }
    }
  }

  await txn.save();

  const populated = await StockTransaction.findById(txn._id)
    .populate('material', 'name unit')
    .populate('items.material', 'name unit unitCost')
    .populate('supplier', 'name')
    .populate('performedBy checkedBy approvedBy postedBy', 'name role');

  res.json({ message: `Voucher moved from "${prev}" → "${rule.to}"`, transaction: populated });
});

// ── POST /api/transactions/import-sales ──────────────────────────────
const importSales = asyncHandler(async (req, res) => {
  const { sales, notes, reference } = req.body;
  if (!sales || !sales.length) {
    res.status(400);
    throw new Error('No sales data provided');
  }

  const Product = require('../models/Product');
  const materialDeductions = {};

  const notFound = [];

  for (const sale of sales) {
    const { productName, quantity } = sale;
    if (!productName || !quantity) continue;

    // 1. Try to find Product
    const product = await Product.findOne({ name: new RegExp(`^${productName}$`, 'i') });
    if (product) {
      if (product.ingredients && product.ingredients.length > 0) {
        for (const ing of product.ingredients) {
          const matId = ing.material.toString();
          const deductQty = ing.quantity * Number(quantity);
          materialDeductions[matId] = (materialDeductions[matId] || 0) + deductQty;
        }
      }
      continue;
    }

    // 2. Try to find RawMaterial directly
    const material = await RawMaterial.findOne({ name: new RegExp(`^${productName}$`, 'i') });
    if (material) {
      const matId = material._id.toString();
      materialDeductions[matId] = (materialDeductions[matId] || 0) + Number(quantity);
      continue;
    }

    notFound.push(productName);
  }

  const resolvedItems = [];
  for (const [matId, qty] of Object.entries(materialDeductions)) {
    if (qty <= 0) continue;
    const mat = await RawMaterial.findById(matId);
    if (mat) {
      resolvedItems.push({
        material: mat._id,
        quantity: qty,
        unitCost: mat.unitCost || 0,
        totalCost: (mat.unitCost || 0) * qty,
        _doc: mat
      });
    }
  }

  if (resolvedItems.length === 0) {
    return res.status(400).json({
      message: 'No matching products or raw materials found to deduct stock.',
      unmatchedProducts: notFound,
    });
  }

  const totalAmount = resolvedItems.reduce((s, i) => s + i.totalCost, 0);

  const txnData = {
    voucherType: 'sales_import',
    voucherNo: await generateVoucherNo('sales_import'),
    type: 'out',
    items: resolvedItems.map(({ material, quantity, unitCost, totalCost }) => ({ material, quantity, unitCost, totalCost })),
    material: resolvedItems[0].material,
    quantity: resolvedItems[0].quantity,
    unitCost: resolvedItems[0].unitCost,
    reason: 'Sales Report Import',
    reference: reference || '',
    notes: notes || 'Automated stock deduction from sales report',
    date: new Date(),
    performedBy: req.user._id,
    totalAmount,
    status: 'pending',
    trail: [{ action: 'pending', by: req.user._id, byName: req.user.name, byRole: req.user.role }],
  };

  const transaction = await StockTransaction.create(txnData);

  // Apply stock changes
  for (const item of resolvedItems) {
    item._doc.currentStock -= item.quantity;
    await item._doc.save();
  }

  const populated = await StockTransaction.findById(transaction._id)
    .populate('items.material', 'name unit unitCost')
    .populate('performedBy', 'name');

  res.status(201).json({
    message: 'Sales imported and stock deducted successfully.',
    transaction: populated,
    unmatchedProducts: notFound,
  });
});

module.exports = { getTransactions, createTransaction, deleteTransaction, getVoucherSummary, advanceTransaction, importSales };
