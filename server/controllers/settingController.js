const asyncHandler = require('express-async-handler');
const Setting = require('../models/Setting');

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
    });
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
    'rolePermissions',
    'notes',
  ];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      settings[field] = req.body[field];
    }
  });

  const updated = await settings.save();
  res.json(updated);
});

module.exports = { getSettings, updateSettings };
