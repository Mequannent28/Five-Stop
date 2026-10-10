const express = require('express');
const router  = express.Router();
const { handleWebhook, getSubscribers, updateSubscriberPhone, removeSubscriber } = require('../controllers/telegramController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Telegram calls this — no auth needed
router.post('/webhook', handleWebhook);

// Admin management
router.get('/subscribers',                   protect, authorize('admin'), getSubscribers);
router.put('/subscribers/:chatId/phone',     protect, authorize('admin'), updateSubscriberPhone);
router.delete('/subscribers/:chatId',        protect, authorize('admin'), removeSubscriber);

module.exports = router;
