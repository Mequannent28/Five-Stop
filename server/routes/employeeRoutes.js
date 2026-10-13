const express = require('express');
const router  = express.Router();
const {
  getEmployees, getDepartments, createEmployee, updateEmployee, deleteEmployee,
} = require('../controllers/employeeController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/departments', getDepartments);
router.get('/',            getEmployees);
router.post('/',           createEmployee);
router.put('/:id',         updateEmployee);
router.delete('/:id',      deleteEmployee);

module.exports = router;
