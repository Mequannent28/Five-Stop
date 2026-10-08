const express = require('express');
const router  = express.Router();
const { handleWebhook, getSubscribers, removeSubscriber } = require('../controllers/telegramController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Telegram calls this — no auth needed (verified by bot token in URL)
router.post('/webhook', handleWebhook);

// Admin management endpoints
router.get('/subscribers',            protect, authorize('admin'), getSubscribers);
router.delete('/subscribers/:chatId', protect, authorize('admin'), removeSubscriber);

module.exports = router;
