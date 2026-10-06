const express = require('express');
const router = express.Router();
const {
  getDailyReport,
  getVoucherReport,
  getCashGRVReport,
  getCreditGRVReport,
  getDisposalReport,
  getNegAdjReport,
  getPosAdjReport,
  getFreshBazaarReport,
  getStockLevelReport,
  getPurchaseReport,
  getSummaryReport,
  getStockBalanceReport,
  getItemStockLedger,
  getMonthlyClosingReport,
} = require('../controllers/reportController');
const { protect, authorizePermission } = require('../middleware/authMiddleware');

router.use(protect);
router.use(authorizePermission('viewReports'));

// Stock Balance & Monthly Closing
router.get('/stock-balance',                     getStockBalanceReport);
router.get('/monthly-closing',                   getMonthlyClosingReport);
router.get('/stock-balance/ledger/:materialId', getItemStockLedger);

// Existing
router.get('/daily',        getDailyReport);
router.get('/stock-levels', getStockLevelReport);
router.get('/purchases',    getPurchaseReport);

// Per-voucher-type (specific)
router.get('/cash-grv',       getCashGRVReport);
router.get('/credit-grv',     getCreditGRVReport);
router.get('/disposal',       getDisposalReport);
router.get('/neg-adjustment', getNegAdjReport);
router.get('/pos-adjustment', getPosAdjReport);
router.get('/fresh-bazaar',   getFreshBazaarReport);

// Generic: /api/reports/voucher?voucherType=cash_grv&from=...&to=...
router.get('/voucher',  getVoucherReport);
router.get('/summary',  getSummaryReport);

module.exports = router;
