const express = require('express');
const router  = express.Router();
const {
  getStores,
  listCounts,
  getCount,
  initializeCount,
  updateLines,
  submitCount,
  approveCount,
  deleteCount,
} = require('../controllers/inventoryCountController');
const { protect, authorizePermission } = require('../middleware/authMiddleware');

router.use(protect);

router.get  ('/stores',          getStores);
router.get  ('/',                listCounts);
router.get  ('/:id',             getCount);
router.post ('/initialize',      initializeCount);
router.patch('/:id/lines',       updateLines);
router.post ('/:id/submit',      submitCount);
router.post ('/:id/approve',     approveCount);
router.delete('/:id',            deleteCount);

module.exports = router;
