const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'purchase', 'stock_request', 'transaction', 'consumption',
        'material', 'employee', 'user', 'system', 'low_stock',
      ],
      default: 'system',
    },
    title:    { type: String, required: true },
    message:  { type: String, required: true },
    icon:     { type: String, default: '📦' },
    link:     { type: String, default: '' },       // frontend route to navigate to
    severity: { type: String, enum: ['info', 'success', 'warning', 'error'], default: 'info' },
    readBy:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy:{ type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
