const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema(
  {
    material: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
    quantity: { type: Number, required: true, min: 0.01 },
    unitCost: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

/*
  Approval workflow:
  ─────────────────────────────────────────────────────────
  draft  →  [checker password]  →  checked
  checked →  [approver password] →  approved
  approved → [receiver password] →  received  (stock applied)
  any stage → [admin password]   →  cancelled
  ─────────────────────────────────────────────────────────
*/
const stageEntrySchema = new mongoose.Schema(
  {
    action:     { type: String },           // 'checked' | 'approved' | 'received' | 'cancelled'
    by:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    byName:     { type: String },
    byRole:     { type: String },
    at:         { type: Date, default: Date.now },
    note:       { type: String, default: '' },
  },
  { _id: false }
);

const purchaseSchema = new mongoose.Schema(
  {
    supplier:      { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    items:         { type: [purchaseItemSchema], required: true, validate: (v) => v.length > 0 },
    totalAmount:   { type: Number, required: true, default: 0 },
    invoiceNumber: { type: String, trim: true },
    purchaseDate:  { type: Date, default: Date.now },

    // Workflow status
    status: {
      type: String,
      enum: ['draft', 'checked', 'approved', 'received', 'cancelled'],
      default: 'draft',
    },

    // Per-stage sign-off
    checkedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    checkedAt:  { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    receivedAt: { type: Date },

    // Full audit trail
    trail: [stageEntrySchema],

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes:      { type: String, trim: true },
  },
  { timestamps: true }
);

purchaseSchema.index({ purchaseDate: -1 });
purchaseSchema.index({ createdAt: -1 });
purchaseSchema.index({ status: 1 });
purchaseSchema.index({ supplier: 1 });

module.exports = mongoose.model('Purchase', purchaseSchema);

