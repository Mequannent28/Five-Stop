const asyncHandler = require('express-async-handler');
const StockTransaction = require('../models/StockTransaction');
const Purchase = require('../models/Purchase');
const RawMaterial = require('../models/RawMaterial');
const Supplier = require('../models/Supplier');
const User = require('../models/User');

// ── helpers ──────────────────────────────────────────────────────────
const dayRange = (dateParam) => {
  const start = new Date(dateParam || Date.now());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start, end };
};

const rangeFilter = (from, to) => {
  const f = {};
  if (from) f.$gte = new Date(from);
  if (to)   f.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  return Object.keys(f).length ? f : null;
};

const populateTxn = (q) =>
  q.populate('items.material', 'name unit unitCost')
   .populate('material', 'name unit')
   .populate('supplier', 'name')
   .populate('performedBy', 'name')
   .sort({ date: -1 });

// ── GET /api/reports/daily ────────────────────────────────────────────
const getDailyReport = asyncHandler(async (req, res) => {
  const { start, end } = dayRange(req.query.date);

  const transactions = await populateTxn(
    StockTransaction.find({ date: { $gte: start, $lt: end } })
  );

  const purchases = await Purchase.find({ purchaseDate: { $gte: start, $lt: end } })
    .populate('supplier', 'name')
    .populate('items.material', 'name unit');

  const stockIn  = transactions.filter(t => t.type === 'in').reduce((s, t) => s + (t.quantity || 0), 0);
  const stockOut = transactions.filter(t => t.type === 'out').reduce((s, t) => s + (t.quantity || 0), 0);
  const purchaseTotal = purchases.reduce((s, p) => s + p.totalAmount, 0);

  // Breakdown by voucher type for the day
  const byVoucher = {};
  for (const t of transactions) {
    const vt = t.voucherType || (t.type === 'in' ? 'pos_adjustment' : 'neg_adjustment');
    if (!byVoucher[vt]) byVoucher[vt] = { count: 0, totalAmount: 0, transactions: [] };
    byVoucher[vt].count++;
    byVoucher[vt].totalAmount += t.totalAmount || 0;
    byVoucher[vt].transactions.push(t);
  }

  res.json({ date: start.toISOString().slice(0, 10), stockIn, stockOut, purchaseTotal, transactions, purchases, byVoucher });
});

// ── GET /api/reports/voucher ──────────────────────────────────────────
// Generic per-voucher-type report with date range
// Query: voucherType, from, to
const getVoucherReport = asyncHandler(async (req, res) => {
  const { voucherType, from, to } = req.query;

  const filter = {};
  if (voucherType) filter.voucherType = voucherType;
  const df = rangeFilter(from, to);
  if (df) filter.date = df;

  const transactions = await populateTxn(StockTransaction.find(filter));

  const totalAmount = transactions.reduce((s, t) => s + (t.totalAmount || 0), 0);
  const totalQty    = transactions.reduce((s, t) => s + (t.quantity   || 0), 0);

  // Item-level breakdown: which materials were moved
  const materialMap = {};
  for (const txn of transactions) {
    const lineItems = txn.items?.length ? txn.items : [{ material: txn.material, quantity: txn.quantity, unitCost: txn.unitCost, totalCost: (txn.unitCost || 0) * (txn.quantity || 0) }];
    for (const li of lineItems) {
      if (!li.material) continue;
      const id = li.material._id?.toString() ?? li.material.toString();
      if (!materialMap[id]) materialMap[id] = { name: li.material.name ?? '—', unit: li.material.unit ?? '', totalQty: 0, totalCost: 0 };
      materialMap[id].totalQty  += li.quantity  || 0;
      materialMap[id].totalCost += li.totalCost || 0;
    }
  }

  res.json({
    voucherType: voucherType || 'all',
    from: from || null,
    to:   to   || null,
    count: transactions.length,
    totalAmount,
    totalQty,
    materialBreakdown: Object.values(materialMap).sort((a, b) => b.totalCost - a.totalCost),
    transactions,
  });
});

// ── GET /api/reports/cash-grv ─────────────────────────────────────────
const getCashGRVReport = asyncHandler(async (req, res) => {
  req.query.voucherType = 'cash_grv';
  return getVoucherReport(req, res);
});

// ── GET /api/reports/credit-grv ───────────────────────────────────────
const getCreditGRVReport = asyncHandler(async (req, res) => {
  req.query.voucherType = 'credit_grv';
  return getVoucherReport(req, res);
});

// ── GET /api/reports/disposal ─────────────────────────────────────────
const getDisposalReport = asyncHandler(async (req, res) => {
  req.query.voucherType = 'disposal';
  return getVoucherReport(req, res);
});

// ── GET /api/reports/neg-adjustment ──────────────────────────────────
const getNegAdjReport = asyncHandler(async (req, res) => {
  req.query.voucherType = 'neg_adjustment';
  return getVoucherReport(req, res);
});

// ── GET /api/reports/pos-adjustment ──────────────────────────────────
const getPosAdjReport = asyncHandler(async (req, res) => {
  req.query.voucherType = 'pos_adjustment';
  return getVoucherReport(req, res);
});

// ── GET /api/reports/fresh-bazaar ────────────────────────────────────
const getFreshBazaarReport = asyncHandler(async (req, res) => {
  req.query.voucherType = 'fresh_bazaar';
  return getVoucherReport(req, res);
});

// ── GET /api/reports/stock-levels ────────────────────────────────────
const getStockLevelReport = asyncHandler(async (req, res) => {
  const materials = await RawMaterial.find({}).sort({ name: 1 });
  const totalValue = materials.reduce((s, m) => s + m.currentStock * (m.unitCost || 0), 0);
  res.json({ materials, totalValue, count: materials.length });
});

// ── GET /api/reports/purchases ────────────────────────────────────────
const getPurchaseReport = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const filter = {};
  const df = rangeFilter(from, to);
  if (df) filter.purchaseDate = df;

  const purchases = await Purchase.find(filter)
    .populate('supplier', 'name')
    .populate('items.material', 'name unit')
    .sort({ purchaseDate: -1 });

  const totalAmount = purchases.reduce((s, p) => s + p.totalAmount, 0);
  res.json({ purchases, totalAmount, count: purchases.length });
});

// ── GET /api/reports/summary ──────────────────────────────────────────
// Cross-voucher summary for dashboard / overview
const getSummaryReport = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const match = {};
  const df = rangeFilter(from, to);
  if (df) match.date = df;

  const agg = await StockTransaction.aggregate([
    { $match: match },
    {
      $group: {
        _id:         '$voucherType',
        count:       { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const labels = {
    cash_grv:       'Cash GRV',
    credit_grv:     'Credit GRV',
    disposal:       'Goods Disposal',
    neg_adjustment: 'Negative Adjustment',
    pos_adjustment: 'Positive Adjustment',
    fresh_bazaar:   'Fresh Bazaar GRV',
  };

  const result = agg.map(r => ({ ...r, label: labels[r._id] ?? r._id }));
  res.json({ from: from || null, to: to || null, summary: result });
});

// ── GET /api/reports/stock-balance ────────────────────────────────────
// Comprehensive Stock Balance & Movements Reconciliation
const getStockBalanceReport = asyncHandler(async (req, res) => {
  const { from, to, category, search, status } = req.query;

  const matFilter = { isActive: true };
  if (category && category !== 'all') {
    matFilter.category = category;
  }
  if (search) {
    matFilter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } },
    ];
  }

  const materials = await RawMaterial.find(matFilter).sort({ name: 1 }).lean();
  const materialIds = materials.map(m => m._id.toString());
  const materialMap = {};

  materials.forEach(m => {
    materialMap[m._id.toString()] = {
      _id: m._id,
      code: m.code || '',
      name: m.name,
      category: m.category || 'General',
      unit: m.unit,
      unitCost: Number(m.unitCost || 0),
      reorderLevel: Number(m.reorderLevel || 0),
      currentStock: Number(m.currentStock || 0),
      // movements in period
      cash_grv: { qty: 0, cost: 0 },
      credit_grv: { qty: 0, cost: 0 },
      fresh_bazaar: { qty: 0, cost: 0 },
      pos_adjustment: { qty: 0, cost: 0 },
      neg_adjustment: { qty: 0, cost: 0 },
      disposal: { qty: 0, cost: 0 },
      sales_import: { qty: 0, cost: 0 },
      other_in: { qty: 0, cost: 0 },
      other_out: { qty: 0, cost: 0 },
      postPeriodNetChange: 0,
    };
  });

  const now = new Date();
  let startDate = from ? new Date(from) : null;
  if (startDate) startDate.setHours(0, 0, 0, 0);

  let endDate = to ? new Date(to) : null;
  if (endDate) endDate.setHours(23, 59, 59, 999);

  const txnQuery = { status: { $ne: 'voided' } };
  if (startDate) {
    txnQuery.date = { $gte: startDate };
  }

  const transactions = await StockTransaction.find(txnQuery).lean();

  for (const txn of transactions) {
    const txnDate = new Date(txn.date);
    const vt = txn.voucherType || (txn.type === 'in' ? 'pos_adjustment' : 'neg_adjustment');
    const isOut = ['disposal', 'neg_adjustment', 'sales_import'].includes(vt) || txn.type === 'out';

    const items = txn.items && txn.items.length > 0
      ? txn.items
      : [{
          material: txn.material,
          quantity: txn.quantity,
          unitCost: txn.unitCost || 0,
          totalCost: txn.totalAmount || ((txn.unitCost || 0) * (txn.quantity || 0)),
        }];

    for (const item of items) {
      if (!item.material) continue;
      const mId = item.material.toString();
      const target = materialMap[mId];
      if (!target) continue;

      const qty = Number(item.quantity || 0);
      const cost = Number(item.totalCost || (item.unitCost ? item.unitCost * qty : target.unitCost * qty) || 0);

      if (endDate && txnDate > endDate) {
        // Adjust for transactions occurring after selected end date
        if (isOut) {
          target.postPeriodNetChange += qty;
        } else {
          target.postPeriodNetChange -= qty;
        }
      } else if (!startDate || txnDate >= startDate) {
        if (target[vt]) {
          target[vt].qty += qty;
          target[vt].cost += cost;
        } else if (isOut) {
          target.other_out.qty += qty;
          target.other_out.cost += cost;
        } else {
          target.other_in.qty += qty;
          target.other_in.cost += cost;
        }
      }
    }
  }

  let totalOpeningVal = 0;
  let totalInVal = 0;
  let totalOutVal = 0;
  let totalClosingVal = 0;

  const rows = [];

  for (const mId of materialIds) {
    const item = materialMap[mId];

    const closingStock = (endDate && endDate < now)
      ? Number((item.currentStock + item.postPeriodNetChange).toFixed(4))
      : Number(item.currentStock.toFixed(4));

    const totalInQty = Number((
      item.cash_grv.qty +
      item.credit_grv.qty +
      item.fresh_bazaar.qty +
      item.pos_adjustment.qty +
      item.other_in.qty
    ).toFixed(4));

    const totalInCost = Number((
      item.cash_grv.cost +
      item.credit_grv.cost +
      item.fresh_bazaar.cost +
      item.pos_adjustment.cost +
      item.other_in.cost
    ).toFixed(2));

    const totalOutQty = Number((
      item.neg_adjustment.qty +
      item.disposal.qty +
      item.sales_import.qty +
      item.other_out.qty
    ).toFixed(4));

    const totalOutCost = Number((
      item.neg_adjustment.cost +
      item.disposal.cost +
      item.sales_import.cost +
      item.other_out.cost
    ).toFixed(2));

    // Opening Stock = Closing Stock - Total In + Total Out
    const openingStock = Number((closingStock - totalInQty + totalOutQty).toFixed(4));
    const openingValue = Number((Math.max(0, openingStock) * item.unitCost).toFixed(2));
    const closingValue = Number((Math.max(0, closingStock) * item.unitCost).toFixed(2));

    let rowStatus = 'in_stock';
    if (closingStock <= 0) rowStatus = 'out_of_stock';
    else if (closingStock <= item.reorderLevel) rowStatus = 'low_stock';

    if (status && status !== 'all' && rowStatus !== status) {
      continue;
    }

    totalOpeningVal += openingValue;
    totalInVal += totalInCost;
    totalOutVal += totalOutCost;
    totalClosingVal += closingValue;

    rows.push({
      _id: item._id,
      code: item.code,
      name: item.name,
      category: item.category,
      unit: item.unit,
      unitCost: item.unitCost,
      reorderLevel: item.reorderLevel,
      openingStock,
      openingValue,
      cashGrvQty: Number(item.cash_grv.qty.toFixed(4)),
      cashGrvCost: Number(item.cash_grv.cost.toFixed(2)),
      creditGrvQty: Number(item.credit_grv.qty.toFixed(4)),
      creditGrvCost: Number(item.credit_grv.cost.toFixed(2)),
      freshBazaarQty: Number(item.fresh_bazaar.qty.toFixed(4)),
      freshBazaarCost: Number(item.fresh_bazaar.cost.toFixed(2)),
      posAdjQty: Number(item.pos_adjustment.qty.toFixed(4)),
      posAdjCost: Number(item.pos_adjustment.cost.toFixed(2)),
      totalInQty,
      totalInCost,
      negAdjQty: Number(item.neg_adjustment.qty.toFixed(4)),
      negAdjCost: Number(item.neg_adjustment.cost.toFixed(2)),
      disposalQty: Number(item.disposal.qty.toFixed(4)),
      disposalCost: Number(item.disposal.cost.toFixed(2)),
      salesImportQty: Number(item.sales_import.qty.toFixed(4)),
      salesImportCost: Number(item.sales_import.cost.toFixed(2)),
      totalOutQty,
      totalOutCost,
      netMovementQty: Number((totalInQty - totalOutQty).toFixed(4)),
      closingStock,
      closingValue,
      status: rowStatus,
    });
  }

  const categories = await RawMaterial.distinct('category', { isActive: true });

  res.json({
    from: from || null,
    to: to || null,
    count: rows.length,
    totals: {
      openingValue: Number(totalOpeningVal.toFixed(2)),
      inwardValue: Number(totalInVal.toFixed(2)),
      outwardValue: Number(totalOutVal.toFixed(2)),
      closingValue: Number(totalClosingVal.toFixed(2)),
    },
    categories: ['all', ...categories.filter(Boolean)],
    items: rows,
  });
});

// ── GET /api/reports/stock-balance/ledger/:materialId ─────────────────
const getItemStockLedger = asyncHandler(async (req, res) => {
  const { materialId } = req.params;
  const { from, to } = req.query;

  const material = await RawMaterial.findById(materialId).lean();
  if (!material) {
    res.status(404);
    throw new Error('Material not found');
  }

  const filter = {
    status: { $ne: 'voided' },
    $or: [
      { material: materialId },
      { 'items.material': materialId },
    ],
  };
  const df = rangeFilter(from, to);
  if (df) filter.date = df;

  const transactions = await StockTransaction.find(filter)
    .populate('supplier', 'name')
    .populate('performedBy', 'name role')
    .sort({ date: 1 })
    .lean();

  let runningStock = 0;
  const ledgerEntries = [];

  for (const txn of transactions) {
    const vt = txn.voucherType || (txn.type === 'in' ? 'pos_adjustment' : 'neg_adjustment');
    const isOut = ['disposal', 'neg_adjustment', 'sales_import'].includes(vt) || txn.type === 'out';

    const items = txn.items?.length
      ? txn.items.filter(i => i.material?.toString() === materialId.toString())
      : (txn.material?.toString() === materialId.toString() ? [txn] : []);

    for (const item of items) {
      const qty = Number(item.quantity || 0);
      const unitCost = Number(item.unitCost || material.unitCost || 0);
      const totalCost = Number(item.totalCost || (unitCost * qty) || 0);

      const inQty = isOut ? 0 : qty;
      const outQty = isOut ? qty : 0;
      runningStock += (inQty - outQty);

      ledgerEntries.push({
        txnId: txn._id,
        date: txn.date,
        voucherType: vt,
        voucherNo: txn.voucherNo || '—',
        supplier: txn.supplier?.name || '—',
        reason: txn.reason || txn.reference || txn.notes || '—',
        inQty,
        outQty,
        unitCost,
        totalCost,
        balanceAfter: Number(runningStock.toFixed(4)),
        status: txn.status,
        performedBy: txn.performedBy?.name || '—',
      });
    }
  }

  res.json({
    material,
    count: ledgerEntries.length,
    ledger: ledgerEntries,
  });
});

module.exports = {
  getDailyReport,
  getVoucherReport,
  getCashGRVReport,
  getCreditGRVReport,
  getDisposalReport,
  getNegAdjReport,
  getPosAdjReport,
  getFreshBazaarReport,
  getStockLevelReport,
  getPurchaseReport,
  getSummaryReport,
  getStockBalanceReport,
  getItemStockLedger,
};

