const asyncHandler = require('express-async-handler');
const InventoryCount = require('../models/InventoryCount');
const RawMaterial = require('../models/RawMaterial');
const StockTransaction = require('../models/StockTransaction');

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

// ── Helper: compute WAC from approved/posted transactions up to a date ─────
async function computeWAC(materialId, upToDate) {
  const txns = await StockTransaction.find({
    $or: [{ material: materialId }, { 'items.material': materialId }],
    status: { $in: ['approved', 'posted'] },
    date: { $lte: upToDate },
    type: 'in',
  }).sort({ date: 1 });

  let totalQty = 0;
  let totalCost = 0;

  for (const tx of txns) {
    // Multi-item transaction
    if (tx.items && tx.items.length > 0) {
      const line = tx.items.find(i => String(i.material) === String(materialId));
      if (line) {
        totalQty  += line.quantity;
        totalCost += (line.unitCost || 0) * line.quantity;
      }
    } else if (String(tx.material) === String(materialId)) {
      totalQty  += tx.quantity || 0;
      totalCost += (tx.unitCost || 0) * (tx.quantity || 0);
    }
  }

  return totalQty > 0 ? totalCost / totalQty : 0;
}

// ── Helper: compute period movement (in/out) ───────────────────────────────
async function getPeriodMovement(materialId, periodStart, periodEnd) {
  const txns = await StockTransaction.find({
    $or: [{ material: materialId }, { 'items.material': materialId }],
    status: { $in: ['approved', 'posted'] },
    date: { $gte: periodStart, $lte: periodEnd },
  });

  let inQty = 0, outQty = 0;
  for (const tx of txns) {
    const direction = tx.type; // 'in' or 'out'
    let qty = 0;
    if (tx.items && tx.items.length > 0) {
      const line = tx.items.find(i => String(i.material) === String(materialId));
      if (line) qty = line.quantity;
    } else if (String(tx.material) === String(materialId)) {
      qty = tx.quantity || 0;
    }
    if (direction === 'in')  inQty  += qty;
    if (direction === 'out') outQty += qty;
  }
  return { inQty, outQty };
}

// ── Helper: get stock at the END of the previous month (begin balance) ────
async function getBeginBalance(materialId, periodStart) {
  const txns = await StockTransaction.find({
    $or: [{ material: materialId }, { 'items.material': materialId }],
    status: { $in: ['approved', 'posted'] },
    date: { $lt: periodStart },
  });

  let balance = 0;
  for (const tx of txns) {
    const direction = tx.type;
    let qty = 0;
    if (tx.items && tx.items.length > 0) {
      const line = tx.items.find(i => String(i.material) === String(materialId));
      if (line) qty = line.quantity;
    } else if (String(tx.material) === String(materialId)) {
      qty = tx.quantity || 0;
    }
    if (direction === 'in')  balance += qty;
    if (direction === 'out') balance -= qty;
  }
  return Math.max(0, balance);
}

// ════════════════════════════════════════════════════════════════════════════
// GET  /api/inventory-count/stores
// Returns distinct store locations from RawMaterial
// ════════════════════════════════════════════════════════════════════════════
exports.getStores = asyncHandler(async (req, res) => {
  const stores = await RawMaterial.distinct('storeLocation', { isActive: true });
  res.json({ stores: stores.filter(Boolean) });
});

// ════════════════════════════════════════════════════════════════════════════
// GET  /api/inventory-count?year=&month=&store=
// List inventory count sessions (filter optional)
// ════════════════════════════════════════════════════════════════════════════
exports.listCounts = asyncHandler(async (req, res) => {
  const { year, month, store, status } = req.query;
  const filter = {};
  if (year)   filter.periodYear  = Number(year);
  if (month)  filter.periodMonth = Number(month);
  if (store)  filter.storeLocation = store;
  if (status) filter.status = status;

  const counts = await InventoryCount.find(filter)
    .sort({ periodYear: -1, periodMonth: -1, storeLocation: 1 })
    .populate('createdBy', 'name')
    .populate('approvedBy', 'name')
    .lean();

  res.json({ counts });
});

// ════════════════════════════════════════════════════════════════════════════
// GET  /api/inventory-count/:id
// Get a single inventory count with full lines
// ════════════════════════════════════════════════════════════════════════════
exports.getCount = asyncHandler(async (req, res) => {
  const doc = await InventoryCount.findById(req.params.id)
    .populate('createdBy', 'name')
    .populate('approvedBy', 'name')
    .lean();
  if (!doc) return res.status(404).json({ message: 'Count not found' });
  res.json({ count: doc });
});

// ════════════════════════════════════════════════════════════════════════════
// POST /api/inventory-count/initialize
// Creates a new count sheet for store+month+year, pre-filled with all
// materials in that store and their begin balance + period movement.
// ════════════════════════════════════════════════════════════════════════════
exports.initializeCount = asyncHandler(async (req, res) => {
  const { periodYear, periodMonth, storeLocation, notes } = req.body;

  if (!periodYear || !periodMonth || !storeLocation) {
    return res.status(400).json({ message: 'periodYear, periodMonth and storeLocation are required' });
  }

  // Check duplicate
  const exists = await InventoryCount.findOne({ periodYear, periodMonth, storeLocation });
  if (exists) {
    return res.status(409).json({
      message: `Count for ${storeLocation} – ${MONTHS[periodMonth - 1]} ${periodYear} already exists`,
      existingId: exists._id,
    });
  }

  const periodStart = new Date(periodYear, periodMonth - 1, 1);      // first day of month
  const periodEnd   = new Date(periodYear, periodMonth, 0, 23, 59, 59); // last day of month

  const materials = await RawMaterial.find({ storeLocation, isActive: true }).lean();

  const lines = await Promise.all(
    materials.map(async (mat) => {
      const beginBalance = await getBeginBalance(mat._id, periodStart);
      const { inQty, outQty } = await getPeriodMovement(mat._id, periodStart, periodEnd);
      const systemBalance = Math.max(0, beginBalance + inQty - outQty);
      const wac = await computeWAC(mat._id, periodEnd);

      return {
        material:      mat._id,
        materialName:  mat.name,
        unit:          mat.unit,
        beginBalance,
        inQty,
        outQty,
        systemBalance,
        physicalCount: null,
        variance:      0,
        varianceType:  null,
        wac,
        varianceValue: 0,
        isCounted:     false,
        note:          '',
      };
    })
  );

  const title = `${MONTHS[periodMonth - 1]} ${periodYear} – ${storeLocation}`;

  const doc = await InventoryCount.create({
    periodYear,
    periodMonth,
    storeLocation,
    title,
    lines,
    totalItems: lines.length,
    notes: notes || '',
    createdBy: req.user._id,
  });

  res.status(201).json({ count: doc });
});

// ════════════════════════════════════════════════════════════════════════════
// PATCH /api/inventory-count/:id/lines
// Update physical counts for one or more lines (save progress)
// Body: { lines: [{ material, physicalCount, note }] }
// ════════════════════════════════════════════════════════════════════════════
exports.updateLines = asyncHandler(async (req, res) => {
  const doc = await InventoryCount.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Count not found' });
  if (doc.status === 'approved' || doc.status === 'closed') {
    return res.status(400).json({ message: 'Cannot edit an approved or closed count' });
  }

  const updates = req.body.lines || [];

  for (const upd of updates) {
    const line = doc.lines.find(l => String(l.material) === String(upd.material));
    if (!line) continue;

    if (upd.physicalCount !== undefined && upd.physicalCount !== null) {
      line.physicalCount = Number(upd.physicalCount);
      line.isCounted     = true;
      line.variance      = line.physicalCount - line.systemBalance;
      line.varianceValue = line.variance * (line.wac || 0);
      if (line.variance > 0)       line.varianceType = 'positive';
      else if (line.variance < 0)  line.varianceType = 'negative';
      else                          line.varianceType = 'zero';
    }
    if (upd.note !== undefined) line.note = upd.note;
  }

  // Recompute summary totals
  doc.countedItems   = doc.lines.filter(l => l.isCounted).length;
  doc.uncountedItems = doc.lines.length - doc.countedItems;
  doc.totalItems     = doc.lines.length;
  doc.positiveVariance = doc.lines
    .filter(l => l.varianceType === 'positive')
    .reduce((s, l) => s + l.varianceValue, 0);
  doc.negativeVariance = doc.lines
    .filter(l => l.varianceType === 'negative')
    .reduce((s, l) => s + l.varianceValue, 0);
  doc.netVarianceValue = doc.positiveVariance + doc.negativeVariance;

  await doc.save();
  res.json({ count: doc });
});

// ════════════════════════════════════════════════════════════════════════════
// POST /api/inventory-count/:id/submit
// Submit for approval
// ════════════════════════════════════════════════════════════════════════════
exports.submitCount = asyncHandler(async (req, res) => {
  const doc = await InventoryCount.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Count not found' });
  if (doc.status !== 'draft') {
    return res.status(400).json({ message: `Cannot submit a count in "${doc.status}" status` });
  }

  doc.status      = 'submitted';
  doc.submittedBy = req.user._id;
  doc.submittedAt = new Date();
  await doc.save();

  res.json({ count: doc, message: 'Count submitted for approval' });
});

// ════════════════════════════════════════════════════════════════════════════
// POST /api/inventory-count/:id/approve
// Approve and lock the count; set closing date
// ════════════════════════════════════════════════════════════════════════════
exports.approveCount = asyncHandler(async (req, res) => {
  const doc = await InventoryCount.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Count not found' });
  if (doc.status !== 'submitted') {
    return res.status(400).json({ message: `Cannot approve a count in "${doc.status}" status` });
  }

  doc.status      = 'approved';
  doc.approvedBy  = req.user._id;
  doc.approvedAt  = new Date();
  doc.closingDate = new Date();

  // Lock all lines: systemBalance becomes the physical count if not counted
  for (const line of doc.lines) {
    if (!line.isCounted) {
      line.physicalCount = line.systemBalance;
      line.variance      = 0;
      line.varianceType  = 'zero';
      line.varianceValue = 0;
    }
  }

  await doc.save();
  res.json({ count: doc, message: 'Count approved and closing balance set' });
});

// ════════════════════════════════════════════════════════════════════════════
// DELETE /api/inventory-count/:id
// Delete a draft count
// ════════════════════════════════════════════════════════════════════════════
exports.deleteCount = asyncHandler(async (req, res) => {
  const doc = await InventoryCount.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Count not found' });
  if (doc.status !== 'draft') {
    return res.status(400).json({ message: 'Only draft counts can be deleted' });
  }
  await doc.deleteOne();
  res.json({ message: 'Count deleted' });
});
