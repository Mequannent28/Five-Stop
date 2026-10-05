const express = require('express');
const router = express.Router();
const { getUsers, updateUser, deleteUser } = require('../controllers/userController');
const { protect, authorizePermission } = require('../middleware/authMiddleware');

router.use(protect, authorizePermission('manageAccounts'));
router.get('/', getUsers);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;
