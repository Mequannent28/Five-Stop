const mongoose = require('mongoose');

const rawMaterialSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true, default: '' },
    name: { type: String, required: true, trim: true },
    category: { type: String, trim: true, default: 'General' },
    unit: { type: String, required: true, trim: true }, // kg, ltr, pcs, box...
    currentStock: { type: Number, required: true, default: 0 },
    reorderLevel: { type: Number, required: true, default: 10 },
    unitCost: { type: Number, default: 0 },
    storeLocation: { type: String, trim: true, default: 'Main Store' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

rawMaterialSchema.virtual('status').get(function () {
  if (this.currentStock <= 0) return 'out_of_stock';
  if (this.currentStock <= this.reorderLevel) return 'low_stock';
  return 'in_stock';
});

rawMaterialSchema.set('toJSON', { virtuals: true });
rawMaterialSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('RawMaterial', rawMaterialSchema);
