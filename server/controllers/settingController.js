const asyncHandler = require('express-async-handler');
const Setting = require('../models/Setting');
const { clearSettingsCache, DEFAULT_ROLE_PERMISSIONS } = require('../middleware/authMiddleware');

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
    });
  } else if (!settings.rolePermissions) {
    settings.rolePermissions = DEFAULT_ROLE_PERMISSIONS;
    settings.markModified('rolePermissions');
    await settings.save();
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
    'hotelName',
    'systemEmail',
    'phone',
    'address',
    'currency',
    'currencySymbol',
    'lowStockThresholdDefault',
    'taxRate',
    'autoGenerateVoucherNo',
    'allowNegativeStock',
    'notes',
  ];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      settings[field] = req.body[field];
    }
  });

  if (req.body.rolePermissions !== undefined) {
    settings.rolePermissions = req.body.rolePermissions;
    settings.markModified('rolePermissions');
  }

  const updated = await settings.save();
  clearSettingsCache();
  res.json(updated);
});

module.exports = { getSettings, updateSettings };

