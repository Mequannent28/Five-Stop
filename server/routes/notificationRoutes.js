const express = require('express');
const router  = express.Router();
const asyncHandler = require('express-async-handler');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

// GET /api/notifications — last 30, with unread count
router.get('/', asyncHandler(async (req, res) => {
  const notifications = await Notification.find()
    .sort({ createdAt: -1 })
    .limit(40)
    .lean();
  const unread = notifications.filter(n => !n.readBy?.includes(req.user._id.toString())).length;
  res.json({ notifications, unread });
}));

// POST /api/notifications/read-all — mark all as read for this user
router.post('/read-all', asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { readBy: { $ne: req.user._id } },
    { $addToSet: { readBy: req.user._id } }
  );
  res.json({ message: 'All marked as read' });
}));

// POST /api/notifications/:id/read — mark one as read
router.post('/:id/read', asyncHandler(async (req, res) => {
  await Notification.findByIdAndUpdate(req.params.id, {
    $addToSet: { readBy: req.user._id },
  });
  res.json({ message: 'Marked as read' });
}));

module.exports = router;
