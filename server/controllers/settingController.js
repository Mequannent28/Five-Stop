const asyncHandler      = require('express-async-handler');
const Setting           = require('../models/Setting');
const { clearSettingsCache, DEFAULT_ROLE_PERMISSIONS } = require('../middleware/authMiddleware');
const tg = require('../utils/telegramNotifier');

const DEFAULT_NAV_VISIBILITY = {
  dashboard:      { storekeeper: true,  manager: true,  admin: true },
  rawMaterials:   { storekeeper: true,  manager: true,  admin: true },
  products:       { storekeeper: true,  manager: true,  admin: true },
  stockMovements: { storekeeper: true,  manager: true,  admin: true },
  suppliers:      { storekeeper: false, manager: true,  admin: true },
  consumption:    { storekeeper: true,  manager: true,  admin: true },
  reports:        { storekeeper: false, manager: true,  admin: true },
  analytics:      { storekeeper: false, manager: true,  admin: true },
  staffAccounts:  { storekeeper: false, manager: false, admin: true },
};

// @desc   Get system settings (creates default if none exists)
// @route  GET /api/settings
// @access Private
const getSettings = asyncHandler(async (req, res) => {
  let settings = await Setting.findOne();
  if (!settings) {
    settings = await Setting.create({
      hotelName: 'Five Stop',
      systemEmail: 'info@fivestop.com',
      phone: '+251 911 000 111',
      address: 'Addis Ababa, Ethiopia',
      currency: 'ETB',
      currencySymbol: 'ETB',
      lowStockThresholdDefault: 15,
      taxRate: 15,
      autoGenerateVoucherNo: true,
      allowNegativeStock: false,
      rolePermissions: DEFAULT_ROLE_PERMISSIONS,
      navVisibility: DEFAULT_NAV_VISIBILITY,
    });
  } else {
    let modified = false;
    if (!settings.rolePermissions) {
      settings.rolePermissions = DEFAULT_ROLE_PERMISSIONS;
      settings.markModified('rolePermissions');
      modified = true;
    }
    if (!settings.navVisibility) {
      settings.navVisibility = DEFAULT_NAV_VISIBILITY;
      settings.markModified('navVisibility');
      modified = true;
    }
    if (modified) await settings.save();
  }
  res.json(settings);
});

// @desc   Update system settings
// @route  PUT /api/settings
// @access Private/Admin
const updateSettings = asyncHandler(async (req, res) => {
  let settings = await Setting.findOne();
  if (!settings) {
    settings = new Setting();
  }

  const allowedFields = [
    'hotelName', 'systemEmail', 'phone', 'address',
    'currency', 'currencySymbol', 'lowStockThresholdDefault',
    'taxRate', 'autoGenerateVoucherNo', 'allowNegativeStock', 'notes',
    // Pricing & Cost Parameters
    'contingencyPercent', 'overheadPercent', 'defaultFoodCostPercent',
    'rawMaterialPriceAdjustType', 'rawMaterialPriceAdjustValue',
    'productSellingPriceAdjustPercent',
  ];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) settings[field] = req.body[field];
  });

  if (req.body.rolePermissions !== undefined) {
    settings.rolePermissions = req.body.rolePermissions;
    settings.markModified('rolePermissions');
  }

  if (req.body.navVisibility !== undefined) {
    settings.navVisibility = req.body.navVisibility;
    settings.markModified('navVisibility');
  }

  const updated = await settings.save();
  clearSettingsCache();
  tg.notifySettingsChanged(req.body, req.user);
  res.json(updated);
});

// @desc   Apply bulk % increase to ALL product selling prices
// @route  POST /api/settings/apply-product-price-adjustment
// @access Private/Admin
const applyProductPriceAdjustment = asyncHandler(async (req, res) => {
  const { percent } = req.body;
  const pct = Number(percent);
  if (!pct || pct <= 0 || pct > 500) {
    res.status(400); throw new Error('Percent must be between 0.01 and 500');
  }

  const Product = require('../models/Product');

  // Fetch all active products
  const products = await Product.find({ isActive: true });
  let updatedCount = 0;

  for (const product of products) {
    const oldPrice = product.sellingPrice || 0;
    if (oldPrice > 0) {
      product.sellingPrice = Math.round(oldPrice * (1 + pct / 100) * 100) / 100;
      await product.save();
      updatedCount++;
    }
  }

  tg.notifySettingsChanged && tg.notifySettingsChanged(
    { action: `Bulk product price +${pct}%`, updatedCount },
    req.user
  );

  res.json({
    message: `Successfully applied +${pct}% to ${updatedCount} product selling prices.`,
    updatedCount,
    percent: pct,
  });
});

module.exports = { getSettings, updateSettings, applyProductPriceAdjustment };

