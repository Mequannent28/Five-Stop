const mongoose = require('mongoose');

const DEFAULT_NAV_VISIBILITY = {
  dashboard:       { storekeeper: true,  manager: true,  admin: true },
  rawMaterials:    { storekeeper: true,  manager: true,  admin: true },
  products:        { storekeeper: true,  manager: true,  admin: true },
  stockMovements:  { storekeeper: true,  manager: true,  admin: true },
  suppliers:       { storekeeper: false, manager: true,  admin: true },
  consumption:     { storekeeper: true,  manager: true,  admin: true },
  reports:         { storekeeper: false, manager: true,  admin: true },
  analytics:       { storekeeper: false, manager: true,  admin: true },
  staffAccounts:   { storekeeper: false, manager: false, admin: true },
};

const settingSchema = new mongoose.Schema(
  {
    hotelName: { type: String, default: 'Five Stop' },
    systemEmail: { type: String, default: 'info@fivestop.com' },
    phone: { type: String, default: '+251 911 000 111' },
    address: { type: String, default: 'Addis Ababa, Ethiopia' },
    currency: { type: String, default: 'ETB' },
    currencySymbol: { type: String, default: 'ETB' },
    lowStockThresholdDefault: { type: Number, default: 15 },
    taxRate: { type: Number, default: 15 },
    autoGenerateVoucherNo: { type: Boolean, default: true },
    allowNegativeStock: { type: Boolean, default: false },
    rolePermissions: {
      type: Object,
      default: {
        recordGoods:      { storekeeper: true,  manager: true,  admin: true },
        checkReview:      { storekeeper: false, manager: true,  admin: true },
        approveGoods:     { storekeeper: false, manager: false, admin: true },
        postLedger:       { storekeeper: false, manager: true,  admin: true },
        voidTransactions: { storekeeper: false, manager: false, admin: true },
        viewReports:      { storekeeper: false, manager: true,  admin: true },
        manageAccounts:   { storekeeper: false, manager: false, admin: true },
      },
    },
    navVisibility: {
      type: Object,
      default: DEFAULT_NAV_VISIBILITY,
    },
    // Telegram bot subscribers — array of { chatId, name, username, subscribedAt }
    telegramSubscribers: {
      type: Array,
      default: [],
    },
    notes: { type: String, default: 'Five Stop Hotel Management & Stock Control System' },

    // ── Pricing & Cost Parameters ─────────────────────────────────
    // Contingency: % buffer added on top of raw material cost (waste, price fluctuation)
    contingencyPercent:          { type: Number, default: 10,        min: 0, max: 100 },
    // Overhead: % of total cost added for electricity, labour, etc.
    overheadPercent:             { type: Number, default: 25,        min: 0, max: 100 },
    // Default Food Cost %: used to back-calculate suggested selling price
    // e.g. if food cost % = 30, selling price = totalCost / 0.30
    defaultFoodCostPercent:      { type: Number, default: 30,        min: 1, max: 100 },
    // Raw Material Price Adjustment: apply globally before recipe cost calculation
    // 'percent' = add X% to every unit cost | 'fixed' = add fixed ETB amount
    rawMaterialPriceAdjustType:  { type: String, default: 'percent', enum: ['percent', 'fixed'] },
    rawMaterialPriceAdjustValue: { type: Number, default: 0,         min: 0 },
    // Product Selling Price Bulk Adjustment — percentage to add to ALL product selling prices
    productSellingPriceAdjustPercent: { type: Number, default: 0, min: 0, max: 500 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Setting', settingSchema);
module.exports.DEFAULT_NAV_VISIBILITY = DEFAULT_NAV_VISIBILITY;
