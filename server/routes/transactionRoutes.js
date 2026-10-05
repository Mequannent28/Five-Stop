const express = require('express');
const router = express.Router();
const {
  getTransactions,
  createTransaction,
  deleteTransaction,
  getVoucherSummary,
  advanceTransaction,
  importSales,
} = require('../controllers/transactionController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/summary', getVoucherSummary);
router.get('/', getTransactions);
router.post('/', authorize('admin', 'manager', 'storekeeper'), createTransaction);
router.post('/import-sales', authorize('admin', 'manager', 'storekeeper'), importSales);
router.post('/:id/advance', advanceTransaction);
router.delete('/:id', authorize('admin', 'manager'), deleteTransaction);

module.exports = router;
