const express = require('express');
const router = express.Router();
const {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  bulkDeleteSuppliers,
  restoreSupplier,
  permanentDeleteSupplier,
} = require('../controllers/supplierController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);
router.delete('/bulk',          authorize('admin', 'manager'), bulkDeleteSuppliers);
router.post('/:id/restore',     authorize('admin', 'manager'), restoreSupplier);
router.delete('/:id/permanent', authorize('admin'), permanentDeleteSupplier);
router.get('/', getSuppliers);
router.get('/:id', getSupplierById);
router.post('/', authorize('admin', 'manager'), createSupplier);
router.put('/:id', authorize('admin', 'manager'), updateSupplier);
router.delete('/:id', authorize('admin'), deleteSupplier);

module.exports = router;
