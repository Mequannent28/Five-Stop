const express = require('express');
const router = express.Router();
const { getSettings, updateSettings, applyProductPriceAdjustment } = require('../controllers/settingController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getSettings)
  .put(protect, authorize('admin'), updateSettings);

router.post('/apply-product-price-adjustment', protect, authorize('admin'), applyProductPriceAdjustment);

module.exports = router;
