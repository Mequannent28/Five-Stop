const asyncHandler = require('express-async-handler');
const RawMaterial = require('../models/RawMaterial');
const Purchase = require('../models/Purchase');
const StockTransaction = require('../models/StockTransaction');
const Supplier = require('../models/Supplier');

const getSummary = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sevenDaysAgo = new Date(startOfToday);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  // Parallel database execution for instantaneous responses
  const [
    materials,
    totalSuppliers,
    todaysPurchases,
    monthPurchases,
    weekTransactions,
    recentTransactions,
  ] = await Promise.all([
    RawMaterial.find({}).lean(),
    Supplier.countDocuments({ isActive: true }),
    Purchase.countDocuments({ purchaseDate: { $gte: startOfToday } }),
    Purchase.find({ purchaseDate: { $gte: startOfMonth } }).select('totalAmount').lean(),
    StockTransaction.find({ date: { $gte: sevenDaysAgo } }).select('date type quantity items').lean(),
    StockTransaction.find({})
      .populate('material', 'name unit')
      .populate('items.material', 'name unit')
      .populate('supplier', 'name')
      .populate('performedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(7)
      .lean(),
  ]);

  const totalMaterials = materials.length;
  const lowStockCount = materials.filter((m) => m.currentStock > 0 && m.currentStock <= m.reorderLevel).length;
  const outOfStockCount = materials.filter((m) => m.currentStock <= 0).length;
  const stockValue = materials.reduce((sum, m) => sum + m.currentStock * (m.unitCost || 0), 0);
  const monthSpend = monthPurchases.reduce((s, p) => s + (p.totalAmount || 0), 0);

  // Build 7-day movement trend in memory (single-pass)
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(startOfToday);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayTx = weekTransactions.filter((t) => {
      const txDate = t.date ? new Date(t.date).toISOString().slice(0, 10) : '';
      return txDate === dateStr;
    });

    const stockIn = dayTx.filter((t) => t.type === 'in').reduce((s, t) => {
      const itemsQty = t.items && t.items.length > 0 ? t.items.reduce((acc, it) => acc + (it.quantity || 0), 0) : 0;
      return s + (t.quantity || itemsQty);
    }, 0);

    const stockOut = dayTx.filter((t) => t.type === 'out').reduce((s, t) => {
      const itemsQty = t.items && t.items.length > 0 ? t.items.reduce((acc, it) => acc + (it.quantity || 0), 0) : 0;
      return s + (t.quantity || itemsQty);
    }, 0);

    days.push({ date: dateStr, stockIn, stockOut });
  }

  const todayStr = startOfToday.toISOString().slice(0, 10);
  const todayTx = weekTransactions.filter((t) => {
    return t.date && new Date(t.date).toISOString().slice(0, 10) === todayStr;
  });
  const todaysStockIn = todayTx.filter((t) => t.type === 'in').reduce((s, t) => {
    const itemsQty = t.items && t.items.length > 0 ? t.items.reduce((acc, it) => acc + (it.quantity || 0), 0) : 0;
    return s + (t.quantity || itemsQty);
  }, 0);
  const todaysStockOut = todayTx.filter((t) => t.type === 'out').reduce((s, t) => {
    const itemsQty = t.items && t.items.length > 0 ? t.items.reduce((acc, it) => acc + (it.quantity || 0), 0) : 0;
    return s + (t.quantity || itemsQty);
  }, 0);

  // Category breakdown for Pie Chart
  const categoryMap = {};
  materials.forEach((m) => {
    const cat = m.category || 'General';
    const val = (m.currentStock || 0) * (m.unitCost || 0);
    if (!categoryMap[cat]) categoryMap[cat] = { name: cat, value: 0, items: 0 };
    categoryMap[cat].value += val;
    categoryMap[cat].items += 1;
  });
  const categoryBreakdown = Object.values(categoryMap)
    .map((c) => ({
      ...c,
      value: Math.round(c.value * 100) / 100,
    }))
    .sort((a, b) => b.value - a.value);

  // Stock health status for radial / donut
  const inStockCount = materials.filter((m) => m.currentStock > m.reorderLevel).length;
  const stockHealth = [
    { name: 'Adequate Stock', value: inStockCount, color: '#10b981' },
    { name: 'Low Stock', value: lowStockCount, color: '#f59e0b' },
    { name: 'Out of Stock', value: outOfStockCount, color: '#ef4444' },
  ];

  // Top valuable materials
  const topValuableItems = materials
    .map((m) => ({
      name: m.name,
      category: m.category,
      unit: m.unit,
      stock: m.currentStock,
      unitCost: m.unitCost || 0,
      totalValue: Math.round((m.currentStock * (m.unitCost || 0)) * 100) / 100,
    }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 5);

  const lowStockItems = materials
    .filter((m) => m.currentStock <= m.reorderLevel)
    .sort((a, b) => a.currentStock - b.currentStock)
    .slice(0, 6);

  res.json({
    totalMaterials,
    lowStockCount,
    outOfStockCount,
    inStockCount,
    stockValue,
    totalSuppliers,
    todaysPurchases,
    todaysStockIn,
    todaysStockOut,
    monthSpend,
    trend: days,
    categoryBreakdown,
    stockHealth,
    topValuableItems,
    lowStockItems,
    recentTransactions,
  });
});

module.exports = { getSummary };
