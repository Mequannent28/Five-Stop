const asyncHandler        = require('express-async-handler');
const StockRequest        = require('../models/StockRequest');
const RawMaterial         = require('../models/RawMaterial');
const { DEPARTMENTS }     = require('../models/StockRequest');
const { invalidateDashboardCache } = require('./dashboardController');
const tg                  = require('../utils/telegramNotifier');
const notify              = require('../utils/notificationHelper');

// ── Auto voucher number ───────────────────────────────────────────
const generateVoucherNo = async () => {
  const count = await StockRequest.countDocuments();
  return `SIR-${String(count + 1).padStart(5, '0')}`;
};

// ── Helper: apply/reverse stock deduction ────────────────────────
async function applyStockDeduction(items, reverse = false) {
  for (const item of items) {
    const mat = await RawMaterial.findById(item.material);
    if (!mat) continue;
    const qty = item.issuedQty || item.requestedQty;
    mat.currentStock = reverse
      ? mat.currentStock + qty
      : mat.currentStock - qty;
    if (mat.currentStock < 0) mat.currentStock = 0;
    await mat.save();
  }
}

// ── Helper: compute totals + availability ────────────────────────
async function resolveItemCosts(items) {
  let total = 0;
  const resolved = [];
  const stockWarnings = []; // items where requestedQty > currentStock

  for (const item of items) {
    const mat = await RawMaterial.findById(item.material).select('unitCost name unit currentStock');
    if (!mat) throw new Error(`Material not found: ${item.material}`);
    const unitCost    = mat.unitCost || 0;
    const requestedQty = Number(item.requestedQty);
    const totalCost   = unitCost * requestedQty;
    total += totalCost;

    // Flag if requested exceeds available stock
    if (requestedQty > mat.currentStock) {
      stockWarnings.push({
        name:        mat.name,
        unit:        mat.unit,
        requested:   requestedQty,
        available:   mat.currentStock,
        shortfall:   requestedQty - mat.currentStock,
      });
    }

    resolved.push({
      material:     mat._id,
      requestedQty,
      issuedQty:    0,
      unitCost,
      totalCost,
      note: item.note || '',
    });
  }
  return { resolved, total, stockWarnings };
}

// ── GET /api/stock-requests ───────────────────────────────────────
const getStockRequests = asyncHandler(async (req, res) => {
  const { status, department, from, to, type } = req.query;
  const filter = { deletedAt: null };

  if (status)     filter.status     = status;
  if (department) filter.department = department;
  if (type)       filter.requestType = type;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to)   filter.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }

  const requests = await StockRequest.find(filter)
    .populate('items.material', 'name unit unitCost currentStock')
    .populate('requestedBy', 'name role')
    .populate('approvedBy',  'name role')
    .populate('issuedBy',    'name role')
    .populate('rejectedBy',  'name role')
    .sort({ createdAt: -1 })
    .limit(200)   // cap at 200 — prevents unbounded queries
    .lean();

  res.json(requests);
});

// ── GET /api/stock-requests/:id ───────────────────────────────────
const getStockRequestById = asyncHandler(async (req, res) => {
  const request = await StockRequest.findById(req.params.id)
    .populate('items.material', 'name unit unitCost currentStock category')
    .populate('requestedBy', 'name role email')
    .populate('approvedBy',  'name role')
    .populate('issuedBy',    'name role')
    .populate('rejectedBy',  'name role')
    .populate('trail.by',    'name')
    .lean();

  if (!request || request.deletedAt) {
    res.status(404); throw new Error('Stock request not found');
  }
  res.json(request);
});

// ── POST /api/stock-requests ──────────────────────────────────────
// Any logged-in user (storekeeper, manager, admin) can create a request
const createStockRequest = asyncHandler(async (req, res) => {
  const { department, items = [], notes, priority, requestType, date } = req.body;

  if (!department || !DEPARTMENTS.includes(department)) {
    res.status(400); throw new Error('Invalid department');
  }
  if (!items.length) {
    res.status(400); throw new Error('At least one item is required');
  }

  const { resolved, total, stockWarnings } = await resolveItemCosts(items);

  const isDirectIssue = requestType === 'direct_issue' &&
    ['admin', 'manager', 'storekeeper'].includes(req.user.role);

  // Block direct issue if any item exceeds available stock — must use partial or request workflow
  if (isDirectIssue && stockWarnings.length > 0) {
    const msgs = stockWarnings.map(w =>
      `${w.name}: requested ${w.requested} ${w.unit} but only ${w.available} available`
    ).join('; ');
    res.status(400);
    throw new Error(`Insufficient stock for direct issue — ${msgs}`);
  }

  const status = isDirectIssue ? 'issued' : 'pending';
  const voucherNo = await generateVoucherNo();

  const trailEntry = {
    action: isDirectIssue ? 'issued' : 'pending',
    by: req.user._id,
    byName: req.user.name,
    byRole: req.user.role,
    note: isDirectIssue ? 'Direct issue by storekeeper/admin' : 'Request submitted',
  };

  // For direct issue, set issuedQty = requestedQty
  if (isDirectIssue) {
    resolved.forEach(item => { item.issuedQty = item.requestedQty; });
  }

  const newRequest = await StockRequest.create({
    voucherNo,
    requestType: isDirectIssue ? 'direct_issue' : 'request',
    department,
    requestedBy: req.user._id,
    requestedAt: date ? new Date(date) : new Date(),
    items:       resolved,
    priority:    priority || 'normal',
    status,
    totalCost:   total,
    notes:       notes || '',
    date:        date ? new Date(date) : new Date(),
    issuedBy:    isDirectIssue ? req.user._id : undefined,
    issuedAt:    isDirectIssue ? new Date() : undefined,
    trail: [trailEntry],
  });

  // Deduct stock immediately for direct issues
  if (isDirectIssue) {
    await applyStockDeduction(resolved);
  }

  const populated = await StockRequest.findById(newRequest._id)
    .populate('items.material', 'name unit unitCost')
    .populate('requestedBy', 'name role')
    .lean();

  invalidateDashboardCache();

  // Telegram notification
  tg.notifyStockRequestCreated && tg.notifyStockRequestCreated(populated, req.user);
  notify.push({ type: 'stock_request', title: isDirectIssue ? 'Direct Stock Issue' : 'New Stock Request', message: `${req.user.name} submitted a ${isDirectIssue ? 'direct issue' : 'request'} for ${department} — ${populated.items?.length} item(s)`, icon: isDirectIssue ? '📤' : '📋', link: '/stock-requests', severity: isDirectIssue ? 'success' : 'info', userId: req.user._id });

  res.status(201).json({ ...populated, stockWarnings: stockWarnings || [] });
});

// ── PUT /api/stock-requests/:id ───────────────────────────────────
// Edit only pending requests
const updateStockRequest = asyncHandler(async (req, res) => {
  const request = await StockRequest.findById(req.params.id);
  if (!request || request.deletedAt) {
    res.status(404); throw new Error('Stock request not found');
  }
  if (request.status !== 'pending') {
    res.status(400); throw new Error('Only pending requests can be edited');
  }

  const { department, items, notes, priority } = req.body;

  if (items && items.length) {
    const { resolved, total } = await resolveItemCosts(items);
    request.items     = resolved;
    request.totalCost = total;
  }
  if (department && DEPARTMENTS.includes(department)) request.department = department;
  if (notes !== undefined) request.notes = notes;
  if (priority)            request.priority = priority;

  await request.save();

  const populated = await StockRequest.findById(request._id)
    .populate('items.material', 'name unit unitCost')
    .populate('requestedBy', 'name role')
    .lean();

  res.json(populated);
});

// ── POST /api/stock-requests/:id/approve ─────────────────────────
// Manager or Admin approves the request
const approveStockRequest = asyncHandler(async (req, res) => {
  const { note = '' } = req.body;
  const request = await StockRequest.findById(req.params.id);
  if (!request || request.deletedAt) {
    res.status(404); throw new Error('Stock request not found');
  }
  if (request.status !== 'pending') {
    res.status(400); throw new Error(`Cannot approve a request in "${request.status}" status`);
  }

  request.status      = 'approved';
  request.approvedBy  = req.user._id;
  request.approvedAt  = new Date();
  request.approveNote = note;
  request.trail.push({
    action: 'approved',
    by: req.user._id,
    byName: req.user.name,
    byRole: req.user.role,
    note,
  });

  await request.save();

  const populated = await StockRequest.findById(request._id)
    .populate('items.material', 'name unit unitCost')
    .populate('requestedBy approvedBy', 'name role')
    .lean();

  invalidateDashboardCache();
  tg.notifyStockRequestApproved && tg.notifyStockRequestApproved(populated, req.user);
  notify.push({ type: 'stock_request', title: 'Stock Request Approved', message: `${req.user.name} approved request ${populated.voucherNo} for ${populated.department}`, icon: '✅', link: '/stock-requests', severity: 'success', userId: req.user._id });
  res.json({ message: 'Request approved. Ready for stock issue.', request: populated });
});

// ── POST /api/stock-requests/:id/issue ───────────────────────────
// Storekeeper / Admin physically issues stock and deducts inventory
const issueStock = asyncHandler(async (req, res) => {
  const { note = '', items: issuedItems } = req.body;
  const request = await StockRequest.findById(req.params.id);
  if (!request || request.deletedAt) {
    res.status(404); throw new Error('Stock request not found');
  }
  if (!['approved', 'pending'].includes(request.status)) {
    res.status(400); throw new Error(`Cannot issue stock for a request in "${request.status}" status`);
  }

  // Apply partial quantity overrides
  if (issuedItems && issuedItems.length) {
    for (const issued of issuedItems) {
      const item = request.items.find(i => i.material.toString() === issued.material);
      if (item) {
        item.issuedQty = Number(issued.issuedQty) || 0;
        item.totalCost = item.unitCost * item.issuedQty;
      }
    }
  } else {
    request.items.forEach(item => {
      item.issuedQty = item.requestedQty;
      item.totalCost = item.unitCost * item.issuedQty;
    });
  }

  // ── Stock sufficiency check ───────────────────────────────────
  // Fetch current stock for all items in parallel
  const matIds = request.items.map(i => i.material);
  const materials = await RawMaterial.find({ _id: { $in: matIds } }).select('name unit currentStock').lean();
  const matMap = {};
  materials.forEach(m => { matMap[m._id.toString()] = m; });

  const insufficientItems = [];
  const stockWarnings     = [];

  for (const item of request.items) {
    if (item.issuedQty <= 0) continue;
    const mat = matMap[item.material.toString()];
    if (!mat) continue;
    if (item.issuedQty > mat.currentStock) {
      insufficientItems.push({
        name:      mat.name,
        unit:      mat.unit,
        requested: item.requestedQty,
        issuing:   item.issuedQty,
        available: mat.currentStock,
        shortfall: item.issuedQty - mat.currentStock,
      });
    } else if (mat.currentStock - item.issuedQty <= 0) {
      // Will empty the stock — note as warning but allow
      stockWarnings.push(`${mat.name} will be completely emptied after this issue`);
    }
  }

  // If any item has insufficient stock — block and inform
  if (insufficientItems.length > 0) {
    const msgs = insufficientItems.map(w =>
      `${w.name}: issuing ${w.issuing} ${w.unit} but only ${w.available} ${w.unit} available (shortfall: ${w.shortfall})`
    ).join('\n');
    res.status(400);
    throw new Error(`Insufficient stock:\n${msgs}\n\nPlease reduce the issue quantity or wait for restocking.`);
  }

  // Recalculate total
  request.totalCost = request.items.reduce((s, i) => s + (i.totalCost || 0), 0);

  request.status    = 'issued';
  request.issuedBy  = req.user._id;
  request.issuedAt  = new Date();
  request.issueNote = note;
  request.trail.push({
    action: 'issued',
    by: req.user._id,
    byName: req.user.name,
    byRole: req.user.role,
    note,
  });

  await request.save();

  // Deduct stock
  await applyStockDeduction(request.items);

  const populated = await StockRequest.findById(request._id)
    .populate('items.material', 'name unit unitCost currentStock')
    .populate('requestedBy approvedBy issuedBy', 'name role')
    .lean();

  invalidateDashboardCache();
  tg.notifyStockIssued && tg.notifyStockIssued(populated, req.user);
  notify.push({ type: 'stock_request', title: 'Stock Issued', message: `${req.user.name} issued stock for ${populated.department} — ETB ${Number(populated.totalCost || 0).toLocaleString()}`, icon: '📦', link: '/stock-requests', severity: 'success', userId: req.user._id });
  res.json({
    message: 'Stock issued and inventory deducted.',
    request: populated,
    stockWarnings,
  });
});

// ── POST /api/stock-requests/:id/reject ──────────────────────────
const rejectStockRequest = asyncHandler(async (req, res) => {
  const { reason = '' } = req.body;
  const request = await StockRequest.findById(req.params.id);
  if (!request || request.deletedAt) {
    res.status(404); throw new Error('Stock request not found');
  }
  if (!['pending', 'approved'].includes(request.status)) {
    res.status(400); throw new Error(`Cannot reject a request in "${request.status}" status`);
  }

  request.status       = 'rejected';
  request.rejectedBy   = req.user._id;
  request.rejectedAt   = new Date();
  request.rejectReason = reason;
  request.trail.push({
    action: 'rejected',
    by: req.user._id,
    byName: req.user.name,
    byRole: req.user.role,
    note: reason,
  });

  await request.save();
  res.json({ message: 'Request rejected.', request });
  tg.notifyStockRequestRejected && tg.notifyStockRequestRejected(request, req.user);
  notify.push({ type: 'stock_request', title: 'Stock Request Rejected', message: `${req.user.name} rejected request ${request.voucherNo} for ${request.department}${reason ? ': ' + reason : ''}`, icon: '❌', link: '/stock-requests', severity: 'error', userId: req.user._id });
});

// ── POST /api/stock-requests/:id/cancel ──────────────────────────
const cancelStockRequest = asyncHandler(async (req, res) => {
  const { reason = '' } = req.body;
  const request = await StockRequest.findById(req.params.id);
  if (!request || request.deletedAt) {
    res.status(404); throw new Error('Stock request not found');
  }
  if (!['pending'].includes(request.status)) {
    res.status(400); throw new Error('Only pending requests can be cancelled');
  }
  // Only the requester or admin can cancel
  const isOwner = request.requestedBy.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== 'admin') {
    res.status(403); throw new Error('Only the requester or admin can cancel this request');
  }

  request.status = 'cancelled';
  request.trail.push({
    action: 'cancelled',
    by: req.user._id,
    byName: req.user.name,
    byRole: req.user.role,
    note: reason,
  });

  await request.save();
  res.json({ message: 'Request cancelled.', request });
  tg.notifyStockRequestCancelled && tg.notifyStockRequestCancelled(request, req.user);
  notify.push({ type: 'stock_request', title: 'Stock Request Cancelled', message: `${req.user.name} cancelled request ${request.voucherNo} for ${request.department}`, icon: '🚫', link: '/stock-requests', severity: 'warning', userId: req.user._id });
});

// ── DELETE /api/stock-requests/:id ───────────────────────────────
// Soft delete — only rejected/cancelled requests
const deleteStockRequest = asyncHandler(async (req, res) => {
  const request = await StockRequest.findById(req.params.id);
  if (!request || request.deletedAt) {
    res.status(404); throw new Error('Stock request not found');
  }
  if (!['rejected', 'cancelled'].includes(request.status)) {
    res.status(400); throw new Error('Only rejected or cancelled requests can be deleted');
  }
  request.deletedAt = new Date();
  request.deletedBy = req.user?.name || 'System';
  await request.save();
  tg.notifyStockRequestDeleted && tg.notifyStockRequestDeleted(request, req.user);
  notify.push({ type: 'stock_request', title: 'Stock Request Deleted', message: `${req.user.name} deleted request ${request.voucherNo}`, icon: '🗑️', link: '/stock-requests', severity: 'warning', userId: req.user._id });
  res.json({ message: 'Moved to recycle bin.' });
});

// ── GET /api/stock-requests/summary ──────────────────────────────
const getStockRequestSummary = asyncHandler(async (req, res) => {
  const [pending, approved, issued, rejected] = await Promise.all([
    StockRequest.countDocuments({ status: 'pending',  deletedAt: null }),
    StockRequest.countDocuments({ status: 'approved', deletedAt: null }),
    StockRequest.countDocuments({ status: 'issued',   deletedAt: null }),
    StockRequest.countDocuments({ status: 'rejected', deletedAt: null }),
  ]);

  // Total cost issued this month
  const now   = new Date();
  const from  = new Date(now.getFullYear(), now.getMonth(), 1);
  const issued30 = await StockRequest.find({
    status: 'issued',
    issuedAt: { $gte: from },
    deletedAt: null,
  }).select('totalCost');
  const monthCost = issued30.reduce((s, r) => s + (r.totalCost || 0), 0);

  // By department (issued)
  const byDept = await StockRequest.aggregate([
    { $match: { status: 'issued', deletedAt: null } },
    { $group: { _id: '$department', total: { $sum: '$totalCost' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ]);

  res.json({ pending, approved, issued, rejected, monthCost, byDepartment: byDept });
});

module.exports = {
  getStockRequests,
  getStockRequestById,
  createStockRequest,
  updateStockRequest,
  approveStockRequest,
  issueStock,
  rejectStockRequest,
  cancelStockRequest,
  deleteStockRequest,
  getStockRequestSummary,
};
