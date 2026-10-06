const mongoose = require('mongoose');

/*
  InventoryCount – periodic physical count sheet per storage location.

  Workflow:
    draft   → storekeeper enters physical counts
    submitted → head of store submits for approval
    approved  → management approves → closing balances locked
    closed    → record is archived

  WAC (Weighted Average Cost) is computed automatically from transactions
  and stored on each line when the count is submitted/approved.
*/

const countLineSchema = new mongoose.Schema(
  {
    material:       { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
    materialName:   { type: String, default: '' },
    unit:           { type: String, default: '' },
    beginBalance:   { type: Number, default: 0 },
    inQty:          { type: Number, default: 0 },
    outQty:         { type: Number, default: 0 },
    systemBalance:  { type: Number, default: 0 },
    physicalCount:  { type: Number, default: null },
    variance:       { type: Number, default: 0 },
    varianceType:   { type: String, enum: ['positive', 'negative', 'zero', null], default: null },
    wac:            { type: Number, default: 0 },
    varianceValue:  { type: Number, default: 0 },
    isCounted:      { type: Boolean, default: false },
    note:           { type: String, default: '' },
  },
  { _id: false }
);

const inventoryCountSchema = new mongoose.Schema(
  {
    periodYear:    { type: Number, required: true },
    periodMonth:   { type: Number, required: true, min: 1, max: 12 },
    storeLocation: { type: String, required: true, trim: true },
    title:         { type: String, default: '' },

    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved', 'closed'],
      default: 'draft',
    },

    lines: [countLineSchema],

    totalItems:        { type: Number, default: 0 },
    countedItems:      { type: Number, default: 0 },
    uncountedItems:    { type: Number, default: 0 },
    positiveVariance:  { type: Number, default: 0 },
    negativeVariance:  { type: Number, default: 0 },
    netVarianceValue:  { type: Number, default: 0 },

    closingDate: { type: Date },

    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    submittedAt: { type: Date },
    approvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt:  { type: Date },

    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

inventoryCountSchema.index(
  { storeLocation: 1, periodYear: 1, periodMonth: 1 },
  { unique: true }
);
inventoryCountSchema.index({ status: 1 });
inventoryCountSchema.index({ periodYear: -1, periodMonth: -1 });

module.exports = mongoose.model('InventoryCount', inventoryCountSchema);
