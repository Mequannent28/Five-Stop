/**
 * System Context Service
 * ──────────────────────────────────────────────────────────────────
 * Builds a structured, concise snapshot of the live system state
 * from MongoDB. Called on every AI request — always fresh data.
 * Designed to be token-efficient: summaries + key numbers, not
 * full document dumps.
 */

const RawMaterial      = require('../models/RawMaterial');
const StockTransaction = require('../models/StockTransaction');
const Purchase         = require('../models/Purchase');
const Supplier         = require('../models/Supplier');
const User             = require('../models/User');
const Consumption      = require('../models/Consumption');
const StockRequest     = require('../models/StockRequest');
const Employee         = require('../models/Employee');
const Product          = require('../models/Product');

// ── helpers ──────────────────────────────────────────────────────
const etb = (n) => `ETB ${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

const monthRange = () => {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to:   new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
  };
};

// ── Main snapshot builder ─────────────────────────────────────────
async function buildSystemContext(userRole = 'storekeeper') {
  const { from, to } = monthRange();
  const now = new Date();

  // ── 1. Stock overview ─────────────────────────────────────────
  const [materials, outOfStock, lowStock, allMaterials] = await Promise.all([
    RawMaterial.countDocuments({ isActive: true, deletedAt: null }),
    RawMaterial.countDocuments({ isActive: true, deletedAt: null, currentStock: { $lte: 0 } }),
    RawMaterial.find({ isActive: true, deletedAt: null, $expr: { $lte: ['$currentStock', '$reorderLevel'] }, currentStock: { $gt: 0 } })
      .select('name currentStock reorderLevel unit category unitCost')
      .sort({ currentStock: 1 }).limit(10).lean(),
    RawMaterial.find({ isActive: true, deletedAt: null })
      .select('name currentStock reorderLevel unit category unitCost')
      .lean(),
  ]);

  const outOfStockItems = await RawMaterial.find({
    isActive: true, deletedAt: null, currentStock: { $lte: 0 },
  }).select('name unit category').limit(10).lean();

  const totalStockValue = allMaterials.reduce((s, m) => s + (m.currentStock * m.unitCost), 0);

  const stockByCategory = {};
  allMaterials.forEach(m => {
    if (!stockByCategory[m.category]) stockByCategory[m.category] = { count: 0, value: 0 };
    stockByCategory[m.category].count++;
    stockByCategory[m.category].value += m.currentStock * m.unitCost;
  });

  // ── 2. Recent transactions (last 7 days) ──────────────────────
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentTxns = await StockTransaction.find({
    deletedAt: null,
    date: { $gte: sevenDaysAgo },
  }).select('voucherType type totalAmount date items')
    .populate('items.material', 'name unit')
    .sort({ date: -1 }).limit(20).lean();

  const txnSummary = {
    totalIn:  recentTxns.filter(t => t.type === 'in').reduce((s, t) => s + (t.totalAmount || 0), 0),
    totalOut: recentTxns.filter(t => t.type === 'out').reduce((s, t) => s + (t.totalAmount || 0), 0),
    count:    recentTxns.length,
  };

  // ── 3. Purchases this month ───────────────────────────────────
  const monthPurchases = await Purchase.find({ purchaseDate: { $gte: from, $lte: to } })
    .select('status totalAmount supplier invoiceNumber purchaseDate')
    .populate('supplier', 'name')
    .sort({ purchaseDate: -1 }).limit(15).lean();

  const purchaseSummary = {
    total:    monthPurchases.reduce((s, p) => s + (p.totalAmount || 0), 0),
    count:    monthPurchases.length,
    draft:    monthPurchases.filter(p => p.status === 'draft').length,
    pending:  monthPurchases.filter(p => p.status === 'checked').length,
    approved: monthPurchases.filter(p => p.status === 'approved').length,
    received: monthPurchases.filter(p => p.status === 'received').length,
  };

  // ── 4. Suppliers ──────────────────────────────────────────────
  let supplierInfo = null;
  if (['admin', 'manager'].includes(userRole)) {
    const suppliers = await Supplier.find({ isActive: true, deletedAt: null })
      .select('name category').limit(20).lean();
    supplierInfo = { count: suppliers.length, list: suppliers.map(s => `${s.name} (${s.category || 'General'})`).join(', ') };
  }

  // ── 5. Users / Staff ─────────────────────────────────────────
  let staffInfo = null;
  if (userRole === 'admin') {
    const users = await User.find({ isActive: true }).select('name role').lean();
    const byRole = {};
    users.forEach(u => { byRole[u.role] = (byRole[u.role] || 0) + 1; });
    staffInfo = { total: users.length, byRole };
  }

  // ── 6. Stock requests (pending) ───────────────────────────────
  const pendingRequests = await StockRequest.find({ status: 'pending', deletedAt: null })
    .select('department priority voucherNo items requestedAt')
    .populate('items.material', 'name')
    .sort({ requestedAt: -1 }).limit(10).lean();

  // ── 7. Consumption this month ─────────────────────────────────
  const monthConsumption = await Consumption.find({
    status: 'approved',
    date: { $gte: from, $lte: to },
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  }).select('category totalRecipeCost').lean();

  const consumptionByCategory = {};
  monthConsumption.forEach(c => {
    consumptionByCategory[c.category] = (consumptionByCategory[c.category] || 0) + c.totalRecipeCost;
  });

  // ── 8. Top valued materials ───────────────────────────────────
  const topValued = allMaterials
    .map(m => ({ name: m.name, value: m.currentStock * m.unitCost, stock: m.currentStock, unit: m.unit }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // ── 9. Employees ──────────────────────────────────────────────
  let employeeInfo = null;
  if (['admin', 'manager'].includes(userRole)) {
    const empCount = await Employee.countDocuments({ deletedAt: null, status: 'active' });
    employeeInfo = { activeCount: empCount };
  }

  // ── 10. Products ──────────────────────────────────────────────
  const productCount = await Product.countDocuments({ isActive: true, deletedAt: null });

  // ── Assemble context string ───────────────────────────────────
  const today = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  let ctx = `
=== FIVE STOP HOTEL — LIVE SYSTEM SNAPSHOT ===
Date: ${today}
User Role: ${userRole.toUpperCase()}
Hotel: Five Stop Hotel (Nobir Trading Plc Stock Management System)

--- STOCK OVERVIEW ---
Total Active Materials: ${materials}
Total Stock Value: ${etb(totalStockValue)}
Out of Stock: ${outOfStock} items${outOfStockItems.length ? ` → ${outOfStockItems.map(m => m.name).join(', ')}` : ''}
Low Stock (below reorder): ${lowStock.length} items
${lowStock.length > 0 ? lowStock.map(m => `  • ${m.name}: ${m.currentStock} ${m.unit} (reorder at ${m.reorderLevel})`).join('\n') : '  None'}

Stock by Category:
${Object.entries(stockByCategory).map(([cat, d]) => `  • ${cat}: ${d.count} items, ${etb(d.value)}`).join('\n')}

Top Valued Items in Stock:
${topValued.map((m, i) => `  ${i + 1}. ${m.name}: ${m.stock} ${m.unit} = ${etb(m.value)}`).join('\n')}

--- STOCK MOVEMENTS (Last 7 Days) ---
Total Transactions: ${txnSummary.count}
Stock In Value: ${etb(txnSummary.totalIn)}
Stock Out Value: ${etb(txnSummary.totalOut)}
Net Flow: ${etb(txnSummary.totalIn - txnSummary.totalOut)}

--- PURCHASES (${monthName}) ---
Total Spend: ${etb(purchaseSummary.total)}
Purchase Orders: ${purchaseSummary.count} (Draft: ${purchaseSummary.draft}, Pending Approval: ${purchaseSummary.pending}, Approved: ${purchaseSummary.approved}, Received: ${purchaseSummary.received})

--- STOCK REQUESTS (Pending Approval) ---
Pending Requests: ${pendingRequests.length}
${pendingRequests.length > 0 ? pendingRequests.map(r => `  • ${r.voucherNo} — ${r.department} (${r.priority})`).join('\n') : '  None pending'}

--- CONSUMPTION (${monthName}) ---
Total Recipe Cost: ${etb(Object.values(consumptionByCategory).reduce((s, v) => s + v, 0))}
${Object.entries(consumptionByCategory).map(([cat, cost]) => `  • ${cat}: ${etb(cost)}`).join('\n') || '  No consumption recorded'}

--- PRODUCTS ---
Active Products/Recipes: ${productCount}
`;

  if (supplierInfo) {
    ctx += `
--- SUPPLIERS ---
Active Suppliers: ${supplierInfo.count}
List: ${supplierInfo.list}
`;
  }

  if (staffInfo) {
    ctx += `
--- STAFF ---
Total Active Users: ${staffInfo.total}
By Role: ${Object.entries(staffInfo.byRole).map(([r, c]) => `${r}: ${c}`).join(', ')}
`;
  }

  if (employeeInfo) {
    ctx += `
--- EMPLOYEES ---
Active Employees: ${employeeInfo.activeCount}
`;
  }

  ctx += `
=== END OF SYSTEM SNAPSHOT ===
`;

  return ctx.trim();
}

module.exports = { buildSystemContext };
