const express = require('express');
const router = express.Router();
const {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  bulkDeleteTransactions,
  restoreTransaction,
  permanentDeleteTransaction,
  getVoucherSummary,
  advanceTransaction,
  importSales,
} = require('../controllers/transactionController');
const { protect, authorizePermission } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/summary', getVoucherSummary);
router.get('/', getTransactions);
router.post('/', authorizePermission('recordGoods'), createTransaction);
router.post('/import-sales', authorizePermission('recordGoods'), importSales);
router.delete('/bulk', authorizePermission('voidTransactions'), bulkDeleteTransactions);
router.put('/:id', authorizePermission('recordGoods'), updateTransaction);
router.post('/:id/advance', advanceTransaction);
router.post('/:id/restore', authorizePermission('voidTransactions'), restoreTransaction);
router.delete('/:id/permanent', authorizePermission('voidTransactions'), permanentDeleteTransaction);
router.delete('/:id', authorizePermission('voidTransactions'), deleteTransaction);

module.exports = router;

