const mongoose = require('mongoose');

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
    notes: { type: String, default: 'Five Stop Hotel Management & Stock Control System' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Setting', settingSchema);
