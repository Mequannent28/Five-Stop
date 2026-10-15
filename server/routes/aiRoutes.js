const express = require('express');
const router  = express.Router();
const { chat, analyze, quickSuggestions } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/chat',             chat);
router.get('/analyze',           analyze);
router.get('/quick-suggestions', quickSuggestions);

module.exports = router;
