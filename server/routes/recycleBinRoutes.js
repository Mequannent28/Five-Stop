const express = require('express');
const router  = express.Router();
const { getRecycleBin, restoreItem, permanentDelete, emptyRecycleBin } = require('../controllers/recycleBinController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);
router.use(authorize('admin', 'manager'));

router.get('/',                         getRecycleBin);
router.post('/:type/:id/restore',       restoreItem);
router.delete('/empty',                 emptyRecycleBin);
router.delete('/:type/:id',             permanentDelete);

module.exports = router;
